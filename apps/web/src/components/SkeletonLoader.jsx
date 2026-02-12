import styles from './SkeletonLoader.module.css'

// 汎用スケルトンボックス
export const SkeletonBox = ({ width = '100%', height = '20px', className = '' }) => (
  <div
    className={`${styles.skeleton} ${className}`}
    style={{ width, height }}
  />
)

// 挨拶セクション用スケルトン
export const GreetingSkeleton = () => (
  <div className={styles.greetingSkeleton}>
    <SkeletonBox width="60%" height="32px" />
    <SkeletonBox width="80%" height="24px" style={{ marginTop: '8px' }} />
    <SkeletonBox width="70%" height="16px" style={{ marginTop: '12px' }} />
  </div>
)

// ステータスカード用スケルトン
export const StatusCardSkeleton = () => (
  <div className={styles.statusCardSkeleton}>
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
      <SkeletonBox width="20px" height="20px" style={{ marginRight: '8px' }} />
      <SkeletonBox width="120px" height="16px" />
    </div>
    <SkeletonBox width="90%" height="18px" style={{ marginBottom: '12px' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <SkeletonBox width="60px" height="32px" />
      <SkeletonBox width="80px" height="16px" />
    </div>
  </div>
)

// ミッションセクション用スケルトン
export const MissionsSectionSkeleton = () => (
  <div className={styles.missionsSkeleton}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
      <SkeletonBox width="140px" height="20px" />
      <SkeletonBox width="16px" height="16px" />
    </div>
    {[1, 2, 3].map((i) => (
      <div key={i} className={styles.missionCardSkeleton}>
        <SkeletonBox width="32px" height="32px" style={{ borderRadius: '50%' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SkeletonBox width="70%" height="16px" />
          <SkeletonBox width="90%" height="14px" />
        </div>
        <SkeletonBox width="18px" height="18px" />
      </div>
    ))}
  </div>
)

// セクションプレースホルダー（Quick Action / Q&A用）
export const SectionPlaceholder = ({ minHeight = '120px' }) => (
  <div className={styles.sectionPlaceholder} style={{ minHeight }}>
    <SkeletonBox width="200px" height="20px" style={{ marginBottom: '8px' }} />
    <SkeletonBox width="60%" height="14px" style={{ marginBottom: '16px' }} />
    <div style={{ display: 'flex', gap: '8px' }}>
      <SkeletonBox width="40px" height="40px" style={{ borderRadius: '8px' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <SkeletonBox width="80%" height="16px" />
        <SkeletonBox width="50%" height="14px" />
      </div>
      <SkeletonBox width="80px" height="32px" style={{ borderRadius: '8px' }} />
    </div>
  </div>
)
