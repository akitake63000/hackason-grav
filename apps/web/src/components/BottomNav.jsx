'use client'

import { motion } from 'framer-motion'
import styles from './BottomNav.module.css'

function BottomNav({ isMobile, items, isActive, onNavigate }) {
  if (!isMobile) return null

  const navItems = items.filter(item => item.id !== 'settings')

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item) => {
        const Icon = item.icon
        const active = isActive(item)

        return (
          <motion.button
            key={item.id}
            className={styles.bottomNavItem}
            onClick={() => onNavigate(item.path)}
            whileTap={{ scale: 0.95 }}
            type="button"
          >
            <Icon
              size={22}
              color={active ? '#1a3d2e' : '#9c958a'}
              strokeWidth={active ? 2.5 : 2}
            />
            <span className={`${styles.bottomNavLabel} ${active ? styles.bottomNavLabelActive : ''}`}>
              {item.label}
            </span>
          </motion.button>
        )
      })}
    </nav>
  )
}

export default BottomNav
