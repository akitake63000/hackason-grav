import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, X, AlertCircle } from 'lucide-react';

interface CameraCaptureProps {
    onCapture: (file: File, imageSrc: string) => void;
    onClear: () => void;
    initialImage?: string | null;
}

const videoConstraints = {
    width: 720,
    height: 720,
    facingMode: "user"
};

const styles = {
    wrapper: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        width: '100%',
        gap: '24px',
    },
    cameraFrame: {
        position: 'relative' as const,
        width: '100%',
        aspectRatio: '1 / 1',
        backgroundColor: '#f3f4f6', // gray-100
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        border: '1px solid #e5e7eb', // gray-200
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorContainer: {
        textAlign: 'center' as const,
        padding: '24px',
        color: '#ef4444', // red-500
    },
    webcam: {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
    },
    previewImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
    },
    clearButton: {
        position: 'absolute' as const,
        top: '16px',
        left: '16px',
        padding: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(4px)',
        borderRadius: '9999px',
        border: 'none',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        cursor: 'pointer',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    controls: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '32px',
        width: '100%',
        maxWidth: '320px',
    },
    fileLabel: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '4px',
        cursor: 'pointer',
    },
    iconCircle: {
        width: '48px',
        height: '48px',
        borderRadius: '9999px',
        backgroundColor: '#f3f4f6', // gray-100
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#4b5563', // gray-600
        transition: 'background-color 0.2s',
    },
    labelText: {
        fontSize: '12px',
        color: '#6b7280', // gray-500
        fontWeight: 500,
    },
    shutterButtonOuter: {
        width: '80px',
        height: '80px',
        borderRadius: '9999px',
        border: '4px solid #e5e7eb', // gray-200
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        padding: 0,
        transition: 'opacity 0.2s',
    },
    shutterButtonInner: {
        width: '64px',
        height: '64px',
        borderRadius: '9999px',
        background: 'linear-gradient(135deg, #0693e3 0%, #0570b8 100%)',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        transform: 'scale(1)',
        transition: 'transform 0.1s',
    },
    placeholder: {
        width: '48px',
        opacity: 0,
    },
};

export default function CameraCapture({ onCapture, onClear, initialImage }: CameraCaptureProps) {
    const webcamRef = useRef<Webcam>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);

    const capture = useCallback(() => {
        if (webcamRef.current) {
            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) {
                // Convert base64 to File
                fetch(imageSrc)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
                        onCapture(file, imageSrc);
                    });
            }
        }
    }, [webcamRef, onCapture]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                onCapture(file, result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUserMedia = () => {
        setCameraError(null);
        setIsCameraReady(true);
    };

    const handleUserMediaError = (error: any) => {
        console.error("Camera error:", error);
        setIsCameraReady(false);

        let errorMessage = "カメラの起動に失敗しました";
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = "カメラへのアクセスが拒否されました。";
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = "カメラが見つかりませんでした。";
        }
        setCameraError(errorMessage);
    };

    // Review Mode (Image Captured)
    if (initialImage) {
        return (
            <div style={styles.cameraFrame}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={initialImage} alt="Preview" style={styles.previewImage} />

                {/* Clear Button */}
                <button
                    onClick={onClear}
                    style={styles.clearButton}
                    aria-label="再撮影"
                >
                    <X size={24} color="#374151" />
                </button>
            </div>
        );
    }

    // Camera Mode
    return (
        <div style={styles.wrapper}>
            <div style={styles.cameraFrame}>
                {cameraError ? (
                    <div style={styles.errorContainer}>
                        <AlertCircle size={32} style={{ margin: '0 auto 8px', display: 'block' }} />
                        <p style={{ fontSize: '14px', fontWeight: 500 }}>{cameraError}</p>
                    </div>
                ) : (
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={videoConstraints}
                        style={styles.webcam}
                        onUserMedia={handleUserMedia}
                        onUserMediaError={handleUserMediaError}
                        forceScreenshotSourceSize={true}
                    />
                )}
            </div>

            {/* Controls */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '0 20px',
            }}>
                {/* Left Side (Album) */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        padding: '10px 20px',
                        borderRadius: '30px',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s ease',
                        color: '#313131',
                        fontWeight: 600,
                        fontSize: '12px',
                        lineHeight: '1.4',
                        textAlign: 'left',
                    }}>
                        <Upload size={24} />
                        <span>アルバム<br />から選択</span>
                        <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                    </label>
                </div>

                {/* Center (Shutter) */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={capture}
                        disabled={!isCameraReady}
                        style={{
                            ...styles.shutterButtonOuter,
                            opacity: !isCameraReady ? 0.5 : 1,
                            cursor: !isCameraReady ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <div style={styles.shutterButtonInner} />
                    </button>
                </div>

                {/* Right Side (Spacer) */}
                <div style={{ flex: 1 }}></div>
            </div>
        </div>
    );
}
