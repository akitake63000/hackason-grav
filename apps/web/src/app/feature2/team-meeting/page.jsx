'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, Loader2, RefreshCw } from 'lucide-react'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import { apiFetch } from '@/lib/api'
import styles from './page.module.css'

const colors = {
  deepForest: '#313131',
  sage: '#60a5fa',
  cream: '#f8f6f2',
  gold: '#38bdf8',
}

// キャラクター定義
const characters = [
  {
    id: 'encourager',
    name: 'サポーター',
    emoji: '❤️',
    trait: '寄り添い型',
    catchphrase: 'あなたの味方だよ',
    color: 'linear-gradient(135deg, #f8b4b4 0%, #f472b6 100%)',
  },
  {
    id: 'coach',
    name: 'コーチ',
    emoji: '💪',
    trait: '目標達成型',
    catchphrase: '一緒に頑張ろう！',
    color: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%)',
  },
  {
    id: 'doctor',
    name: 'ドクター',
    emoji: '🔬',
    trait: '科学的根拠型',
    catchphrase: 'データで見てみよう',
    color: 'linear-gradient(135deg, #86efac 0%, #22c55e 100%)',
  },
]

function TeamMeetingContent() {
  const searchParams = useSearchParams()
  const [activeCharacter, setActiveCharacter] = useState(null)
  const [expandedAdvice, setExpandedAdvice] = useState({})
  const [inputValue, setInputValue] = useState('')
  const [currentTopic, setCurrentTopic] = useState('')
  const [responses, setResponses] = useState([])
  const [summary, setSummary] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [threadId, setThreadId] = useState('default')
  const scrollAreaRef = useRef(null)

  // URLパラメータからトピックを取得
  useEffect(() => {
    const topicParam = searchParams.get('topic')
    if (topicParam) {
      setInputValue(topicParam)
      handleSubmitTopic(topicParam)
    }
  }, [searchParams])

  // スクロール位置の調整
  useEffect(() => {
    if (scrollAreaRef.current && responses.length > 0) {
      scrollAreaRef.current.scrollTop = 0
    }
  }, [responses])

  const toggleExpand = (id) => {
    setExpandedAdvice(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const handleSubmitTopic = async (topic = inputValue) => {
    if (!topic.trim() || isLoading) return

    setCurrentTopic(topic)
    setInputValue('')
    setIsLoading(true)
    setError(null)
    setResponses([])
    setSummary('')
    setExpandedAdvice({})

    try {
      const response = await apiFetch('/api/v1/mental-shield/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          message: topic,
          mode: 'balanced',
        }),
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const data = await response.json()

      // スレッドIDを更新
      if (data.threadId) {
        setThreadId(data.threadId)
      }

      // レスポンスを設定
      setResponses(data.cards || [])
      setSummary(data.summary || '')
    } catch (err) {
      console.error('Team meeting API error:', err)
      setError('チーム会議の開始に失敗しました。もう一度お試しください。')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmitTopic()
    }
  }

  const handleNewMeeting = () => {
    setCurrentTopic('')
    setResponses([])
    setSummary('')
    setError(null)
    setExpandedAdvice({})
  }

  // レスポンスからエージェント情報を取得
  const getAgentResponse = (agentId) => {
    const response = responses.find(r => r.agent === agentId)
    return response?.text || ''
  }

  return (
    <Layout>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className={styles.container}>
        <div className={styles.scrollArea} ref={scrollAreaRef}>
          {/* トピックがない場合の初期状態 */}
          {!currentTopic && !isLoading && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <MessageCircle size={36} color={colors.deepForest} />
              </div>
              <div className={styles.emptyStateTitle}>
                チーム会議を始めましょう
              </div>
              <div className={styles.emptyStateText}>
                相談したいトピックを入力すると、<br />
                3人のアドバイザーがそれぞれの視点から<br />
                アドバイスを提供します。
              </div>
            </div>
          )}

          {/* ローディング中 */}
          {isLoading && (
            <div className={styles.loadingContainer}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${colors.sage} 0%, ${colors.deepForest} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Loader2 size={28} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <span className={styles.loadingText}>チームが会議中...</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {characters.map((char, index) => (
                  <motion.div
                    key={char.id}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: char.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                    }}
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 0.6, delay: index * 0.2, repeat: Infinity }}
                  >
                    {char.emoji}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

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

          {/* 会議結果の表示 */}
          {currentTopic && !isLoading && responses.length > 0 && (
            <>
              {/* Topic Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div className={styles.topicBadge}>
                  <MessageCircle size={16} />
                  相談内容：{currentTopic.length > 30 ? currentTopic.slice(0, 30) + '...' : currentTopic}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewMeeting}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={14} />
                  新しい会議
                </Button>
              </div>

              {/* Section Title */}
              <div className={styles.sectionTitle}>
                あなたの相談チーム
              </div>

              {/* Character Cards Grid */}
              <div className={styles.charactersGrid}>
                {characters.map((char) => (
                  <motion.div
                    key={char.id}
                    style={{
                      ...styles.characterCard,
                      ...(activeCharacter === char.id ? styles.characterCardActive : {}),
                    }}
                    onClick={() => setActiveCharacter(char.id === activeCharacter ? null : char.id)}
                    whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(6, 147, 227, 0.1)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div
                      style={{
                        ...styles.characterAvatar,
                        background: char.color,
                      }}
                      animate={activeCharacter === char.id ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.3 }}
                    >
                      {char.emoji}
                    </motion.div>
                    <div className={styles.characterName}>{char.name}</div>
                    <div className={styles.characterTrait}>{char.trait}</div>
                    <div style={{ ...styles.characterTrait, marginTop: '4px', fontStyle: 'italic' }}>
                      「{char.catchphrase}」
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Advice Section */}
              <div className={styles.adviceSection}>
                <div className={styles.sectionTitle}>
                  チームからのアドバイス
                </div>

                <div className={styles.adviceGrid}>
                  <AnimatePresence>
                    {characters.map((char, index) => {
                      const advice = getAgentResponse(char.id)
                      if (!advice) return null
                      return (
                        <motion.div
                          key={char.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                        >
                          <Card
                            variant="default"
                            padding="md"
                            className={styles.adviceCard}
                            hoverable
                          >
                            <div className={styles.adviceHeader}>
                              <div
                                style={{
                                  ...styles.adviceAvatar,
                                  background: char.color,
                                }}
                              >
                                {char.emoji}
                              </div>
                              <div className={styles.adviceName}>{char.name}</div>
                            </div>
                            <div className={styles.adviceText}>
                              {expandedAdvice[char.id]
                                ? advice
                                : advice.length > 100 ? advice.slice(0, 100) + '...' : advice}
                            </div>
                            {advice.length > 100 && (
                              <div className={styles.detailButton}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleExpand(char.id)}
                                >
                                  {expandedAdvice[char.id] ? '閉じる' : '詳しく聞く'}
                                </Button>
                              </div>
                            )}
                          </Card>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>

                {/* Summary Section */}
                {summary && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 }}
                    style={{ marginTop: '24px' }}
                  >
                    <div className={styles.sectionTitle}>
                      🌿 まとめ
                    </div>
                    <Card variant="default" padding="md">
                      <div style={{
                        fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
                        fontSize: '14px',
                        lineHeight: '1.8',
                        color: '#4a4540',
                      }}>
                        {summary}
                      </div>
                    </Card>
                  </motion.div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 入力エリア */}
        <div className={styles.inputArea}>
          <div className={styles.inputContainer}>
            <input
              type="text"
              className={styles.textInput}
              placeholder="相談したいトピックを入力..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <motion.button
              style={{
                ...styles.sendButton,
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
              onClick={() => handleSubmitTopic()}
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

function TeamMeeting() {
  return (
    <Suspense fallback={
      <Layout>
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <span className={styles.loadingText}>読み込み中...</span>
          </div>
        </div>
      </Layout>
    }>
      <TeamMeetingContent />
    </Suspense>
  )
}

export default TeamMeeting
