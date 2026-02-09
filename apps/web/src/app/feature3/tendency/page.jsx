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

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    paddingBottom: '40px',
  },
  content: {
    maxWidth: '600px',
    margin: '0 auto',
    width: '100%',
  },
  pageTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(24px, 4vw, 30px)',
    fontWeight: '600',
    color: '#1a3d2e',
    textAlign: 'center',
    marginBottom: '20px',
  },
  // Step UI
  stepIndicator: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    marginBottom: '24px',
  },
  stepDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#e0dcd0',
    transition: 'all 0.3s ease',
  },
  stepDotActive: {
    width: '24px',
    borderRadius: '4px',
    background: '#419873',
  },
  questionCard: {
    minHeight: '300px',
    display: 'flex',
    flexDirection: 'column',
  },
  questionText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '24px',
    lineHeight: 1.4,
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  optionButton: {
    width: '100%',
    padding: '16px 20px',
    borderRadius: '16px',
    border: '1.5px solid #e0dcd0',
    background: '#fff',
    textAlign: 'left',
    fontSize: '15px',
    color: '#4a4a4a',
    transition: 'all 0.2s ease',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  optionButtonSelected: {
    borderColor: '#419873',
    background: 'rgba(65, 152, 115, 0.05)',
    color: '#1a3d2e',
    fontWeight: '600',
  },
  // Result UI - Matrix Style
  matrixGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '24px',
  },
  matrixCard: {
    padding: '20px',
    borderRadius: '24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
  },
  matrixIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  matrixScore: {
    fontSize: '28px',
    fontFamily: "'Cormorant Garamond', serif",
    fontWeight: '700',
  },
  matrixDesc: {
    fontSize: '11px',
    color: '#7f786d',
    lineHeight: 1.4,
  },
  summaryCard: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  summaryTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '8px',
  },
  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '12px',
    gap: '12px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    textAlign: 'center',
  },
  introTitle: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '12px',
  },
  introText: {
    fontSize: '15px',
    color: '#4a4a4a',
    lineHeight: 1.6,
  },
}

