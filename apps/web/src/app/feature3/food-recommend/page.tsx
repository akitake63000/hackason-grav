'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Info, CheckCircle, ShoppingBag, Utensils, BookOpen, X, Loader2, AlertCircle } from 'lucide-react';
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

interface RecipeItem {
    name: string;
    description: string;
    ingredients: string[];
    benefit: string;
}

interface RecipeModal {
    food: FoodDetail;
    loading: boolean;
    recipes: RecipeItem[];
    error: string | null;
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
    recipeBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '8px',
        border: '1px solid rgba(65, 152, 115, 0.2)',
        borderRadius: '10px',
        background: 'transparent',
        color: '#419873',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    },
    modalOverlay: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
    },
    modalContent: {
        background: '#fff',
        borderRadius: '24px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'auto' as const,
        padding: '24px',
        position: 'relative' as const,
    },
    modalClose: {
        position: 'absolute' as const,
        top: '16px',
        right: '16px',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'rgba(0, 0, 0, 0.06)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
    },
    modalTitle: {
        fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
        fontSize: '20px',
        fontWeight: '600' as const,
        color: '#1a3d2e',
        marginBottom: '20px',
        paddingRight: '40px',
    },
    recipeCard: {
        padding: '16px',
        background: 'rgba(26, 61, 46, 0.03)',
        borderRadius: '16px',
        marginBottom: '12px',
    },
    recipeName: {
        fontSize: '16px',
        fontWeight: '600' as const,
        color: '#1a3d2e',
        marginBottom: '8px',
    },
    recipeDesc: {
        fontSize: '14px',
        color: '#4a4a4a',
        lineHeight: 1.6,
        marginBottom: '10px',
    },
    recipeIngredients: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '6px',
        marginBottom: '10px',
    },
    ingredientTag: {
        padding: '4px 10px',
        background: 'rgba(201, 169, 98, 0.1)',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#8a7640',
    },
    recipeBenefit: {
        fontSize: '13px',
        color: '#419873',
        fontStyle: 'italic' as const,
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
    const [recipeModal, setRecipeModal] = useState<RecipeModal | null>(null);

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

    const handleRecipeClick = async (food: FoodDetail) => {
        setRecipeModal({ food, loading: true, recipes: [], error: null });
        try {
            const response = await apiFetch('/api/v1/food-sniper/recipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    foodName: food.name,
                    hairPattern: data?.hairPattern || null,
                }),
            });
            const result = await response.json();
            setRecipeModal((prev) => prev ? {
                ...prev,
                loading: false,
                recipes: result.recipes || [],
            } : null);
        } catch {
            setRecipeModal((prev) => prev ? {
                ...prev,
                loading: false,
                error: 'レシピの取得に失敗しました',
            } : null);
        }
    };

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

                                                <motion.button
                                                    style={styles.recipeBtn}
                                                    whileHover={{
                                                        background: 'rgba(65, 152, 115, 0.08)',
                                                    }}
                                                    whileTap={{ scale: 0.97 }}
                                                    onClick={() => handleRecipeClick(food)}
                                                >
                                                    <BookOpen size={14} />
                                                    レシピを見る
                                                </motion.button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </motion.div>

                    {/* Recipe Modal */}
                    <AnimatePresence>
                        {recipeModal && (
                            <motion.div
                                style={styles.modalOverlay}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setRecipeModal(null)}
                            >
                                <motion.div
                                    style={styles.modalContent}
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        style={styles.modalClose}
                                        onClick={() => setRecipeModal(null)}
                                    >
                                        <X size={18} />
                                    </button>

                                    <h3 style={styles.modalTitle}>
                                        {recipeModal.food.emoji} {recipeModal.food.name}のレシピ
                                    </h3>

                                    {recipeModal.loading && (
                                        <div style={{ textAlign: 'center', padding: '30px' }}>
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{
                                                    duration: 1,
                                                    repeat: Infinity,
                                                    ease: 'linear',
                                                }}
                                                style={{ display: 'inline-block' }}
                                            >
                                                <Loader2 size={28} color="#1a3d2e" />
                                            </motion.div>
                                            <p
                                                style={{
                                                    marginTop: '12px',
                                                    color: '#7f786d',
                                                    fontSize: '14px',
                                                }}
                                            >
                                                レシピを生成中...
                                            </p>
                                        </div>
                                    )}

                                    {recipeModal.error && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '12px 16px',
                                            background: 'rgba(239, 68, 68, 0.08)',
                                            borderRadius: '12px',
                                            marginBottom: '16px',
                                            color: '#dc2626',
                                            fontSize: '14px',
                                        }}>
                                            <AlertCircle size={18} />
                                            {recipeModal.error}
                                        </div>
                                    )}

                                    {!recipeModal.loading &&
                                        recipeModal.recipes.map((recipe, idx) => (
                                            <div key={idx} style={styles.recipeCard}>
                                                <div style={styles.recipeName}>{recipe.name}</div>
                                                <p style={styles.recipeDesc}>{recipe.description}</p>
                                                <div style={styles.recipeIngredients}>
                                                    {recipe.ingredients.map((ing, i) => (
                                                        <span key={i} style={styles.ingredientTag}>
                                                            {ing}
                                                        </span>
                                                    ))}
                                                </div>
                                                {recipe.benefit && (
                                                    <p style={styles.recipeBenefit}>
                                                        {'🌿 '}
                                                        {recipe.benefit}
                                                    </p>
                                                )}
                                            </div>
                                        ))}\n                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
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
