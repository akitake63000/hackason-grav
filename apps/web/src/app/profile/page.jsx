'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import Button from '@/components/Button'
import Layout from '@/components/Layout'
import { getFirestoreDb } from '@/lib/firebase'
import { useAuth } from '@/lib/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getUserProfile } from '@/lib/profile'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    width: '100%',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px 24px',
  },
  section: {
    marginBottom: '28px',
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  required: {
    fontSize: '11px',
    color: '#c9a962',
    fontWeight: '500',
    fontFamily: "'DM Sans', sans-serif",
  },
  genderGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
  },
  genderCard: {
    position: 'relative',
    padding: '24px 16px',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    border: '2px solid transparent',
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease',
  },
  genderCardSelected: {
    border: '2px solid #419873',
    background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.08) 0%, rgba(124, 154, 124, 0.04) 100%)',
  },
  genderIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
  },
  genderLabel: {
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  checkmark: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #419873 0%, #347a5c 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    boxShadow: '0 2px 8px rgba(65, 152, 115, 0.3)',
  },
  ageInputContainer: {
    position: 'relative',
    maxWidth: '200px',
  },
  ageInput: {
    width: '100%',
    padding: '16px 60px 16px 20px',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a3d2e',
    background: 'rgba(255, 255, 255, 0.9)',
    border: '1.5px solid rgba(26, 61, 46, 0.12)',
    borderRadius: '16px',
    outline: 'none',
    transition: 'all 0.3s ease',
    fontFamily: "'DM Sans', sans-serif",
    boxSizing: 'border-box',
  },
  ageInputFocused: {
    border: '1.5px solid #419873',
    boxShadow: '0 0 0 4px rgba(65, 152, 115, 0.1)',
  },
  ageSuffix: {
    position: 'absolute',
    right: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '16px',
    color: '#7f786d',
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  tag: {
    padding: '10px 18px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    border: '1.5px solid rgba(26, 61, 46, 0.1)',
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#635d54',
    transition: 'all 0.3s ease',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
  },
  tagSelected: {
    border: '1.5px solid #419873',
    background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.15) 0%, rgba(65, 152, 115, 0.08) 100%)',
    color: '#1a3d2e',
    fontWeight: '600',
  },
  footer: {
    padding: '16px 20px 8px',
    background: 'linear-gradient(180deg, transparent 0%, rgba(248, 246, 242, 1) 20%)',
  },
  hint: {
    fontSize: '12px',
    color: '#9c958a',
    textAlign: 'center',
    marginTop: '12px',
  },
}

const concerns = [
  { id: 'thinning', label: '髪が細くなった', emoji: '💇' },
  { id: 'hairline', label: '生え際が後退', emoji: '📏' },
  { id: 'crown', label: '頭頂部が薄い', emoji: '🎯' },
  { id: 'volume', label: 'ボリュームが減った', emoji: '📉' },
  { id: 'shedding', label: '抜け毛が増えた', emoji: '🍂' },
  { id: 'scalp', label: '頭皮が気になる', emoji: '🔍' },
  { id: 'stress', label: 'ストレス性', emoji: '😰' },
  { id: 'postpartum', label: '産後の脱毛', emoji: '👶' },
  { id: 'prevention', label: '予防したい', emoji: '🛡️' },
]

