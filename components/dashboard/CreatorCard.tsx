"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw, Unlink, MoreVertical } from "lucide-react";
import { ConnectButton } from "./creator-card/ConnectButton";
import { StatusBadge } from "./creator-card/StatusBadge";
import { ThresholdSlider } from "./creator-card/ThresholdSlider";

type Props = {
    creator: any;
    isAuthenticatingId: string | null;
    onConnectOF: (e: React.MouseEvent, creator: any) => void;
    onRefresh?: () => void;
};

export function CreatorCard({ creator: c, isAuthenticatingId, onConnectOF, onRefresh }: Props) {
    const displayHandle = c.ofUsername || c.name?.toLowerCase().replace(/\s+/g, "") || "unlinked";
    const headerBg = c.headerUrl ? `/api/proxy-media?url=${encodeURIComponent(c.headerUrl)}` : null;
    const isLinked = c.ofapiToken && c.ofapiToken !== "unlinked";
    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    // Missing profile data = needs sync (no avatar AND no header)
    const needsSync = isLinked && (!c.avatarUrl && !c.headerUrl);
    const yesterdayRev = c.yesterdayRev ?? 0;

    async function handleSync(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        setSyncing(true);
        setSyncError(null);
        try {
            const res = await fetch(`/api/creators/${c.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "force-sync" }),
            });
            const data = await res.json();
            if (data.success) {
                onRefresh?.();
            } else {
                setSyncError(data.error || "No match found");
            }
        } catch {
            setSyncError("Sync failed");
        } finally {
            setSyncing(false);
        }
    }

    async function handleDisconnect(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        setShowMenu(false);
        if (!confirm(`Disconnect ${c.name || "this creator"} from OnlyFansAPI?\n\nThis will remove their OFAPI session and clear profile data. You'll need to re-authenticate via the Connect OF button.`)) return;
        setDisconnecting(true);
        try {
            await fetch(`/api/creators/${c.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "disconnect" }),
            });
            onRefresh?.();
        } catch {} finally {
            setDisconnecting(false);
        }
    }

    async function handleReauth(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        setShowMenu(false);
        setSyncing(true);
        setSyncError(null);
        try {
            const res = await fetch(`/api/creators/${c.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reauthenticate" }),
            });
            const data = await res.json();
            if (data.success) {
                // After re-auth, force-sync to pull fresh profile
                await fetch(`/api/creators/${c.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "force-sync" }),
                });
                onRefresh?.();
            } else {
                setSyncError(data.error || "Re-authenticate failed");
            }
        } catch {
            setSyncError("Re-authenticate failed");
        } finally {
            setSyncing(false);
        }
    }

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
                            <ConnectButton isAuthenticating={isAuthenticatingId === c.id || disconnecting} onClick={(e) => onConnectOF(e, c)} />
                        ) : (
                            <div className="flex items-center gap-2">
                                {/* Quick sync button — visible when profile data is missing */}
                                {needsSync && (
                                    <button
                                        onClick={handleSync}
                                        disabled={syncing}
                                        title="Sync profile"
                                        className="px-2 py-1 rounded-lg bg-amber-500/10 border border-solid border-amber-500/20 flex items-center gap-1.5 text-amber-400 text-[10px] font-medium hover:bg-amber-500/20 transition-all disabled:opacity-50"
                                    >
                                        <RefreshCw size={10} className={syncing ? "animate-spin" : ""} />
                                        Sync
                                    </button>
                                )}

                                {/* Dropdown menu */}
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(!showMenu); }}
                                        className="w-7 h-7 rounded-lg bg-white/5 border border-solid border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
                                    >
                                        <MoreVertical size={13} className="text-white/40" />
                                    </button>
                                    {showMenu && (
                                        <div
                                            className="absolute right-0 top-9 w-48 rounded-xl bg-[#1a1a1a] border border-solid border-white/10 shadow-2xl z-50 overflow-hidden"
                                            onMouseLeave={() => setShowMenu(false)}
                                        >
                                            <button
                                                onClick={handleSync}
                                                disabled={syncing}
                                                className="w-full px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/5 flex items-center gap-2.5 disabled:opacity-50 transition-colors"
                                            >
                                                <RefreshCw size={13} className={`text-teal-400 ${syncing ? "animate-spin" : ""}`} />
                                                Force Sync Profile
                                            </button>
                                            <button
                                                onClick={handleReauth}
                                                disabled={syncing}
                                                className="w-full px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/5 flex items-center gap-2.5 disabled:opacity-50 transition-colors"
                                            >
                                                <RefreshCw size={13} className="text-blue-400" />
                                                Re-authenticate
                                            </button>
                                            <div className="border-t border-white/10" />
                                            <button
                                                onClick={handleDisconnect}
                                                className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition-colors"
                                            >
                                                <Unlink size={13} />
                                                Disconnect Account
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <StatusBadge isActive={c.active} />
                            </div>
                        )}
                    </div>

                    {/* Sync error message */}
                    {syncError && (
                        <div className="text-xs text-red-400/80 bg-red-500/10 rounded-lg px-3 py-1.5 mb-3 border border-solid border-red-500/20">
                            {syncError}
                        </div>
                    )}

                    {/* Revenue */}
                    <div className="flex items-end justify-between">
                        <div>
                            <div className="flex items-baseline space-x-2">
                                <span className={`text-2xl md:text-3xl font-bold tracking-tighter text-white`}>
                                    ${(c.todayRev || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-sm text-white/40">today</span>
                            </div>
                            <div className="flex items-baseline space-x-2 mt-1">
                                <span className={`text-lg font-semibold text-white/60`}>
                                    ${(c.hourlyRev || 0).toFixed(2)}
                                </span>
                                <span className="text-xs text-white/30">/ hr</span>
                                {c.txCount > 0 && <span className="text-[10px] text-teal-400/60 ml-1">{c.txCount} txns</span>}
                            </div>
                        </div>
                        <div className="text-right space-y-1">
                            {yesterdayRev > 0 && (
                                <div>
                                    <span className="text-sm font-medium text-white/45">
                                        ${yesterdayRev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[10px] text-white/30 ml-1">yesterday</span>
                                </div>
                            )}
                            {c.topFans?.length > 0 && (
                                <div>
                                    <div className="text-[9px] text-white/40 uppercase tracking-wider">Top fan</div>
                                    <div className="text-xs text-amber-400 font-semibold">@{c.topFans[0].username}</div>
                                    <div className="text-xs text-amber-400/70">${c.topFans[0].spend.toFixed(2)}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Progress + Sliders */}
                    <div className="mt-4 pt-4 border-t border-white/10" onClick={(e) => e.preventDefault()}>
                        <div className="flex justify-between text-xs text-white/60 mb-2">
                            <span>Target: ${c.target}/hr</span>
                            <span>{c.active ? "Active" : "Offline"}</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mb-4">
                            <div className={`h-full rounded-full bg-teal-500`} style={{ width: `${Math.min(((c.hourlyRev || 0) / (c.target || 100)) * 100, 100)}%` }} />
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
