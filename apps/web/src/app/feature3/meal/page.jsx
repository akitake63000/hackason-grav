'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Image, Check } from 'lucide-react'
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
  cameraPreview: {
    width: '100%',
    height: 'clamp(200px, 30vw, 300px)',
    background: 'linear-gradient(145deg, #2d2d2d 0%, #1a1a1a 100%)',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: '20px',
  },
  cameraIcon: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  cameraText: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  cameraGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gridTemplateRows: 'repeat(3, 1fr)',
    pointerEvents: 'none',
  },
  gridLine: {
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  buttonRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(18px, 3vw, 22px)',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  nutrientList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  nutrientItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  nutrientEmoji: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'rgba(26, 61, 46, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    flexShrink: 0,
  },
  nutrientContent: {
    flex: 1,
  },
  nutrientHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  nutrientName: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  nutrientValue: {
    fontSize: 'clamp(13px, 1.8vw, 15px)',
    color: '#7f786d',
  },
  progressBar: {
    height: '8px',
    background: 'rgba(26, 61, 46, 0.08)',
    borderRadius: '100px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '100px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
  },
}

const nutrients = [
  {
    name: 'タンパク質',
    emoji: '🥩',
    current: 45,
    target: 60,
    unit: 'g',
    color: '#ef4444',
    status: 'low',
  },
  {
    name: '亜鉛',
    emoji: '🦪',
    current: 8,
    target: 10,
    unit: 'mg',
    color: '#3b82f6',
    status: 'good',
  },
  {
    name: '鉄',
    emoji: '🥬',
    current: 6,
    target: 15,
    unit: 'mg',
    color: '#22c55e',
    status: 'low',
  },
  {
    name: 'ビタミンB群',
    emoji: '🥚',
    current: 1.8,
    target: 2.4,
    unit: 'mg',
    color: '#f59e0b',
    status: 'good',
  },
  {
    name: 'ビオチン',
    emoji: '🥜',
    current: 25,
    target: 50,
    unit: 'μg',
    color: '#8b5cf6',
    status: 'low',
  },
]

function Meal() {
  const [analyzed, setAnalyzed] = useState(true)

  const getStatusStyle = (status) => {
    if (status === 'good') {
      return {
        background: 'rgba(34, 197, 94, 0.12)',
        color: '#16a34a',
      }
    }
    return {
      background: 'rgba(239, 68, 68, 0.12)',
      color: '#dc2626',
    }
  }

  const getProgressColor = (current, target) => {
    const ratio = current / target
    if (ratio >= 0.8) return 'linear-gradient(90deg, #22c55e 0%, #4ade80 100%)'
    if (ratio >= 0.5) return 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
    return 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)'
  }

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
          食事記録
        </motion.h1>

        <motion.div
          style={styles.cameraPreview}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div style={styles.cameraGrid}>
            {[...Array(9)].map((_, i) => (
              <div key={i} style={styles.gridLine} />
            ))}
          </div>
          <div style={styles.cameraIcon}>
            <Camera size={32} color="rgba(255, 255, 255, 0.8)" />
          </div>
          <span style={styles.cameraText}>食事を撮影してください</span>
        </motion.div>

        <div style={styles.buttonRow}>
          <Button
            variant="primary"
            size="md"
            icon={<Camera size={18} />}
            style={{ flex: '1 1 140px' }}
          >
            撮影する
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<Image size={18} />}
            style={{ flex: '1 1 140px' }}
          >
            ギャラリーから
          </Button>
        </div>

        {analyzed && (
          <Card padding="lg" delay={0.2}>
            <h3 style={styles.sectionTitle}>
              <Check size={22} color="#22c55e" />
              分析結果
            </h3>
            <div style={styles.nutrientList}>
              {nutrients.map((nutrient, index) => {
                const ratio = Math.min((nutrient.current / nutrient.target) * 100, 100)
                return (
                  <motion.div
                    key={nutrient.name}
                    style={styles.nutrientItem}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.08 }}
                  >
                    <div style={styles.nutrientEmoji}>{nutrient.emoji}</div>
                    <div style={styles.nutrientContent}>
                      <div style={styles.nutrientHeader}>
                        <span style={styles.nutrientName}>{nutrient.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={styles.nutrientValue}>
                            {nutrient.current}/{nutrient.target}{nutrient.unit}
                          </span>
                          <span style={{ ...styles.statusBadge, ...getStatusStyle(nutrient.status) }}>
                            {nutrient.status === 'good' ? '充足' : '不足'}
                          </span>
                        </div>
                      </div>
                      <div style={styles.progressBar}>
                        <motion.div
                          style={{
                            ...styles.progressFill,
                            background: getProgressColor(nutrient.current, nutrient.target),
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${ratio}%` }}
                          transition={{ delay: 0.5 + index * 0.08, duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </Card>
        )}
        </div>
      </div>
    </Layout>
  )
}

export default Meal
