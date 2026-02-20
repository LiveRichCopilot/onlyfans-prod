"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building, UserCircle } from "lucide-react";

export default function Onboarding() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [selectedRole, setSelectedRole] = useState<"AGENCY" | "CREATOR" | null>(null);

    if (status === "loading") {
        return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
    }

    if (status === "unauthenticated") {
        router.push("/api/auth/signin");
        return null;
    }

    const handleRoleSelection = async () => {
        if (!selectedRole) return;
        // In V3 proper, this hits a backend API route to save the role to the NextAuth user model.
        // E.g. fetch('/api/user/role', { method: 'POST', body: JSON.stringify({ role: selectedRole }) });

        // For now, redirect them based on their choice. Everything is free to start.
        if (selectedRole === "AGENCY") {
            router.push("/"); // Directs to the Agency Dashboard we built
        } else {
            router.push("/creator-dashboard"); // Creator specific view
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-white">
            {/* Glassmorphism Background Gradients */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/30 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/30 rounded-full blur-[120px]" />

            <div className="glass-panel p-10 rounded-3xl z-10 w-full max-w-2xl border-white/10 mx-4">
                <h1 className="text-4xl font-bold mb-2 tracking-tight text-center">Welcome to OnlyFans Essentials</h1>
                <p className="text-center text-white/60 mb-10">How are you planning to use the platform today? Everything is currently free during beta.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">

                    <div
                        onClick={() => setSelectedRole("AGENCY")}
                        className={`cursor-pointer p-6 rounded-2xl glass-panel border transition-all duration-300 flex flex-col items-center justify-center gap-4 group
              ${selectedRole === "AGENCY" ? "border-blue-500 bg-white/10 shadow-lg shadow-blue-500/30" : "border-white/5 hover:border-white/20"}
            `}
                    >
                        <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                            <Building size={32} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold mb-1">I'm an Agency</h3>
                            <p className="text-sm text-white/50">Manage multiple creators, monitor hourly chat targets, and view aggregate CFO reports.</p>
                        </div>
                    </div>

                    <div
                        onClick={() => setSelectedRole("CREATOR")}
                        className={`cursor-pointer p-6 rounded-2xl glass-panel border transition-all duration-300 flex flex-col items-center justify-center gap-4 group
              ${selectedRole === "CREATOR" ? "border-purple-500 bg-white/10 shadow-lg shadow-purple-500/30" : "border-white/5 hover:border-white/20"}
            `}
                    >
                        <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                            <UserCircle size={32} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold mb-1">I'm a Creator</h3>
                            <p className="text-sm text-white/50">Securely link your specific API keys, setup mobile Telegram alerts, and automate target triggers.</p>
                        </div>
                    </div>

                </div>

                <button
                    onClick={handleRoleSelection}
                    disabled={!selectedRole}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300
            ${selectedRole ? "bg-white text-black hover:bg-white/90 scale-100" : "bg-white/10 text-white/30 cursor-not-allowed"}
          `}
                >
                    Continue
                </button>
            </div>
        </div>
    );
}
