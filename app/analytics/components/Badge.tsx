import React from 'react';

interface BadgeProps {
    label: string;
    value: string;
    subValue: string;
    colorType?: 'gold' | 'purple' | 'blue';
}

export function Badge({ label, value, subValue, colorType = 'gold' }: BadgeProps) {

    const gradients = {
        gold: 'from-amber-300 via-yellow-500 to-amber-700',
        purple: 'from-fuchsia-400 via-purple-600 to-indigo-700',
        blue: 'from-cyan-300 via-blue-500 to-blue-800'
    }

    const bgClasses = gradients[colorType];

    return (
        <div className="relative group shrink-0">
            {/* Outer Hexagon Shape Simulation using standard rounded edges for Glassmorphism */}
            <div className={`relative p-[2px] rounded-2xl bg-gradient-to-b ${bgClasses} opacity-90 shadow-lg transition-transform hover:scale-105 cursor-pointer`}>
                <div className="bg-black/40 backdrop-blur-md rounded-[14px] px-6 py-3 flex flex-col items-center justify-center min-w-[120px] border border-white/20">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#FDE68A] mb-1 opacity-90 text-center block w-full">{label}</span>
                    <span className="text-2xl font-black text-white mix-blend-plus-lighter">{value}</span>
                    <div className="flex mt-1 opacity-80">
                        <span className="text-[8px] uppercase tracking-wider text-white text-center">{subValue}</span>
                    </div>
                    {/* Decorative Stars */}
                    <div className="flex space-x-1 mt-1 text-[#FDE68A]">
                        <span className="text-[6px]">★</span>
                        <span className="text-[8px]">★</span>
                        <span className="text-[6px]">★</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
