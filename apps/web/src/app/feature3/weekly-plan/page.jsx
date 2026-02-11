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
    ArrowRight,
    Flame,
    ChevronDown,
    ChevronUp
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
    // Accordion & Action Styles
    actionCard: {
        marginBottom: '12px',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
    },
    actionHeader: {
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        cursor: 'pointer',
    },
    actionName: {
        flex: 1,
        fontSize: '18px', // Larger font
        fontWeight: '700',
        color: '#1a3d2e',
        marginLeft: '12px',
    },
    actionContent: {
        padding: '0 16px 16px 56px', // Indent to align with text
        fontSize: '14px',
        color: '#7f786d',
        lineHeight: '1.6',
        borderTop: '1px solid #f0f0f0',
        marginTop: '8px',
        paddingTop: '12px',
    },
    createButtonContainer: {
        textAlign: 'center',
        padding: '40px 20px',
        background: '#f9fafb',
        borderRadius: '16px',
        border: '2px dashed #e5e7eb',
    },
    streakBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
        color: 'white',
        padding: '6px 16px',
        borderRadius: '20px',
        fontSize: '14px',
        fontWeight: 'bold',
        boxShadow: '0 2px 4px rgba(234, 88, 12, 0.3)',
        marginBottom: '16px',
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
    const [streak, setStreak] = useState(0)
    const [expandedActions, setExpandedActions] = useState({}) // { id: boolean }
    const [generating, setGenerating] = useState(false)

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
                console.log("Plan data loaded:", planData)
                setPlan(planData)

                // todayLog is an object { completedActions: [...] } or null
                const completedIds = planData.todayLog?.completedActions || []
                setTodayLog(completedIds)  // string[] from backend
                setStreak(planData.streak || 0)

                // Calculate bonus scores from completed actions
                calculateBonusScores(planData, logArray)
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
        const completedIds = log  // already string[] of actionIds

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
        const isCompleted = todayLog.includes(action.id)
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
            // Optimistic Update
            const newLog = [...todayLog.filter(id => id !== confirmingAction.id), confirmingAction.id]
            setTodayLog(newLog)

            // Update streak if this is the first completion of the day
            const completedCount = newLog.length
            if (completedCount === 1) {
                setStreak(prev => prev + 1)
            }

            // Update bonus scores locally
            if (confirmingAction.targetAxis) {
                setBonusScores(prev => ({
                    ...prev,
                    [confirmingAction.targetAxis]: prev[confirmingAction.targetAxis] + 2
                }))
            }

            // API Call
            const today = new Date();
            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const res = await apiFetch('/api/v1/lifestyle/plan/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: plan.planId, actionId: confirmingAction.id, date: dateStr, completed: true }),
            })

            if (!res.ok) {
                // Revert on error
                setTodayLog(todayLog)
                if (completedCount === 1) setStreak(prev => prev - 1)
                // Revert bonus (simplified: just refetch or ignore for now as it's minor)
            }
        } catch (error) {
            console.error('Check failed:', error)
            setTodayLog(todayLog) // Revert
        } finally {
            setConfirmingAction(null)
        }
    }

    const handleUncheck = async (actionId) => {
        try {
            // Optimistic Update
            const newLog = todayLog.filter(id => id !== actionId)
            setTodayLog(newLog)

            // Update streak if we removed the last completed action
            const completedCount = newLog.length
            if (completedCount === 0) {
                setStreak(prev => Math.max(0, prev - 1))
            }

            const today = new Date();
            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const res = await apiFetch('/api/v1/lifestyle/plan/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: plan.planId, actionId, date: dateStr, completed: false }),
            })

            if (!res.ok) {
                // Revert
                setTodayLog(todayLog)
                if (completedCount === 0) setStreak(prev => prev + 1)
            }
        } catch (error) {
            console.error('Uncheck failed:', error)
            setTodayLog(todayLog)
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

    const handleGenerateDaily = async () => {
        setGenerating(true)
        try {
            const res = await apiFetch('/api/v1/lifestyle/plan/daily/generate', { method: 'POST' })
            if (res.ok) {
                await fetchData()
            } else {
                alert("アクション生成に失敗しました")
            }
        } catch (e) {
            console.error("Failed to generate daily actions", e)
        } finally {
            setGenerating(false)
        }
    }

    const toggleAccordion = (id) => {
        setExpandedActions(prev => ({
            ...prev,
            [id]: !prev[id]
        }))
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

                    {/* Streak Badge */}
                    <div style={{ textAlign: 'center' }}>
                        <motion.div
                            style={styles.streakBadge}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        >
                            <Flame size={16} style={{ marginRight: '6px' }} />
                            {streak}日連続達成中！
                        </motion.div>
                    </div>

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

                    {/* Mission Cards or Create Button */}
                    {!plan.targetActions || plan.targetActions.length === 0 ? (
                        <div style={styles.createButtonContainer}>
                            {generating ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                    <Loader2 className="animate-spin" size={32} color="#419873" />
                                    <p style={{ color: '#419873', fontWeight: '600' }}>AIが今日のミッションを生成中...</p>
                                    <p style={{ fontSize: '12px', color: '#7f786d' }}>あなたの体調に合わせて最適化しています</p>
                                </div>
                            ) : (
                                <>
                                    <Sparkles size={48} color="#419873" style={{ marginBottom: '16px' }} />
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>
                                        今日のミッションを作成
                                    </h3>
                                    <p style={{ fontSize: '14px', color: '#7f786d', marginBottom: '24px' }}>
                                        今のあなたに最適な3つのアクションを<br />AIが提案します。
                                    </p>
                                    <Button onClick={handleGenerateDaily}>
                                        ミッションを生成する
                                    </Button>
                                </>
                            )}
                        </div>
                    ) : (
                        plan.targetActions.map((action, index) => {
                            const completed = isActionCompleted(action.id)
                            const isExpanded = expandedActions[action.id]

                            return (
                                <motion.div
                                    key={action.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <Card style={styles.actionCard}>
                                        {/* Header area - Click to expand (except checkbox) */}
                                        <div
                                            style={styles.actionHeader}
                                            onClick={() => toggleAccordion(action.id)}
                                        >
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleCheckClick(action)
                                                }}
                                                style={{
                                                    ...styles.missionCheckbox,
                                                    ...(completed ? styles.missionCheckboxCompleted : {})
                                                }}
                                            >
                                                {completed && <CheckCircle size={18} color="#fff" />}
                                            </div>

                                            <div style={styles.actionName}>
                                                {action.emoji} {action.name}
                                            </div>

                                            <div style={{ color: '#9ca3af' }}>
                                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                        </div>

                                        {/* Content area - Expanded details */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                >
                                                    <div style={styles.actionContent}>
                                                        <strong>Why?</strong><br />
                                                        {action.description}

                                                        {!completed && action.targetAxis && (
                                                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', fontSize: '12px', color: '#419873', fontWeight: '600' }}>
                                                                <TrendingUp size={14} style={{ marginRight: '4px' }} />
                                                                達成で{action.targetAxis === 'hormone' ? 'ホルモン' :
                                                                    action.targetAxis === 'circadian' ? '体内時計' :
                                                                        action.targetAxis === 'blood_flow' ? '血流' : 'ストレス'}スコアUP!
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </Card>
                                </motion.div>
                            )
                        })
                    )}

                    {/* Week remaining info */}
                    {plan.endDate && (
                        <p style={{ textAlign: 'center', fontSize: '12px', color: '#9c958a', marginTop: '32px' }}>
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
