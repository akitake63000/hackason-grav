'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import { Clock, ChevronRight, Loader2, Target, CheckCircle, Info, Sparkles, X, Calendar, Trophy, ArrowRight } from 'lucide-react'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import Button from '@/components/Button'
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
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%',
  },
  pageTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '600',
    color: '#1a3d2e',
    textAlign: 'center',
    marginBottom: '12px',
  },
  introText: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    color: '#7f786d',
    lineHeight: 1.6,
    textAlign: 'center',
    marginBottom: '32px',
  },
  actionGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '32px',
  },
  actionCard: {
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  actionInner: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  actionEmoji: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  },
  actionContent: {
    flex: 1,
  },
  actionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  actionName: {
    fontFamily: "'Noto Serif JP', serif",
    fontSize: '17px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  priorityBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '99px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  actionReason: {
    fontSize: '13px',
    color: '#419873',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  // Modal / Detail view
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 61, 46, 0.4)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: '32px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative',
    padding: '32px 24px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
  },
  modalHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '24px',
  },
  modalEmoji: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  modalTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1a3d2e',
    marginBottom: '8px',
  },
  modalSection: {
    marginBottom: '24px',
  },
  modalSectionTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1a3d2e',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modalText: {
    fontSize: '14px',
    color: '#4a4a4a',
    lineHeight: 1.6,
    marginBottom: '16px',
  },
  tipList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  tipItem: {
    display: 'flex',
    gap: '10px',
    padding: '12px 16px',
    background: '#f8f7f3',
    borderRadius: '16px',
    fontSize: '13px',
    color: '#4a4a4a',
    lineHeight: 1.5,
  },
  tipIcon: {
    flexShrink: 0,
    marginTop: '2px',
  },
  closeButton: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    padding: '8px',
    borderRadius: '50%',
    background: '#f5f5f5',
    border: 'none',
    cursor: 'pointer',
    color: '#7f786d',
  },
}

