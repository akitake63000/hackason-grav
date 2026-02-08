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

const styles = {
    container: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
        width: '100%',
    },
    scrollArea: {
        flex: 1,
        overflowY: 'auto' as const,
        padding: '0 20px 24px',
    },
    tipsCard: {
        background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.08) 0%, rgba(65, 152, 115, 0.02) 100%)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid rgba(65, 152, 115, 0.2)',
        boxShadow: '0 4px 20px rgba(26, 61, 46, 0.06)',
    },
    tipsHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
    },
    tipsTitle: {
        fontSize: '15px',
        fontWeight: '600' as const,
        color: '#1a3d2e',
    },
    tipsList: {
        margin: 0,
        paddingLeft: '20px',
        color: '#4a6356',
        fontSize: '14px',
        lineHeight: '1.8',
    },
    cameraContainer: {
        marginBottom: '24px',
    },
    uploadButton: {
        width: '100%',
        padding: '16px',
        borderRadius: '16px',
        border: 'none',
        background: 'linear-gradient(135deg, #419873 0%, #347a5c 100%)',
        color: '#ffffff',
        fontSize: '16px',
        fontWeight: '600' as const,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        boxShadow: '0 4px 16px rgba(65, 152, 115, 0.3)',
    },
    uploadButtonDisabled: {
        background: 'linear-gradient(135deg, #b9b3a9 0%, #9c958a 100%)',
        cursor: 'not-allowed',
        boxShadow: 'none',
    },
    errorMessage: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '12px',
        padding: '12px 16px',
        background: 'rgba(184, 84, 80, 0.08)',
        borderRadius: '12px',
        color: '#b85450',
        fontSize: '14px',
        border: '1px solid rgba(184, 84, 80, 0.2)',
    },
    infoMessage: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '16px',
        background: 'rgba(65, 152, 115, 0.08)',
        borderRadius: '16px',
        color: '#1a3d2e',
        fontSize: '14px',
        border: '1px solid rgba(65, 152, 115, 0.2)',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(65, 152, 115, 0.1)',
    },
};

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
            <div style={styles.container}>
                <div style={styles.scrollArea}>
                    {/* Info Message */}
                    {infoMessage && (
                        <motion.div
                            style={styles.infoMessage}
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
                        style={styles.tipsCard}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div style={styles.tipsHeader}>
                            <Camera size={20} color="#419873" />
                            <h3 style={styles.tipsTitle}>撮影のポイント</h3>
                        </div>
                        <ul style={styles.tipsList}>
                            <li>明るい場所で撮影してください</li>
                            <li>「生え際」または「頭頂部」を大きく写してください</li>
                            <li>髪をかき上げて撮影すると精度が上がります</li>
                        </ul>
                    </motion.div>

                    {/* Camera Component */}
                    <motion.div
                        style={styles.cameraContainer}
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
                                style={{
                                    ...styles.uploadButton,
                                    ...(uploading ? styles.uploadButtonDisabled : {}),
                                }}
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
                                    style={styles.errorMessage}
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
                <div style={{ padding: '24px', textAlign: 'center' }}>
                    <p>Loading...</p>
                </div>
            </Layout>
        }>
            <CaptureContent />
        </Suspense>
    );
}
