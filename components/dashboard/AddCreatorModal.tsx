"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

type Props = {
    onClose: () => void;
    existingCreators: any[];
};

export function AddCreatorModal({ onClose, existingCreators }: Props) {
    const [username, setUsername] = useState("");
    const [groupId, setGroupId] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Auto-detect agency owner's Telegram ID from existing creators
    const agencyTelegramId = existingCreators.find(c => c.telegramId)?.telegramId || "";

    const handleSubmit = async () => {
        setSubmitting(true);
        setError("");

        if (!agencyTelegramId) {
            setError("No agency Telegram ID found. Add your first creator with a Telegram ID.");
            setSubmitting(false);
            return;
        }

        try {
            const res = await fetch("/api/accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    accountId: agencyTelegramId,
                    username: username.trim(),
                    telegramGroupId: groupId.trim() || undefined,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || `Failed: ${res.status}`);
                setSubmitting(false);
                return;
            }

            window.location.reload();
        } catch (e: any) {
            setError(e.message || "Network error");
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="glass-panel p-6 rounded-3xl border-white/20 w-full max-w-md bg-gray-900/90 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
                    <X size={20} />
                </button>
                <h2 className="text-xl font-bold text-white mb-2">Add Creator</h2>
                <p className="text-sm text-white/60 mb-6">
                    Add a new OnlyFans account to your agency. Alerts go to your Telegram by default.
                </p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
                        {error}
                    </div>
                )}

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1 block">OnlyFans Username *</label>
                        <input type="text" placeholder="e.g. angiyang" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1 block">Alert Group ID (Optional)</label>
                        <input type="text" placeholder="e.g. -100987654321" value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500" />
                        <p className="text-[10px] text-white/40 mt-1">Create a Telegram group for this creator's alerts. Leave blank to use default.</p>
                    </div>

                    {/* Show what's auto-filled */}
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Auto-configured</p>
                        <p className="text-xs text-white/50">Agency Telegram: <span className="text-teal-400 font-mono">{agencyTelegramId || "Not set"}</span></p>
                    </div>
                </div>

                <button
                    disabled={submitting || !username.trim()}
                    onClick={handleSubmit}
                    className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition disabled:opacity-50"
                >
                    {submitting ? "Adding..." : "Add Creator"}
                </button>
            </div>
        </div>
    );
}
