import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, RefreshCcw, AlertCircle } from 'lucide-react';

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
    const [cameraError, setCameraError] = useState<string | null>(null);

    const capture = useCallback(() => {
        if (webcamRef.current) {
            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) {
                setCapturedImage(imageSrc);
                // Convert base64 to File
                fetch(imageSrc)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
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
        setCameraError(null);
    };

    const handleUserMedia = () => {
        console.log("Camera started successfully");
        setCameraError(null);
    };

    const handleUserMediaError = (error: any) => {
        console.error("Camera error:", error);
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        setIsCameraOpen(false);

        let errorMessage = "カメラの起動に失敗しました";

        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = "カメラへのアクセスが拒否されました。ブラウザの設定でカメラの使用を許可してください。";
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = "カメラが見つかりませんでした。デバイスにカメラが接続されているか確認してください。";
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = "カメラは他のアプリケーションで使用中の可能性があります。";
        } else if (error.name === 'OverconstrainedError') {
            errorMessage = "カメラの設定に問題があります。";
        } else if (error.name === 'TypeError') {
            errorMessage = "カメラへのアクセスにはHTTPS接続が必要です。";
        }

        setCameraError(errorMessage);
    };

    return (
        <div className="flex flex-col items-center w-full max-w-md mx-auto p-4 gap-4">
            {/* Camera Error Message */}
            {cameraError && (
                <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-red-800 text-sm font-medium mb-1">カメラエラー</p>
                        <p className="text-red-700 text-sm">{cameraError}</p>
                    </div>
                </div>
            )}

            <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300">
                {!capturedImage ? (
                    isCameraOpen ? (
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={videoConstraints}
                            className="w-full h-full object-cover"
                            onUserMedia={handleUserMedia}
                            onUserMediaError={handleUserMediaError}
                        />
                    ) : (
                        <div className="text-gray-400 flex flex-col items-center">
                            <Camera size={48} />
                            <p className="mt-2 text-sm">カメラを起動するか画像を選択</p>
                        </div>
                    )
                ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={capturedImage} alt="Preview" className="w-full h-full object-cover" />
                )}
            </div>

            <div className="flex gap-4 w-full">
                {!capturedImage ? (
                    <>
                        <button
                            onClick={() => {
                                if (!isCameraOpen) {
                                    setCameraError(null);
                                }
                                setIsCameraOpen(!isCameraOpen);
                            }}
                            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition"
                        >
                            <Camera size={20} />
                            {isCameraOpen ? 'カメラを閉じる' : 'カメラを起動'}
                        </button>
                        {isCameraOpen && (
                            <button
                                onClick={capture}
                                className="flex-1 bg-red-500 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-red-600 transition"
                            >
                                <div className="w-4 h-4 rounded-full bg-white animate-pulse" />
                                撮影
                            </button>
                        )}
                        <label className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-300 transition">
                            <Upload size={20} />
                            画像を選択
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </label>
                    </>
                ) : (
                    <button
                        onClick={retake}
                        className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-700 transition"
                    >
                        <RefreshCcw size={20} />
                        再撮影 / 再選択
                    </button>
                )}
            </div>
        </div>
    );
}
