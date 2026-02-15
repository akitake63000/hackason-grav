'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, ChevronRight, Camera } from 'lucide-react';
import { getFirestoreDb } from '@/lib/firebase';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import Layout from '@/components/Layout';
import Card from '@/components/Card';
import ScoreCircle from '@/components/ScoreCircle';
import Button from '@/components/Button';
import styles from './page.module.css';

interface AnalysisResult {
    score: number;
    notes: string | null;
    hairType?: string;
    pattern?: string;
    scalpCondition?: string;
    delta?: number;
    quality?: string;
}

const PATTERN_DISPLAY_MAP: Record<string, string> = {
    'M字': 'M字型薄毛',
    'O字': 'O字型薄毛',
    'U字': 'U字型薄毛',
    'びまん性': 'びまん性薄毛',
    'オルセン型': 'オルセン型薄毛',
    'ハミルトン型': 'ハミルトン型薄毛',
    'None': '特になし',
};

function ResultContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const photoId = searchParams.get('photoId');

    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const auth = getAuth();

        // Wait for auth state to be initialized
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (!user) {
                setError("ログインしてください");
                setLoading(false);
                return;
            }

            try {
                const db = getFirestoreDb();
                let targetPhotoId = photoId;

                // If no photoId provided, fetch the latest analysis result
                if (!targetPhotoId) {
                    const resultsRef = collection(db, `users/${user.uid}/analysisResults`);
                    const q = query(resultsRef, orderBy('analyzedAt', 'desc'), limit(1));
                    const querySnapshot = await getDocs(q);

                    if (querySnapshot.empty) {
                        // Show empty state instead of redirecting
                        setResult(null);
                        setLoading(false);
                        return;
                    }

                    targetPhotoId = querySnapshot.docs[0].id;
                }

                const resultRef = doc(db, `users/${user.uid}/analysisResults`, targetPhotoId);
                const resultSnap = await getDoc(resultRef);

                if (!resultSnap.exists()) {
                    // Show empty state instead of redirecting
                    setResult(null);
                    setLoading(false);
                    return;
                }

                const data = resultSnap.data();
                setResult({
                    score: data.score || 0,
                    notes: data.notes || null,
                    hairType: data.hairType,
                    pattern: data.pattern,
                    scalpCondition: data.scalpCondition,
                    delta: data.delta,
                    quality: data.quality
                });
            } catch (err: any) {
                console.error(err);
                setError(err.message || "解析結果の取得に失敗しました");
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [photoId, router]);

    const handleNavigateToFoodRecommend = () => {
        if (result?.pattern) {
            const encodedPattern = encodeURIComponent(result.pattern);
            router.push(`/feature3/food-recommend?hairPattern=${encodedPattern}`);
        } else {
            router.push('/feature3/food-recommend');
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className={styles.container}>
                    <div className={styles.loadingContainer}>
                        <Card variant="default" padding="lg" onClick={undefined} style={{}}>
                            <div className={styles.loadingCard}>
                                <div className={styles.loadingSpinner}>⏳</div>
                                <h2 className={styles.errorTitle}>読み込み中...</h2>
                                <p className={styles.errorMessage}>解析結果を取得しています。</p>
                            </div>
                        </Card>
                    </div>
                </div>
            </Layout>
        );
    }

    // Show empty state if no result or error
    if (!result || error) {
        return (
            <Layout>
                <div className={styles.container}>
                    <div className={styles.content}>
                        <motion.div
                            className={styles.emptyState}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            <div className={styles.emptyStateIcon}>
                                <Camera size={48} color="#0693e3" />
                            </div>
                            <h2 className={styles.emptyStateTitle}>まだ解析結果がありません</h2>
                            <p className={styles.emptyStateDescription}>
                                まずは写真を撮影して、AIによる髪密度の解析を始めましょう。
                            </p>
                            <button
                                className={styles.emptyStateButton}
                                onClick={() => router.push('/feature1/capture')}
                            >
                                <Camera size={24} />
                                スキャン開始
                            </button>
                        </motion.div>
                    </div>
                </div>
            </Layout>
        );
    }

    const currentDate = new Date().toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.content}>
                    {/* Title Section */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <h1 className={styles.title}>解析結果</h1>
                        <p className={styles.subtitle}>{currentDate}</p>
                    </motion.div>

                    {/* Score Section */}
                    <motion.div
                        className={styles.scoreSection}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <span className={styles.scoreTitle}>総合健康スコア</span>
                        <ScoreCircle
                            score={result?.score || 0}
                            label={result?.score && result.score >= 70 ? "良好" : result?.score && result.score >= 50 ? "普通" : "要注意"}
                            size={140}
                            delay={0.2}
                            unit="点"
                        />
                        {/* Delta Display */}
                        {typeof result?.delta === 'number' && (
                            <motion.div
                                className={`${styles.deltaBadge} ${result.delta >= 0 ? styles.deltaBadgePositive : styles.deltaBadgeNegative}`}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                {result.delta > 0 ? '↑' : result.delta < 0 ? '↓' : '-'}
                                {Math.abs(result.delta).toFixed(1)}点
                                <span className={styles.deltaLabel}>(前回比)</span>
                            </motion.div>
                        )}
                    </motion.div>

                    {/* Detailed Analysis Grid */}
                    <motion.div
                        className={styles.grid}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.25 }}
                    >
                        <div className={styles.gridItem}>
                            <span className={styles.gridLabel}>AI判定タイプ</span>
                            <span className={styles.gridValue}>{result?.hairType || '---'}</span>
                        </div>
                        <div className={styles.gridItem}>
                            <span className={styles.gridLabel}>パターン</span>
                            <span className={styles.gridValue}>
                                {result?.pattern ? (PATTERN_DISPLAY_MAP[result.pattern] || result.pattern) : '---'}
                            </span>
                        </div>
                        <div className={styles.gridItem}>
                            <span className={styles.gridLabel}>頭皮の状態</span>
                            <span className={styles.gridValue}>{result?.scalpCondition || '---'}</span>
                        </div>
                        <div className={styles.gridItem}>
                            <span className={styles.gridLabel}>判定精度</span>
                            <span className={styles.gridValue}>{result?.quality || '---'}</span>
                        </div>
                    </motion.div>

                    {/* Analysis Notes Card */}
                    {result?.notes && (
                        <motion.div
                            className={styles.notesCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        >
                            <Card variant="default" padding="lg" onClick={undefined} style={{}}>
                                <span className={styles.cardTitle}>分析コメント</span>
                                <p className={styles.notesText}>{result.notes}</p>
                            </Card>
                        </motion.div>
                    )}

                    {/* Feature 3 Link Button */}
                    <motion.div
                        style={{
                            width: '100%',
                            maxWidth: '400px',
                            alignSelf: 'center',
                            marginBottom: '16px'
                        }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 }}
                    >
                        <Button
                            variant="primary"
                            size="full"
                            icon={<ChevronRight size={18} />}
                            iconPosition="right"
                            style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #b08d55 100%)' }}
                            onClick={handleNavigateToFoodRecommend}
                        >
                            食事での改善プランを見る
                        </Button>
                    </motion.div>

                    {/* Disclaimer */}
                    <motion.div
                        className={styles.disclaimer}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        <AlertCircle size={16} color="#38bdf8" className={styles.disclaimerIcon} />
                        <span className={styles.disclaimerText}>
                            この判定はAIによる参考情報です。正確な診断については医療機関にご相談ください。
                        </span>
                    </motion.div>

                    {/* Action Button */}
                    <motion.div
                        className={styles.buttonWrapper}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        <Button
                            variant="primary"
                            size="full"
                            icon={<ChevronRight size={18} />}
                            iconPosition="right"
                            style={{}}
                            onClick={() => router.push('/feature1/capture')}
                        >
                            新しく撮影する
                        </Button>
                    </motion.div>
                </div>
            </div>
        </Layout>
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
