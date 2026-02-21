import React from 'react';
import { GlassCard } from './GlassCard';
import { LineChart, MessageSquare, Users, Database } from 'lucide-react';

interface GlassSidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export function GlassSidebar({ activeTab, setActiveTab }: GlassSidebarProps) {
    const navItems = [
        { id: 'home', label: 'Home', icon: LineChart },
        { id: 'creator-analytics', label: 'Creator Analytics', icon: Users },
        { id: 'team-analytics', label: 'Team Analytics', icon: Users },
        { id: 'inbox', label: 'Inbox', icon: MessageSquare },
        { id: 'automations', label: 'Automations', icon: Database },
    ];

    return (
        <GlassCard className="w-64 h-full flex flex-col p-4 border-r border-white/10">
            <div className="mb-8 p-2">
                <h1 className="text-xl font-semibold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">OnlyFans API</h1>
                <p className="text-xs text-white/50 mt-1">Analytics Board</p>
            </div>

            <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-300 ${isActive
                                ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                                : 'text-white/60 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <Icon size={18} className={isActive ? 'text-blue-400' : 'text-current'} />
                            <span className="font-medium text-sm">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="mt-8 pt-4 border-t border-white/10">
                <div className="flex items-center space-x-3 px-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 animate-pulse"></div>
                    <div>
                        <p className="text-sm font-medium text-white">System Online</p>
                        <p className="text-xs text-white/50">All APIs connected</p>
                    </div>
                </div>
            </div>
        </GlassCard>
    );
}
