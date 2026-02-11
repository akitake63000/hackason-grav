'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  ChevronRight,
  Loader2,
  X,
  Calendar,
  Sparkles,
  ArrowRight,
  Heart,
  Activity,
  Droplets,
  Brain
} from 'lucide-react'
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
  axisSection: {
    marginBottom: '32px',
  },
  axisHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.8)',
    borderRadius: '16px',
    border: '1px solid #e0dcd0',
  },
  axisIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  axisTitle: {
    fontFamily: "'Noto Serif JP', serif",
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  axisScore: {
    marginLeft: 'auto',
    fontSize: '24px',
    fontWeight: '700',
  },
  actionCard: {
    cursor: 'pointer',
    marginBottom: '12px',
    transition: 'transform 0.2s ease',
  },
  actionInner: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  actionEmoji: {
    fontSize: '24px',
    width: '40px',
    textAlign: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '2px',
  },
  actionReason: {
    fontSize: '12px',
    color: '#7f786d',
  },
  priorityBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '99px',
    textTransform: 'uppercase',
  },
  // Modal
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
    borderRadius: '24px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '80vh',
    overflowY: 'auto',
    padding: '32px 24px',
    position: 'relative',
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
  // Plan CTA section
  planCTA: {
    marginTop: '48px',
    textAlign: 'center',
    padding: '32px 24px',
    background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.05) 0%, rgba(245, 158, 11, 0.05) 100%)',
    borderRadius: '24px',
    border: '1px solid rgba(65, 152, 115, 0.2)',
  },
}

