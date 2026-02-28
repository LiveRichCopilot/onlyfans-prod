"use client";

import { useState } from "react";
import { X, Mail } from "lucide-react";

const ASSIGNABLE_ROLES = [
    { value: "ADMIN", label: "Admin" },
    { value: "ACCOUNT_EXEC", label: "Team Manager" },
    { value: "MANAGER", label: "Account Manager" },
    { value: "AGENT", label: "Chatter" },
    { value: "VIEWER", label: "Analyst" },
];

type Props = {
    onClose: () => void;
    onInvite: (email: string, role: string) => Promise<void>;
};

export function InviteMemberModal({ onClose, onInvite }: Props) {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("AGENT");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async () => {
        if (!email.trim()) {
            setError("Email is required");
            return;
        }
        setLoading(true);
        setError("");
        try {
            await onInvite(email.trim().toLowerCase(), role);
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to send invite");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="glass-panel p-6 rounded-3xl w-full max-w-md bg-gray-900/90 relative shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    <Mail size={20} className="text-teal-400" /> Invite Team Member
                </h2>
                <p className="text-sm text-white/50 mb-6">
                    They&apos;ll be able to log in and see their assigned accounts.
                </p>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 focus:border-teal-500 focus:outline-none transition"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">
                            Role
                        </label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-teal-500 focus:outline-none transition appearance-none"
                        >
                            {ASSIGNABLE_ROLES.map((r) => (
                                <option key={r.value} value={r.value} className="bg-gray-900">
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2 rounded-xl mb-4">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition disabled:opacity-50"
                >
                    {loading ? "Sending..." : "Send Invite"}
                </button>
            </div>
        </div>
    );
}
