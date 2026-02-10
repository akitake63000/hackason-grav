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
import styles from './page.module.css'

// Inline styles for dynamic gradient values
const gradientStyles = {
  green: 'linear-gradient(135deg, #1a3d2e 0%, #347a5c 100%)',
  gold: 'linear-gradient(135deg, #c9a962 0%, #e8d9a8 100%)',
  leaf: 'linear-gradient(135deg, #7c9a7c 0%, #a8dcc5 100%)',
}

const features = [
  {
    id: 'check',
    title: '生え際・髪密度AIチェック',
    description: 'AIが写真から髪の状態を詳しく分析します',
    icon: Camera,
    gradient: gradientStyles.green,
    path: '/feature1/capture',
    badge: null,
  },
  {
    id: 'chat',
    title: '髪のお悩み相談',
    description: '3人のAIが多角的にアドバイスします',
    icon: MessageCircle,
    gradient: gradientStyles.gold,
    path: '/feature2/chat',
    badge: 'NEW',
  },
  {
    id: 'lifestyle',
    title: '育毛サポート生活アドバイザー',
    description: '食事や運動など生活習慣をサポートします',
    icon: Leaf,
    gradient: gradientStyles.leaf,
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
      <div className={styles.container}>
        <div className={styles.scrollArea}>
        {/* Greeting */}
        <motion.div
          className={styles.greeting}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className={styles.greetingText}>
            {greeting}、
            <br />
            <span className={styles.highlight}>{userName}</span>
          </h1>
          <p className={styles.greetingSubtext}>
            今日も髪と向き合う一日を始めましょう
          </p>
        </motion.div>

        {/* Status Card */}
        <motion.div
          className={styles.statusCard}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className={styles.statusHeader}>
            <Sparkles size={16} color="#c9a962" />
            <span className={styles.statusTitle}>継続記録</span>
          </div>
          <div className={styles.statusContent}>
            <span className={styles.statusValue}>{streakDays}</span>
            <span className={styles.statusUnit}>日連続</span>
          </div>
          <p className={styles.statusSubtext}>
            {streakMessage}
          </p>
        </motion.div>

        {/* Features Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className={styles.sectionTitle}>
            機能メニュー
          </h2>

          <div className={styles.featuresGrid}>
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.id}
                  className={styles.featureCard}
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
                    className={styles.featureIconWrapper}
                    style={{ background: feature.gradient }}
                  >
                    <div className={styles.featureIconShine} />
                    <Icon size={26} color="#ffffff" strokeWidth={1.8} />
                    {feature.badge && (
                      <span className={styles.featureBadge}>{feature.badge}</span>
                    )}
                  </div>
                  <div className={styles.featureContent}>
                    <h3 className={styles.featureTitle}>{feature.title}</h3>
                    <p className={styles.featureDescription}>{feature.description}</p>
                  </div>
                  <ChevronRight size={20} className={styles.featureArrow} />
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
          className={styles.tipsSection}
        >
          <Card
            variant="accent"
            padding="lg"
            delay={0.7}
          >
            <div className={styles.tipsContent}>
              <span className={styles.tipsEmoji}>💡</span>
              <div>
                <h4 className={styles.tipsTitle}>
                  今日のヒント
                </h4>
                <p className={styles.tipsText}>
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
