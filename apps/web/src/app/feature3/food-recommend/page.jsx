'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Leaf, Loader2, AlertCircle, MapPin, X, BookOpen, Info, RefreshCw } from 'lucide-react'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import { apiFetch } from '@/lib/api'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  content: {
    maxWidth: '1000px',
    margin: '0 auto',
  },
  pageTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '600',
    color: '#1a3d2e',
    textAlign: 'center',
    marginBottom: '24px',
  },
  // Pattern Info
  patternCard: {
    marginBottom: '28px',
  },
  patternBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.15) 0%, rgba(65, 152, 115, 0.05) 100%)',
    border: '1px solid rgba(65, 152, 115, 0.25)',
    borderRadius: '12px',
    marginBottom: '16px',
  },
  patternLabel: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#419873',
  },
  patternDesc: {
    fontSize: '14px',
    color: '#7f786d',
    lineHeight: 1.6,
    marginBottom: '16px',
  },
  patternFlow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  flowStep: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  flowLabel: {
    flexShrink: 0,
    fontWeight: '700',
    color: '#1a3d2e',
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '6px',
    background: 'rgba(26, 61, 46, 0.08)',
  },
  flowText: {
    color: '#4a4a4a',
    fontSize: '14px',
  },
  flowArrow: {
    textAlign: 'center',
    color: '#c9a962',
    fontSize: '14px',
  },
  introText: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    color: '#7f786d',
    lineHeight: 1.6,
    textAlign: 'center',
    marginBottom: '28px',
  },
  // Nutrient Section
  nutrientSection: {
    marginBottom: '28px',
  },
  nutrientHeader: {
    marginBottom: '16px',
  },
  nutrientName: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(17px, 2.5vw, 20px)',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '6px',
  },
  nutrientRole: {
    fontSize: '13px',
    color: '#7f786d',
    lineHeight: 1.5,
  },
  nutrientDaily: {
    fontSize: '12px',
    color: '#9c958a',
    marginTop: '4px',
  },
  foodGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },
  // Food Card
  foodCardInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  foodTop: {
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
  },
  foodEmoji: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(201, 169, 98, 0.15) 0%, rgba(201, 169, 98, 0.05) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    flexShrink: 0,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(16px, 2.5vw, 18px)',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '4px',
  },
  foodServing: {
    fontSize: '13px',
    color: '#7f786d',
  },
  foodAmount: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#c9a962',
    marginTop: '4px',
  },
  // Bar chart
  barContainer: {
    marginTop: '4px',
  },
  barLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#9c958a',
    marginBottom: '4px',
  },
  barTrack: {
    height: '8px',
    background: 'rgba(26, 61, 46, 0.06)',
    borderRadius: '100px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '100px',
  },
  // Tip
  tipText: {
    fontSize: '13px',
    color: '#7f786d',
    lineHeight: 1.5,
    padding: '8px 12px',
    background: 'rgba(201, 169, 98, 0.06)',
    borderRadius: '10px',
    borderLeft: '3px solid rgba(201, 169, 98, 0.3)',
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
  // Actions
  actionSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '400px',
    margin: '0 auto 24px',
  },
  // Disclaimer
  disclaimer: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#9c958a',
    lineHeight: 1.5,
    padding: '16px',
    borderTop: '1px solid rgba(26, 61, 46, 0.06)',
  },
  // Loading / Error
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '16px',
    color: '#1a3d2e',
    fontWeight: '500',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    background: 'rgba(239, 68, 68, 0.08)',
    borderRadius: '12px',
    marginBottom: '16px',
    color: '#dc2626',
    fontSize: '14px',
  },
  // Modal
  modalOverlay: {
    position: 'fixed',
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
    overflow: 'auto',
    padding: '24px',
    position: 'relative',
  },
  modalClose: {
    position: 'absolute',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    flexWrap: 'wrap',
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
    fontStyle: 'italic',
  },
  // Progress Bar (loading)
  progressContainer: {
    width: '200px',
    height: '4px',
    background: 'rgba(26, 61, 46, 0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
    margin: '16px auto',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #419873 0%, #347a5c 100%)',
    borderRadius: '2px',
    transition: 'width 0.3s ease-out',
  },
  loadingStepText: {
    fontSize: '13px',
    color: '#7f786d',
    marginTop: '8px',
  },
  // Recipe Regenerate Button
  regenerateSection: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(0, 0, 0, 0.05)',
  },
  regenerateBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    background: 'rgba(65, 152, 115, 0.05)',
    border: '1px solid rgba(65, 152, 115, 0.25)',
    borderRadius: '12px',
    color: '#419873',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
  },
}

