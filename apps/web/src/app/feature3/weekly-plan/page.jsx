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
import styles from './page.module.css'

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
            // Note: 404 is expected when user hasn't completed tendency survey
            try {
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
            } catch (tendencyError) {
                // 404 means user hasn't completed tendency survey yet - this is normal
                // Only log non-404 errors
                if (tendencyError?.statusCode !== 404 && tendencyError?.status !== 404) {
                    console.error('Failed to fetch tendency data:', tendencyError)
                }
            }

            // Get current plan
            const planRes = await apiFetch('/api/v1/lifestyle/plan/current')
            if (planRes.ok) {
                const planData = await planRes.json()
                console.log("Plan data loaded:", planData)
                setPlan(planData)

                // todayLog is an object { completedActions: [...] } or null
                const logArray = planData.todayLog?.completedActions || []
                setTodayLog(logArray)
                setStreak(planData.streak || 0)

                // Calculate bonus scores from completed actions
                calculateBonusScores(planData, logArray)
            }
        } catch (error) {
            // 404 means no data available yet - this is normal, don't log
            if (error?.statusCode !== 404 && error?.status !== 404) {
                console.error('Failed to fetch data:', error)
            }
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
            // Optimistic Update
            const newLog = [...todayLog.filter(l => l.actionId !== confirmingAction.id), { actionId: confirmingAction.id, completed: true }]
            setTodayLog(newLog)

            // Update streak if this is the first completion of the day
            const completedCount = newLog.filter(l => l.completed).length
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
            const res = await apiFetch('/api/v1/lifestyle/plan/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actionId: confirmingAction.id, completed: true }),
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
            const newLog = todayLog.filter(l => l.actionId !== actionId)
            setTodayLog(newLog)

            // Update streak if we removed the last completed action
            const completedCount = newLog.filter(l => l.completed).length
            if (completedCount === 0) {
                setStreak(prev => Math.max(0, prev - 1))
            }

            const res = await apiFetch('/api/v1/lifestyle/plan/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actionId, completed: false }),
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
                <div className={styles.container}>
                    <div className={styles.content}>
                        <Card className={styles.warningCard}>
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
                <div className={styles.container}>
                    <div className={styles.content}>
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
                <div className={styles.container}>
                    <div className={styles.content}>
                        <h1 className={styles.pageTitle}>週間プラン完了！</h1>

                        <Card className={styles.weekEndCard}>
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
            <div className={styles.container}>
                <div className={styles.content}>
                    <motion.h1
                        className={styles.pageTitle}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        今日のミッション
                    </motion.h1>

                    {/* Streak Badge */}
                    <div style={{ textAlign: 'center' }}>
                        <motion.div
                            className={styles.streakBadge}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        >
                            <Flame size={16} style={{ marginRight: '6px' }} />
                            {streak}日連続達成中！
                        </motion.div>
                    </div>

                    <p className={styles.subtitle}>
                        {plan.theme || '生活習慣改善'}
                    </p>

                    {/* Progress Section */}
                    <Card className={styles.progressSection}>
                        <div className={styles.progressHeader}>
                            <span className={styles.progressLabel}>
                                <Target size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                本日の達成状況
                            </span>
                            <span className={styles.progressValue}>{getCompletionRate()}%</span>
                        </div>
                        <div className={styles.progressBar}>
                            <motion.div
                                className={styles.progressFill}
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
                        <div className={styles.createButtonContainer}>
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
                                    <Card className={styles.actionCard}>
                                        {/* Header area - Click to expand (except checkbox) */}
                                        <div
                                            className={styles.actionHeader}
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

                                            <div className={styles.actionName}>
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
                                                    <div className={styles.actionContent}>
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
                        className={styles.modalOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setConfirmingAction(null)}
                    >
                        <motion.div
                            className={styles.modalContent}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className={styles.modalEmoji}>{confirmingAction.emoji || '✅'}</div>
                            <h3 className={styles.modalTitle}>本当にやった？</h3>
                            <p className={styles.modalText}>
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
