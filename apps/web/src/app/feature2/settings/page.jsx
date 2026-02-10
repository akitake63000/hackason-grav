'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Save, MessageSquare, Microscope, Loader2 } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import { useAuth } from '@/lib/auth'
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase'
import styles from './page.module.css'

const colors = {
  deepForest: '#1a3d2e',
  sage: '#7c9a7c',
  cream: '#f8f6f2',
  gold: '#c9a962',
}

const styleOptions = [
  { value: 'gentle', label: '優しい', description: '寄り添い重視' },
  { value: 'balanced', label: 'バランス', description: '共感＋的確' },
  { value: 'strict', label: '厳しい', description: 'ストレート' },
]

const detailOptions = [
  { value: 'flash', label: 'Flash', description: '高速・簡潔' },
  { value: 'pro', label: 'Pro', description: '高精度・詳細' },
]

function ChatSettings() {
  const { user, loading: authLoading } = useAuth()
  const [style, setStyle] = useState('balanced')
  const [detail, setDetail] = useState('flash')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [error, setError] = useState(null)

  // 設定を読み込み（localStorage → Firestore）
  useEffect(() => {
    const loadSettings = async () => {
      // localStorageから即時読み込み
      try {
        const local = localStorage.getItem('feature2-chat-settings')
        if (local) {
          const parsed = JSON.parse(local)
          if (parsed.style) setStyle(parsed.style)
          if (parsed.detail) setDetail(parsed.detail)
        }
      } catch {}
      // Firestoreがあればそちらを優先
      if (user && isFirebaseConfigured()) {
        try {
          const db = getFirestoreDb()
          const snapshot = await getDoc(doc(db, 'users', user.uid, 'chatSettings', 'default'))
          if (snapshot.exists()) {
            const data = snapshot.data()
            if (data.style) setStyle(data.style)
            if (data.detail) setDetail(data.detail)
          }
        } catch (err) {
          console.error('Failed to load chat settings:', err)
        }
      }
      setLoadingSettings(false)
    }
    if (!authLoading) {
      loadSettings()
    }
  }, [user, authLoading])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      // localStorageに保存（常に動く）
      localStorage.setItem('feature2-chat-settings', JSON.stringify({ style, detail }))
      // Firestoreにも保存（失敗してもlocalStorageは保存済み）
      if (user && isFirebaseConfigured()) {
        try {
          const db = getFirestoreDb()
          await setDoc(doc(db, 'users', user.uid, 'chatSettings', 'default'), {
            style,
            detail,
            updatedAt: new Date().toISOString(),
          })
        } catch (fsErr) {
          console.error('Firestore save failed (localStorage saved):', fsErr)
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save chat settings:', err)
      setError('設定の保存に失敗しました。')
      setTimeout(() => setError(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loadingSettings) {
    return (
      <Layout>
        <div className={`${styles.container} ${styles.loadingContainer}`}>
          <Loader2 size={28} color={colors.sage} className={styles.spinner} />
        </div>
      </Layout>
    )
  }

  const renderOptionGroup = (options, currentValue, setter) => (
    <div className={styles.optionGroup}>
      {options.map((opt) => (
        <motion.div
          key={opt.value}
          className={`${styles.optionButton} ${currentValue === opt.value ? styles.optionButtonActive : ''}`}
          onClick={() => setter(opt.value)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className={styles.optionLabel}>{opt.label}</div>
          <div className={styles.optionDesc}>{opt.description}</div>
        </motion.div>
      ))}
    </div>
  )

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.scrollArea}>
          {/* Style Selector */}
          <Card variant="default" padding="lg" className={styles.settingCard}>
            <div className={styles.settingHeader}>
              <div className={styles.settingIcon}>
                <MessageSquare size={20} color={colors.deepForest} />
              </div>
              <div>
                <div className={styles.settingTitle}>対応スタイル</div>
                <div className={styles.settingDescription}>AIの話し方を調整</div>
              </div>
            </div>
            {renderOptionGroup(styleOptions, style, setStyle)}
          </Card>

          {/* Detail Selector */}
          <Card variant="default" padding="lg" className={styles.settingCard}>
            <div className={styles.settingHeader}>
              <div className={styles.settingIcon}>
                <Microscope size={20} color={colors.deepForest} />
              </div>
              <div>
                <div className={styles.settingTitle}>回答の詳細度</div>
                <div className={styles.settingDescription}>説明の詳しさを調整</div>
              </div>
            </div>
            {renderOptionGroup(detailOptions, detail, setDetail)}
          </Card>
        </div>

        {/* Save Button */}
        <div className={styles.saveButtonContainer}>
          <Button
            variant="primary"
            size="full"
            icon={saving ? <Loader2 size={18} className={styles.spinner} /> : <Save size={18} />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '設定を保存'}
          </Button>
          {saved && (
            <motion.div
              className={styles.successMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              設定を保存しました
            </motion.div>
          )}
          {error && (
            <motion.div
              className={styles.errorMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default ChatSettings
