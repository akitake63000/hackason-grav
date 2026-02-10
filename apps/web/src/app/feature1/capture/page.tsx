'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Camera, Upload, AlertCircle, Info } from 'lucide-react';
import Layout from '@/components/Layout';
import CameraCapture from '@/components/feature1/CameraCapture';
import { getFirebaseStorage, getFirestoreDb, getFirebaseAuth } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { apiFetch } from '@/lib/api';
import styles from './page.module.css';

function CaptureContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    useEffect(() => {
        const message = searchParams.get('message');
        if (message) {
            setInfoMessage(decodeURIComponent(message));
        }
    }, [searchParams]);

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
                    {infoMessage && (
                        <motion.div
                            className={styles.infoMessage}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Info size={18} color="#419873" />
                            <span>{infoMessage}</span>
                        </motion.div>
                    )}

                    {/* Tips Card */}
                    <motion.div
                        className={styles.tipsCard}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className={styles.tipsHeader}>
                            <Camera size={20} color="#419873" />
                            <h3 className={styles.tipsTitle}>撮影のポイント</h3>
                        </div>
                        <ul className={styles.tipsList}>
                            <li>明るい場所で撮影してください</li>
                            <li>「生え際」または「頭頂部」を大きく写してください</li>
                            <li>髪をかき上げて撮影すると精度が上がります</li>
                        </ul>
                    </motion.div>

                    {/* Camera Component */}
                    <motion.div
                        className={styles.cameraContainer}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <CameraCapture onCapture={setFile} />
                    </motion.div>

                    {/* Upload Button */}
                    {file && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <motion.button
                                className={styles.uploadButton}
                                onClick={handleUpload}
                                disabled={uploading}
                                whileHover={uploading ? {} : { scale: 1.02 }}
                                whileTap={uploading ? {} : { scale: 0.98 }}
                            >
                                <Upload size={20} />
                                {uploading ? '処理中...' : '解析に進む'}
                            </motion.button>

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
                </div>
            </div>
        </Layout>
    );
}

export default function CapturePage() {
    return (
        <Suspense fallback={
            <Layout>
                <div className={styles.loadingFallback}>
                    <p>Loading...</p>
                </div>
            </Layout>
        }>
            <CaptureContent />
        </Suspense>
    );
}
