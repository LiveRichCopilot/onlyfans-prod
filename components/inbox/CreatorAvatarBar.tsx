"use client";

type Props = {
    creators: any[];
    selectedCreatorId: string;
    onSelect: (id: string) => void;
};

export function CreatorAvatarBar({ creators, selectedCreatorId, onSelect }: Props) {
    const selectedCreator = creators.find(c => c.id === selectedCreatorId);

    return (
        <div className="flex flex-col items-center py-4 px-2 gap-3 border-r border-white/10 bg-black/20">
            {/* "Chatting for" label + active creator */}
            <div className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Chatting for</div>
            {selectedCreator && (
                <div className="relative mb-2">
                    {selectedCreator.avatarUrl ? (
                        <img src={`/api/proxy-media?url=${encodeURIComponent(selectedCreator.avatarUrl)}`} alt={selectedCreator.name || ""} className="w-12 h-12 rounded-full border-2 border-purple-500 object-cover shadow-lg shadow-purple-500/20" />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-500/20 border-2 border-purple-500 flex items-center justify-center text-sm font-bold text-purple-300">
                            {selectedCreator.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                    )}
                    <button className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                    </button>
                </div>
            )}

            {/* "All" button */}
            <button
                onClick={() => {/* could reset to all-creators view */}}
                className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-purple-500/30 hover:bg-purple-400 transition-colors"
            >
                All
            </button>

            {/* Creator circles */}
            <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar max-h-[calc(100vh-240px)]">
                {creators.filter(c => c.ofapiToken && c.ofapiToken !== "unlinked").map(c => (
                    <button
                        key={c.id}
                        onClick={() => onSelect(c.id)}
                        className={`relative w-12 h-12 rounded-full flex-shrink-0 overflow-hidden border-2 transition-all
                            ${c.id === selectedCreatorId
                                ? "border-purple-500 shadow-lg shadow-purple-500/20 scale-105"
                                : "border-white/10 hover:border-white/30 opacity-70 hover:opacity-100"}`}
                    >
                        {c.avatarUrl ? (
                            <img src={`/api/proxy-media?url=${encodeURIComponent(c.avatarUrl)}`} alt={c.name || ""} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">
                                {c.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                        )}
                        {/* Notification badge — placeholder for unread count */}
                        {c.active && (
                            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
