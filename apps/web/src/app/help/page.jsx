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
  question: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '6px',
  },
  answer: {
    fontSize: '13px',
    color: '#635d54',
    lineHeight: 1.6,
  },
}

const faqs = [
  {
    q: 'ログインできません。',
    a: '通信状態をご確認のうえ、再度ログインをお試しください。解決しない場合はサポートまでご連絡ください。',
  },
  {
    q: '初回ログイン後にオンボーディングが表示されません。',
    a: 'プロフィールが登録済みの場合はホームへ遷移します。プロフィールを変更する場合は設定から編集してください。',
  },
  {
    q: '解析結果が反映されません。',
    a: '画像の品質や回線状況によって解析に時間がかかる場合があります。しばらくお待ちください。',
  },
  {
    q: '通知が届きません。',
    a: '現在、プッシュ通知は準備中です。今後のアップデートで対応予定です。',
  },
  {
    q: 'データ削除について知りたいです。',
    a: '設定画面の「データ削除」から削除が可能です。削除後は復元できませんのでご注意ください。',
  },
]

function Help() {
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
            <h1 style={styles.title}>ヘルプ・FAQ</h1>
            <p style={styles.subtitle}>よくある質問</p>
          </motion.div>

          {faqs.map((item, index) => (
            <Card key={item.q} padding="lg" delay={0.1 + index * 0.05}>
              <div style={styles.question}>{item.q}</div>
              <p style={styles.answer}>{item.a}</p>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  )
}

export default Help
