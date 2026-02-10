'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Brain,
  Heart,
  Activity,
  Droplets,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  Info,
} from 'lucide-react'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import { apiFetch } from '@/lib/api'

function Tendency() {
  const router = useRouter()
  const [viewState, setViewState] = useState('intro') // 'intro' | 'question' | 'loading' | 'result'
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [visibleQuestions, setVisibleQuestions] = useState([...QUESTIONS])
  const [resultData, setResultData] = useState(null)
  const [error, setError] = useState(null)

  // 永続化データ取得
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await apiFetch('/api/v1/lifestyle/tendency/latest')
        if (res.ok) {
          const data = await res.json()
          setResultData(data)
          // 既存データがあれば結果表示モードにする
          setViewState('result')
        }
      } catch (err) {
        console.log('No previous tendency data found or error fetching.')
      }
    }
    fetchLatest()
  }, [])



  const handleStart = () => {
    setViewState('question')
  }

  const handleOptionSelect = (qId, value) => {
    const newAnswers = { ...answers, [qId]: value }
    setAnswers(newAnswers)

    // 自動遷移 (少し遅延させてアニメーションを見せる)
    setTimeout(() => {
      // Check if this is the substances question and needs conditional questions
      if (qId === 'substances') {
        const needsConditional = value === 'smoking' || value === 'alcohol' || value === 'caffeine' || value === 'multiple'
        if (needsConditional) {
          // Add conditional questions first, then advance
          const moreQuestions = []
          if (value === 'smoking' || value === 'multiple') {
            moreQuestions.push(CONDITIONAL_QUESTIONS.smoking_amount)
          }
          console.log("Substances selected:", value, "Adding questions:", moreQuestions)
          if (value === 'alcohol' || value === 'multiple') {
            moreQuestions.push(CONDITIONAL_QUESTIONS.alcohol_frequency)
          }
          if (value === 'caffeine' || value === 'multiple') {
            moreQuestions.push(CONDITIONAL_QUESTIONS.caffeine_timing)
          }
          if (moreQuestions.length > 0) {
            setVisibleQuestions([...QUESTIONS, ...moreQuestions])
            setCurrentStep((prev) => prev + 1)
            return
          }
        }
      }

      if (currentStep < visibleQuestions.length - 1) {
        setCurrentStep((prev) => prev + 1)
      } else {
        handleSubmit()
      }
    }, 350)
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    } else {
      setViewState('intro')
    }
  }

  const handleSubmit = async () => {
    setViewState('loading')
    try {
      const res = await apiFetch('/api/v1/lifestyle/tendency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })

      if (!res.ok) throw new Error('分析に失敗しました')
      const data = await res.json()
      setResultData(data)
      setViewState('result')
    } catch (err) {
      console.error('Tendency submit error:', err)
      setError(err.message)
      setViewState('intro')
    }
  }

  // 再診断（リセット）
  const handleRediagnose = () => {
    setResultData(null)
    setViewState('question')
    setCurrentStep(0)
    setAnswers({})
    setVisibleQuestions([...QUESTIONS])
  }

  const resultList = resultData && resultData.scores
    ? [
      { id: 'hormone', icon: Heart, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', desc: '成長ホルモンと代謝' },
      { id: 'circadian', icon: Activity, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', desc: '生活リズムと体内時計' },
      { id: 'blood_flow', icon: Droplets, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', desc: '頭皮への血流供給' },
      { id: 'stress', icon: Brain, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', desc: '精神的ストレス状態' },
    ].map(item => ({
      ...item,
      name: resultData.axis_labels?.[item.id]?.name || item.id,
      score: resultData.scores[item.id] || 0
    }))
    : []

  if (viewState === 'loading') {
    return (
      <Layout>
        <div className={styles.loadingContainer}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          >
            <Loader2 size={48} color="#419873" />
          </motion.div>
          <h2 style={{ ...styles.introTitle, marginTop: '24px' }}>AIによるマトリクス分析中...</h2>
          <p className={styles.introText}>あなたの生活習慣を4つの育毛メカニズム軸で解析しています</p>
        </div>
      </Layout>
    )
  }

  if (viewState === 'result') {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.content}>
            <motion.h1 className={styles.pageTitle} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              診断マトリクス結果
            </motion.h1>

            <Card variant="accent" padding="lg" className={styles.summaryCard}>
              <h2 className={styles.summaryTitle}>分析スコアの総括</h2>
              {resultData.updatedAt && !isNaN(new Date(resultData.updatedAt).getTime()) && (
                <p style={{ fontSize: '13px', color: '#7f786d', marginBottom: '8px' }}>
                  前回の診断日時: {new Date(resultData.updatedAt).toLocaleString('ja-JP')}
                </p>
              )}
              <p className={styles.introText}>
                4つの主要な指標に基づいたあなたの現状です。<br />
                各項目のスコアが低いほど、改善の余地が大きいことを示しています。
              </p>
              <div style={{ marginTop: '16px' }}>
                <Button size="sm" variant="outline" onClick={handleRediagnose}>
                  もう一度診断する
                </Button>
              </div>
            </Card>

            <motion.div
              className={styles.matrixGrid}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              {resultList.map((t, index) => {
                const average = 60;
                const getGaugeColor = (score) => {
                  if (score >= 70) return '#22c55e';  // green
                  if (score >= 50) return '#f59e0b';  // yellow
                  return '#ef4444';  // red
                };
                return (
                  <Card key={t.id} className={styles.matrixCard} delay={0.2 + index * 0.1}>
                    <div style={{ ...styles.matrixIcon, background: t.bg }}>
                      <t.icon size={24} color={t.color} />
                    </div>
                    <div className={styles.matrixLabel}>{t.name}</div>
                    <div style={{ ...styles.matrixScore, color: t.color }}>
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 + index * 0.1, duration: 1 }}
                      >
                        {t.score}
                      </motion.span>
                      <span style={{ fontSize: '14px', marginLeft: '2px' }}>pts</span>
                    </div>

                    {/* Score Gauge Bar */}
                    <div style={{
                      width: '100%',
                      height: '12px',
                      background: '#f3f4f6',
                      borderRadius: '6px',
                      position: 'relative',
                      marginTop: '8px',
                      marginBottom: '4px',
                      overflow: 'visible'
                    }}>
                      {/* Filled portion */}
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, t.score)}%` }}
                        transition={{ delay: 0.3 + index * 0.1, duration: 0.8, ease: 'easeOut' }}
                        style={{
                          height: '100%',
                          background: `linear-gradient(90deg, ${getGaugeColor(t.score)}, ${getGaugeColor(t.score)}dd)`,
                          borderRadius: '6px'
                        }}
                      />
                      {/* Average marker line */}
                      <div style={{
                        position: 'absolute',
                        left: `${average}%`,
                        top: '-4px',
                        width: '2px',
                        height: '20px',
                        background: '#6b7280',
                        borderRadius: '1px'
                      }} />
                      {/* Average label */}
                      <div style={{
                        position: 'absolute',
                        left: `${average}%`,
                        top: '18px',
                        transform: 'translateX(-50%)',
                        fontSize: '9px',
                        color: '#6b7280',
                        whiteSpace: 'nowrap'
                      }}>
                        平均
                      </div>
                    </div>

                    <div style={{ ...styles.matrixDesc, marginTop: '12px' }}>{t.desc}</div>
                  </Card>
                );
              })}
            </motion.div>

            <div style={{ marginTop: '24px' }}>
              <Button
                size="full"
                icon={<ArrowRight size={18} />}
                iconPosition="right"
                onClick={() =>
                  router.push(
                    `/feature3/lifestyle-recommend?hormone=${resultData.scores.hormone}&circadian=${resultData.scores.circadian}&blood_flow=${resultData.scores.blood_flow}&stress=${resultData.scores.stress}`
                  )
                }
              >
                生活習慣改善レコメンドを見る
              </Button>
            </div>

            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#9c958a' }}>
              <Info size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              点数は0-100で、70点以上が良好な状態の目安です。
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  if (viewState === 'question') {
    const question = visibleQuestions[currentStep]
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.stepIndicator}>
              {visibleQuestions.map((_, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.stepDot,
                    ...(i === currentStep ? styles.stepDotActive : {}),
                    ...(i < currentStep ? { background: '#419873', opacity: 0.5 } : {}),
                  }}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={question.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card padding="lg" className={styles.questionCard}>
                  <h2 className={styles.questionText}>{question.text}</h2>
                  <div className={styles.optionsList}>
                    {question.options.map((opt) => (
                      <button
                        key={opt.value}
                        style={{
                          ...styles.optionButton,
                          ...(answers[question.id] === opt.value ? styles.optionButtonSelected : {}),
                        }}
                        onClick={() => handleOptionSelect(question.id, opt.value)}
                      >
                        {opt.label}
                        {answers[question.id] === opt.value ? (
                          <CheckCircle2 size={18} color="#419873" />
                        ) : (
                          <ChevronRight size={18} color="#e0dcd0" />
                        )}
                      </button>
                    ))}
                  </div>
                </Card>
              </motion.div>
            </AnimatePresence>

            <div className={styles.navigation}>
              <Button
                variant="outline"
                icon={<ChevronLeft size={18} />}
                onClick={handleBack}
              >
                戻る
              </Button>
              <div style={{ fontSize: '14px', color: '#7f786d', alignSelf: 'center' }}>
                {currentStep + 1} / {visibleQuestions.length}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.content}>
          <motion.h1
            className={styles.pageTitle}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            ライフスタイル傾向分析
          </motion.h1>

          <Card variant="accent" padding="lg" delay={0.1}>
            <div style={{ textAlign: 'center' }}>
              <h2 className={styles.introTitle}>今の生活を振り返る</h2>
              <p className={styles.introText}>
                日常生活がどれほど「髪の健康」に配慮できているか、4つの主要メカニズム指標に基づいて精密に診断します。
              </p>
            </div>
          </Card>

          <div style={{ marginTop: '32px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <Button size="full" onClick={handleStart}>
                分析を開始する
              </Button>
            </motion.div>
            {error && <p style={{ color: 'red', marginTop: '16px', textAlign: 'center' }}>{error}</p>}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Tendency
