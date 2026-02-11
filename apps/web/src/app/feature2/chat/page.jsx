'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import Layout from '@/components/Layout'
import { apiFetch } from '@/lib/api'
import { useAuth, getIdToken } from '@/lib/auth'
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase'
import { collection, doc, setDoc, getDocs, getDoc, deleteDoc, orderBy, query, serverTimestamp, onSnapshot } from 'firebase/firestore'
import styles from './page.module.css'

// 初期メッセージ
const initialMessages = [
  {
    id: 1,
    type: 'ai',
    agent: 'orchestrator',
    text: 'こんにちは！髪の健康についてお悩みのことがあれば、何でもご相談ください。3人のアドバイザーがあなたをサポートします。',
    time: '10:00',
  },
]

const colors = {
  deepForest: '#1a3d2e',
  sage: '#7c9a7c',
  cream: '#f8f6f2',
  gold: '#c9a962',
}

// 3人格のエージェント設定
const agentConfig = {
  encourager: {
    name: 'サポーター',
    emoji: '❤️',
    color: 'linear-gradient(135deg, #f8b4b4 0%, #f472b6 100%)',
  },
  coach: {
    name: 'コーチ',
    emoji: '💪',
    color: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%)',
  },
  doctor: {
    name: 'ドクター',
    emoji: '🔬',
    color: 'linear-gradient(135deg, #86efac 0%, #22c55e 100%)',
  },
  orchestrator: {
    name: 'まとめ',
    emoji: '🌿',
    color: `linear-gradient(135deg, ${colors.sage} 0%, ${colors.deepForest} 100%)`,
  },
}

// 許可されたダイレクトAPI URLのドメインリスト
// 本番環境ではlocalhostを除外
const ALLOWED_DIRECT_API_DOMAINS = (() => {
  const envDomains = process.env.NEXT_PUBLIC_ALLOWED_DIRECT_API_DOMAINS
  const defaultDomains = process.env.NODE_ENV === 'production'
    ? 'agent-api-7wsihnjf7q-an.a.run.app'
    : 'agent-api-7wsihnjf7q-an.a.run.app,localhost,127.0.0.1'

  return new Set(
    (envDomains || defaultDomains)
      .split(',')
      .map(d => d.trim())
      .filter(d => d) // 空文字除外
      .map(d => d.toLowerCase().replace(/\.$/, '')) // 正規化: 小文字化 + 末尾ドット除去
  )
})()

// デフォルトのダイレクトAPI URL
const DEFAULT_DIRECT_API_URL = 'https://agent-api-7wsihnjf7q-an.a.run.app'

/**
 * ダイレクトAPI URLの検証
 * - httpsプロトコル必須（開発環境のlocalhostは例外）
 * - 許可されたドメインのみ
 * - pathname, search, hashが空であること（originのみ許可）
 * @param {string} urlString - 検証するURL文字列
 * @returns {string} 検証済みURL origin
 * @throws {Error} 検証失敗時
 */
