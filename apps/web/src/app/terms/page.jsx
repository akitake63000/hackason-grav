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
    title: '適用',
    body: '本規約は、当サービスの利用に関する条件を定めるものです。利用者は本規約に同意のうえ、サービスを利用します。',
  },
  {
    title: '禁止事項',
    body: '以下の行為は禁止します。',
    items: [
      '法令または公序良俗に反する行為',
      '不正アクセス・改ざん・妨害行為',
      '他者の権利を侵害する行為',
    ],
  },
  {
    title: '免責事項',
    body: '本サービスは情報提供を目的とし、特定の効果を保証するものではありません。内容の正確性・有用性について保証しません。',
  },
  {
    title: 'サービス変更・停止',
    body: '運営上の必要により、サービス内容を変更または停止する場合があります。',
  },
  {
    title: '規約の変更',
    body: '本規約は必要に応じて変更されることがあります。重要な変更がある場合は告知します。',
  },
]

function Terms() {
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
            <h1 style={styles.title}>利用規約</h1>
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

export default Terms
