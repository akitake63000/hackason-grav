import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, Camera, MessageCircle, Leaf, Sparkles } from 'lucide-react'

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(165deg, #d4f0e3 0%, #f8f6f2 35%, #ebe8e3 100%)',
    padding: '48px 20px',
    position: 'relative',
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute',
    top: '-25%',
    right: '-15%',
    width: '60%',
    height: '55%',
    background: 'radial-gradient(ellipse at center, rgba(65, 152, 115, 0.18) 0%, transparent 70%)',
    borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
    pointerEvents: 'none',
  },
  blob2: {
    position: 'absolute',
    bottom: '-15%',
    left: '-20%',
    width: '55%',
    height: '45%',
    background: 'radial-gradient(ellipse at center, rgba(201, 169, 98, 0.12) 0%, transparent 60%)',
    borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
    pointerEvents: 'none',
  },
  content: {
    maxWidth: '980px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logoRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  logoIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #1a3d2e 0%, #347a5c 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    boxShadow: '0 6px 18px rgba(26, 61, 46, 0.25)',
  },
  title: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '36px',
    fontWeight: '600',
    color: '#1a3d2e',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '14px',
    color: '#7f786d',
    marginTop: '6px',
  },
  heroCard: {
    background: 'rgba(255, 255, 255, 0.85)',
    borderRadius: '24px',
    padding: '28px',
    border: '1px solid rgba(255, 255, 255, 0.9)',
    boxShadow: '0 14px 40px rgba(26, 61, 46, 0.08)',
    display: 'grid',
    gap: '20px',
  },
  heroTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '22px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  heroText: {
    fontSize: '14px',
    color: '#635d54',
    lineHeight: 1.6,
  },
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center',
  },
  loginButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #1a3d2e 0%, #347a5c 100%)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 10px 24px rgba(26, 61, 46, 0.2)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  loginButtonDisabled: {
    cursor: 'default',
    opacity: 0.7,
  },
  loginHint: {
    fontSize: '12px',
    color: '#9c958a',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
  },
  featureCard: {
    padding: '16px',
    borderRadius: '18px',
    background: 'rgba(248, 246, 242, 0.85)',
    border: '1px solid rgba(26, 61, 46, 0.08)',
    display: 'grid',
    gap: '8px',
  },
  featureIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #eaf8f1 0%, #d4f0e3 100%)',
    color: '#1a3d2e',
  },
  featureTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  featureText: {
    fontSize: '12px',
    color: '#7f786d',
    lineHeight: 1.5,
  },
  footer: {
    textAlign: 'center',
    marginTop: '28px',
    fontSize: '12px',
    color: '#b9b3a9',
  },
}

const features = [
  {
    id: 'feature1',
    title: 'AIチェック',
    text: '同条件の写真で髪密度の推移を追跡。',
    icon: Camera,
  },
  {
    id: 'feature2',
    title: 'お悩み相談',
    text: '3人格の視点で不安に寄り添う。',
    icon: MessageCircle,
  },
  {
    id: 'feature3',
    title: '生活アドバイス',
    text: '食材・運動の次の一手を提案。',
    icon: Leaf,
  },
]

function Index() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle')
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const handleLogin = () => {
    if (status === 'loading') return
    setStatus('loading')
    timerRef.current = setTimeout(() => {
      navigate('/home')
    }, 650)
  }

  return (
    <div style={styles.container}>
      <div style={styles.blob1} />
      <div style={styles.blob2} />

      <div style={styles.content}>
        <motion.header
          style={styles.header}
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div style={styles.logoRow}>
            <div style={styles.logoIcon}>🌿</div>
            <h1 style={styles.title}>HairGuard Agent</h1>
          </div>
          <p style={styles.subtitle}>薄毛対策を「続く体験」に変える習慣化エージェント</p>
        </motion.header>

        <motion.section
          style={styles.heroCard}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div>
            <div style={styles.heroTitle}>ログインしてはじめる</div>
            <p style={styles.heroText}>
              デモ用ログインです。ボタンを押すとログイン成功としてホーム画面へ遷移します。
            </p>
          </div>

          <div style={styles.buttonRow}>
            <motion.button
              type="button"
              style={{
                ...styles.loginButton,
                ...(status === 'loading' ? styles.loginButtonDisabled : {}),
              }}
              onClick={handleLogin}
              disabled={status === 'loading'}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <LogIn size={18} />
              {status === 'loading' ? 'ログイン中...' : 'Googleでログイン'}
            </motion.button>
            <span style={styles.loginHint}>ログイン成功後はホームへ遷移</span>
          </div>

          <div style={styles.featureGrid}>
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.id}
                  style={styles.featureCard}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.08 }}
                >
                  <div style={styles.featureIcon}>
                    <Icon size={18} />
                  </div>
                  <div style={styles.featureTitle}>{feature.title}</div>
                  <div style={styles.featureText}>{feature.text}</div>
                </motion.div>
              )}
            )}
          </div>
        </motion.section>

        <footer style={styles.footer}>
          <Sparkles size={14} style={{ marginRight: '6px' }} />
          HairGuard Agent Mock v2.0
        </footer>
      </div>
    </div>
  )
}

export default Index
