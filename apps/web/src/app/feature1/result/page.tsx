'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, AlertCircle, Loader2, ArrowRight, RotateCcw } from 'lucide-react';
import Layout from '@/components/Layout';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { apiFetch } from '@/lib/api';

interface AnalysisResult {
    score: number;
    notes: string | null;
    hairType?: string;
    pattern?: string;
    quality?: string;
    deltaVsPrev?: string;
}

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
        maxWidth: '600px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box' as const,
    },
    title: {
        fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
        fontSize: 'clamp(24px, 4vw, 32px)',
        fontWeight: '600',
        color: '#1a3d2e',
        textAlign: 'center' as const,
    },
    subtitle: {
        fontSize: '14px',
        color: '#7f786d',
        textAlign: 'center' as const,
        marginTop: '4px',
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        gap: '16px',
    },
    loadingText: {
        fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
        color: '#1a3d2e',
        fontSize: '16px',
    },
    loadingSubtext: {
        fontSize: '13px',
        color: '#7f786d',
    },
    errorContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        gap: '16px',
        padding: '24px',
        textAlign: 'center' as const,
    },
    errorText: {
        color: '#dc2626',
        fontSize: '14px',
    },
    scoreSection: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        padding: '24px 0',
        borderBottom: '1px solid rgba(26, 61, 46, 0.08)',
        marginBottom: '20px',
    },
    scoreLabel: {
        fontSize: '13px',
        color: '#7f786d',
        marginBottom: '4px',
    },
    scoreValue: {
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '56px',
        fontWeight: '600',
        color: '#1a3d2e',
        lineHeight: 1,
    },
    scoreDelta: {
        fontSize: '13px',
        fontWeight: '600',
        marginTop: '8px',
        padding: '4px 12px',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '24px',
    },
    gridItem: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '4px',
    },
    gridLabel: {
        fontSize: '11px',
        color: '#7f786d',
        fontWeight: '600',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    gridValue: {
        fontSize: '15px',
        color: '#1a3d2e',
        fontWeight: '500',
        fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    },
    notesSection: {
        background: 'rgba(26, 61, 46, 0.03)',
        borderRadius: '12px',
        padding: '16px',
        marginTop: '8px',
    },
    notesTitle: {
        fontSize: '13px',
        fontWeight: '600',
        color: '#1a3d2e',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    notesText: {
        fontSize: '14px',
        color: '#4a4540',
        lineHeight: 1.6,
    },
    actions: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
        marginTop: '24px',
    }
};

function ResultContent() {
    const searchParams = useSearchParams();
    const photoId = searchParams.get('photoId');

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
                <div style={styles.content}>
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <h1 style={styles.title}>AI解析結果</h1>
                        <p style={styles.subtitle}>
                            {status === 'success' ? '解析が完了しました' : '写真の状態を分析します'}
                        </p>
                    </motion.div>

                    {/* Status: Loading */}
                    {status === 'loading' && (
                        <div style={styles.loadingContainer}>
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            >
                                <Loader2 size={40} color="#c9a962" />
                            </motion.div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={styles.loadingText}>解析中...</div>
                                <div style={styles.loadingSubtext}>AIが画像を分析しています</div>
                            </div>
                        </div>
                    )}

                    {/* Status: Error */}
                    {status === 'error' && (
                        <Card variant="outlined" style={styles.errorContainer}>
                            <AlertCircle size={32} color="#dc2626" />
                            <p style={styles.errorText}>{errorMessage || "不明なエラー"}</p>
                            <Button
                                variant="secondary"
                                onClick={() => photoId ? handleAnalyze() : null}
                                disabled={!photoId}
                                icon={<RotateCcw size={16} />}
                            >
                                リトライ
                            </Button>
                        </Card>
                    )}

                    {/* Status: Idle */}
                    {status === 'idle' && (
                        <div style={{ ...styles.loadingContainer, minHeight: '300px' }}>
                            <Sparkles size={48} color="#419873" />
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <div style={styles.loadingText}>準備完了</div>
                                <div style={styles.loadingSubtext}>ID: {photoId}</div>
                            </div>
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleAnalyze}
                                icon={<Sparkles size={18} />}
                            >
                                解析を開始する
                            </Button>
                        </div>
                    )}

                    {/* Status: Success */}
                    {status === 'success' && result && (
                        <Card variant="elevated" padding="lg" delay={0.2}>
                            {/* Score Section */}
                            <div style={styles.scoreSection}>
                                <span style={styles.scoreLabel}>髪密度スコア</span>
                                <span style={styles.scoreValue}>{result.score}</span>
                                {result.deltaVsPrev && (
                                    <div style={{
                                        ...styles.scoreDelta,
                                        background: result.deltaVsPrev.startsWith('+') ? 'rgba(65, 152, 115, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                                        color: result.deltaVsPrev.startsWith('+') ? '#419873' : '#dc2626',
                                    }}>
                                        <TrendingUp size={14} />
                                        <span>前回比 {result.deltaVsPrev}</span>
                                    </div>
                                )}
                            </div>

                            {/* Details Grid */}
                            <div style={styles.grid}>
                                <div style={styles.gridItem}>
                                    <span style={styles.gridLabel}>AI判定タイプ</span>
                                    <span style={styles.gridValue}>{result.hairType || '---'}</span>
                                </div>
                                <div style={styles.gridItem}>
                                    <span style={styles.gridLabel}>パターン</span>
                                    <span style={styles.gridValue}>{result.pattern || '---'}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            <div style={styles.notesSection}>
                                <div style={styles.notesTitle}>
                                    <Sparkles size={14} color="#c9a962" />
                                    <span>分析コメント</span>
                                </div>
                                <p style={styles.notesText}>
                                    {result.notes || "コメントはありません"}
                                </p>
                            </div>

                            {/* Actions */}
                            <div style={styles.actions}>
                                <Button
                                    variant="secondary"
                                    onClick={() => window.location.href = '/feature1/dashboard'}
                                    icon={<ArrowRight size={16} />}
                                >
                                    ダッシュボードへ戻る
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleAnalyze}
                                    style={{ alignSelf: 'center', textDecoration: 'underline' }}
                                >
                                    再解析する
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </Layout>
    );
}

export default function ResultPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
            <ResultContent />
        </Suspense>
    );
}