// 問診データ定義 (MECE 5択)
const QUESTIONS = [
  {
    id: 'sleep_time',
    text: '普段の就寝時刻はいつ頃ですか？',
    options: [
      { label: '22時より前', value: 'score_100' },
      { label: '22時〜23時', value: 'score_80' },
      { label: '23時〜0時', value: 'score_60' },
      { label: '0時〜1時', value: 'score_40' },
      { label: '1時以降', value: 'score_20' },
    ],
  },
  {
    id: 'wake_up_regular',
    text: '起床時刻は毎日一定ですか？',
    options: [
      { label: '常に一定（誤差15分以内）', value: 'score_100' },
      { label: 'ほぼ一定（誤差30分以内）', value: 'score_80' },
      { label: '平日と休日で1時間程度違う', value: 'score_60' },
      { label: '平日と休日で2時間以上違う', value: 'score_40' },
      { label: '毎日バラバラ', value: 'score_20' },
    ],
  },
  {
    id: 'morning_sunlight',
    text: '起きてから1時間以内に太陽の光を浴びていますか？',
    options: [
      { label: '毎日意識して浴びている', value: 'score_100' },
      { label: '通勤・通学時に浴びる', value: 'score_80' },
      { label: '週に半分程度', value: 'score_60' },
      { label: 'たまにしか浴びない', value: 'score_40' },
      { label: 'ほとんど浴びない（屋内生活）', value: 'score_20' },
    ],
  },
  {
    id: 'exercise_frequency',
    text: 'ウォーキングなどの有酸素運動をしていますか？',
    options: [
      { label: '毎日20分以上', value: 'score_100' },
      { label: '週3〜4回', value: 'score_80' },
      { label: '週1〜2回', value: 'score_60' },
      { label: '月に数回程度', value: 'score_40' },
      { label: 'ほとんどしない', value: 'score_20' },
    ],
  },
  {
    id: 'shoulder_stiffness',
    text: '肩こりや首こりの状態はどうですか？',
    options: [
      { label: '全く気にならない', value: 'score_100' },
      { label: 'たまに軽く感じる', value: 'score_80' },
      { label: '週に数回感じる', value: 'score_60' },
      { label: '頻繁に感じる', value: 'score_40' },
      { label: '常に辛い・痛い', value: 'score_20' },
    ],
  },
  {
    id: 'bathing_style',
    text: '入浴（湯船に浸かる）習慣はありますか？',
    options: [
      { label: '毎日15分以上浸かる', value: 'score_100' },
      { label: '毎日短時間浸かる', value: 'score_80' },
      { label: '週3回以上浸かる', value: 'score_60' },
      { label: 'シャワーのみが多い', value: 'score_40' },
      { label: '常にシャワーのみ', value: 'score_20' },
    ],
  },
  {
    id: 'wake_feeling',
    text: '朝起きた時の気分や体調はどうですか？',
    options: [
      { label: '非常にスッキリしている', value: 'score_100' },
      { label: 'まあまあ良い', value: 'score_80' },
      { label: '少し眠気・ダルさがある', value: 'score_60' },
      { label: 'なかなか起き上がれない', value: 'score_40' },
      { label: '最悪・常に疲労困憊', value: 'score_20' },
    ],
  },
  {
    id: 'relaxation_habit',
    text: '自分なりのリラックス方法（趣味、深呼吸など）を持っていますか？',
    options: [
      { label: '毎日実践している', value: 'score_100' },
      { label: '週に数回実践している', value: 'score_80' },
      { label: '週末にまとめて実践する', value: 'score_60' },
      { label: 'たまにしかできない', value: 'score_40' },
      { label: '時間がない・方法がない', value: 'score_20' },
    ],
  },
  {
    id: 'water_intake',
    text: '1日にどれくらい水分（水・お茶）を摂りますか？',
    options: [
      { label: '2リットル以上', value: 'score_100' },
      { label: '1.5〜2リットル', value: 'score_80' },
      { label: '1〜1.5リットル', value: 'score_60' },
      { label: '500ml〜1リットル', value: 'score_40' },
      { label: 'ほとんど飲まない', value: 'score_20' },
    ],
  },
  {
    id: 'substances',
    text: '以下の嗜好品の中で、最も摂取頻度や量が多いものは？',
    options: [
      { label: '特になし（健康優良）', value: 'none' },
      { label: 'カフェイン（コーヒー・紅茶）', value: 'caffeine' },
      { label: 'アルコール（お酒）', value: 'alcohol' },
      { label: 'タバコ（喫煙）', value: 'smoking' },
      { label: '複数・その他', value: 'multiple' },
    ],
  },
]