function LifestyleRecommendContent() {
  const searchParams = useSearchParams()
  const [recommendations, setRecommendations] = useState({})
  const [axisLabels, setAxisLabels] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [diagnosisDate, setDiagnosisDate] = useState(null)
  const [selectedAction, setSelectedAction] = useState(null)

  // Weekly Plan State
  const [currentPlan, setCurrentPlan] = useState(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [todayLog, setTodayLog] = useState({ completedActions: [] })

  // Reflection Modal State
  const [pendingCheckAction, setPendingCheckAction] = useState(null)

  const router = useRouter()

  const REFLECTION_MESSAGES = [
    { text: "本当に自分に嘘をついていませんか？", sub: "あなたの健康は、あなたの正直さで作られます。", yes: "はい、やりました！", no: "まだでした..." },
    { text: "素晴らしい！未来の自分が感謝しています。", sub: "この調子で続けましょう。", yes: "完了！", no: "あ、押し間違えた" },
    { text: "その1回が、大きな変化の第一歩です。", sub: "確実に実行しましたか？", yes: "自信を持ってYES", no: "これからやります" },
    { text: "自分への約束、守れましたね？", sub: "誰も見ていませんが、AIは信じています。", yes: "もちろんです", no: "ごめんなさい" },
    { text: "ナイスアクション！", sub: "ちなみに、どのくらい真剣にやりましたか？", yes: "バッチリやった", no: "うーん、微妙かも" },
  ]

  const [reflectionMessage, setReflectionMessage] = useState(REFLECTION_MESSAGES[0])

  const fetchPlan = async () => {
    try {
      const res = await apiFetch('/api/v1/lifestyle/plan/current')
      if (res.ok) {
        const data = await res.json()
        if (data.planId) {
          setCurrentPlan(data)
          setTodayLog(data.todayLog || { completedActions: [] })
        }
      }
    } catch (e) {
      console.error("Failed to fetch plan", e)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        let query = new URLSearchParams(searchParams).toString()

        // 1. Fetch Tendency / Recommendations
        if (!query) {
          const tendencyRes = await apiFetch('/api/v1/lifestyle/tendency/latest')
          if (!tendencyRes.ok) {
            // If 404, we handle it in render
            if (tendencyRes.status === 404) throw new Error('NO_DATA')
            throw new Error('Failed to fetch tendency')
          }
          const tendencyData = await tendencyRes.json()
          const scores = tendencyData.scores
          if (tendencyData.updatedAt) {
            setDiagnosisDate(tendencyData.updatedAt)
          }
          query = `hormone=${scores.hormone}&circadian=${scores.circadian}&blood_flow=${scores.blood_flow}&stress=${scores.stress}`
        }

        const res = await apiFetch(`/api/v1/lifestyle/recommendation?${query}`)
        if (!res.ok) throw new Error('推奨アクションの取得に失敗しました')
        const data = await res.json()
        setRecommendations(data.grouped_actions || {})
        setAxisLabels(data.axis_labels)

        // 2. Fetch Current Plan
        await fetchPlan()

      } catch (err) {
        setError(err.message === 'NO_DATA' ? '診断データがありません' : err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [searchParams])

  const handleGeneratePlan = async () => {
    setGeneratingPlan(true)
    try {
      const res = await apiFetch('/api/v1/lifestyle/plan/generate', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setCurrentPlan(data)
        setTodayLog({ completedActions: [] })
      }
    } catch (e) {
      console.error("Failed to generate", e)
      alert("プラン作成に失敗しました")
    } finally {
      setGeneratingPlan(false)
    }
  }

  // Update handleCheck to accept isYesterday
  const handleCheck = (action, isYesterday = false) => {
    const targetDate = isYesterday && currentPlan.yesterdayLog
      ? currentPlan.yesterdayLog.date
      : new Date().toISOString().split('T')[0] // Fallback (backend handles 4AM shift for today, but specific date overrides)

    // Actually, backend 4AM shift is for "GET current". 
    // For POST check, we should send the specific date we are checking for.
    // If checking "Today's Mission", we rely on backend's "today" or send explicit date?
    // Let's send explicit date to be safe.
    // But wait, "Today's mission" relies on backend 4AM Logic.
    // So if it's 2AM, backend says it's "Yesterday(Date X)".
    // So we should use the date from the log object if available?
    // todayLog doesn't have date field in my previous code, let's look.
    // No, I didn't add date to todayLog in backend.
    // Let's trust "isYesterday" flag. 

    // Logic:
    // If isYesterday=true, use currentPlan.yesterdayLog.date
    // If isYesterday=false, let backend decide "today" (send empty date? or handled by router?)
    // Router expects `date` field.

    // We need to know what "today" is according to backend.
    // Hack: Send a dummy date? No.
    // Let's calculate client-side 4AM shift to match backend.

    let dateStr = ""
    if (isYesterday && currentPlan.yesterdayLog) {
      dateStr = currentPlan.yesterdayLog.date
    } else {
      const now = new Date()
      if (now.getHours() < 4) {
        now.setDate(now.getDate() - 1)
      }
      dateStr = now.toISOString().split('T')[0]
    }

    setPendingCheckAction({ ...action, date: dateStr })

    // Select random message
    setReflectionMessage(REFLECTION_MESSAGES[Math.floor(Math.random() * REFLECTION_MESSAGES.length)])
  }

  const handleConfirmCheck = async () => {
    if (!pendingCheckAction || !currentPlan) return
    const actionId = pendingCheckAction.id
    const dateStr = pendingCheckAction.date

    try {
      // Optimistic update
      // If dateStr matches yesterdayLog.date, update yesterdayLog
      // Else update todayLog
      const isYesterday = currentPlan.yesterdayLog && dateStr === currentPlan.yesterdayLog.date

      if (isYesterday) {
        // Update yesterdayLog local state? 
        // Use fetchPlan to refresh is safer/easier
      } else {
        const newCompleted = [...todayLog.completedActions, actionId]
        setTodayLog({ ...todayLog, completedActions: newCompleted })
      }

      const res = await apiFetch('/api/v1/lifestyle/plan/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: currentPlan.planId,
          actionId: actionId,
          date: dateStr,
          completed: true
        }),
      })

      if (res.ok) {
        // Refresh to get consistent state
        fetchPlan()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setPendingCheckAction(null)
    }
  }

  const handleUncheckAction = async (actionId) => {
    if (!currentPlan) return

    // Immediate uncheck is allowed (undo)
    const newCompleted = todayLog.completedActions.filter(id => id !== actionId)
    setTodayLog({ ...todayLog, completedActions: newCompleted })

    try {
      // Calculate date with 4AM shift logic
      const now = new Date()
      if (now.getHours() < 4) {
        now.setDate(now.getDate() - 1)
      }
      const dateStr = now.toISOString().split('T')[0]

      await apiFetch('/api/v1/lifestyle/plan/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: currentPlan.planId,
          actionId,
          date: dateStr,
          completed: false
        })
      })
    } catch (e) {
      console.error("Uncheck failed", e)
    }
  }

  // ... 

  onClick = {() => isChecked ? handleUncheckAction(action.id) : handleCheck(action)
}
                  >
  <div style={styles.actionInner}>


  const getPriorityInfo = (priority) => {
    switch (priority) {
      case 'high':
    return {color: '#e11d48', bg: 'rgba(225, 29, 72, 0.1)', lead: '最優先対策' }
    case 'medium':
    return {color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', lead: '推奨対策' }
    default:
    return {color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', lead: '継続推奨' }
    }
  }

    if (loading) {
    return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Loader2 className="animate-spin" size={40} color="#419873" />
        <p style={{ marginTop: '16px', color: '#7f786d' }}>あなただけの生活改善案を抽出中...</p>
      </div>
    </Layout>
    )
  }

    if (error === '診断データがありません') {
    return (
    <Layout>
      <div style={styles.container}>
        <div style={{ ...styles.content, textAlign: 'center', padding: '60px 20px' }}>
          <h2 style={styles.pageTitle}>診断データがありません</h2>
          <p style={styles.introText}>まだライフスタイル傾向分析が行われていないようです。</p>
          <Button onClick={() => window.location.href = '/feature3/tendency'}>
            傾向分析を始める
          </Button>
        </div>
      </div>
    </Layout>
    )
  }

    // Define display order for axes
    const AXIS_ORDER = ['hormone', 'circadian', 'blood_flow', 'stress']

    return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.content}>
          <motion.h1 style={styles.pageTitle} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            生活習慣改善レコメンド
          </motion.h1>

          {diagnosisDate && !isNaN(new Date(diagnosisDate).getTime()) && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: 'center', fontSize: '13px', color: '#7f786d', marginBottom: '8px' }}
            >
              診断日時: {new Date(diagnosisDate).toLocaleString('ja-JP')}
            </motion.p>
          )}

          <motion.p style={styles.introText} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            4つのメカニズム軸の分析結果に基づき、<br />
            今のあなたに最も必要なアクションを提案します。
          </motion.p>

          {/* === PLAN SECTION === */}
          <div style={{ marginBottom: '40px' }}>
            {!currentPlan ? (
              <Card padding="lg" variant="accent" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <Sparkles size={32} color="#f59e0b" />
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>
                    AI週間プランを作成する
                  </h2>
                  <p style={{ fontSize: '14px', color: '#4a4a4a', lineHeight: 1.6 }}>
                    あなたの診断結果に基づき、<br />
                    今週取り組むべき「3つの重点アクション」をAIが選定します。
                  </p>
                </div>
                <Button onClick={handleGeneratePlan} disabled={generatingPlan}>
                  {generatingPlan ? <Loader2 className="animate-spin" /> : <><Calendar size={18} style={{ marginRight: 8 }} /> プランを作成する</>}
                </Button>
              </Card>
            ) : (() => { // Plan View (Expired or Active)
              const stats = currentPlan.weeklyStats
              const today = new Date()
              const endDate = new Date(currentPlan.endDate)
              endDate.setHours(23, 59, 59, 999) // Compare end of day? Or backend handles "expired" status?
              // Use backend status or logic. If "weeklyStats" exists, it's expired/completed.
              const isExpired = !!stats || (today > endDate && today.getDate() !== endDate.getDate())

              // Check freshness of diagnosis
              const diagDate = diagnosisDate ? new Date(diagnosisDate) : new Date(0)
              const twoWeeksAgo = new Date()
              twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
              const isDiagnosisOld = diagDate < twoWeeksAgo

              if (isExpired) {
                const rate = stats ? stats.rate : 0
                const message = stats ? stats.message : "お疲れ様でした！"

                return (
                  <Card padding="lg" variant="accent" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: '#fff', padding: '12px', borderRadius: '50%' }}>
                      <CheckCircle2 size={32} color="#419873" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1a3d2e', marginBottom: '8px' }}>
                        1週間のプランが終了しました
                      </h3>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#419873', margin: '12px 0' }}>
                        達成率: {rate}%
                      </div>
                      <p style={{ fontSize: '14px', color: '#4a4a4a', lineHeight: 1.6 }}>
                        {message}<br />
                        {isDiagnosisOld
                          ? "今の体の状態に合わせて、プランを最適化しましょう。"
                          : "心機一転、次の1週間を始めましょう！"}
                      </p>
                    </div>

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                      {isDiagnosisOld ? (
                        <>
                          <Button size="full" onClick={() => router.push('/feature3/tendency')}>
                            再診断を受ける（推奨）
                          </Button>
                          <Button size="full" variant="outline" onClick={handleGeneratePlan} disabled={generatingPlan}>
                            {generatingPlan ? <Loader2 className="animate-spin" /> : '今の診断結果で次へ'}
                          </Button>
                        </>
                      ) : (
                        <Button size="full" onClick={handleGeneratePlan} disabled={generatingPlan}>
                          {generatingPlan ? <Loader2 className="animate-spin" /> : '次のプランを作成する'}
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              }

              // Active Plan View
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                  {/* Yesterday's Review (If incomplete) */}
                  {currentPlan.yesterdayLog && (() => {
                    const completedSet = new Set(currentPlan.yesterdayLog.completedActions)
                    const allDone = currentPlan.targetActions.every(a => completedSet.has(a.id))

                    if (!allDone) {
                      return (
                        <Card padding="md" style={{ border: '1px solid #e0dcd0', background: '#faf9f5' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <History size={18} color="#f59e0b" />
                            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#1a3d2e' }}>昨日の振り返り</h3>
                          </div>
                          <p style={{ fontSize: '12px', color: '#7f786d', marginBottom: '12px' }}>
                            昨日の分も今なら記録できます（毎朝10時まで推奨）。
                          </p>
                          <div style={styles.checklist}>
                            {currentPlan.targetActions.map((action) => {
                              const isDone = completedSet.has(action.id)
                              return (
                                <div
                                  key={`yesterday-${action.id}`}
                                  style={{
                                    ...styles.checkItem,
                                    opacity: isDone ? 0.6 : 1,
                                  }}
                                  onClick={() => !isDone && handleCheck(action, true)} // Pass isYesterday=true
                                >
                                  <div style={{
                                    ...styles.checkbox,
                                    ...(isDone ? styles.checkboxChecked : {}),
                                  }}>
                                    {isDone && <CheckCircle2 size={14} color="#fff" />}
                                  </div>
                                  <div style={styles.actionContent}>
                                    <div style={{ ...styles.actionName, fontSize: '13px' }}>{action.name}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </Card>
                      )
                    }
                    return null
                  })()
                  }

                  {/* Theme Card */}
                  <Card variant="accent" padding="lg">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <div style={styles.themeIcon}>
                        <Sparkles size={20} color="#fff" />
                      </div>
                      <div>
                        <div style={styles.cardLabel}>今週のテーマ</div>
                        <h2 style={styles.cardTitle}>{currentPlan.theme}</h2>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', color: '#4a4a4a' }}>
                        <span>進捗</span>
                        <span>{Math.round((todayLog.completedActions.length / currentPlan.targetActions.length) * 100)}%</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.5)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${(todayLog.completedActions.length / currentPlan.targetActions.length) * 100}%`,
                          height: '100%',
                          background: '#419873',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  </Card>

                  {/* Today's Mission */}
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1a3d2e', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={20} /> 今日のミッション
                    </h3>
                    <div style={styles.checklist}>
                      {currentPlan.targetActions.map((action, index) => {
                        const isDone = todayLog.completedActions.includes(action.id)
                        return (
                          <motion.div
                            key={action.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            style={{
                              ...styles.checkItem,
                              ...(isDone ? styles.checkItemActive : {}),
                            }}
                            onClick={() => !isDone && handleCheck(action)}
                          >
                            <div style={{
                              ...styles.checkbox,
                              ...(isDone ? styles.checkboxChecked : {}),
                            }}>
                              {isDone && <CheckCircle2 size={16} color="#fff" />}
                            </div>
                            <div style={styles.actionContent}>
                              <div style={styles.actionName}>{action.name}</div>
                              <div style={styles.actionDesc}>
                                {action.emoji} {action.reason}
                              </div>
                            </div>
                            {isDone && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ marginLeft: 'auto' }}>
                                <span style={{ fontSize: '12px', color: '#419873', fontWeight: '600' }}>完了!</span>
                              </motion.div>
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '40px 0' }} />

          {/* === ALL RECOMMENDATIONS SECTION === */}
          <div style={{ opacity: 0.8 }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#7f786d', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={18} /> その他の改善アプローチ（参考）
            </h2>

            <div style={styles.actionGrid}>
              {AXIS_ORDER.map((axisKey) => {
                const actions = recommendations[axisKey] || []
                const axisLabel = axisLabels[axisKey]

                if (actions.length === 0) return null

                return (
                  <div key={axisKey} style={{ marginBottom: '24px' }}>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: axisLabel?.color,
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ fontSize: '20px' }}>{axisLabel?.emoji}</span>
                      {axisLabel?.name}
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {actions.map((action, index) => {
                        const p = getPriorityInfo(action.priority)
                        // Check if this reference action is done today
                        const isChecked = todayLog.completedActions.includes(action.id)

                        return (
                          <motion.div
                            key={action.id}
                            layout
                            initial={false}
                            animate={{
                              backgroundColor: isChecked ? '#f0fdf4' : '#fafafa',
                              borderColor: isChecked ? '#bbf7d0' : 'transparent'
                            }}
                            style={{
                              ...styles.actionCard,
                              border: isChecked ? '1px solid' : 'none',
                              cursor: 'pointer'
                            }}
                            onClick={() => isChecked ? handleUncheckAction(action.id) : handleCheck(action)}
                          >
                            <div style={styles.actionInner}>
                              <div style={{
                                ...styles.actionEmoji,
                                width: '40px', height: '40px', fontSize: '20px',
                                background: isChecked ? '#419873' : '#fff',
                                color: isChecked ? '#fff' : '#000',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s ease'
                              }}>
                                {isChecked ? <CheckCircle size={20} /> : action.emoji}
                              </div>
                              <div style={styles.actionContent}>
                                <div style={styles.actionHeader}>
                                  <div style={{
                                    ...styles.actionName,
                                    fontSize: '15px',
                                    color: isChecked ? '#15803d' : '#1a3d2e',
                                    textDecoration: isChecked ? 'line-through' : 'none'
                                  }}>
                                    {action.name}
                                  </div>
                                  {isChecked ? (
                                    <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 'bold' }}>COMPLETED</span>
                                  ) : (
                                    <ChevronRight size={16} color="#e0dcd0" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Relection Modal */}
          <AnimatePresence>
            {pendingCheckAction && (
              <motion.div
                style={styles.modalOverlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPendingCheckAction(null)}
              >
                <motion.div
                  style={{ ...styles.modalContent, textAlign: 'center' }}
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤔</div>
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1a3d2e', marginBottom: '8px' }}>
                    {reflectionMessage.text}
                  </h3>
                  <p style={{ color: '#4a4a4a', marginBottom: '24px' }}>
                    {reflectionMessage.sub}
                  </p>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="secondary" onClick={() => setPendingCheckAction(null)} style={{ flex: 1 }}>
                      {reflectionMessage.no}
                    </Button>
                    <Button onClick={confirmCheckAction} style={{ flex: 1 }}>
                      {reflectionMessage.yes}
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedAction && (
              <motion.div
                style={styles.modalOverlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedAction(null)}
              >
                <motion.div
                  style={styles.modalContent}
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button style={styles.closeButton} onClick={() => setSelectedAction(null)}>
                    <X size={20} />
                  </button>

                  <div style={styles.modalHeader}>
                    <div style={styles.modalEmoji}>{selectedAction.emoji}</div>
                    <h2 style={styles.modalTitle}>{selectedAction.name}</h2>
                    <div style={{ ...styles.priorityBadge, color: getPriorityInfo(selectedAction.priority).color, background: getPriorityInfo(selectedAction.priority).bg }}>
                      {getPriorityInfo(selectedAction.priority).lead} / {selectedAction.duration}
                    </div>
                  </div>

                  <div style={styles.modalSection}>
                    <h3 style={styles.modalSectionTitle}>
                      <Info size={16} color="#419873" />
                      なぜこれが必要か
                    </h3>
                    <p style={styles.modalText}>{selectedAction.explanation}</p>
                  </div>

                  <div style={styles.modalSection}>
                    <h3 style={styles.modalSectionTitle}>
                      <CheckCircle size={16} color="#419873" />
                      具体的な実践ポイント
                    </h3>
                    <div style={styles.tipList}>
                      {selectedAction.tips?.map((tip, i) => (
                        <div key={i} style={styles.tipItem}>
                          <div style={styles.tipIcon}>✨</div>
                          {tip}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={styles.modalSection}>
                    <h3 style={styles.modalSectionTitle}>
                      <Target size={16} color="#419873" />
                      改善される指標
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedAction.targets.map(tId => (
                        <span key={tId} style={{ padding: '6px 12px', background: 'rgba(65, 152, 115, 0.08)', borderRadius: '12px', fontSize: '12px', color: '#1a3d2e', fontWeight: '600' }}>
                          {axisLabels[tId]?.emoji} {axisLabels[tId]?.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Button size="full" onClick={() => setSelectedAction(null)}>理解しました</Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div >
      </div >
    </Layout >
    )
}

    // ローディングフォールバック
    function LifestyleRecommendFallback() {
  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Loader2 className="animate-spin" size={40} color="#419873" />
        <p style={{ marginTop: '16px', color: '#7f786d' }}>あなただけの生活改善案を抽出中...</p>
      </div>
    </Layout>
    )
}

    // メインコンポーネント: Suspenseでラップする
    function LifestyleRecommend() {
  return (
    <Suspense fallback={<LifestyleRecommendFallback />}>
      <LifestyleRecommendContent />
    </Suspense>
    )
}

    export default LifestyleRecommend
