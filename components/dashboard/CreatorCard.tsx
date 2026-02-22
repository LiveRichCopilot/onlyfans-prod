"use client";

import Link from "next/link";
import { ConnectButton } from "./creator-card/ConnectButton";
import { StatusBadge } from "./creator-card/StatusBadge";
import { ThresholdSlider } from "./creator-card/ThresholdSlider";

type Props = {
    creator: any;
    isAuthenticatingId: string | null;
    onConnectOF: (e: React.MouseEvent, creator: any) => void;
};

export function CreatorCard({ creator: c, isAuthenticatingId, onConnectOF }: Props) {
    const isUnderperforming = c.active && c.hourlyRev < c.target;
    const displayHandle = c.ofUsername || c.name?.toLowerCase().replace(/\s+/g, "") || "unlinked";
    const headerBg = c.headerUrl ? `/api/proxy-media?url=${encodeURIComponent(c.headerUrl)}` : null;
    const isLinked = c.ofapiToken && c.ofapiToken !== "unlinked";

    return (
        <Link href={`/creators/${c.id}`} className="block cursor-pointer">
            <div className="glass-panel rounded-3xl border-t border-t-white/20 border-l border-l-white/10 relative overflow-hidden group hover:bg-white/5 transition-all">
                {/* Header Banner */}
                {headerBg ? (
                    <div className="relative h-20 md:h-28 w-full">
                        <img src={headerBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-[rgba(255,255,255,0.05)]" />
                    </div>
                ) : (
                    <div className="h-16 w-full bg-gradient-to-r from-teal-900/30 via-purple-900/20 to-black/20" />
                )}

                <div className="p-5 -mt-8 relative z-10">
                    {/* Avatar + Name + Status */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                            {c.avatarUrl ? (
                                <img src={`/api/proxy-media?url=${encodeURIComponent(c.avatarUrl)}`} alt={c.name} className="w-14 h-14 rounded-full border-[3px] border-black/80 object-cover shadow-lg" />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold border-[3px] border-black/80 shadow-lg backdrop-blur-sm">
                                    {c.name ? c.name.charAt(0).toUpperCase() : "?"}
                                </div>
                            )}
                            <div>
                                <div className="text-white font-semibold text-lg leading-tight group-hover:text-teal-400 transition-colors drop-shadow-md truncate max-w-[180px]">{c.name || "Unknown Profile"}</div>
                                <div className="text-xs text-teal-400 font-mono mt-0.5 drop-shadow-sm truncate max-w-[180px]">@{displayHandle}</div>
                            </div>
                        </div>

                        {!isLinked ? (
                            <ConnectButton isAuthenticating={isAuthenticatingId === c.id} onClick={(e) => onConnectOF(e, c)} />
                        ) : (
                            <StatusBadge isActive={c.active} isUnderperforming={isUnderperforming} />
                        )}
                    </div>

                    {/* Revenue */}
                    <div className="flex items-end justify-between">
                        <div>
                            <div className="flex items-baseline space-x-2">
                                <span className={`text-2xl md:text-3xl font-bold tracking-tighter ${isUnderperforming ? "text-red-400" : "text-white"}`}>
                                    ${(c.todayRev || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-sm text-white/40">today</span>
                            </div>
                            <div className="flex items-baseline space-x-2 mt-1">
                                <span className={`text-lg font-semibold ${isUnderperforming ? "text-red-400/70" : "text-white/60"}`}>
                                    ${(c.hourlyRev || 0).toFixed(2)}
                                </span>
                                <span className="text-xs text-white/30">/ hr</span>
                                {c.txCount > 0 && <span className="text-[10px] text-teal-400/60 ml-1">{c.txCount} txns</span>}
                            </div>
                        </div>
                        {c.topFans?.length > 0 && (
                            <div className="text-right">
                                <div className="text-[9px] text-white/40 uppercase tracking-wider">Top fan</div>
                                <div className="text-xs text-amber-400 font-semibold">@{c.topFans[0].username}</div>
                                <div className="text-xs text-amber-400/70">${c.topFans[0].spend.toFixed(2)}</div>
                            </div>
                        )}
                    </div>

                    {/* Progress + Sliders */}
                    <div className="mt-4 pt-4 border-t border-white/10" onClick={(e) => e.preventDefault()}>
                        <div className="flex justify-between text-xs text-white/60 mb-2">
                            <span>Target: ${c.target}/hr</span>
                            <span>{c.active ? "Active" : "Offline"}</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mb-4">
                            <div className={`h-full rounded-full ${isUnderperforming ? "bg-red-500" : "bg-teal-500"}`} style={{ width: `${Math.min(((c.hourlyRev || 0) / (c.target || 100)) * 100, 100)}%` }} />
                        </div>
                        <div className="space-y-3 pt-2 border-t border-white/10">
                            <ThresholdSlider label="Hourly Revenue Target" value={c.hourlyTarget || 100} min={10} max={500} step={10} unit="/hr" />
                            <ThresholdSlider label="Daily Whale Alert Threshold" value={c.whaleAlertTarget || 200} min={0} max={1000} step={50} unit="/day" color="teal-600" />
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
