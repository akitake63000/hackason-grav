'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import CameraCapture from '@/components/feature1/CameraCapture';
import { getFirebaseStorage, getFirestoreDb, getFirebaseAuth } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

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
            // Consistent ID: users/{uid}/photos/{photoId}
            await setDoc(doc(db, `users/${user.uid}/photos`, photoId), {
                photoId,
                storagePath,
                downloadUrl,
                capturedAt: serverTimestamp(),
                status: 'uploaded'
            });

            // Step 4: Redirect to Result page with photoId
            // Crucial: We do NOT call the analysis API here. ROI separation.
            router.push(`/feature1/result?photoId=${photoId}`);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "アップロードに失敗しました");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white pb-20">
            <header className="p-4 border-b flex items-center justify-between">
                <h1 className="text-xl font-bold">AIチェック: 撮影</h1>
            </header>

            <main className="p-4">
                <div className="mb-6 bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                    <p className="font-bold mb-2">📸 撮影のポイント</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>明るい場所で撮影してください</li>
                        <li>「生え際」または「頭頂部」を大きく写してください</li>
                        <li>髪をかき上げて撮影すると精度が上がります</li>
                    </ul>
                </div>

                <CameraCapture onCapture={setFile} />

                {file && (
                    <div className="max-w-md mx-auto mt-6">
                        <button
                            onClick={handleUpload}
                            disabled={uploading}
                            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition
                ${uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}
              `}
                        >
                            {uploading ? '処理中...' : '解析に進む'}
                        </button>
                        {error && <p className="text-red-500 text-center mt-2">{error}</p>}
                    </div>
                )}
            </main>
        </div>
    );
}
