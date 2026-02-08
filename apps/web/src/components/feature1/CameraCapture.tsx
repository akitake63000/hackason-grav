import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, RefreshCcw, X } from 'lucide-react';
import Button from '@/components/Button';
import { motion, AnimatePresence } from 'framer-motion';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
}

const videoConstraints = {
    width: 720,
    height: 720,
    facingMode: "user"
};

export default function CameraCapture({ onCapture }: CameraCaptureProps) {
    const webcamRef = useRef<Webcam>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    const capture = useCallback(() => {
        if (webcamRef.current) {
            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) {
                // Convert base64 to File
                fetch(imageSrc)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
                        setCapturedImage(imageSrc);
                        onCapture(file);
                    });
            }
        }
    }, [webcamRef, onCapture]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setCapturedImage(reader.result as string);
                onCapture(file);
            };
            reader.readAsDataURL(file);
        }
    };

    const retake = () => {
        setCapturedImage(null);
        // Don't close camera if we just took a picture, but maybe user wants to upload instead? 
        // Let's keep camera state as is or reset? 
        // If image was from upload, camera might not be open.
    };

    return (
        <div className="flex flex-col items-center w-full max-w-md mx-auto gap-6">
            <div className="relative w-full aspect-square bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300 shadow-inner">
                <AnimatePresence mode="wait">
                    {!capturedImage ? (
                        isCameraOpen ? (
                            <motion.div
                                key="webcam"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="w-full h-full"
                            >
                                <Webcam
                                    audio={false}
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={videoConstraints}
                                    className="w-full h-full object-cover"
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="placeholder"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="text-gray-400 flex flex-col items-center gap-2"
                            >
                                <div className="p-4 bg-gray-50 rounded-full">
                                    <Camera size={48} strokeWidth={1.5} />
                                </div>
                                <p className="text-sm font-medium">カメラを起動するか画像を選択</p>
                            </motion.div>
                        )
                    ) : (
                        <motion.div
                            key="preview"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="w-full h-full"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={capturedImage} alt="Preview" className="w-full h-full object-cover" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="w-full flex flex-col gap-4">
                {!capturedImage ? (
                    <div className="flex flex-col gap-3">
                        {/* Camera Logic */}
                        {!isCameraOpen ? (
                            <>
                                <Button
                                    variant="primary"
                                    onClick={() => setIsCameraOpen(true)}
                                    icon={<Camera size={20} />}
                                    size="lg"
                                    style={{ width: '100%', height: '56px' }}
                                >
                                    カメラを起動
                                </Button>
                                <div className="relative">
                                    <Button
                                        variant="secondary"
                                        icon={<Upload size={20} />}
                                        size="lg"
                                        style={{ width: '100%', height: '56px' }}
                                        onClick={() => document.getElementById('file-upload')?.click()}
                                    >
                                        画像を選択
                                    </Button>
                                    <input
                                        id="file-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <Button
                                    variant="primary"
                                    onClick={capture}
                                    size="lg"
                                    style={{ width: '100%', height: '56px' }}
                                    icon={<div className="w-4 h-4 rounded-full bg-white animate-pulse" />}
                                >
                                    撮影する
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsCameraOpen(false)}
                                    icon={<X size={20} />}
                                    size="lg"
                                    style={{ width: '100%', height: '56px', color: '#635d54' }}
                                >
                                    カメラを閉じる
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <Button
                        variant="secondary"
                        onClick={retake}
                        icon={<RefreshCcw size={18} />}
                        size="lg"
                        style={{ width: '100%', height: '56px' }}
                    >
                        再撮影 / 再選択
                    </Button>
                )}
            </div>
        </div>
    );
}
