"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Users, Shield, UserPlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { InviteMemberModal } from "@/components/team/InviteMemberModal";
import { AccountsDropdown } from "@/components/team/AccountsDropdown";

const ASSIGNABLE_ROLES = [
    { value: "ADMIN", label: "Admin" },
    { value: "ACCOUNT_EXEC", label: "Team Manager" },
    { value: "MANAGER", label: "Account Manager" },
    { value: "AGENT", label: "Chatter" },
    { value: "VIEWER", label: "Analyst" },
];

type Member = {
    id: string;
    userId: string;
    name: string;
    email: string;
    image: string | null;
    role: string;
    roleLabel: string;
    accountIds: string[];
    accountCount: number;
};

type PendingInvite = {
    id: string;
    email: string;
    role: string;
    roleLabel: string;
};

type Creator = {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    active?: boolean;
};

export default function TeamManagement() {
    const router = useRouter();
    const [members, setMembers] = useState<Member[]>([]);
    const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
    const [creators, setCreators] = useState<Creator[]>([]);
    const [currentUserId, setCurrentUserId] = useState("");
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [tab, setTab] = useState<"all" | "pending">("all");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/team");
            const data = await res.json();
            setMembers(data.members || []);
            setPendingInvites(data.pendingInvites || []);
            setCreators(data.creators || []);
            setCurrentUserId(data.currentUserId || "");
        } catch (err) {
            console.error("Failed to load team data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (email: string, role: string) => {
        const res = await fetch("/api/team", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "INVITE", email, role }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await fetchData();
    };

    const handleRoleChange = async (memberId: string, newRole: string) => {
        await fetch("/api/team", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "UPDATE_ROLE", memberId, newRole }),
        });
        await fetchData();
    };

    const handleAccountsChange = async (userId: string, creatorIds: string[]) => {
        await fetch("/api/team", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "ASSIGN_ACCOUNTS", userId, creatorIds }),
        });
        await fetchData();
    };

    const handleRemove = async (memberId: string, name: string) => {
        if (!confirm(`Remove ${name} from the team?`)) return;
        await fetch("/api/team", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "REMOVE_MEMBER", memberId }),
        });
        await fetchData();
    };

    const handleCancelInvite = async (inviteId: string) => {
        await fetch("/api/team", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "CANCEL_INVITE", inviteId }),
        });
        await fetchData();
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-white">
                <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-teal-500 mr-3" />
                Loading Team...
            </div>
        );
    }

    return (
        <div className="min-h-screen text-white/90 p-4 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/")}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-white/50 hover:text-white border border-white/5"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                            <Users size={28} className="text-teal-400" /> Team Management
                        </h1>
                        <p className="text-sm text-white/50 mt-1">
                            {members.length} member{members.length !== 1 ? "s" : ""} &middot;{" "}
                            {pendingInvites.length} pending
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowInvite(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition"
                >
                    <UserPlus size={16} /> Invite Member
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {(["all", "pending"] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                            tab === t
                                ? "bg-white/10 text-white border border-white/10"
                                : "text-white/40 hover:text-white/60"
                        }`}
                    >
                        {t === "all" ? `All (${members.length})` : `Pending (${pendingInvites.length})`}
                    </button>
                ))}
            </div>

            {/* Members Table */}
            {tab === "all" && (
                <div className="glass-panel rounded-3xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="pb-4 pt-5 px-6 text-xs font-semibold text-white/40 uppercase tracking-widest">
                                        Member
                                    </th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest">
                                        Role
                                    </th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest">
                                        Accounts
                                    </th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {members.map((m) => (
                                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                {m.image ? (
                                                    <img
                                                        src={m.image}
                                                        alt=""
                                                        className="w-10 h-10 rounded-full border border-white/20 object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-600 to-purple-600 flex items-center justify-center text-sm font-bold border border-white/20">
                                                        {m.name?.charAt(0)?.toUpperCase() || "?"}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-medium text-white">{m.name}</div>
                                                    <div className="text-xs text-white/50">{m.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            {m.role === "OWNER" ? (
                                                <span className="flex items-center gap-1.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 px-3 py-1.5 rounded-xl text-xs font-bold tracking-wider w-max">
                                                    <Shield size={12} /> Owner
                                                </span>
                                            ) : (
                                                <select
                                                    value={m.role}
                                                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                                                    className="bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none transition appearance-none cursor-pointer"
                                                >
                                                    {ASSIGNABLE_ROLES.map((r) => (
                                                        <option key={r.value} value={r.value} className="bg-gray-900">
                                                            {r.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </td>
                                        <td className="py-4 px-4">
                                            {m.role === "OWNER" || m.role === "ADMIN" ? (
                                                <span className="text-sm text-white/50">All Accounts</span>
                                            ) : (
                                                <AccountsDropdown
                                                    creators={creators}
                                                    selectedIds={m.accountIds}
                                                    onChange={(ids) => handleAccountsChange(m.userId, ids)}
                                                />
                                            )}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            {m.role !== "OWNER" && m.userId !== currentUserId && (
                                                <button
                                                    onClick={() => handleRemove(m.id, m.name)}
                                                    className="text-red-400/60 hover:text-red-400 transition flex items-center gap-1.5 text-sm ml-auto"
                                                >
                                                    <Trash2 size={14} /> Remove
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {members.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-sm text-white/40 italic">
                                            No team members yet. Invite someone to get started.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pending Invites */}
            {tab === "pending" && (
                <div className="glass-panel rounded-3xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="pb-4 pt-5 px-6 text-xs font-semibold text-white/40 uppercase tracking-widest">
                                        Email
                                    </th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest">
                                        Role
                                    </th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest">
                                        Status
                                    </th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {pendingInvites.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm border border-white/10 text-white/30">
                                                    {inv.email.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-white/80">{inv.email}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1.5 rounded-xl text-xs font-bold tracking-wider">
                                                {inv.roleLabel}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="text-xs text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-1 rounded">
                                                Pending
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <button
                                                onClick={() => handleCancelInvite(inv.id)}
                                                className="text-red-400/60 hover:text-red-400 transition text-sm"
                                            >
                                                Cancel
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {pendingInvites.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-sm text-white/40 italic">
                                            No pending invites.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInvite && (
                <InviteMemberModal onClose={() => setShowInvite(false)} onInvite={handleInvite} />
            )}
        </div>
    );
}