function Profile() {
  const router = useRouter()
  const { user } = useAuth()
  const [gender, setGender] = useState(null)
  const [age, setAge] = useState('')
  const [selectedConcerns, setSelectedConcerns] = useState([])
  const [isAgeFocused, setIsAgeFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    getUserProfile(user.uid)
      .then((profile) => {
        if (!profile) return
        if (profile.gender) setGender(profile.gender)
        if (profile.birthDate) setAge(profile.birthDate)
        if (Array.isArray(profile.concernAreas)) setSelectedConcerns(profile.concernAreas)
      })
      .finally(() => setIsLoading(false))
  }, [user])

  const toggleConcern = (id) => {
    setSelectedConcerns(prev =>
      prev.includes(id)
        ? prev.filter(c => c !== id)
        : [...prev, id]
    )
  }

  const handleSave = async () => {
    if (!user) {
      router.push('/login')
      return
    }
    try {
      const db = getFirestoreDb()
      await setDoc(doc(db, 'users', user.uid, 'profile', 'default'), {
        gender,
        birthDate: age,
        concernAreas: selectedConcerns,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    } finally {
      router.push('/home')
    }
  }

  const isValid = gender && age && selectedConcerns.length > 0 && !isLoading

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.scrollArea}>
        {/* Gender Selection */}
        <motion.div
          style={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div style={styles.sectionTitle}>
            性別
            <span style={styles.required}>必須</span>
          </div>
          <div style={styles.genderGrid}>
            {/* Male */}
            <motion.div
              style={{
                ...styles.genderCard,
                ...(gender === 'male' ? styles.genderCardSelected : {}),
              }}
              onClick={() => setGender('male')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <AnimatePresence>
                {gender === 'male' && (
                  <motion.div
                    style={styles.checkmark}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div
                style={{
                  ...styles.genderIcon,
                  background: 'linear-gradient(135deg, rgba(90, 139, 184, 0.15) 0%, rgba(90, 139, 184, 0.05) 100%)',
                }}
              >
                👨
              </div>
              <span style={styles.genderLabel}>男性</span>
            </motion.div>

            {/* Female */}
            <motion.div
              style={{
                ...styles.genderCard,
                ...(gender === 'female' ? styles.genderCardSelected : {}),
              }}
              onClick={() => setGender('female')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <AnimatePresence>
                {gender === 'female' && (
                  <motion.div
                    style={styles.checkmark}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div
                style={{
                  ...styles.genderIcon,
                  background: 'linear-gradient(135deg, rgba(196, 122, 90, 0.15) 0%, rgba(196, 122, 90, 0.05) 100%)',
                }}
              >
                👩
              </div>
              <span style={styles.genderLabel}>女性</span>
            </motion.div>

            {/* Prefer not to say */}
            <motion.div
              style={{
                ...styles.genderCard,
                ...(gender === 'prefer-not-to-say' ? styles.genderCardSelected : {}),
              }}
              onClick={() => setGender('prefer-not-to-say')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <AnimatePresence>
                {gender === 'prefer-not-to-say' && (
                  <motion.div
                    style={styles.checkmark}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div
                style={{
                  ...styles.genderIcon,
                  background: 'linear-gradient(135deg, rgba(150, 150, 150, 0.15) 0%, rgba(150, 150, 150, 0.05) 100%)',
                }}
              >
                ❓
              </div>
              <span style={styles.genderLabel}>回答なし</span>
            </motion.div>
          </div>
        </motion.div>

        {/* Age Input */}
        <motion.div
          style={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div style={styles.sectionTitle}>
            年齢
            <span style={styles.required}>必須</span>
          </div>
          <div style={styles.ageInputContainer}>
            <input
              type="number"
              style={{
                ...styles.ageInput,
                ...(isAgeFocused ? styles.ageInputFocused : {}),
              }}
              placeholder="例: 35"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              onFocus={() => setIsAgeFocused(true)}
              onBlur={() => setIsAgeFocused(false)}
              min="10"
              max="100"
            />
            <span style={styles.ageSuffix}>歳</span>
          </div>
        </motion.div>

        {/* Concerns Selection */}
        <motion.div
          style={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div style={styles.sectionTitle}>
            お悩み
            <span style={styles.required}>1つ以上選択</span>
          </div>
          <div style={styles.tagsContainer}>
            {concerns.map((concern, index) => (
              <motion.div
                key={concern.id}
                style={{
                  ...styles.tag,
                  ...(selectedConcerns.includes(concern.id) ? styles.tagSelected : {}),
                }}
                onClick={() => toggleConcern(concern.id)}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.03 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span style={{ marginRight: '6px' }}>{concern.emoji}</span>
                {concern.label}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Save Button */}
      <motion.div
        style={styles.footer}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          size="full"
          onClick={handleSave}
          disabled={!isValid}
        >
          保存して始める
        </Button>
        <p style={styles.hint}>
          設定は後から変更できます
        </p>
      </motion.div>
      </div>
    </Layout>
  )
}

export default Profile
