'use client';

import React, { useState } from 'react';
import { GlassSidebar } from './components/GlassSidebar';
import { GlassCard } from './components/GlassCard';
import { StatCard } from './components/StatCard';
import { Badge } from './components/Badge';
import { RiskTable, RiskEvent } from './components/RiskTable';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Clock, DollarSign, MessageCircle, Users } from 'lucide-react';

// Mock Multi-Model Chart Data
const earningData = [
    { name: 'Feb 13', 'Rebecca': 24000, 'Dolly': 18000 },
    { name: 'Feb 14', 'Rebecca': 22444, 'Dolly': 21000 },
    { name: 'Feb 15', 'Rebecca': 23000, 'Dolly': 19500 },
    { name: 'Feb 16', 'Rebecca': 28000, 'Dolly': 25000 },
    { name: 'Feb 17', 'Rebecca': 24000, 'Dolly': 22000 },
    { name: 'Feb 18', 'Rebecca': 29500, 'Dolly': 17000 },
    { name: 'Feb 19', 'Rebecca': 179554, 'Dolly': 82000 },
];

const mockRisks: RiskEvent[] = [
    { id: '1', type: 'Medium', alertName: 'No messages sent on Dolly in the past 24 hours', account: { name: 'Dolly', image: '' }, time: '16 hours ago' },
    { id: '2', type: 'Medium', alertName: 'No messages sent on StephMi in the past 24 hours', account: { name: 'StephMi', image: '' }, time: '16 hours ago' },
    { id: '3', type: 'High', alertName: 'API Connection lost for Rebecca', account: { name: 'Rebecca', image: '' }, time: '2 hours ago' },
];

export default function AnalyticsDashboard() {
    const [activeTab, setActiveTab] = useState('home');

    return (
        <>
            <GlassSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

            <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-4 custom-scrollbar">
                {/* Top Header Section */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-md flex items-center">
                            <span className="mr-3 text-2xl">👋</span> Hey, Jay Richardson
                        </h2>
                        <p className="text-white/60 mt-1">Check LiveRich Travel's achievements</p>
                    </div>

                    <div className="flex items-center space-x-4">
                        <Badge label="Agency" value="$1M" subValue="Monthly Sales" colorType="gold" />
                        <Badge label="Creator" value="$250K" subValue="Monthly Sales" colorType="purple" />
                        <Badge label="Creator" value="50K" subValue="Total Fans" colorType="blue" />
                    </div>
                </header>

                {/* Live Metrics */}
                <section>
                    <div className="flex items-center space-x-2 mb-4">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_#4ade80]" />
                        <h3 className="text-sm font-semibold text-white/90 tracking-wide uppercase">Live Metrics (Last Hour)</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard title="Active Chatters" value="1 / 17" icon={<Users size={16} />} />
                        <StatCard title="Snoozing Chatters" value="0" icon={<Clock size={16} />} />
                        <StatCard title="Sales" value="$158" icon={<DollarSign size={16} />} />
                        <StatCard title="Messages Sent" value="430" subtitle="(17% by AI)" icon={<MessageCircle size={16} />} />
                    </div>
                </section>

                {/* Main Overview Chart */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <GlassCard className="lg:col-span-2 p-6 flex flex-col min-h-[400px]">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center space-x-4">
                                <h3 className="text-xl font-bold text-white">Overview</h3>
                                <select className="bg-white/5 border border-white/10 rounded-md text-white text-sm px-3 py-1 outline-none">
                                    <option>Last 7 days</option>
                                    <option>Last 30 days</option>
                                </select>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-semibold text-fuchsia-400">↘ 34%</div>
                                <div className="text-3xl font-bold text-fuchsia-400">$179,554</div>
                                <div className="text-xs text-white/50">Revenue</div>
                            </div>
                        </div>

                        <div className="flex-1 w-full min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={earningData}>
                                    <defs>
                                        <linearGradient id="colorRebecca" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#c026d3" stopOpacity={0.5} />
                                            <stop offset="95%" stopColor="#c026d3" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorDolly" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} dy={10} />
                                    <YAxis stroke="rgba(255,255,255,0.4)" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} tickFormatter={(value) => `$${value / 1000}k`} dx={-10} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(20,20,25,0.9)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)' }}
                                        itemStyle={{ color: '#fff', fontWeight: 600 }}
                                    />
                                    <Legend verticalAlign="top" height={36} iconType="circle" />
                                    <Area type="monotone" dataKey="Rebecca" stroke="#c026d3" strokeWidth={3} fillOpacity={1} fill="url(#colorRebecca)" activeDot={{ r: 6 }} />
                                    <Area type="monotone" dataKey="Dolly" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorDolly)" activeDot={{ r: 6 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </GlassCard>

                    {/* Quick Stats Sidebar inside Overview */}
                    <div className="flex flex-col space-y-4">
                        <GlassCard className="p-5 flex-1 cursor-pointer hover:bg-white/10 transition">
                            <h4 className="text-white/80 font-medium mb-1">Sales made with AI & Automations</h4>
                            <p className="text-2xl font-bold text-white">$45,210</p>
                        </GlassCard>
                        <GlassCard className="p-5 flex-1 cursor-pointer hover:bg-white/10 transition">
                            <h4 className="text-white/80 font-medium mb-1">Messages sent by automations & AI</h4>
                            <p className="text-2xl font-bold text-white">122,576</p>
                        </GlassCard>
                        <GlassCard className="p-5 flex-1 cursor-pointer hover:bg-white/10 transition">
                            <h4 className="text-white/80 font-medium mb-1">Undercharges Prevented</h4>
                            <p className="text-2xl font-bold text-white">$4,120</p>
                        </GlassCard>
                        <GlassCard className="p-5 flex-1 cursor-pointer hover:bg-white/10 transition">
                            <h4 className="text-white/80 font-medium mb-1">Chatter's messages tracked</h4>
                            <p className="text-2xl font-bold text-white">450k+</p>
                        </GlassCard>
                    </div>
                </section>

                {/* Engagement & Messages Split */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <GlassCard className="p-6">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <p className="text-white/60 font-medium mb-1">Fans Engaged</p>
                                <p className="text-3xl font-bold text-white">930,690 <span className="text-green-400 text-sm font-semibold ml-2">↗ 13%</span></p>
                            </div>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-4 mb-2 overflow-hidden flex">
                            <div className="bg-amber-400 h-full rounded-full" style={{ width: '85%' }}></div>
                            <div className="bg-white/20 h-full" style={{ width: '15%' }}></div>
                        </div>
                        <div className="flex justify-between text-xs text-white/50">
                            <span>With Automation (20,685)</span>
                            <span>Manually</span>
                        </div>
                    </GlassCard>

                    <GlassCard className="p-6">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <p className="text-white/60 font-medium mb-1">Messages Sent</p>
                                <p className="text-3xl font-bold text-white">122,576 <span className="text-red-400 text-sm font-semibold ml-2">↘ 91%</span></p>
                            </div>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-4 mb-2 overflow-hidden flex">
                            <div className="bg-purple-500 h-full rounded-full w-full"></div>
                        </div>
                        <div className="flex justify-between text-xs text-white/50">
                            <span>With Automation & AI (122,576)</span>
                            <span>Manually (0)</span>
                        </div>
                    </GlassCard>
                </section>

                {/* Important Events / Risks Table */}
                <section>
                    <RiskTable events={mockRisks} />
                </section>

            </div>
        </>
    );
}
