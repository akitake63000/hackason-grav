'use client'

import { motion } from 'framer-motion'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  circleWrapper: {
    position: 'relative',
  },
  svg: {
    transform: 'rotate(-90deg)',
  },
  scoreText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
  },
  value: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontWeight: '600',
    color: '#313131',
    lineHeight: 1,
  },
  unit: {
    fontSize: '12px',
    color: '#7f786d',
    fontWeight: '500',
    marginTop: '2px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#635d54',
    textAlign: 'center',
  },
}

const getColor = (score, type = 'default') => {
  if (type === 'gradient') {
    if (score >= 70) return ['#0693e3', '#7cc4a5']
    if (score >= 40) return ['#38bdf8', '#0ea5e9']
    return ['#b85450', '#d47370']
  }

  if (score >= 70) return '#0693e3'
  if (score >= 40) return '#38bdf8'
  return '#b85450'
}

function ScoreCircle({
  score,
  maxScore = 100,
  size = 120,
  strokeWidth = 8,
  label,
  unit = '',
  showGradient = true,
  delay = 0,
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / maxScore) * circumference
  const color = getColor(score)
  const gradientColors = getColor(score, 'gradient')
  const gradientId = `scoreGradient-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div style={styles.container}>
      <div style={styles.circleWrapper}>
        <svg
          width={size}
          height={size}
          style={styles.svg}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradientColors[0]} />
              <stop offset="100%" stopColor={gradientColors[1]} />
            </linearGradient>
          </defs>

          {/* Background Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#ebe8e3"
            strokeWidth={strokeWidth}
          />

          {/* Progress Circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={showGradient ? `url(#${gradientId})` : color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{
              duration: 1.2,
              delay,
              ease: [0.34, 1.56, 0.64, 1],
            }}
          />
        </svg>

        <div style={styles.scoreText}>
          <motion.div
            style={{
              ...styles.value,
              fontSize: size > 100 ? '32px' : '24px',
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: delay + 0.3 }}
          >
            {score}
          </motion.div>
          {unit && <div style={styles.unit}>{unit}</div>}
        </div>
      </div>

      {label && (
        <motion.span
          style={styles.label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.5 }}
        >
          {label}
        </motion.span>
      )}
    </div>
  )
}

export default ScoreCircle
