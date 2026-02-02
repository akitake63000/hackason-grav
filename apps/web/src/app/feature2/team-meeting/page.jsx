'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import Button from '@/components/Button'
import Card from '@/components/Card'
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
}

const characters = [
  {
    id: 'supporter',
    name: 'サポーター',
    emoji: '❤️',
    trait: '共感的、温かい',
    color: 'linear-gradient(135deg, #f8b4b4 0%, #f472b6 100%)',
    catchphrase: '大丈夫ですよ',
    advice: '抜け毛が気になり始めると、不安な気持ちになりますよね。でも、多くの方が同じ悩みを抱えていますし、早めに気づいたことはとても良いことです。まずは焦らず、一歩ずつ対策を始めていきましょう。私がいつでもサポートしますよ。',
  },
  {
    id: 'coach',
    name: 'コーチ',
    emoji: '💪',
    trait: '厳格、直接的',
    color: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%)',
    catchphrase: '結果を出しましょう',
    advice: '抜け毛を改善するには、行動あるのみです。まず睡眠を7時間以上確保、次に週3回の有酸素運動、そして食事の見直し。この3つを来週から実践してください。結果は必ずついてきます。',
  },
  {
    id: 'doctor',
    name: 'ドクター',
    emoji: '🔬',
    trait: '論理的、冷静',
    color: 'linear-gradient(135deg, #86efac 0%, #22c55e 100%)',
    catchphrase: 'データによると...',
    advice: 'データによると、抜け毛の主な原因は、①ホルモンバランスの乱れ、②栄養不足、③ストレス、④頭皮環境の悪化の4つに分類されます。まずは1週間の抜け毛量を記録し、原因を特定することをお勧めします。',
  },
]

function TeamMeeting() {
  const [activeCharacter, setActiveCharacter] = useState(null)
  const [expandedAdvice, setExpandedAdvice] = useState({})

  const toggleExpand = (id) => {
    setExpandedAdvice(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.scrollArea}>
          {/* Topic Badge */}
          <div style={styles.topicBadge}>
            <MessageCircle size={16} />
            相談内容：抜け毛について
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
                {characters.map((char, index) => (
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
                          ? char.advice
                          : char.advice.slice(0, 60) + '...'}
                      </div>
                      <div style={styles.detailButton}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(char.id)}
                        >
                          {expandedAdvice[char.id] ? '閉じる' : '詳しく聞く'}
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default TeamMeeting
