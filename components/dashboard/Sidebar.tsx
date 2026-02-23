"use client";

import { LayoutGrid, MessageSquare, Activity, Users, Database, Zap } from "lucide-react";
import Link from "next/link";

type Creator = {
    id: string;
    name?: string;
    ofUsername?: string;
    avatarUrl?: string;
    headerUrl?: string;
    active?: boolean;
};

type Props = {
    creators: Creator[];
    loading: boolean;
    onAddAccount: () => void;
};

export function Sidebar({ creators, loading, onAddAccount }: Props) {
    return (
        <aside className="w-72 glass-panel m-4 rounded-3xl p-6 hidden md:flex flex-col z-10 border-gray-800">
            <div className="flex items-center gap-3 mb-10">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-600 to-gray-700 flex items-center justify-center font-bold text-lg shadow-lg shadow-teal-900/50">
                    OF
                </div>
                <div>
                    <div className="text-xl font-bold tracking-tight text-white/90">HQ</div>
                    <div className="text-xs text-white/50">Agency Workspace</div>
                </div>
            </div>

            <nav className="space-y-8 flex-1">
                <div>
                    <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 px-2">Creators</div>
                    <ul className="space-y-2">
                        {creators.map((c) => (
                            <li key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/10 transition cursor-pointer group">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        {c.avatarUrl ? (
                                            <img src={`/api/proxy-media?url=${encodeURIComponent(c.avatarUrl)}`} alt={c.name || ""} className="w-8 h-8 rounded-full border border-white/20 object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs border border-white/20">
                                                {c.name ? c.name.charAt(0).toUpperCase() : "?"}
                                            </div>
                                        )}
                                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-black ${c.active ? "bg-teal-500" : "bg-gray-500"}`} />
                                    </div>
                                    <span className="text-sm font-medium text-white/80 group-hover:text-white truncate max-w-[120px]">{c.name || "Unknown Profile"}</span>
                                </div>
                            </li>
                        ))}
                        {creators.length === 0 && !loading && (
                            <li className="px-3 py-2 text-xs text-white/40 italic">No accounts linked</li>
                        )}
                        <li className="mt-2 text-center">
                            <button onClick={onAddAccount} className="text-xs text-teal-400 font-medium hover:text-teal-300 transition">
                                + Add Account
                            </button>
                        </li>
                    </ul>
                </div>

                <div>
                    <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 px-2">Management</div>
                    <ul className="space-y-1">
                        <li className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/10 text-white shadow-sm border border-white/10"><LayoutGrid size={16} /> Dashboard</li>
                        <Link href="/inbox">
                            <li className="flex items-center gap-3 px-3 py-2.5 text-white/60 hover:text-white transition rounded-xl hover:bg-white/5 cursor-pointer">
                                <MessageSquare size={16} /> Live Inbox
                                <span className="bg-purple-500/20 text-purple-400 text-[10px] px-1.5 py-0.5 rounded ml-auto border border-purple-500/30 font-bold tracking-wider">NEW</span>
                            </li>
                        </Link>
                        <li className="flex items-center gap-3 px-3 py-2.5 text-white/60 hover:text-white transition rounded-xl hover:bg-white/5"><Activity size={16} /> Real-time Feed</li>
                        <li className="flex items-center gap-3 px-3 py-2.5 text-white/60 hover:text-white transition rounded-xl hover:bg-white/5"><Users size={16} /> Team & Chatters</li>
                        <Link href="/performance">
                            <li className="flex items-center gap-3 px-3 py-2.5 text-white/60 hover:text-white transition rounded-xl hover:bg-white/5 cursor-pointer">
                                <Zap size={16} /> Performance
                            </li>
                        </Link>
                        <Link href="/system">
                            <li className="flex items-center gap-3 px-3 py-2.5 text-white/60 hover:text-white transition rounded-xl hover:bg-white/5 cursor-pointer">
                                <Database size={16} /> System Intelligence
                            </li>
                        </Link>
                    </ul>
                </div>
            </nav>
        </aside>
    );
}
