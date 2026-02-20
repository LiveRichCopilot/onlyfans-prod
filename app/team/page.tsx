"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Users, Shield, Link as LinkIcon, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TeamManagement() {
    const router = useRouter();
    const [employees, setEmployees] = useState<any[]>([]);
    const [availableCreators, setAvailableCreators] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Assignment Modal State
    const [assigningEmployee, setAssigningEmployee] = useState<any>(null);

    useEffect(() => {
        fetchTeamData();
    }, []);

    const fetchTeamData = async () => {
        try {
            const res = await fetch("/api/team");
            const data = await res.json();
            setEmployees(data.employees || []);
            setAvailableCreators(data.availableCreators || []);
            setLoading(false);
        } catch (err) {
            console.error("Failed to load team data", err);
            setLoading(false);
        }
    };

    const toggleAssignment = async (employeeId: string, creatorId: string, isCurrentlyAssigned: boolean) => {
        const action = isCurrentlyAssigned ? "REVOKE" : "ASSIGN";
        try {
            await fetch("/api/team", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: employeeId, creatorId, action }),
            });
            // Refresh list to show updated badge
            fetchTeamData();
        } catch (err) {
            console.error("Assignment toggle failed", err);
        }
    };

    if (loading) return (
        <div className="flex min-h-screen items-center justify-center text-white">
            <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-teal-500 mr-3"></div>
            Loading Team Roster...
        </div>
    );

    return (
        <div className="min-h-screen text-white/90 p-4 md:p-8 max-w-7xl mx-auto">

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => router.push('/')}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-white/50 hover:text-white border border-white/5"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <Users size={28} className="text-teal-400" /> Team & Assignments
                    </h1>
                    <p className="text-sm text-white/50 mt-1">Manage chatters and assign them to specific creator dashboards.</p>
                </div>
            </div>

            {/* Roster Table */}
            <div className="glass-panel p-6 rounded-3xl border-white/20 border-l border-l-white/10">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="pb-4 pt-2 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest">Employee Name</th>
                                <th className="pb-4 pt-2 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest">Role</th>
                                <th className="pb-4 pt-2 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest">Assigned Accounts</th>
                                <th className="pb-4 pt-2 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {employees.map((emp) => (
                                <tr key={emp.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="py-4 px-4">
                                        <div className="font-medium text-white">{emp.name || 'Invited User'}</div>
                                        <div className="text-xs text-white/50">{emp.email}</div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded text-[10px] font-bold tracking-wider flex items-center gap-1.5 w-max">
                                            <Shield size={12} /> {emp.role}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex gap-2 flex-wrap max-w-md">
                                            {emp.assignments?.length > 0 ? (
                                                emp.assignments.map((a: any) => (
                                                    <div key={a.creatorId} className="bg-black/40 border border-white/10 px-2 py-1 rounded-lg text-xs flex items-center gap-1.5 text-white/80">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                                                        {a.creator?.name || a.creator?.ofapiCreatorId || "Unknown"}
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-xs text-rose-400 italic">No accounts assigned</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        <button
                                            onClick={() => setAssigningEmployee(emp)}
                                            className="glass-button px-3 py-1.5 rounded-xl text-xs font-medium text-teal-400 border border-teal-500/30 hover:bg-teal-500/10 transition"
                                        >
                                            Manage Access
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {employees.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-sm text-white/40 italic">
                                        No employees have been invited to your agency yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Assignment Modal (Supercreator Style Dropdown) */}
            {assigningEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="glass-panel p-6 rounded-3xl border-white/20 w-full max-w-md bg-gray-900/90 relative shadow-2xl">
                        <button
                            onClick={() => setAssigningEmployee(null)}
                            className="absolute top-4 right-4 text-white/50 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                        <h2 className="text-xl font-bold text-white mb-1">Assign Creator Accounts</h2>
                        <p className="text-sm text-white/50 mb-6">
                            Grant <strong className="text-white">{assigningEmployee.name}</strong> access to view specific module analytics and alerts.
                        </p>

                        <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                            {availableCreators.map(creator => {
                                const isAssigned = assigningEmployee.assignments?.some((a: any) => a.creatorId === creator.id);
                                return (
                                    <div
                                        key={creator.id}
                                        onClick={() => toggleAssignment(assigningEmployee.id, creator.id, isAssigned)}
                                        className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer border transition-all ${isAssigned
                                                ? "bg-teal-500/10 border-teal-500/30 ring-1 ring-teal-500/50"
                                                : "bg-black/30 border-white/5 hover:border-white/20"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm">
                                                {creator.name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white">{creator.name || 'Unknown'}</div>
                                                <div className="text-[10px] text-white/50">acct_{creator.id.substring(0, 8)}</div>
                                            </div>
                                        </div>
                                        <div>
                                            {isAssigned ? (
                                                <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center">
                                                    <Check size={12} className="text-black" />
                                                </div>
                                            ) : (
                                                <div className="w-5 h-5 rounded-full border-2 border-white/20"></div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {availableCreators.length === 0 && (
                                <div className="p-4 text-center text-sm text-white/40 italic bg-black/30 rounded-2xl border border-white/5">
                                    You have not connected any OnlyFans accounts to your agency yet.
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                setAssigningEmployee(null);
                            }}
                            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition border border-white/10"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
