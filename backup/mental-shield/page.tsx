"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "../ui/PageShell";
import { useAuthState } from "../ui/useAuthState";
import styles from "./page.module.css";

type MentalCard = {
  agent: "encourager" | "coach" | "doctor";
  text: string;
};

type MentalResponse = {
  cards: MentalCard[];
  summary: string;
  threadId: string;
};

export default function MentalShieldPage() {
  const router = useRouter();
  const { user, loading } = useAuthState();
  const [message, setMessage] = useState("最近抜け毛が増えた気がして不安です");
  const [result, setResult] = useState<MentalResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const handleSend = async () => {
    if (!user) return;
    setStatus("loading");
    setErrorMessage(null);

    try {
      const token = await user.getIdToken(true);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "";
      const response = await fetch(`${apiBase}/api/v1/mental-shield/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          threadId: "default",
          message,
          mode: "balanced",
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `メンタルシールドの呼び出しに失敗しました。(${response.status}) ${detail}`,
        );
      }

      const data = (await response.json()) as MentalResponse;
      setResult(data);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "不明なエラーが発生しました。",
      );
    }
  };

  return (
    <PageShell
      title="Mental Shield"
      description="3人格が短く支援し、今日の最小の一手を提示します。"
      badge="Support"
    >
      <div className={styles.block}>
        <label className={styles.label}>
          相談内容
          <textarea
            className={styles.textarea}
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <button
          className={styles.action}
          type="button"
          onClick={handleSend}
          disabled={status === "loading"}
        >
          {status === "loading" ? "相談中..." : "相談する"}
        </button>
        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

        {result ? (
          <div className={styles.cards}>
            {result.cards.map((card) => (
              <div key={card.agent} className={styles.card}>
                <h3>{card.agent}</h3>
                <p>{card.text}</p>
              </div>
            ))}
            <div className={styles.summary}>
              <h3>まとめ</h3>
              <p>{result.summary}</p>
            </div>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
