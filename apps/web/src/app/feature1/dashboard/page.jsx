'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FileText, Camera } from 'lucide-react'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import { apiFetch } from '@/lib/api'
import { getFirebaseAuth } from '@/lib/firebase'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '24px',
    maxWidth: '1000px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  title: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '600',
    color: '#1a3d2e',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '14px',
    color: '#7f786d',
    textAlign: 'center',
    marginTop: '4px',
  },
  filterSection: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  filterButton: {
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    color: '#635d54',
    background: 'rgba(255, 255, 255, 0.8)',
    border: '1px solid rgba(26, 61, 46, 0.1)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
    minWidth: '80px',
  },
  filterButtonActive: {
    background: 'linear-gradient(135deg, #1a3d2e 0%, #275c45 100%)',
    color: '#ffffff',
    border: '1px solid #1a3d2e',
    boxShadow: '0 4px 12px rgba(26, 61, 46, 0.2)',
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '12px',
  },
  chartContainer: {
    height: '200px',
    position: 'relative',
    width: '100%',
  },
  chartSvg: {
    width: '100%',
    height: '100%',
  },
  chartLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
    padding: '0 4px',
  },
  chartLabel: {
    fontSize: '11px',
    color: '#7f786d',
  },
  thumbnailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '12px',
  },
  thumbnail: {
    aspectRatio: '1',
    background: 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)',
    borderRadius: '16px',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
    padding: '8px',
  },
  thumbnailDate: {
    fontSize: '10px',
    color: '#ffffff',
    fontWeight: '500',
  },
  thumbnailScore: {
    fontSize: '12px',
    color: '#c9a962',
    fontWeight: '600',
    marginTop: '2px',
  },
  silhouetteCircle: {
    width: '50%',
    height: '60%',
    background: 'radial-gradient(ellipse at center, rgba(80, 80, 80, 0.5) 0%, rgba(40, 40, 40, 0.3) 100%)',
    borderRadius: '50%',
    opacity: 0.7,
  },
  buttonWrapper: {
    marginTop: 'auto',
    paddingTop: '8px',
    maxWidth: '400px',
    width: '100%',
    alignSelf: 'center',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
    color: '#7f786d',
    fontSize: '14px',
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    background: 'rgba(184, 84, 80, 0.08)',
    borderRadius: '16px',
    color: '#b85450',
    fontSize: '14px',
    border: '1px solid rgba(184, 84, 80, 0.2)',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
    gap: '16px',
  },
  emptyStateIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.1) 0%, rgba(65, 152, 115, 0.05) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '40px',
  },
  emptyStateTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a3d2e',
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
  },
  emptyStateDescription: {
    fontSize: '14px',
    color: '#7f786d',
    lineHeight: '1.6',
    maxWidth: '320px',
  },
}

