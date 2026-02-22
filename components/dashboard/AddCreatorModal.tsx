"use client";

import { useState } from "react";
import { X } from "lucide-react";

type Props = {
    onClose: () => void;
};

export function AddCreatorModal({ onClose }: Props) {
    const [username, setUsername] = useState("");
    const [telegramId, setTelegramId] = useState("");
    const [groupId, setGroupId] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await fetch("/api/accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    accountId: telegramId,
                    username,
                    telegramGroupId: groupId || undefined,
                }),
            });
            window.location.reload();
        } catch (e) {
            console.error(e);
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="glass-panel p-6 rounded-3xl border-white/20 w-full max-w-md bg-gray-900/90 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
                    <X size={20} />
                </button>
                <h2 className="text-xl font-bold text-white mb-2">Add Creator Account</h2>
                <p className="text-sm text-white/60 mb-6">
                    Register a new OnlyFans account to your agency. Route alerts to a custom Telegram Group.
                </p>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1 block">OnlyFans Username</label>
                        <input type="text" placeholder="e.g. liverichmedia" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1 block">Creator Telegram ID (Personal DM)</label>
                        <input type="text" placeholder="e.g. 123456789" value={telegramId} onChange={(e) => setTelegramId(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1 block">Alert Group ID (Optional)</label>
                        <input type="text" placeholder="e.g. -100987654321" value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500" />
                        <p className="text-[10px] text-white/40 mt-1">If set, alerts for this model route to this group instead of the global feed.</p>
                    </div>
                </div>

                <button
                    disabled={submitting || !username || !telegramId}
                    onClick={handleSubmit}
                    className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition disabled:opacity-50"
                >
                    {submitting ? "Adding..." : "Add Creator"}
                </button>
            </div>
        </div>
    );
}
