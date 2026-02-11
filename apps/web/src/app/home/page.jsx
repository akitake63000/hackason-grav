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
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase'
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
    badge: null,
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
  const [totalDays, setTotalDays] = useState(0)
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

  // 訪問記録を保存する関数
  const recordHomeVisit = async (uid) => {
    if (!isFirebaseConfigured()) return

    try {
      const db = getFirestoreDb()
      const now = new Date()

      // JST日付取得（Asia/Tokyo）
      const jstDateStr = now.toLocaleDateString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-') // YYYY-MM-DD形式

      // visitHistoryに記録（dateKeyをドキュメントIDに）
      const visitRef = doc(db, 'users', uid, 'visitHistory', jstDateStr)
      await setDoc(visitRef, {
        date: jstDateStr,
        timestamp: serverTimestamp(),
        lastVisitedAt: serverTimestamp()
      }, { merge: true }) // mergeで同日の重複を防止

      console.log('Home visit recorded:', jstDateStr)

      // 連続日数・通算日数を計算してprofileを更新
      await updateVisitStats(uid, jstDateStr)

    } catch (error) {
      console.error('Failed to record home visit:', error)
    }
  }

  // 連続日数・通算日数を計算（キャッシュ活用で効率化）
  const updateVisitStats = async (uid, todayDate) => {
    try {
      const db = getFirestoreDb()
      const profileRef = doc(db, 'users', uid, 'profile', 'default')

      // UserProfileを取得してキャッシュを確認
      const profileSnap = await getDoc(profileRef)
      const profile = profileSnap.data() || {}

      const lastVisitDate = profile.lastHomeVisitDate
      const cachedStreakDays = profile.homeStreakDays || 0
      const cachedTotalDays = profile.homeTotalDays || 0

      // 初回訪問または今日が初めての訪問かチェック
      if (lastVisitDate === todayDate) {
        // 同日の再訪問 → キャッシュをそのまま使用（クエリ不要）
        console.log('Same day visit, using cached values')
        setStreakDays(cachedStreakDays)
        setTotalDays(cachedTotalDays)
        return
      }

      // 新しい日の訪問 → 連続性チェック
      let newStreakDays = 0
      let newTotalDays = cachedTotalDays + 1

      if (!lastVisitDate) {
        // 初回訪問
        newStreakDays = 1
        newTotalDays = 1
      } else {
        // 前回訪問日から連続性をチェック
        const lastVisit = new Date(lastVisitDate)
        const today = new Date(todayDate)
        const daysDiff = Math.floor((today - lastVisit) / (1000 * 60 * 60 * 24))

        if (daysDiff === 1) {
          // 連続訪問（昨日も訪問していた）
          newStreakDays = cachedStreakDays + 1
        } else if (daysDiff === 0) {
          // 同日（念のため）
          newStreakDays = cachedStreakDays
          newTotalDays = cachedTotalDays // 通算日数は増やさない
        } else {
          // 途切れた → リセット
          newStreakDays = 1
        }
      }

      // UserProfileを更新（キャッシュを更新）
      await setDoc(profileRef, {
        homeStreakDays: newStreakDays,
        homeTotalDays: newTotalDays,
        lastHomeVisitDate: todayDate
      }, { merge: true })

      console.log('Visit stats updated:', {
        streakDays: newStreakDays,
        totalDays: newTotalDays,
        daysSinceLastVisit: lastVisitDate ? Math.floor((new Date(todayDate) - new Date(lastVisitDate)) / (1000 * 60 * 60 * 24)) : 0
      })

      // 状態を更新（即座にUIに反映）
      setStreakDays(newStreakDays)
      setTotalDays(newTotalDays)

    } catch (error) {
      console.error('Failed to update visit stats:', error)
    }
  }

  useEffect(() => {
    if (!user) return
    const fallbackName = user.displayName ?? 'あなた'
    setUserName(`${fallbackName}さん`)

    // 訪問記録（非同期で実行）
    recordHomeVisit(user.uid)

    // UserProfileから統計を取得
    getUserProfile(user.uid)
      .then((profile) => {
        if (!profile) return
        if (profile.displayName) {
          setUserName(`${profile.displayName}さん`)
        }
        if (typeof profile.homeStreakDays === 'number') {
          setStreakDays(profile.homeStreakDays)
        }
        if (typeof profile.homeTotalDays === 'number') {
          setTotalDays(profile.homeTotalDays)
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
            <span className={styles.statusTitle}>継続記録(ログイン日数)</span>
          </div>
          <div className={styles.statusContent}>
            <span className={styles.statusValue}>{streakDays}</span>
            <span className={styles.statusUnit}>日連続</span>
            <span className={styles.statusSeparator}>・</span>
            <span className={styles.statusTotal}>通算{totalDays}日利用</span>
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
              const gradientClass = feature.id === 'check' ? styles.gradientGreen : feature.id === 'chat' ? styles.gradientGold : styles.gradientLeaf
              return (
                <motion.button
                  key={feature.id}
                  type="button"
                  className={styles.featureCard}
                  onClick={() => router.push(feature.path)}
                  aria-label={`${feature.title} - ${feature.description}`}
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
                  <div className={`${styles.featureIconWrapper} ${gradientClass}`}>
                    <div className={styles.featureIconShine} />
                    <Icon size={26} color="#ffffff" strokeWidth={1.8} />
                    {feature.badge && (
                      <span className={styles.featureBadge} aria-label="新機能">{feature.badge}</span>
                    )}
                  </div>
                  <div className={styles.featureContent}>
                    <h3 className={styles.featureTitle}>{feature.title}</h3>
                    <p className={styles.featureDescription}>{feature.description}</p>
                  </div>
                  <ChevronRight size={20} className={styles.featureArrow} aria-hidden="true" />
                </motion.button>
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
