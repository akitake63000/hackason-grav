'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, Lightbulb, Calendar, Share2, FileText, AlertCircle } from 'lucide-react'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import { apiFetch } from '@/lib/api'

// Backend response type
interface ReportGenerateResponse {
  reportId: string;
  highlights: string[];
  nextActions: string[];
  rawText: string;
  period?: {
    from: string;
    to: string;
    days: number;
  };
  createdAt?: string;
}

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '24px',
    gap: '20px',
    maxWidth: '800px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
  },
  title: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '600' as const,
    color: '#1a3d2e',
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: '14px',
    color: '#7f786d',
    textAlign: 'center' as const,
    marginTop: '4px',
  },
  reportHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '16px',
    border: '1px solid rgba(26, 61, 46, 0.08)',
  },
  aiIcon: {
    width: '48px',
    height: '48px',
    background: 'linear-gradient(135deg, #c9a962 0%, #e8d9a8 100%)',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(201, 169, 98, 0.25)',
  },
  reportHeaderText: {
    flex: 1,
  },
  reportTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '18px',
    fontWeight: '600' as const,
    color: '#1a3d2e',
    marginBottom: '4px',
  },
  reportDate: {
    fontSize: '12px',
    color: '#7f786d',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  sectionIconWrapper: {
    width: '32px',
    height: '32px',
    background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.12) 0%, rgba(65, 152, 115, 0.06) 100%)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '16px',
    fontWeight: '600' as const,
    color: '#1a3d2e',
  },
  reportText: {
    fontSize: '14px',
    lineHeight: 1.8,
    color: '#4a4540',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
  },
  highlightText: {
    color: '#1a3d2e',
    fontWeight: '600',
    background: 'linear-gradient(180deg, transparent 60%, rgba(201, 169, 98, 0.2) 60%)',
    padding: '0 2px',
  },
  positiveText: {
    color: '#419873',
    fontWeight: '600',
  },
  bulletList: {
    margin: '12px 0 0 0',
    padding: '0 0 0 20px',
  },
  bulletItem: {
    fontSize: '14px',
    lineHeight: 1.8,
    color: '#4a4540',
    marginBottom: '4px',
  },
  tipCard: {
    background: 'linear-gradient(135deg, rgba(201, 169, 98, 0.1) 0%, rgba(201, 169, 98, 0.05) 100%)',
    border: '1px solid rgba(201, 169, 98, 0.2)',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    gap: '12px',
  },
  tipIcon: {
    width: '40px',
    height: '40px',
    background: 'linear-gradient(135deg, #c9a962 0%, #e8d9a8 100%)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '6px',
  },
  tipText: {
    fontSize: '13px',
    color: '#635d54',
    lineHeight: 1.6,
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: 'auto',
    paddingTop: '8px',
    maxWidth: '500px',
    width: '100%',
    alignSelf: 'center',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  buttonSecondary: {
    flex: '1 1 120px',
    minWidth: '120px',
  },
  buttonPrimary: {
    flex: '2 1 200px',
    minWidth: '200px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: '16px',
  },
  errorContainer: {
    padding: '24px',
    textAlign: 'center' as const,
    background: 'rgba(184, 84, 80, 0.05)',
    borderRadius: '16px',
    border: '1px solid rgba(184, 84, 80, 0.1)',
  },
}

