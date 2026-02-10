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
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
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
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.errorContainer}>
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
      <div className={styles.container}>
        <div className={styles.content}>
          {/* Title Section */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className={styles.title}>AIレポート</h1>
            <p className={styles.subtitle}>詳細分析</p>
          </motion.div>

          {/* Report Header */}
          <motion.div
            className={styles.reportHeader}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className={styles.aiIcon}>
              <Sparkles size={24} color="#1a3d2e" />
            </div>
            <div className={styles.reportHeaderText}>
              <div className={styles.reportTitle}>月間分析レポート</div>
              <div className={styles.reportDate}>
                <Calendar size={12} />
                {reportDate} 生成
              </div>
            </div>
          </motion.div>

          {/* Grid for Cards */}
          <div className={styles.gridContainer}>
            {/* Summary/Highlights Section */}
            <Card variant="default" padding="lg" delay={0.2} onClick={undefined}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrapper}>
                  <TrendingUp size={16} color="#419873" />
                </div>
                <span className={styles.sectionTitle}>ハイライト</span>
              </div>

              {data?.highlights && data.highlights.length > 0 ? (
                <ul className={styles.bulletList}>
                  {data.highlights.map((highlight, idx) => (
                    <li key={idx} className={styles.bulletItem}>
                      {highlight}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.reportText}>
                  特筆すべき変化はまだ検出されていません。継続的な記録をおすすめします。
                </p>
              )}
            </Card>

            {/* Next Actions / Detail Analysis */}
            <Card variant="default" padding="lg" delay={0.3} onClick={undefined}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrapper}>
                  <Lightbulb size={16} color="#419873" />
                </div>
                <span className={styles.sectionTitle}>次のアクション</span>
              </div>

              {data?.nextActions && data.nextActions.length > 0 ? (
                <ul className={styles.bulletList}>
                  {data.nextActions.map((action, idx) => (
                    <li key={idx} className={styles.bulletItem}>
                      {action}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.reportText}>
                  同じ条件での撮影を続けることで、より詳細なアドバイスが可能になります。
                </p>
              )}
            </Card>
          </div>

          {/* Raw Text Summary (Optional, if available) */}
          {data?.rawText && (
            <motion.div
              className={styles.tipCard}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <div className={styles.tipIcon}>
                <FileText size={20} color="#1a3d2e" />
              </div>
              <div className={styles.tipContent}>
                <div className={styles.tipTitle}>AIアドバイス</div>
                <p className={styles.tipText}>
                  {data.rawText}
                </p>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div
            className={styles.buttonRow}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className={styles.buttonSecondary}>
              <Button
                variant="secondary"
                size="full"
                icon={<Share2 size={16} />}
               
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
          <div className={styles.buttonPrimary}>
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
