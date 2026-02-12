'use client'

import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Camera, MessageCircle, Leaf, Settings,
  ChevronRight
} from 'lucide-react'
import { useState, useEffect, useTransition, useCallback, memo } from 'react'
import { useAuth } from '@/lib/auth'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import PhoneFrame from '@/components/PhoneFrame'
import { hasUserProfile } from '@/lib/profile'
import styles from './Layout.module.css'

const navItems = [
  { id: 'home', icon: Home, label: 'ホーム', path: '/home' },
  {
    id: 'feature1', icon: Camera, label: 'AIチェック', path: '/feature1/capture',
    subItems: [
      { label: '撮影ガイド＆撮影', path: '/feature1/capture' },
      { label: '解析結果', path: '/feature1/result' },
      { label: 'ダッシュボード', path: '/feature1/dashboard' },
      { label: 'レポート詳細', path: '/feature1/report' },
    ]
  },
  {
    id: 'feature2', icon: MessageCircle, label: 'お悩み相談', path: '/feature2/chat',
    subItems: [
      { label: 'チャット', path: '/feature2/chat' },
      { label: '設定', path: '/feature2/settings' },
    ]
  },
  {
    id: 'feature3', icon: Leaf, label: '生活アドバイス', path: '/feature3/tendency',
    subItems: [
      { label: '傾向分析', path: '/feature3/tendency' },
      { label: '生活習慣改善レコメンド', path: '/feature3/lifestyle-recommend' },
      { label: '週間アクションプラン', path: '/feature3/weekly-plan' },
      { label: '食材レコメンド', path: '/feature3/food-recommend' },
      // { label: '運動レコメンド', path: '/feature3/exercise-recommend' }, // 廃止
    ]
  },
  { id: 'settings', icon: Settings, label: '設定', path: '/settings' },
]

// Styles moved to Layout.module.css

// Memoized Sidebar Component
const SidebarContent = memo(({ pathname, expandedNav, onNavClick, onSubNavClick }) => {
  const isActive = (item) => {
    if (item.path === pathname) return true
    if (item.subItems) {
      return item.subItems.some(sub => sub.path === pathname)
    }
    return pathname.startsWith(`/${item.id}`)
  }

  return (
    <>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <Leaf size={20} color="#ffffff" strokeWidth={1.5} />
        </div>
        <span className={styles.logoText}>薄毛対策AIエージェント</span>
      </div>
      <nav className={styles.navList}>
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item)
          const expanded = expandedNav === item.id

          return (
            <div key={item.id}>
              <button
                className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                onClick={() => onNavClick(item)}
                aria-current={active && !item.subItems ? 'page' : undefined}
                aria-expanded={item.subItems ? expanded : undefined}
              >
                <Icon size={20} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.subItems && (
                  <div className={`${styles.chevron} ${expanded ? styles.chevronExpanded : ''}`}>
                    <ChevronRight size={16} />
                  </div>
                )}
              </button>

              {item.subItems && expanded && (
                <div className={styles.subNav}>
                  {item.subItems.map((subItem) => (
                    <button
                      key={subItem.path}
                      className={`${styles.subNavItem} ${pathname === subItem.path ? styles.subNavItemActive : ''}`}
                      onClick={() => onSubNavClick(subItem.path)}
                      aria-current={pathname === subItem.path ? 'page' : undefined}
                    >
                      {subItem.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </>
  )
})

function Layout({ children }) {
  const router = useRouter()
  const pathname = usePathname() ?? '/'
  const { user, loading } = useAuth()
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedNav, setExpandedNav] = useState(null)
  const [isPending, startTransition] = useTransition()

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

  // Define callbacks before any conditional returns (React Hooks rules)
  const isActive = useCallback((item) => {
    if (item.path === pathname) return true
    if (item.subItems) {
      return item.subItems.some(sub => sub.path === pathname)
    }
    return pathname.startsWith(`/${item.id}`)
  }, [pathname])

  const handleNavClick = useCallback((item) => {
    if (item.subItems) {
      setExpandedNav(prev => prev === item.id ? null : item.id)
    } else {
      startTransition(() => {
        router.push(item.path)
      })
      if (isMobile) setSidebarOpen(false)
    }
  }, [isMobile, router, startTransition])

  const handleSubNavClick = useCallback((path) => {
    startTransition(() => {
      router.push(path)
    })
    if (isMobile) setSidebarOpen(false)
  }, [isMobile, router, startTransition])

  if (loading) {
    return (
      <div className={styles.loading}>
        認証を確認中...
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className={styles.layout}>
      {/* Loading bar during page transitions */}
      <AnimatePresence>
        {isPending && (
          <motion.div
            className={styles.loadingBar}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 1, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* Decorative blobs */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className={styles.sidebar}>
          <SidebarContent
            pathname={pathname}
            expandedNav={expandedNav}
            onNavClick={handleNavClick}
            onSubNavClick={handleSubNavClick}
          />
        </aside>
      )}

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <>
            <motion.div
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              className={styles.sidebarMobile}
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <SidebarContent
                pathname={pathname}
                expandedNav={expandedNav}
                onNavClick={handleNavClick}
                onSubNavClick={handleSubNavClick}
              />
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
      <main className={styles.main}>
        <PhoneFrame>
          {children}
        </PhoneFrame>
      </main>

      <BottomNav
        isMobile={isMobile}
        items={navItems}
        isActive={isActive}
        onNavigate={(path) => startTransition(() => router.push(path))}
      />
    </div>
  )
}

export default Layout
