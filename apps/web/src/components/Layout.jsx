'use client'

import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Camera, MessageCircle, Leaf, Settings,
  X, ChevronRight
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import PhoneFrame from '@/components/PhoneFrame'
import { hasUserProfile } from '@/lib/profile'

const navItems = [
  { id: 'home', icon: Home, label: 'ホーム', path: '/home' },
  { id: 'feature1', icon: Camera, label: 'AIチェック', path: '/feature1/capture',
    subItems: [
      { label: '撮影ガイド＆撮影', path: '/feature1/capture' },
      { label: '解析結果', path: '/feature1/result' },
      { label: 'ダッシュボード', path: '/feature1/dashboard' },
      { label: 'レポート詳細', path: '/feature1/report' },
    ]
  },
  { id: 'feature2', icon: MessageCircle, label: 'お悩み相談', path: '/feature2/chat',
    subItems: [
      { label: 'チャット', path: '/feature2/chat' },
      { label: 'チーム会議', path: '/feature2/team-meeting' },
      { label: '設定', path: '/feature2/settings' },
    ]
  },
  { id: 'feature3', icon: Leaf, label: '生活アドバイス', path: '/feature3/tendency',
    subItems: [
      { label: '傾向分析', path: '/feature3/tendency' },
      { label: '食事記録', path: '/feature3/meal' },
      { label: '食材レコメンド', path: '/feature3/food-recommend' },
      { label: '運動レコメンド', path: '/feature3/exercise-recommend' },
      { label: '近くの店舗', path: '/feature3/nearby-stores' },
    ]
  },
  { id: 'settings', icon: Settings, label: '設定', path: '/settings' },
]

const styles = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
    background: 'linear-gradient(165deg, #d4f0e3 0%, #f8f6f2 30%, #ebe8e3 100%)',
  },
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(165deg, #d4f0e3 0%, #f8f6f2 30%, #ebe8e3 100%)',
    color: '#7f786d',
    fontSize: '14px',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
  },
  // Sidebar (Desktop)
  sidebar: {
    width: '280px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRight: '1px solid rgba(26, 61, 46, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    zIndex: 100,
  },
  sidebarHidden: {
    display: 'none',
  },
  logo: {
    padding: '24px',
    borderBottom: '1px solid rgba(26, 61, 46, 0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoIcon: {
    width: '40px',
    height: '40px',
    background: 'linear-gradient(135deg, #1a3d2e 0%, #347a5c 100%)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  logoText: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  navList: {
    flex: 1,
    padding: '16px 12px',
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '4px',
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    color: '#635d54',
    fontSize: '14px',
    fontWeight: '500',
  },
  navItemActive: {
    background: 'rgba(65, 152, 115, 0.1)',
    color: '#1a3d2e',
    fontWeight: '600',
  },
  navItemHover: {
    background: 'rgba(26, 61, 46, 0.05)',
  },
  subNav: {
    paddingLeft: '48px',
    overflow: 'hidden',
  },
  subNavItem: {
    display: 'block',
    padding: '8px 12px',
    fontSize: '13px',
    color: '#7f786d',
    textDecoration: 'none',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
  },
  subNavItemActive: {
    color: '#1a3d2e',
    background: 'rgba(65, 152, 115, 0.08)',
    fontWeight: '500',
  },
  // Main content
  main: {
    flex: 1,
    marginLeft: '280px',
    minHeight: '100vh',
    position: 'relative',
  },
  mainMobile: {
    marginLeft: 0,
    paddingBottom: '80px',
  },
  // Overlay
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    zIndex: 95,
  },
  // Decorative blobs
  blob1: {
    position: 'fixed',
    top: '-20%',
    right: '-10%',
    width: '60%',
    height: '50%',
    background: 'radial-gradient(ellipse at center, rgba(65, 152, 115, 0.08) 0%, transparent 70%)',
    borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
    pointerEvents: 'none',
    zIndex: 0,
  },
  blob2: {
    position: 'fixed',
    bottom: '-10%',
    left: '-20%',
    width: '50%',
    height: '40%',
    background: 'radial-gradient(ellipse at center, rgba(201, 169, 98, 0.06) 0%, transparent 60%)',
    borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
    pointerEvents: 'none',
    zIndex: 0,
  },
}

