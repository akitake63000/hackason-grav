'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, AlertCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import VideoScanCapture, { DeviceType } from '@/components/feature1/VideoScanCapture';
import ScanExtractionAnimation from '@/components/feature1/ScanExtractionAnimation';
import OrganicHourglass from '@/components/feature1/OrganicHourglass';
import { getFirebaseStorage, getFirestoreDb, getFirebaseAuth } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { apiFetch } from '@/lib/api';
import styles from './page.module.css';

function CaptureContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // State
    const [capturedImages, setCapturedImages] = useState<{ side: string; front: string; top: string; deviceType: DeviceType } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    // Simulated Progress Effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (uploading) {
            setProgress(0);
            interval = setInterval(() => {
                setProgress((prev) => {
                    // Fast start, slow end. Cap at 90% until complete (redirect)
                    if (prev >= 90) return 90;
                    const increment = Math.max(1, (90 - prev) / 10);
                    return prev + increment;
                });
            }, 500);
        }
        return () => clearInterval(interval);
    }, [uploading]);

    useEffect(() => {
        const message = searchParams.get('message');
        if (message) {
            setInfoMessage(decodeURIComponent(message));
        }
    }, [searchParams]);

    // Step 1: Capture Complete
    const handleCaptureComplete = (data: { side: string; front: string; top: string; deviceType: DeviceType }) => {
        setCapturedImages(data);
        setIsProcessing(true);
    };

    // Step 2: Extraction Animation Complete -> Start Upload
    const handleExtractionComplete = async (processedImages: { side: string; front: string; top: string }) => {
        setIsProcessing(false);
        setUploading(true);
        await handleUpload(processedImages, capturedImages?.deviceType || 'pc');
    };

    const handleUpload = async (images: { side: string; front: string; top: string }, deviceType: DeviceType) => {
        try {
            const auth = getFirebaseAuth();
            const user = auth.currentUser;

            if (!user) {
                // Save to local storage and redirect to login if needed? 
                // For now throw error as per original logic
                throw new Error("ログインしてください");
            }

            const storage = getFirebaseStorage();
            const db = getFirestoreDb();

            // UUIDs for 3 photos
            const sideId = crypto.randomUUID();
            const frontId = crypto.randomUUID();
            const topId = crypto.randomUUID();

            const uploadParams = [
                { id: sideId, type: 'side', dataUrl: images.side },
                { id: frontId, type: 'front', dataUrl: images.front },
                { id: topId, type: 'top', dataUrl: images.top },
            ];

            // Upload 3 images in parallel
            await Promise.all(uploadParams.map(async (item) => {
                const storagePath = `users/${user.uid}/photos/${item.id}.jpg`;
                const storageRef = ref(storage, storagePath);

                // Upload Data URL
                await uploadString(storageRef, item.dataUrl, 'data_url');
                const downloadUrl = await getDownloadURL(storageRef);

                // Save Metadata
                await setDoc(doc(db, `users/${user.uid}/photos`, item.id), {
                    photoId: item.id,
                    storagePath,
                    downloadUrl,
                    deviceType,
                    angle: item.type,
                    capturedAt: serverTimestamp(),
                    status: 'uploaded'
                });
            }));

            // Call Analysis API (New Endpoint)
            const analysisRes = await apiFetch('/api/v1/photos/analyze-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sidePhotoId: sideId,
                    frontPhotoId: frontId,
                    topPhotoId: topId,
                    deviceType
                }),
            });

            if (!analysisRes.ok) {
                throw new Error('解析に失敗しました');
            }

            const data = await analysisRes.json();
            // Redirect to result with the MAIN photo ID (usually Top or newly created AnalysisID)
            // The API should return an analysisId or use one of the photoIds. 
            // Let's assume it uses topPhotoId or returns a specific ID.
            // Based on plan, we might group them. Let's send topPhotoId for now as the 'main' one
            // or if the API returns a consolidated analysis ID.

            // Assuming API returns { analysisId: string, ... }
            router.push(`/feature1/result?photoId=${data.analysisId || topId}`);

        } catch (err: unknown) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : "アップロードに失敗しました";
            setError(errorMessage);
            setUploading(false);
            setCapturedImages(null); // Reset to allow retake
        }
    };

    return (
        <Layout>
            <div className={styles.container}>
                {/* Info Message */}
                <AnimatePresence>
                    {infoMessage && (
                        <motion.div
                            className={styles.infoMessage}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            style={{ position: 'absolute', top: 20, left: 0, right: 0, margin: 'auto', zIndex: 50, maxWidth: '90%' }}
                        >
                            <Info size={18} color="#419873" />
                            <span>{infoMessage}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error Message */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            className={styles.errorMessage}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{ position: 'absolute', top: 80, left: 0, right: 0, margin: 'auto', zIndex: 50, maxWidth: '90%' }}
                        >
                            <AlertCircle size={16} />
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Capture Component */}
                {!isProcessing && !uploading && (
                    <VideoScanCapture
                        onComplete={handleCaptureComplete}
                        onError={(err) => setError(err)}
                    />
                )}

                {/* Extraction Animation */}
                {isProcessing && capturedImages && (
                    <ScanExtractionAnimation
                        images={capturedImages}
                        onProcessingComplete={handleExtractionComplete}
                    />
                )}

                {/* Uploading State -> New Organic Hourglass */}
                {uploading && (
                    <OrganicHourglass progress={progress} />
                )}
            </div>
        </Layout>
    );
}
// ...

export default function CapturePage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
            <CaptureContent />
        </Suspense>
    );
}