// 条件分岐用質問 (MECE 5択 or 必要十分な選択肢)
const CONDITIONAL_QUESTIONS = {
  smoking_amount: {
    id: 'smoking_amount',
    text: '1日の平均喫煙本数はどれくらいですか？',
    trigger: (ans) => ans.substances === 'smoking' || ans.substances === 'multiple',
    options: [
      { label: '吸わない（過去に吸っていた）', value: 'score_80' },
      { label: '1〜5本（ライト）', value: 'score_60' },
      { label: '6〜10本（ハーフパック）', value: 'score_40' },
      { label: '11〜20本（1箱）', value: 'score_20' },
      { label: '21本以上（ヘビースモーカー）', value: 'score_0' },
    ],
  },
  alcohol_frequency: {
    id: 'alcohol_frequency',
    text: 'お酒を飲む頻度と量は？',
    trigger: (ans) => ans.substances === 'alcohol' || ans.substances === 'multiple',
    options: [
      { label: '機会飲酒程度（月数回）', value: 'score_80' },
      { label: '週1〜2回・適量', value: 'score_60' },
      { label: '週3〜4回・適量', value: 'score_40' },
      { label: 'ほぼ毎日・適量', value: 'score_20' },
      { label: '毎日・多量', value: 'score_0' },
    ],
  },
  // カフェインは「タイミング」を重視
  caffeine_timing: {
    id: 'caffeine_timing',
    text: 'コーヒーや紅茶などを飲むタイミングは？（睡眠への影響）',
    trigger: (ans) => ans.substances === 'caffeine' || ans.substances === 'multiple',
    options: [
      { label: '午前中のみ', value: 'score_100' },
      { label: 'ランチ後まで（13時頃）', value: 'score_80' },
      { label: 'おやつ時まで（15時頃）', value: 'score_60' },
      { label: '夕食後も飲む', value: 'score_40' },
      { label: '就寝直前まで飲む', value: 'score_20' },
    ],
  },
}

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

  useEffect(() => {
    if (currentStep >= 9 && answers.substances) {
      const moreQuestions = []
      if (CONDITIONAL_QUESTIONS.smoking_amount.trigger(answers)) {
        moreQuestions.push(CONDITIONAL_QUESTIONS.smoking_amount)
      }
      if (CONDITIONAL_QUESTIONS.alcohol_frequency.trigger(answers)) {
        moreQuestions.push(CONDITIONAL_QUESTIONS.alcohol_frequency)
      }
      if (CONDITIONAL_QUESTIONS.caffeine_timing.trigger(answers)) {
        moreQuestions.push(CONDITIONAL_QUESTIONS.caffeine_timing)
      }

      setVisibleQuestions([...QUESTIONS, ...moreQuestions])
    }
  }, [answers.substances, currentStep])

  const handleStart = () => {
    setViewState('question')
  }

  const handleOptionSelect = (qId, value) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }))

    // 自動遷移 (少し遅延させてアニメーションを見せる)
    setTimeout(() => {
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
        <div style={styles.loadingContainer}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          >
            <Loader2 size={48} color="#419873" />
          </motion.div>
          <h2 style={{ ...styles.introTitle, marginTop: '24px' }}>AIによるマトリクス分析中...</h2>
          <p style={styles.introText}>あなたの生活習慣を4つの育毛メカニズム軸で解析しています</p>
        </div>
      </Layout>
    )
  }

  if (viewState === 'result') {
    return (
      <Layout>
        <div style={styles.container}>
          <div style={styles.content}>
            <motion.h1 style={styles.pageTitle} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              診断マトリクス結果
            </motion.h1>

            <Card variant="accent" padding="lg" style={styles.summaryCard}>
              <h2 style={styles.summaryTitle}>分析スコアの総括</h2>
              {resultData.updatedAt && !isNaN(new Date(resultData.updatedAt).getTime()) && (
                <p style={{ fontSize: '13px', color: '#7f786d', marginBottom: '8px' }}>
                  前回の診断日時: {new Date(resultData.updatedAt).toLocaleString('ja-JP')}
                </p>
              )}
              <p style={styles.introText}>
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
              style={styles.matrixGrid}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              {resultList.map((t, index) => (
                <Card key={t.id} style={styles.matrixCard} delay={0.2 + index * 0.1}>
                  <div style={{ ...styles.matrixIcon, background: t.bg }}>
                    <t.icon size={24} color={t.color} />
                  </div>
                  <div style={styles.matrixLabel}>{t.name}</div>
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
                  <div style={styles.matrixDesc}>{t.desc}</div>
                </Card>
              ))}
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
        <div style={styles.container}>
          <div style={styles.content}>
            <div style={styles.stepIndicator}>
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
                <Card padding="lg" style={styles.questionCard}>
                  <h2 style={styles.questionText}>{question.text}</h2>
                  <div style={styles.optionsList}>
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

            <div style={styles.navigation}>
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
      <div style={styles.container}>
        <div style={styles.content}>
          <motion.h1
            style={styles.pageTitle}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            ライフスタイル傾向分析
          </motion.h1>

          <Card variant="accent" padding="lg" delay={0.1}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={styles.introTitle}>今の生活を振り返る</h2>
              <p style={styles.introText}>
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
