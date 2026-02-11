'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check, Trash2, UserX } from 'lucide-react'
import Layout from '@/components/Layout'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { useAuth, signOutUser } from '@/lib/auth'
import { deleteUserData, deleteUserDataByKeys } from '@/lib/userData'
import { getFirebaseAuth } from '@/lib/firebase'
import { deleteUser as deleteAuthUser } from 'firebase/auth'
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
    padding: '0 20px 32px',
  },
  header: {
    margin: '12px 0 16px',
  },
  title: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  subtitle: {
    fontSize: '12px',
    color: '#9c958a',
    marginTop: '6px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '4px',
  },
  itemDescription: {
    fontSize: '12px',
    color: '#7f786d',
    lineHeight: 1.5,
  },
  checkbox: {
    width: '22px',
    height: '22px',
    borderRadius: '6px',
    borderWidth: '1.5px',
    borderStyle: 'solid',
    borderColor: 'rgba(26, 61, 46, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: '#fff',
  },
  checkboxActive: {
    borderColor: '#419873',
    background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.15) 0%, rgba(65, 152, 115, 0.05) 100%)',
  },
  hint: {
    fontSize: '12px',
    color: '#9c958a',
    lineHeight: 1.6,
    marginTop: '12px',
  },
  footer: {
    padding: '16px 0 8px',
    display: 'grid',
    gap: '12px',
  },
}

const deleteItems = [
  {
    id: 'profile',
    title: 'プロフィール情報',
    description: '性別・年齢・お悩みなどの基本情報',
  },
  {
    id: 'photos',
    title: '撮影画像',
    description: 'アップロードした頭皮画像',
  },
  {
    id: 'analysisResults',
    title: '解析結果',
    description: 'AI解析の結果データ',
  },
  {
    id: 'reports',
    title: 'レポート',
    description: '生成されたレポート履歴',
  },
  {
    id: 'conversations',
    title: 'チャット履歴',
    description: 'AIとの会話履歴',
  },
  {
    id: 'tendencyScores',
    title: '傾向スコア',
    description: '生活習慣の傾向スコア',
  },
  {
    id: 'foodRequests',
    title: '食材リクエスト',
    description: '食事・食材の記録',
  },
]

function DeleteSettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [selected, setSelected] = useState([])
  const [isWorking, setIsWorking] = useState(false)

  const hasSelection = selected.length > 0
  const selectedLabels = useMemo(
    () => deleteItems.filter((item) => selected.includes(item.id)).map((item) => item.title),
    [selected],
  )

  const toggleItem = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((key) => key !== id) : [...prev, id]))
  }

  const handleDeleteSelected = async () => {
    if (!user?.uid || !hasSelection || isWorking) return
    const message = `選択したデータを削除しますか？\n\n${selectedLabels.join(' / ')}`
    if (!window.confirm(message)) return
    setIsWorking(true)
    try {
      // Delete selected client-side collections
      await deleteUserDataByKeys(user.uid, selected)

      // Always delete read-only collections (dailyMissions, chatTasks) via backend
      try {
        const cleanupRes = await apiFetch('/api/v1/lifestyle/cleanup-user-data', {
          method: 'POST',
        })
        if (!cleanupRes.ok) {
          console.warn('Backend cleanup failed, but continuing')
        }
      } catch (cleanupError) {
        console.warn('Backend cleanup error (non-critical):', cleanupError)
      }

      window.alert('選択したデータを削除しました。')
    } catch (error) {
      console.error('Data deletion error:', error)
      window.alert('データ削除に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setIsWorking(false)
    }
  }

  const handleWithdraw = async () => {
    if (!user?.uid || isWorking) return
    if (!window.confirm('退会するとアカウントとすべてのデータが削除されます。よろしいですか？')) {
      return
    }
    setIsWorking(true)
    let dataDeleted = false
    let backendCleanupCompleted = false
    try {
      // Step 1: Delete user data (client-side collections)
      console.log('Step 1: Deleting client-side data...')
      await deleteUserData(user.uid)
      dataDeleted = true
      console.log('User data deleted successfully')

      // Step 2: Delete read-only collections (backend-side)
      console.log('Step 2: Deleting backend data (dailyMissions, chatTasks)...')
      try {
        const cleanupRes = await apiFetch('/api/v1/lifestyle/cleanup-user-data', {
          method: 'POST',
        })
        if (cleanupRes.ok) {
          const cleanupData = await cleanupRes.json()
          console.log('Backend cleanup completed:', cleanupData)
          backendCleanupCompleted = true
        } else {
          const errorText = await cleanupRes.text()
          console.error('Backend cleanup failed:', cleanupRes.status, errorText)
          throw new Error(`Backend cleanup failed: ${cleanupRes.status}`)
        }
      } catch (cleanupError) {
        console.error('Backend cleanup error:', cleanupError)
        // Do NOT continue if backend cleanup fails - throw error to prevent incomplete deletion
        throw new Error(`バックエンドデータ削除に失敗しました: ${cleanupError.message}`)
      }

      // Step 3: Delete authentication account
      console.log('Step 3: Deleting authentication account...')
      const auth = getFirebaseAuth()
      if (auth.currentUser) {
        await deleteAuthUser(auth.currentUser)
        console.log('Auth account deleted successfully')
      }

      window.alert('退会が完了しました。ご利用ありがとうございました。')
      await signOutUser()
      router.push('/login')
    } catch (error) {
      console.error('Withdrawal error:', error)
      const code = error?.code

      if (code === 'auth/requires-recent-login') {
        window.alert(
          '安全のため、再ログイン後に退会手続きを行ってください。\n\n' +
          (dataDeleted ? '※ データは削除されています。' : '')
        )
      } else {
        let message = '退会処理に失敗しました。\n\n'

        if (dataDeleted && backendCleanupCompleted) {
          message += 'データは削除されましたが、アカウントの削除に失敗しました。\n' +
                     'サポートにお問い合わせください。\n\n'
        } else if (dataDeleted && !backendCleanupCompleted) {
          message += '一部のデータ削除に失敗しました。\n' +
                     'ホーム画面の「今日のミッション」が残っている可能性があります。\n' +
                     '再度退会手続きを行ってください。\n\n'
        } else {
          message += 'データ削除に失敗しました。\n' +
                     '再度退会手続きを行ってください。\n\n'
        }

        message += `エラー: ${error?.message || error}`

        window.alert(message)
      }

      if (dataDeleted && backendCleanupCompleted) {
        // Both data deletions succeeded, so sign out anyway
        await signOutUser()
        router.push('/login')
      }
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.scrollArea}>
          <motion.div
            style={styles.header}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <h1 style={styles.title}>データ削除</h1>
            <p style={styles.subtitle}>削除するデータを選択してください</p>
          </motion.div>

          <Card padding="lg">
            <div style={{ display: 'grid', gap: '16px' }}>
              {deleteItems.map((item, index) => {
                const isActive = selected.includes(item.id)
                return (
                  <motion.div
                    key={item.id}
                    style={styles.item}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + index * 0.03 }}
                    onClick={() => toggleItem(item.id)}
                  >
                    <div
                      style={{
                        ...styles.checkbox,
                        ...(isActive ? styles.checkboxActive : {}),
                      }}
                    >
                      {isActive && <Check size={14} color="#419873" strokeWidth={3} />}
                    </div>
                    <div style={styles.itemContent}>
                      <div style={styles.itemTitle}>{item.title}</div>
                      <div style={styles.itemDescription}>{item.description}</div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <p style={styles.hint}>
              ※ 削除したデータは元に戻せません。必要な情報は事前に保存してください。
            </p>
          </Card>

          <div style={styles.footer}>
            <Button
              variant="outline"
              size="full"
              icon={<Trash2 size={18} />}
              onClick={handleDeleteSelected}
              disabled={!hasSelection || isWorking}
            >
              選択したデータを削除
            </Button>

            <Button
              variant="danger"
              size="full"
              icon={<UserX size={18} />}
              onClick={handleWithdraw}
              disabled={isWorking}
            >
              退会してすべて削除
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default DeleteSettingsPage
