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
import styles from './page.module.css'

const settingsSections = [
  {
    title: 'アカウント',
    items: [
      {
        id: 'profile',
        icon: User,
        title: 'プロフィール編集',
        description: '性別・年齢・お悩みの変更',
        iconBg: 'linear-gradient(135deg, #313131 0%, #0570b8 100%)',
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
        iconBg: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
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
      className={`${styles.toggle} ${value ? styles.toggleOn : styles.toggleOff}`}
      onClick={() => onChange(!value)}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className={styles.toggleKnob}
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
      <div className={styles.container}>
        <div className={styles.scrollArea}>
        {settingsSections.map((section, sectionIndex) => (
          <motion.div
            key={section.title}
            className={styles.section}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + sectionIndex * 0.05 }}
          >
            <h3 className={styles.sectionTitle}>{section.title}</h3>
            <div className={styles.card}>
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon
                const isLast = itemIndex === section.items.length - 1

                return (
                  <motion.div
                    key={item.id}
                    className={`${styles.item} ${isLast ? styles.itemLast : ''}`}
                    onClick={() => item.type !== 'toggle' && handleItemClick(item)}
                    whileHover={{
                      background: 'rgba(6, 147, 227, 0.04)',
                    }}
                    whileTap={item.type !== 'toggle' ? { scale: 0.98 } : {}}
                  >
                    <div
                      className={styles.itemIconWrapper}
                      style={{ background: item.iconBg }}
                    >
                      <Icon size={20} color="#ffffff" strokeWidth={1.8} />
                    </div>
                    <div className={styles.itemContent}>
                      <div className={`${styles.itemTitle} ${item.danger ? styles.danger : ''}`}>
                        {item.title}
                      </div>
                      <div className={styles.itemDescription}>
                        {item.description}
                      </div>
                    </div>
                    <div className={styles.itemAction}>
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
          className={styles.logoutContainer}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
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
          className={styles.version}
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
