"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity, ArrowLeft, BarChart, Settings, Users, MessageSquare, AlertCircle, ShieldCheck, TrendingUp } from "lucide-react";

export default function CreatorAnalyticsHub() {
    const params = useParams();
    const router = useRouter();
    const creatorId = params.id as string;

    const [creator, setCreator] = useState<any>(null);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        activeFans: 0,
        messagesSent: 0,
        growthPercentage: "+0%",
        topPercentage: "N/A",
        startDate: "Unknown",
        recentPurchases: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Fetch Creator Profile Data
        fetch(`/api/creators/${creatorId}`)
            .then(res => res.json())
            .then(data => {
                setCreator(data.creator);
                if (data.stats) {
                    setStats(data.stats);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load creator data", err);
                setLoading(false);
            });
    }, [creatorId]);

    if (loading) return (
        <div className="flex min-h-screen items-center justify-center text-white">
            <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-teal-500 mr-3"></div>
            Loading Creator Data...
        </div>
    );

    if (!creator) return <div className="p-8 text-white">Creator not found.</div>;

    return (
        <div className="min-h-screen text-white/90 p-4 md:p-8 max-w-7xl mx-auto">

            {/* Header Navigation */}
            <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition"
            >
                <ArrowLeft size={16} /> Back to Dashboard
            </button>

            {/* Creator Profile Header */}
            <div className="glass-panel p-6 rounded-3xl border-white/20 border-l border-l-white/10 mb-8 flex border flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 text-2xl font-bold border border-teal-500/30">
                        {creator.name?.charAt(0) || '?'}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">{creator.name}</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-white/50">@{creator.ofapiCreatorId || creator.telegramId}</span>
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                API Connected
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

            {/* RAW DATA - Solves "Where is the data pulling?" complain */}
            <h2 className="text-xl font-semibold mb-4 px-2 flex items-center gap-2">
                <BarChart size={20} className="text-teal-400" /> Live API Statistics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-10">
                <div className="glass-panel p-6 rounded-3xl border-white/5 bg-black/20">
                    <div className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Total Monthly Revenue</div>
                    <div className="text-4xl font-bold text-white">${stats.totalRevenue.toLocaleString()}</div>
                    <div className={`text-xs mt-2 flex items-center ${stats.growthPercentage?.startsWith('-') ? 'text-red-400' : 'text-emerald-400'}`}>
                        <TrendingUp size={14} className="mr-1" /> {stats.growthPercentage} vs Last Month
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-3xl border-white/5 bg-black/20">
                    <div className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Top Percentage</div>
                    <div className="text-4xl font-bold text-teal-400">{stats.topPercentage}%</div>
                </div>
                <div className="glass-panel p-6 rounded-3xl border-white/5 bg-black/20">
                    <div className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Account Created</div>
                    <div className="text-3xl font-bold text-white mt-2">{stats.startDate !== "Unknown" ? new Date(stats.startDate).toLocaleDateString() : "Unknown"}</div>
                </div>
                <div className="glass-panel p-6 rounded-3xl border-white/5 bg-black/20">
                    <div className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Active Subscribers</div>
                    <div className="text-4xl font-bold text-white">{stats.activeFans.toLocaleString()}</div>
                </div>
                <div className="glass-panel p-6 rounded-3xl border-white/5 bg-black/20">
                    <div className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Vault Messages Sent</div>
                    <div className="text-4xl font-bold text-white">{stats.messagesSent.toLocaleString()}</div>
                </div>
            </div>

            {/* MODULE EXPLANATIONS - Solves "I don't know what this module is" complain */}
            <h2 className="text-xl font-semibold mb-4 px-2 flex items-center gap-2">
                <Activity size={20} className="text-blue-400" /> Active Automations & Rules
            </h2>

            <div className="space-y-4">
                {/* Module 1: Whale Watch */}
                <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-900/10 to-transparent">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <ShieldCheck size={18} className="text-teal-400" /> The "Whale Watcher" Module
                        </h3>
                        <span className="bg-teal-500/20 text-teal-400 px-2.5 py-1 rounded-lg text-xs font-bold">ACTIVE</span>
                    </div>
                    <p className="text-sm text-white/70 max-w-3xl leading-relaxed mb-4">
                        This module constantly scans {creator.name}'s transactions. If a single fan tips more than <strong className="text-white">${creator.whaleAlertTarget || 200}</strong> in a single day, this module will automatically capture their attention and send a priority notification to your Telegram Group (<code className="bg-black/40 px-1 py-0.5 rounded text-teal-300">{creator.telegramGroupId || 'Agency Default Feed'}</code>) so your chatters can close them with a high-ticket Vault item.
                    </p>
                    <div className="bg-black/30 w-full sm:w-80 rounded-xl p-4 border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Current Trigger Threshold</label>
                            <span className="text-xs text-teal-400 font-medium">${creator.whaleAlertTarget || 200}/day</span>
                        </div>
                        <input type="range" min="0" max="1000" step="50" defaultValue={creator.whaleAlertTarget || 200} className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-teal-500" disabled />
                    </div>
                </div>

                {/* Module 2: Chatter Shift Tracker */}
                <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-900/10 to-transparent">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <MessageSquare size={18} className="text-purple-400" /> The "Chatter Target" Module
                        </h3>
                        <span className="bg-purple-500/20 text-purple-400 px-2.5 py-1 rounded-lg text-xs font-bold">ACTIVE</span>
                    </div>
                    <p className="text-sm text-white/70 max-w-3xl leading-relaxed mb-4">
                        This module monitors the live financial pacing of whoever is running {creator.name}'s account right now. It checks total net revenue every hour. If the chatter fails to make at least <strong className="text-white">${creator.hourlyTarget || 100} in the last hour</strong>, it sends an urgent warning alarm to the shift managers so they can course-correct before the shift tanks.
                    </p>
                    <div className="bg-black/30 w-full sm:w-80 rounded-xl p-4 border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Hourly Minimum Target</label>
                            <span className="text-xs text-purple-400 font-medium">${creator.hourlyTarget || 100}/hr</span>
                        </div>
                        <input type="range" min="10" max="500" step="10" defaultValue={creator.hourlyTarget || 100} className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500" disabled />
                    </div>
                </div>

            </div>

        </div>
    );
}
