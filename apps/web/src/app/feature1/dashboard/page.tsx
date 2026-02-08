'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Loader2, AlertCircle } from 'lucide-react'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import { apiFetch } from '@/lib/api'
import { AnalysisHistoryResponse, AnalysisHistoryItem } from '@/types/dashboard'

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
    boxSizing: 'border-box' as const,
  },
  title: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '600',
    color: '#1a3d2e',
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: '14px',
    color: '#7f786d',
    textAlign: 'center' as const,
    marginTop: '4px',
  },
  filterSection: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
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
    textAlign: 'center' as const,
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
    position: 'relative' as const,
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
    position: 'relative' as const,
    overflow: 'hidden',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailOverlay: {
    position: 'absolute' as const,
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
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: '16px',
  },
  loadingText: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    color: '#1a3d2e',
    fontSize: '16px',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
    gap: '16px',
    textAlign: 'center' as const,
    color: '#7f786d',
  },
}

function Dashboard() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState('すべて') // Changed default to show all
  const filters = ['1ヶ月', '3ヶ月', '6ヶ月', 'すべて']

  const [history, setHistory] = useState<AnalysisHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true;

    async function fetchHistory() {
      try {
        setLoading(true);
        const res = await apiFetch("/api/v1/photos/history?limit=20");
        if (!res.ok) throw new Error("履歴の取得に失敗しました");

        const data: AnalysisHistoryResponse = await res.json();
        if (isMounted) {
          setHistory(data.items);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("History fetch error:", err);
          setError("データの読み込みに失敗しました。");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchHistory();
    return () => { isMounted = false };
  }, []);

  // Process data for Chart
  // Reverse history (descending) to ascending for chart
  const chartData = [...history].reverse().map(item => {
    const date = new Date(item.analyzedAt);
    return {
      month: `${date.getMonth() + 1}/${date.getDate()}`, // Format: M/D
      value: item.score,
      original: item
    };
  });

  // Filter logic (Simplified for now, just slicing based on filter count approx)
  // In real app, check date diff.
  const displayChartData = (() => {
    if (chartData.length === 0) return [];
    if (activeFilter === 'すべて') return chartData;
    const count = activeFilter === '1ヶ月' ? 5 : activeFilter === '3ヶ月' ? 10 : 15;
    return chartData.slice(-count);
  })();

  // Generate SVG path
  const chartWidth = 320
  const chartHeight = 160
  const padding = 30
  const maxValue = 100
  const minValue = 0 // Fixed to 0-100 for score consistency

  const points = displayChartData.map((d, i) => {
    const x = padding + (i * (chartWidth - 2 * padding)) / (Math.max(displayChartData.length - 1, 1))
    const y = chartHeight - padding - ((d.value - minValue) / (maxValue - minValue)) * (chartHeight - 2 * padding)
    return { x, y, value: d.value }
  })

  // Safe path generation for 0 or 1 point
  const linePath = points.length > 1
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : points.length === 1
      ? `M ${points[0].x - 5} ${points[0].y} L ${points[0].x + 5} ${points[0].y}` // Small dash for single point
      : '';

  const areaPath = points.length > 1
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`
    : '';

  if (loading) {
    return (
      <Layout>
        <div style={styles.container}>
          <div style={styles.loadingContainer}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 size={32} color="#c9a962" />
            </motion.div>
            <div style={styles.loadingText}>データを読み込み中...</div>
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

          {history.length === 0 && !error ? (
            <div style={styles.emptyContainer}>
              <p>まだ記録がありません。</p>
              <Button variant="primary" onClick={() => router.push('/feature1/capture')}>
                最初の診断をする
              </Button>
            </div>
          ) : (
            <>
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
                    {[20, 40, 60, 80].map((value) => {
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

                    {points.length > 0 && (
                      <>
                        {/* Area fill */}
                        {areaPath && (
                          <motion.path
                            d={areaPath}
                            fill="url(#chartGradient)"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.4 }}
                          />
                        )}

                        {/* Line */}
                        {linePath && (
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
                        )}

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
                      </>
                    )}
                  </svg>
                </div>
                <div style={styles.chartLabels}>
                  {displayChartData.map((d, i) => (
                    // Show only first, middle, last labels if too many
                    (displayChartData.length < 6 || i === 0 || i === displayChartData.length - 1 || i === Math.floor(displayChartData.length / 2)) ? (
                      <span key={i} style={styles.chartLabel}>{d.month}</span>
                    ) : <span key={i}></span>
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
                  {history.map((item, i) => {
                    const date = new Date(item.analyzedAt);
                    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
                    return (
                      <motion.div
                        key={item.analysisId}
                        style={styles.thumbnail}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => alert(`Analysis ID: ${item.analysisId} selected`)} // Placeholder
                      >
                        <div style={styles.silhouetteCircle} />
                        {/* TODO: Display real image if available */}
                        <div style={styles.thumbnailOverlay}>
                          <div style={styles.thumbnailDate}>{dateStr}</div>
                          <div style={styles.thumbnailScore}>{item.score}点</div>
                        </div>
                      </motion.div>
                    );
                  })}
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
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default Dashboard
