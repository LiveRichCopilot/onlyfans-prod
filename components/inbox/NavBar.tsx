"use client";

import Link from "next/link";
import { LayoutGrid, MessageSquare } from "lucide-react";

export function NavBar() {
    return (
        <aside className="w-16 lg:w-64 glass-panel m-4 mr-0 rounded-3xl p-4 lg:p-6 hidden md:flex flex-col z-10 border-white/10">
            <div className="flex items-center gap-3 mb-10">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-teal-600 to-gray-700 flex items-center justify-center font-bold text-lg shadow-lg shadow-teal-900/50">
                    OF
                </div>
                <div className="hidden lg:block">
                    <div className="text-xl font-bold tracking-tight text-white/90">HQ</div>
                    <div className="text-xs text-white/50">Agency Workspace</div>
                </div>
            </div>

            <nav className="space-y-8 flex-1">
                <div>
                    <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 px-2 hidden lg:block">Management</div>
                    <ul className="space-y-2">
                        <Link href="/">
                            <li className="flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 text-white/60 hover:text-white transition rounded-xl hover:bg-white/5 cursor-pointer">
                                <LayoutGrid size={20} /> <span className="hidden lg:inline text-sm">Dashboard</span>
                            </li>
                        </Link>
                        <li className="flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl bg-white/10 text-white shadow-sm border border-white/10">
                            <MessageSquare size={20} /> <span className="hidden lg:inline text-sm">Live Inbox</span>
                        </li>
                    </ul>
                </div>
            </nav>
        </aside>
    );
}
