'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Camera, Image, Check, Loader2, AlertCircle, X } from 'lucide-react'
import { ref, uploadBytes } from 'firebase/storage'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import { getFirebaseStorage, getFirebaseAuth } from '@/lib/firebase'
import { apiFetch } from '@/lib/api'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  pageTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '600',
    color: '#1a3d2e',
    textAlign: 'center',
    marginBottom: '24px',
  },
  cameraPreview: {
    width: '100%',
    height: 'clamp(200px, 30vw, 300px)',
    background: 'linear-gradient(145deg, #2d2d2d 0%, #1a1a1a 100%)',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: '20px',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '20px',
  },
  cameraIcon: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  cameraText: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  cameraGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gridTemplateRows: 'repeat(3, 1fr)',
    pointerEvents: 'none',
  },
  gridLine: {
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  videoElement: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '20px',
  },
  cameraControls: {
    position: 'absolute',
    bottom: '20px',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    zIndex: 10,
  },
  shutterButton: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.9)',
    border: '4px solid rgba(255, 255, 255, 0.6)',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  shutterInner: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    background: '#ffffff',
    border: '2px solid #e5e5e5',
  },
  closeCameraButton: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.5)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 10,
  },
  buttonRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(18px, 3vw, 22px)',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  nutrientList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  nutrientItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  nutrientEmoji: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'rgba(26, 61, 46, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    flexShrink: 0,
  },
  nutrientContent: {
    flex: 1,
  },
  nutrientHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  nutrientName: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  nutrientValue: {
    fontSize: 'clamp(13px, 1.8vw, 15px)',
    color: '#7f786d',
  },
  progressBar: {
    height: '8px',
    background: 'rgba(26, 61, 46, 0.08)',
    borderRadius: '100px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '100px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
  },
  loadingOverlay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '16px',
    color: '#1a3d2e',
    fontWeight: '500',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    background: 'rgba(239, 68, 68, 0.08)',
    borderRadius: '12px',
    marginBottom: '16px',
    color: '#dc2626',
    fontSize: '14px',
  },
  summaryText: {
    fontSize: '15px',
    color: '#4a4a4a',
    lineHeight: '1.6',
    marginBottom: '20px',
    padding: '12px 16px',
    background: 'rgba(26, 61, 46, 0.04)',
    borderRadius: '12px',
  },
  recommendButton: {
    marginTop: '20px',
  },
}

const NUTRIENT_EMOJIS = {
  'タンパク質': '🥩',
  '鉄分': '🥬',
  '鉄': '🥬',
  '亜鉛': '🦪',
  'ビタミンB群': '🥚',
  'ビタミンC': '🍊',
  'ビオチン': '🥜',
}

