'use client';

import React, { useState } from 'react';
import { GlassSidebar } from './components/GlassSidebar';
import { GlassCard } from './components/GlassCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock Data for the chart
const earningData = [
    { name: 'Mon', total: 400 },
    { name: 'Tue', total: 300 },
    { name: 'Wed', total: 550 },
    { name: 'Thu', total: 450 },
    { name: 'Fri', total: 700 },
    { name: 'Sat', total: 850 },
    { name: 'Sun', total: 1200 },
];

export default function AnalyticsDashboard() {
    const [activeTab, setActiveTab] = useState('overview');

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab />;
            case 'chats':
                return <ApiListTab title="Chats & Messages Endpoints" endpoints={[
                    { name: 'List Chats', desc: 'Retrieve the latest chats, including details like last message and fan details.' },
                    { name: 'List Chat Messages', desc: 'Retrieve messages from a specific chat.' },
                    { name: 'Send Message', desc: 'Send a new chat message to a fan, including support for media and PPVs.' },
                    { name: 'Send Mass Message', desc: 'Send or schedule a mass message to collections or individual fans.' },
                ]} />;
            case 'earnings':
                return <ApiListTab title="Payouts & Earnings Endpoints" endpoints={[
                    { name: 'Earning Statistics', desc: 'Get a summary of model earnings over time, including totals and breakdowns.' },
                    { name: 'List Transactions (Earnings)', desc: 'Get a list of earning transactions, including details like amount, type, and fan info.' },
                    { name: 'Request Manual Withdrawal', desc: 'Initiate a manual withdrawal, perfect for automating daily payouts.' },
                ]} />;
            case 'fans':
                return <ApiListTab title="Fans & Subscribers Endpoints" endpoints={[
                    { name: 'List All Fans', desc: 'Retrieve all fans.' },
                    { name: 'List Active Fans', desc: 'Retrieve currently active fans.' },
                    { name: 'List Expired Fans', desc: 'Retrieve expired fans.' },
                    { name: 'List Latest Fans', desc: 'Retrieve the most recent subscribers.' },
                ]} />;
            case 'vault':
                return <ApiListTab title="Media & Vault Endpoints" endpoints={[
                    { name: 'List Vault Lists', desc: 'Retrieve lists in the vault.' },
                    { name: 'List Vault Media', desc: 'Retrieve media inside a specifics vault list or general.' },
                    { name: 'Upload Media', desc: 'Upload media to OnlyFans.' },
                    { name: 'Download Media', desc: 'Download media from OnlyFans CDN.' },
                ]} />;
            default:
                return <OverviewTab />;
        }
    };

    return (
        <>
            <GlassSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-4 custom-scrollbar">
                {/* Header */}
                <header className="flex justify-between items-center pb-4 pl-2">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">
                            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                        </h2>
                        <p className="text-white/60">Live feed from OnlyFans API</p>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-sm text-white flex items-center shadow-lg">
                            <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse" />
                            API Connected
                        </div>
                    </div>
                </header>

                {/* Dynamic Content area */}
                <div className="flex-1 pb-10">
                    {renderContent()}
                </div>
            </div>
        </>
    );
}

// ----- Tab Components -----

function OverviewTab() {
    return (
        <div className="space-y-6 fade-in">
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="p-6">
                    <p className="text-sm font-medium text-white/60">Total Earnings (7d)</p>
                    <p className="text-4xl font-bold text-white mt-2">$4,450</p>
                    <div className="flex items-center mt-4 text-xs">
                        <span className="text-green-400 bg-green-400/10 px-2 py-1 rounded-full">+12.5%</span>
                        <span className="text-white/40 ml-2">vs last week</span>
                    </div>
                </GlassCard>
                <GlassCard className="p-6">
                    <p className="text-sm font-medium text-white/60">Active Fans</p>
                    <p className="text-4xl font-bold text-white mt-2">1,249</p>
                    <div className="flex items-center mt-4 text-xs">
                        <span className="text-green-400 bg-green-400/10 px-2 py-1 rounded-full">+48</span>
                        <span className="text-white/40 ml-2">new this week</span>
                    </div>
                </GlassCard>
                <GlassCard className="p-6">
                    <p className="text-sm font-medium text-white/60">Unread Chats</p>
                    <p className="text-4xl font-bold text-white mt-2">32</p>
                    <div className="flex items-center mt-4 text-xs">
                        <span className="text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full">Requires attention</span>
                    </div>
                </GlassCard>
            </div>

            {/* Chart Row */}
            <GlassCard className="p-6 h-96">
                <h3 className="text-lg font-medium text-white mb-6">Revenue Overview</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={earningData}>
                        <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.6)' }} />
                        <YAxis stroke="rgba(255,255,255,0.4)" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.6)' }} tickFormatter={(value) => `$${value}`} />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(20,20,25,0.8)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                </ResponsiveContainer>
            </GlassCard>
        </div>
    );
}

function ApiListTab({ title, endpoints }: { title: string, endpoints: { name: string, desc: string }[] }) {
    return (
        <div className="space-y-6 fade-in">
            <h3 className="text-xl font-medium text-white/80 px-2">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {endpoints.map((ep, i) => (
                    <GlassCard key={i} className="p-6" hoverable>
                        <div className="flex items-center space-x-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/5">
                                <span className="text-blue-400 font-mono text-xs">GET</span>
                            </div>
                            <h4 className="text-lg font-medium text-white">{ep.name}</h4>
                        </div>
                        <p className="text-sm text-white/60 leading-relaxed">
                            {ep.desc}
                        </p>
                        <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center text-xs text-white/40 font-mono">
                            <span>docs.onlyfansapi.com</span>
                            <span className="hover:text-blue-400 transition-colors cursor-pointer">View Docs →</span>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </div>
    );
}
