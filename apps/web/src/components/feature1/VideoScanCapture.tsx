'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, RotateCcw, AlertCircle, RefreshCw, ArrowRight, ArrowDown, Loader2 } from 'lucide-react';
import Button from '@/components/Button';
import styles from './VideoScanCapture.module.css';

// MediaPipe Tasks Vision Imports
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// Types
export type ScanPhase = 'guide' | 'front' | 'top' | 'side' | 'complete';
export type DeviceType = 'mobile' | 'pc';

// Quality Gate Thresholds
const QUALITY_THRESHOLDS = {
    pc: {
        sharpness: 10,  // Variance of Laplacian
        motion: 50,     // Pixel difference mean
        brightness: 40, // Average luminance (0-255)
    },
    mobile: {
        sharpness: 20,
        motion: 30,
        brightness: 50,
    }
};

const REQUIRED_GOOD_FRAMES = 60; // Frames needed to complete a phase (approx 1-2s at 30-60fps)

// Angle Thresholds (Degrees)
const POSE_THRESHOLDS = {
    FRONT: { yaw: 15, pitch: 15 },
    SIDE: { yawMin: 15 },
    TOP: { pitchMin: 30 } // Increased to 30 as requested
};

// ... inside component ...




interface VideoScanCaptureProps {
    onComplete: (images: { side: string; front: string; top: string; deviceType: DeviceType }) => void;
    onError?: (error: string) => void;
}