function Layout({ children }) {
  const router = useRouter()
  const pathname = usePathname() ?? '/'
  const { user, loading } = useAuth()
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedNav, setExpandedNav] = useState(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (loading || !user) return
    if (pathname.startsWith('/onboarding')) return
    hasUserProfile(user.uid)
      .then((exists) => {
        if (!exists) {
          router.replace('/onboarding')
        }
      })
      .catch(() => {
        router.replace('/onboarding')
      })
  }, [loading, user, pathname, router])

  // Auto-expand current section
  useEffect(() => {
    const currentItem = navItems.find(item =>
      pathname.startsWith(`/${item.id}`) ||
      (item.subItems && item.subItems.some(sub => sub.path === pathname))
    )
    if (currentItem?.subItems) {
      setExpandedNav(currentItem.id)
    }
  }, [pathname])

  if (loading) {
    return (
      <div style={styles.loading}>
        認証を確認中...
      </div>
    )
  }

  if (!user) {
    return null
  }

  const isActive = (item) => {
    if (item.path === pathname) return true
    if (item.subItems) {
      return item.subItems.some(sub => sub.path === pathname)
    }
    return pathname.startsWith(`/${item.id}`)
  }

  const handleNavClick = (item) => {
    if (item.subItems) {
      setExpandedNav(expandedNav === item.id ? null : item.id)
    } else {
      router.push(item.path)
      if (isMobile) setSidebarOpen(false)
    }
  }

  const handleSubNavClick = (path) => {
    router.push(path)
    if (isMobile) setSidebarOpen(false)
  }

  const SidebarContent = () => (
    <>
      <div style={styles.logo}>
        <div style={styles.logoIcon}>🌿</div>
        <span style={styles.logoText}>薄毛対策AIエージェント</span>
      </div>
      <nav style={styles.navList}>
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item)
          const expanded = expandedNav === item.id

          return (
            <div key={item.id}>
              <motion.button
                style={{
                  ...styles.navItem,
                  ...(active ? styles.navItemActive : {}),
                }}
                onClick={() => handleNavClick(item)}
                whileHover={{ background: active ? 'rgba(65, 152, 115, 0.15)' : 'rgba(26, 61, 46, 0.05)' }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon size={20} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.subItems && (
                  <motion.div
                    animate={{ rotate: expanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight size={16} />
                  </motion.div>
                )}
              </motion.button>

              {item.subItems && (
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      style={styles.subNav}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {item.subItems.map((subItem) => (
                        <motion.button
                          key={subItem.path}
                          style={{
                            ...styles.subNavItem,
                            ...(pathname === subItem.path ? styles.subNavItemActive : {}),
                          }}
                          onClick={() => handleSubNavClick(subItem.path)}
                          whileHover={{ background: 'rgba(65, 152, 115, 0.08)' }}
                        >
                          {subItem.label}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          )
        })}
      </nav>
    </>
  )

  return (
    <div style={styles.layout}>
      {/* Decorative blobs */}
      <div style={styles.blob1} />
      <div style={styles.blob2} />

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside style={styles.sidebar}>
          <SidebarContent />
        </aside>
      )}

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <>
            <motion.div
              style={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              style={{ ...styles.sidebar, width: '280px' }}
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <Header
        isMobile={isMobile}
        onMenuClick={() => setSidebarOpen(true)}
        title="薄毛対策AI"
      />

      {/* Main Content */}
      <main style={{
        ...styles.main,
        ...(isMobile ? styles.mainMobile : {}),
        paddingTop: isMobile ? '60px' : 0,
      }}>
        <PhoneFrame>
          {children}
        </PhoneFrame>
      </main>

      <BottomNav
        isMobile={isMobile}
        items={navItems}
        isActive={isActive}
        onNavigate={(path) => router.push(path)}
      />
    </div>
  )
}

export default Layout
