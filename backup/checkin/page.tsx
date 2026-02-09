"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import PageShell from "../ui/PageShell";
import { useAuthState } from "../ui/useAuthState";
import { db, storage } from "@/lib/firebase";
import styles from "./page.module.css";

type AnalyzeResponse = {
  densityIndex: number;
  deltaVsPrev: number;
  deltaVsBase: number;
  quality: { score: number; warnings: string[] };
  analysisId: string;
};

const createPhotoId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `photo_${crypto.randomUUID()}`;
  }
  return `photo_${Date.now()}`;
};

export default function CheckinPage() {
  const router = useRouter();
  const { user, loading } = useAuthState();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "analyzing" | "done" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const previewUrl = useMemo(() => {
    if (!file) {
      return null;
    }
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setResult(null);
    setErrorMessage(null);
    setStatus("idle");
  };

  const handleUpload = async () => {
    if (!user || !file) return;
    setStatus("uploading");
    setErrorMessage(null);

    try {
      const photoId = createPhotoId();
      const storagePath = `users/${user.uid}/photos/${photoId}.jpg`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);

      await setDoc(doc(db, "photos", user.uid, "items", photoId), {
        storagePath,
        capturedAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
        status: "uploaded",
      });

      setStatus("analyzing");

      const token = await user.getIdToken();
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "";
      const response = await fetch(`${apiBase}/api/v1/photos/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          photoId,
          storagePath,
          capturedAt: new Date().toISOString(),
          roiPreset: "crown",
        }),
      });

      if (!response.ok) {
        throw new Error("解析APIの呼び出しに失敗しました。");
      }

      const data = (await response.json()) as AnalyzeResponse;
      const analysisId = data.analysisId?.startsWith("analysis_")
        ? data.analysisId
        : `analysis_${photoId}`;

      await setDoc(doc(db, "analysisResults", user.uid, "items", analysisId), {
        ...data,
        analysisId,
        photoId,
        computedAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });

      setResult({ ...data, analysisId });
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "不明なエラーが発生しました。",
      );
    }
  };

  return (
    <PageShell
      title="Check-in"
      description="写真アップロードと解析リクエストの入り口です。"
      badge="Photos"
    >
      <div className={styles.block}>
        <div className={styles.placeholder}>
          {previewUrl ? (
            <img className={styles.preview} src={previewUrl} alt="preview" />
          ) : (
            "写真プレビュー"
          )}
        </div>
        <div className={styles.actions}>
          <label className={styles.action}>
            写真を選択
            <input
              className={styles.input}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </label>
          <button
            className={styles.actionSecondary}
            type="button"
            onClick={handleUpload}
            disabled={!file || status === "uploading" || status === "analyzing"}
          >
            {status === "uploading"
              ? "アップロード中..."
              : status === "analyzing"
                ? "解析中..."
                : "アップロード"}
          </button>
        </div>
        <p className={styles.muted}>
          Storage へのアップロード後、/api/v1/photos/analyze を呼び出します。
        </p>
        {errorMessage ? (
          <p className={styles.error}>{errorMessage}</p>
        ) : null}
        {result ? (
          <div className={styles.result}>
            <p>densityIndex: {result.densityIndex.toFixed(3)}</p>
            <p>deltaVsPrev: {result.deltaVsPrev.toFixed(3)}</p>
            <p>deltaVsBase: {result.deltaVsBase.toFixed(3)}</p>
            <p>quality: {result.quality.score.toFixed(2)}</p>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
