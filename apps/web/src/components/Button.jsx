'use client'

import { motion } from 'framer-motion'

const baseStyles = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
  fontWeight: '600',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  position: 'relative',
  overflow: 'hidden',
}

const variants = {
  primary: {
    background: 'linear-gradient(135deg, #1a3d2e 0%, #275c45 100%)',
    color: '#ffffff',
    boxShadow: '0 4px 14px rgba(26, 61, 46, 0.25), 0 2px 6px rgba(26, 61, 46, 0.15)',
  },
  secondary: {
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#1a3d2e',
    border: '1.5px solid rgba(26, 61, 46, 0.15)',
    boxShadow: '0 2px 8px rgba(26, 61, 46, 0.06)',
  },
  ghost: {
    background: 'transparent',
    color: '#1a3d2e',
  },
  accent: {
    background: 'linear-gradient(135deg, #c9a962 0%, #e8d9a8 100%)',
    color: '#1a3d2e',
    boxShadow: '0 4px 14px rgba(201, 169, 98, 0.3)',
  },
  danger: {
    background: 'linear-gradient(135deg, #b85450 0%, #d47370 100%)',
    color: '#ffffff',
    boxShadow: '0 4px 14px rgba(184, 84, 80, 0.25)',
  },
}

const sizes = {
  sm: {
    padding: '8px 16px',
    fontSize: '13px',
    borderRadius: '10px',
    minHeight: '36px',
  },
  md: {
    padding: '12px 24px',
    fontSize: '15px',
    borderRadius: '14px',
    minHeight: '48px',
  },
  lg: {
    padding: '16px 32px',
    fontSize: '16px',
    borderRadius: '16px',
    minHeight: '56px',
  },
  full: {
    padding: '16px 32px',
    fontSize: '16px',
    borderRadius: '16px',
    minHeight: '56px',
    width: '100%',
  },
}

function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  onClick,
  style,
  ...props
}) {
  const buttonStyles = {
    ...baseStyles,
    ...variants[variant],
    ...sizes[size],
    ...(disabled && {
      opacity: 0.5,
      cursor: 'not-allowed',
    }),
    ...style,
  }

  return (
    <motion.button
      style={buttonStyles}
      onClick={disabled ? undefined : onClick}
      whileHover={disabled ? {} : { scale: 1.02, y: -1 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      {...props}
    >
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </motion.button>
  )
}

export default Button
