'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, TrendingUp, Lightbulb, Calendar, Share2, AlertCircle, Loader2 } from 'lucide-react'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import { apiFetch } from '@/lib/api'
import { ReportGenerateResponse } from '@/types/report'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '20px',
    maxWidth: '800px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
  },
  title: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '600',
    color: '#1a3d2e',
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: '14px',
    color: '#7f786d',
    textAlign: 'center' as const,
    marginTop: '4px',
  },
  reportHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '16px',
    border: '1px solid rgba(26, 61, 46, 0.08)',
  },
  aiIcon: {
    width: '48px',
    height: '48px',
    background: 'linear-gradient(135deg, #c9a962 0%, #e8d9a8 100%)',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(201, 169, 98, 0.25)',
  },
  reportHeaderText: {
    flex: 1,
  },
  reportTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '4px',
  },
  reportDate: {
    fontSize: '12px',
    color: '#7f786d',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  sectionIconWrapper: {
    width: '32px',
    height: '32px',
    background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.12) 0%, rgba(65, 152, 115, 0.06) 100%)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  reportText: {
    fontSize: '14px',
    lineHeight: 1.8,
    color: '#4a4540',
    fontFamily: "'DM Sans', 'Noto Sans JP', sans-serif",
    whiteSpace: 'pre-line' as const,
  },
  highlightText: {
    color: '#1a3d2e',
    fontWeight: '600',
    background: 'linear-gradient(180deg, transparent 60%, rgba(201, 169, 98, 0.2) 60%)',
    padding: '0 2px',
  },
  positiveText: {
    color: '#419873',
    fontWeight: '600',
  },
  bulletList: {
    margin: '12px 0 0 0',
    padding: '0 0 0 20px',
  },
  bulletItem: {
    fontSize: '14px',
    lineHeight: 1.8,
    color: '#4a4540',
    marginBottom: '4px',
  },
  tipCard: {
    background: 'linear-gradient(135deg, rgba(201, 169, 98, 0.1) 0%, rgba(201, 169, 98, 0.05) 100%)',
    border: '1px solid rgba(201, 169, 98, 0.2)',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    gap: '12px',
  },
  tipIcon: {
    width: '40px',
    height: '40px',
    background: 'linear-gradient(135deg, #c9a962 0%, #e8d9a8 100%)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '6px',
  },
  tipText: {
    fontSize: '13px',
    color: '#635d54',
    lineHeight: 1.6,
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: 'auto',
    paddingTop: '8px',
    maxWidth: '500px',
    width: '100%',
    alignSelf: 'center',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  buttonSecondary: {
    flex: '1 1 120px',
    minWidth: '120px',
  },
  buttonPrimary: {
    flex: '2 1 200px',
    minWidth: '200px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
    gap: '16px',
  },
  loadingText: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    color: '#1a3d2e',
    fontSize: '16px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    gap: '12px',
    background: 'rgba(220, 38, 38, 0.05)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(220, 38, 38, 0.1)',
  },
  errorText: {
    color: '#dc2626',
    fontSize: '14px',
    textAlign: 'center' as const,
  }
}

function Report() {
  const [report, setReport] = useState<ReportGenerateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchReport() {
      try {
        setLoading(true);
        // Generate report for last 30 days
        const res = await apiFetch("/api/v1/reports/generate", {
          method: "POST",
          body: JSON.stringify({ periodDays: 30 }),
          headers: {
            "Content-Type": "application/json"
          }
        });

        if (!res.ok) {
          throw new Error(`Failed to generate report: ${res.status}`);
        }

        const data: ReportGenerateResponse = await res.json();
        if (isMounted) {
          setReport(data);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Report generation error:", err);
          setError(err.message || "レポートの生成に失敗しました。");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchReport();

    return () => { isMounted = false };
  }, []); // Run once on mount

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    // Re-trigger effect by remounting or manual call?
    // For simplicity, just reload window or extraction function
    window.location.reload();
  };

  const handleShare = async () => {
    if (navigator.share && report) {
      try {
        await navigator.share({
          title: 'HairGuard AIレポート',
          text: report.rawText,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      alert("共有機能はサポートされていません。");
    }
  };

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.content}>
          {/* Title Section */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 style={styles.title}>AIレポート</h1>
            <p style={styles.subtitle}>月間分析レポート</p>
          </motion.div>

          {loading ? (
            <div style={styles.loadingContainer}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 size={32} color="#c9a962" />
              </motion.div>
              <div style={styles.loadingText}>AIが分析レポートを生成中...</div>
            </div>
          ) : error ? (
            <div style={styles.errorContainer}>
              <AlertCircle size={24} color="#dc2626" />
              <div style={styles.errorText}>{error}</div>
              <Button variant="secondary" onClick={handleRetry}>再試行</Button>
            </div>
          ) : report ? (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                {/* Report Header */}
                <motion.div
                  style={styles.reportHeader}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <div style={styles.aiIcon}>
                    <Sparkles size={24} color="#1a3d2e" />
                  </div>
                  <div style={styles.reportHeaderText}>
                    <div style={styles.reportTitle}>{new Date().getMonth() + 1}月の分析レポート</div>
                    <div style={styles.reportDate}>
                      <Calendar size={12} />
                      {new Date().toLocaleDateString('ja-JP')} 生成
                    </div>
                  </div>
                </motion.div>

                {/* Content */}
                <div style={styles.gridContainer}>
                  <Card variant="default" padding="lg" delay={0.2}>
                    <div style={styles.sectionHeader}>
                      <div style={styles.sectionIconWrapper}>
                        <TrendingUp size={16} color="#419873" />
                      </div>
                      <span style={styles.sectionTitle}>ハイライト</span>
                    </div>
                    <ul style={styles.bulletList}>
                      {report.highlights.map((item, i) => (
                        <li key={i} style={styles.bulletItem}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </Card>

                  <Card variant="default" padding="lg" delay={0.3}>
                    <div style={styles.sectionHeader}>
                      <div style={styles.sectionIconWrapper}>
                        <Lightbulb size={16} color="#419873" />
                      </div>
                      <span style={styles.sectionTitle}>ネクストアクション</span>
                    </div>
                    <ul style={styles.bulletList}>
                      {report.nextActions.map((item, i) => (
                        <li key={i} style={styles.bulletItem}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>

                {/* Full Text (Optional) */}
                {/* <Card variant="default" padding="lg">
                         <p style={styles.reportText}>{report.rawText}</p>
                    </Card> */}

                {/* Action Buttons */}
                <motion.div
                  style={styles.buttonRow}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <div style={styles.buttonSecondary}>
                    <Button
                      variant="secondary"
                      size="full"
                      icon={<Share2 size={16} />}
                      onClick={handleShare}
                    >
                      共有
                    </Button>
                  </div>
                  {/* Placeholder for future Feature 1->2/3 integration */}
                  <div style={styles.buttonPrimary}>
                    <Button
                      variant="primary"
                      size="full"
                      onClick={() => alert("改善プラン機能は開発中です")}
                    >
                      改善プランを見る
                    </Button>
                  </div>
                </motion.div>

              </motion.div>
            </AnimatePresence>
          ) : null}

        </div>
      </div>
    </Layout>
  )
}

export default Report

