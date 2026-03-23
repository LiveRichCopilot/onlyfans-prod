"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AddCreatorModal } from "@/components/dashboard/AddCreatorModal";

import { OPEN_ADD_CREATOR } from "@/lib/emit-open-add-creator";

const NO_SIDEBAR_PATHS = ["/login", "/onboarding", "/auth/callback"];

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [creators, setCreators] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        const handler = () => setShowAddModal(true);
        window.addEventListener(OPEN_ADD_CREATOR, handler);
        return () => window.removeEventListener(OPEN_ADD_CREATOR, handler);
    }, []);

    const fetchCreators = useCallback(() => {
        setLoading(true);
        fetch("/api/creators")
            .then((res) => res.json())
            .then((data) => {
                setCreators(data.creators || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchCreators();
    }, [fetchCreators]);

    const showSidebar = !NO_SIDEBAR_PATHS.some((p) => pathname?.startsWith(p));

    if (!showSidebar) {
        return <>{children}</>;
    }

    return (
        <div className="flex min-h-screen text-white/90 overflow-hidden relative">
            <div className="hidden md:block fixed left-0 top-0 bottom-0 z-20">
                <Sidebar creators={creators} loading={loading} onAddAccount={() => setShowAddModal(true)} />
            </div>
            <main className="flex-1 min-h-screen overflow-y-auto overflow-x-hidden z-10 custom-scrollbar md:ml-[19rem]">
                {children}
            </main>
            {showAddModal && (
                <AddCreatorModal
                    onClose={() => {
                        setShowAddModal(false);
                        fetchCreators();
                    }}
                    existingCreators={creators}
                />
            )}
        </div>
    );
}
