import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/creator-daily
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
            include: { creator: { select: { id: true, name: true, ofUsername: true } } },
            orderBy: [{ date: "desc" }, { creatorId: "asc" }],
        });

        // ---------- CSV ----------
        if (format === "csv") {
            const headers = [
                "Date", "Creator", "Username", "Total Gross", "Total Net",
                "Subscriptions", "Tips", "Messages", "Posts", "Streams",
                "Subscribers", "Following", "Top %", "New Subs",
            ];
            const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
            const rows = reports.map((r) => [
                r.date.toISOString().slice(0, 10),
                escape(r.creator.name || ""),
                r.creator.ofUsername || "",
                r.totalGross.toFixed(2),
                r.totalNet != null ? r.totalNet.toFixed(2) : "",
                r.subsGross.toFixed(2),
                r.tipsGross.toFixed(2),
                r.messagesGross.toFixed(2),
                r.postsGross.toFixed(2),
                r.streamsGross.toFixed(2),
                r.subscribersCount,
                r.followingCount,
                r.topPercentage != null ? r.topPercentage.toFixed(1) : "",
                r.newSubs,
            ]);

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
                .map(
                    (r) => `<tr>
                    <td>${r.date.toISOString().slice(0, 10)}</td>
                    <td>${r.creator.name || "Unknown"}</td>
                    <td style="text-align:right">$${r.totalGross.toFixed(2)}</td>
                    <td style="text-align:right">$${r.subsGross.toFixed(2)}</td>
                    <td style="text-align:right">$${r.tipsGross.toFixed(2)}</td>
                    <td style="text-align:right">$${r.messagesGross.toFixed(2)}</td>
                    <td style="text-align:right">$${r.postsGross.toFixed(2)}</td>
                    <td style="text-align:right">$${r.streamsGross.toFixed(2)}</td>
                    <td style="text-align:right">${r.subscribersCount}</td>
                    <td style="text-align:right">${r.topPercentage != null ? r.topPercentage.toFixed(1) + "%" : "N/A"}</td>
                </tr>`
                )
                .join("");

            const html = `<!DOCTYPE html>
<html>
<head>
    <title>Creator Daily Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 2px; }
        .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th, td { padding: 5px 6px; border: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: 600; text-align: left; }
        tr:nth-child(even) { background: #fafafa; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>
    <h1>Creator Daily Report</h1>
    <p class="meta">Last ${days} days &middot; Generated ${new Date().toISOString().slice(0, 10)} &middot; ${reports.length} rows</p>
    <table>
        <thead>
            <tr>
                <th>Date</th><th>Creator</th><th>Total</th><th>Subs</th>
                <th>Tips</th><th>Messages</th><th>Posts</th><th>Streams</th>
                <th>Fans</th><th>Top %</th>
            </tr>
        </thead>
        <tbody>${tableRows || "<tr><td colspan='10' style='text-align:center;color:#999'>No data yet</td></tr>"}</tbody>
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
            reports: reports.map((r) => ({
                date: r.date.toISOString().slice(0, 10),
                creatorId: r.creatorId,
                creatorName: r.creator.name,
                creatorUsername: r.creator.ofUsername,
                totalGross: r.totalGross,
                totalNet: r.totalNet,
                subsGross: r.subsGross,
                tipsGross: r.tipsGross,
                messagesGross: r.messagesGross,
                postsGross: r.postsGross,
                streamsGross: r.streamsGross,
                subscribersCount: r.subscribersCount,
                followingCount: r.followingCount,
                topPercentage: r.topPercentage,
                newSubs: r.newSubs,
            })),
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
