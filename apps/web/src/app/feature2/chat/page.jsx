'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import Layout from '@/components/Layout'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase'
import { collection, doc, setDoc, getDocs, getDoc, deleteDoc, orderBy, query, serverTimestamp } from 'firebase/firestore'

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

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  chatWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '800px',
    width: '100%',
    margin: '0 auto',
    overflow: 'hidden',
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 16px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  messageRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
  },
  messageRowUser: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${colors.sage} 0%, ${colors.deepForest} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(26, 61, 46, 0.15)',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: '14px 16px',
    borderRadius: '20px',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    fontSize: '14px',
    lineHeight: '1.6',
    boxShadow: '0 2px 8px rgba(26, 61, 46, 0.06)',
  },
  aiMessage: {
    background: `linear-gradient(135deg, rgba(124, 154, 124, 0.15) 0%, rgba(26, 61, 46, 0.08) 100%)`,
    color: colors.deepForest,
    borderBottomLeftRadius: '6px',
    border: `1px solid rgba(124, 154, 124, 0.2)`,
  },
  userMessage: {
    background: 'rgba(255, 255, 255, 0.95)',
    color: '#1a1815',
    borderBottomRightRadius: '6px',
    border: '1px solid rgba(26, 61, 46, 0.08)',
  },
  teamMeetingButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    margin: '8px 16px',
    background: `linear-gradient(135deg, ${colors.gold} 0%, #e8d9a8 100%)`,
    borderRadius: '16px',
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    fontSize: '14px',
    fontWeight: '600',
    color: colors.deepForest,
    boxShadow: '0 4px 12px rgba(201, 169, 98, 0.3)',
  },
  inputArea: {
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(26, 61, 46, 0.06)',
  },
  inputContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 8px 8px 16px',
    background: colors.cream,
    borderRadius: '24px',
    border: '1px solid rgba(26, 61, 46, 0.08)',
    maxWidth: '800px',
    margin: '0 auto',
  },
  textInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    fontSize: '15px',
    color: '#1a1815',
    outline: 'none',
  },
  sendButton: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${colors.deepForest} 0%, #275c45 100%)`,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(26, 61, 46, 0.25)',
  },
  timestamp: {
    fontSize: '11px',
    color: '#9c958a',
    marginTop: '4px',
    paddingLeft: '46px',
  },
  timestampUser: {
    textAlign: 'right',
    paddingRight: '0',
    paddingLeft: '0',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '16px',
  },
  loadingText: {
    fontSize: '14px',
    color: colors.sage,
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
  },
  agentLabel: {
    fontSize: '11px',
    color: '#7f786d',
    marginBottom: '4px',
    paddingLeft: '46px',
    fontWeight: '500',
  },
  errorMessage: {
    padding: '12px 16px',
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '12px',
    color: '#dc2626',
    fontSize: '14px',
    margin: '8px 16px',
  },
  discussionResultContainer: {
    background: 'rgba(124, 154, 124, 0.06)',
    borderRadius: '20px',
    padding: '16px',
    border: '1px solid rgba(124, 154, 124, 0.15)',
  },
  bestLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: colors.gold,
    marginBottom: '8px',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
  },
  bestBubble: {
    padding: '14px 16px',
    borderRadius: '16px',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    fontSize: '14px',
    lineHeight: '1.6',
    color: colors.deepForest,
    background: 'rgba(255, 255, 255, 0.8)',
    border: '1px solid rgba(201, 169, 98, 0.3)',
    marginBottom: '12px',
  },
  summaryBubble: {
    padding: '14px 16px',
    borderRadius: '16px',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    fontSize: '14px',
    lineHeight: '1.6',
    color: colors.deepForest,
    background: `linear-gradient(135deg, rgba(124, 154, 124, 0.15) 0%, rgba(26, 61, 46, 0.08) 100%)`,
    border: '1px solid rgba(124, 154, 124, 0.2)',
    marginBottom: '12px',
  },
  discussionToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: colors.sage,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: '4px 0',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    fontWeight: '500',
  },
  discussionCard: {
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '13px',
    lineHeight: '1.5',
    color: colors.deepForest,
    background: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(124, 154, 124, 0.12)',
    marginTop: '8px',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
  },
  discussionCardLabel: {
    fontSize: '11px',
    fontWeight: '600',
    marginBottom: '4px',
    color: '#7f786d',
  },
}

