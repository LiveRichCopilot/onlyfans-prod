"use client";

import { useState } from "react";
import { X, Mail, CheckCircle, AlertCircle } from "lucide-react";

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

type InviteResult = { email: string; ok: boolean; msg: string };

export function InviteMemberModal({ onClose, onInvite }: Props) {
    const [emails, setEmails] = useState("");
    const [role, setRole] = useState("AGENT");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [results, setResults] = useState<InviteResult[]>([]);

    const parseEmails = (raw: string): string[] => {
        return raw
            .split(/[,\n;]+/)
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e.length > 0 && e.includes("@"));
    };

    const parsed = parseEmails(emails);

    const handleSubmit = async () => {
        if (parsed.length === 0) {
            setError("Enter at least one valid email address");
            return;
        }
        setLoading(true);
        setError("");
        setResults([]);

        const inviteResults: InviteResult[] = [];

        for (const email of parsed) {
            try {
                await onInvite(email, role);
                inviteResults.push({ email, ok: true, msg: "Invited" });
            } catch (err: any) {
                inviteResults.push({ email, ok: false, msg: err.message || "Failed" });
            }
        }

        setResults(inviteResults);
        setLoading(false);

        // If all succeeded, close after a brief delay
        const allOk = inviteResults.every((r) => r.ok);
        if (allOk) {
            setTimeout(() => onClose(), 1200);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="glass-panel p-6 rounded-3xl w-full max-w-md bg-gray-900/90 relative shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    <Mail size={20} className="text-teal-400" /> Invite Team Members
                </h2>
                <p className="text-sm text-white/50 mb-6">
                    Add multiple emails separated by commas or new lines.
                </p>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">
                            Email Addresses
                        </label>
                        <textarea
                            value={emails}
                            onChange={(e) => { setEmails(e.target.value); setResults([]); }}
                            placeholder={"stacey@liverich.travel\nsora@liverich.travel\neirene@liverich.travel"}
                            rows={4}
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 focus:border-teal-500 focus:outline-none transition resize-none"
                        />
                        {parsed.length > 0 && results.length === 0 && (
                            <div className="text-xs text-teal-400 mt-1">
                                {parsed.length} email{parsed.length !== 1 ? "s" : ""} detected
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">
                            Role (applied to all)
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

                {/* Results */}
                {results.length > 0 && (
                    <div className="space-y-1.5 mb-4 max-h-[160px] overflow-y-auto">
                        {results.map((r) => (
                            <div
                                key={r.email}
                                className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${
                                    r.ok
                                        ? "bg-teal-500/10 text-teal-400"
                                        : "bg-red-500/10 text-red-400"
                                }`}
                            >
                                {r.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                <span className="truncate">{r.email}</span>
                                <span className="ml-auto text-xs opacity-70">{r.msg}</span>
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2 rounded-xl mb-4">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={loading || parsed.length === 0}
                    className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition disabled:opacity-50"
                >
                    {loading
                        ? `Inviting ${parsed.length}...`
                        : `Invite ${parsed.length || ""} Member${parsed.length !== 1 ? "s" : ""}`}
                </button>
            </div>
        </div>
    );
}
