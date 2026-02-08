'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, AlertCircle, Camera, TrendingUp } from 'lucide-react';
import Layout from '@/components/Layout';
import { apiFetch } from '@/lib/api';

interface AnalysisResult {
    score: number;
    notes: string | null;
}

const styles = {
    container: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
        width: '100%',
    },
    scrollArea: {
        flex: 1,
        overflowY: 'auto' as const,
        padding: '0 20px 24px',
    },
    centerCard: {
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '32px 24px',
        border: '1px solid rgba(255, 255, 255, 0.8)',
        boxShadow: '0 8px 32px rgba(26, 61, 46, 0.08)',
        textAlign: 'center' as const,
    },
    statusIcon: {
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'center',
    },
    title: {
        fontSize: '20px',
        fontWeight: '600' as const,
        color: '#1a3d2e',
        marginBottom: '12px',
    },
    description: {
        fontSize: '14px',
        color: '#9c958a',
        marginBottom: '24px',
        lineHeight: '1.6',
    },
    button: {
        width: '100%',
        padding: '16px',
        borderRadius: '16px',
        border: 'none',
        background: 'linear-gradient(135deg, #419873 0%, #347a5c 100%)',
        color: '#ffffff',
        fontSize: '16px',
        fontWeight: '600' as const,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        boxShadow: '0 4px 16px rgba(65, 152, 115, 0.3)',
    },
    buttonSecondary: {
        background: 'rgba(156, 149, 138, 0.1)',
        color: '#1a3d2e',
        boxShadow: 'none',
        marginTop: '12px',
    },
    resultCard: {
        background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.08) 0%, rgba(65, 152, 115, 0.02) 100%)',
        borderRadius: '20px',
        padding: '20px',
        marginBottom: '16px',
        border: '1px solid rgba(65, 152, 115, 0.2)',
    },
    scoreSection: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 0',
        borderBottom: '1px solid rgba(65, 152, 115, 0.1)',
        marginBottom: '16px',
    },
    scoreLabel: {
        fontSize: '14px',
        color: '#4a6356',
        fontWeight: '500' as const,
    },
    scoreValue: {
        fontSize: '32px',
        fontWeight: '700' as const,
        color: '#419873',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    notesSection: {
        textAlign: 'left' as const,
    },
    notesLabel: {
        fontSize: '14px',
        color: '#4a6356',
        fontWeight: '500' as const,
        marginBottom: '8px',
        display: 'block',
    },
    notesContent: {
        fontSize: '14px',
        color: '#1a3d2e',
        lineHeight: '1.6',
        background: '#ffffff',
        padding: '12px',
        borderRadius: '12px',
        border: '1px solid rgba(65, 152, 115, 0.1)',
    },
    spinner: {
        fontSize: '48px',
        marginBottom: '16px',
    },
    errorIcon: {
        color: '#b85450',
    },
};

function ResultContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
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
            setResult(data.result);
            setStatus('success');

        } catch (error: any) {
            console.error(error);
            setErrorMessage(error.message || "解析に失敗しました。");
            setStatus('error');
        }
    };

    return (
        <Layout>
            <div style={styles.container}>
                <div style={styles.scrollArea}>
                    {/* Loading State */}
                    {status === 'loading' && (
                        <motion.div
                            style={styles.centerCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div style={styles.statusIcon}>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    style={styles.spinner}
                                >
                                    ⏳
                                </motion.div>
                            </div>
                            <h2 style={styles.title}>解析中...</h2>
                            <p style={styles.description}>
                                AIが画像を分析しています。<br />
                                しばらくお待ちください。
                            </p>
                        </motion.div>
                    )}

                    {/* Error State */}
                    {status === 'error' && (
                        <motion.div
                            style={styles.centerCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div style={styles.statusIcon}>
                                <AlertCircle size={48} style={styles.errorIcon} />
                            </div>
                            <h2 style={styles.title}>エラーが発生しました</h2>
                            <p style={styles.description}>{errorMessage || "不明なエラー"}</p>
                            <motion.button
                                style={styles.button}
                                onClick={() => photoId ? handleAnalyze() : null}
                                disabled={!photoId}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <RefreshCw size={20} />
                                リトライ
                            </motion.button>
                        </motion.div>
                    )}

                    {/* Idle State */}
                    {status === 'idle' && (
                        <motion.div
                            style={styles.centerCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div style={styles.statusIcon}>
                                <Camera size={48} color="#419873" />
                            </div>
                            <h2 style={styles.title}>解析の準備ができました</h2>
                            <p style={styles.description}>
                                撮影した写真をAIで解析します。<br />
                                スコアとコメントを取得できます。
                            </p>
                            <motion.button
                                style={styles.button}
                                onClick={handleAnalyze}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <Sparkles size={20} />
                                解析を開始する
                            </motion.button>
                        </motion.div>
                    )}

                    {/* Success State */}
                    {status === 'success' && result && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {/* Result Header */}
                            <motion.div
                                style={styles.centerCard}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                <div style={styles.statusIcon}>
                                    <Sparkles size={48} color="#419873" />
                                </div>
                                <h2 style={styles.title}>解析完了</h2>
                                <p style={styles.description}>
                                    AI分析が完了しました。
                                </p>
                            </motion.div>

                            {/* Score and Notes Card */}
                            <motion.div
                                style={styles.resultCard}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <div style={styles.scoreSection}>
                                    <span style={styles.scoreLabel}>髪密度スコア</span>
                                    <div style={styles.scoreValue}>
                                        <TrendingUp size={24} />
                                        {result.score}
                                    </div>
                                </div>
                                <div style={styles.notesSection}>
                                    <span style={styles.notesLabel}>分析コメント</span>
                                    <div style={styles.notesContent}>
                                        {result.notes || "コメントはありません"}
                                    </div>
                                </div>
                            </motion.div>

                            {/* Retry Button */}
                            <motion.button
                                style={{ ...styles.button, ...styles.buttonSecondary }}
                                onClick={handleAnalyze}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <RefreshCw size={18} />
                                再解析
                            </motion.button>
                        </motion.div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

export default function ResultPage() {
    return (
        <Suspense fallback={
            <Layout>
                <div style={{ padding: '24px', textAlign: 'center' }}>
                    <p>Loading...</p>
                </div>
            </Layout>
        }>
            <ResultContent />
        </Suspense>
    );
}