// フォールバック用デフォルトデータ（M字パターン）
// バックエンドの PATTERN_FOOD_MAP と同じデータソース
const DEFAULT_FALLBACK = {
  patternInfo: null,
  nutrients: [
    {
      name: 'イソフラボン',
      role: '5α-リダクターゼの働きを穏やかに抑制し、DHTの生成を減らす',
      dailyRecommended: '40〜50mg',
      foods: [
        { name: '納豆', emoji: '🫘', serving: '1パック（50g）', amount: 'イソフラボン 約37mg', dailyPercentValue: 74, dailyPercent: '約74%', tip: '朝食に1パック追加するだけで1日分の大半をカバー' },
        { name: '豆腐', emoji: '🧈', serving: '半丁（150g）', amount: 'イソフラボン 約33mg', dailyPercentValue: 66, dailyPercent: '約66%', tip: '味噌汁や冷奴で手軽に摂取できる' },
      ],
    },
    {
      name: '亜鉛',
      role: 'DHT生成に関わる酵素活性を調整し、毛髪のケラチン合成にも必要',
      dailyRecommended: '11mg（成人男性）/ 8mg（成人女性）',
      foods: [
        { name: '牡蠣', emoji: '🦪', serving: '2個（約40g）', amount: '亜鉛 5.6mg', dailyPercentValue: 51, dailyPercent: '約51%', tip: '亜鉛含有量は食品中トップクラス' },
        { name: 'かぼちゃの種', emoji: '🎃', serving: '30g', amount: '亜鉛 2.3mg', dailyPercentValue: 21, dailyPercent: '約21%', tip: '間食やサラダのトッピングに' },
      ],
    },
    {
      name: 'ビタミンE',
      role: '血行を促進し、毛包への栄養供給を改善する',
      dailyRecommended: '6.0mg（成人男性）/ 5.0mg（成人女性）',
      foods: [
        { name: 'アーモンド', emoji: '🥜', serving: '25粒（30g）', amount: 'ビタミンE 8.6mg', dailyPercentValue: 100, dailyPercent: '100%超', tip: '間食をアーモンドに置き換えるだけで十分量を確保' },
        { name: 'アボカド', emoji: '🥑', serving: '1/2個（70g）', amount: 'ビタミンE 2.5mg', dailyPercentValue: 42, dailyPercent: '約42%', tip: 'サラダやトーストに加えるだけで手軽に摂取' },
      ],
    },
  ],
  hairPattern: null,
}

function getBarColor(value) {
  if (!value) return 'linear-gradient(90deg, #9c958a 0%, #b8b2a8 100%)'
  if (value >= 80) return 'linear-gradient(90deg, #22c55e 0%, #4ade80 100%)'
  if (value >= 40) return 'linear-gradient(90deg, #419873 0%, #6bc4a0 100%)'
  return 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
}

const LOADING_STEPS = [
  '栄養素データを取得中...',
  'あなたに合った食材を選定中...',
  'レコメンドを生成中...',
]

