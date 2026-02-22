"use client";

import { ArrowLeft, Users, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = {
    creator: any;
};

export function ProfileHeader({ creator }: Props) {
    const router = useRouter();
    const headerBg = creator.headerUrl ? `/api/proxy-media?url=${encodeURIComponent(creator.headerUrl)}` : null;
    const avatarSrc = creator.avatarUrl ? `/api/proxy-media?url=${encodeURIComponent(creator.avatarUrl)}` : null;
    const displayHandle = creator.ofUsername || creator.name?.toLowerCase().replace(/\s+/g, '') || 'unknown';

    return (
        <div className="glass-panel rounded-3xl overflow-hidden mb-8 border border-white/10">
            {/* Back button */}
            <button
                onClick={() => router.push('/')}
                className="absolute top-4 left-4 z-20 flex items-center gap-2 text-white/70 hover:text-white transition bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-xl text-sm"
            >
                <ArrowLeft size={14} /> Back
            </button>

            {/* Header Banner */}
            <div className="relative h-32 md:h-44 w-full">
                {headerBg ? (
                    <img src={headerBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-r from-teal-900/40 via-purple-900/30 to-black/30" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[rgba(0,0,0,0.8)]" />
            </div>

            {/* Profile Info — overlaps banner */}
            <div className="px-6 pb-6 -mt-12 relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div className="flex gap-4 items-end">
                        {/* Avatar */}
                        {avatarSrc ? (
                            <img src={avatarSrc} alt={creator.name} className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-black object-cover shadow-xl" />
                        ) : (
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-teal-500/20 border-4 border-black flex items-center justify-center text-3xl font-bold text-teal-400 shadow-xl">
                                {creator.name?.charAt(0) || '?'}
                            </div>
                        )}
                        <div className="mb-1">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white drop-shadow-md">{creator.name}</h1>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-teal-400 text-sm font-mono">@{displayHandle}</span>
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Live
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button className="glass-button px-4 py-2 font-medium rounded-xl text-sm flex items-center gap-2 text-white">
                            <Users size={16} /> Assign Manager
                        </button>
                        <button className="glass-button px-4 py-2 font-medium rounded-xl text-sm flex items-center gap-2 text-white">
                            <Settings size={16} /> Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
