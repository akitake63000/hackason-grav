'use client'

import { motion } from 'framer-motion'

const styles = {
  bottomNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(26, 61, 46, 0.08)',
    zIndex: 90,
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    padding: '8px 12px',
    gap: '4px',
  },
  bottomNavItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: '6px 4px',
    borderRadius: '12px',
  },
  bottomNavLabel: {
    fontSize: '10px',
    color: '#9c958a',
    fontWeight: '500',
  },
  bottomNavLabelActive: {
    color: '#1a3d2e',
  },
}

function BottomNav({ isMobile, items, isActive, onNavigate }) {
  if (!isMobile) return null

  const navItems = items.filter(item => item.id !== 'settings')

  return (
    <nav style={styles.bottomNav}>
      {navItems.map((item) => {
        const Icon = item.icon
        const active = isActive(item)

        return (
          <motion.button
            key={item.id}
            style={styles.bottomNavItem}
            onClick={() => onNavigate(item.path)}
            whileTap={{ scale: 0.95 }}
            type="button"
          >
            <Icon
              size={22}
              color={active ? '#1a3d2e' : '#9c958a'}
              strokeWidth={active ? 2.5 : 2}
            />
            <span style={{
              ...styles.bottomNavLabel,
              ...(active ? styles.bottomNavLabelActive : {}),
            }}>
              {item.label}
            </span>
          </motion.button>
        )
      })}
    </nav>
  )
}

export default BottomNav
