import React from 'react';
import { GlassCard } from './GlassCard';

interface StatCardProps {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    subtitle?: string;
    trend?: string;
    trendUp?: boolean;
}

export function StatCard({ title, value, icon, subtitle, trend, trendUp = true }: StatCardProps) {
    return (
        <GlassCard className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between space-x-2 text-white/60 mb-2 font-medium">
                <div className="flex items-center space-x-2">
                    {icon && <span className="opacity-80">{icon}</span>}
                    <span className="text-sm">{title}</span>
                </div>
                <div className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors text-lg leadin-none">
                    {/* Arrow icon placeholder */}
                    <span className="opacity-50">→</span>
                </div>
            </div>

            <div className="mt-2">
                <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
                {subtitle && <span className="text-sm text-white/60 ml-2">{subtitle}</span>}
            </div>

            {trend && (
                <div className="mt-2 text-xs font-semibold flex items-center">
                    <span className={trendUp ? 'text-green-400' : 'text-red-400'}>{trend}</span>
                </div>
            )}
        </GlassCard>
    );
}
