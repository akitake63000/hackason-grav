'use client'

import { Menu } from 'lucide-react'
import styles from './Header.module.css'

function Header({ isMobile, onMenuClick, title = '薄毛対策AI' }) {
  if (!isMobile) return null

  return (
    <header className={styles.mobileHeader}>
      <button
        className={styles.menuButton}
        onClick={onMenuClick}
        aria-label="メニューを開く"
        type="button"
      >
        <Menu size={24} />
      </button>
      <div className={styles.title}>{title}</div>
      <div className={styles.spacer} />
    </header>
  )
}

export default Header
