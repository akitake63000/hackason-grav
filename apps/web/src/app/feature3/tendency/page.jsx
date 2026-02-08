'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Dna,
  Apple,
  Brain,
  Heart,
  Activity,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
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
  // Result UI
  introCard: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  introTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(18px, 3vw, 22px)',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '12px',
  },
  introText: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    color: '#7f786d',
    lineHeight: 1.6,
  },
  tendencyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '32px',
  },
  tendencyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  iconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tendencyContent: {
    flex: 1,
  },
  tendencyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  tendencyName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  tendencyScore: {
    fontSize: '14px',
    fontWeight: '700',
  },
  progressBar: {
    height: '8px',
    background: 'rgba(26, 61, 46, 0.08)',
    borderRadius: '100px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '100px',
  },
  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '24px',
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
}

// 問診データ定義
const QUESTIONS = [
  {
    id: 'sleep_time',
    text: '普段の就寝時刻はいつ頃ですか？',
    options: [
      { label: '22時より前', value: 'before_10pm' },
      { label: '23時頃', value: 'before_11pm' },
      { label: '0時頃', value: 'before_12am' },
      { label: '1時頃', value: 'after_12am' },
      { label: '2時以降', value: 'after_1am' },
    ],
  },
  {
    id: 'wake_up_regular',
    text: '起床時刻は毎日一定ですか？',
    options: [
      { label: 'ほぼ毎日同じ', value: 'always' },
      { label: 'よく守れている', value: 'often' },
      { label: 'たまにずれる', value: 'sometimes' },
      { label: '不規則', value: 'rarely' },
    ],
  },
  {
    id: 'morning_sunlight',
    text: '起きてから1時間以内に太陽の光を浴びていますか？',
    options: [
      { label: '毎日浴びる', value: 'always' },
      { label: '週に数回', value: 'often' },
      { label: 'あまり浴びない', value: 'sometimes' },
      { label: 'ほとんど浴びない', value: 'rarely' },
    ],
  },
  {
    id: 'exercise_frequency',
    text: 'ウォーキングなどの有酸素運動をしていますか？',
    options: [
      { label: '毎日20分程度', value: 'daily' },
      { label: '週に3〜5回', value: '3_to_5_weekly' },
      { label: '週に1〜2回', value: '1_to_2_weekly' },
      { label: '月に数回', value: 'rarely' },
      { label: '全くしない', value: 'never' },
    ],
  },
  {
    id: 'shoulder_stiffness',
    text: '肩こりや首こりを感じることはありますか？',
    options: [
      { label: '全く感じない', value: 'never' },
      { label: 'たまに感じる', value: 'rarely' },
      { label: '時々感じる', value: 'sometimes' },
      { label: 'よく感じる', value: 'often' },
      { label: '常に感じている', value: 'always' },
    ],
  },
  {
    id: 'bathing_style',
    text: '入浴（湯船に浸かる）習慣はありますか？',
    options: [
      { label: '毎日湯船に浸かる', value: 'long_bath' },
      { label: '短時間だが毎日', value: 'short_bath' },
      { label: 'シャワーのみ', value: 'shower_only' },
      { label: 'あまりお風呂に入らない', value: 'rarely' },
    ],
  },
  {
    id: 'wake_feeling',
    text: '朝起きた時の気分や体調はどうですか？',
    options: [
      { label: 'スッキリ目覚める', value: 'refreshed' },
      { label: '普通', value: 'normal' },
      { label: '体が重い', value: 'tired' },
      { label: '常に疲労感がある', value: 'exhausted' },
    ],
  },
  {
    id: 'relaxation_habit',
    text: '自分なりのリラックス方法（趣味、瞑想など）を実践していますか？',
    options: [
      { label: '毎日実践している', value: 'daily' },
      { label: 'よく実践している', value: 'often' },
      { label: 'たまに実践する', value: 'sometimes' },
      { label: 'ほとんどない', value: 'rarely' },
    ],
  },
  {
    id: 'substances',
    text: '以下の嗜好品の中で当てはまるものはありますか？',
    options: [
      { label: '特になし', value: 'none' },
      { label: 'カフェイン（コーヒー等）のみ', value: 'caffeine_only' },
      { label: 'アルコール（酒）のみ', value: 'alcohol_only' },
      { label: 'タバコ（喫煙）のみ', value: 'smoking_only' },
      { label: '複数あてはまる（併用）', value: 'multiple' },
    ],
  },
  {
    id: 'water_intake',
    text: '1日にどれくらい水分（水・お茶）を摂りますか？',
    options: [
      { label: '2L以上', value: 'over_2L' },
      { label: '1〜2L程度', value: '1_to_2L' },
      { label: '1L未満', value: 'under_1L' },
      { label: 'ほとんど飲まない', value: 'very_little' },
    ],
  },
]