const AXIS_CONFIG = {
  hormone: { icon: Heart, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', name: 'ホルモンバランス' },
  circadian: { icon: Activity, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', name: '体内時計' },
  blood_flow: { icon: Droplets, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', name: '血流' },
  stress: { icon: Brain, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', name: 'ストレス' },
}

const AXIS_ORDER = ['hormone', 'circadian', 'blood_flow', 'stress']

function LifestyleRecommendContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [recommendations, setRecommendations] = useState({})
  const [axisLabels, setAxisLabels] = useState({})
  const [scores, setScores] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [diagnosisDate, setDiagnosisDate] = useState(null)
  const [selectedAction, setSelectedAction] = useState(null)
  const [hasPlan, setHasPlan] = useState(false)
  const [generatingPlan, setGeneratingPlan] = useState(false)

  useEffect(() => {
    fetchData()
  }, [searchParams])

  const fetchData = async () => {
    setLoading(true)
    try {
      let query = new URLSearchParams(searchParams).toString()
      let fetchedScores = {}

      // Get tendency data if no query params
      if (!query) {
        const tendencyRes = await apiFetch('/api/v1/lifestyle/tendency/latest')
        if (!tendencyRes.ok) {
          if (tendencyRes.status === 404) throw new Error('NO_DATA')
          throw new Error('Failed to fetch tendency')
        }
        const tendencyData = await tendencyRes.json()
        fetchedScores = tendencyData.scores
        if (tendencyData.updatedAt) {
          setDiagnosisDate(tendencyData.updatedAt)
        }
        query = `hormone=${fetchedScores.hormone}&circadian=${fetchedScores.circadian}&blood_flow=${fetchedScores.blood_flow}&stress=${fetchedScores.stress}`
        setScores(fetchedScores)
      } else {
        // Parse from URL
        const params = new URLSearchParams(query)
        fetchedScores = {
          hormone: parseInt(params.get('hormone')) || 0,
          circadian: parseInt(params.get('circadian')) || 0,
          blood_flow: parseInt(params.get('blood_flow')) || 0,
          stress: parseInt(params.get('stress')) || 0,
        }
        setScores(fetchedScores)
      }

      // Get recommendations and plan status in parallel
      const [recRes, planRes] = await Promise.all([
        apiFetch(`/api/v1/lifestyle/recommendation?${query}`),
        apiFetch('/api/v1/lifestyle/plan/current'),
      ])

      if (!recRes.ok) throw new Error('推奨アクションの取得に失敗しました')
      const data = await recRes.json()
      setRecommendations(data.grouped_actions || {})
      setAxisLabels(data.axis_labels)

      // Check if plan exists and is active
      if (planRes.ok) {
        const planData = await planRes.json()

        let isActive = !!planData.planId
        if (isActive && planData.endDate) {
          const end = new Date(planData.endDate)
          const now = new Date()
          if (now > end) {
            isActive = false
          }
        }
        setHasPlan(isActive)
      }

    } catch (err) {
      setError(err.message === 'NO_DATA' ? '診断データがありません' : err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePlan = async () => {
    setGeneratingPlan(true)
    try {
      const res = await apiFetch('/api/v1/lifestyle/plan/generate', { method: 'POST' })
      if (res.ok) {
        // Navigate to weekly plan page
        router.push('/feature3/weekly-plan')
      } else {
        const errorData = await res.json()
        console.error("Plan generation failed:", errorData)
        alert(`プラン作成に失敗しました: ${errorData.detail || '不明なエラー'}`)
      }
    } catch (e) {
      console.error("Failed to generate plan request:", e)
      alert(`プラン作成に失敗しました: ${e.message}`)
    } finally {
      setGeneratingPlan(false)
    }
  }

  const getPriorityInfo = (priority) => {
    switch (priority) {
      case 'high':
        return { color: '#e11d48', bg: 'rgba(225, 29, 72, 0.1)', label: '最優先' }
      case 'medium':
        return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', label: '推奨' }
      default:
        return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', label: '継続' }
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
            <Button onClick={() => router.push('/feature3/tendency')}>
              傾向分析を始める
            </Button>
          </div>
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
            今のあなたに必要なアクションを全て表示しています。
          </motion.p>

          {/* 4-Axis Recommendations */}
          {AXIS_ORDER.map((axisKey, axisIndex) => {
            const actions = recommendations[axisKey] || []
            const config = AXIS_CONFIG[axisKey]
            const axisScore = scores[axisKey] || 0
            const Icon = config.icon

            if (actions.length === 0) return null

            return (
              <motion.div
                key={axisKey}
                style={styles.axisSection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: axisIndex * 0.1 }}
              >
                {/* Axis Header */}
                <div style={styles.axisHeader}>
                  <div style={{ ...styles.axisIcon, background: config.bg }}>
                    <Icon size={24} color={config.color} />
                  </div>
                  <div>
                    <div style={styles.axisTitle}>{config.name}</div>
                    <div style={{ fontSize: '12px', color: '#7f786d' }}>
                      {actions.length}件のアクション
                    </div>
                  </div>
                  <div style={{ ...styles.axisScore, color: config.color }}>
                    {axisScore}<span style={{ fontSize: '14px' }}>pts</span>
                  </div>
                </div>

                {/* Actions */}
                {actions.map((action, actionIndex) => {
                  const priority = getPriorityInfo(action.priority)
                  return (
                    <Card
                      key={action.id}
                      style={styles.actionCard}
                      onClick={() => setSelectedAction(action)}
                    >
                      <div style={styles.actionInner}>
                        <div style={styles.actionEmoji}>{action.emoji}</div>
                        <div style={styles.actionContent}>
                          <div style={styles.actionName}>{action.name}</div>
                          <div style={styles.actionReason}>{action.reason}</div>
                        </div>
                        <span style={{
                          ...styles.priorityBadge,
                          color: priority.color,
                          background: priority.bg,
                        }}>
                          {priority.label}
                        </span>
                        <ChevronRight size={18} color="#9ca3af" />
                      </div>
                    </Card>
                  )
                })}
              </motion.div>
            )
          })}

          {/* AI Plan Creation CTA */}
          <motion.div
            style={styles.planCTA}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Sparkles size={40} color="#f59e0b" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>
              AI週間プランを作成する
            </h2>
            <p style={{ fontSize: '14px', color: '#7f786d', marginBottom: '24px', lineHeight: 1.6 }}>
              あなたの診断結果に基づき、<br />
              今週取り組むべき「3つの重点アクション」をAIが選定します。
            </p>

            {hasPlan ? (
              <Button
                onClick={() => router.push('/feature3/weekly-plan')}
                icon={<ArrowRight size={18} />}
                iconPosition="right"
              >
                週間プランを確認する
              </Button>
            ) : (
              <Button
                onClick={handleGeneratePlan}
                disabled={generatingPlan}
                icon={generatingPlan ? <Loader2 className="animate-spin" size={18} /> : <Calendar size={18} />}
              >
                {generatingPlan ? '作成中...' : 'プランを作成する'}
              </Button>
            )}
          </motion.div>
        </div>
      </div>

      {/* Action Detail Modal */}
      {selectedAction && (
        <div style={styles.modalOverlay} onClick={() => setSelectedAction(null)}>
          <motion.div
            style={styles.modalContent}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button style={styles.closeButton} onClick={() => setSelectedAction(null)}>
              <X size={20} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>{selectedAction.emoji}</div>
              <h3 style={{ fontSize: '22px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>
                {selectedAction.name}
              </h3>
              <p style={{ fontSize: '14px', color: '#419873', fontWeight: '600' }}>
                {selectedAction.reason}
              </p>
            </div>

            {selectedAction.why && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>
                  なぜ効果的？
                </h4>
                <p style={{ fontSize: '14px', color: '#4a4a4a', lineHeight: 1.6 }}>
                  {selectedAction.why}
                </p>
              </div>
            )}

            {selectedAction.how && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>
                  実践方法
                </h4>
                <p style={{ fontSize: '14px', color: '#4a4a4a', lineHeight: 1.6 }}>
                  {selectedAction.how}
                </p>
              </div>
            )}

            {selectedAction.tips && (
              <div style={{ background: 'rgba(65, 152, 115, 0.05)', padding: '16px', borderRadius: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#419873', marginBottom: '8px' }}>
                  💡 ワンポイント
                </h4>
                <p style={{ fontSize: '14px', color: '#4a4a4a', lineHeight: 1.6 }}>
                  {selectedAction.tips}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </Layout>
  )
}

// Loading fallback
function LifestyleRecommendFallback() {
  return (
    <Layout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Loader2 className="animate-spin" size={40} color="#419873" />
      </div>
    </Layout>
  )
}

// Main component with Suspense
export default function LifestyleRecommend() {
  return (
    <Suspense fallback={<LifestyleRecommendFallback />}>
      <LifestyleRecommendContent />
    </Suspense>
  )
}
