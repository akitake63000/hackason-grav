"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import PageShell from "../ui/PageShell";
import { useAuthState } from "../ui/useAuthState";
import { db } from "@/lib/firebase";
import styles from "./page.module.css";

type SeriesPoint = {
  id: string;
  date: Date;
  densityIndex: number;
};

type ReportResult = {
  reportId: string;
  highlights: string[];
  nextActions: string[];
  rawText: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuthState();
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [reportStatus, setReportStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    const fetchSeries = async () => {
      if (!user) return;
      setLoadingData(true);
      setErrorMessage(null);

      try {
        const analysisRef = collection(db, "analysisResults", user.uid, "items");
        const snapshot = await getDocs(
          query(analysisRef, orderBy("computedAt", "asc"), limit(50)),
        );
        const nextSeries: SeriesPoint[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const density = data.densityIndex;
          if (typeof density !== "number") return;
          const rawTimestamp = data.computedAt ?? data.createdAt;
          const date =
            rawTimestamp instanceof Timestamp
              ? rawTimestamp.toDate()
              : new Date();
          nextSeries.push({ id: docSnap.id, date, densityIndex: density });
        });

        setSeries(nextSeries);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "読み込みに失敗しました。",
        );
      } finally {
        setLoadingData(false);
      }
    };

    if (user) {
      void fetchSeries();
    }
  }, [user]);

  const latest = series[series.length - 1];
  const prev = series[series.length - 2];
  const deltaVsPrev =
    latest && prev ? latest.densityIndex - prev.densityIndex : 0;

  const sparkline = useMemo(() => {
    if (series.length < 2) return null;
    const width = 640;
    const height = 200;
    const padding = 20;
    const values = series.map((point) => point.densityIndex);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = (width - padding * 2) / (series.length - 1);

    const points = series
      .map((point, index) => {
        const x = padding + step * index;
        const normalized = (point.densityIndex - min) / range;
        const y = height - padding - normalized * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");

    return { points, width, height, padding };
  }, [series]);

  const handleGenerateReport = async () => {
    if (!user) return;
    setReportStatus("loading");
    setReportError(null);

    try {
      const token = await user.getIdToken(true);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "";
      const response = await fetch(`${apiBase}/api/v1/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ periodDays: 7 }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `レポート生成に失敗しました。(${response.status}) ${detail}`,
        );
      }

      const data = (await response.json()) as ReportResult;
      setReport(data);
      setReportStatus("idle");
    } catch (error) {
      setReportStatus("error");
      setReportError(
        error instanceof Error ? error.message : "レポート生成に失敗しました。",
      );
    }
  };

  return (
    <PageShell
      title="Dashboard"
      description="進捗とレポートの表示場所です。"
      badge="Insights"
    >
      <div className={styles.block}>
        <div className={styles.kpi}>
          <div>
            <p className={styles.kpiLabel}>最新の密度指数</p>
            <p className={styles.kpiValue}>
              {latest ? latest.densityIndex.toFixed(3) : "--"}
            </p>
          </div>
          <div>
            <p className={styles.kpiLabel}>前回比</p>
            <p className={styles.kpiValue}>
              {series.length >= 2 ? deltaVsPrev.toFixed(3) : "--"}
            </p>
          </div>
        </div>
        <div className={styles.chart}>
          {loadingData ? (
            <p className={styles.muted}>読み込み中...</p>
          ) : errorMessage ? (
            <p className={styles.error}>{errorMessage}</p>
          ) : series.length === 0 ? (
            <p className={styles.muted}>まだ解析結果がありません。</p>
          ) : sparkline ? (
            <svg
              className={styles.sparkline}
              viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
            >
              <polyline
                points={sparkline.points}
                fill="none"
                stroke="#3a3026"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {series.map((point, index) => {
                const step =
                  (sparkline.width - sparkline.padding * 2) /
                  (series.length - 1);
                const values = series.map((value) => value.densityIndex);
                const min = Math.min(...values);
                const max = Math.max(...values);
                const range = max - min || 1;
                const x = sparkline.padding + step * index;
                const normalized = (point.densityIndex - min) / range;
                const y =
                  sparkline.height -
                  sparkline.padding -
                  normalized * (sparkline.height - sparkline.padding * 2);
                return <circle key={point.id} cx={x} cy={y} r="4" />;
              })}
            </svg>
          ) : (
            <p className={styles.muted}>データが不足しています。</p>
          )}
        </div>
        <div className={styles.listBlock}>
          <h2>週次レポート</h2>
          <div className={styles.reportActions}>
            <button
              className={styles.action}
              type="button"
              onClick={handleGenerateReport}
              disabled={reportStatus === "loading"}
            >
              {reportStatus === "loading" ? "生成中..." : "レポート生成"}
            </button>
            <span className={styles.muted}>
              /api/v1/reports/generate を実行します。
            </span>
          </div>
          {reportError ? <p className={styles.error}>{reportError}</p> : null}
          {report ? (
            <div className={styles.reportCard}>
              <h3>ハイライト</h3>
              <ul>
                {report.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h3>次の一手</h3>
              <ul>
                {report.nextActions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
