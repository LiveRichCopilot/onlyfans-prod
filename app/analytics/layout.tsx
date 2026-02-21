import React from 'react';

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    // Apple Glass styling favors a deeply colored gradient or mesh background underneath frosted components
    return (
        <div className="fixed inset-0 min-h-screen bg-black overflow-hidden selection:bg-blue-500/30">
            {/* Background Orbs/Gradients */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
            <div className="absolute top-[20%] left-[60%] w-[30%] h-[30%] bg-cyan-600/10 rounded-full blur-[100px] mix-blend-screen pointer-events-none" />

            {/* Main Content Area */}
            <div className="relative z-10 flex h-full p-4 sm:p-6 lg:p-8 space-x-6">
                {children}
            </div>
        </div>
    );
}
