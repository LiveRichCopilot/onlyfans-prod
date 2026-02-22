"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const COLORS = { teal: '#2DD4BF', cyan: '#22D3EE' };

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#12141a]/95 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shadow-2xl">
            <p className="text-[10px] text-white/40 mb-0.5">{label}</p>
            <p className="text-sm font-medium text-white">${payload[0]?.value?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
    );
}

type Props = {
    data: { date: string; revenue: number }[];
};

export function EarningsChart({ data }: Props) {
    if (!data || data.length === 0) return null;

    // Format dates to short labels
    const chartData = data.map(d => ({
        ...d,
        label: d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    }));

    return (
        <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden p-5 mb-6">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-15" style={{ background: COLORS.teal }} />
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] uppercase tracking-wider text-white/35 font-medium">Earnings Trend (7d)</h3>
                    <span className="text-xs text-teal-400 font-medium">Daily Gross</span>
                </div>
                <div className="h-[200px] md:h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barCategoryGap="20%">
                            <defs>
                                <linearGradient id="gradBar" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={COLORS.cyan} stopOpacity={0.8} />
                                    <stop offset="100%" stopColor={COLORS.teal} stopOpacity={0.3} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="label" stroke="rgba(255,255,255,0.25)" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
                            <YAxis stroke="rgba(255,255,255,0.25)" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={50} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                            <Bar dataKey="revenue" fill="url(#gradBar)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
