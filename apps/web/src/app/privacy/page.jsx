'use client'

import { motion } from 'framer-motion'
import Layout from '@/components/Layout'
import Card from '@/components/Card'

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
    padding: '0 20px 32px',
  },
  header: {
    margin: '12px 0 20px',
  },
  title: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  subtitle: {
    fontSize: '12px',
    color: '#9c958a',
    marginTop: '6px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '8px',
  },
  text: {
    fontSize: '13px',
    color: '#635d54',
    lineHeight: 1.6,
  },
  list: {
    margin: '10px 0 0',
    paddingLeft: '18px',
    color: '#635d54',
    fontSize: '13px',
    lineHeight: 1.6,
  },
  listItem: {
    marginBottom: '6px',
  },
}

const sections = [
  {
    title: '収集する情報',
    body: 'アカウント作成やサービス提供に必要な範囲で情報を取得します。',
    items: [
      'プロフィール情報（性別・年齢・お悩みなど）',
      '利用履歴（解析結果・レポート・チャット履歴）',
      '端末情報（最低限の識別子・ログ情報）',
    ],
  },
  {
    title: '利用目的',
    body: '取得した情報は、以下の目的で利用します。',
    items: [
      'パーソナライズされたアドバイスの提供',
      '機能改善や品質向上のための分析',
      '不正利用防止とセキュリティ確保',
    ],
  },
  {
    title: '第三者提供',
    body: '法令に基づく場合を除き、本人の同意なく第三者に提供しません。',
  },
  {
    title: 'データ保持と削除',
    body: '退会・データ削除の申請があった場合は、合理的な範囲で速やかに削除します。',
  },
  {
    title: 'お問い合わせ',
    body: 'プライバシーに関するお問い合わせは、サポート窓口までご連絡ください。',
  },
]

function Privacy() {
  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.scrollArea}>
          <motion.div
            style={styles.header}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <h1 style={styles.title}>プライバシーポリシー</h1>
            <p style={styles.subtitle}>最終更新日: 2026-02-03</p>
          </motion.div>

          <Card padding="lg" delay={0.1}>
            {sections.map((section, index) => (
              <div
                key={section.title}
                style={{
                  borderBottom: index < sections.length - 1 ? '1px solid rgba(156, 149, 138, 0.15)' : 'none',
                  paddingBottom: index < sections.length - 1 ? '24px' : '0',
                  marginBottom: index < sections.length - 1 ? '24px' : '0'
                }}
              >
                <div style={styles.sectionTitle}>{section.title}</div>
                <p style={styles.text}>{section.body}</p>
                {section.items && (
                  <ul style={styles.list}>
                    {section.items.map((item) => (
                      <li key={item} style={styles.listItem}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </Layout>
  )
}

export default Privacy
