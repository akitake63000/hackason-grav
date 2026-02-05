'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, Loader2, RefreshCw } from 'lucide-react'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import { apiFetch } from '@/lib/api'

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
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '16px',
    fontWeight: '600',
    color: colors.deepForest,
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  charactersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
    marginBottom: '24px',
  },
  characterCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 12px',
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.8)',
    boxShadow: '0 4px 20px rgba(26, 61, 46, 0.06)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  characterCardActive: {
    border: `2px solid ${colors.gold}`,
    background: `linear-gradient(135deg, rgba(201, 169, 98, 0.1) 0%, rgba(255, 255, 255, 0.95) 100%)`,
  },
  characterAvatar: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    marginBottom: '10px',
    boxShadow: '0 4px 12px rgba(26, 61, 46, 0.1)',
  },
  characterName: {
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    fontSize: '13px',
    fontWeight: '600',
    color: colors.deepForest,
    marginBottom: '4px',
  },
  characterTrait: {
    fontSize: '11px',
    color: '#7f786d',
    textAlign: 'center',
    lineHeight: '1.4',
  },
  adviceSection: {
    marginTop: '8px',
  },
  adviceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
  },
  adviceCard: {
    marginBottom: '0',
  },
  adviceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  adviceAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
  },
  adviceName: {
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    fontSize: '13px',
    fontWeight: '600',
    color: colors.deepForest,
  },
  adviceText: {
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    fontSize: '14px',
    lineHeight: '1.7',
    color: '#4a4540',
    paddingLeft: '42px',
  },
  detailButton: {
    marginTop: '8px',
    marginLeft: '42px',
  },
  topicBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: `linear-gradient(135deg, ${colors.sage}20 0%, ${colors.deepForest}10 100%)`,
    borderRadius: '12px',
    marginBottom: '16px',
    fontSize: '13px',
    color: colors.deepForest,
    fontWeight: '500',
  },
  inputArea: {
    padding: '16px',
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
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    gap: '16px',
  },
  loadingText: {
    fontSize: '14px',
    color: colors.sage,
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
  },
  errorMessage: {
    padding: '12px 16px',
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '12px',
    color: '#dc2626',
    fontSize: '14px',
    margin: '16px 0',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    textAlign: 'center',
  },
  emptyStateIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${colors.sage}30 0%, ${colors.deepForest}20 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  emptyStateTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '18px',
    fontWeight: '600',
    color: colors.deepForest,
    marginBottom: '8px',
  },
  emptyStateText: {
    fontSize: '14px',
    color: '#7f786d',
    lineHeight: '1.6',
  },
}

// エージェント設定（APIのagent名に対応）
const agentConfig = {
  encourager: {
    id: 'encourager',
    name: 'サポーター',
    emoji: '❤️',
    trait: '共感的、温かい',
    color: 'linear-gradient(135deg, #f8b4b4 0%, #f472b6 100%)',
    catchphrase: '大丈夫ですよ',
  },
  coach: {
    id: 'coach',
    name: 'コーチ',
    emoji: '💪',
    trait: '厳格、直接的',
    color: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%)',
    catchphrase: '結果を出しましょう',
  },
  doctor: {
    id: 'doctor',
    name: 'ドクター',
    emoji: '🔬',
    trait: '論理的、冷静',
    color: 'linear-gradient(135deg, #86efac 0%, #22c55e 100%)',
    catchphrase: 'データによると...',
  },
}

const characters = Object.values(agentConfig)

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
      <div style={styles.container}>
        <div style={styles.scrollArea} ref={scrollAreaRef}>
          {/* トピックがない場合の初期状態 */}
          {!currentTopic && !isLoading && (
            <div style={styles.emptyState}>
              <div style={styles.emptyStateIcon}>
                <MessageCircle size={36} color={colors.deepForest} />
              </div>
              <div style={styles.emptyStateTitle}>
                チーム会議を始めましょう
              </div>
              <div style={styles.emptyStateText}>
                相談したいトピックを入力すると、<br />
                3人のアドバイザーがそれぞれの視点から<br />
                アドバイスを提供します。
              </div>
            </div>
          )}

          {/* ローディング中 */}
          {isLoading && (
            <div style={styles.loadingContainer}>
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
              <span style={styles.loadingText}>チームが会議中...</span>
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
              style={styles.errorMessage}
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
                <div style={styles.topicBadge}>
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
              <div style={styles.sectionTitle}>
                あなたの相談チーム
              </div>

              {/* Character Cards Grid */}
              <div style={styles.charactersGrid}>
                {characters.map((char) => (
                  <motion.div
                    key={char.id}
                    style={{
                      ...styles.characterCard,
                      ...(activeCharacter === char.id ? styles.characterCardActive : {}),
                    }}
                    onClick={() => setActiveCharacter(char.id === activeCharacter ? null : char.id)}
                    whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(26, 61, 46, 0.1)' }}
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
                    <div style={styles.characterName}>{char.name}</div>
                    <div style={styles.characterTrait}>{char.trait}</div>
                    <div style={{ ...styles.characterTrait, marginTop: '4px', fontStyle: 'italic' }}>
                      「{char.catchphrase}」
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Advice Section */}
              <div style={styles.adviceSection}>
                <div style={styles.sectionTitle}>
                  チームからのアドバイス
                </div>

                <div style={styles.adviceGrid}>
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
                            style={styles.adviceCard}
                            hoverable
                          >
                            <div style={styles.adviceHeader}>
                              <div
                                style={{
                                  ...styles.adviceAvatar,
                                  background: char.color,
                                }}
                              >
                                {char.emoji}
                              </div>
                              <div style={styles.adviceName}>{char.name}</div>
                            </div>
                            <div style={styles.adviceText}>
                              {expandedAdvice[char.id]
                                ? advice
                                : advice.length > 100 ? advice.slice(0, 100) + '...' : advice}
                            </div>
                            {advice.length > 100 && (
                              <div style={styles.detailButton}>
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
                    <div style={styles.sectionTitle}>
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
        <div style={styles.inputArea}>
          <div style={styles.inputContainer}>
            <input
              type="text"
              style={styles.textInput}
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
        <div style={styles.container}>
          <div style={styles.loadingContainer}>
            <span style={styles.loadingText}>読み込み中...</span>
          </div>
        </div>
      </Layout>
    }>
      <TeamMeetingContent />
    </Suspense>
  )
}

export default TeamMeeting
