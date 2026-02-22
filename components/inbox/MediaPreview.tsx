"use client";

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
    const proxyUrl = mediaUrl ? `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}` : '';

    return (
        <div className="relative rounded-xl overflow-hidden bg-black/40 flex items-center justify-center min-h-[150px] border border-white/5">
            {med.type === 'video' ? (
                <video src={proxyUrl} poster={med.preview ? `/api/proxy-media?url=${encodeURIComponent(med.preview)}` : undefined} controls controlsList="nodownload" className={`w-full h-full max-h-[320px] object-cover ${(!med.canView || isSfw) ? 'blur-xl scale-110' : ''}`} />
            ) : med.type === 'audio' ? (
                <audio src={proxyUrl} controls className={`w-full max-w-[220px] m-4 ${!med.canView ? 'blur-md' : ''}`} />
            ) : (
                <img
                    src={proxyUrl}
                    alt="Media Attachment"
                    referrerPolicy="no-referrer"
                    className={`w-full h-full max-h-[320px] object-cover ${(!med.canView || isSfw) ? 'blur-xl scale-110 cursor-pointer' : ''}`}
                    onClick={() => { if (isSfw) onDisableSfw(); }}
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML += '<div class="absolute inset-0 flex flex-col items-center justify-center text-[10px] text-white/50 bg-[#16161a]"><span>Expired Media</span><span class="text-[8px] opacity-50 mt-1">API URL revoked</span></div>';
                    }}
                />
            )}
            {!med.canView && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-md shadow-xl text-white text-[11px] px-3 py-1.5 rounded-full font-medium border border-white/10 flex items-center gap-1.5">
                        <span>🔒</span> Locked PPV
                    </div>
                </div>
            )}
        </div>
    );
}
