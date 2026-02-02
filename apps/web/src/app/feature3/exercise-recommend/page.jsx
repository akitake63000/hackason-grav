'use client'

import { motion } from 'framer-motion'
import { Clock, ChevronRight } from 'lucide-react'
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
    maxWidth: '1200px',
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
  introText: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    color: '#7f786d',
    lineHeight: 1.6,
    textAlign: 'center',
    marginBottom: '32px',
  },
  exerciseGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px',
  },
  exerciseCard: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
    cursor: 'pointer',
  },
  exerciseEmoji: {
    width: '64px',
    height: '64px',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    flexShrink: 0,
  },
  exerciseContent: {
    flex: 1,
  },
  exerciseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  exerciseName: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(16px, 2.5vw, 20px)',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  arrowIcon: {
    color: '#9c958a',
  },
  durationBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    background: 'rgba(201, 169, 98, 0.15)',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#8b7942',
    marginBottom: '10px',
  },
  exerciseEffect: {
    fontSize: 'clamp(13px, 1.8vw, 15px)',
    color: '#7f786d',
    lineHeight: 1.6,
  },
  benefitTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '12px',
  },
  benefitTag: {
    padding: '5px 12px',
    background: 'rgba(65, 152, 115, 0.1)',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
}

const exercises = [
  {
    name: '有酸素運動',
    emoji: '🏃',
    bgColor: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
    duration: '30分/日',
    effect: '全身の血行を促進し、頭皮への栄養供給を改善します。ウォーキングやジョギングがおすすめです。',
    benefits: ['血行促進', '代謝アップ', 'ストレス解消'],
  },
  {
    name: '頭皮マッサージ',
    emoji: '💆',
    bgColor: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0.05) 100%)',
    duration: '5分/日',
    effect: '頭皮の血流を直接改善し、毛根への栄養供給を促進します。入浴時に行うと効果的です。',
    benefits: ['頭皮血行', 'リラックス', '毛根活性化'],
  },
  {
    name: 'ヨガ',
    emoji: '🧘',
    bgColor: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)',
    duration: '20分/日',
    effect: '自律神経を整え、ストレスを軽減します。逆転のポーズは頭部への血流を促進します。',
    benefits: ['自律神経調整', 'ストレス軽減', '柔軟性向上'],
  },
  {
    name: 'ストレッチ',
    emoji: '🤸',
    bgColor: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)',
    duration: '10分/日',
    effect: '首や肩のコリを解消し、頭部への血流を改善します。デスクワークの合間にも最適です。',
    benefits: ['肩こり改善', '血流改善', 'リフレッシュ'],
  },
]

function ExerciseRecommend() {
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
          おすすめ運動
        </motion.h1>

        <motion.p
          style={styles.introText}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          頭皮の血行促進とストレス解消に<br />
          効果的な運動をご紹介します
        </motion.p>

        <div style={styles.exerciseGrid}>
          {exercises.map((exercise, index) => (
            <Card
              key={exercise.name}
              padding="lg"
              hoverable
              delay={0.15 + index * 0.1}
            >
              <div style={styles.exerciseCard}>
                <motion.div
                  style={{
                    ...styles.exerciseEmoji,
                    background: exercise.bgColor,
                  }}
                  whileHover={{ scale: 1.1, rotate: -5 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  {exercise.emoji}
                </motion.div>
                <div style={styles.exerciseContent}>
                  <div style={styles.exerciseHeader}>
                    <span style={styles.exerciseName}>{exercise.name}</span>
                    <ChevronRight size={20} style={styles.arrowIcon} />
                  </div>
                  <div style={styles.durationBadge}>
                    <Clock size={14} />
                    {exercise.duration}
                  </div>
                  <p style={styles.exerciseEffect}>{exercise.effect}</p>
                  <div style={styles.benefitTags}>
                    {exercise.benefits.map((benefit) => (
                      <span key={benefit} style={styles.benefitTag}>
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
        </div>
      </div>
    </Layout>
  )
}

export default ExerciseRecommend
