'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Leaf } from 'lucide-react'
import { handleRedirectResult, signInWithGoogle, useAuth } from '@/lib/auth'
import { isFirebaseConfigured } from '@/lib/firebase'
import { hasUserProfile } from '@/lib/profile'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8f6f2 100%)',
    minHeight: '100vh',
  },
  // Organic decorative blobs
  blob1: {
    position: 'absolute',
    top: '-15%',
    right: '-20%',
    width: '70%',
    height: '45%',
    background: 'radial-gradient(ellipse at center, rgba(65, 152, 115, 0.12) 0%, transparent 70%)',
    borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
    pointerEvents: 'none',
  },
  blob2: {
    position: 'absolute',
    bottom: '-10%',
    left: '-25%',
    width: '60%',
    height: '40%',
    background: 'radial-gradient(ellipse at center, rgba(201, 169, 98, 0.1) 0%, transparent 60%)',
    borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
    pointerEvents: 'none',
  },
  blob3: {
    position: 'absolute',
    top: '50%',
    left: '-15%',
    width: '40%',
    height: '30%',
    background: 'radial-gradient(ellipse at center, rgba(124, 154, 124, 0.08) 0%, transparent 60%)',
    borderRadius: '70% 30% 50% 50% / 50% 50% 30% 70%',
    pointerEvents: 'none',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: '400px',
  },
  logoContainer: {
    marginBottom: '32px',
  },
  logoWrapper: {
    width: '100px',
    height: '100px',
    background: 'linear-gradient(135deg, #1a3d2e 0%, #347a5c 100%)',
    borderRadius: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `
      0 20px 40px rgba(26, 61, 46, 0.2),
      0 8px 16px rgba(26, 61, 46, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1)
    `,
    position: 'relative',
    overflow: 'hidden',
  },
  logoShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 100%)',
    borderRadius: '32px 32px 0 0',
  },
  appName: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '28px',
    fontWeight: '600',
    color: '#1a3d2e',
    textAlign: 'center',
    marginBottom: '12px',
    letterSpacing: '-0.01em',
    lineHeight: 1.3,
  },
  catchphrase: {
    fontSize: '14px',
    color: '#7f786d',
    textAlign: 'center',
    marginBottom: '48px',
    lineHeight: 1.6,
  },
  googleButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '16px 24px',
    background: '#ffffff',
    border: '1.5px solid rgba(26, 61, 46, 0.12)',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(26, 61, 46, 0.06)',
  },
  googleButtonDisabled: {
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  googleIcon: {
    width: '20px',
    height: '20px',
  },
  googleText: {
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  errorText: {
    marginTop: '12px',
    fontSize: '12px',
    color: '#b85450',
    textAlign: 'center',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    margin: '32px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'linear-gradient(90deg, transparent 0%, rgba(26, 61, 46, 0.1) 50%, transparent 100%)',
  },
  dividerText: {
    fontSize: '12px',
    color: '#9c958a',
    padding: '0 16px',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: '32px',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '11px',
    color: '#b9b3a9',
    lineHeight: 1.6,
  },
  footerLink: {
    color: '#419873',
    textDecoration: 'none',
  },
  features: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    marginTop: '40px',
    flexWrap: 'wrap',
  },
  featureItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  featureIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  },
  featureText: {
    fontSize: '11px',
    color: '#7f786d',
    textAlign: 'center',
  },
}

// Google logo SVG component
const GoogleLogo = () => (
  <svg style={styles.googleIcon} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
)

