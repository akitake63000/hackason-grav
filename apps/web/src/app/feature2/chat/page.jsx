'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Send, Loader2 } from 'lucide-react'
import Layout from '@/components/Layout'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase'
import { collection, doc, setDoc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'

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
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [messages, setMessages] = useState(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState(null)
  const [threadId, setThreadId] = useState('default')
  const chatAreaRef = useRef(null)

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
  }, [messages])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return

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

    // ユーザーメッセージをFirestoreに保存
    const saveMessage = async (tid, msg) => {
      if (!user || !isFirebaseConfigured()) return
      try {
        const db = getFirestoreDb()
        const msgRef = doc(collection(db, 'users', user.uid, 'conversations', tid, 'messages'))
        await setDoc(msgRef, {
          role: msg.type === 'user' ? 'user' : 'ai',
          content: msg.text,
          ...(msg.agent && { agent: msg.agent }),
          timestamp: serverTimestamp(),
        })
      } catch (e) {
        console.error('Failed to save message:', e)
      }
    }

    await saveMessage(threadId, newUserMessage)

    try {
      const response = await apiFetch('/api/v1/mental-shield/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          message: inputValue,
          mode: 'balanced',
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

      // 3人格の応答をメッセージに追加
      const agentMessages = data.cards.map((card, index) => ({
        id: Date.now() + index + 1,
        type: 'ai',
        agent: card.agent,
        text: card.text,
        time: responseTime,
      }))

      // サマリーを追加
      const summaryMessage = {
        id: Date.now() + data.cards.length + 1,
        type: 'ai',
        agent: 'orchestrator',
        text: data.summary,
        time: responseTime,
      }

      setMessages(prev => [...prev, ...agentMessages, summaryMessage])

      // AI応答をFirestoreに保存
      for (const msg of [...agentMessages, summaryMessage]) {
        await saveMessage(currentThreadId, msg)
      }
    } catch (err) {
      console.error('Chat API error:', err)
      setError('メッセージの送信に失敗しました。もう一度お試しください。')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

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

          {/* ローディング表示 */}
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

        <motion.button
          style={styles.teamMeetingButton}
          onClick={() => router.push('/feature2/team-meeting')}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          <Users size={18} />
          チーム会議を開く
        </motion.button>
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
              opacity: isLoading ? 0.6 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSend}
            disabled={isLoading}
            whileHover={isLoading ? {} : { scale: 1.05 }}
            whileTap={isLoading ? {} : { scale: 0.95 }}
          >
            {isLoading ? (
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
