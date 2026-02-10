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
import styles from './page.module.css'

// Inline styles for dynamic gradient values
const genderIconGradients = {
  male: 'linear-gradient(135deg, rgba(90, 139, 184, 0.15) 0%, rgba(90, 139, 184, 0.05) 100%)',
  female: 'linear-gradient(135deg, rgba(196, 122, 90, 0.15) 0%, rgba(196, 122, 90, 0.05) 100%)',
  preferNotToSay: 'linear-gradient(135deg, rgba(150, 150, 150, 0.15) 0%, rgba(150, 150, 150, 0.05) 100%)',
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
      <div className={styles.container}>
        <div className={styles.scrollArea}>
        {/* Gender Selection */}
        <motion.div
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className={styles.sectionTitle}>
            性別
            <span className={styles.required}>必須</span>
          </div>
          <div className={styles.genderGrid}>
            {/* Male */}
            <motion.div
              className={`${styles.genderCard} ${gender === 'male' ? styles.genderCardSelected : ''}`}
              onClick={() => setGender('male')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <AnimatePresence>
                {gender === 'male' && (
                  <motion.div
                    className={styles.checkmark}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div
                className={styles.genderIcon}
                style={{ background: genderIconGradients.male }}
              >
                👨
              </div>
              <span className={styles.genderLabel}>男性</span>
            </motion.div>

            {/* Female */}
            <motion.div
              className={`${styles.genderCard} ${gender === 'female' ? styles.genderCardSelected : ''}`}
              onClick={() => setGender('female')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <AnimatePresence>
                {gender === 'female' && (
                  <motion.div
                    className={styles.checkmark}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div
                className={styles.genderIcon}
                style={{ background: genderIconGradients.female }}
              >
                👩
              </div>
              <span className={styles.genderLabel}>女性</span>
            </motion.div>

            {/* Prefer not to say */}
            <motion.div
              className={`${styles.genderCard} ${gender === 'prefer-not-to-say' ? styles.genderCardSelected : ''}`}
              onClick={() => setGender('prefer-not-to-say')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <AnimatePresence>
                {gender === 'prefer-not-to-say' && (
                  <motion.div
                    className={styles.checkmark}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div
                className={styles.genderIcon}
                style={{ background: genderIconGradients.preferNotToSay }}
              >
                ❓
              </div>
              <span className={styles.genderLabel}>回答なし</span>
            </motion.div>
          </div>
        </motion.div>

        {/* Age Input */}
        <motion.div
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className={styles.sectionTitle}>
            年齢
            <span className={styles.required}>必須</span>
          </div>
          <div className={styles.ageInputContainer}>
            <input
              type="number"
              className={styles.ageInput}
              placeholder="例: 35"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              min="10"
              max="100"
            />
            <span className={styles.ageSuffix}>歳</span>
          </div>
        </motion.div>

        {/* Concerns Selection */}
        <motion.div
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className={styles.sectionTitle}>
            お悩み
            <span className={styles.required}>1つ以上選択</span>
          </div>
          <div className={styles.tagsContainer}>
            {concerns.map((concern, index) => (
              <motion.div
                key={concern.id}
                className={`${styles.tag} ${selectedConcerns.includes(concern.id) ? styles.tagSelected : ''}`}
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
        className={styles.footer}
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
        <p className={styles.hint}>
          設定は後から変更できます
        </p>
      </motion.div>
      </div>
    </Layout>
  )
}

export default Profile
