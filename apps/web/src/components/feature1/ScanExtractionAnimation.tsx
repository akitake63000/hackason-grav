'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import styles from './ScanExtractionAnimation.module.css';

interface ScanExtractionAnimationProps {
    images: {
        side: string;
        front: string;
        top: string;
    };
    onProcessingComplete: (processedImages: { side: string; front: string; top: string }) => void;
}

export default function ScanExtractionAnimation({ images, onProcessingComplete }: ScanExtractionAnimationProps) {
    const [visibleCards, setVisibleCards] = useState<string[]>([]);
    const [processed, setProcessed] = useState<{ [key: string]: string }>({});

    // Process image (Brighten + Compress)
    const processImage = async (src: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Resize max 1920
                const MAX_SIZE = 1920;
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(src);
                    return;
                }

                // Draw with brightness/contrast filter
                ctx.filter = 'brightness(1.1) contrast(1.1)'; // Slight boost for perception
                ctx.drawImage(img, 0, 0, width, height);

                // Compress
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => resolve(src);
        });
    };

    useEffect(() => {
        const processAll = async () => {
            const side = await processImage(images.side);
            const front = await processImage(images.front);
            const top = await processImage(images.top);

            setProcessed({ side, front, top });

            // Animation Sequence
            setTimeout(() => setVisibleCards(prev => [...prev, 'side']), 500);
            setTimeout(() => setVisibleCards(prev => [...prev, 'front']), 1500);
            setTimeout(() => setVisibleCards(prev => [...prev, 'top']), 2500);

            // Complete
            setTimeout(() => {
                onProcessingComplete({ side, front, top });
            }, 4000);
        };

        processAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images]);
    // Intentionally omitting onProcessingComplete to avoid re-triggering loop if function ref changes 
    // (though should be stable if caller does it right, but for safety in this robust component).

    const cardVariants = {
        hidden: { opacity: 0, scale: 0.5, y: 50 },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { type: 'spring', stiffness: 300, damping: 20 }
        }
    };

    const flashVariants = {
        initial: { opacity: 0 },
        flash: { opacity: [0, 0.5, 0], transition: { duration: 0.3 } }
    };

    return (
        <div className={styles.overlay}>
            <h2 className={styles.title}>
                解析用画像を生成中...
            </h2>

            <div className={styles.cardContainer}>
                {['side', 'front', 'top'].map((key) => (
                    <div key={key} className={styles.cardWrapper}>
                        {visibleCards.includes(key) && processed[key] && (
                            <motion.div
                                variants={cardVariants}
                                initial="hidden"
                                animate="visible"
                                className={styles.card}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={processed[key]} alt={key} className={styles.image} />

                                {/* Flash Overlay */}
                                <motion.div
                                    variants={flashVariants}
                                    initial="initial"
                                    animate="flash"
                                    className={styles.flash}
                                />

                                <div className={styles.label}>
                                    {key}
                                </div>
                            </motion.div>
                        )}
                        {!visibleCards.includes(key) && (
                            <div className={styles.placeholder} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
