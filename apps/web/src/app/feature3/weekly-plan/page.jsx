'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
    CheckCircle,
    Target,
    Calendar,
    Trophy,
    Loader2,
    X,
    Sparkles,
    TrendingUp,
    AlertCircle,
    ArrowRight
} from 'lucide-react'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import Button from '@/components/Button'
import { apiFetch } from '@/lib/api'

const styles = {
    container: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        paddingBottom: '40px',
    },
    content: {
        maxWidth: '600px',
        margin: '0 auto',
        width: '100%',
    },
    pageTitle: {
        fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
        fontSize: 'clamp(24px, 4vw, 32px)',
        fontWeight: '600',
        color: '#1a3d2e',
        textAlign: 'center',
        marginBottom: '8px',
    },
    subtitle: {
        fontSize: '14px',
        color: '#7f786d',
        textAlign: 'center',
        marginBottom: '24px',
    },
    progressSection: {
        marginBottom: '24px',
    },
    progressHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
    },
    progressLabel: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#1a3d2e',
    },
    progressValue: {
        fontSize: '14px',
        color: '#419873',
        fontWeight: '700',
    },
    progressBar: {
        height: '8px',
        background: '#e0dcd0',
        borderRadius: '4px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        background: 'linear-gradient(90deg, #419873, #6dc99c)',
        borderRadius: '4px',
        transition: 'width 0.5s ease',
    },
    missionCard: {
        cursor: 'pointer',
        marginBottom: '12px',
        transition: 'transform 0.2s ease',
    },
    missionInner: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    missionCheckbox: {
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        border: '2px solid #e0dcd0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s ease',
    },
    missionCheckboxCompleted: {
        background: '#419873',
        borderColor: '#419873',
    },
    missionContent: {
        flex: 1,
    },
    missionTitle: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#1a3d2e',
        marginBottom: '4px',
    },
    missionDesc: {
        fontSize: '13px',
        color: '#7f786d',
    },
    scoreBonus: {
        fontSize: '12px',
        color: '#419873',
        fontWeight: '600',
    },
    // Modal
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(26, 61, 46, 0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '400px',
        padding: '32px 24px',
        textAlign: 'center',
    },
    modalEmoji: {
        fontSize: '48px',
        marginBottom: '16px',
    },
    modalTitle: {
        fontSize: '20px',
        fontWeight: '700',
        color: '#1a3d2e',
        marginBottom: '8px',
    },
    modalText: {
        fontSize: '14px',
        color: '#7f786d',
        marginBottom: '24px',
    },
    // Week end section
    weekEndCard: {
        textAlign: 'center',
        padding: '32px 24px',
    },
    // Inactivity warning
    warningCard: {
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
    },
}

