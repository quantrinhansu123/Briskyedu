import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, RotateCcw, Check, Loader2 } from 'lucide-react';

interface CameraCaptureProps {
    isOpen: boolean;
    onCapture: (photoDataUrl: string) => void;
    onClose: () => void;
    title?: string;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
    isOpen,
    onCapture,
    onClose,
    title = 'Chụp ảnh chấm công'
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [isCameraReady, setIsCameraReady] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

    // Start camera
    const startCamera = useCallback(async () => {
        try {
            setError(null);
            setIsCameraReady(false);

            // Stop any existing stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    setIsCameraReady(true);
                };
            }
        } catch (err: any) {
            console.error('Camera error:', err);
            if (err.name === 'NotAllowedError') {
                setError('Bạn cần cấp quyền truy cập camera để chụp ảnh chấm công.');
            } else if (err.name === 'NotFoundError') {
                setError('Không tìm thấy camera. Vui lòng kiểm tra thiết bị.');
            } else {
                setError('Không thể mở camera: ' + err.message);
            }
        }
    }, [facingMode]);

    // Stop camera
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraReady(false);
    }, []);

    // Start camera when modal opens
    useEffect(() => {
        if (isOpen) {
            startCamera();
        } else {
            stopCamera();
            setCapturedImage(null);
        }

        return () => {
            stopCamera();
        };
    }, [isOpen, startCamera, stopCamera]);

    // Switch camera (front/back)
    const switchCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    // Capture photo
    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0);

        // Get data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(dataUrl);

        // Stop camera to save resources
        stopCamera();
    };

    // Retake photo
    const retakePhoto = () => {
        setCapturedImage(null);
        startCamera();
    };

    // Confirm and submit
    const confirmPhoto = () => {
        if (capturedImage) {
            onCapture(capturedImage);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Camera size={20} />
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Camera View */}
                <div className="relative bg-black aspect-video">
                    {error ? (
                        <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
                            <div className="text-white">
                                <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p className="text-red-300">{error}</p>
                                <button
                                    onClick={startCamera}
                                    className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                                >
                                    Thử lại
                                </button>
                            </div>
                        </div>
                    ) : capturedImage ? (
                        <img
                            src={capturedImage}
                            alt="Captured"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                            {!isCameraReady && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                                </div>
                            )}
                        </>
                    )}

                    {/* Hidden canvas for capture */}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* Controls */}
                <div className="p-4 bg-gray-50">
                    {capturedImage ? (
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={retakePhoto}
                                className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                            >
                                <RotateCcw size={20} />
                                Chụp lại
                            </button>
                            <button
                                onClick={confirmPhoto}
                                className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
                            >
                                <Check size={20} />
                                Xác nhận
                            </button>
                        </div>
                    ) : (
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={switchCamera}
                                disabled={!isCameraReady}
                                className="p-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors disabled:opacity-50"
                                title="Đổi camera"
                            >
                                <RotateCcw size={20} />
                            </button>
                            <button
                                onClick={capturePhoto}
                                disabled={!isCameraReady}
                                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                <Camera size={24} />
                                Chụp ảnh
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
