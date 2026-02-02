'use client'

import { motion } from 'framer-motion'

const baseStyles = {
  background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: '20px',
  border: '1px solid rgba(255, 255, 255, 0.8)',
  boxShadow: '0 4px 20px rgba(26, 61, 46, 0.06), 0 1px 3px rgba(26, 61, 46, 0.04)',
  overflow: 'hidden',
  transition: 'all 0.3s ease',
}

const variants = {
  default: {},
  elevated: {
    boxShadow: '0 10px 40px rgba(26, 61, 46, 0.1), 0 4px 12px rgba(26, 61, 46, 0.06)',
  },
  outlined: {
    background: 'transparent',
    backdropFilter: 'none',
    border: '1.5px solid rgba(26, 61, 46, 0.12)',
    boxShadow: 'none',
  },
  filled: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8f6f2 100%)',
    backdropFilter: 'none',
  },
  accent: {
    background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.08) 0%, rgba(124, 154, 124, 0.04) 100%)',
    border: '1px solid rgba(65, 152, 115, 0.15)',
  },
}

const paddings = {
  none: {},
  sm: { padding: '12px' },
  md: { padding: '16px' },
  lg: { padding: '20px' },
  xl: { padding: '24px' },
}

function Card({
  children,
  variant = 'default',
  padding = 'md',
  hoverable = false,
  onClick,
  style,
  animate = true,
  delay = 0,
  ...props
}) {
  const cardStyles = {
    ...baseStyles,
    ...variants[variant],
    ...paddings[padding],
    ...(onClick && { cursor: 'pointer' }),
    ...style,
  }

  const hoverAnimation = hoverable ? {
    y: -4,
    boxShadow: '0 16px 48px rgba(26, 61, 46, 0.12), 0 8px 16px rgba(26, 61, 46, 0.08)',
  } : {}

  return (
    <motion.div
      style={cardStyles}
      onClick={onClick}
      initial={animate ? { opacity: 0, y: 20 } : false}
      animate={animate ? { opacity: 1, y: 0 } : false}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={hoverAnimation}
      whileTap={onClick ? { scale: 0.98 } : {}}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export default Card
