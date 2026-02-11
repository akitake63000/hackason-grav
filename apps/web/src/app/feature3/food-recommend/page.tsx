'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Info, CheckCircle, ShoppingBag, Utensils, BookOpen, X, Loader2, AlertCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { apiFetch } from '@/lib/api';
import styles from './page.module.css';

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
                <div className={styles.container}>
                    <div className={styles.loadingContainer}>
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
                <div className={styles.container}>
                    <div className={styles.errorContainer}>
                        <p style={{ color: '#e53e3e', marginBottom: '16px' }}>{error}</p>
                        <Button variant="secondary" onClick={() => router.back()} size="medium" icon={undefined} style={{}}>
                            戻る
                        </Button>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.content}>
                    <button className={styles.backButton} onClick={() => router.back()}>
                        <ChevronLeft size={16} />
                        診断結果に戻る
                    </button>

                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <h1 className={styles.title}>食事改善プラン</h1>
                        <p className={styles.subtitle}>
                            {data?.patternInfo?.label ? `${data.patternInfo.label}向け` : 'あなたに最適'}の栄養アプローチ
                        </p>
                    </motion.div>

                    {/* Pattern Info Section - "WHY" */}
                    {data?.patternInfo && (
                        <motion.div
                            className={styles.patternCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.5 }}
                        >
                            {/* Pattern Name Block */}
                            <div className={styles.columnSection}>
                                <span className={styles.columnLabel}>あなたのパターン</span>
                                <h3 className={styles.patternName}>{data.patternInfo.label}</h3>
                                <p className={styles.columnText}>{data.patternInfo.description}</p>
                            </div>

                            <div className={styles.divider} />

                            {/* Cause Block */}
                            <div className={styles.columnSection}>
                                <span className={styles.columnLabel}>なぜ？</span>
                                <p className={styles.columnText}>{data.patternInfo.cause}</p>
                            </div>

                            <div className={styles.divider} />

                            {/* Strategy Block */}
                            <div className={styles.columnSection}>
                                <span className={styles.columnLabel}>どうしよう？</span>
                                <p className={styles.columnText}>{data.patternInfo.strategy}</p>
                            </div>
                        </motion.div>
                    )}

                    {/* Nutrients and Foods */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                    >
                        <h2 className={styles.sectionTitle}>
                            <Utensils size={20} />
                            重点的に摂りたい栄養素と食材
                        </h2>

                        {data?.nutrients.map((nutrient, idx) => (
                            <Card key={idx} variant="default" padding="lg" className={styles.nutrientCard} onClick={undefined} style={{}}>
                                <div className={styles.nutrientHeader}>
                                    <div>
                                        <span className={styles.nutrientName}>{nutrient.name}</span>
                                        <div className={styles.nutrientRole} style={{ marginTop: '4px' }}>{nutrient.role}</div>
                                    </div>
                                    {nutrient.dailyRecommended && (
                                        <div style={{ fontSize: '12px', background: '#f0f0f0', padding: '4px 8px', borderRadius: '4px' }}>
                                            目安: {nutrient.dailyRecommended}
                                        </div>
                                    )}
                                </div>

                                <div className={styles.foodList}>
                                    {nutrient.foods.map((food, fIdx) => (
                                        <div key={fIdx} className={styles.foodItem}>
                                            <div className={styles.foodEmoji}>{food.emoji}</div>
                                            <div className={styles.foodContent}>
                                                <span className={styles.foodName}>{food.name}</span>
                                                <span className={styles.foodAmount}>
                                                    {food.serving} で {food.amount}
                                                    {food.dailyPercent && ` (${food.dailyPercent})`}
                                                </span>
                                                <p className={styles.foodWhy}>{food.why}</p>

                                                <motion.button
                                                    className={styles.recipeBtn}
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
                                className={styles.modalOverlay}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setRecipeModal(null)}
                            >
                                <motion.div
                                    className={styles.modalContent}
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        className={styles.modalClose}
                                        onClick={() => setRecipeModal(null)}
                                    >
                                        <X size={18} />
                                    </button>

                                    <h3 className={styles.modalTitle}>
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
                                            <div key={idx} className={styles.recipeCard}>
                                                <div className={styles.recipeName}>{recipe.name}</div>
                                                <p className={styles.recipeDesc}>{recipe.description}</p>
                                                <div className={styles.recipeIngredients}>
                                                    {recipe.ingredients.map((ing, i) => (
                                                        <span key={i} className={styles.ingredientTag}>
                                                            {ing}
                                                        </span>
                                                    ))}
                                                </div>
                                                {recipe.benefit && (
                                                    <p className={styles.recipeBenefit}>
                                                        {'🌿 '}
                                                        {recipe.benefit}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                </motion.div>
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
