'use client'

import { motion } from 'framer-motion'

const baseStyles = {
  background: '#ffffff',
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
  borderRadius: '12px',
  border: '1px solid #eee',
  boxShadow: '6px 6px 9px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden',
  transition: 'all 0.3s ease',
}

const variants = {
  default: {},
  elevated: {
    boxShadow: '12px 12px 50px rgba(0, 0, 0, 0.15)',
  },
  outlined: {
    background: 'transparent',
    backdropFilter: 'none',
    border: '1.5px solid #eee',
    boxShadow: 'none',
  },
  filled: {
    background: '#f5f5f5',
    backdropFilter: 'none',
  },
  accent: {
    background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)',
    border: '1px solid rgba(6, 147, 227, 0.2)',
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
    boxShadow: '12px 12px 50px rgba(0, 0, 0, 0.2)',
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
