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
import styles from './page.module.css'

// 4軸の表示順序と設定
const AXIS_ORDER = ['hormone', 'circadian', 'blood_flow', 'stress']
const AXIS_CONFIG = {
  hormone: { name: 'ホルモン分泌', icon: Heart, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
  circadian: { name: '体内時計', icon: Activity, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  blood_flow: { name: '血流促進', icon: Droplets, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  stress: { name: 'ストレス管理', icon: Brain, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
}

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
  const [summary, setSummary] = useState(null)

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
      setSummary(data.summary)

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
        <div className={styles.container}>
          <div style={{ ...styles.content, textAlign: 'center', padding: '60px 20px' }}>
            <h2 className={styles.pageTitle}>診断データがありません</h2>
            <p className={styles.introText}>まだライフスタイル傾向分析が行われていないようです。</p>
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
      <div className={styles.container}>
        <div className={styles.content}>
          <motion.h1 className={styles.pageTitle} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
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

          <motion.p className={styles.introText} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            4つのメカニズム軸の分析結果に基づき、<br />
            今のあなたに必要なアクションを全て表示しています。
          </motion.p>

          {summary && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              style={{ marginBottom: '32px' }}
            >
              <Card variant="accent" padding="lg">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '8px', borderRadius: '50%' }}>
                    <Sparkles size={20} color="#f59e0b" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1a3d2e', marginBottom: '4px' }}>AI分析サマリー</h3>
                    <p style={{ fontSize: '14px', color: '#4a4a4a', lineHeight: 1.6, margin: 0 }}>
                      {summary}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

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
                className={styles.axisSection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: axisIndex * 0.1 }}
              >
                {/* Axis Header */}
                <div className={styles.axisHeader}>
                  <div style={{ ...styles.axisIcon, background: config.bg }}>
                    <Icon size={24} color={config.color} />
                  </div>
                  <div>
                    <div className={styles.axisTitle}>{config.name}</div>
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
                      className={styles.actionCard}
                      onClick={() => setSelectedAction(action)}
                    >
                      <div className={styles.actionInner}>
                        <div className={styles.actionEmoji}>{action.emoji}</div>
                        <div className={styles.actionContent}>
                          <div className={styles.actionName}>{action.name}</div>
                          <div className={styles.actionReason}>{action.reason}</div>
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
            className={styles.planCTA}
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
                onClick={() => router.push('/feature3/weekly-plan')}
                icon={<ArrowRight size={18} />}
                iconPosition="right"
              >
                プラン作成へ進む
              </Button>
            )}
          </motion.div>
        </div>
      </div>

      {/* Action Detail Modal */}
      {selectedAction && (
        <div className={styles.modalOverlay} onClick={() => setSelectedAction(null)}>
          <motion.div
            className={styles.modalContent}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className={styles.closeButton} onClick={() => setSelectedAction(null)}>
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

            {(selectedAction.explanation || selectedAction.why) && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>
                  なぜ効果的？
                </h4>
                <p style={{ fontSize: '14px', color: '#4a4a4a', lineHeight: 1.6 }}>
                  {selectedAction.explanation || selectedAction.why}
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
