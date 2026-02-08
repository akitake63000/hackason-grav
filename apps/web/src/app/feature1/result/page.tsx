'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface AnalysisResult {
    score: number;
    notes: string | null;
    hairType?: string;
    pattern?: string;
    quality?: string;
    deltaVsPrev?: string;
}

function ResultContent() {
    const searchParams = useSearchParams();
    const photoId = searchParams.get('photoId');

    // States: 'idle', 'loading', 'success', 'error'
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!photoId) {
            setStatus('error');
            setErrorMessage("photoId が見つかりません。");
        } else {
            setStatus('idle');
        }
    }, [photoId]);

    const handleAnalyze = async () => {
        if (!photoId) return;

        setStatus('loading');
        setErrorMessage(null);

        try {
            const res = await apiFetch('/api/v1/photos/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ photoId }),
            });

            if (!res.ok) {
                throw new Error('Analysis failed');
            }

            const data = await res.json();
            // Expected response: { analysisId, photoId, result: { score, notes, hairType, pattern, quality, deltaVsPrev } }
            setResult(data.result);
            setStatus('success');

        } catch (error: any) {
            console.error(error);
            setErrorMessage(error.message || "解析に失敗しました。");
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                <h1 className="text-2xl font-bold mb-6 text-gray-800">解析結果</h1>

                {/* Status: Loading */}
                {status === 'loading' && (
                    <div className="space-y-4">
                        <div className="animate-spin text-blue-500 text-5xl mb-4">⏳</div>
                        <h2 className="text-xl font-semibold text-gray-700">解析中...</h2>
                        <p className="text-gray-500">AIが画像を分析しています。<br />しばらくお待ちください。</p>
                    </div>
                )}

                {/* Status: Error */}
                {status === 'error' && (
                    <div className="space-y-4">
                        <div className="text-red-500 text-5xl mb-4">⚠️</div>
                        <h2 className="text-xl font-semibold text-gray-700">エラーが発生しました</h2>
                        <p className="text-gray-500">{errorMessage || "不明なエラー"}</p>
                        <button
                            onClick={() => photoId ? handleAnalyze() : null}
                            disabled={!photoId}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg transition disabled:opacity-50"
                        >
                            リトライ
                        </button>
                    </div>
                )}

                {/* Status: Idle */}
                {status === 'idle' && (
                    <div className="space-y-4">
                        <div className="text-blue-500 text-5xl mb-4">📸</div>
                        <h2 className="text-xl font-semibold text-gray-700">Ready to Analyze</h2>
                        <p className="text-gray-500 text-sm">ID: {photoId}</p>
                        <button
                            onClick={handleAnalyze}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow transition"
                        >
                            解析を開始する
                        </button>
                    </div>
                )}

                {/* Status: Success */}
                {status === 'success' && result && (
                    <div className="space-y-6">
                        <div className="text-green-500 text-5xl mb-4">✨</div>
                        <h2 className="text-xl font-semibold text-gray-700">解析完了</h2>

                        <div className="bg-green-50 rounded-xl p-4 text-left space-y-4 border border-green-100">
                            <div className="flex justify-between items-center border-b border-green-200 pb-2">
                                <span className="text-gray-600 font-medium">髪密度スコア</span>
                                <div className="text-right">
                                    <span className="text-3xl font-bold text-green-700">{result.score}</span>
                                    {result.deltaVsPrev && (
                                        <span className={`block text-xs ${result.deltaVsPrev.startsWith('+') ? 'text-green-600' : 'text-red-500'}`}>
                                            前回比: {result.deltaVsPrev}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-b border-green-200 pb-2">
                                <div>
                                    <span className="text-gray-500 text-xs block">AI判定タイプ</span>
                                    <span className="text-gray-800 font-semibold">{result.hairType || '---'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 text-xs block">パターン</span>
                                    <span className="text-gray-800 font-semibold">{result.pattern || '---'}</span>
                                </div>
                            </div>

                            <div>
                                <span className="text-gray-600 font-medium block mb-1">分析コメント</span>
                                <p className="text-gray-700 text-sm bg-white p-2 rounded border border-green-100">
                                    {result.notes || "コメントはありません"}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => window.location.href = '/feature1/dashboard'}
                                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-lg transition border border-gray-300"
                            >
                                ダッシュボードへ戻る
                            </button>
                            <button
                                onClick={handleAnalyze}
                                className="text-gray-500 hover:text-gray-700 font-medium underline text-sm"
                            >
                                再解析 (Retry)
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ResultPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <ResultContent />
        </Suspense>
    );
}
