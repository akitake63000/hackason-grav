'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, Info, CheckCircle, ShoppingBag, Utensils } from 'lucide-react';
import Layout from '@/components/Layout';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { apiFetch } from '@/lib/api';

// Types based on backend Pydantic models
interface FoodDetail {
    name: string;
    emoji: string;
    serving: string;
    amount: string;
    dailyPercentValue?: number; // Optional in backend
    dailyPercent: string;
    tip: string;
    why: string;
}

interface NutrientInfo {
    name: string;
    role: string;
    dailyRecommended?: string;
    foods: FoodDetail[];
}

interface PatternInfo {
    label: string;
    description: string;
    cause: string;
    strategy: string;
}

interface FoodSniperResponse {
    patternInfo?: PatternInfo;
    nutrients: NutrientInfo[];
    shoppingList: string[];
    hairPattern?: string;
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
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box' as const,
    },
    header: {
        marginBottom: '8px',
    },
    title: {
        fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
        fontSize: 'clamp(24px, 4vw, 32px)',
        fontWeight: '600' as const,
        color: '#1a3d2e',
        textAlign: 'center' as const,
        marginBottom: '8px',
    },
    subtitle: {
        fontSize: '14px',
        color: '#7f786d',
        textAlign: 'center' as const,
        marginBottom: '24px',
    },
    sectionTitle: {
        fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
        fontSize: '18px',
        fontWeight: '600' as const,
        color: '#1a3d2e',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    patternCard: {
        background: 'rgba(255, 255, 255, 0.8)',
        border: '1px solid rgba(26, 61, 46, 0.1)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
    },
    patternLabel: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#1a3d2e',
        marginBottom: '8px',
        display: 'block',
    },
    patternDescription: {
        fontSize: '14px',
        color: '#635d54',
        marginBottom: '16px',
        lineHeight: 1.6,
    },
    infoRow: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid rgba(0,0,0,0.05)',
    },
    infoItem: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '4px',
    },
    infoLabel: {
        fontSize: '12px',
        fontWeight: '600',
        color: '#c9a962',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    infoText: {
        fontSize: '14px',
        color: '#1a3d2e',
        lineHeight: 1.6,
    },
    nutrientCard: {
        marginBottom: '16px',
    },
    nutrientHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: '12px',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
    },
    nutrientName: {
        fontSize: '18px',
        fontWeight: '600',
        color: '#1a3d2e',
        fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    },
    nutrientRole: {
        fontSize: '13px',
        color: '#7f786d',
    },
    foodList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '16px',
    },
    foodItem: {
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
    },
    foodEmoji: {
        fontSize: '32px',
        lineHeight: 1,
        background: '#fcfaf7',
        padding: '12px',
        borderRadius: '12px',
    },
    foodContent: {
        flex: 1,
    },
    foodName: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#1a3d2e',
        marginBottom: '4px',
        display: 'block',
    },
    foodAmount: {
        fontSize: '13px',
        color: '#7f786d',
        display: 'block',
        marginBottom: '8px',
    },
    foodWhy: {
        fontSize: '13px',
        color: '#635d54',
        background: 'rgba(65, 152, 115, 0.05)',
        padding: '8px 12px',
        borderRadius: '8px',
        lineHeight: 1.5,
    },
    loadingContainer: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
    },
    errorContainer: {
        padding: '24px',
        textAlign: 'center' as const,
    },
    backButton: {
        marginBottom: '16px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '14px',
        color: '#7f786d',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 0',
    },
};

function FoodRecommendContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    // ユーザー指示に基づきパラメータ名を hairPattern に変更
    const patternParam = searchParams.get('hairPattern');

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<FoodSniperResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRecommendations = async () => {
            if (!patternParam) {
                // If no pattern, we can still fetch generic recommendations or handle as error
                // For now, let's fetch generic ones (backend handles empty pattern)
            }

            try {
                // Decode the pattern parameter safely
                const decodedPattern = patternParam ? decodeURIComponent(patternParam) : undefined;

                // Call API
                const res = await apiFetch('/api/v1/food-sniper/recommend', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: '', // Optional message, empty for now
                        hairPattern: decodedPattern,
                    }),
                });

                const response: FoodSniperResponse = await res.json();
                setData(response);
            } catch (err: any) {
                console.error('Failed to fetch food recommendations:', err);
                setError('おすすめ食材の取得に失敗しました。時間をおいて再度お試しください。');
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, [patternParam]);

    if (loading) {
        return (
            <Layout>
                <div style={styles.container}>
                    <div style={styles.loadingContainer}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🥗</div>
                            <h2 style={{ color: '#1a3d2e', marginBottom: '8px', fontWeight: 600 }}>分析中...</h2>
                            <p style={{ color: '#7f786d' }}>あなたのタイプに合わせた最適な食材を選定しています</p>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout>
                <div style={styles.container}>
                    <div style={styles.errorContainer}>
                        <p style={{ color: '#e53e3e', marginBottom: '16px' }}>{error}</p>
                        <Button variant="secondary" onClick={() => router.back()} size="medium" style={{}} icon={undefined}>
                            戻る
                        </Button>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div style={styles.container}>
                <div style={styles.content}>
                    <button style={styles.backButton} onClick={() => router.back()}>
                        <ChevronLeft size={16} />
                        診断結果に戻る
                    </button>

                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <h1 style={styles.title}>食事改善プラン</h1>
                        <p style={styles.subtitle}>
                            {data?.patternInfo?.label ? `${data.patternInfo.label}向け` : 'あなたに最適'}の栄養アプローチ
                        </p>
                    </motion.div>

                    {/* Pattern Info Section - "WHY" */}
                    {data?.patternInfo && (
                        <motion.div
                            style={styles.patternCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.5 }}
                        >
                            <span style={styles.patternLabel}>
                                <Info size={16} style={{ display: 'inline', marginRight: '6px' }} />
                                現状の分析
                            </span>
                            <p style={styles.patternDescription}>{data.patternInfo.description}</p>

                            <div style={styles.infoRow}>
                                <div style={styles.infoItem}>
                                    <span style={styles.infoLabel}>原因</span>
                                    <p style={styles.infoText}>{data.patternInfo.cause}</p>
                                </div>
                                <div style={styles.infoItem}>
                                    <span style={styles.infoLabel}>対策方針</span>
                                    <p style={styles.infoText}>{data.patternInfo.strategy}</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Nutrients and Foods */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                    >
                        <h2 style={styles.sectionTitle}>
                            <Utensils size={20} />
                            重点的に摂りたい栄養素と食材
                        </h2>

                        {data?.nutrients.map((nutrient, idx) => (
                            <Card key={idx} variant="default" padding="lg" style={styles.nutrientCard} onClick={undefined}>
                                <div style={styles.nutrientHeader}>
                                    <div>
                                        <span style={styles.nutrientName}>{nutrient.name}</span>
                                        <div style={{ ...styles.nutrientRole, marginTop: '4px' }}>{nutrient.role}</div>
                                    </div>
                                    {nutrient.dailyRecommended && (
                                        <div style={{ fontSize: '12px', background: '#f0f0f0', padding: '4px 8px', borderRadius: '4px' }}>
                                            目安: {nutrient.dailyRecommended}
                                        </div>
                                    )}
                                </div>

                                <div style={styles.foodList}>
                                    {nutrient.foods.map((food, fIdx) => (
                                        <div key={fIdx} style={styles.foodItem}>
                                            <div style={styles.foodEmoji}>{food.emoji}</div>
                                            <div style={styles.foodContent}>
                                                <span style={styles.foodName}>{food.name}</span>
                                                <span style={styles.foodAmount}>
                                                    {food.serving} で {food.amount}
                                                    {food.dailyPercent && ` (${food.dailyPercent})`}
                                                </span>
                                                <p style={styles.foodWhy}>{food.why}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </motion.div>
                </div>
            </div>
        </Layout>
    );
}

export default function FoodRecommendPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <p>Loading...</p>
            </div>
        }>
            <FoodRecommendContent />
        </Suspense>
    );
}
