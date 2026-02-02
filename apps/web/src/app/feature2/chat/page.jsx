'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Send } from 'lucide-react'
import Layout from '@/components/Layout'

const colors = {
  deepForest: '#1a3d2e',
  sage: '#7c9a7c',
  cream: '#f8f6f2',
  gold: '#c9a962',
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
}

const initialMessages = [
  {
    id: 1,
    type: 'ai',
    text: 'こんにちは！髪のお悩みについてお気軽にご相談ください。どのようなことが気になっていますか？',
    time: '10:30',
  },
  {
    id: 2,
    type: 'user',
    text: '最近抜け毛が気になります',
    time: '10:32',
  },
  {
    id: 3,
    type: 'ai',
    text: '心配されていることをお聞かせいただきありがとうございます。まず、抜け毛が気になり始めたのはいつ頃からですか？',
    time: '10:32',
  },
]

function Chat() {
  const router = useRouter()
  const [messages, setMessages] = useState(initialMessages)
  const [inputValue, setInputValue] = useState('')

  const handleSend = () => {
    if (!inputValue.trim()) return

    const now = new Date()
    const time = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

    const newUserMessage = {
      id: messages.length + 1,
      type: 'user',
      text: inputValue,
      time,
    }

    setMessages([...messages, newUserMessage])
    setInputValue('')

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = {
        id: messages.length + 2,
        type: 'ai',
        text: 'ご回答ありがとうございます。もう少し詳しくお聞かせいただけますか？日常生活での変化や、ストレス、睡眠の質なども関係することがあります。',
        time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, aiResponse])
    }, 1500)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.chatWrapper}>
        <div style={styles.chatArea}>
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <div
                  style={{
                    ...styles.messageRow,
                    ...(message.type === 'user' ? styles.messageRowUser : {}),
                  }}
                >
                  {message.type === 'ai' && (
                    <div style={styles.avatar}>
                      <span role="img" aria-label="AI">🌿</span>
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
            ))}
          </AnimatePresence>
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
            style={styles.sendButton}
            onClick={handleSend}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Send size={18} color="#ffffff" />
          </motion.button>
        </div>
        </div>
      </div>
    </Layout>
  )
}

export default Chat
