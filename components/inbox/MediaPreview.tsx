"use client";

import { Lock, Play } from "lucide-react";

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
    const mediaUrl = med.canView ? med.src : med.preview;
    const proxyUrl = mediaUrl ? `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}` : "";
    const isBlurred = !med.canView || isSfw;

    return (
        <div className="relative overflow-hidden bg-black/40 flex items-center justify-center min-h-[120px] max-h-[300px]">
            {med.type === "video" ? (
                <>
                    {med.preview && (
                        <img
                            src={`/api/proxy-media?url=${encodeURIComponent(med.preview)}`}
                            alt=""
                            className={`w-full h-full object-cover ${isBlurred ? "blur-xl scale-110" : ""}`}
                        />
                    )}
                    {!isBlurred && (
                        <video
                            src={proxyUrl}
                            poster={med.preview ? `/api/proxy-media?url=${encodeURIComponent(med.preview)}` : undefined}
                            controls
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
                <img
                    src={proxyUrl}
                    alt="Media"
                    referrerPolicy="no-referrer"
                    className={`w-full h-full max-h-[300px] object-cover ${isBlurred ? "blur-xl scale-110 cursor-pointer" : ""}`}
                    onClick={() => {
                        if (isSfw && med.canView) onDisableSfw();
                    }}
                    onError={(e) => {
                        const el = e.currentTarget;
                        el.style.display = "none";
                        const parent = el.parentElement;
                        if (parent) {
                            const fallback = document.createElement("div");
                            fallback.className = "flex items-center justify-center h-[80px] text-[11px] text-white/30";
                            fallback.textContent = "Media expired";
                            parent.appendChild(fallback);
                        }
                    }}
                />
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