function validateDirectApiUrl(urlString) {
  if (!urlString) {
    throw new Error('Direct API URL is required')
  }

  try {
    const url = new URL(urlString)

    // pathname, search, hash, username, passwordが空であることを検証
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      throw new Error(
        `Direct API URL must be origin only (no path, query, hash, or credentials): ${urlString}`
      )
    }

    // ホスト名を正規化
    const normalizedHostname = url.hostname.toLowerCase().replace(/\.$/, '')

    // localhostまたは127.0.0.1の場合はhttpも許可（開発環境のみ）
    const isLocalhost = normalizedHostname === 'localhost' || normalizedHostname === '127.0.0.1'

    if (isLocalhost && process.env.NODE_ENV === 'production') {
      throw new Error(`Localhost is not allowed in production: ${urlString}`)
    }

    if (!isLocalhost && url.protocol !== 'https:') {
      throw new Error(`Direct API URL must use https protocol: ${urlString}`)
    }

    if (!ALLOWED_DIRECT_API_DOMAINS.has(normalizedHostname)) {
      throw new Error(
        `Direct API domain not allowed: ${normalizedHostname}. Allowed domains: ${Array.from(ALLOWED_DIRECT_API_DOMAINS).join(', ')}`
      )
    }

    // originのみ返す（末尾スラッシュなし）
    return url.origin
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Invalid Direct API URL format: ${urlString}`)
    }
    throw error
  }
}

function Chat() {
  const { user, loading: authLoading } = useAuth()
  const [messages, setMessages] = useState(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const [revealingAgent, setRevealingAgent] = useState(null)
  const [discussionMessages, setDiscussionMessages] = useState([])
  const [expandedDiscussions, setExpandedDiscussions] = useState({})
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState(null)
  const [threadId, setThreadId] = useState('default')
  const [chatStyle, setChatStyle] = useState('balanced')
  const [chatDetail, setChatDetail] = useState('flash')
  const [pendingTaskId, setPendingTaskId] = useState(null)
  const [pollingIntervalId, setPollingIntervalId] = useState(null)
  const chatAreaRef = useRef(null)
  const isUnmountedRef = useRef(false)

  useEffect(() => {
    return () => { isUnmountedRef.current = true }
  }, [])

  // Firestoreからメッセージを読み込むヘルパー関数
  const loadMessagesFromFirestore = async (tid) => {
    if (!user || !isFirebaseConfigured()) {
      return
    }
    try {
      const db = getFirestoreDb()
      const messagesRef = collection(db, 'users', user.uid, 'conversations', tid, 'messages')
      const q = query(messagesRef, orderBy('createdAt', 'asc'))
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const history = snapshot.docs.map((docSnap) => {
          const d = docSnap.data()
          if (d.type === 'discussion-result') {
            return {
              id: docSnap.id,
              type: 'discussion-result',
              bestCard: d.bestCard ? JSON.parse(d.bestCard) : null,
              summary: d.summary || '',
              allCards: d.allCards ? JSON.parse(d.allCards) : [],
              time: d.createdAt?.toDate
                ? d.createdAt.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                : '',
            }
          }
          return {
            id: docSnap.id,
            type: d.role === 'user' ? 'user' : 'ai',
            agent: d.agent || 'orchestrator',
            text: d.text,
            time: d.createdAt?.toDate
              ? d.createdAt.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
              : '',
          }
        })
        setMessages(history)
      }
    } catch (err) {
      console.error('Failed to load messages from Firestore:', err)
    }
  }

  // ページ読み込み時に未完了タスクをチェック
  useEffect(() => {
    const checkPendingTask = async () => {
      const pendingTask = localStorage.getItem('pending_chat_task')
      const pendingThread = localStorage.getItem('pending_chat_thread')
      const taskCreatedAt = localStorage.getItem('pending_chat_task_created_at')

      if (pendingTask && pendingThread) {
        // タスク作成時刻をチェック（10分以上経過していたら状態確認）
        if (taskCreatedAt) {
          const createdTime = new Date(taskCreatedAt)
          const now = new Date()
          const elapsedMinutes = (now - createdTime) / 1000 / 60

          if (elapsedMinutes > 10) {
            console.warn('Task older than 10 minutes, checking Firestore status:', pendingTask)

            // Firestoreでタスク状態を確認
            if (user && isFirebaseConfigured()) {
              try {
                const db = getFirestoreDb()
                const taskRef = doc(db, 'users', user.uid, 'chatTasks', pendingTask)
                const taskSnapshot = await getDoc(taskRef)

                if (taskSnapshot.exists()) {
                  const taskData = taskSnapshot.data()

                  if (taskData.status === 'succeeded') {
                    // タスクは成功していた → メッセージを読み込んでから削除
                    console.log('Task succeeded, loading messages before cleanup')
                    await loadMessagesFromFirestore(pendingThread)
                  }
                  // failed/timeout の場合は何もしない（エラーは既に記録済み）
                }
                // タスクが存在しない場合も削除のみ実行
              } catch (err) {
                console.error('Failed to check task status:', err)
              }
            }

            // いずれの場合もLocalStorageはクリア
            localStorage.removeItem('pending_chat_task')
            localStorage.removeItem('pending_chat_thread')
            localStorage.removeItem('pending_chat_task_created_at')
            return
          }
        }

        console.log('Resuming pending task:', pendingTask)
        setPendingTaskId(pendingTask)
        setThreadId(pendingThread)
        setIsLoading(true)
        startListening(pendingTask, pendingThread)
      }
    }

    checkPendingTask()

    // クリーンアップ: リスナー/ポーリング停止
    return () => {
      if (pollingIntervalId) {
        // pollingIntervalIdはintervalまたはunsubscribe関数
        if (typeof pollingIntervalId === 'function') {
          // Firestoreリスナーのunsubscribe
          pollingIntervalId()
        } else {
          // ポーリングのinterval
          clearInterval(pollingIntervalId)
        }
      }
    }
  }, []) // 空の依存配列で初回のみ実行

  // 設定を読み込む（Firestore → localStorage フォールバック）
  useEffect(() => {
    const loadSettings = async () => {
      // まずlocalStorageから読み込む（即時反映）
      try {
        const local = localStorage.getItem('feature2-chat-settings')
        if (local) {
          const parsed = JSON.parse(local)
          if (parsed.style) setChatStyle(parsed.style)
          if (parsed.detail) setChatDetail(parsed.detail)
        }
      } catch {}
      // Firestoreがあればそちらを優先
      if (user && isFirebaseConfigured()) {
        try {
          const db = getFirestoreDb()
          const snapshot = await getDoc(doc(db, 'users', user.uid, 'chatSettings', 'default'))
          if (snapshot.exists()) {
            const data = snapshot.data()
            if (data.style) setChatStyle(data.style)
            if (data.detail) setChatDetail(data.detail)
          }
        } catch (err) {
          console.error('Failed to load chat settings:', err)
        }
      }
    }
    if (!authLoading) loadSettings()
  }, [user, authLoading])

  // Firestoreから会話履歴を読み込む
  useEffect(() => {
    const loadHistory = async () => {
      if (!user || !isFirebaseConfigured()) {
        setLoadingHistory(false)
        return
      }
      try {
        await loadMessagesFromFirestore(threadId)
      } catch (err) {
        console.error('Failed to load chat history:', err)
      } finally {
        setLoadingHistory(false)
      }
    }
    if (!authLoading) {
      loadHistory()
    }
  }, [user, authLoading, threadId])

  // チャットエリアを最下部にスクロール
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight
    }
  }, [messages, discussionMessages, revealingAgent])

  // Firestoreリスナー開始（Phase 2: リアルタイム更新）
  const startListening = (taskId, tid) => {
    if (!user || !isFirebaseConfigured()) {
      console.warn('Firebase not configured, falling back to polling')
      return startPolling(taskId, tid)
    }

    try {
      const db = getFirestoreDb()
      const taskRef = doc(db, 'users', user.uid, 'chatTasks', taskId)

      console.log('Starting Firestore listener for task:', taskId)

      const unsubscribe = onSnapshot(
        taskRef,
        async (snapshot) => {
          if (!snapshot.exists()) {
            console.warn('Task not found:', taskId)
            unsubscribe()
            setPollingIntervalId(null)
            setPendingTaskId(null)
            localStorage.removeItem('pending_chat_task')
            localStorage.removeItem('pending_chat_thread')
            localStorage.removeItem('pending_chat_task_created_at')
            setIsLoading(false)
            return
          }

          const taskData = snapshot.data()
          console.log('Task status updated:', taskData.status)

          if (taskData.status === 'succeeded') {
            // 完了：メッセージを再読み込み
            console.log('Task succeeded, reloading messages')
            await loadMessagesFromFirestore(tid)

            // リスナー停止
            unsubscribe()
            setPollingIntervalId(null)
            setPendingTaskId(null)
            localStorage.removeItem('pending_chat_task')
            localStorage.removeItem('pending_chat_thread')
            localStorage.removeItem('pending_chat_task_created_at')
            setIsLoading(false)

          } else if (taskData.status === 'failed' || taskData.status === 'timeout') {
            // 失敗：エラー表示
            console.error('Task failed:', taskData.error)
            setError(`回答の生成に失敗しました: ${taskData.error || '不明なエラー'}`)

            unsubscribe()
            setPollingIntervalId(null)
            setPendingTaskId(null)
            localStorage.removeItem('pending_chat_task')
            localStorage.removeItem('pending_chat_thread')
            localStorage.removeItem('pending_chat_task_created_at')
            setIsLoading(false)
          }
          // queued/running の場合は継続
        },
        (error) => {
          console.error('Firestore listener error:', error)
          // エラー時はポーリングにフォールバック
          startPolling(taskId, tid)
        }
      )

      // unsubscribe関数をpollingIntervalIdとして保存（cleanup用）
      setPollingIntervalId(unsubscribe)

    } catch (error) {
      console.error('Failed to start Firestore listener:', error)
      // エラー時はポーリングにフォールバック
      startPolling(taskId, tid)
    }
  }

  // ポーリング開始（Phase 1: フォールバック用）
  const startPolling = (taskId, tid) => {
    const interval = setInterval(async () => {
      try {
        // タスク状態を取得
        const DIRECT_API_URL = process.env.NEXT_PUBLIC_DIRECT_API_URL || DEFAULT_DIRECT_API_URL
        const validatedDirectUrl = validateDirectApiUrl(DIRECT_API_URL)
        const token = await getIdToken()

        const response = await fetch(`${validatedDirectUrl}/api/v1/mental-shield/tasks/${taskId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        })

        if (!response.ok) {
          if (response.status === 404) {
            console.warn('Task not found:', taskId)
            clearInterval(interval)
            setPollingIntervalId(null)
            setPendingTaskId(null)
            localStorage.removeItem('pending_chat_task')
            localStorage.removeItem('pending_chat_thread')
            localStorage.removeItem('pending_chat_task_created_at')
            setIsLoading(false)
          }
          return
        }

        const taskStatus = await response.json()

        if (taskStatus.status === 'succeeded') {
          // 完了：メッセージを再読み込み
          console.log('Task succeeded, reloading messages')
          await loadMessagesFromFirestore(tid)

          // ポーリング停止
          clearInterval(interval)
          setPollingIntervalId(null)
          setPendingTaskId(null)
          localStorage.removeItem('pending_chat_task')
          localStorage.removeItem('pending_chat_thread')
          localStorage.removeItem('pending_chat_task_created_at')
          setIsLoading(false)

        } else if (taskStatus.status === 'failed' || taskStatus.status === 'timeout') {
          // 失敗：エラー表示
          console.error('Task failed:', taskStatus.error)
          setError(`回答の生成に失敗しました: ${taskStatus.error || '不明なエラー'}`)

          clearInterval(interval)
          setPollingIntervalId(null)
          setPendingTaskId(null)
          localStorage.removeItem('pending_chat_task')
          localStorage.removeItem('pending_chat_thread')
          localStorage.removeItem('pending_chat_task_created_at')
          setIsLoading(false)
        }
        // queued/running の場合は継続

      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 3000) // 3秒間隔

    setPollingIntervalId(interval)
  }

  // 非同期チャット送信
  const handleSendAsync = async () => {
    if (!inputValue.trim() || isLoading || isRevealing || pendingTaskId) return

    const now = new Date()
    const time = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

    const newUserMessage = {
      id: Date.now(),
      type: 'user',
      text: inputValue,
      time,
    }

    setMessages(prev => [...prev, newUserMessage])
    const userMessageText = inputValue
    setInputValue('')
    setIsLoading(true)
    setError(null)

    try {
      // タスク作成API呼び出し
      const DIRECT_API_URL = process.env.NEXT_PUBLIC_DIRECT_API_URL || DEFAULT_DIRECT_API_URL
      const validatedDirectUrl = validateDirectApiUrl(DIRECT_API_URL)
      const apiUrl = `${validatedDirectUrl}/api/v1/mental-shield/chat/discuss-async`
      const token = await getIdToken()

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          threadId,
          message: userMessageText,
          mode: 'balanced',
          style: chatStyle,
          detail: chatDetail,
        }),
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const data = await response.json()
      const taskId = data.taskId

      // タスクIDを保存（LocalStorage + state）
      setPendingTaskId(taskId)
      localStorage.setItem('pending_chat_task', taskId)
      localStorage.setItem('pending_chat_thread', threadId)
      localStorage.setItem('pending_chat_task_created_at', new Date().toISOString())

      // Firestoreリスナー開始（Phase 2: リアルタイム更新）
      startListening(taskId, threadId)

    } catch (error) {
      console.error('Failed to send async chat:', error)
      setError('メッセージの送信に失敗しました。もう一度お試しください。')
      setIsLoading(false)
    }
  }

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || isRevealing) return

    const now = new Date()
    const time = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

    const newUserMessage = {
      id: Date.now(),
      type: 'user',
      text: inputValue,
      time,
    }

    setMessages(prev => [...prev, newUserMessage])
    setInputValue('')
    setIsLoading(true)
    setError(null)

    // Firestoreにメッセージを保存
    const saveMessage = async (tid, msg) => {
      if (!user || !isFirebaseConfigured()) return
      try {
        const db = getFirestoreDb()
        const msgRef = doc(collection(db, 'users', user.uid, 'conversations', tid, 'messages'))
        if (msg.type === 'discussion-result') {
          const saveData = {
            type: 'discussion-result',
            summary: msg.summary,
            allCards: JSON.stringify(msg.allCards),
            createdAt: serverTimestamp(),
          }
          if (msg.bestCard) saveData.bestCard = JSON.stringify(msg.bestCard)
          await setDoc(msgRef, saveData)
        } else {
          await setDoc(msgRef, {
            role: msg.type === 'user' ? 'user' : 'ai',
            text: msg.text,
            ...(msg.agent && { agent: msg.agent }),
            createdAt: serverTimestamp(),
          })
        }
      } catch (e) {
        console.error('Failed to save message:', e)
      }
    }

    await saveMessage(threadId, newUserMessage)

    try {
      // Use direct Cloud Run URL to avoid Firebase Hosting 60s timeout
      // The discuss endpoint makes 7 sequential LLM calls, so it needs the full 300s timeout
      const useDirectUrl = true
      const DIRECT_API_URL = process.env.NEXT_PUBLIC_DIRECT_API_URL || DEFAULT_DIRECT_API_URL
      const validatedDirectUrl = useDirectUrl ? validateDirectApiUrl(DIRECT_API_URL) : null
      const apiUrl = useDirectUrl
        ? `${validatedDirectUrl}/api/v1/mental-shield/chat/discuss`
        : '/api/v1/mental-shield/chat/discuss'

      const response = useDirectUrl
        ? await (async () => {
            const token = await getIdToken()
            return fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
              },
              body: JSON.stringify({
                threadId,
                message: inputValue,
                mode: 'balanced',
                style: chatStyle,
                detail: chatDetail,
              }),
            })
          })()
        : await apiFetch('/api/v1/mental-shield/chat/discuss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              threadId,
              message: inputValue,
              mode: 'balanced',
              style: chatStyle,
              detail: chatDetail,
            }),
          })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const data = await response.json()
      const responseTime = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

      // スレッドIDを更新
      const currentThreadId = data.threadId || threadId
      if (data.threadId) {
        setThreadId(data.threadId)
      }

      // 順次表示開始
      setIsLoading(false)
      setIsRevealing(true)

      // 3人の議論を順番に表示
      for (const card of data.cards) {
        if (isUnmountedRef.current) return

        setRevealingAgent(card.agent)
        await new Promise(resolve => setTimeout(resolve, 1200))
        if (isUnmountedRef.current) return

        setRevealingAgent(null)
        setDiscussionMessages(prev => [...prev, {
          id: `disc-${Date.now()}-${card.agent}`,
          agent: card.agent,
          text: card.text,
          time: responseTime,
        }])

        await new Promise(resolve => setTimeout(resolve, 600))
      }

      if (isUnmountedRef.current) return

      // 議論メッセージをフェードアウト
      setRevealingAgent('orchestrator')
      await new Promise(resolve => setTimeout(resolve, 1200))
      if (isUnmountedRef.current) return

      setRevealingAgent(null)
      setDiscussionMessages([])

      // まとめ + 折り畳みをメッセージに追加
      const resultMessage = {
        id: Date.now() + 100,
        type: 'discussion-result',
        summary: data.summary,
        allCards: data.cards.map(c => ({ agent: c.agent, text: c.text })),
        time: responseTime,
      }

      setMessages(prev => [...prev, resultMessage])
      setIsRevealing(false)

      // Firestoreに保存
      await saveMessage(currentThreadId, resultMessage)

    } catch (err) {
      console.error('Chat API error:', err)
      setError('メッセージの送信に失敗しました。もう一度お試しください。')
    } finally {
      setIsLoading(false)
      setIsRevealing(false)
      setRevealingAgent(null)
      setDiscussionMessages([])
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendAsync()
    }
  }

  const handleDeleteHistory = async () => {
    if (!confirm('会話履歴を削除しますか？この操作は取り消せません。')) return
    if (!user || !isFirebaseConfigured()) {
      setMessages(initialMessages)
      return
    }
    try {
      const db = getFirestoreDb()
      const messagesRef = collection(db, 'users', user.uid, 'conversations', threadId, 'messages')
      const snapshot = await getDocs(messagesRef)
      const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref))
      await Promise.all(deletePromises)
      setMessages(initialMessages)
    } catch (err) {
      console.error('Failed to delete chat history:', err)
      setError('履歴の削除に失敗しました。もう一度お試しください。')
    }
  }

  const toggleDiscussion = (messageId) => {
    setExpandedDiscussions(prev => ({
      ...prev,
      [messageId]: !prev[messageId],
    }))
  }

  // discussion-result メッセージの描画
  const renderDiscussionResult = (message) => {
    const isExpanded = expandedDiscussions[message.id]

    return (
      <div className={styles.discussionResultContainer}>
        {/* まとめ */}
        <div className={styles.agentLabel}>
          🌿 まとめ
        </div>
        <div className={styles.summaryBubble}>
          {message.summary}
        </div>

        {/* 議論の過程（折り畳み） */}
        {message.allCards && message.allCards.length > 0 && (
          <>
            <button
              className={styles.discussionToggle}
              onClick={() => toggleDiscussion(message.id)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              議論の過程を見る
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden' }}
                >
                  {message.allCards.map((card, idx) => {
                    const cardAgent = agentConfig[card.agent]
                    return (
                      <div key={idx} className={styles.discussionCard}>
                        <div className={styles.discussionCardLabel}>
                          {cardAgent?.emoji} {cardAgent?.name}
                        </div>
                        {card.text}
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    )
  }

  const isBusy = isLoading || isRevealing || pendingTaskId !== null

  return (
    <Layout>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className={styles.container}>
        <div className={styles.chatWrapper}>
        <div className={styles.chatArea} ref={chatAreaRef}>
          {loadingHistory ? (
            <div className={styles.loadingContainer}>
              <div className={styles.avatar}>
                <Loader2 size={18} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <span className={styles.loadingText}>会話履歴を読み込み中...</span>
            </div>
          ) : (
          <AnimatePresence>
            {messages.map((message, index) => {
              // discussion-result タイプの描画
              if (message.type === 'discussion-result') {
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  >
                    {renderDiscussionResult(message)}
                    <div className={styles.timestamp}>
                      {message.time}
                    </div>
                  </motion.div>
                )
              }

              // 通常メッセージの描画
              const agent = message.agent ? agentConfig[message.agent] : null
              return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                {message.type === 'ai' && agent && (
                  <div className={styles.agentLabel}>
                    {agent.emoji} {agent.name}
                  </div>
                )}
                <div className={`${styles.messageRow} ${message.type === 'user' ? styles.messageRowUser : ''}`}>
                  {message.type === 'ai' && (
                    <div
                      className={styles.avatar}
                      style={{ background: agent?.color || '#7c9a7c' }}
                    >
                      <span role="img" aria-label="AI">{agent?.emoji || '🌿'}</span>
                    </div>
                  )}
                  <motion.div
                    className={`${styles.messageBubble} ${message.type === 'ai' ? styles.aiMessage : styles.userMessage}`}
                    whileHover={{ scale: 1.01 }}
                  >
                    {message.text}
                  </motion.div>
                </div>
                <div className={`${styles.timestamp} ${message.type === 'user' ? styles.timestampUser : ''}`}>
                  {message.time}
                </div>
              </motion.div>
            )})}
          </AnimatePresence>
          )}

          {/* 議論中の一時メッセージ */}
          <AnimatePresence>
            {discussionMessages.map((msg) => {
              const agent = agentConfig[msg.agent]
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className={styles.agentLabel}>
                    {agent?.emoji} {agent?.name}
                  </div>
                  <div className={styles.messageRow}>
                    <div
                      className={styles.avatar}
                      style={{ background: agent?.color || '#7c9a7c' }}
                    >
                      <span role="img" aria-label="AI">{agent?.emoji || '🌿'}</span>
                    </div>
                    <div
                      className={`${styles.messageBubble} ${styles.aiMessage} ${styles.aiMessagePending}`}
                    >
                      {msg.text}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* ローディング表示（API呼び出し中） */}
          {isLoading && (
            <motion.div
              className={styles.loadingContainer}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className={styles.avatar}>
                <Loader2 size={18} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <span className={styles.loadingText}>チームが相談中...</span>
            </motion.div>
          )}

          {/* エージェント考え中インジケーター */}
          <AnimatePresence>
            {isRevealing && revealingAgent && (
              <motion.div
                className={styles.loadingContainer}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                key={`thinking-${revealingAgent}`}
              >
                <div
                  className={styles.avatar}
                  style={{ background: agentConfig[revealingAgent]?.color || '#7c9a7c' }}
                >
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    {agentConfig[revealingAgent]?.emoji || '🌿'}
                  </motion.span>
                </div>
                <span className={styles.loadingText}>
                  {revealingAgent === 'orchestrator'
                    ? 'まとめを作成中...'
                    : `${agentConfig[revealingAgent]?.name || ''}が考え中...`
                  }
                </span>
                <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: colors.sage,
                      }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* エラー表示 */}
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 16px' }}>
          <motion.button
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '16px',
              border: 'none',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onClick={handleDeleteHistory}
            whileHover={{ scale: 1.05, background: 'rgba(239, 68, 68, 0.2)' }}
            whileTap={{ scale: 0.95 }}
            title="会話履歴を削除"
          >
            <Trash2 size={18} color="#dc2626" />
          </motion.button>
        </div>
      </div>

      <div className={styles.inputArea}>
        {pendingTaskId && (
          <div className={styles.processingIndicator}>
            <span className={styles.spinner}>⏳</span>
            <span>回答を生成しています。画面を離れても処理は継続されます。</span>
          </div>
        )}
        <div className={styles.inputContainer}>
          <input
            type="text"
            className={styles.textInput}
            placeholder="メッセージを入力..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <motion.button
            className={styles.sendButton}
            style={{
              opacity: isBusy ? 0.6 : 1,
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSendAsync}
            disabled={isBusy}
            whileHover={isBusy ? {} : { scale: 1.05 }}
            whileTap={isBusy ? {} : { scale: 0.95 }}
            title={pendingTaskId ? '回答生成中...' : '送信'}
          >
            {isBusy ? (
              <Loader2 size={18} color="#ffffff" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Send size={18} color="#ffffff" />
            )}
          </motion.button>
        </div>
        </div>
      </div>
    </Layout>
  )
}

export default Chat
