'use client'

import { Menu } from 'lucide-react'

const styles = {
  mobileHeader: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '60px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(26, 61, 46, 0.08)',
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
  },
  menuButton: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '10px',
    color: '#1a3d2e',
  },
  title: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
}

function Header({ isMobile, onMenuClick, title = '薄毛対策AI' }) {
  if (!isMobile) return null

  return (
    <header style={styles.mobileHeader}>
      <button
        style={styles.menuButton}
        onClick={onMenuClick}
        aria-label="メニューを開く"
        type="button"
      >
        <Menu size={24} />
      </button>
      <div style={styles.title}>{title}</div>
      <div style={{ width: 40 }} />
    </header>
  )
}

export default Header
