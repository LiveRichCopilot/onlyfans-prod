"use client";

type Thumbnail = {
    id: string;
    type: string;
    thumb: string;
    preview: string;
};

type PpvItem = {
    messageId: string;
    createdAt: string;
    price: number;
    purchased: boolean;
    isMass: boolean;
    mediaCount: number;
    thumbnails: Thumbnail[];
    totalThumbs: number;
    text: string;
    mediaIds: number[];
};

type Props = {
    ppv: PpvItem;
    creatorId?: string;
    onCopyDraft?: (ppv: PpvItem) => void;
};

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function PpvCard({ ppv, creatorId, onCopyDraft }: Props) {
    const lockColor = ppv.purchased ? "#22c55e" : "#ef4444";
    const lockBg = ppv.purchased ? "bg-green-500/15" : "bg-red-500/15";

    return (
        <div className="flex items-center gap-3 py-3">
            {/* Type icon: message bubble (direct) or megaphone (mass) */}
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center">
                {ppv.isMass ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
                        <path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                    </svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
                        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                    </svg>
                )}
            </div>

            {/* Price badge with lock */}
            <div className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg ${lockBg} border`} style={{ borderColor: lockColor + "30" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill={lockColor} className="flex-shrink-0">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke={lockColor} strokeWidth="2" />
                </svg>
                <span className="text-xs font-bold" style={{ color: lockColor }}>
                    ${ppv.price.toFixed(2)}
                </span>
            </div>

            {/* Media thumbnails */}
            <div className="flex items-center gap-1 flex-1 min-w-0">
                {ppv.thumbnails.map((thumb, i) => (
                    <div
                        key={thumb.id || i}
                        className="w-12 h-12 rounded-lg overflow-hidden bg-white/[0.06] flex-shrink-0 relative"
                    >
                        {thumb.thumb || thumb.preview ? (
                            <img
                                src={`/api/proxy-media?url=${encodeURIComponent(thumb.thumb || thumb.preview)}${creatorId ? `&creatorId=${creatorId}` : ""}`}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20 text-[10px]">
                                {thumb.type === "video" ? "VID" : "IMG"}
                            </div>
                        )}
                        {/* Video play indicator */}
                        {thumb.type === "video" && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
                                    <div className="w-0 h-0 border-l-[6px] border-l-white border-y-[4px] border-y-transparent ml-0.5" />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {/* "+N" badge for additional media */}
                {ppv.totalThumbs > 3 && (
                    <div className="w-12 h-12 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-white/50">+{ppv.totalThumbs - 3}</span>
                    </div>
                )}
                {ppv.thumbnails.length === 0 && ppv.mediaCount > 0 && (
                    <div className="w-12 h-12 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] text-white/30">{ppv.mediaCount} files</span>
                    </div>
                )}
            </div>

            {/* Time */}
            <span className="text-[11px] text-white/30 flex-shrink-0">{formatTime(ppv.createdAt)}</span>
        </div>
    );
}
