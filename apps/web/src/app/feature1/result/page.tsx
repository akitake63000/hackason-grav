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

const styles = {
    container: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        width: '100%',
    },
    content: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        padding: '24px',
        gap: '24px',
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box' as const,
    },
    title: {
        fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
        fontSize: 'clamp(24px, 4vw, 32px)',
        fontWeight: '600' as const,
        color: '#1a3d2e',
        textAlign: 'center' as const,
    },
    subtitle: {
        fontSize: '14px',
        color: '#7f786d',
        textAlign: 'center' as const,
        marginTop: '4px',
    },
    scoreSection: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        padding: '24px 0',
    },
    scoreTitle: {
        fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
        fontSize: '18px',
        fontWeight: '600' as const,
        color: '#1a3d2e',
        marginBottom: '16px',
    },
    notesCard: {
        width: '100%',
    },
    cardTitle: {
        fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
        fontSize: '16px',
        fontWeight: '600' as const,
        color: '#1a3d2e',
        marginBottom: '12px',
    },
    notesText: {
        fontSize: '14px',
        color: '#635d54',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap' as const,
    },
    disclaimer: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        background: 'rgba(201, 169, 98, 0.08)',
        border: '1px solid rgba(201, 169, 98, 0.2)',
        borderRadius: '12px',
        padding: '12px',
    },
    disclaimerIcon: {
        flexShrink: 0,
        marginTop: '2px',
    },
    disclaimerText: {
        fontSize: '12px',
        color: '#7f786d',
        lineHeight: 1.5,
    },
    buttonWrapper: {
        marginTop: 'auto',
        paddingTop: '8px',
        maxWidth: '400px',
        width: '100%',
        alignSelf: 'center' as const,
    },
    loadingContainer: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
    },
    loadingCard: {
        textAlign: 'center' as const,
        padding: '32px',
    },
    loadingSpinner: {
        fontSize: '48px',
        marginBottom: '16px',
    },
    errorContainer: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
    },
    errorCard: {
        textAlign: 'center' as const,
        padding: '32px',
    },
    errorIcon: {
        fontSize: '48px',
        marginBottom: '16px',
    },
    errorTitle: {
        fontSize: '18px',
        fontWeight: '600' as const,
        color: '#1a3d2e',
        marginBottom: '8px',
    },
    errorMessage: {
        fontSize: '14px',
        color: '#7f786d',
        marginBottom: '24px',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center' as const,
        gap: '16px',
    },
    emptyStateIcon: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.1) 0%, rgba(65, 152, 115, 0.05) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '40px',
    },
    emptyStateTitle: {
        fontSize: '18px',
        fontWeight: '600' as const,
        color: '#1a3d2e',
        fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    },
    emptyStateDescription: {
        fontSize: '14px',
        color: '#7f786d',
        lineHeight: '1.6',
        maxWidth: '320px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        width: '100%',
        marginBottom: '24px',
    },
    gridItem: {
        background: 'rgba(255, 255, 255, 0.8)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        border: '1px solid rgba(65, 152, 115, 0.1)',
    },
    gridLabel: {
        fontSize: '12px',
        color: '#7f786d',
        marginBottom: '4px',
    },
    gridValue: {
        fontSize: '15px',
        fontWeight: '600' as const,
        color: '#1a3d2e',
        textAlign: 'center' as const,
    },
    deltaBadge: {
        fontSize: '14px',
        fontWeight: '600' as const,
        padding: '4px 12px',
        borderRadius: '20px',
        marginTop: '8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
    },
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
            router.push(`/feature3/food-recommend?pattern=${encodedPattern}`);
        } else {
            router.push('/feature3/food-recommend');
        }
    };

    if (loading) {
        return (
            <Layout>
                <div style={styles.container}>
                    <div style={styles.loadingContainer}>
                        <Card variant="default" padding="lg" style={{}} onClick={undefined}>
                            <div style={styles.loadingCard}>
                                <div style={styles.loadingSpinner}>⏳</div>
                                <h2 style={styles.errorTitle}>読み込み中...</h2>
                                <p style={styles.errorMessage}>解析結果を取得しています。</p>
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
                <div style={styles.container}>
                    <div style={styles.content}>
                        <motion.div
                            style={styles.emptyState}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            <div style={styles.emptyStateIcon}>
                                <Camera size={40} color="#419873" />
                            </div>
                            <h2 style={styles.emptyStateTitle}>まだ解析結果がありません</h2>
                            <p style={styles.emptyStateDescription}>
                                まずは写真を撮影して、AIによる髪密度の解析を始めましょう。
                            </p>
                            <Button
                                variant="primary"
                                size="medium"
                                icon={<Camera size={18} />}
                                style={{}}
                                onClick={() => router.push('/feature1/capture')}
                            >
                                写真を撮影する
                            </Button>
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
            <div style={styles.container}>
                <div style={styles.content}>
                    {/* Title Section */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <h1 style={styles.title}>解析結果</h1>
                        <p style={styles.subtitle}>{currentDate}</p>
                    </motion.div>

                    {/* Score Section */}
                    <motion.div
                        style={styles.scoreSection}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <span style={styles.scoreTitle}>髪密度スコア</span>
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
                                style={{
                                    ...styles.deltaBadge,
                                    background: result.delta >= 0 ? 'rgba(65, 152, 115, 0.1)' : 'rgba(184, 84, 80, 0.1)',
                                    color: result.delta >= 0 ? '#419873' : '#b85450',
                                }}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                {result.delta > 0 ? '↑' : result.delta < 0 ? '↓' : '-'}
                                {Math.abs(result.delta).toFixed(1)}点
                                <span style={{ fontSize: '10px', opacity: 0.8, marginLeft: '4px' }}>(前回比)</span>
                            </motion.div>
                        )}
                    </motion.div>

                    {/* Detailed Analysis Grid */}
                    <motion.div
                        style={styles.grid}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.25 }}
                    >
                        <div style={styles.gridItem}>
                            <span style={styles.gridLabel}>AI判定タイプ</span>
                            <span style={styles.gridValue}>{result?.hairType || '---'}</span>
                        </div>
                        <div style={styles.gridItem}>
                            <span style={styles.gridLabel}>パターン</span>
                            <span style={styles.gridValue}>
                                {result?.pattern ? (PATTERN_DISPLAY_MAP[result.pattern] || result.pattern) : '---'}
                            </span>
                        </div>
                        <div style={styles.gridItem}>
                            <span style={styles.gridLabel}>頭皮の状態</span>
                            <span style={styles.gridValue}>{result?.scalpCondition || '---'}</span>
                        </div>
                        <div style={styles.gridItem}>
                            <span style={styles.gridLabel}>判定精度</span>
                            <span style={styles.gridValue}>{result?.quality || '---'}</span>
                        </div>
                    </motion.div>

                    {/* Analysis Notes Card */}
                    {result?.notes && (
                        <motion.div
                            style={styles.notesCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        >
                            <Card variant="default" padding="lg" style={{}} onClick={undefined}>
                                <span style={styles.cardTitle}>分析コメント</span>
                                <p style={styles.notesText}>{result.notes}</p>
                            </Card>
                        </motion.div>
                    )}

                    {/* Feature 3 Link Button */}
                    <motion.div
                        style={{ width: '100%', marginBottom: '16px' }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 }}
                    >
                        <Button
                            variant="primary"
                            size="lg"
                            icon={<ChevronRight size={18} />}
                            iconPosition="right"
                            style={{ background: 'linear-gradient(135deg, #c9a962 0%, #b08d55 100%)' }}
                            onClick={handleNavigateToFoodRecommend}
                        >
                            食事での改善プランを見る
                        </Button>
                    </motion.div>

                    {/* Disclaimer */}
                    <motion.div
                        style={styles.disclaimer}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        <AlertCircle size={16} color="#c9a962" style={styles.disclaimerIcon} />
                        <span style={styles.disclaimerText}>
                            この判定はAIによる参考情報です。正確な診断については医療機関にご相談ください。
                        </span>
                    </motion.div>

                    {/* Action Button */}
                    <motion.div
                        style={styles.buttonWrapper}
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
