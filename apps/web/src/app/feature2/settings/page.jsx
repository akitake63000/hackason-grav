'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Save, MessageSquare, Microscope, Users } from 'lucide-react'
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
  sliderContainer: {
    padding: '0 4px',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '10px',
    fontSize: '13px',
    color: '#635d54',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
  },
  sliderLabelActive: {
    color: colors.deepForest,
    fontWeight: '600',
  },
  sliderTrack: {
    position: 'relative',
    height: '8px',
    background: `linear-gradient(90deg, ${colors.sage}40 0%, ${colors.deepForest}40 100%)`,
    borderRadius: '4px',
    cursor: 'pointer',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    background: `linear-gradient(90deg, ${colors.sage} 0%, ${colors.deepForest} 100%)`,
    borderRadius: '4px',
    transition: 'width 0.2s ease',
  },
  sliderThumb: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '24px',
    height: '24px',
    background: '#ffffff',
    borderRadius: '50%',
    boxShadow: '0 2px 8px rgba(26, 61, 46, 0.2)',
    border: `2px solid ${colors.deepForest}`,
    cursor: 'grab',
    transition: 'left 0.2s ease',
  },
  sliderValue: {
    textAlign: 'center',
    marginTop: '12px',
    fontSize: '14px',
    color: colors.deepForest,
    fontWeight: '500',
  },
  toggleContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },
  toggleInfo: {
    flex: 1,
  },
  toggle: {
    width: '56px',
    height: '32px',
    borderRadius: '16px',
    background: '#e5e5e5',
    position: 'relative',
    cursor: 'pointer',
    transition: 'background 0.3s ease',
    flexShrink: 0,
  },
  toggleActive: {
    background: `linear-gradient(90deg, ${colors.sage} 0%, ${colors.deepForest} 100%)`,
  },
  toggleKnob: {
    position: 'absolute',
    top: '3px',
    left: '3px',
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    background: '#ffffff',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
    transition: 'transform 0.3s ease',
  },
  toggleKnobActive: {
    transform: 'translateX(24px)',
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
  const [styleValue, setStyleValue] = useState(50) // 0=優しい, 100=厳しい
  const [detailValue, setDetailValue] = useState(30) // 0=簡潔, 100=詳細
  const [autoTeamMeeting, setAutoTeamMeeting] = useState(true)
  const [saved, setSaved] = useState(false)

  const handleSliderClick = (setter) => (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setter(Math.round(percentage))
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const getStyleLabel = (value) => {
    if (value < 33) return '優しめ'
    if (value < 66) return 'バランス'
    return '厳しめ'
  }

  const getDetailLabel = (value) => {
    if (value < 33) return '簡潔'
    if (value < 66) return '標準'
    return '詳細'
  }

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.scrollArea}>
          {/* Style Slider */}
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
            <div style={styles.sliderContainer}>
              <div style={styles.sliderLabels}>
                <span style={styleValue < 33 ? styles.sliderLabelActive : {}}>優しい</span>
                <span style={styleValue >= 33 && styleValue < 66 ? styles.sliderLabelActive : {}}>バランス</span>
                <span style={styleValue >= 66 ? styles.sliderLabelActive : {}}>厳しい</span>
              </div>
              <motion.div
                style={styles.sliderTrack}
                onClick={handleSliderClick(setStyleValue)}
                whileTap={{ scale: 0.99 }}
              >
                <div style={{ ...styles.sliderFill, width: `${styleValue}%` }} />
                <motion.div
                  style={{ ...styles.sliderThumb, left: `${styleValue}%` }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                />
              </motion.div>
              <div style={styles.sliderValue}>
                現在: {getStyleLabel(styleValue)}
              </div>
            </div>
          </Card>

          {/* Detail Slider */}
          <Card variant="default" padding="lg" style={styles.settingCard}>
            <div style={styles.settingHeader}>
              <div style={styles.settingIcon}>
                <Microscope size={20} color={colors.deepForest} />
              </div>
              <div>
                <div style={styles.settingTitle}>科学情報の詳細度</div>
                <div style={styles.settingDescription}>説明の詳しさを調整</div>
              </div>
            </div>
            <div style={styles.sliderContainer}>
              <div style={styles.sliderLabels}>
                <span style={detailValue < 33 ? styles.sliderLabelActive : {}}>簡潔</span>
                <span style={detailValue >= 33 && detailValue < 66 ? styles.sliderLabelActive : {}}>標準</span>
                <span style={detailValue >= 66 ? styles.sliderLabelActive : {}}>詳細</span>
              </div>
              <motion.div
                style={styles.sliderTrack}
                onClick={handleSliderClick(setDetailValue)}
                whileTap={{ scale: 0.99 }}
              >
                <div style={{ ...styles.sliderFill, width: `${detailValue}%` }} />
                <motion.div
                  style={{ ...styles.sliderThumb, left: `${detailValue}%` }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                />
              </motion.div>
              <div style={styles.sliderValue}>
                現在: {getDetailLabel(detailValue)}
              </div>
            </div>
          </Card>

          {/* Auto Team Meeting Toggle */}
          <Card variant="default" padding="lg" style={styles.settingCard}>
            <div style={styles.toggleContainer}>
              <div style={styles.settingHeader}>
                <div style={styles.settingIcon}>
                  <Users size={20} color={colors.deepForest} />
                </div>
                <div style={styles.toggleInfo}>
                  <div style={styles.settingTitle}>チーム会議の自動発動</div>
                  <div style={styles.settingDescription}>
                    深刻な相談時に自動で<br />チーム会議を提案
                  </div>
                </div>
              </div>
              <motion.div
                style={{
                  ...styles.toggle,
                  ...(autoTeamMeeting ? styles.toggleActive : {}),
                }}
                onClick={() => setAutoTeamMeeting(!autoTeamMeeting)}
                whileTap={{ scale: 0.95 }}
              >
                <div
                  style={{
                    ...styles.toggleKnob,
                    ...(autoTeamMeeting ? styles.toggleKnobActive : {}),
                  }}
                />
              </motion.div>
            </div>
          </Card>
        </div>

        {/* Save Button */}
        <div style={styles.saveButtonContainer}>
          <Button
            variant="primary"
            size="full"
            icon={<Save size={18} />}
            onClick={handleSave}
          >
            設定を保存
          </Button>
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
        </div>
      </div>
    </Layout>
  )
}

export default ChatSettings
