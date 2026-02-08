'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { Clock, ChevronRight, Loader2, Target } from 'lucide-react'
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
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  pageTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '600',
    color: '#1a3d2e',
    textAlign: 'center',
    marginBottom: '24px',
  },
  introText: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    color: '#7f786d',
    lineHeight: 1.6,
    textAlign: 'center',
    marginBottom: '32px',
  },
  exerciseGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '20px',
  },
  exerciseCard: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
    cursor: 'pointer',
  },
  exerciseEmoji: {
    width: '60px',
    height: '60px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  },
  exerciseContent: {
    flex: 1,
  },
  exerciseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  exerciseName: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  arrowIcon: {
    color: '#9c958a',
  },
  durationBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    background: 'rgba(201, 169, 98, 0.12)',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#8b7942',
    marginBottom: '8px',
  },
  priorityBadge: {
    display: 'inline-flex',
    padding: '2px 8px',
    borderRadius: '6px',
    fontSize: '10px',
    fontWeight: '700',
    marginLeft: '8px',
    textTransform: 'uppercase',
  },
  exerciseReason: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#419873',
    marginBottom: '4px',
  },
  exerciseEffect: {
    fontSize: '13px',
    color: '#7f786d',
    lineHeight: 1.5,
  },
  targetHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#1a3d2e',
    fontWeight: '600',
    marginTop: '12px',
    marginBottom: '6px',
  },
  targetTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  targetTag: {
    padding: '3px 8px',
    background: 'rgba(65, 152, 115, 0.08)',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '500',
    color: '#1a3d2e',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
}

function ExerciseRecommend() {
  const searchParams = useSearchParams()
  const [recommendations, setRecommendations] = useState([])
  const [axisLabels, setAxisLabels] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  if (loading) {
    return (
      <Layout>
        <div style={styles.loadingContainer}>
          <Loader2 className="animate-spin" size={40} color="#419873" />
          <p style={{ marginTop: '16px', color: '#7f786d' }}>最適な対策を抽出中...</p>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div style={styles.container}>
          <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>
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
            あなたへの最適アクション
          </motion.h1>

          <motion.p
            style={styles.introText}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            分析結果に基づき、今のあなたに最も効果的な<br />
            改善ステップをご提案します
          </motion.p>

          <div style={styles.exerciseGrid}>
            {recommendations.map((action, index) => {
              const priorityColor =
                action.priority === 'high' ? '#e11d48' : action.priority === 'medium' ? '#f59e0b' : '#3b82f6'
              const priorityBg =
                action.priority === 'high'
                  ? 'rgba(225, 29, 72, 0.1)'
                  : action.priority === 'medium'
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'rgba(59, 130, 246, 0.1)'

              return (
                <Card key={action.id} padding="lg" hoverable delay={0.15 + index * 0.1}>
                  <div style={styles.exerciseCard}>
                    <div style={{ ...styles.exerciseEmoji, background: priorityBg }}>{action.emoji}</div>
                    <div style={styles.exerciseContent}>
                      <div style={styles.exerciseHeader}>
                        <span style={styles.exerciseName}>
                          {action.name}
                          <span
                            style={{
                              ...styles.priorityBadge,
                              color: priorityColor,
                              background: priorityBg,
                            }}
                          >
                            {action.priority}
                          </span>
                        </span>
                        <ChevronRight size={18} style={styles.arrowIcon} />
                      </div>

                      <div style={styles.durationBadge}>
                        <Clock size={12} />
                        {action.duration}
                      </div>

                      <p style={styles.exerciseReason}>{action.reason}</p>
                      <p style={styles.exerciseEffect}>{action.explanation}</p>

                      <div style={styles.targetHeader}>
                        <Target size={12} />
                        改善ターゲット
                      </div>
                      <div style={styles.targetTags}>
                        {action.targets.map((tId) => (
                          <span key={tId} style={styles.targetTag}>
                            {axisLabels[tId]?.emoji} {axisLabels[tId]?.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {recommendations.length === 0 && (
            <p style={{ textAlign: 'center', py: '40px', color: '#7f786d' }}>
              現在、特別なアクションは必要ありません。今の習慣を維持しましょう！
            </p>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default ExerciseRecommend
