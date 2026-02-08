'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  User, Shield, Trash2, LogOut,
  ChevronRight, HelpCircle, FileText
} from 'lucide-react'
import Button from '@/components/Button'
import Layout from '@/components/Layout'
import { signOutUser } from '@/lib/auth'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    width: '100%',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px 24px',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#9c958a',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '12px',
    paddingLeft: '4px',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.8)',
    boxShadow: '0 4px 20px rgba(26, 61, 46, 0.06)',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px 20px',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
    borderBottom: '1px solid rgba(26, 61, 46, 0.05)',
  },
  itemLast: {
    borderBottom: 'none',
  },
  itemIconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#1a3d2e',
    marginBottom: '2px',
  },
  itemDescription: {
    fontSize: '12px',
    color: '#9c958a',
  },
  itemAction: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  toggle: {
    width: '50px',
    height: '28px',
    borderRadius: '14px',
    padding: '2px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: 'none',
  },
  toggleOn: {
    background: 'linear-gradient(135deg, #419873 0%, #347a5c 100%)',
  },
  toggleOff: {
    background: '#d6d1c9',
  },
  toggleKnob: {
    width: '24px',
    height: '24px',
    borderRadius: '12px',
    background: '#ffffff',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    transition: 'transform 0.3s ease',
  },
  toggleKnobOn: {
    transform: 'translateX(22px)',
  },
  toggleKnobOff: {
    transform: 'translateX(0)',
  },
  danger: {
    color: '#b85450',
  },
  version: {
    textAlign: 'center',
    padding: '24px',
    color: '#b9b3a9',
    fontSize: '12px',
  },
}

const settingsSections = [
  {
    title: 'アカウント',
    items: [
      {
        id: 'profile',
        icon: User,
        title: 'プロフィール編集',
        description: '性別・年齢・お悩みの変更',
        iconBg: 'linear-gradient(135deg, #1a3d2e 0%, #347a5c 100%)',
        type: 'link',
        path: '/profile',
      },
    ],
  },
  {
    title: 'プライバシー',
    items: [
      {
        id: 'privacy',
        icon: Shield,
        title: 'プライバシー設定',
        description: 'データの取り扱い',
        iconBg: 'linear-gradient(135deg, #7c9a7c 0%, #a8dcc5 100%)',
        type: 'link',
        path: '/privacy',
      },
      {
        id: 'delete',
        icon: Trash2,
        title: 'データ削除',
        description: '削除内容を選択',
        iconBg: 'linear-gradient(135deg, #d47370 0%, #f0a5a3 100%)',
        type: 'link',
        path: '/settings/delete',
        danger: true,
      },
    ],
  },
  {
    title: 'その他',
    items: [
      {
        id: 'help',
        icon: HelpCircle,
        title: 'ヘルプ・FAQ',
        description: 'よくある質問',
        iconBg: 'linear-gradient(135deg, #5a8fb8 0%, #8bb8d9 100%)',
        type: 'link',
        path: '/help',
      },
      {
        id: 'terms',
        icon: FileText,
        title: '利用規約',
        description: 'サービス利用規約',
        iconBg: 'linear-gradient(135deg, #9c958a 0%, #b9b3a9 100%)',
        type: 'link',
        path: '/terms',
      },
    ],
  },
]

function Toggle({ value, onChange }) {
  return (
    <motion.button
      style={{
        ...styles.toggle,
        ...(value ? styles.toggleOn : styles.toggleOff),
      }}
      onClick={() => onChange(!value)}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        style={{
          ...styles.toggleKnob,
          ...(value ? styles.toggleKnobOn : styles.toggleKnobOff),
        }}
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </motion.button>
  )
}

function Settings() {
  const router = useRouter()
  const [toggleStates, setToggleStates] = useState({})

  const handleToggle = (id, value) => {
    setToggleStates(prev => ({ ...prev, [id]: value }))
  }

  const handleItemClick = (item) => {
    if (item.type === 'link' && item.path) {
      router.push(item.path)
    }
  }

  const handleLogout = () => {
    if (window.confirm('ログアウトしますか？')) {
      signOutUser().finally(() => {
        router.push('/login')
      })
    }
  }

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.scrollArea}>
        {settingsSections.map((section, sectionIndex) => (
          <motion.div
            key={section.title}
            style={styles.section}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + sectionIndex * 0.05 }}
          >
            <h3 style={styles.sectionTitle}>{section.title}</h3>
            <div style={styles.card}>
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon
                const isLast = itemIndex === section.items.length - 1

                return (
                  <motion.div
                    key={item.id}
                    style={{
                      ...styles.item,
                      ...(isLast ? styles.itemLast : {}),
                    }}
                    onClick={() => item.type !== 'toggle' && handleItemClick(item)}
                    whileHover={{
                      background: 'rgba(65, 152, 115, 0.04)',
                    }}
                    whileTap={item.type !== 'toggle' ? { scale: 0.98 } : {}}
                  >
                    <div
                      style={{
                        ...styles.itemIconWrapper,
                        background: item.iconBg,
                      }}
                    >
                      <Icon size={20} color="#ffffff" strokeWidth={1.8} />
                    </div>
                    <div style={styles.itemContent}>
                      <div
                        style={{
                          ...styles.itemTitle,
                          ...(item.danger ? styles.danger : {}),
                        }}
                      >
                        {item.title}
                      </div>
                      <div style={styles.itemDescription}>
                        {item.description}
                      </div>
                    </div>
                    <div style={styles.itemAction}>
                      {item.type === 'toggle' ? (
                        <Toggle
                          value={toggleStates[item.id]}
                          onChange={(v) => handleToggle(item.id, v)}
                        />
                      ) : (
                        <ChevronRight size={20} color="#b9b3a9" />
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        ))}

        {/* Logout Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ marginTop: '8px' }}
        >
          <Button
            variant="danger"
            size="full"
            icon={<LogOut size={18} />}
            onClick={handleLogout}
          >
            ログアウト
          </Button>
        </motion.div>

        {/* Version Info */}
        <motion.div
          style={styles.version}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p>薄毛対策AIエージェント</p>
          <p>バージョン 1.0.0</p>
        </motion.div>
        </div>
      </div>
    </Layout>
  )
}

export default Settings