export default function VideoScanCapture({ onComplete, onError }: VideoScanCaptureProps) {
    // State
    const [phase, setPhase] = useState<ScanPhase>('guide');
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [deviceType, setDeviceType] = useState<DeviceType>('pc');
    const [progress, setProgress] = useState(0);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [images, setImages] = useState<{ side?: string; front?: string; top?: string }>({});
    const [isModelLoading, setIsModelLoading] = useState(true);
    const [poseDebug, setPoseDebug] = useState<string>("");
    const [canManualCapture, setCanManualCapture] = useState(true);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    const lastVideoTimeRef = useRef<number>(-1);

    // Accumulators
    const goodFrameCount = useRef(0);
    const bestShotBuffer = useRef<{ score: number; image: string } | null>(null);
    const previousFrameData = useRef<Uint8ClampedArray | null>(null);

    // Latest Pose Data
    const currentPose = useRef<{ yaw: number, pitch: number, faceDetected: boolean }>({ yaw: 0, pitch: 0, faceDetected: false });

    // Initialize FaceLandmarker
    useEffect(() => {
        let isMounted = true;

        const initLandmarker = async () => {
            // Client-side guard
            if (typeof window === 'undefined') return;

            try {
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
                );

                const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU"
                    },
                    outputFaceBlendshapes: false,
                    runningMode: "VIDEO",
                    numFaces: 1
                });

                if (isMounted) {
                    faceLandmarkerRef.current = faceLandmarker;
                    setIsModelLoading(false);
                }
            } catch (error) {
                console.error("Failed to load FaceLandmarker:", error);
                if (isMounted && onError) onError("AIモデルの読み込みに失敗しました");
            }
        };

        initLandmarker();

        return () => {
            isMounted = false;
            // FaceLandmarker.close() might be needed but not exposed directly in some versions?
            // Actually it has close(), let's use it if available.
            if (faceLandmarkerRef.current) {
                try {
                    faceLandmarkerRef.current.close();
                } catch (e) { console.warn("Failed to close landmarker", e); }
            }
        };
    }, [onError]);


    // Initialize Camera Stream


    // Clean up buffers on phase change to prevent "Bleed over" of frames
    useEffect(() => {
        if (phase !== 'guide' && phase !== 'complete') {
            goodFrameCount.current = 0;
            bestShotBuffer.current = null;
            previousFrameData.current = null;
            setProgress(0);
            setFeedback(null);
        }
    }, [phase]);

    // Initialize Camera Stream
    useEffect(() => {
        const startCamera = async () => {
            try {
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                setDeviceType(isMobile ? 'mobile' : 'pc');

                const constraints = {
                    video: {
                        facingMode: 'user',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current?.play();
                    };
                }

            } catch (err: unknown) {
                console.error("Camera access error:", err);
                if (onError) onError("カメラへのアクセスが許可されていません");
            }
        };

        if (phase !== 'complete' && phase !== 'guide') {
            startCamera();
        }

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };

    }, [phase, onError]);


    // Start Scanning (Front first)
    const startScanning = () => {
        setPhase('front');
    };

    // --- Image Analysis Helpers ---

    const getLuminance = (data: Uint8ClampedArray) => {
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
            sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        return sum / (data.length / 4);
    };

    const calculateSharpness = (data: Uint8ClampedArray, width: number, height: number): number => {
        const gray = new Uint8ClampedArray(width * height);
        for (let i = 0; i < data.length; i += 4) {
            gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        let mean = 0;
        const laplacian = new Int32Array(width * height);
        let count = 0;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const val = (
                    gray[idx - width] +
                    gray[idx - 1] + gray[idx + 1] +
                    gray[idx + width]
                ) - (gray[idx] * 4);

                laplacian[idx] = val;
                mean += val;
                count++;
            }
        }
        mean /= count;

        let variance = 0;
        for (let i = 0; i < count; i++) {
            const diff = laplacian[i] - mean;
            variance += diff * diff;
        }
        return variance / count;
    };

    const calculateMotion = (currentRatioData: Uint8ClampedArray, prevData: Uint8ClampedArray): number => {
        if (currentRatioData.length !== prevData.length) return 100;
        let diffSum = 0;
        for (let i = 0; i < currentRatioData.length; i += 4) {
            diffSum += Math.abs(currentRatioData[i] - prevData[i]);
        }
        return diffSum / (currentRatioData.length / 4);
    };

    const startTransition = useCallback((nextPhase: ScanPhase) => {
        setIsTransitioning(true);
        setCountdown(3);

        // Reset buffers
        setProgress(0);
        goodFrameCount.current = 0;
        bestShotBuffer.current = null;
        previousFrameData.current = null;
        setFeedback(null);

        let count = 3;
        const timer = setInterval(() => {
            count--;
            setCountdown(count);
            if (count <= 0) {
                clearInterval(timer);
                setIsTransitioning(false);
                setPhase(nextPhase);
            }
        }, 1000);
    }, []);

    const handlePhaseComplete = useCallback(() => {
        const bestShot = bestShotBuffer.current?.image;
        if (!bestShot) return;

        setImages(prev => ({ ...prev, [phase]: bestShot }));

        // Transition logic: Front -> Top -> Side
        if (phase === 'front') {
            startTransition('top');
        } else if (phase === 'top') {
            startTransition('side');
        } else if (phase === 'side') {
            setPhase('complete');
        }
    }, [phase, startTransition]);


    // MAIN LOOP
    const analyzeFrame = useCallback(async () => {
        if (phase === 'guide' || phase === 'complete') {
            return;
        }

        if (!videoRef.current || !canvasRef.current || isTransitioning) {
            requestRef.current = requestAnimationFrame(analyzeFrame);
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const landmarker = faceLandmarkerRef.current;

        if (!ctx || video.readyState !== 4) {
            requestRef.current = requestAnimationFrame(analyzeFrame);
            return;
        }

        // 1. Detect Pose (FaceLandmarker)
        // Only process if video time has advanced
        if (landmarker && video.currentTime !== lastVideoTimeRef.current) {
            const results = landmarker.detectForVideo(video, Date.now());
            lastVideoTimeRef.current = video.currentTime;

            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                const landmarks = results.faceLandmarks[0];

                // Reuse indices for Nose(1), Ears(234, 454), Chin(152), Forehead(10)
                const nose = landmarks[1];
                const leftEar = landmarks[234];
                const rightEar = landmarks[454];
                const chin = landmarks[152];
                const forehead = landmarks[10];

                // Note: Landmarks are normalized [0,1].
                const midEarX = (leftEar.x + rightEar.x) / 2;
                const yawRaw = (nose.x - midEarX);
                const yaw = yawRaw * 200; // Approx degrees scaling

                const midFaceY = (forehead.y + chin.y) / 2;
                const pitchRaw = (nose.y - midFaceY);
                const pitch = pitchRaw * 200;

                currentPose.current = { yaw, pitch, faceDetected: true };
                // setPoseDebug(`Y: ${yaw.toFixed(0)}, P: ${pitch.toFixed(0)}`);
            } else {
                currentPose.current = { yaw: 0, pitch: 0, faceDetected: false };
            }
        } else if (!landmarker) {
            // If strictly needed, wait for landmarker. For now, just skip pose update.
        }

        // 2. Draw for Quality Analyis (Canvas)
        const analysisWidth = 320;
        const analysisHeight = 240;
        canvas.width = analysisWidth;
        canvas.height = analysisHeight;
        ctx.drawImage(video, 0, 0, analysisWidth, analysisHeight);

        const roiWidth = analysisWidth * 0.5;
        const roiHeight = analysisHeight * 0.5;
        const roiX = (analysisWidth - roiWidth) / 2;
        const roiY = (analysisHeight - roiHeight) / 2;
        const imageData = ctx.getImageData(roiX, roiY, roiWidth, roiHeight);
        const data = imageData.data;

        // -- CHECKS --

        // A. Head Pose Check
        const { yaw, pitch, faceDetected } = currentPose.current;
        let poseValid = false;
        let poseFeedback: string | null = null;
        const yAbs = Math.abs(yaw);
        const pAbs = Math.abs(pitch);

        const checkPoseValidity = () => {
            if (phase === 'front') {
                if (!faceDetected) return "顔が検出されません";
                if (yAbs > POSE_THRESHOLDS.FRONT.yaw) return "正面を向いてください";
                if (pAbs > POSE_THRESHOLDS.FRONT.pitch) return "正面を向いてください";
                return true;
            }
            else if (phase === 'top') {
                // Top: Must be looking down properly OR Face not detected (assumed showing top of head)
                if (faceDetected) {
                    if (pitch < POSE_THRESHOLDS.TOP.pitchMin) {
                        return "もっと深く頭を下げてください";
                    }
                    return true;
                } else {
                    // Face lost -> Assume Top of Head is visible
                    return true;
                }
            }
            else if (phase === 'side') {
                if (!faceDetected) return "顔が見えません。少し正面に戻してください";
                if (yAbs < POSE_THRESHOLDS.SIDE.yawMin) return "横を向いてください";
                return true;
            }
            return false;
        };

        const validity = checkPoseValidity();

        if (validity === true) {
            poseValid = true;
            poseFeedback = null;
        } else {
            poseValid = false;
            poseFeedback = typeof validity === 'string' ? validity : "位置を調整してください";
        }

        if (!poseValid) {
            setFeedback(poseFeedback);
            goodFrameCount.current = 0;
            setProgress(0);
            previousFrameData.current = data;
            requestRef.current = requestAnimationFrame(analyzeFrame);
            return;
        }

        // B. Quality Checks (Only if Pose Valid)
        const thresholds = QUALITY_THRESHOLDS[deviceType];

        // B1. Brightness
        const brightness = getLuminance(data);
        if (brightness < thresholds.brightness) {
            setFeedback("もう少し明るい場所へ移動してください");
            goodFrameCount.current = 0;
            setProgress(0);
            previousFrameData.current = data;
            requestRef.current = requestAnimationFrame(analyzeFrame);
            return;
        }

        // B2. Motion
        let motionScore = 0;
        if (previousFrameData.current) {
            motionScore = calculateMotion(data, previousFrameData.current);
        }
        previousFrameData.current = Uint8ClampedArray.from(data);

        if (motionScore > thresholds.motion) {
            setFeedback("カメラを固定してください");
            goodFrameCount.current = Math.max(0, goodFrameCount.current - 1);
            setProgress((goodFrameCount.current / REQUIRED_GOOD_FRAMES) * 100);
            requestRef.current = requestAnimationFrame(analyzeFrame);
            return;
        }

        // B3. Sharpness
        const sharpness = calculateSharpness(data, roiWidth, roiHeight);
        if (sharpness < thresholds.sharpness) {
            setFeedback("ピントを合わせてください");
            requestRef.current = requestAnimationFrame(analyzeFrame);
            return;
        }

        // --- ALL GOOD ---
        setFeedback(null);
        goodFrameCount.current += 1;
        const currentProgress = Math.min((goodFrameCount.current / REQUIRED_GOOD_FRAMES) * 100, 100);
        setProgress(currentProgress);

        if (!bestShotBuffer.current || sharpness > bestShotBuffer.current.score) {
            const captureCanvas = document.createElement('canvas');
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
            captureCanvas.getContext('2d')?.drawImage(video, 0, 0);

            bestShotBuffer.current = {
                score: sharpness,
                image: captureCanvas.toDataURL('image/jpeg', 0.9)
            };
        }

        if (goodFrameCount.current >= REQUIRED_GOOD_FRAMES) {
            handlePhaseComplete();
        }

        requestRef.current = requestAnimationFrame(analyzeFrame);
    }, [phase, deviceType, isTransitioning, handlePhaseComplete]);


    useEffect(() => {
        requestRef.current = requestAnimationFrame(analyzeFrame);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [analyzeFrame]);

    // Completion
    useEffect(() => {
        if (phase === 'complete' && images.side && images.front && images.top) {
            onComplete({
                side: images.side!,
                front: images.front!,
                top: images.top!,
                deviceType
            });
        }
    }, [phase, images, onComplete, deviceType]);

    const handleRetake = () => {
        setProgress(0);
        goodFrameCount.current = 0;
        bestShotBuffer.current = null;
        setFeedback(null);
    };

    const handleManualCapture = useCallback(() => {
        if (!bestShotBuffer.current || isTransitioning) return;
        handlePhaseComplete();
    }, [handlePhaseComplete, isTransitioning]);

    const handleBack = () => {
        setProgress(0);
        goodFrameCount.current = 0;
        bestShotBuffer.current = null;
        if (phase === 'side') setPhase('top');
        else if (phase === 'top') setPhase('front');
        else if (phase === 'front') setPhase('guide');
    };

    const getInstructionText = () => {
        if (isModelLoading) return "AIモデル準備中...";
        if (isTransitioning) return "次のポジションへ...";
        switch (phase) {
            case 'front': return '正面を向いてください';
            case 'top': return '頭を下に向けて頭頂部を見せてください';
            case 'side': return '横を向いてください';
            default: return '';
        }
    };

    const getAROverlay = () => {
        if (isTransitioning) return null;
        if (phase === 'front' || phase === 'top') {
            return (
                <svg viewBox="0 0 100 100" className={styles.overlay}>
                    <path d="M20,20 Q50,90 80,20" className={styles.arPath} />
                </svg>
            );
        } else if (phase === 'side') {
            return (
                <svg viewBox="0 0 100 100" className={styles.overlay}>
                    {/* Flipped profile outline: Facing desired direction */}
                    <path d="M70,20 Q30,20 30,50 Q30,90 60,90" className={styles.arPath} />
                    <path d="M55,40 Q40,40 40,55 Q40,70 55,70" className={styles.arPathHighlight} />
                </svg>
            );
        }
        return null;
    };

    if (phase === 'guide') {
        return (
            <div className={styles.guideContainer}>
                <div className={styles.iconWrapper}>
                    <Camera size={48} color="#0693e3" />
                </div>
                <h2 className={styles.title}>動画で頭皮スキャン</h2>
                <p className={styles.description}>
                    カメラを動かして、正面・頭頂部・横顔の順にスキャンします。<br />
                    AIが顔の向きと画質をチェックします。
                </p>
                {isModelLoading ? (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-emerald-600" size={32} />
                        <span className="text-sm text-gray-500">AIモデル準備中...</span>
                    </div>
                ) : (
                    <Button onClick={startScanning} variant="primary" size="lg" icon={<Camera size={24} />} style={{ marginBottom: 0 }}>
                        スキャン開始
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.videoWrapper}>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={styles.video}
                />

                {getAROverlay()}

                {!isTransitioning && !isModelLoading && (
                    <div className={styles.progressContainer}>
                        <svg className={styles.progressSvg}>
                            <circle cx="96" cy="96" r="90" className={styles.progressBg} />
                            <circle
                                cx="96" cy="96" r="90"
                                className={styles.progressFill}
                                strokeDasharray={565}
                                strokeDashoffset={565 - (565 * progress) / 100}
                            />
                        </svg>
                    </div>
                )}

                {/* Transition Overlay */}
                <AnimatePresence>
                    {isTransitioning && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className={styles.transitionOverlay}
                        >
                            <div className={styles.countdown}>{countdown}</div>
                            <p className={styles.transitionText}>
                                次のポジションへ<br />移動してください
                            </p>
                            {phase === 'front' ? (
                                <ArrowDown size={48} className="mt-4 text-white animate-bounce" />
                            ) : (
                                <ArrowRight size={48} className="mt-4 text-white animate-pulse" />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <canvas ref={canvasRef} className="hidden" style={{ display: 'none' }} />

                <AnimatePresence>
                    {feedback && !isTransitioning && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={styles.feedbackToast}
                        >
                            <AlertCircle size={16} />
                            <span>{feedback}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {poseDebug && (
                    <div className="absolute bottom-20 left-4 bg-black/50 text-white text-xs p-1">
                        {poseDebug}
                    </div>
                )}
            </div>

            <div className={styles.controls}>
                <div className={styles.phaseIndicator}>
                    <div className={styles.dots}>
                        <span className={`${styles.dot} ${phase === 'front' ? styles.dotActive : ''}`} />
                        <span className={`${styles.dot} ${phase === 'top' ? styles.dotActive : ''}`} />
                        <span className={`${styles.dot} ${phase === 'side' ? styles.dotActive : ''}`} />
                    </div>
                    <span className={styles.phaseLabel}>
                        {phase === 'front' && 'Front'}
                        {phase === 'top' && 'Top'}
                        {phase === 'side' && 'Side'}
                    </span>
                </div>

                <h3 className={styles.instruction}>
                    {getInstructionText()}
                </h3>

                {/* Manual Capture Button */}
                {!isTransitioning && phase !== 'complete' && (
                    <div className={styles.manualCaptureContainer}>
                        <Button
                            onClick={handleManualCapture}
                            variant="primary"
                            size="lg"
                            icon={<Camera size={24} />}
                            style={{ marginTop: 16 }}
                        >
                            今すぐ撮影
                        </Button>

                        <motion.div
                            className={styles.manualCaptureHint}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            またはそのまま待つと自動撮影されます
                        </motion.div>
                    </div>
                )}

                <div className={styles.controlsBottom}>
                    {/* Back Button: Hide on Front phase */}
                    {!isTransitioning && phase !== 'front' && (
                        <button onClick={handleBack} className={styles.backButton}>
                            <RotateCcw size={24} />
                            <span className={styles.backLabel}>戻る</span>
                        </button>
                    )}

                    {/* Captured Images Gallery */}
                    <div className={styles.galleryContainer}>
                        <AnimatePresence mode='popLayout'>
                            {['front', 'top', 'side'].map((p) => {
                                const imgUrl = images[p as keyof typeof images];
                                if (!imgUrl) return null;
                                return (
                                    <motion.div
                                        key={p}
                                        className={styles.thumbnailWrapper}
                                        initial={{ opacity: 0, y: -20, scale: 0.8 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    >
                                        <img src={imgUrl} alt={p} className={styles.thumbnail} />
                                        <div className={styles.checkMark}>✓</div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>

                    {/* Forward Button: Show ONLY if image for current phase exists (Retake Skip) */}
                    {!isTransitioning && images[phase as keyof typeof images] && (
                        <button onClick={() => {
                            if (phase === 'front') startTransition('top');
                            else if (phase === 'top') startTransition('side');
                            else if (phase === 'side') setPhase('complete');
                        }} className={styles.forwardButton}>
                            <ArrowRight size={24} />
                            <span className={styles.backLabel}>進む</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