export default function WeeklyPlan() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [plan, setPlan] = useState(null)
    const [todayLog, setTodayLog] = useState([])
    const [confirmingAction, setConfirmingAction] = useState(null)
    const [showInactivityWarning, setShowInactivityWarning] = useState(false)
    const [tendencyData, setTendencyData] = useState(null)
    const [bonusScores, setBonusScores] = useState({ hormone: 0, circadian: 0, blood_flow: 0, stress: 0 })

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            // Check tendency data freshness
            const tendencyRes = await apiFetch('/api/v1/lifestyle/tendency/latest')
            if (tendencyRes.ok) {
                const data = await tendencyRes.json()
                setTendencyData(data)

                // Check if 2+ weeks since last update
                if (data.updatedAt) {
                    const lastUpdate = new Date(data.updatedAt)
                    const twoWeeksAgo = new Date()
                    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
                    if (lastUpdate < twoWeeksAgo) {
                        setShowInactivityWarning(true)
                    }
                }
            }

            // Get current plan
            const planRes = await apiFetch('/api/v1/lifestyle/plan/current')
            if (planRes.ok) {
                const planData = await planRes.json()
                setPlan(planData)
                setTodayLog(planData.todayLog || [])

                // Calculate bonus scores from completed actions
                calculateBonusScores(planData, planData.todayLog || [])
            }
        } catch (error) {
            console.error('Failed to fetch data:', error)
            // Error handling (optional: show toast)
        } finally {
            setLoading(false)
        }
    }

    const calculateBonusScores = (plan, log) => {
        if (!plan || !plan.targetActions) return

        const bonuses = { hormone: 0, circadian: 0, blood_flow: 0, stress: 0 }
        const completedIds = log.filter(l => l.completed).map(l => l.actionId)

        plan.targetActions.forEach(action => {
            if (completedIds.includes(action.id)) {
                // Add bonus based on action's target axis
                if (action.targetAxis && bonuses[action.targetAxis] !== undefined) {
                    bonuses[action.targetAxis] += 2
                }
            }
        })

        setBonusScores(bonuses)
    }

    const handleCheckClick = (action) => {
        const isCompleted = todayLog.some(l => l.actionId === action.id && l.completed)
        if (isCompleted) {
            // Uncheck
            handleUncheck(action.id)
        } else {
            // Show confirmation modal
            setConfirmingAction(action)
        }
    }

    const handleConfirmCheck = async () => {
        if (!confirmingAction) return

        try {
            const res = await apiFetch('/api/v1/lifestyle/plan/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actionId: confirmingAction.id, completed: true }),
            })

            if (res.ok) {
                setTodayLog(prev => [...prev.filter(l => l.actionId !== confirmingAction.id),
                { actionId: confirmingAction.id, completed: true }])

                // Update bonus scores
                if (confirmingAction.targetAxis) {
                    setBonusScores(prev => ({
                        ...prev,
                        [confirmingAction.targetAxis]: prev[confirmingAction.targetAxis] + 2
                    }))
                }
            }
        } catch (error) {
            console.error('Check failed:', error)
        } finally {
            setConfirmingAction(null)
        }
    }

    const handleUncheck = async (actionId) => {
        try {
            const res = await apiFetch('/api/v1/lifestyle/plan/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actionId, completed: false }),
            })

            if (res.ok) {
                setTodayLog(prev => prev.filter(l => l.actionId !== actionId))
            }
        } catch (error) {
            console.error('Uncheck failed:', error)
        }
    }

    const handleCreateNewPlan = async () => {
        setLoading(true)
        try {
            const res = await apiFetch('/api/v1/lifestyle/plan/generate', { method: 'POST' })
            if (res.ok) {
                // Refresh data to show the new plan
                await fetchData()
            } else {
                alert("プラン作成に失敗しました")
            }
        } catch (e) {
            console.error("Failed to regenerate plan", e)
            alert("プラン作成に失敗しました")
        } finally {
            setLoading(false)
        }
    }

    const handleRetakeSurvey = () => {
        router.push('/feature3/tendency')
    }

    const isActionCompleted = (actionId) => {
        return todayLog.some(l => l.actionId === actionId && l.completed)
    }

    const getCompletionRate = () => {
        if (!plan || !plan.targetActions) return 0
        const completed = plan.targetActions.filter(a => isActionCompleted(a.id)).length
        return Math.round((completed / plan.targetActions.length) * 100)
    }

    const isPlanExpired = () => {
        if (!plan || !plan.endDate) return false
        return new Date() > new Date(plan.endDate)
    }

    if (loading) {
        return (
            <Layout>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                    <Loader2 className="animate-spin" size={40} color="#419873" />
                </div>
            </Layout>
        )
    }

    // Inactivity warning (2+ weeks)
    if (showInactivityWarning) {
        return (
            <Layout>
                <div style={styles.container}>
                    <div style={styles.content}>
                        <Card style={styles.warningCard}>
                            <div style={{ textAlign: 'center', padding: '24px' }}>
                                <AlertCircle size={48} color="#f59e0b" style={{ marginBottom: '16px' }} />
                                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>
                                    お久しぶりです！
                                </h2>
                                <p style={{ fontSize: '14px', color: '#7f786d', marginBottom: '24px' }}>
                                    2週間以上経過しています。<br />
                                    生活習慣が変わっている可能性があるため、<br />
                                    アンケートを再回答して最新の状態を確認しましょう。
                                </p>
                                <Button onClick={handleRetakeSurvey} icon={<ArrowRight size={18} />} iconPosition="right">
                                    アンケートを再回答する
                                </Button>
                                <button
                                    onClick={() => setShowInactivityWarning(false)}
                                    style={{
                                        marginTop: '16px',
                                        background: 'none',
                                        border: 'none',
                                        color: '#7f786d',
                                        cursor: 'pointer',
                                        fontSize: '13px'
                                    }}
                                >
                                    今回はスキップ
                                </button>
                            </div>
                        </Card>
                    </div>
                </div>
            </Layout>
        )
    }

    // No plan yet
    if (!plan) {
        return (
            <Layout>
                <div style={styles.container}>
                    <div style={styles.content}>
                        <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
                            <Sparkles size={48} color="#419873" style={{ marginBottom: '16px' }} />
                            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>
                                週間プランがありません
                            </h2>
                            <p style={{ fontSize: '14px', color: '#7f786d', marginBottom: '24px' }}>
                                生活習慣改善レコメンド画面から<br />
                                AI週間プランを作成してください。
                            </p>
                            <Button onClick={() => router.push('/feature3/lifestyle-recommend')}>
                                レコメンド画面へ
                            </Button>
                        </Card>
                    </div>
                </div>
            </Layout>
        )
    }

    // Plan expired
    if (isPlanExpired()) {
        return (
            <Layout>
                <div style={styles.container}>
                    <div style={styles.content}>
                        <h1 style={styles.pageTitle}>週間プラン完了！</h1>

                        <Card style={styles.weekEndCard}>
                            <Trophy size={64} color="#f59e0b" style={{ marginBottom: '16px' }} />
                            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>
                                お疲れさまでした！
                            </h2>
                            <p style={{ fontSize: '14px', color: '#7f786d', marginBottom: '24px' }}>
                                今週のプランが終了しました。<br />
                                次週も頑張りましょう！
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <Button onClick={handleCreateNewPlan} size="full">
                                    次週のプランを作成
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            </Layout>
        )
    }

    // Active plan view
    return (
        <Layout>
            <div style={styles.container}>
                <div style={styles.content}>
                    <motion.h1
                        style={styles.pageTitle}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        今日のミッション
                    </motion.h1>
                    <p style={styles.subtitle}>
                        {plan.theme || '生活習慣改善'}
                    </p>

                    {/* Progress Section */}
                    <Card style={styles.progressSection}>
                        <div style={styles.progressHeader}>
                            <span style={styles.progressLabel}>
                                <Target size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                本日の達成状況
                            </span>
                            <span style={styles.progressValue}>{getCompletionRate()}%</span>
                        </div>
                        <div style={styles.progressBar}>
                            <motion.div
                                style={styles.progressFill}
                                initial={{ width: 0 }}
                                animate={{ width: `${getCompletionRate()}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>

                        {/* Bonus scores display */}
                        {Object.values(bonusScores).some(v => v > 0) && (
                            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {bonusScores.hormone > 0 && (
                                    <span style={{ fontSize: '11px', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', padding: '4px 8px', borderRadius: '12px' }}>
                                        ホルモン +{bonusScores.hormone}
                                    </span>
                                )}
                                {bonusScores.circadian > 0 && (
                                    <span style={{ fontSize: '11px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', padding: '4px 8px', borderRadius: '12px' }}>
                                        体内時計 +{bonusScores.circadian}
                                    </span>
                                )}
                                {bonusScores.blood_flow > 0 && (
                                    <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 8px', borderRadius: '12px' }}>
                                        血流 +{bonusScores.blood_flow}
                                    </span>
                                )}
                                {bonusScores.stress > 0 && (
                                    <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 8px', borderRadius: '12px' }}>
                                        ストレス +{bonusScores.stress}
                                    </span>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* Mission Cards */}
                    {plan.targetActions && plan.targetActions.map((action, index) => {
                        const completed = isActionCompleted(action.id)
                        return (
                            <motion.div
                                key={action.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Card
                                    style={{
                                        ...styles.missionCard,
                                        opacity: completed ? 0.7 : 1,
                                    }}
                                    onClick={() => handleCheckClick(action)}
                                >
                                    <div style={styles.missionInner}>
                                        <div style={{
                                            ...styles.missionCheckbox,
                                            ...(completed ? styles.missionCheckboxCompleted : {})
                                        }}>
                                            {completed && <CheckCircle size={18} color="#fff" />}
                                        </div>
                                        <div style={styles.missionContent}>
                                            <div style={{
                                                ...styles.missionTitle,
                                                textDecoration: completed ? 'line-through' : 'none',
                                            }}>
                                                {action.emoji} {action.name}
                                            </div>
                                            <div style={styles.missionDesc}>{action.description}</div>
                                        </div>
                                        {!completed && action.targetAxis && (
                                            <div style={styles.scoreBonus}>
                                                <TrendingUp size={12} style={{ marginRight: '2px' }} />
                                                +2
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </motion.div>
                        )
                    })}

                    {/* Week remaining info */}
                    {plan.endDate && (
                        <p style={{ textAlign: 'center', fontSize: '12px', color: '#9c958a', marginTop: '24px' }}>
                            <Calendar size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            プラン終了日: {new Date(plan.endDate).toLocaleDateString('ja-JP')}
                        </p>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {confirmingAction && (
                    <motion.div
                        style={styles.modalOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setConfirmingAction(null)}
                    >
                        <motion.div
                            style={styles.modalContent}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={styles.modalEmoji}>{confirmingAction.emoji || '✅'}</div>
                            <h3 style={styles.modalTitle}>本当にやった？</h3>
                            <p style={styles.modalText}>
                                「{confirmingAction.name}」を<br />
                                実際に実行しましたか？
                            </p>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <Button
                                    variant="outline"
                                    size="full"
                                    onClick={() => setConfirmingAction(null)}
                                >
                                    まだ
                                </Button>
                                <Button
                                    size="full"
                                    onClick={handleConfirmCheck}
                                >
                                    やった！
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Layout>
    )
}
