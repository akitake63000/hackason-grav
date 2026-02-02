'use client'

import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, Lightbulb, Calendar, Share2 } from 'lucide-react'
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
    gap: '20px',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    flexWrap: 'wrap',
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
}

function Report() {
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
              2024年1月28日 生成
            </div>
          </div>
        </motion.div>

        {/* Grid for Cards */}
        <div style={styles.gridContainer}>
          {/* Summary Section */}
          <Card variant="default" padding="lg" delay={0.2}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionIconWrapper}>
                <TrendingUp size={16} color="#419873" />
              </div>
              <span style={styles.sectionTitle}>サマリー</span>
            </div>
            <p style={styles.reportText}>
              直近1ヶ月の分析によると、<span style={styles.highlightText}>髪密度は改善傾向</span>にあります。
              特に頭頂部の密度が<span style={styles.positiveText}>+3%向上</span>しています。
              これは過去6ヶ月間で最も大きな改善幅です。
            </p>
          </Card>

          {/* Detail Analysis */}
          <Card variant="default" padding="lg" delay={0.3}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionIconWrapper}>
                <Sparkles size={16} color="#419873" />
              </div>
              <span style={styles.sectionTitle}>詳細分析</span>
            </div>
            <p style={styles.reportText}>
              前回の測定と比較して、以下の点が確認されました：
            </p>
            <ul style={styles.bulletList}>
              <li style={styles.bulletItem}>
                <span style={styles.positiveText}>頭頂部密度</span>：72点（前回69点）
              </li>
              <li style={styles.bulletItem}>
                <span style={styles.highlightText}>頭皮の色</span>：正常な淡いピンク色を維持
              </li>
              <li style={styles.bulletItem}>
                <span style={styles.highlightText}>毛穴状態</span>：詰まりなく良好
              </li>
              <li style={styles.bulletItem}>
                皮脂バランスがやや過剰気味のため、洗髪頻度の見直しを推奨
              </li>
            </ul>
          </Card>
        </div>

        {/* Recommendation Tip */}
        <motion.div
          style={styles.tipCard}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <div style={styles.tipIcon}>
            <Lightbulb size={20} color="#1a3d2e" />
          </div>
          <div style={styles.tipContent}>
            <div style={styles.tipTitle}>今月のおすすめ</div>
            <p style={styles.tipText}>
              現在の改善傾向を維持するため、頭皮マッサージの習慣を継続してください。
              また、皮脂バランス改善には亜鉛を含む食材がおすすめです。
            </p>
          </div>
        </motion.div>

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
            >
              共有
            </Button>
          </div>
          <div style={styles.buttonPrimary}>
            <Button
              variant="primary"
              size="full"
            >
              改善プランを見る
            </Button>
          </div>
        </motion.div>
        </div>
      </div>
    </Layout>
  )
}

export default Report