function Dashboard() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState('6ヶ月')
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState([])
  const [thumbnails, setThumbnails] = useState([])
  const filters = ['1ヶ月', '3ヶ月', '6ヶ月']

  useEffect(() => {
    const auth = getFirebaseAuth()

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.replace('/login')
        return
      }

      try {
        setLoading(true)

        const response = await apiFetch('/api/v1/photos/analysis-history?limit=50', {
          method: 'GET',
        })

        // Handle 404 as empty data (no analysis history collection yet)
        if (response.status === 404) {
          setChartData([])
          setThumbnails([])
          setLoading(false)
          return
        }

        if (!response.ok) {
          throw new Error('データの取得に失敗しました')
        }

        const data = await response.json()

        // If no data, show empty state instead of redirecting
        if (data.items.length === 0) {
          setChartData([])
          setThumbnails([])
          setLoading(false)
          return
        }

        // Transform data for chart - get last 6 months
        const chartItems = data.items.slice(0, 6).reverse()
        const transformedChartData = chartItems.map(item => {
          const date = new Date(item.analyzedAt || item.capturedAt)
          const month = `${date.getMonth() + 1}月`
          return {
            month,
            value: item.score,
            date: date,
          }
        })

        // Transform data for thumbnails - get last 6 photos
        const thumbnailItems = data.items.slice(0, 6)
        const transformedThumbnails = thumbnailItems.map(item => {
          const date = new Date(item.analyzedAt || item.capturedAt)
          const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`
          return {
            date: formattedDate,
            score: Math.round(item.score),
            photoId: item.photoId,
            downloadUrl: item.downloadUrl,
          }
        })

        setChartData(transformedChartData)
        setThumbnails(transformedThumbnails)
      } catch (err) {
        console.error('Failed to fetch analysis history:', err)
        // Treat errors as empty state instead of showing error
        setChartData([])
        setThumbnails([])
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  // Generate SVG path for the chart - using viewBox for responsiveness
  const chartWidth = 320
  const chartHeight = 160
  const padding = 30
  const maxValue = 100
  const minValue = 50

  const points = chartData.map((d, i) => {
    const x = padding + (i * (chartWidth - 2 * padding)) / (chartData.length - 1)
    const y = chartHeight - padding - ((d.value - minValue) / (maxValue - minValue)) * (chartHeight - 2 * padding)
    return { x, y, value: d.value }
  })

  // Generate SVG path only if we have data
  let linePath = ''
  let areaPath = ''

  if (chartData.length > 0 && points.length > 0) {
    linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding} L ${padding} ${chartHeight - padding} Z`
  }

  if (loading) {
    return (
      <Layout>
        <div style={styles.container}>
          <div style={styles.loadingContainer}>
            データを読み込んでいます...
          </div>
        </div>
      </Layout>
    )
  }

  // Show empty state if no data
  if (chartData.length === 0 && thumbnails.length === 0) {
    return (
      <Layout>
        <div style={styles.container}>
          <div style={styles.content}>
            <motion.div
              style={styles.emptyState}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div style={styles.emptyStateIcon}>
                <Camera size={40} color="#419873" />
              </div>
              <h2 style={styles.emptyStateTitle}>まだ解析結果がありません</h2>
              <p style={styles.emptyStateDescription}>
                まずは写真を撮影して、AIによる髪密度の解析を始めましょう。
              </p>
              <Button
                variant="primary"
                size="medium"
                icon={<Camera size={18} />}
                onClick={() => router.push('/feature1/capture')}
              >
                写真を撮影する
              </Button>
            </motion.div>
          </div>
        </div>
      </Layout>
    )
  }

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
          <h1 style={styles.title}>ダッシュボード</h1>
          <p style={styles.subtitle}>進捗トラッキング</p>
        </motion.div>

        {/* Period Filter */}
        <motion.div
          style={styles.filterSection}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {filters.map((filter) => (
            <motion.button
              key={filter}
              style={{
                ...styles.filterButton,
                ...(activeFilter === filter ? styles.filterButtonActive : {}),
              }}
              onClick={() => setActiveFilter(filter)}
              whileTap={{ scale: 0.97 }}
            >
              {filter}
            </motion.button>
          ))}
        </motion.div>

        {/* Chart Card */}
        <Card variant="default" padding="lg" delay={0.2}>
          <span style={styles.sectionTitle}>髪密度推移</span>
          <div style={styles.chartContainer}>
            <svg style={styles.chartSvg} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#419873" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#419873" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1a3d2e" />
                  <stop offset="100%" stopColor="#419873" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[60, 70, 80, 90].map((value) => {
                const y = chartHeight - padding - ((value - minValue) / (maxValue - minValue)) * (chartHeight - 2 * padding)
                return (
                  <g key={value}>
                    <line
                      x1={padding}
                      y1={y}
                      x2={chartWidth - padding}
                      y2={y}
                      stroke="#ebe8e3"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                    <text
                      x={padding - 8}
                      y={y + 4}
                      fontSize="10"
                      fill="#7f786d"
                      textAnchor="end"
                    >
                      {value}
                    </text>
                  </g>
                )
              })}

              {/* Area fill */}
              <motion.path
                d={areaPath}
                fill="url(#chartGradient)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              />

              {/* Line */}
              <motion.path
                d={linePath}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
              />

              {/* Data points */}
              {points.map((point, i) => (
                <motion.circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r="5"
                  fill="#ffffff"
                  stroke="#419873"
                  strokeWidth="2"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
                />
              ))}
            </svg>
          </div>
          <div style={styles.chartLabels}>
            {chartData.map((d, i) => (
              <span key={i} style={styles.chartLabel}>{d.month}</span>
            ))}
          </div>
        </Card>

        {/* Photo History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <span style={styles.sectionTitle}>過去の写真</span>
          <div style={styles.thumbnailGrid}>
            {thumbnails.map((thumb, i) => (
              <motion.div
                key={thumb.photoId || i}
                style={styles.thumbnail}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push(`/feature1/result?photoId=${thumb.photoId}`)}
              >
                {thumb.downloadUrl ? (
                  <img
                    src={thumb.downloadUrl}
                    alt={`Photo from ${thumb.date}`}
                    style={styles.thumbnailImage}
                  />
                ) : (
                  <div style={styles.silhouetteCircle} />
                )}
                <div style={styles.thumbnailOverlay}>
                  <div style={styles.thumbnailDate}>{thumb.date}</div>
                  <div style={styles.thumbnailScore}>{thumb.score}点</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Report Button */}
        <motion.div
          style={styles.buttonWrapper}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Button
            variant="primary"
            size="full"
            icon={<FileText size={18} />}
            onClick={() => router.push('/feature1/report')}
          >
            詳細レポートを見る
          </Button>
        </motion.div>
        </div>
      </div>
    </Layout>
  )
}

export default Dashboard