function Report() {
  const [data, setData] = useState<ReportGenerateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchReport = async () => {
      try {
        // Default period of 30 days
        const response = await apiFetch('/api/v1/reports/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ periodDays: 30 }),
        })

        if (!response.ok) {
          throw new Error('レポートの生成に失敗しました')
        }

        const reportData: ReportGenerateResponse = await response.json()
        setData(reportData)
      } catch (err) {
        console.error('Failed to generate report:', err)
        setError('レポートの取得中にエラーが発生しました。しばらく経ってから再度お試しください。')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [])

  if (loading) {
    return (
      <Layout>
        <div style={styles.container}>
          <div style={styles.loadingContainer}>
            <div className="animate-pulse">
              <Sparkles size={48} color="#c9a962" />
            </div>
            <div style={{ color: '#7f786d', fontSize: '14px', marginTop: '16px' }}>
              AIがあなたのデータを分析中...
            </div>
            <div style={{ color: '#7f786d', fontSize: '12px', opacity: 0.8 }}>
              過去30日間の進捗を確認しています
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div style={styles.container}>
          <div style={styles.content}>
            <div style={styles.errorContainer}>
              <AlertCircle size={32} color="#b85450" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: '#b85450', marginBottom: '8px' }}>{error}</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // Format date if available, otherwise use today
  const reportDate = data?.createdAt
    ? new Date(data.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.content}>
          {/* Title Section */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 style={styles.title}>AIレポート</h1>
            <p style={styles.subtitle}>詳細分析</p>
          </motion.div>

          {/* Report Header */}
          <motion.div
            style={styles.reportHeader}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div style={styles.aiIcon}>
              <Sparkles size={24} color="#1a3d2e" />
            </div>
            <div style={styles.reportHeaderText}>
              <div style={styles.reportTitle}>月間分析レポート</div>
              <div style={styles.reportDate}>
                <Calendar size={12} />
                {reportDate} 生成
              </div>
            </div>
          </motion.div>

          {/* Grid for Cards */}
          <div style={styles.gridContainer}>
            {/* Summary/Highlights Section */}
            <Card variant="default" padding="lg" delay={0.2} style={{}} onClick={undefined}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionIconWrapper}>
                  <TrendingUp size={16} color="#419873" />
                </div>
                <span style={styles.sectionTitle}>ハイライト</span>
              </div>

              {data?.highlights && data.highlights.length > 0 ? (
                <ul style={styles.bulletList}>
                  {data.highlights.map((highlight, idx) => (
                    <li key={idx} style={styles.bulletItem}>
                      {highlight}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={styles.reportText}>
                  特筆すべき変化はまだ検出されていません。継続的な記録をおすすめします。
                </p>
              )}
            </Card>

            {/* Next Actions / Detail Analysis */}
            <Card variant="default" padding="lg" delay={0.3} style={{}} onClick={undefined}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionIconWrapper}>
                  <Lightbulb size={16} color="#419873" />
                </div>
                <span style={styles.sectionTitle}>次のアクション</span>
              </div>

              {data?.nextActions && data.nextActions.length > 0 ? (
                <ul style={styles.bulletList}>
                  {data.nextActions.map((action, idx) => (
                    <li key={idx} style={styles.bulletItem}>
                      {action}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={styles.reportText}>
                  同じ条件での撮影を続けることで、より詳細なアドバイスが可能になります。
                </p>
              )}
            </Card>
          </div>

          {/* Raw Text Summary (Optional, if available) */}
          {data?.rawText && (
            <motion.div
              style={styles.tipCard}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <div style={styles.tipIcon}>
                <FileText size={20} color="#1a3d2e" />
              </div>
              <div style={styles.tipContent}>
                <div style={styles.tipTitle}>AIアドバイス</div>
                <p style={styles.tipText}>
                  {data.rawText}
                </p>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div
            style={styles.buttonRow}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div style={styles.buttonSecondary}>
              <Button
                variant="secondary"
                size="full"
                icon={<Share2 size={16} />}
                style={{}}
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: '私のAI頭皮レポート',
                      text: `AIによる分析結果: ${data?.highlights?.[0] || '分析完了'}`,
                      url: window.location.href,
                    })
                  }
                }}
              >
                共有
              </Button>
            </div>
            {/* 
          <div style={styles.buttonPrimary}>
            <Button
              variant="primary"
              size="full"
            >
              改善プランを見る
            </Button>
          </div>
           */}
          </motion.div>
        </div>
      </div>
    </Layout>
  )
}

export default Report
