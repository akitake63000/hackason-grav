"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "../ui/PageShell";
import { useAuthState } from "../ui/useAuthState";
import { fetchFoodRequests, type FoodRequest } from "./history";
import styles from "./page.module.css";

type FoodItem = {
  name: string;
  why: string;
};

type StoreCandidate = {
  name: string;
  distanceM?: number;
  confidence: number;
  note: string;
};

type FoodSniperResponse = {
  items: FoodItem[];
  stores: StoreCandidate[];
  shoppingList: string[];
};

export default function FoodSniperPage() {
  const router = useRouter();
  const { user, loading } = useAuthState();
  const [message, setMessage] = useState("帰りにレバー買って");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<FoodSniperResponse | null>(null);
  const [history, setHistory] = useState<FoodRequest[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!user) return;
      try {
        const data = await fetchFoodRequests(user.uid);
        setHistory(data);
      } catch (error) {
        setHistoryError(
          error instanceof Error ? error.message : "履歴の取得に失敗しました。",
        );
      }
    };

    if (user) {
      void loadHistory();
    }
  }, [user]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage("このブラウザでは位置情報を取得できません。");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setErrorMessage("位置情報の取得に失敗しました。");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleRecommend = async () => {
    if (!user) return;
    setStatus("loading");
    setErrorMessage(null);
    setResult(null);

    try {
      const token = await user.getIdToken(true);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "";
      const response = await fetch(`${apiBase}/api/v1/food-sniper/recommend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          location: location ? { ...location, accuracyM: 40 } : null,
          radiusM: 800,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `推薦APIの呼び出しに失敗しました。(${response.status}) ${detail}`,
        );
      }

      const data = (await response.json()) as FoodSniperResponse;
      setResult(data);
      setStatus("idle");
      if (user) {
        const refreshed = await fetchFoodRequests(user.uid);
        setHistory(refreshed);
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "不明なエラーが発生しました。",
      );
    }
  };

  return (
    <PageShell
      title="Food Sniper"
      description="帰り道で買うべき食材を提案します。"
      badge="Action"
    >
      <div className={styles.block}>
        <label className={styles.label}>
          ひとこと
          <input
            className={styles.input}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <div className={styles.actions}>
          <button className={styles.action} type="button" onClick={handleGetLocation}>
            現在地を取得
          </button>
          <button
            className={styles.actionSecondary}
            type="button"
            onClick={handleRecommend}
            disabled={status === "loading"}
          >
            {status === "loading" ? "提案中..." : "提案する"}
          </button>
        </div>
        <p className={styles.muted}>
          位置情報を許可すると近い店舗を提案できます。
        </p>
        {location ? (
          <p className={styles.location}>
            位置: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </p>
        ) : null}
        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

        {result ? (
          <div className={styles.result}>
            <div>
              <h3>おすすめ食材</h3>
              <ul>
                {result.items.map((item) => (
                  <li key={item.name}>
                    <strong>{item.name}</strong>: {item.why}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>寄れる店</h3>
              {result.stores.length === 0 ? (
                <p className={styles.muted}>位置情報がないため候補がありません。</p>
              ) : (
                <ul>
                  {result.stores.map((store) => (
                    <li key={store.name}>
                      <strong>{store.name}</strong>
                      {store.distanceM ? ` (${store.distanceM}m)` : ""}
                      ：確度 {store.confidence.toFixed(2)} / {store.note}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>買い物リスト</h3>
              <ul>
                {result.shoppingList.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        <div className={styles.history}>
          <h3>履歴</h3>
          {historyError ? <p className={styles.error}>{historyError}</p> : null}
          {history.length === 0 ? (
            <p className={styles.muted}>まだ履歴がありません。</p>
          ) : (
            <ul>
              {history.map((entry) => (
                <li key={entry.id}>
                  <div className={styles.historyHeader}>
                    <span>{entry.query}</span>
                    <span className={styles.historyDate}>
                      {entry.createdAt.toLocaleString()}
                    </span>
                  </div>
                  <p className={styles.historyMeta}>
                    {entry.shoppingList.join(" / ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  );
}
