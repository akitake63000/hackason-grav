'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getFirestoreDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

interface AnalysisResult {
    score: number;
    notes: string | null;
}

function ResultContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const photoId = searchParams.get('photoId');

    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!photoId) {
            setError("photoId が見つかりません。");
            setLoading(false);
            return;
        }

        const fetchResult = async () => {
            try {
                const auth = getAuth();
                const user = auth.currentUser;

                if (!user) {
                    throw new Error("ログインしてください");
                }

                const db = getFirestoreDb();
                const resultRef = doc(db, `users/${user.uid}/analysisResults`, photoId);
                const resultSnap = await getDoc(resultRef);

                if (!resultSnap.exists()) {
                    throw new Error("解析結果が見つかりません");
                }

                const data = resultSnap.data();
                setResult({
                    score: data.score || 0,
                    notes: data.notes || null,
                });
            } catch (err: any) {
                console.error(err);
                setError(err.message || "解析結果の取得に失敗しました");
            } finally {
                setLoading(false);
            }
        };

        fetchResult();
    }, [photoId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="animate-spin text-blue-500 text-5xl mb-4">⏳</div>
                    <h2 className="text-xl font-semibold text-gray-700">読み込み中...</h2>
                    <p className="text-gray-500 mt-2">解析結果を取得しています。</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h2 className="text-xl font-semibold text-gray-700">エラーが発生しました</h2>
                    <p className="text-gray-500 mt-2">{error}</p>
                    <button
                        onClick={() => router.push('/feature1/capture')}
                        className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow transition"
                    >
                        戻る
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                <div className="text-green-500 text-5xl mb-4">✨</div>
                <h2 className="text-xl font-semibold text-gray-700">解析完了</h2>

                <div className="bg-green-50 rounded-xl p-4 text-left space-y-4 border border-green-100 mt-6">
                    <div className="flex justify-between items-center border-b border-green-200 pb-2">
                        <span className="text-gray-600 font-medium">髪密度スコア</span>
                        <span className="text-3xl font-bold text-green-700">{result?.score || 0}</span>
                    </div>
                    <div>
                        <span className="text-gray-600 font-medium block mb-1">分析コメント</span>
                        <p className="text-gray-700 text-sm bg-white p-2 rounded border border-green-100">
                            {result?.notes || "コメントはありません"}
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => router.push('/feature1/capture')}
                    className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow transition"
                >
                    新しく撮影する
                </button>
            </div>
        </div>
    );
}

export default function ResultPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <p>Loading...</p>
            </div>
        }>
            <ResultContent />
        </Suspense>
    );
}
