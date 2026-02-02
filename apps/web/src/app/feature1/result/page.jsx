'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { TrendingUp, AlertCircle, ChevronRight, Sparkles } from 'lucide-react'
import Button from '@/components/Button'
import Card from '@/components/Card'
import ScoreCircle from '@/components/ScoreCircle'
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
    maxWidth: '800px',
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
  scoreSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 0',
  },
  scoreTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '16px',
  },
  comparisonBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.12) 0%, rgba(65, 152, 115, 0.06) 100%)',
    border: '1px solid rgba(65, 152, 115, 0.2)',
    borderRadius: '20px',
    padding: '8px 16px',
    marginTop: '16px',
  },
  comparisonText: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#419873',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
  },
  cardTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '12px',
  },
  scalpStatus: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
  },
  statusLabel: {
    fontSize: '14px',
    color: '#635d54',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  statusGood: {
    color: '#419873',
  },
  statusWarning: {
    color: '#c9a962',
  },
  typeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  typeIconWrapper: {
    width: '56px',
    height: '56px',
    background: 'linear-gradient(135deg, rgba(201, 169, 98, 0.15) 0%, rgba(201, 169, 98, 0.08) 100%)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  typeInfo: {
    flex: 1,
  },
  typeLabel: {
    fontSize: '12px',
    color: '#7f786d',
    marginBottom: '4px',
  },
  typeName: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  typeDescription: {
    fontSize: '12px',
    color: '#635d54',
    marginTop: '4px',
  },
  disclaimer: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    background: 'rgba(201, 169, 98, 0.08)',
    border: '1px solid rgba(201, 169, 98, 0.2)',
    borderRadius: '12px',
    padding: '12px',
  },
  disclaimerIcon: {
    flexShrink: 0,
    marginTop: '2px',
  },
  disclaimerText: {
    fontSize: '12px',
    color: '#7f786d',
    lineHeight: 1.5,
  },
  buttonWrapper: {
    marginTop: 'auto',
    paddingTop: '8px',
    maxWidth: '400px',
    width: '100%',
    alignSelf: 'center',
  },
}

function Result() {
  const router = useRouter()

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
          <h1 style={styles.title}>解析結果</h1>
          <p style={styles.subtitle}>2024年1月28日</p>
        </motion.div>

        {/* Score Section */}
        <motion.div
          style={styles.scoreSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span style={styles.scoreTitle}>髪密度スコア</span>
          <ScoreCircle
            score={72}
            label="良好"
            size={140}
            delay={0.2}
            unit="点"
          />
          <motion.div
            style={styles.comparisonBadge}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            <TrendingUp size={16} color="#419873" />
            <span style={styles.comparisonText}>前回比 +3% 改善</span>
          </motion.div>
        </motion.div>

        {/* Grid for Cards */}
        <div style={styles.gridContainer}>
          {/* Scalp Status Card */}
          <Card variant="default" padding="lg" delay={0.3}>
            <span style={styles.cardTitle}>頭皮状態</span>
            <div style={styles.scalpStatus}>
              <div style={styles.statusRow}>
                <span style={styles.statusLabel}>頭皮の色</span>
                <span style={{ ...styles.statusValue, ...styles.statusGood }}>正常（淡いピンク）</span>
              </div>
              <div style={styles.statusRow}>
                <span style={styles.statusLabel}>毛穴の状態</span>
                <span style={{ ...styles.statusValue, ...styles.statusGood }}>良好</span>
              </div>
              <div style={styles.statusRow}>
                <span style={styles.statusLabel}>皮脂バランス</span>
                <span style={{ ...styles.statusValue, ...styles.statusWarning }}>やや過剰</span>
              </div>
            </div>
          </Card>

          {/* Hair Loss Type Card */}
          <Card variant="default" padding="lg" delay={0.4}>
            <div style={styles.typeCard}>
              <div style={styles.typeIconWrapper}>
                <Sparkles size={24} color="#c9a962" />
              </div>
              <div style={styles.typeInfo}>
                <span style={styles.typeLabel}>薄毛タイプ判定</span>
                <div style={styles.typeName}>II型 vertex</div>
                <span style={styles.typeDescription}>頭頂部から進行するタイプ</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Disclaimer */}
        <motion.div
          style={styles.disclaimer}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <AlertCircle size={16} color="#c9a962" style={styles.disclaimerIcon} />
          <span style={styles.disclaimerText}>
            この判定はAIによる参考情報です。正確な診断については医療機関にご相談ください。
          </span>
        </motion.div>

        {/* Detail Button */}
        <motion.div
          style={styles.buttonWrapper}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Button
            variant="primary"
            size="full"
            icon={<ChevronRight size={18} />}
            iconPosition="right"
            onClick={() => router.push('/feature1/dashboard')}
          >
            詳細を見る
          </Button>
        </motion.div>
        </div>
      </div>
    </Layout>
  )
}

export default Result