// 条件分岐用質問
const CONDITIONAL_QUESTIONS = {
  smoking_amount: {
    id: 'smoking_amount',
    text: '1日の平均喫煙本数はどれくらいですか？',
    trigger: (ans) => ans.substances === 'smoking_only' || ans.substances === 'multiple',
    options: [
      { label: '吸わない', value: 'none' },
      { label: '5本未満', value: 'less_than_5' },
      { label: '5〜10本', value: '5_to_10' },
      { label: '10本以上', value: 'over_10' },
    ],
  },
  alcohol_frequency: {
    id: 'alcohol_frequency',
    text: 'お酒を飲む頻度はどれくらいですか？',
    trigger: (ans) => ans.substances === 'alcohol_only' || ans.substances === 'multiple',
    options: [
      { label: '月に数回', value: 'rarely' },
      { label: '週に1〜2回', value: '1_to_2_weekly' },
      { label: '週に3〜5回', value: '3_to_5_weekly' },
      { label: '毎日', value: 'daily' },
    ],
  },
  caffeine_timing: {
    id: 'caffeine_timing',
    text: 'コーヒーや紅茶などのカフェインを摂るタイミングは？',
    trigger: (ans) => ans.substances === 'caffeine_only' || ans.substances === 'multiple',
    options: [
      { label: '午前中のみ', value: 'morning_only' },
      { label: '午後も飲む（夕方前まで）', value: 'until_afternoon' },
      { label: '夜も飲む', value: 'evening_too' },
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

  // 嗜好品チェックに応じて条件付き質問を動的に追加・削除する
  useEffect(() => {
    if (currentStep === 9 && answers.substances) {
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

    // 少し待ってから次の質問へ (UX向上のため)
    setTimeout(() => {
      if (currentStep < visibleQuestions.length - 1) {
        setCurrentStep((prev) => prev + 1)
      } else {
        handleSubmit()
      }
    }, 300)
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
      setError(err.message)
      setViewState('intro')
    }
  }

  // 結果表示用のデータ変換
  const tendencyResults = resultData
    ? Object.keys(resultData.scores).map((key) => {
      const score = resultData.scores[key]
      const label = resultData.axis_labels[key]
      const colors = {
        hormone: { from: '#ec4899', to: '#f472b6', bg: 'rgba(236, 72, 153, 0.1)' },
        circadian: { from: '#8b5cf6', to: '#a78bfa', bg: 'rgba(139, 92, 246, 0.1)' },
        blood_flow: { from: '#3b82f6', to: '#60a5fa', bg: 'rgba(59, 130, 246, 0.1)' },
        stress: { from: '#f59e0b', to: '#fbbf24', bg: 'rgba(245, 158, 11, 0.1)' },
      }
      const icons = {
        hormone: Heart,
        circadian: Activity,
        blood_flow: Dna,
        stress: Brain,
      }
      return {
        id: key,
        name: label.name,
        score: score,
        icon: icons[key] || Activity,
        color: label.color,
        bgColor: colors[key]?.bg || 'rgba(0,0,0,0.1)',
        gradientFrom: colors[key]?.from || '#ccc',
        gradientTo: colors[key]?.to || '#999',
      }
    })
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
          <h2 style={{ ...styles.introTitle, marginTop: '24px' }}>AIが分析中です...</h2>
          <p style={styles.introText}>あなたの情報を元に育毛メカニズム軸を解析しています</p>
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
              傾向分析結果
            </motion.h1>

            <Card variant="accent" padding="lg" delay={0.1}>
              <div style={styles.introCard}>
                <h2 style={styles.introTitle}>あなたの髪の健康状態</h2>
                <p style={styles.introText}>
                  問診に基づき、4つの重要メカニズムをスコア化しました。
                  点数が低い項目ほど、優先的なケアが必要です。
                </p>
              </div>
            </Card>

            <Card padding="lg" delay={0.2}>
              <div style={styles.tendencyList}>
                {tendencyResults.map((t, index) => (
                  <motion.div
                    key={t.id}
                    style={styles.tendencyItem}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                  >
                    <div style={{ ...styles.iconWrapper, background: t.bgColor }}>
                      <t.icon size={22} color={t.color} />
                    </div>
                    <div style={styles.tendencyContent}>
                      <div style={styles.tendencyHeader}>
                        <span style={styles.tendencyName}>{t.name}</span>
                        <span style={{ ...styles.tendencyScore, color: t.color }}>{t.score}%</span>
                      </div>
                      <div style={styles.progressBar}>
                        <motion.div
                          style={{
                            ...styles.progressFill,
                            background: `linear-gradient(90deg, ${t.gradientFrom} 0%, ${t.gradientTo} 100%)`,
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${t.score}%` }}
                          transition={{ delay: 0.5 + index * 0.1, duration: 1 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>

            <div style={styles.actionSection}>
              <Button
                size="full"
                icon={<ArrowRight size={18} />}
                iconPosition="right"
                onClick={() =>
                  router.push(
                    `/feature3/exercise-recommend?hormone=${resultData.scores.hormone}&circadian=${resultData.scores.circadian}&blood_flow=${resultData.scores.blood_flow}&stress=${resultData.scores.stress}`
                  )
                }
              >
                あなたに最適な対策を見る
              </Button>
            </div>
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
                disabled={currentStep === 0 && viewState === 'intro'}
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
            <div style={styles.introCard}>
              <h2 style={styles.introTitle}>今の生活を振り返る</h2>
              <p style={styles.introText}>
                あなたの日常生活がどれほど「髪の健康」に配慮できているか、10問程度の質問で診断します。
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
