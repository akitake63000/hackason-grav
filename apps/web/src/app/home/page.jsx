'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, MessageCircle, Leaf, ChevronRight, Sparkles } from 'lucide-react'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import { useAuth } from '@/lib/auth'
import { getUserProfile } from '@/lib/profile'
import { apiFetch } from '@/lib/api'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    width: '100%',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px 24px',
  },
  greeting: {
    marginBottom: '24px',
  },
  greetingText: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '26px',
    fontWeight: '600',
    color: '#1a3d2e',
    lineHeight: 1.3,
  },
  greetingSubtext: {
    fontSize: '14px',
    color: '#7f786d',
    marginTop: '8px',
  },
  highlight: {
    color: '#419873',
  },
  statusCard: {
    background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.08) 0%, rgba(201, 169, 98, 0.05) 100%)',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '24px',
    border: '1px solid rgba(65, 152, 115, 0.12)',
  },
  statusHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  statusTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#419873',
  },
  statusContent: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  statusValue: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '36px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  statusUnit: {
    fontSize: '14px',
    color: '#7f786d',
  },
  statusSubtext: {
    fontSize: '12px',
    color: '#7f786d',
    marginTop: '8px',
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '14px',
  },
  featureCard: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    cursor: 'pointer',
    border: '1.5px solid transparent',
    boxShadow: '0 4px 20px rgba(26, 61, 46, 0.06)',
    transition: 'all 0.3s ease',
  },
  featureIconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  featureIconShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 100%)',
  },
  featureContent: {
    flex: 1,
    minWidth: 0,
  },
  featureTitle: {
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '4px',
  },
  featureDescription: {
    fontSize: '12px',
    color: '#7f786d',
    lineHeight: 1.4,
  },
  featureArrow: {
    color: '#b9b3a9',
    flexShrink: 0,
  },
  featureBadge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    background: 'linear-gradient(135deg, #c9a962 0%, #e8d9a8 100%)',
    color: '#1a3d2e',
    fontSize: '9px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '6px',
    boxShadow: '0 2px 6px rgba(201, 169, 98, 0.3)',
  },
  tipsSection: {
    marginTop: '28px',
  },
}

const features = [
  {
    id: 'check',
    title: '生え際・髪密度AIチェック',
    description: 'AIが写真から髪の状態を詳しく分析します',
    icon: Camera,
    gradient: 'linear-gradient(135deg, #1a3d2e 0%, #347a5c 100%)',
    path: '/feature1/capture',
    badge: null,
  },
  {
    id: 'chat',
    title: '髪のお悩み相談',
    description: '3人のAIが多角的にアドバイスします',
    icon: MessageCircle,
    gradient: 'linear-gradient(135deg, #c9a962 0%, #e8d9a8 100%)',
    path: '/feature2/chat',
    badge: 'NEW',
  },
  {
    id: 'lifestyle',
    title: '育毛サポート生活アドバイザー',
    description: '食事や運動など生活習慣をサポートします',
    icon: Leaf,
    gradient: 'linear-gradient(135deg, #7c9a7c 0%, #a8dcc5 100%)',
    path: '/feature3/tendency',
    badge: null,
  },
]

function Home() {
  const router = useRouter()
  const { user } = useAuth()
  const [userName, setUserName] = useState('あなた')
  const [streakDays, setStreakDays] = useState(0)
  const [tip, setTip] = useState('今日のヒントを準備中です')
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 5) return 'こんばんは'
    if (hour < 12) return 'おはようございます'
    if (hour < 18) return 'こんにちは'
    return 'こんばんは'
  }, [])
  const streakMessage = useMemo(() => {
    if (streakDays <= 0) return '今日から一緒に始めましょう'
    if (streakDays < 3) return 'いいスタートです。少しずつ続けましょう'
    if (streakDays < 7) return 'いいペースです。無理なく続けましょう'
    if (streakDays < 14) return '素晴らしい！継続は力なりです'
    if (streakDays < 30) return '継続できています。あと少しで習慣化！'
    return '習慣化達成！この調子で続けましょう'
  }, [streakDays])

  useEffect(() => {
    if (!user) return
    const fallbackName = user.displayName ?? 'あなた'
    setUserName(`${fallbackName}さん`)

    getUserProfile(user.uid)
      .then((profile) => {
        if (!profile) return
        if (profile.displayName) {
          setUserName(`${profile.displayName}さん`)
        }
        if (typeof profile.streakDays === 'number') {
          setStreakDays(profile.streakDays)
        }
      })
      .catch(() => {
        setUserName(fallbackName)
      })
  }, [user])

  useEffect(() => {
    if (!user) return
    apiFetch('/api/v1/lifestyle/tip')
      .then(async (res) => {
        if (!res.ok) throw new Error('failed to load tip')
        return res.json()
      })
      .then((data) => {
        if (data?.tip) {
          setTip(data.tip)
        }
      })
      .catch(() => {
        setTip('頭皮マッサージは血行促進に効果的です。指の腹で優しく揉みほぐしましょう。')
      })
  }, [user])

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.scrollArea}>
        {/* Greeting */}
        <motion.div
          style={styles.greeting}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 style={styles.greetingText}>
            {greeting}、
            <br />
            <span style={styles.highlight}>{userName}</span>
          </h1>
          <p style={styles.greetingSubtext}>
            今日も髪と向き合う一日を始めましょう
          </p>
        </motion.div>

        {/* Status Card */}
        <motion.div
          style={styles.statusCard}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div style={styles.statusHeader}>
            <Sparkles size={16} color="#c9a962" />
            <span style={styles.statusTitle}>継続記録</span>
          </div>
          <div style={styles.statusContent}>
            <span style={styles.statusValue}>{streakDays}</span>
            <span style={styles.statusUnit}>日連続</span>
          </div>
          <p style={styles.statusSubtext}>
            {streakMessage}
          </p>
        </motion.div>

        {/* Features Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 style={styles.sectionTitle}>
            機能メニュー
          </h2>

          <div style={styles.featuresGrid}>
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.id}
                  style={styles.featureCard}
                  onClick={() => router.push(feature.path)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  whileHover={{
                    y: -4,
                    borderColor: '#419873',
                    boxShadow: '0 12px 32px rgba(26, 61, 46, 0.12)',
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    style={{
                      ...styles.featureIconWrapper,
                      background: feature.gradient,
                    }}
                  >
                    <div style={styles.featureIconShine} />
                    <Icon size={26} color="#ffffff" strokeWidth={1.8} />
                    {feature.badge && (
                      <span style={styles.featureBadge}>{feature.badge}</span>
                    )}
                  </div>
                  <div style={styles.featureContent}>
                    <h3 style={styles.featureTitle}>{feature.title}</h3>
                    <p style={styles.featureDescription}>{feature.description}</p>
                  </div>
                  <ChevronRight size={20} style={styles.featureArrow} />
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* Tips Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          style={styles.tipsSection}
        >
          <Card
            variant="accent"
            padding="lg"
            delay={0.7}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>💡</span>
              <div>
                <h4 style={{
                  fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1a3d2e',
                  marginBottom: '6px',
                }}>
                  今日のヒント
                </h4>
                <p style={{
                  fontSize: '13px',
                  color: '#635d54',
                  lineHeight: 1.5,
                }}>
                  {tip}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
        </div>
      </div>
    </Layout>
  )
}

export default Home
