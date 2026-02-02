'use client'

import { motion } from 'framer-motion'
import { Camera, Image, Zap } from 'lucide-react'
import Button from '@/components/Button'
import Layout from '@/components/Layout'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '24px',
    maxWidth: '800px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  title: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '600',
    color: '#1a3d2e',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '14px',
    color: '#7f786d',
    textAlign: 'center',
    marginTop: '4px',
  },
  cameraArea: {
    flex: 1,
    minHeight: '300px',
    maxHeight: '500px',
    aspectRatio: '3/4',
    width: '100%',
    maxWidth: '400px',
    margin: '0 auto',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
    borderRadius: '24px',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
    pointerEvents: 'none',
  },
  guideCircle: {
    width: '180px',
    height: '220px',
    borderRadius: '50%',
    border: '2px dashed rgba(201, 169, 98, 0.8)',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouette: {
    width: '140px',
    height: '180px',
    background: 'radial-gradient(ellipse at center top, rgba(80, 80, 80, 0.6) 0%, rgba(40, 40, 40, 0.4) 100%)',
    borderRadius: '50% 50% 45% 45%',
    opacity: 0.6,
  },
  cornerGuides: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    right: '16px',
    bottom: '16px',
    pointerEvents: 'none',
  },
  corner: {
    position: 'absolute',
    width: '24px',
    height: '24px',
    border: '2px solid rgba(201, 169, 98, 0.6)',
  },
  cornerTL: { top: 0, left: 0, borderRight: 'none', borderBottom: 'none', borderRadius: '8px 0 0 0' },
  cornerTR: { top: 0, right: 0, borderLeft: 'none', borderBottom: 'none', borderRadius: '0 8px 0 0' },
  cornerBL: { bottom: 0, left: 0, borderRight: 'none', borderTop: 'none', borderRadius: '0 0 0 8px' },
  cornerBR: { bottom: 0, right: 0, borderLeft: 'none', borderTop: 'none', borderRadius: '0 0 8px 0' },
  aiGuideCard: {
    position: 'absolute',
    bottom: '16px',
    left: '16px',
    right: '16px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: '16px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    border: '1px solid rgba(201, 169, 98, 0.3)',
  },
  aiIconWrapper: {
    width: '36px',
    height: '36px',
    background: 'linear-gradient(135deg, #c9a962 0%, #e8d9a8 100%)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  aiMessage: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1a3d2e',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    lineHeight: 1.4,
  },
  buttonArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    alignItems: 'center',
  },
  captureButton: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #1a3d2e 0%, #275c45 100%)',
    border: '4px solid rgba(255, 255, 255, 0.9)',
    boxShadow: '0 8px 24px rgba(26, 61, 46, 0.35), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  captureInner: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #419873 0%, #1a3d2e 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}

function Capture() {
  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.content}>
        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 style={styles.title}>AIヘアチェック</h1>
          <p style={styles.subtitle}>頭頂部を撮影</p>
        </motion.div>

        {/* Camera Preview Area */}
        <motion.div
          style={styles.cameraArea}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div style={styles.cameraOverlay} />

          {/* Corner Guides */}
          <div style={styles.cornerGuides}>
            <div style={{ ...styles.corner, ...styles.cornerTL }} />
            <div style={{ ...styles.corner, ...styles.cornerTR }} />
            <div style={{ ...styles.corner, ...styles.cornerBL }} />
            <div style={{ ...styles.corner, ...styles.cornerBR }} />
          </div>

          {/* Guide Circle with Silhouette */}
          <motion.div
            style={styles.guideCircle}
            animate={{
              borderColor: ['rgba(201, 169, 98, 0.4)', 'rgba(201, 169, 98, 0.9)', 'rgba(201, 169, 98, 0.4)'],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div style={styles.silhouette} />
          </motion.div>

          {/* AI Guide Message */}
          <motion.div
            style={styles.aiGuideCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div style={styles.aiIconWrapper}>
              <Zap size={18} color="#1a3d2e" />
            </div>
            <span style={styles.aiMessage}>
              頭頂部を中心にしてください
            </span>
          </motion.div>
        </motion.div>

        {/* Button Area */}
        <motion.div
          style={styles.buttonArea}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          {/* Capture Button */}
          <motion.div
            style={styles.captureButton}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div style={styles.captureInner}>
              <Camera size={28} color="#ffffff" />
            </div>
          </motion.div>

          {/* Gallery Button */}
          <Button
            variant="secondary"
            size="md"
            icon={<Image size={18} />}
          >
            ギャラリーから選択
          </Button>
        </motion.div>
        </div>
      </div>
    </Layout>
  )
}

export default Capture
