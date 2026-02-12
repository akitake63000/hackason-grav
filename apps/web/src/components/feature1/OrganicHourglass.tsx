'use client';

import React from 'react';
import { motion } from 'framer-motion';
import styles from './OrganicHourglass.module.css';

interface OrganicHourglassProps {
    progress: number; // 0 to 100
}

export default function OrganicHourglass({ progress }: OrganicHourglassProps) {
    return (
        <div className={styles.container}>
            <div className={styles.iconWrapper}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                        duration: 3,
                        ease: "easeInOut",
                        repeat: Infinity,
                    }}
                    style={{ fontSize: '60px', lineHeight: 1 }}
                >
                    ⏳
                </motion.div>
            </div>

            <div className={styles.progressContainer}>
                <motion.div
                    className={styles.progressBar}
                    style={{ width: `${progress}%` }}
                    animate={{ width: `${progress}%` }}
                />
            </div>

            <div className={styles.textContainer}>
                <h2 className={styles.title}>解析中...</h2>
                <p className={styles.subtitle}>AIがあなたの頭皮・髪の状態を<br />詳細に分析しています</p>
            </div>
        </div>
    );
}
