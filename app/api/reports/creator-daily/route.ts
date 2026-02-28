import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/creator-daily
 *
 * Returns all 29 columns matching the HistoricalSalesUTC0 spreadsheet.
 *
 * Query params:
 *   ?days=30         — how many days back (default 30)
 *   ?creatorId=xxx   — filter to one creator
 *   ?format=csv      — return CSV download
 *   ?format=pdf      — return print-ready HTML (opens print dialog)
 */
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const days = Math.min(parseInt(url.searchParams.get("days") || "30"), 365);
        const creatorId = url.searchParams.get("creatorId");
        const format = url.searchParams.get("format") || "json";

        const startDate = new Date();
        startDate.setUTCHours(0, 0, 0, 0);
        startDate.setUTCDate(startDate.getUTCDate() - days);

        const where: any = { date: { gte: startDate } };
        if (creatorId) where.creatorId = creatorId;

        const reports = await prisma.creatorDailyReport.findMany({
            where,
            include: { creator: { select: { id: true, name: true, ofUsername: true, group: true } } },
            orderBy: [{ date: "desc" }, { creatorId: "asc" }],
        });

        // Calculate contribution % per day
        const dailyTotals = new Map<string, number>();
        for (const r of reports) {
            const dayKey = r.date.toISOString().slice(0, 10);
            dailyTotals.set(dayKey, (dailyTotals.get(dayKey) || 0) + r.totalGross);
        }

        // Helper: format date parts
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        const getWeekNumber = (d: Date) => {
            const start = new Date(d.getFullYear(), 0, 1);
            const diff = d.getTime() - start.getTime();
            return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
        };

        const mapReport = (r: typeof reports[0]) => {
            const dateStr = r.date.toISOString().slice(0, 10);
            const d = new Date(r.date);
            const dayTotal = dailyTotals.get(dateStr) || 1;
            const contributionPct = dayTotal > 0
                ? Math.round((r.totalGross / dayTotal) * 10000) / 100
                : 0;
            const renewOnPct = r.subscribersCount > 0
                ? Math.round((r.fansRenewOn / r.subscribersCount) * 10000) / 100
                : 0;

            return {
                date: dateStr,
                creatorId: r.creatorId,
                creatorName: r.creator.name,
                creatorUsername: r.creator.ofUsername,
                // Earnings
                subsGross: r.subsGross,
                newSubsGross: r.newSubsGross,
                recurringSubsGross: r.recurringSubsGross,
                tipsGross: r.tipsGross,
                totalGross: r.totalGross,
                contributionPct,
                topPercentage: r.topPercentage,
                // Audience
                followingCount: r.followingCount,
                fansRenewOn: r.fansRenewOn,
                renewOnPct,
                newSubs: r.newSubs,
                activeFans: r.activeFans,
                expiredFanChange: r.expiredFanChange,
                // More earnings
                postsGross: r.postsGross,
                messagesGross: r.messagesGross,
                streamsGross: r.streamsGross,
                refundGross: r.refundGross,
                // Metadata
                creatorGroup: r.creator.group || "",
                // Averages
                avgSpendPerSpender: r.avgSpendPerSpender,
                avgSpendPerTransaction: r.avgSpendPerTransaction,
                avgEarningsPerFan: r.avgEarningsPerFan,
                avgSubLength: r.avgSubLength,
                // Date dimensions
                dateFormatted: dateStr,
                day: dayNames[d.getUTCDay()],
                week: getWeekNumber(d),
                month: monthNames[d.getUTCMonth()],
                year: d.getUTCFullYear(),
                subscribersCount: r.subscribersCount,
            };
        };

        // ---------- CSV ----------
        if (format === "csv") {
            const headers = [
                "Date UTC+0", "Creator", "Subscription Gross", "New subscriptions Gross",
                "Recurring subscriptions Gross", "Tips Gross", "Total earnings Gross",
                "Contribution %", "OF ranking", "Following", "Fans with renew on",
                "Renew on %", "New fans", "Active fans", "Change in expired fan count",
                "Posts Gross", "Message Gross", "Streams Gross", "Refund Gross",
                "Creator group", "Avg spend per spender Gross", "Avg spend per transaction Gross",
                "Avg earnings per fan Gross", "Avg subscription length",
                "Date", "Day", "Week", "Month", "Year",
            ];
            const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
            const rows = reports.map((r) => {
                const m = mapReport(r);
                return [
                    m.date,
                    escape(m.creatorName || ""),
                    m.subsGross.toFixed(2),
                    m.newSubsGross.toFixed(2),
                    m.recurringSubsGross.toFixed(2),
                    m.tipsGross.toFixed(2),
                    m.totalGross.toFixed(2),
                    m.contributionPct.toFixed(2) + "%",
                    m.topPercentage != null ? m.topPercentage.toFixed(1) + "%" : "",
                    m.followingCount,
                    m.fansRenewOn,
                    m.renewOnPct.toFixed(2) + "%",
                    m.newSubs,
                    m.activeFans,
                    m.expiredFanChange,
                    m.postsGross.toFixed(2),
                    m.messagesGross.toFixed(2),
                    m.streamsGross.toFixed(2),
                    m.refundGross.toFixed(2),
                    escape(m.creatorGroup),
                    m.avgSpendPerSpender.toFixed(2),
                    m.avgSpendPerTransaction.toFixed(2),
                    m.avgEarningsPerFan.toFixed(2),
                    m.avgSubLength.toFixed(1),
                    m.dateFormatted,
                    m.day,
                    m.week,
                    m.month,
                    m.year,
                ];
            });

            const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
            return new NextResponse(csv, {
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="creator-report-${days}d.csv"`,
                },
            });
        }

        // ---------- PDF (print-ready HTML) ----------
        if (format === "pdf") {
            const tableRows = reports
                .map((r) => {
                    const m = mapReport(r);
                    return `<tr>
                    <td>${m.date}</td>
                    <td>${m.creatorName || "Unknown"}</td>
                    <td class="r">$${m.subsGross.toFixed(2)}</td>
                    <td class="r">$${m.newSubsGross.toFixed(2)}</td>
                    <td class="r">$${m.recurringSubsGross.toFixed(2)}</td>
                    <td class="r">$${m.tipsGross.toFixed(2)}</td>
                    <td class="r"><b>$${m.totalGross.toFixed(2)}</b></td>
                    <td class="r">${m.contributionPct.toFixed(1)}%</td>
                    <td class="r">${m.topPercentage != null ? m.topPercentage.toFixed(1) + "%" : "N/A"}</td>
                    <td class="r">${m.followingCount}</td>
                    <td class="r">${m.fansRenewOn}</td>
                    <td class="r">${m.renewOnPct.toFixed(1)}%</td>
                    <td class="r">${m.newSubs}</td>
                    <td class="r">${m.activeFans}</td>
                    <td class="r">${m.expiredFanChange}</td>
                    <td class="r">$${m.postsGross.toFixed(2)}</td>
                    <td class="r">$${m.messagesGross.toFixed(2)}</td>
                    <td class="r">$${m.streamsGross.toFixed(2)}</td>
                    <td class="r">$${m.refundGross.toFixed(2)}</td>
                    <td>${m.creatorGroup}</td>
                    <td class="r">$${m.avgSpendPerSpender.toFixed(2)}</td>
                    <td class="r">$${m.avgSpendPerTransaction.toFixed(2)}</td>
                    <td class="r">$${m.avgEarningsPerFan.toFixed(2)}</td>
                    <td class="r">${m.avgSubLength.toFixed(1)}</td>
                    <td>${m.day}</td>
                    <td>${m.week}</td>
                    <td>${m.month}</td>
                    <td>${m.year}</td>
                </tr>`;
                })
                .join("");

            const html = `<!DOCTYPE html>
<html>
<head>
    <title>Creator Daily Report — HistoricalSalesUTC0</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 12px; color: #111; }
        h1 { font-size: 16px; margin-bottom: 2px; }
        .meta { color: #666; font-size: 10px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 8px; }
        th, td { padding: 3px 4px; border: 1px solid #ddd; white-space: nowrap; }
        th { background: #f5f5f5; font-weight: 600; text-align: left; }
        .r { text-align: right; }
        tr:nth-child(even) { background: #fafafa; }
        @media print { body { padding: 0; } @page { size: landscape; margin: 8mm; } }
    </style>
</head>
<body>
    <h1>Creator Daily Report — HistoricalSalesUTC0</h1>
    <p class="meta">Last ${days} days &middot; Generated ${new Date().toISOString().slice(0, 10)} &middot; ${reports.length} rows</p>
    <table>
        <thead>
            <tr>
                <th>Date UTC+0</th><th>Creator</th><th>Sub Gross</th><th>New Sub</th>
                <th>Recur Sub</th><th>Tips</th><th>Total</th><th>Contrib%</th>
                <th>OF Rank</th><th>Following</th><th>Renew On</th><th>Renew%</th>
                <th>New Fans</th><th>Active</th><th>Expired</th><th>Posts</th>
                <th>Msgs</th><th>Streams</th><th>Refund</th><th>Group</th>
                <th>$/Spender</th><th>$/Tx</th><th>$/Fan</th><th>Avg Sub Len</th>
                <th>Day</th><th>Wk</th><th>Month</th><th>Year</th>
            </tr>
        </thead>
        <tbody>${tableRows || "<tr><td colspan='28' style='text-align:center;color:#999'>No data yet</td></tr>"}</tbody>
    </table>
    <script>window.onload=()=>window.print();</script>
</body>
</html>`;

            return new NextResponse(html, {
                headers: { "Content-Type": "text/html; charset=utf-8" },
            });
        }

        // ---------- JSON (default) ----------
        return NextResponse.json({
            days,
            count: reports.length,
            reports: reports.map(mapReport),
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
