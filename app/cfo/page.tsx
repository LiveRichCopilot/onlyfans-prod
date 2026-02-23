import { prisma } from "@/lib/prisma";
import { DollarSign, AlertCircle, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CFODashboard() {
    // Live gathering of current chatters who missed their goals recently
    // Querying historical Transaction actuals.
    const creators = await prisma.creator.findMany({
        where: { active: true }
    });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const hourlyTransactions = await prisma.transaction.findMany({
        where: { date: { gte: oneHourAgo } },
        include: { fan: { include: { creator: true } } }
    });

    let totalHourlyRevenue = 0;
    const creatorRevenue: Record<string, { handle: string, actual: number, target: number }> = {};

    creators.forEach((c: any) => {
        creatorRevenue[c.id] = {
            handle: c.ofapiCreatorId || c.telegramId,
            actual: 0,
            target: c.hourlyTarget
        };
    });

    hourlyTransactions.forEach((tx: any) => {
        totalHourlyRevenue += tx.amount;
        if (creatorRevenue[tx.fan.creatorId]) {
            creatorRevenue[tx.fan.creatorId].actual += tx.amount;
        }
    });

    const chattersUnderperforming = Object.values(creatorRevenue).filter(c => c.actual < c.target);

    return (
        <div className="min-h-screen bg-[#050510] relative text-white pt-10 px-8">
            {/* Background Orbs */}
            <div className="absolute top-[-5%] left-[20%] w-[30%] h-[30%] bg-teal-600/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-gray-600/20 rounded-full blur-[120px] pointer-events-none" />

            <h1 className="text-4xl font-bold tracking-tight mb-2 z-10 relative">CFO Executive Overview</h1>
            <p className="text-white/60 mb-8 z-10 relative">Real-time financial aggregated analytics and chatter performance gaps.</p>

            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 z-10 relative">
                <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-[50px]"></div>
                    <DollarSign className="text-green-400 mb-4" size={28} />
                    <p className="text-white/50 text-sm font-semibold tracking-wider uppercase mb-1">Total Hourly Revenue (Agency)</p>
                    <p className="text-4xl font-bold">${totalHourlyRevenue.toLocaleString()}<span className="text-sm text-white/40 font-normal">/hr</span></p>
                </div>

                <div className="glass-panel p-6 rounded-2xl border border-white/10">
                    <TrendingUp className="text-teal-400 mb-4" size={28} />
                    <p className="text-white/50 text-sm font-semibold tracking-wider uppercase mb-1">Active Modules</p>
                    <p className="text-4xl font-bold">{creators.length + 2}</p>
                </div>

                <div className="glass-panel p-6 rounded-2xl border border-white/10">
                    <AlertCircle className="text-red-400 mb-4" size={28} />
                    <p className="text-white/50 text-sm font-semibold tracking-wider uppercase mb-1">Chatters Under Target</p>
                    <p className="text-4xl font-bold">{chattersUnderperforming.length}</p>
                </div>
            </div>

            {/* Underperforming List */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 z-10 relative">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <AlertCircle className="text-red-400" size={20} />
                    Missed Target Interventions
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 text-white/50 text-sm">
                                <th className="pb-4 font-semibold">Creator Account</th>
                                <th className="pb-4 font-semibold">Actual Hourly Revenue</th>
                                <th className="pb-4 font-semibold">Target / hr</th>
                                <th className="pb-4 font-semibold">Deficit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chattersUnderperforming.map((c, i) => (
                                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                    <td className="py-4 font-medium flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/10"></div>
                                        @{c.handle}
                                    </td>
                                    <td className="py-4 text-red-400 font-semibold">${c.actual.toFixed(2)}</td>
                                    <td className="py-4 text-white/70">${c.target.toFixed(2)}</td>
                                    <td className="py-4 text-white/50">-${(c.target - c.actual).toFixed(2)}</td>
                                </tr>
                            ))}
                            {chattersUnderperforming.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-white/40">All chatters are meeting or exceeding their targets!</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
