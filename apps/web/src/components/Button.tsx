'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode, CSSProperties, useState } from 'react'

const baseStyles: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
    position: 'relative',
    overflow: 'hidden',
    letterSpacing: '0.02em',
}

// Premium gradients and shadows
const variants: Record<string, CSSProperties> = {
    primary: {
        background: 'linear-gradient(135deg, #1a3d2e 0%, #2f614b 100%)',
        color: '#ffffff',
        boxShadow: '0 8px 20px rgba(26, 61, 46, 0.2), 0 4px 8px rgba(26, 61, 46, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    secondary: {
        background: 'rgba(255, 255, 255, 0.95)',
        color: '#1a3d2e',
        border: '1px solid rgba(26, 61, 46, 0.1)',
        boxShadow: '0 4px 12px rgba(26, 61, 46, 0.05)',
        backdropFilter: 'blur(10px)',
    },
    ghost: {
        background: 'transparent',
        color: '#1a3d2e',
    },
    accent: {
        background: 'linear-gradient(135deg, #d4b46e 0%, #f0e2b6 100%)',
        color: '#1a3d2e',
        boxShadow: '0 8px 24px rgba(201, 169, 98, 0.25), 0 2px 6px rgba(201, 169, 98, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
    },
    danger: {
        background: 'linear-gradient(135deg, #c75652 0%, #e07e7b 100%)',
        color: '#ffffff',
        boxShadow: '0 8px 20px rgba(184, 84, 80, 0.25)',
    },
}

const sizes: Record<string, CSSProperties> = {
    sm: {
        padding: '10px 20px',
        fontSize: '13px',
        borderRadius: '12px',
        minHeight: '40px',
    },
    md: {
        padding: '14px 28px',
        fontSize: '15px',
        borderRadius: '16px',
        minHeight: '52px',
    },
    lg: {
        padding: '18px 36px',
        fontSize: '16px',
        borderRadius: '20px',
        minHeight: '60px',
    },
    full: {
        padding: '18px 36px',
        fontSize: '16px',
        borderRadius: '18px',
        minHeight: '60px',
        width: '100%',
    },
}

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "style"> {
    children: ReactNode
    variant?: 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger'
    size?: 'sm' | 'md' | 'lg' | 'full'
    icon?: ReactNode
    iconPosition?: 'left' | 'right'
    disabled?: boolean
    onClick?: () => void
    style?: CSSProperties
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
}: ButtonProps) {
    const [isHovered, setIsHovered] = useState(false);

    const buttonStyles: CSSProperties = {
        ...baseStyles,
        ...(variants[variant] || variants.primary),
        ...(sizes[size] || sizes.md),
        ...(disabled && {
            opacity: 0.6,
            cursor: 'not-allowed',
            filter: 'grayscale(100%)',
            boxShadow: 'none',
        }),
        ...style,
    }

    // Subtle shine effect overlay for primary/accent buttons
    const showShine = !disabled && (variant === 'primary' || variant === 'accent' || variant === 'danger');

    return (
        <motion.button
            style={buttonStyles}
            onClick={disabled ? undefined : onClick}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            whileHover={disabled ? {} : {
                scale: 1.02,
                y: -2,
                boxShadow: variant === 'ghost' ? 'none' : '0 12px 28px rgba(0,0,0,0.12)'
            }}
            whileTap={disabled ? {} : { scale: 0.96 }}
            disabled={disabled}
            {...props}
        >
            {showShine && (
                <motion.div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: -100,
                        width: '50px',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                        transform: 'skewX(-20deg)',
                    }}
                    animate={isHovered ? { left: '120%' } : { left: -100 }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                />
            )}

            {icon && iconPosition === 'left' && icon}
            <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
            {icon && iconPosition === 'right' && icon}
        </motion.button>
    )
}

export default Button
