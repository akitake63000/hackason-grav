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

  const handleCreateCheck = (action) => {
    // Pick a random message
    const msg = REFLECTION_MESSAGES[Math.floor(Math.random() * REFLECTION_MESSAGES.length)]
    setReflectionMessage(msg)
    setPendingCheckAction(action)
  }

  const confirmCheckAction = async () => {
    if (!currentPlan || !pendingCheckAction) return

    const actionId = pendingCheckAction.id

    // Optimistic update
    const newCompleted = [...todayLog.completedActions, actionId]
    setTodayLog({ ...todayLog, completedActions: newCompleted })

    // Close modal
    setPendingCheckAction(null)

    try {
      const today = new Date().toISOString().split('T')[0]
      await apiFetch('/api/v1/lifestyle/plan/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: currentPlan.planId,
          actionId,
          date: today,
          completed: true
        })
      })
    } catch (e) {
      console.error("Check failed", e)
      // Revert? For now, assume success or user sees error next reload
    }
  }

  const handleUncheckAction = async (actionId) => {
    if (!currentPlan) return

    // Immediate uncheck is allowed (undo)
    const newCompleted = todayLog.completedActions.filter(id => id !== actionId)
    setTodayLog({ ...todayLog, completedActions: newCompleted })

    try {
      const today = new Date().toISOString().split('T')[0]
      await apiFetch('/api/v1/lifestyle/plan/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: currentPlan.planId,
          actionId,
          date: today,
          completed: false
        })
      })
    } catch (e) {
      console.error("Uncheck failed", e)
    }
  }

  const getPriorityInfo = (priority) => {
    switch (priority) {
      case 'high':
        return { color: '#e11d48', bg: 'rgba(225, 29, 72, 0.1)', lead: '最優先対策' }
      case 'medium':
        return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', lead: '推奨対策' }
      default:
        return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', lead: '継続推奨' }
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
            ) : (() => {
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const endDate = new Date(currentPlan.endDate)
              endDate.setHours(0, 0, 0, 0)
              const isExpired = today > endDate

              // Check if diagnosis is old (> 14 days)
              const diagDate = diagnosisDate ? new Date(diagnosisDate) : new Date(0)
              const diffTime = Math.abs(today - diagDate)
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
              const isDiagnosisOld = diffDays > 14

              if (isExpired) {
                return (
                  <Card padding="lg" style={{ border: '2px solid #e5e7eb', background: '#f9fafb', textAlign: 'center' }}>
                    <Trophy size={48} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
                    <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>
                      今週のプランが終了しました
                    </h2>
                    <p style={{ fontSize: '14px', color: '#4a4a4a', marginBottom: '24px' }}>
                      お疲れ様でした！<br />
                      {isDiagnosisOld
                        ? "前回の診断から期間が空いています。再診断を受けて、今の状態に最適な新プランを作成しましょう。"
                        : "継続は力なり。今の状態に合わせて、来週のプランを作成しましょう。"
                      }
                    </p>

                    {isDiagnosisOld ? (
                      <Button onClick={() => router.push('/feature3/tendency')}>
                        再診断を受ける (推奨)
                      </Button>
                    ) : (
                      <Button onClick={handleGeneratePlan} disabled={generatingPlan}>
                        {generatingPlan ? <Loader2 className="animate-spin" /> : "次週のプランを作成する"}
                      </Button>
                    )}
                  </Card>
                )
              }

              return (
                <Card padding="lg" style={{ border: '2px solid #419873', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: '#419873' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: '#e6f4ea', color: '#1e8e3e', fontSize: '12px', fontWeight: '700',
                        padding: '4px 12px', borderRadius: '100px', marginBottom: '8px'
                      }}>
                        <Trophy size={14} /> 今週のテーマ
                      </div>
                      <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1a3d2e' }}>
                        {currentPlan.theme}
                      </h2>
                      <p style={{ fontSize: '13px', color: '#7f786d', marginTop: '4px' }}>
                        期間: {new Date(currentPlan.startDate).toLocaleDateString()} 〜 {new Date(currentPlan.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '32px', fontWeight: '700', color: '#419873' }}>
                        {todayLog.completedActions.length}/{currentPlan.targetActions.length}
                      </div>
                      <div style={{ fontSize: '11px', color: '#7f786d' }}>TODAY'S CLEAR</div>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#4a4a4a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={18} /> 今日のミッション
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {currentPlan.targetActions.map((action) => {
                      const isChecked = todayLog.completedActions.includes(action.id)
                      return (
                        <motion.div
                          key={action.id}
                          layout
                          initial={false}
                          animate={{
                            backgroundColor: isChecked ? '#f0fdf4' : '#fff',
                            borderColor: isChecked ? '#bbf7d0' : '#e5e7eb'
                          }}
                          style={{
                            border: '1px solid', borderRadius: '16px', padding: '16px',
                            display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onClick={() => isChecked ? handleUncheckAction(action.id) : handleCreateCheck(action)}
                        >
                          <div style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            border: isChecked ? 'none' : '2px solid #d1d5db',
                            background: isChecked ? '#419873' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            {isChecked && <CheckCircle size={16} color="#fff" />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: isChecked ? '#15803d' : '#1a3d2e', textDecoration: isChecked ? 'line-through' : 'none' }}>
                              {action.name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#7f786d' }}>
                              {action.duration}
                            </div>
                          </div>
                          <div style={{ fontSize: '24px' }}>{action.emoji}</div>
                        </motion.div>
                      )
                    })}
                  </div>
                </Card>
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
                        return (
                          <Card
                            key={action.id}
                            padding="sm"
                            hoverable
                            onClick={() => setSelectedAction(action)}
                            style={{ ...styles.actionCard, background: '#fafafa' }}
                          >
                            <div style={styles.actionInner}>
                              <div style={{ ...styles.actionEmoji, width: '40px', height: '40px', fontSize: '20px', background: '#fff' }}>{action.emoji}</div>
                              <div style={styles.actionContent}>
                                <div style={styles.actionHeader}>
                                  <div style={{ ...styles.actionName, fontSize: '15px' }}>
                                    {action.name}
                                  </div>
                                  <ChevronRight size={16} color="#e0dcd0" />
                                </div>
                              </div>
                            </div>
                          </Card>
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
        </div>
      </div>
    </Layout>
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