function FoodRecommendContent() {
  const searchParams = useSearchParams()

  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [recipeModal, setRecipeModal] = useState(null)

  // プログレスバー用ステート
  const [loadingStep, setLoadingStep] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)

  const hairPattern = searchParams.get('hairPattern') || ''

  // プログレスバーアニメーション
  useEffect(() => {
    if (!isLoading) return
    const progressTimer = setInterval(() => {
      setLoadingProgress((prev) => Math.min(prev + 2, 90))
    }, 200)
    const stepTimer = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1))
    }, 3000)
    return () => {
      clearInterval(progressTimer)
      clearInterval(stepTimer)
    }
  }, [isLoading])

  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const deficiencies = searchParams.get('deficiencies') || ''

      const response = await apiFetch('/api/v1/food-sniper/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: deficiencies,
          hairPattern: hairPattern || null,
          useCache: true,
        }),
      })

      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Food recommendation error:', err)
      // API失敗時はフォールバックデータを使用
      setData(DEFAULT_FALLBACK)
    } finally {
      setIsLoading(false)
    }
  }, [searchParams, hairPattern])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  const handleRecipeClick = async (food) => {
    setRecipeModal({ food, loading: true, recipes: [], error: null })
    try {
      const response = await apiFetch('/api/v1/food-sniper/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foodName: food.name,
          hairPattern: data?.hairPattern || null,
          useCache: true,
        }),
      })
      const result = await response.json()
      setRecipeModal((prev) => ({
        ...prev,
        loading: false,
        recipes: result.recipes || [],
      }))
    } catch {
      setRecipeModal((prev) => ({
        ...prev,
        loading: false,
        error: 'レシピの取得に失敗しました',
      }))
    }
  }

  const handleRegenerateRecipe = async () => {
    if (!recipeModal) return
    setRecipeModal((prev) => prev ? {
      ...prev,
      loading: true,
      recipes: [],
      error: null,
    } : null)
    try {
      const response = await apiFetch('/api/v1/food-sniper/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foodName: recipeModal.food.name,
          hairPattern: data?.hairPattern || null,
          useCache: false,
        }),
      })
      const result = await response.json()
      setRecipeModal((prev) => prev ? {
        ...prev,
        loading: false,
        recipes: result.recipes || [],
      } : null)
    } catch {
      setRecipeModal((prev) => prev ? {
        ...prev,
        loading: false,
        error: 'レシピの再生成に失敗しました',
      } : null)
    }
  }

  const handleGoogleMapsClick = () => {
    window.open(
      'https://www.google.com/maps/search/スーパーマーケット+食料品店/',
      '_blank',
    )
  }

  const patternInfo = data?.patternInfo
  const nutrients = data?.nutrients || []

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.content}>
          <motion.h1
            style={styles.pageTitle}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            おすすめ食材
          </motion.h1>

          {isLoading && (
            <div style={styles.loadingContainer}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🥗</div>
              <h2 style={{ color: '#1a3d2e', marginBottom: '8px', fontWeight: 600 }}>分析中...</h2>
              <p style={{ color: '#7f786d', marginBottom: '4px' }}>あなたのタイプに合わせた最適な食材を選定しています</p>
              <div style={styles.progressContainer}>
                <motion.div
                  style={{ ...styles.progressBar, width: `${loadingProgress}%` }}
                  animate={{ width: `${loadingProgress}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
              <p style={styles.loadingStepText}>
                {LOADING_STEPS[loadingStep]}
              </p>
            </div>
          )}

          {error && (
            <motion.div
              style={styles.errorBox}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle size={18} />
              {error}
            </motion.div>
          )}

          {!isLoading && !error && data && (
            <>
              {/* Pattern Info */}
              {patternInfo && (
                <motion.div
                  style={styles.patternCard}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card padding="lg" variant="accent">
                    <div style={styles.patternBadge}>
                      <Leaf size={16} color="#419873" />
                      <span style={styles.patternLabel}>
                        {patternInfo.label}タイプ向け
                      </span>
                    </div>
                    <p style={styles.patternDesc}>{patternInfo.description}</p>
                    <div style={styles.patternFlow}>
                      <div style={styles.flowStep}>
                        <span style={styles.flowLabel}>原因</span>
                        <span style={styles.flowText}>
                          {patternInfo.cause}
                        </span>
                      </div>
                      <div style={styles.flowArrow}>↓</div>
                      <div style={styles.flowStep}>
                        <span style={styles.flowLabel}>対策</span>
                        <span style={styles.flowText}>
                          {patternInfo.strategy}
                        </span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}

              {!patternInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  style={{ marginBottom: '24px' }}
                >
                  <Card padding="lg" variant="outlined">
                    <p style={{ ...styles.introText, marginBottom: '16px', textAlign: 'center' }}>
                      まずはAIチェックで薄毛タイプを診断すると、
                      <br />
                      あなたに最適な食材をおすすめできます
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => window.location.href = '/feature1/capture'}
                      >
                        薄毛タイプ診断へ
                      </Button>
                    </div>
                  </Card>
                  <p style={{ ...styles.introText, marginTop: '20px' }}>
                    以下は一般的におすすめの食材です
                  </p>
                </motion.div>
              )}

              {/* Nutrient Sections */}
              {nutrients.map((nutrient, nIdx) => (
                <motion.div
                  key={nutrient.name}
                  style={styles.nutrientSection}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + nIdx * 0.1 }}
                >
                  <div style={styles.nutrientHeader}>
                    <h3 style={styles.nutrientName}>{nutrient.name}</h3>
                    <p style={styles.nutrientRole}>{nutrient.role}</p>
                    {nutrient.dailyRecommended && (
                      <p style={styles.nutrientDaily}>
                        推奨量: {nutrient.dailyRecommended}
                      </p>
                    )}
                  </div>

                  <div style={styles.foodGrid}>
                    {nutrient.foods.map((food, fIdx) => (
                      <Card
                        key={food.name}
                        padding="md"
                        hoverable
                        delay={0.25 + nIdx * 0.1 + fIdx * 0.06}
                      >
                        <div style={styles.foodCardInner}>
                          <div style={styles.foodTop}>
                            <motion.div
                              style={styles.foodEmoji}
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              transition={{ type: 'spring', stiffness: 400 }}
                            >
                              {food.emoji}
                            </motion.div>
                            <div style={styles.foodInfo}>
                              <div style={styles.foodName}>{food.name}</div>
                              <div style={styles.foodServing}>
                                {food.serving}
                              </div>
                              <div style={styles.foodAmount}>
                                {food.amount}
                              </div>
                            </div>
                          </div>

                          {food.dailyPercentValue != null && (
                            <div style={styles.barContainer}>
                              <div style={styles.barLabel}>
                                <span>1日の推奨量に対する割合</span>
                                <span
                                  style={{
                                    fontWeight: '600',
                                    color: '#1a3d2e',
                                  }}
                                >
                                  {food.dailyPercent}
                                </span>
                              </div>
                              <div style={styles.barTrack}>
                                <motion.div
                                  style={{
                                    ...styles.barFill,
                                    background: getBarColor(
                                      food.dailyPercentValue,
                                    ),
                                  }}
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: `${Math.min(food.dailyPercentValue, 100)}%`,
                                  }}
                                  transition={{
                                    delay:
                                      0.5 + nIdx * 0.1 + fIdx * 0.06,
                                    duration: 0.8,
                                    ease: 'easeOut',
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          <div style={styles.tipText}>
                            {'💡 '}
                            {food.tip}
                          </div>

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
                      </Card>
                    ))}
                  </div>
                </motion.div>
              ))}

              {/* Google Maps */}
              <motion.div
                style={styles.actionSection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <Button
                  size="full"
                  variant="accent"
                  icon={<MapPin size={18} />}
                  onClick={handleGoogleMapsClick}
                >
                  近くのスーパーで食材を探す
                </Button>
              </motion.div>

              {/* Disclaimer */}
              <motion.div
                style={styles.disclaimer}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <Info
                  size={12}
                  style={{
                    display: 'inline',
                    verticalAlign: 'middle',
                    marginRight: '4px',
                  }}
                />
                上記は一般的な栄養学の知見に基づく情報であり、医療的なアドバイスではありません。
                <br />
                気になる症状がある場合は、専門の医療機関にご相談ください。
              </motion.div>
            </>
          )}

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
                    <div style={styles.errorBox}>
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
                    ))}

                  {/* 他のレシピを見る ボタン */}
                  {!recipeModal.loading && recipeModal.recipes.length > 0 && (
                    <div style={styles.regenerateSection}>
                      <motion.button
                        style={styles.regenerateBtn}
                        whileHover={{ scale: 1.02, background: 'rgba(65, 152, 115, 0.12)' }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleRegenerateRecipe}
                      >
                        <RefreshCw size={14} />
                        他のレシピを見る
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  )
}

function FoodRecommend() {
  return (
    <Suspense
      fallback={
        <Layout>
          <div style={styles.loadingContainer}>
            <Loader2 size={36} color="#1a3d2e" />
          </div>
        </Layout>
      }
    >
      <FoodRecommendContent />
    </Suspense>
  )
}

export default FoodRecommend
