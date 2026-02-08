'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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
    overflowX: 'hidden',
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
    height: '220px',
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  chartSvg: {
    width: '100%',
    height: '100%',
  },
  thumbnailGrid: {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    paddingBottom: '8px',
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(65, 152, 115, 0.3) rgba(0, 0, 0, 0.1)',
  },
  thumbnail: {
    minWidth: '100px',
    width: '100px',
    height: '100px',
    flexShrink: 0,
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
  const [allData, setAllData] = useState([]) // Store all fetched data
  const [chartData, setChartData] = useState([])
  const [thumbnails, setThumbnails] = useState([])
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const filters = ['1ヶ月', '3ヶ月', '6ヶ月']

  // Memoize navigation handler
  const handleThumbnailClick = useCallback((photoId) => {
    router.push(`/feature1/result?photoId=${photoId}`)
  }, [router])

  const handleCaptureClick = useCallback(() => {
    router.push('/feature1/capture')
  }, [router])

  // Fetch data from API
  useEffect(() => {
    const auth = getFirebaseAuth()

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.replace('/login')
        return
      }

      try {
        setLoading(true)

        // First, fetch initial 50 items for fast initial render
        console.log('[Dashboard] Fetching initial 50 items...')
        const initialResponse = await apiFetch('/api/v1/photos/analysis-history?limit=50', {
          method: 'GET',
        })

        if (!initialResponse.ok) {
          console.error('[Dashboard] Response not OK:', initialResponse.status)
          throw new Error('データの取得に失敗しました')
        }

        const initialData = await initialResponse.json()
        console.log('[Dashboard] Initial data received:', initialData.items?.length, 'items')

        // If no data, show empty state
        if (initialData.items.length === 0) {
          console.log('[Dashboard] No items found, showing empty state')
          setAllData([])
          setChartData([])
          setThumbnails([])
          setLoading(false)
          return
        }

        // Store initial data and show UI immediately
        setAllData(initialData.items)
        setLoading(false)

        // Then, fetch remaining data in background
        console.log('[Dashboard] Fetching remaining 150 items in background...')
        const fullResponse = await apiFetch('/api/v1/photos/analysis-history?limit=200', {
          method: 'GET',
        })

        if (fullResponse.ok) {
          const fullData = await fullResponse.json()
          console.log('[Dashboard] Full data received:', fullData.items?.length, 'items')
          setAllData(fullData.items)
        }
      } catch (err) {
        console.error('[Dashboard] Error caught:', err)
        console.error('[Dashboard] Error details - statusCode:', err?.statusCode, 'code:', err?.code)
        // Handle 404 (no analysis history yet) as empty state without console error
        if (err?.statusCode === 404 || err?.code === 'NOT_FOUND') {
          console.log('[Dashboard] 404 error, showing empty state')
          setAllData([])
          setChartData([])
          setThumbnails([])
        } else {
          console.error('[Dashboard] Other error, showing empty state:', err.message)
          // Treat other errors as empty state too
          setAllData([])
          setChartData([])
          setThumbnails([])
        }
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  // Memoize filtered and transformed data for performance
  const { chartData: memoizedChartData, thumbnails: memoizedThumbnails } = useMemo(() => {
    if (allData.length === 0) {
      return { chartData: [], thumbnails: [] }
    }

    // Calculate date threshold based on active filter
    const now = new Date()
    const monthsToShow = activeFilter === '1ヶ月' ? 1 : activeFilter === '3ヶ月' ? 3 : 6

    // Calculate threshold date by subtracting months
    const thresholdDate = new Date(now)
    thresholdDate.setMonth(thresholdDate.getMonth() - monthsToShow)

    // Filter data by date range
    const filteredByDate = allData.filter(item => {
      const itemDate = new Date(item.analyzedAt || item.capturedAt)
      return itemDate >= thresholdDate
    })

    // Group by date (YYYY-MM-DD) and keep only the latest entry per day
    const groupedByDate = {}
    filteredByDate.forEach(item => {
      const itemDate = new Date(item.analyzedAt || item.capturedAt)
      const dateKey = itemDate.toISOString().split('T')[0] // YYYY-MM-DD

      if (!groupedByDate[dateKey] ||
          new Date(item.analyzedAt || item.capturedAt) > new Date(groupedByDate[dateKey].analyzedAt || groupedByDate[dateKey].capturedAt)) {
        groupedByDate[dateKey] = item
      }
    })

    // Convert back to array and sort by date (newest first)
    const filteredItems = Object.values(groupedByDate).sort((a, b) => {
      const dateA = new Date(a.analyzedAt || a.capturedAt)
      const dateB = new Date(b.analyzedAt || b.capturedAt)
      return dateB - dateA
    })

    console.log(`[Dashboard] Filtered to ${filteredItems.length} unique days for ${activeFilter} (from ${filteredByDate.length} total items)`)

    // Sample data for chart to keep it readable
    // Target: ~30-40 points for readability
    const targetPoints = monthsToShow === 1 ? filteredItems.length : 30
    const sampleInterval = Math.max(1, Math.floor(filteredItems.length / targetPoints))

    const chartItems = filteredItems
      .filter((_, index) => index % sampleInterval === 0)
      .reverse() // Oldest first for chart

    console.log(`[Dashboard] Sampled ${chartItems.length} points for chart (from ${filteredItems.length}, interval: ${sampleInterval})`)

    const transformedChartData = chartItems.map(item => {
      const date = new Date(item.analyzedAt || item.capturedAt)
      const label = `${date.getMonth() + 1}/${date.getDate()}`
      return {
        month: label,
        value: item.score,
        date: date,
        fullDate: date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
      }
    })

    // Transform data for thumbnails - show all items in filtered period (newest first)
    const transformedThumbnails = filteredItems.map(item => {
      const date = new Date(item.analyzedAt || item.capturedAt)
      const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`
      return {
        date: formattedDate,
        score: Math.round(item.score),
        photoId: item.photoId,
        downloadUrl: item.downloadUrl,
      }
    })

    return { chartData: transformedChartData, thumbnails: transformedThumbnails }
  }, [allData, activeFilter])

  // Update state when memoized data changes
  useEffect(() => {
    setChartData(memoizedChartData)
    setThumbnails(memoizedThumbnails)
  }, [memoizedChartData, memoizedThumbnails])

  // Generate SVG path for the chart - using viewBox for responsiveness
  const chartWidth = 450
  const chartHeight = 180
  const paddingTop = 20
  const paddingBottom = 35
  const paddingLeft = 20
  const paddingRight = 20
  const maxValue = 100
  const minValue = 50

  // Memoize chart calculations for performance
  const { points, axisLabels, linePath, areaPath } = useMemo(() => {
    const calculatedPoints = chartData.map((d, i) => {
      const x = paddingLeft + (i * (chartWidth - paddingLeft - paddingRight)) / Math.max(chartData.length - 1, 1)
      const y = paddingTop + ((maxValue - d.value) / (maxValue - minValue)) * (chartHeight - paddingTop - paddingBottom)
      return { x, y, value: d.value, date: d.fullDate }
    })

    // Calculate period start and end dates for X-axis labels
    const calculateAxisLabels = () => {
      if (chartData.length === 0) return []

      const now = new Date()
      const monthsToShow = activeFilter === '1ヶ月' ? 1 : activeFilter === '3ヶ月' ? 3 : 6
      const startDate = new Date(now)
      startDate.setMonth(startDate.getMonth() - monthsToShow)

      const labels = [
        { text: `${startDate.getMonth() + 1}/${startDate.getDate()}`, position: paddingLeft }
      ]

      // Add middle markers for 3 and 6 months
      if (monthsToShow === 3) {
        const midDate1 = new Date(startDate)
        midDate1.setMonth(midDate1.getMonth() + 1)
        const midDate2 = new Date(startDate)
        midDate2.setMonth(midDate2.getMonth() + 2)
        labels.push({ text: `${midDate1.getMonth() + 1}/${midDate1.getDate()}`, position: paddingLeft + (chartWidth - paddingLeft - paddingRight) / 3 })
        labels.push({ text: `${midDate2.getMonth() + 1}/${midDate2.getDate()}`, position: paddingLeft + (chartWidth - paddingLeft - paddingRight) * 2 / 3 })
      } else if (monthsToShow === 6) {
        // For 6 months, show markers at 2-month intervals to avoid overcrowding
        for (let i = 2; i < 6; i += 2) {
          const midDate = new Date(startDate)
          midDate.setMonth(midDate.getMonth() + i)
          labels.push({
            text: `${midDate.getMonth() + 1}/${midDate.getDate()}`,
            position: paddingLeft + (chartWidth - paddingLeft - paddingRight) * i / 6
          })
        }
      }

      labels.push({ text: `${now.getMonth() + 1}/${now.getDate()}`, position: chartWidth - paddingRight })

      return labels
    }

    const calculatedAxisLabels = calculateAxisLabels()

    // Generate SVG paths
    let calculatedLinePath = ''
    let calculatedAreaPath = ''

    if (chartData.length > 0 && calculatedPoints.length > 0) {
      calculatedLinePath = calculatedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
      calculatedAreaPath = `${calculatedLinePath} L ${calculatedPoints[calculatedPoints.length - 1].x} ${chartHeight - paddingBottom} L ${paddingLeft} ${chartHeight - paddingBottom} Z`
    }

    return {
      points: calculatedPoints,
      axisLabels: calculatedAxisLabels,
      linePath: calculatedLinePath,
      areaPath: calculatedAreaPath
    }
  }, [chartData, activeFilter, chartWidth, chartHeight, paddingTop, paddingBottom, paddingLeft, paddingRight, maxValue, minValue])

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
                onClick={handleCaptureClick}
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
      <style jsx>{`
        .thumbnail-scroll::-webkit-scrollbar {
          height: 8px;
        }
        .thumbnail-scroll::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
        }
        .thumbnail-scroll::-webkit-scrollbar-thumb {
          background: rgba(65, 152, 115, 0.3);
          border-radius: 4px;
        }
        .thumbnail-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(65, 152, 115, 0.5);
        }
      `}</style>
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
        <Card variant="default" padding="md" delay={0.2}>
          <span style={styles.sectionTitle}>髪密度推移</span>
          <div style={styles.chartContainer}>
            <svg style={styles.chartSvg} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet" overflow="hidden">
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
                const y = paddingTop + ((maxValue - value) / (maxValue - minValue)) * (chartHeight - paddingTop - paddingBottom)
                return (
                  <g key={value}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={chartWidth - paddingRight}
                      y2={y}
                      stroke="#ebe8e3"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                    <text
                      x={paddingLeft - 5}
                      y={y + 3}
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

              {/* Data points with hover areas */}
              {points.map((point, i) => (
                <g key={i}>
                  {/* Invisible larger circle for easier hovering */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="12"
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(i)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* Visible data point */}
                  <motion.circle
                    cx={point.x}
                    cy={point.y}
                    r={hoveredPoint === i ? 6 : 5}
                    fill="#ffffff"
                    stroke="#419873"
                    strokeWidth="2"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Tooltip */}
                  {hoveredPoint === i && (
                    <g>
                      <rect
                        x={point.x - 30}
                        y={point.y - 40}
                        width="60"
                        height="28"
                        rx="6"
                        fill="rgba(26, 61, 46, 0.95)"
                        style={{ pointerEvents: 'none' }}
                      />
                      <text
                        x={point.x}
                        y={point.y - 28}
                        fontSize="10"
                        fill="#ffffff"
                        textAnchor="middle"
                        style={{ pointerEvents: 'none' }}
                      >
                        {point.date}
                      </text>
                      <text
                        x={point.x}
                        y={point.y - 16}
                        fontSize="11"
                        fill="#c9a962"
                        fontWeight="600"
                        textAnchor="middle"
                        style={{ pointerEvents: 'none' }}
                      >
                        {point.value.toFixed(1)}点
                      </text>
                    </g>
                  )}
                </g>
              ))}

              {/* X-axis labels */}
              {axisLabels.map((label, i) => (
                <text
                  key={i}
                  x={label.position}
                  y={chartHeight - 5}
                  fontSize="10"
                  fill="#7f786d"
                  textAnchor={i === 0 ? "start" : i === axisLabels.length - 1 ? "end" : "middle"}
                >
                  {label.text}
                </text>
              ))}
            </svg>
          </div>
        </Card>

        {/* Photo History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <span style={styles.sectionTitle}>過去の写真</span>
          <div style={styles.thumbnailGrid} className="thumbnail-scroll">
            {thumbnails.map((thumb, i) => (
              <motion.div
                key={thumb.photoId || i}
                style={styles.thumbnail}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: Math.min(0.5 + i * 0.02, 1.5) }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleThumbnailClick(thumb.photoId)}
              >
                {thumb.downloadUrl ? (
                  <img
                    src={thumb.downloadUrl}
                    alt={`Photo from ${thumb.date}`}
                    style={styles.thumbnailImage}
                    loading="lazy"
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