function Meal() {
  const router = useRouter()
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const previewUrlRef = useRef(null)

  const [previewUrl, setPreviewUrl] = useState(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [error, setError] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)

  // Keep ref in sync for cleanup
  useEffect(() => {
    previewUrlRef.current = previewUrl
  }, [previewUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const startCamera = async () => {
    setError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click()
      return
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      streamRef.current = mediaStream
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setIsCameraActive(true)
    } catch (err) {
      console.warn('Camera access denied, falling back to file input:', err)
      cameraInputRef.current?.click()
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraActive(false)
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(
      async (blob) => {
        if (!blob) return
        stopCamera()

        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
        }
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setAnalysisResult(null)

        const file = new File([blob], `meal-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        })
        await uploadAndAnalyze(file)
      },
      'image/jpeg',
      0.85,
    )
  }

  const getStatusStyle = (status) => {
    if (status === 'good') {
      return {
        background: 'rgba(34, 197, 94, 0.12)',
        color: '#16a34a',
      }
    }
    return {
      background: 'rgba(239, 68, 68, 0.12)',
      color: '#dc2626',
    }
  }

  const getProgressColor = (current, target) => {
    const ratio = current / target
    if (ratio >= 0.8) return 'linear-gradient(90deg, #22c55e 0%, #4ade80 100%)'
    if (ratio >= 0.5) return 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
    return 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)'
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      setError('画像サイズは10MB以下にしてください。')
      return
    }

    setError(null)
    setAnalysisResult(null)

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    await uploadAndAnalyze(file)

    e.target.value = ''
  }

  const uploadAndAnalyze = async (fileOrBlob) => {
    setIsLoading(true)
    setError(null)

    try {
      const auth = getFirebaseAuth()
      const user = auth.currentUser
      if (!user) {
        setError('ログインが必要です。ページを再読み込みしてください。')
        setIsLoading(false)
        return
      }
      const uid = user.uid

      setLoadingMessage('画像をアップロード中...')
      const storage = getFirebaseStorage()
      const storagePath = `users/${uid}/meals/${Date.now()}.jpg`
      const storageRef = ref(storage, storagePath)
      await uploadBytes(storageRef, fileOrBlob)

      setLoadingMessage('AIが栄養分析中...')
      const response = await apiFetch('/api/v1/lifestyle/meal-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath }),
      })

      const data = await response.json()

      if (!data || !data.nutrients) {
        setError('分析結果の形式が不正です。もう一度お試しください。')
        return
      }

      setAnalysisResult(data)
    } catch (err) {
      console.error('Meal analysis error:', err)
      if (err?.status === 401 || err?.message?.includes('401')) {
        setError('ログインが必要です。ページを再読み込みしてください。')
      } else {
        setError('分析に失敗しました。もう一度お試しください。')
      }
    } finally {
      setIsLoading(false)
      setLoadingMessage('')
    }
  }

  const handleRecommendClick = () => {
    if (!analysisResult?.deficiencies?.length) {
      router.push('/feature3/food-recommend')
      return
    }
    const params = new URLSearchParams({
      deficiencies: analysisResult.deficiencies.join(','),
    })
    router.push(`/feature3/food-recommend?${params.toString()}`)
  }

  const nutrients = analysisResult?.nutrients || []

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.content}>
          <motion.h1
            style={styles.pageTitle}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            食事記録
          </motion.h1>

          <motion.div
            style={styles.cameraPreview}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            {isCameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={styles.videoElement}
                />
                <button
                  style={styles.closeCameraButton}
                  onClick={stopCamera}
                >
                  <X size={18} color="#fff" />
                </button>
                <div style={styles.cameraControls}>
                  <motion.button
                    style={styles.shutterButton}
                    whileTap={{ scale: 0.9 }}
                    onClick={capturePhoto}
                  >
                    <div style={styles.shutterInner} />
                  </motion.button>
                </div>
              </>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="食事プレビュー"
                style={styles.previewImage}
              />
            ) : (
              <>
                <div style={styles.cameraGrid}>
                  {[...Array(9)].map((_, i) => (
                    <div key={i} style={styles.gridLine} />
                  ))}
                </div>
                <div style={styles.cameraIcon}>
                  <Camera size={32} color="rgba(255, 255, 255, 0.8)" />
                </div>
                <span style={styles.cameraText}>食事を撮影してください</span>
              </>
            )}
          </motion.div>

          {/* Hidden canvas for photo capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          {!isCameraActive && (
            <div style={styles.buttonRow}>
              <Button
                variant="primary"
                size="md"
                icon={<Camera size={18} />}
                style={{ flex: '1 1 140px' }}
                onClick={startCamera}
                disabled={isLoading}
              >
                撮影する
              </Button>
              <Button
                variant="secondary"
                size="md"
                icon={<Image size={18} />}
                style={{ flex: '1 1 140px' }}
                onClick={() => galleryInputRef.current?.click()}
                disabled={isLoading}
              >
                ギャラリーから
              </Button>
            </div>
          )}

          {error && (
            <motion.div
              style={styles.errorBox}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle size={18} />
              {error}
            </motion.div>
          )}

          {isLoading && (
            <Card padding="lg" delay={0.1}>
              <div style={styles.loadingOverlay}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                >
                  <Loader2 size={36} color="#1a3d2e" />
                </motion.div>
                <span style={styles.loadingText}>{loadingMessage}</span>
              </div>
            </Card>
          )}

          {!isLoading && analysisResult && (
            <Card padding="lg" delay={0.2}>
              <h3 style={styles.sectionTitle}>
                <Check size={22} color="#22c55e" />
                分析結果
              </h3>

              {analysisResult.summary && (
                <div style={styles.summaryText}>{analysisResult.summary}</div>
              )}

              <div style={styles.nutrientList}>
                {nutrients.map((nutrient, index) => {
                  const ratio = Math.min(
                    (nutrient.current / nutrient.target) * 100,
                    100,
                  )
                  const emoji = NUTRIENT_EMOJIS[nutrient.name] || '🍽️'
                  return (
                    <motion.div
                      key={nutrient.name}
                      style={styles.nutrientItem}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.08 }}
                    >
                      <div style={styles.nutrientEmoji}>{emoji}</div>
                      <div style={styles.nutrientContent}>
                        <div style={styles.nutrientHeader}>
                          <span style={styles.nutrientName}>
                            {nutrient.name}
                          </span>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span style={styles.nutrientValue}>
                              {nutrient.current}/{nutrient.target}
                              {nutrient.unit}
                            </span>
                            <span
                              style={{
                                ...styles.statusBadge,
                                ...getStatusStyle(nutrient.status),
                              }}
                            >
                              {nutrient.status === 'good' ? '充足' : '不足'}
                            </span>
                          </div>
                        </div>
                        <div style={styles.progressBar}>
                          <motion.div
                            style={{
                              ...styles.progressFill,
                              background: getProgressColor(
                                nutrient.current,
                                nutrient.target,
                              ),
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${ratio}%` }}
                            transition={{
                              delay: 0.5 + index * 0.08,
                              duration: 0.6,
                              ease: 'easeOut',
                            }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              <div style={styles.recommendButton}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleRecommendClick}
                  style={{ width: '100%' }}
                >
                  おすすめ食材を見る
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default Meal