const initialMessages = [
  {
    id: 1,
    type: 'ai',
    agent: 'orchestrator',
    text: 'こんにちは！髪のお悩みについてお気軽にご相談ください。どのようなことが気になっていますか？',
    time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
  },
]

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
  const chatAreaRef = useRef(null)
  const isUnmountedRef = useRef(false)

  useEffect(() => {
    return () => { isUnmountedRef.current = true }
  }, [])

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
        const db = getFirestoreDb()
        const messagesRef = collection(db, 'users', user.uid, 'conversations', threadId, 'messages')
        const q = query(messagesRef, orderBy('timestamp', 'asc'))
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
                time: d.timestamp?.toDate
                  ? d.timestamp.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                  : '',
              }
            }
            return {
              id: docSnap.id,
              type: d.role === 'user' ? 'user' : 'ai',
              agent: d.agent || 'orchestrator',
              text: d.content,
              time: d.timestamp?.toDate
                ? d.timestamp.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                : '',
            }
          })
          setMessages(history)
        }
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
            timestamp: serverTimestamp(),
          }
          if (msg.bestCard) saveData.bestCard = JSON.stringify(msg.bestCard)
          await setDoc(msgRef, saveData)
        } else {
          await setDoc(msgRef, {
            role: msg.type === 'user' ? 'user' : 'ai',
            content: msg.text,
            ...(msg.agent && { agent: msg.agent }),
            timestamp: serverTimestamp(),
          })
        }
      } catch (e) {
        console.error('Failed to save message:', e)
      }
    }

    await saveMessage(threadId, newUserMessage)

    try {
      // For detailed mode, use direct Cloud Run URL to avoid Firebase Hosting 60s timeout
      const useDirectUrl = chatDetail === 'pro'
      const apiUrl = useDirectUrl
        ? 'https://agent-api-7wsihnjf7q-an.a.run.app/api/v1/mental-shield/chat/discuss'
        : '/api/v1/mental-shield/chat/discuss'

      const response = useDirectUrl
        ? await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(user?.accessToken && { 'Authorization': `Bearer ${user.accessToken}` })
            },
            body: JSON.stringify({
              threadId,
              message: inputValue,
              mode: 'balanced',
              style: chatStyle,
              detail: chatDetail,
            }),
          })
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
      handleSend()
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
      <div style={styles.discussionResultContainer}>
        {/* まとめ */}
        <div style={styles.agentLabel}>
          🌿 まとめ
        </div>
        <div style={styles.summaryBubble}>
          {message.summary}
        </div>

        {/* 議論の過程（折り畳み） */}
        {message.allCards && message.allCards.length > 0 && (
          <>
            <button
              style={styles.discussionToggle}
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
                      <div key={idx} style={styles.discussionCard}>
                        <div style={styles.discussionCardLabel}>
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

  const isBusy = isLoading || isRevealing

  return (
    <Layout>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={styles.container}>
        <div style={styles.chatWrapper}>
        <div style={styles.chatArea} ref={chatAreaRef}>
          {loadingHistory ? (
            <div style={styles.loadingContainer}>
              <div style={styles.avatar}>
                <Loader2 size={18} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <span style={styles.loadingText}>会話履歴を読み込み中...</span>
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
                    <div style={styles.timestamp}>
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
                  <div style={styles.agentLabel}>
                    {agent.emoji} {agent.name}
                  </div>
                )}
                <div
                  style={{
                    ...styles.messageRow,
                    ...(message.type === 'user' ? styles.messageRowUser : {}),
                  }}
                >
                  {message.type === 'ai' && (
                    <div style={{
                      ...styles.avatar,
                      background: agent?.color || styles.avatar.background,
                    }}>
                      <span role="img" aria-label="AI">{agent?.emoji || '🌿'}</span>
                    </div>
                  )}
                  <motion.div
                    style={{
                      ...styles.messageBubble,
                      ...(message.type === 'ai' ? styles.aiMessage : styles.userMessage),
                    }}
                    whileHover={{ scale: 1.01 }}
                  >
                    {message.text}
                  </motion.div>
                </div>
                <div
                  style={{
                    ...styles.timestamp,
                    ...(message.type === 'user' ? styles.timestampUser : {}),
                  }}
                >
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
                  <div style={styles.agentLabel}>
                    {agent?.emoji} {agent?.name}
                  </div>
                  <div style={styles.messageRow}>
                    <div style={{
                      ...styles.avatar,
                      background: agent?.color || styles.avatar.background,
                    }}>
                      <span role="img" aria-label="AI">{agent?.emoji || '🌿'}</span>
                    </div>
                    <div
                      style={{
                        ...styles.messageBubble,
                        ...styles.aiMessage,
                        opacity: 0.7,
                        borderStyle: 'dashed',
                      }}
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
              style={styles.loadingContainer}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div style={styles.avatar}>
                <Loader2 size={18} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <span style={styles.loadingText}>チームが相談中...</span>
            </motion.div>
          )}

          {/* エージェント考え中インジケーター */}
          <AnimatePresence>
            {isRevealing && revealingAgent && (
              <motion.div
                style={styles.loadingContainer}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                key={`thinking-${revealingAgent}`}
              >
                <div style={{
                  ...styles.avatar,
                  background: agentConfig[revealingAgent]?.color || styles.avatar.background,
                }}>
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    {agentConfig[revealingAgent]?.emoji || '🌿'}
                  </motion.span>
                </div>
                <span style={styles.loadingText}>
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
              style={styles.errorMessage}
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

      <div style={styles.inputArea}>
        <div style={styles.inputContainer}>
          <input
            type="text"
            style={styles.textInput}
            placeholder="メッセージを入力..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <motion.button
            style={{
              ...styles.sendButton,
              opacity: isBusy ? 0.6 : 1,
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSend}
            disabled={isBusy}
            whileHover={isBusy ? {} : { scale: 1.05 }}
            whileTap={isBusy ? {} : { scale: 0.95 }}
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
