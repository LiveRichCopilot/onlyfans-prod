"use client";

import Link from "next/link";
import { LayoutGrid, MessageSquare, Zap } from "lucide-react";
import { HustleMeter } from "./HustleMeter";

export function NavBar() {
    return (
        <aside className="w-14 flex flex-col items-center py-4 gap-6 border-r border-white/[0.06]">
            <Link href="/" className="h-9 w-9 rounded-lg bg-[#2d786e] flex items-center justify-center font-bold text-xs text-white shadow-sm">
                OF
            </Link>

            <nav className="flex flex-col items-center gap-2 flex-1">
                <Link
                    href="/"
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                    title="Dashboard"
                >
                    <LayoutGrid size={18} />
                </Link>
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-white/[0.08] border border-white/[0.08]"
                    title="Live Inbox"
                >
                    <MessageSquare size={18} />
                </div>
                <Link
                    href="/performance"
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                    title="Performance"
                >
                    <Zap size={18} />
                </Link>
            </nav>

            {/* Hustle Meter at bottom */}
            <HustleMeter />
        </aside>
    );
}
