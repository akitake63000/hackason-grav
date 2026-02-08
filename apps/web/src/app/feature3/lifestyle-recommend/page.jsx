'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { Clock, ChevronRight, Loader2, Target, CheckCircle, Info, Sparkles, X } from 'lucide-react'
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

function LifestyleRecommend() {
  const searchParams = useSearchParams()
  const [recommendations, setRecommendations] = useState([])
  const [axisLabels, setAxisLabels] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAction, setSelectedAction] = useState(null)

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true)
      try {
        const query = new URLSearchParams(searchParams).toString()
        const res = await apiFetch(`/api/v1/lifestyle/recommendation?${query}`)
        if (!res.ok) throw new Error('推奨アクションの取得に失敗しました')
        const data = await res.json()
        setRecommendations(data.actions)
        setAxisLabels(data.axis_labels)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchRecommendations()
  }, [searchParams])

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

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.content}>
          <motion.h1 style={styles.pageTitle} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            生活習慣改善レコメンド
          </motion.h1>

          <motion.p style={styles.introText} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            4つのメカニズム軸の分析結果に基づき、<br />
            今のあなたに最も必要なアクションを提案します。
          </motion.p>

          <div style={styles.actionGrid}>
            {recommendations.map((action, index) => {
              const p = getPriorityInfo(action.priority)
              return (
                <Card
                  key={action.id}
                  padding="md"
                  hoverable
                  delay={0.15 + index * 0.1}
                  onClick={() => setSelectedAction(action)}
                  style={styles.actionCard}
                >
                  <div style={styles.actionInner}>
                    <div style={{ ...styles.actionEmoji, background: p.bg }}>{action.emoji}</div>
                    <div style={styles.actionContent}>
                      <div style={styles.actionHeader}>
                        <div style={styles.actionName}>
                          {action.name}
                          <span style={{ ...styles.priorityBadge, color: p.color, background: p.bg, marginLeft: '8px' }}>
                            {p.lead}
                          </span>
                        </div>
                        <ChevronRight size={18} color="#e0dcd0" />
                      </div>
                      <div style={styles.actionReason}>
                        <Sparkles size={14} />
                        {action.reason}
                      </div>
                      <p style={{ fontSize: '13px', color: '#7f786d', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {action.explanation}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

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

          {recommendations.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ color: '#7f786d' }}>現在、特別な生活習慣の改善アクションは必要ありません。<br />今の素晴らしい習慣を維持しましょう！</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default LifestyleRecommend
