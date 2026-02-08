'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, AlertCircle, Lightbulb } from 'lucide-react';
import CameraCapture from '@/components/feature1/CameraCapture';
import Layout from '@/components/Layout';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { getFirebaseStorage, getFirestoreDb, getFirebaseAuth } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const styles = {
    container: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        width: '100%',
    },
    content: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        padding: '24px',
        gap: '24px',
        maxWidth: '600px', // Limit width for camera view
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box' as const,
    },
    title: {
        fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
        fontSize: 'clamp(24px, 4vw, 32px)',
        fontWeight: '600',
        color: '#1a3d2e',
        textAlign: 'center' as const,
    },
    subtitle: {
        fontSize: '14px',
        color: '#7f786d',
        textAlign: 'center' as const,
        marginTop: '4px',
    },
    tipHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#1a3d2e',
    },
    tipText: {
        fontSize: '13px',
        color: '#635d54',
        lineHeight: 1.6,
        paddingLeft: '24px',
    },
    errorText: {
        color: '#dc2626',
        fontSize: '14px',
        textAlign: 'center' as const,
        marginTop: '8px',
    },
    buttonWrapper: {
        marginTop: 'auto', // Push to bottom if content is short
        paddingTop: '16px',
    }
};

export default function CapturePage() {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

            // Step 1: Generate photoId (UUIDv4) client-side
            const photoId = crypto.randomUUID();

            const storagePath = `users/${user.uid}/photos/${photoId}.jpg`;
            const storageRef = ref(storage, storagePath);

            // Step 2: Upload to Storage
            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);

            // Step 3: Save metadata to Firestore
            await setDoc(doc(db, `users/${user.uid}/photos`, photoId), {
                photoId,
                storagePath,
                downloadUrl,
                capturedAt: serverTimestamp(),
                status: 'uploaded'
            });

            // Step 4: Redirect to Result page with photoId
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
                <div style={styles.content}>
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <h1 style={styles.title}>AIチェック撮影</h1>
                        <p style={styles.subtitle}>頭皮の状態を撮影してください</p>
                    </motion.div>

                    {/* Tips Card */}
                    <Card variant="accent" padding="md" delay={0.1}>
                        <div style={styles.tipHeader}>
                            <Lightbulb size={20} color="#c9a962" />
                            <span>撮影のポイント</span>
                        </div>
                        <div style={styles.tipText}>
                            • 明るい場所で撮影してください<br />
                            •「生え際」または「頭頂部」を大きく写してください<br />
                            • 髪をかき上げて撮影すると精度が上がります
                        </div>
                    </Card>

                    {/* Camera Area */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <CameraCapture onCapture={setFile} />
                    </motion.div>

                    {/* Action Button */}
                    <div style={styles.buttonWrapper}>
                        <AnimatePresence>
                            {file && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                >
                                    <Button
                                        variant="primary"
                                        size="full"
                                        icon={<Camera size={20} />}
                                        onClick={handleUpload}
                                        disabled={uploading}
                                    >
                                        {uploading ? '解析準備中...' : '解析に進む'}
                                    </Button>
                                    {error && (
                                        <p style={styles.errorText}>{error}</p>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
