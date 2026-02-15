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
import styles from './page.module.css'

const LOADING_STEPS = [
  'データを収集中...',
  '進捗を分析中...',
  'チャートを生成中...',
]

function Dashboard() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState('1ヶ月')
  const [loading, setLoading] = useState(true)
  const [allData, setAllData] = useState([]) // Store all fetched data
  const [chartData, setChartData] = useState([])
  const [thumbnails, setThumbnails] = useState([])
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [loadingStep, setLoadingStep] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const filters = ['1ヶ月', '3ヶ月', '6ヶ月']

  // Memoize navigation handler
  const handleThumbnailClick = useCallback((photoId) => {
    router.push(`/feature1/result?photoId=${encodeURIComponent(photoId)}`)
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
        // Handle 404 (no analysis history yet) as empty state
        if (err?.statusCode === 404 || err?.code === 'NOT_FOUND') {
          console.log('[Dashboard] 404 error, showing empty state')
          setAllData([])
          setChartData([])
          setThumbnails([])
        } else {
          console.log('[Dashboard] Other error, showing empty state')
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

  // プログレスバーアニメーション
  useEffect(() => {
    if (!loading) return
    setLoadingStep(0)
    setLoadingProgress(0)
    const progressTimer = setInterval(() => {
      setLoadingProgress((prev) => Math.min(prev + 2, 90))
    }, 200)
    const stepTimer = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1))
    }, 3000)
    return () => {
      clearInterval(progressTimer)
      clearInterval(stepTimer)
    }
  }, [loading])

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

  // Check data availability for each filter period
  const filterAvailability = useMemo(() => {
    if (allData.length === 0) {
      return { '1ヶ月': true, '3ヶ月': false, '6ヶ月': false }
    }

    // Count unique dates in the dataset
    const uniqueDates = new Set()
    allData.forEach(item => {
      const itemDate = new Date(item.analyzedAt || item.capturedAt)
      const dateKey = itemDate.toISOString().split('T')[0]
      uniqueDates.add(dateKey)
    })

    const totalDays = uniqueDates.size

    // Minimum days required for each period
    // 1ヶ月: 20 days, 3ヶ月: 60 days, 6ヶ月: 120 days
    return {
      '1ヶ月': totalDays >= 20,
      '3ヶ月': totalDays >= 60,
      '6ヶ月': totalDays >= 120,
    }
  }, [allData])

  // Generate SVG path for the chart - using viewBox for responsiveness
  const chartWidth = 450
  const chartHeight = 180
  const paddingTop = 20
  const paddingBottom = 35
  const paddingLeft = 35
  const paddingRight = 20
  const maxValue = 100
  const minValue = 0

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
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <div style={{ textAlign: 'center' }}>
              <div className={styles.loadingSpinner}>📊</div>
              <h2 className={styles.loadingTitle}>分析中...</h2>
              <p className={styles.loadingMessage}>過去の進捗を確認しています</p>
              <div className={styles.progressContainer}>
                <motion.div
                  className={styles.progressBar}
                  animate={{ width: `${loadingProgress}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
              <p className={styles.loadingStepText}>
                {LOADING_STEPS[loadingStep]}
              </p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // Show empty state if no data
  if (chartData.length === 0 && thumbnails.length === 0) {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.content}>
            <motion.div
              className={styles.emptyState}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className={styles.emptyStateIcon}>
                <Camera size={48} color="#0693e3" />
              </div>
              <h2 className={styles.emptyStateTitle}>まだ解析結果がありません</h2>
              <p className={styles.emptyStateDescription}>
                まずは写真を撮影して、AIによる髪密度の解析を始めましょう。
              </p>
              <button
                className={styles.emptyStateButton}
                onClick={handleCaptureClick}
              >
                <Camera size={24} />
                スキャン開始
              </button>
            </motion.div>
          </div>
        </div>
      </Layout>
    )
  }

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
          <h1 className={styles.title}>ダッシュボード</h1>
          <p className={styles.subtitle}>進捗トラッキング</p>
        </motion.div>

        {/* Period Filter */}
        <motion.div
          className={styles.filterSection}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {filters.map((filter) => {
            const isAvailable = filterAvailability[filter]
            const isActive = activeFilter === filter

            return (
              <motion.button
                key={filter}
                className={`${styles.filterButton} ${isActive ? styles.filterButtonActive : ''}`}
                onClick={() => isAvailable && setActiveFilter(filter)}
                whileTap={isAvailable ? { scale: 0.97 } : {}}
                disabled={!isAvailable}
                title={!isAvailable ? 'データ準備中' : ''}
              >
                {filter}
              </motion.button>
            )
          })}
        </motion.div>

        {/* Chart Card */}
        <Card variant="default" padding="md" delay={0.2}>
          <span className={styles.sectionTitle}>髪密度推移</span>
          <div className={styles.chartContainer}>
            <svg className={styles.chartSvg} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet" overflow="hidden">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0693e3" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#0693e3" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#313131" />
                  <stop offset="100%" stopColor="#0693e3" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((value) => {
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
                      x={paddingLeft - 8}
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
                    stroke="#0693e3"
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
                        fill="rgba(6, 147, 227, 0.95)"
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
                        fill="#38bdf8"
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
          <span className={styles.sectionTitle}>過去の写真</span>
          <div className={styles.thumbnailGrid}>
            {thumbnails.map((thumb, i) => (
              <motion.div
                key={thumb.photoId || i}
                className={styles.thumbnail}
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
                    className={styles.thumbnailImage}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.silhouetteCircle} />
                )}
                <div className={styles.thumbnailOverlay}>
                  <div className={styles.thumbnailDate}>{thumb.date}</div>
                  <div className={styles.thumbnailScore}>{thumb.score}点</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Report Button */}
        <motion.div
          className={styles.buttonWrapper}
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