function Login() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const firebaseReady = isFirebaseConfigured()

  useEffect(() => {
    if (loading || !user) return
    hasUserProfile(user.uid)
      .then((exists) => {
        router.replace(exists ? '/home' : '/onboarding')
      })
      .catch(() => {
        router.replace('/onboarding')
      })
  }, [loading, user, router])

  useEffect(() => {
    handleRedirectResult().then(async (redirectUser) => {
      if (!redirectUser) return
      const exists = await hasUserProfile(redirectUser.uid)
      router.replace(exists ? '/home' : '/onboarding')
    })
  }, [router])

  const handleGoogleLogin = async () => {
    if (status === 'loading') return
    setError('')
    setStatus('loading')
    try {
      const signedInUser = await signInWithGoogle()
      if (signedInUser) {
        const exists = await hasUserProfile(signedInUser.uid)
        router.push(exists ? '/home' : '/onboarding')
      }
    } catch (err) {
      setError('ログインに失敗しました。時間をおいて再度お試しください。')
      console.error(err)
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div style={styles.container}>
      {/* Organic blobs */}
      <motion.div
        style={styles.blob1}
        animate={{
          scale: [1, 1.05, 1],
          rotate: [0, 5, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        style={styles.blob2}
        animate={{
          scale: [1, 1.08, 1],
          rotate: [0, -5, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        style={styles.blob3}
        animate={{
          scale: [1, 1.1, 1],
          y: [0, 10, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <div style={styles.content}>
        {/* Logo */}
        <motion.div
          style={styles.logoContainer}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <motion.div
            style={styles.logoWrapper}
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <div style={styles.logoShine} />
            <Leaf size={48} color="#ffffff" strokeWidth={1.5} />
          </motion.div>
        </motion.div>

        {/* App name */}
        <motion.h1
          style={styles.appName}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          薄毛対策
          <br />
          AIエージェント
        </motion.h1>

        {/* Catchphrase */}
        <motion.p
          style={styles.catchphrase}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          AIとともに、
          <br />
          あなたの髪と向き合う毎日を。
        </motion.p>

        {/* Google Login Button */}
        <motion.button
          style={{
            ...styles.googleButton,
            ...((!firebaseReady || status === 'loading') ? styles.googleButtonDisabled : {}),
          }}
          onClick={handleGoogleLogin}
          disabled={!firebaseReady || status === 'loading'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          whileHover={{
            y: -2,
            boxShadow: '0 8px 24px rgba(26, 61, 46, 0.12)',
          }}
          whileTap={{ scale: 0.98 }}
        >
          <GoogleLogo />
          <span style={styles.googleText}>
            {status === 'loading' ? 'ログイン中...' : 'Googleでログイン'}
          </span>
        </motion.button>
        {!firebaseReady && (
          <p style={styles.errorText}>
            Firebase設定が未完了です。環境変数をご確認ください。
          </p>
        )}
        {error && <p style={styles.errorText}>{error}</p>}

        {/* Features preview */}
        <motion.div
          style={styles.features}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <div style={styles.featureItem}>
            <motion.div
              style={{
                ...styles.featureIcon,
                background: 'rgba(65, 152, 115, 0.1)',
              }}
              whileHover={{ scale: 1.1 }}
            >
              📸
            </motion.div>
            <span style={styles.featureText}>AIチェック</span>
          </div>
          <div style={styles.featureItem}>
            <motion.div
              style={{
                ...styles.featureIcon,
                background: 'rgba(201, 169, 98, 0.1)',
              }}
              whileHover={{ scale: 1.1 }}
            >
              💬
            </motion.div>
            <span style={styles.featureText}>お悩み相談</span>
          </div>
          <div style={styles.featureItem}>
            <motion.div
              style={{
                ...styles.featureIcon,
                background: 'rgba(124, 154, 124, 0.1)',
              }}
              whileHover={{ scale: 1.1 }}
            >
              🥗
            </motion.div>
            <span style={styles.featureText}>生活アドバイス</span>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          style={styles.footer}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <p style={styles.footerText}>
            ログインすることで、
            <a href="#" style={styles.footerLink}>利用規約</a>
            と
            <a href="#" style={styles.footerLink}>プライバシーポリシー</a>
            <br />
            に同意したものとみなされます。
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default Login
