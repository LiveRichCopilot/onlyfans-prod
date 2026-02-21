import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    hoverable?: boolean;
}

export function GlassCard({ children, className = '', onClick, hoverable = false }: GlassCardProps) {
    const baseClasses = 'bg-white/5 backdrop-blur-2xl border border-white/10 dark:bg-black/10 dark:border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] rounded-3xl overflow-hidden';
    const hoverClasses = hoverable ? 'hover:bg-white/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer' : '';

    return (
        <div
            className={`${baseClasses} ${hoverClasses} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
}
