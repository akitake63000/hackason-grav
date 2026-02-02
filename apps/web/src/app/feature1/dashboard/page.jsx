'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Layout from '@/components/Layout'

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
}

const chartData = [
  { month: '8月', value: 65 },
  { month: '9月', value: 67 },
  { month: '10月', value: 66 },
  { month: '11月', value: 69 },
  { month: '12月', value: 70 },
  { month: '1月', value: 72 },
]

const thumbnails = [
  { date: '1/28', score: 72 },
  { date: '12/28', score: 70 },
  { date: '11/28', score: 69 },
  { date: '10/28', score: 66 },
  { date: '9/28', score: 67 },
  { date: '8/28', score: 65 },
]

function Dashboard() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState('6ヶ月')
  const filters = ['1ヶ月', '3ヶ月', '6ヶ月']

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

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding} L ${padding} ${chartHeight - padding} Z`

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
                key={i}
                style={styles.thumbnail}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <div style={styles.silhouetteCircle} />
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
