'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, AlertCircle, Info, ChevronRight } from 'lucide-react';
import Layout from '@/components/Layout';
import CameraCapture from '@/components/feature1/CameraCapture';
import Button from '@/components/Button';
import { getFirebaseStorage, getFirestoreDb, getFirebaseAuth } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { apiFetch } from '@/lib/api';
import styles from './page.module.css';

function CaptureContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [file, setFile] = useState<File | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    // Initialize state from sessionStorage
    useEffect(() => {
        const savedImage = sessionStorage.getItem('capturedImage');
        if (savedImage) {
            setCapturedImage(savedImage);
            // Reconstruct File object from base64
            fetch(savedImage)
                .then(res => res.blob())
                .then(blob => {
                    const reconstructedFile = new File([blob], "capture.jpg", { type: "image/jpeg" });
                    setFile(reconstructedFile);
                })
                .catch(err => console.error("Failed to restore file from storage", err));
        }

        const message = searchParams.get('message');
        if (message) {
            setInfoMessage(decodeURIComponent(message));
        }
    }, [searchParams]);

    const handleCapture = (capturedFile: File, imageSrc: string) => {
        setFile(capturedFile);
        setCapturedImage(imageSrc);
        sessionStorage.setItem('capturedImage', imageSrc);
        setError(null);
    };

    const handleClear = () => {
        setFile(null);
        setCapturedImage(null);
        sessionStorage.removeItem('capturedImage');
        setError(null);
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);

        try {
            const auth = getFirebaseAuth();
            const user = auth.currentUser;

            if (!user) {
                throw new Error("ログインしてください");
            }

            const storage = getFirebaseStorage();
            const db = getFirestoreDb();

            // Generate photoId (UUIDv4) client-side
            const photoId = crypto.randomUUID();

            const storagePath = `users/${user.uid}/photos/${photoId}.jpg`;
            const storageRef = ref(storage, storagePath);

            // Upload to Storage
            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);

            // Save metadata to Firestore
            await setDoc(doc(db, `users/${user.uid}/photos`, photoId), {
                photoId,
                storagePath,
                downloadUrl,
                capturedAt: serverTimestamp(),
                status: 'uploaded'
            });

            // Call analysis API
            const analysisRes = await apiFetch('/api/v1/photos/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ photoId }),
            });

            if (!analysisRes.ok) {
                throw new Error('解析に失敗しました');
            }

            // Clear session storage on success
            sessionStorage.removeItem('capturedImage');

            // Redirect to Result page
            router.push(`/feature1/result?photoId=${photoId}`);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "アップロードに失敗しました");
        } finally {
            setUploading(false);
        }
    };

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.scrollArea}>
                    {/* Info Message */}
                    <AnimatePresence>
                        {infoMessage && (
                            <motion.div
                                className={styles.infoMessage}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Info size={18} color="#419873" />
                                <span>{infoMessage}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Tips Card */}
                    <motion.div
                        className={styles.tipsCard}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className={styles.tipsHeader}>
                            <Camera size={18} color="#419873" />
                            <h3 className={styles.tipsTitle}>
                                撮影のポイント
                            </h3>
                        </div>

                        <ul className={styles.tipsList}>
                            <li>☀️ 明るい場所で撮影（自然光推奨）</li>
                            <li>🔍 生え際・頭頂部を大きく写す</li>
                            <li>✨ おでこを出して髪を上げる</li>
                        </ul>
                    </motion.div>

                    {/* Camera Component */}
                    <motion.div
                        className={styles.cameraContainer}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <CameraCapture
                            onCapture={handleCapture}
                            onClear={handleClear}
                            initialImage={capturedImage}
                        />
                    </motion.div>

                    {/* Analyze Button */}
                    <AnimatePresence>
                        {file && (
                            <motion.div
                                className={styles.buttonWrapper}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                transition={{ delay: 0.1 }}
                            >
                                <Button
                                    variant="primary"
                                    size="full"
                                    icon={<div style={{ position: 'relative', zIndex: 10 }}><ChevronRight size={18} /></div>}
                                    iconPosition="right"
                                    disabled={uploading}
                                    onClick={handleUpload}
                                    style={{
                                        background: 'linear-gradient(135deg, #c9a962 0%, #b08d55 100%)',
                                        boxShadow: '0 4px 20px rgba(201, 169, 98, 0.4)',
                                        position: 'relative',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <span style={{ position: 'relative', zIndex: 10 }}>
                                        {uploading ? '解析中...' : 'この写真で解析する'}
                                    </span>
                                    {!uploading && (
                                        <motion.div
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: '-100%',
                                                width: '100%',
                                                height: '100%',
                                                background: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.1) 20%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.1) 80%, transparent 100%)',
                                                transform: 'skewX(-25deg)',
                                                zIndex: 1,
                                            }}
                                            animate={{
                                                left: ['-100%', '200%'],
                                                opacity: [0, 1, 1, 0]
                                            }}
                                            transition={{
                                                repeat: Infinity,
                                                duration: 2.0,
                                                ease: "easeInOut",
                                                repeatDelay: 0.3
                                            }}
                                        />
                                    )}
                                </Button>

                                {error && (
                                    <motion.div
                                        className={styles.errorMessage}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                    >
                                        <AlertCircle size={16} />
                                        {error}
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </Layout>
    );
}

export default function CapturePage() {
    return (
        <Suspense fallback={
            <Layout>
                <div style={{ padding: '24px', textAlign: 'center' }}>
                    <p>Loading...</p>
                </div>
            </Layout>
        }>
            <CaptureContent />
        </Suspense>
    );
}
