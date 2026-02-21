import React from 'react';
import { GlassCard } from './GlassCard';

export interface RiskEvent {
    id: string;
    type: 'Low' | 'Medium' | 'High';
    alertName: string;
    account: { name: string, image: string };
    time: string;
}

interface RiskTableProps {
    events: RiskEvent[];
}

export function RiskTable({ events }: RiskTableProps) {

    const getBadgeColor = (type: string) => {
        switch (type) {
            case 'High': return 'bg-red-500/20 text-red-400 border-red-500/50';
            case 'Medium': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
            case 'Low': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
            default: return 'bg-white/10 text-white/80';
        }
    };

    return (
        <GlassCard className="p-0 overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-white">Important Events</h3>
                    <div className="flex space-x-6 mt-4">
                        <span className="text-sm font-medium text-white/50 hover:text-white cursor-pointer transition-colors relative after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-transparent">All</span>
                        <span className="text-sm font-medium text-white cursor-pointer transition-colors relative after:absolute after:-bottom-4 after:left-0 after:w-full after:h-0.5 after:bg-purple-500">Risks ({events.length})</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-white/40">
                            <th className="px-6 py-4 font-medium flex items-center cursor-pointer hover:text-white/60">Type <span className="ml-2 text-[10px] text-purple-400">▼</span></th>
                            <th className="px-6 py-4 font-medium">Alert</th>
                            <th className="px-6 py-4 font-medium flex items-center cursor-pointer hover:text-white/60">Account <span className="ml-2 text-[10px]">▼</span></th>
                            <th className="px-6 py-4 font-medium flex items-center cursor-pointer hover:text-white/60">Time <span className="ml-2 text-[10px]">▼</span></th>
                            <th className="px-6 py-4 font-medium text-right"><button className="px-3 py-1 rounded-full border border-white/10 hover:bg-white/10 transition-colors text-white">Dismiss All</button></th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-white/80">
                        {events.map((evt) => (
                            <tr key={evt.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded border text-xs font-semibold flex items-center w-max ${getBadgeColor(evt.type)}`}>
                                        <span className="mr-1">⚠</span> {evt.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-medium max-w-sm truncate">{evt.alertName}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-6 h-6 rounded bg-gradient-to-tr from-purple-500 to-pink-500 shadow-md">
                                            {/* Real app would use img tag */}
                                        </div>
                                        <span>{evt.account.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-white/50">{evt.time}</td>
                                <td className="px-6 py-4 text-right">
                                    <button className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-white">Dismiss</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </GlassCard>
    );
}
