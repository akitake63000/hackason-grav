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
  { value: 'brief', label: '簡潔', description: '2〜3文' },
  { value: 'normal', label: '標準', description: '4〜5文' },
  { value: 'detailed', label: '詳細', description: 'エビデンス付き' },
]

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    maxWidth: '600px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  settingCard: {
    marginBottom: '16px',
  },
  settingHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  settingIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(135deg, ${colors.sage}30 0%, ${colors.deepForest}15 100%)`,
    flexShrink: 0,
  },
  settingTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '16px',
    fontWeight: '600',
    color: colors.deepForest,
  },
  settingDescription: {
    fontSize: '12px',
    color: '#7f786d',
    marginTop: '2px',
  },
  optionGroup: {
    display: 'flex',
    gap: '8px',
  },
  optionButton: {
    flex: 1,
    padding: '12px 8px',
    borderRadius: '12px',
    border: `1.5px solid rgba(124, 154, 124, 0.25)`,
    background: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    textAlign: 'center',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    transition: 'all 0.2s ease',
  },
  optionButtonActive: {
    border: `2px solid ${colors.deepForest}`,
    background: `linear-gradient(135deg, rgba(124, 154, 124, 0.15) 0%, rgba(26, 61, 46, 0.08) 100%)`,
    boxShadow: `0 2px 8px rgba(26, 61, 46, 0.15)`,
  },
  optionLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: colors.deepForest,
  },
  optionDesc: {
    fontSize: '11px',
    color: '#7f786d',
    marginTop: '4px',
  },
  saveButtonContainer: {
    padding: '16px',
    paddingBottom: '24px',
    maxWidth: '600px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  successMessage: {
    textAlign: 'center',
    padding: '12px',
    background: `linear-gradient(135deg, ${colors.sage}20 0%, ${colors.deepForest}10 100%)`,
    borderRadius: '12px',
    marginTop: '12px',
    fontSize: '14px',
    color: colors.deepForest,
    fontWeight: '500',
  },
}

function ChatSettings() {
  const { user, loading: authLoading } = useAuth()
  const [style, setStyle] = useState('balanced')
  const [detail, setDetail] = useState('normal')
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
        <div style={{ ...styles.container, alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={28} color={colors.sage} style={{ animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </Layout>
    )
  }

  const renderOptionGroup = (options, currentValue, setter) => (
    <div style={styles.optionGroup}>
      {options.map((opt) => (
        <motion.div
          key={opt.value}
          style={{
            ...styles.optionButton,
            ...(currentValue === opt.value ? styles.optionButtonActive : {}),
          }}
          onClick={() => setter(opt.value)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div style={styles.optionLabel}>{opt.label}</div>
          <div style={styles.optionDesc}>{opt.description}</div>
        </motion.div>
      ))}
    </div>
  )

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.scrollArea}>
          {/* Style Selector */}
          <Card variant="default" padding="lg" style={styles.settingCard}>
            <div style={styles.settingHeader}>
              <div style={styles.settingIcon}>
                <MessageSquare size={20} color={colors.deepForest} />
              </div>
              <div>
                <div style={styles.settingTitle}>対応スタイル</div>
                <div style={styles.settingDescription}>AIの話し方を調整</div>
              </div>
            </div>
            {renderOptionGroup(styleOptions, style, setStyle)}
          </Card>

          {/* Detail Selector */}
          <Card variant="default" padding="lg" style={styles.settingCard}>
            <div style={styles.settingHeader}>
              <div style={styles.settingIcon}>
                <Microscope size={20} color={colors.deepForest} />
              </div>
              <div>
                <div style={styles.settingTitle}>回答の詳細度</div>
                <div style={styles.settingDescription}>説明の詳しさを調整</div>
              </div>
            </div>
            {renderOptionGroup(detailOptions, detail, setDetail)}
          </Card>
        </div>

        {/* Save Button */}
        <div style={styles.saveButtonContainer}>
          <Button
            variant="primary"
            size="full"
            icon={saving ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '設定を保存'}
          </Button>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          {saved && (
            <motion.div
              style={styles.successMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              設定を保存しました
            </motion.div>
          )}
          {error && (
            <motion.div
              style={{ ...styles.successMessage, background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}
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
