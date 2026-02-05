"use client";

import React, { Component, ReactNode } from "react";
import { getErrorMessage } from "@/lib/error-handler";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary
 * 予期しないエラーをキャッチし、フォールバックUIを表示
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // カスタムfallbackが提供されている場合
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      // デフォルトのエラーUI
      return (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "8px",
            margin: "20px",
          }}
        >
          <h2>エラーが発生しました</h2>
          <p>{getErrorMessage(this.state.error)}</p>
          <button
            onClick={this.reset}
            style={{
              padding: "10px 20px",
              marginTop: "10px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            リトライ
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * エラー表示用の簡易コンポーネント
 */
export function ErrorDisplay({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <div
      style={{
        padding: "20px",
        textAlign: "center",
        backgroundColor: "#fee",
        border: "1px solid #fcc",
        borderRadius: "8px",
        margin: "20px",
      }}
    >
      <h3 style={{ color: "#c00" }}>エラー</h3>
      <p>{getErrorMessage(error)}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "10px 20px",
            marginTop: "10px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          再試行
        </button>
      )}
    </div>
  );
}
