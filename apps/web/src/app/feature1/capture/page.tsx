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

const styles = {
    container: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
        width: '100%',
        paddingBottom: '24px',
    },
    scrollArea: {
        flex: 1,
        overflowY: 'auto' as const,
        padding: '0 20px 24px',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
    },
    tipsCard: {
        width: '100%',
        maxWidth: '448px', // match max-w-md
        background: 'linear-gradient(135deg, rgba(65, 152, 115, 0.08) 0%, rgba(65, 152, 115, 0.02) 100%)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        padding: '16px',
        marginBottom: '24px',
        border: '1px solid rgba(65, 152, 115, 0.2)',
        boxShadow: '0 4px 20px rgba(26, 61, 46, 0.06)',
    },
    tipsHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
    },
    tipsTitle: {
        fontSize: '14px',
        fontWeight: '600' as const,
        color: '#1a3d2e',
    },
    tipsList: {
        margin: 0,
        paddingLeft: '20px',
        color: '#4a6356',
        fontSize: '13px',
        lineHeight: '1.6',
    },
    cameraContainer: {
        width: '100%',
        maxWidth: '448px', // match max-w-md
        marginBottom: '24px',
    },
    errorMessage: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        margin: '12px auto',
        padding: '12px 16px',
        background: 'rgba(184, 84, 80, 0.08)',
        borderRadius: '12px',
        color: '#b85450',
        fontSize: '14px',
        border: '1px solid rgba(184, 84, 80, 0.2)',
        maxWidth: '448px',
        width: '100%',
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
        width: '100%',
        maxWidth: '448px',
    },
    buttonWrapper: {
        width: '100%',
        maxWidth: '448px',
        marginTop: 'auto',
    }
};

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
            <div style={styles.container}>
                <div style={styles.scrollArea}>
                    {/* Info Message */}
                    <AnimatePresence>
                        {infoMessage && (
                            <motion.div
                                style={styles.infoMessage}
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
                        style={styles.tipsCard}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                            <Camera size={18} color="#419873" />
                            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1a3d2e', margin: 0 }}>
                                撮影のポイント
                            </h3>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                            {/* Tip 1 */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 8px rgba(65, 152, 115, 0.1)'
                                }}>
                                    <span style={{ fontSize: '24px' }}>☀️</span>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#1a3d2e', marginBottom: '2px' }}>明るい場所</p>
                                    <p style={{ fontSize: '10px', color: '#4a6356' }}>自然光推奨</p>
                                </div>
                            </div>

                            {/* Tip 2 */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 8px rgba(65, 152, 115, 0.1)'
                                }}>
                                    <span style={{ fontSize: '24px' }}>🔍</span>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#1a3d2e', marginBottom: '2px' }}>大きく写す</p>
                                    <p style={{ fontSize: '10px', color: '#4a6356' }}>生え際・頭頂部</p>
                                </div>
                            </div>

                            {/* Tip 3 */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 8px rgba(65, 152, 115, 0.1)'
                                }}>
                                    <span style={{ fontSize: '24px' }}>✨</span>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#1a3d2e', marginBottom: '2px' }}>髪を上げる</p>
                                    <p style={{ fontSize: '10px', color: '#4a6356' }}>おでこを出す</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Camera Component */}
                    <motion.div
                        style={styles.cameraContainer}
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
                                style={styles.buttonWrapper}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                transition={{ delay: 0.1 }}
                            >
                                <Button
                                    variant="primary" // Overridden by style
                                    size="full"
                                    icon={<div style={{ position: 'relative', zIndex: 10 }}><ChevronRight size={18} /></div>}
                                    iconPosition="right"
                                    disabled={uploading}
                                    onClick={handleUpload}
                                    style={{
                                        background: 'linear-gradient(135deg, #c9a962 0%, #b08d55 100%)', // Gold/Bronze gradient
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
                                                width: '100%', // Wide beam for soft feeling
                                                height: '100%',
                                                background: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.1) 20%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.1) 80%, transparent 100%)', // Very soft gradient
                                                transform: 'skewX(-25deg)',
                                                zIndex: 1,
                                            }}
                                            animate={{
                                                left: ['-100%', '200%'],
                                                opacity: [0, 1, 1, 0] // Fade in/out to avoid sudden cuts
                                            }}
                                            transition={{
                                                repeat: Infinity,
                                                duration: 2.0, // Elegant pace
                                                ease: "easeInOut",
                                                repeatDelay: 0.3 // Short pause
                                            }}
                                        />
                                    )}
                                </Button>

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
