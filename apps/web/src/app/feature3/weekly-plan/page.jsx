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
                // 404 means user hasn't completed tendency survey yet
                if (tendencyError?.statusCode === 404 || tendencyError?.status === 404) {
                    setTendencyData(null) // Explicitly set null to trigger "Take Survey" UI
                } else {
                    console.error('Failed to fetch tendency data:', tendencyError)
                }
            }

            // Get current plan
            const planRes = await apiFetch(`/api/v1/lifestyle/plan/current?t=${Date.now()}`)
            if (planRes.ok) {
                const planData = await planRes.json()
                console.log("Plan data loaded:", planData)
                setPlan(planData)

                // todayLog is an object { completedActions: [...] } or null
                const completedIds = planData.todayLog?.completedActions || []
                setTodayLog(completedIds)  // string[] from backend
                setStreak(planData.streak || 0)

                // Calculate bonus scores from completed actions
                calculateBonusScores(planData, completedIds)
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

    const handleCreatePlan = async () => {
        setLoading(true)
        try {
            const res = await apiFetch('/api/v1/lifestyle/plan/generate', { method: 'POST' })
            if (res.ok) {
                // Refresh data to show the new plan
                await fetchData()
            } else {
                const error = await res.json()
                alert(`プラン作成に失敗しました: ${error.detail || '不明なエラー'}`)
            }
        } catch (e) {
            console.error("Failed to generate plan", e)
            alert("プラン作成に失敗しました")
        } finally {
            setLoading(false)
        }
    }

    const handleCreateNewPlan = async () => {
        // Alias for expired plan recreation
        await handleCreatePlan()
    }

    const handleConfirmDay = async () => {
        if (!plan) return

        try {
            const today = new Date();
            let dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            if (today.getHours() < 4) {
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                dateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
            }

            const res = await apiFetch('/api/v1/lifestyle/plan/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: plan.planId, date: dateStr })
            })

            if (res.ok) {
                // Refresh to show updated score and confirmed state
                await fetchData()
            }
        } catch (error) {
            console.error('Confirmation failed:', error)
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
        return todayLog.includes(actionId)
    }

    const getCompletionRate = () => {
        if (!plan || !plan.targetActions || plan.targetActions.length === 0) return 0
        const completedCount = plan.targetActions.filter(a => isActionCompleted(a.id)).length
        // Ensure steps of 33, 66, 100 for 3 actions
        if (completedCount === 0) return 0
        if (completedCount === 1) return 33
        if (completedCount === 2) return 66
        return 100
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
        // If tendency data is missing, prioritize asking for survey
        if (tendencyData === null) {
            return (
                <Layout>
                    <div className={styles.container}>
                        <div className={styles.content}>
                            <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
                                <AlertCircle size={48} color="#f59e0b" style={{ marginBottom: '16px' }} />
                                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>
                                    診断データがありません
                                </h2>
                                <p style={{ fontSize: '14px', color: '#7f786d', marginBottom: '24px' }}>
                                    あなたに最適なプランを作成するために、<br />
                                    まずは生活習慣診断を行ってください。
                                </p>
                                <Button onClick={() => router.push('/feature3/tendency')} icon={<ArrowRight size={18} />} iconPosition="right">
                                    診断を開始する
                                </Button>
                            </Card>
                        </div>
                    </div>
                </Layout>
            )
        }

        return (
            <Layout>
                <div className={styles.container}>
                    <div className={styles.content}>
                        <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
                            <Sparkles size={48} color="#419873" style={{ marginBottom: '16px' }} />
                            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>
                                あなただけのAI週間プラン
                            </h2>
                            <p style={{ fontSize: '14px', color: '#7f786d', marginBottom: '24px' }}>
                                診断結果に基づき、今週取り組むべき<br />
                                3つのアクションをAIが生成します。
                            </p>
                            <Button onClick={handleCreatePlan} icon={<Sparkles size={18} />}>
                                AIプランを作成する
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

                    {/* Weekly Progress Bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        style={{ marginBottom: '24px' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1a3d2e' }}>
                                週間スコア
                            </span>
                            <span style={{ fontSize: '24px', fontWeight: '800', color: '#419873' }}>
                                {plan.weeklyProgress || 0}<span style={{ fontSize: '14px', fontWeight: 'normal' }}>/105pts</span>
                            </span>
                        </div>
                        <div style={{ height: '12px', background: '#e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${((plan.weeklyProgress || 0) / 105) * 100}%` }}
                                transition={{ duration: 1.0, ease: "easeOut" }}
                                style={{ height: '100%', background: 'linear-gradient(90deg, #419873 0%, #34d399 100%)', borderRadius: '6px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <p style={{ fontSize: '11px', color: '#9c958a' }}>目標: 85pts以上！</p>
                            <p style={{ fontSize: '11px', color: '#9c958a' }}>確定分のみ合算されます</p>
                        </div>
                    </motion.div>

                    {/* Streak Badge */}
                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
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
                        <>
                            {plan.isTodayConfirmed ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    style={{ textAlign: 'center', padding: '32px 20px', background: 'rgba(65, 152, 115, 0.05)', borderRadius: '24px', border: '1px solid rgba(65, 152, 115, 0.2)' }}
                                >
                                    <div style={{ background: '#419873', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                        <CheckCircle size={32} color="#fff" />
                                    </div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1a3d2e', marginBottom: '8px' }}>本日のミッション完了！</h3>
                                    <p style={{ fontSize: '14px', color: '#7f786d', marginBottom: '20px' }}>
                                        お疲れさまでした。スコアが反映されました。<br />
                                        明日もこの調子で頑張りましょう！
                                    </p>
                                    <p style={{ fontSize: '12px', color: '#9c958a' }}>
                                        ※明日のミッションは午前4時以降に表示されます。
                                    </p>
                                </motion.div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {plan.targetActions.map((action, index) => {
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
                                                        <div
                                                            className={styles.actionHeader}
                                                            onClick={() => toggleAccordion(action.id)}
                                                        >
                                                            <div
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleCheckClick(action)
                                                                }}
                                                                className={`${styles.missionCheckbox} ${completed ? styles.missionCheckboxCompleted : ''}`}
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
                                        })}
                                    </div>

                                    {/* Confirm Button */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.5 }}
                                        style={{ marginTop: '32px' }}
                                    >
                                        <Button
                                            size="full"
                                            onClick={handleConfirmDay}
                                            disabled={todayLog.length === 0}
                                            variant={todayLog.length === 3 ? "primary" : "outline"}
                                        >
                                            {todayLog.length === 0 ? "アクションをチェックしてください" : "本日の達成内容を確定する"}
                                        </Button>
                                        <p style={{ textAlign: 'center', fontSize: '12px', color: '#9c958a', marginTop: '12px' }}>
                                            確定すると週間スコアに加算されます
                                        </p>
                                    </motion.div>
                                </>
                            )}
                        </>
                    )}
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
        </Layout >
    )
}
