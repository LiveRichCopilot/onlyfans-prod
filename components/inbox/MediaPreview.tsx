"use client";

import { useState } from "react";
import { Lock, Play, RefreshCw } from "lucide-react";

type MediaItem = {
    id: string;
    type: string;
    canView: boolean;
    preview: string;
    src: string;
};

type Props = {
    media: MediaItem;
    isSfw: boolean;
    onDisableSfw: () => void;
};

export function MediaPreview({ media: med, isSfw, onDisableSfw }: Props) {
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    const mediaUrl = med.canView ? med.src : med.preview;
    const proxyUrl = mediaUrl ? `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}` : "";
    const posterUrl = med.preview ? `/api/proxy-media?url=${encodeURIComponent(med.preview)}` : undefined;
    const isBlurred = !med.canView || isSfw;

    const handleRetry = () => {
        setImgError(false);
        setImgLoaded(false);
        setRetryKey((k) => k + 1);
    };

    return (
        <div className="relative overflow-hidden bg-black/40 flex items-center justify-center min-h-[120px] max-h-[300px]">
            {med.type === "video" ? (
                <>
                    {med.preview && (
                        <img
                            src={posterUrl}
                            alt=""
                            className={`w-full h-full object-cover ${isBlurred ? "blur-xl scale-110" : ""}`}
                        />
                    )}
                    {!isBlurred && (
                        <video
                            key={retryKey}
                            src={proxyUrl}
                            poster={posterUrl}
                            controls
                            playsInline
                            preload="metadata"
                            controlsList="nodownload"
                            className="w-full h-full max-h-[300px] object-cover"
                        />
                    )}
                    {isBlurred && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/10">
                                <Play size={20} className="text-white/80 ml-0.5" />
                            </div>
                        </div>
                    )}
                </>
            ) : med.type === "audio" ? (
                <div className="w-full p-3">
                    <audio
                        src={proxyUrl}
                        controls
                        className={`w-full ${!med.canView ? "blur-md" : ""}`}
                    />
                </div>
            ) : (
                <>
                    {/* Loading skeleton */}
                    {!imgLoaded && !imgError && (
                        <div className="absolute inset-0 bg-white/[0.03] animate-pulse" />
                    )}

                    {/* Error state with retry */}
                    {imgError ? (
                        <div
                            className="flex flex-col items-center justify-center h-[80px] gap-2 cursor-pointer"
                            onClick={handleRetry}
                        >
                            <RefreshCw size={16} className="text-white/30" />
                            <span className="text-[11px] text-white/30">Tap to retry</span>
                        </div>
                    ) : (
                        <img
                            key={retryKey}
                            src={proxyUrl}
                            alt="Media"
                            referrerPolicy="no-referrer"
                            className={`w-full h-full max-h-[300px] object-cover transition-opacity ${
                                imgLoaded ? "opacity-100" : "opacity-0"
                            } ${isBlurred ? "blur-xl scale-110 cursor-pointer" : ""}`}
                            onLoad={() => setImgLoaded(true)}
                            onClick={() => {
                                if (isSfw && med.canView) onDisableSfw();
                            }}
                            onError={() => setImgError(true)}
                        />
                    )}
                </>
            )}

            {/* Locked PPV overlay */}
            {!med.canView && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20 pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-md text-white text-[11px] px-3 py-1.5 rounded-full font-medium border border-white/10 flex items-center gap-1.5">
                        <Lock size={11} /> PPV Locked
                    </div>
                </div>
            )}

            {/* SFW overlay — tap to reveal */}
            {med.canView && isSfw && (
                <div
                    className="absolute inset-0 flex items-center justify-center bg-black/20 z-20 cursor-pointer"
                    onClick={onDisableSfw}
                >
                    <span className="text-[11px] text-white/50 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                        Tap to reveal
                    </span>
                </div>
            )}
        </div>
    );
}
