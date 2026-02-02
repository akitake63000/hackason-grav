'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Dna, Apple, Brain, Heart, Activity, ArrowRight } from 'lucide-react'
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
    maxWidth: '800px',
    margin: '0 auto',
  },
  pageTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '600',
    color: '#1a3d2e',
    textAlign: 'center',
    marginBottom: '24px',
  },
  introCard: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  introTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(18px, 3vw, 22px)',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '12px',
  },
  introText: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    color: '#7f786d',
    lineHeight: 1.6,
  },
  tendencyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '32px',
  },
  tendencyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  iconWrapper: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tendencyContent: {
    flex: 1,
  },
  tendencyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  tendencyName: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  tendencyScore: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    fontWeight: '700',
    color: '#1a3d2e',
  },
  progressBar: {
    height: '10px',
    background: 'rgba(26, 61, 46, 0.1)',
    borderRadius: '100px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '100px',
  },
  actionSection: {
    marginTop: '24px',
  },
}

const tendencies = [
  {
    name: '遺伝性',
    score: 65,
    icon: Dna,
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.12)',
    gradientFrom: '#8b5cf6',
    gradientTo: '#a78bfa',
  },
  {
    name: '栄養不足',
    score: 40,
    icon: Apple,
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    gradientFrom: '#10b981',
    gradientTo: '#34d399',
  },
  {
    name: 'ストレス',
    score: 55,
    icon: Brain,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    gradientFrom: '#f59e0b',
    gradientTo: '#fbbf24',
  },
  {
    name: 'ホルモン',
    score: 30,
    icon: Heart,
    color: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.12)',
    gradientFrom: '#ec4899',
    gradientTo: '#f472b6',
  },
  {
    name: '血行',
    score: 45,
    icon: Activity,
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    gradientFrom: '#3b82f6',
    gradientTo: '#60a5fa',
  },
]

function Tendency() {
  const router = useRouter()

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.content}>
        <motion.h1
          style={styles.pageTitle}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          傾向分析
        </motion.h1>

        <Card variant="accent" padding="lg" delay={0.1}>
          <div style={styles.introCard}>
            <h2 style={styles.introTitle}>あなたの傾向分析結果</h2>
            <p style={styles.introText}>
              AIがあなたの情報を分析し、薄毛に関連する5つの要因を評価しました。
            </p>
          </div>
        </Card>

        <Card padding="lg" delay={0.2}>
          <div style={styles.tendencyList}>
            {tendencies.map((tendency, index) => {
              const Icon = tendency.icon
              return (
                <motion.div
                  key={tendency.name}
                  style={styles.tendencyItem}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <div
                    style={{
                      ...styles.iconWrapper,
                      background: tendency.bgColor,
                    }}
                  >
                    <Icon size={24} color={tendency.color} />
                  </div>
                  <div style={styles.tendencyContent}>
                    <div style={styles.tendencyHeader}>
                      <span style={styles.tendencyName}>{tendency.name}</span>
                      <span style={{ ...styles.tendencyScore, color: tendency.color }}>
                        {tendency.score}%
                      </span>
                    </div>
                    <div style={styles.progressBar}>
                      <motion.div
                        style={{
                          ...styles.progressFill,
                          background: `linear-gradient(90deg, ${tendency.gradientFrom} 0%, ${tendency.gradientTo} 100%)`,
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${tendency.score}%` }}
                        transition={{ delay: 0.5 + index * 0.1, duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </Card>

        <div style={styles.actionSection}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Button
              size="full"
              icon={<ArrowRight size={18} />}
              iconPosition="right"
              onClick={() => router.push('/feature3/food-recommend')}
            >
              おすすめの対策を見る
            </Button>
          </motion.div>
        </div>
        </div>
      </div>
    </Layout>
  )
}

export default Tendency
