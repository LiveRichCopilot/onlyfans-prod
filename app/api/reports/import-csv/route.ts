import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min for large CSVs

/**
 * POST /api/reports/import-csv
 *
 * Imports historical spreadsheet data (HistoricalSalesUTC0) into CreatorDailyReport.
 * Accepts multipart form data with a CSV file.
 *
 * Expected CSV columns (matching Jay's spreadsheet exactly):
 *   Date UTC+0, Creator, Subscription Gross, New subscriptions Gross,
 *   Recurring subscriptions Gross, Tips Gross, Total earnings Gross,
 *   Contribution %, OF ranking, Following, Fans with renew on,
 *   Renew on %, New fans, Active fans, Change in expired fan count,
 *   Posts Gross, Message Gross, Streams Gross, Refund Gross,
 *   Creator group, Avg spend per spender Gross, Avg spend per transaction Gross,
 *   Avg earnings per fan Gross, Avg subscription length,
 *   Date, Day, Week, Month, Year
 *
 * Usage: POST with form-data, field "file" = CSV file
 *        Optional query: ?dry_run=true (just parse, don't write)
 */

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ",") {
                result.push(current.trim());
                current = "";
            } else {
                current += ch;
            }
        }
    }
    result.push(current.trim());
    return result;
}

function num(v: string): number {
    if (!v) return 0;
    // Remove $, %, commas, whitespace
    const cleaned = v.replace(/[$%,\s]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
}

export async function POST(req: NextRequest) {
    try {
        const dryRun = req.nextUrl.searchParams.get("dry_run") === "true";

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
            return NextResponse.json({ error: "No file uploaded. Use form field 'file'." }, { status: 400 });
        }

        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
            return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
        }

        // Parse header row to find column indices
        const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
        const col = (name: string) => {
            const idx = headers.findIndex((h) => h.includes(name.toLowerCase()));
            return idx;
        };

        const iDate = col("date utc");
        const iCreator = col("creator");
        const iSubsGross = headers.findIndex((h) => h === "subscription gross" || h.startsWith("subscription gross"));
        const iNewSubsGross = col("new subscriptions");
        const iRecurSubsGross = col("recurring subscriptions");
        const iTipsGross = col("tips gross");
        const iTotalGross = col("total earnings");
        const iContrib = col("contribution");
        const iOfRank = col("of ranking");
        const iFollowing = col("following");
        const iRenewOn = headers.findIndex((h) => h === "fans with renew on" || h.startsWith("fans with renew"));
        const iRenewPct = col("renew on %");
        const iNewFans = col("new fans");
        const iActiveFans = col("active fans");
        const iExpired = col("change in expired");
        const iPostsGross = col("posts gross");
        const iMsgGross = col("message gross");
        const iStreamsGross = col("streams gross");
        const iRefundGross = col("refund gross");
        const iGroup = col("creator group");
        const iAvgSpender = col("avg spend per spender");
        const iAvgTx = col("avg spend per transaction");
        const iAvgFan = col("avg earnings per fan");
        const iAvgSubLen = col("avg subscription length");

        if (iDate < 0 || iCreator < 0) {
            return NextResponse.json({
                error: "Could not find 'Date UTC+0' and 'Creator' columns in CSV header",
                headers,
            }, { status: 400 });
        }

        // Load all creators for name matching
        const allCreators = await prisma.creator.findMany({
            select: { id: true, name: true, ofUsername: true, group: true },
        });

        // Strip emojis, special chars, extra spaces for fuzzy matching
        const clean = (s: string) => s
            .replace(/[\u{1F000}-\u{1FFFF}]/gu, "") // emojis
            .replace(/[\u{2600}-\u{27BF}]/gu, "")   // misc symbols
            .replace(/[\u{FE00}-\u{FE0F}]/gu, "")   // variation selectors
            .replace(/[\u{200D}]/gu, "")             // zero-width joiner
            .replace(/[^\w\s]/g, "")                 // non-word chars
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

        // Build multiple lookup maps for fuzzy matching
        const creatorByExact = new Map<string, typeof allCreators[0]>();
        const creatorByClean = new Map<string, typeof allCreators[0]>();
        const creatorByFirstWord = new Map<string, typeof allCreators[0]>();
        const creatorByUsername = new Map<string, typeof allCreators[0]>();
        const allCreatorClean: { creator: typeof allCreators[0]; cleaned: string }[] = [];

        for (const c of allCreators) {
            if (c.name) {
                creatorByExact.set(c.name.toLowerCase().trim(), c);
                const cleaned = clean(c.name);
                creatorByClean.set(cleaned, c);
                allCreatorClean.push({ creator: c, cleaned });
                // First word of cleaned name (e.g. "katelyn" from "KATELYN 😜 #1 FITNESS...")
                const firstWord = cleaned.split(" ")[0];
                if (firstWord && firstWord.length >= 3) {
                    creatorByFirstWord.set(firstWord, c);
                }
            }
            if (c.ofUsername) {
                creatorByUsername.set(c.ofUsername.toLowerCase().trim(), c);
                creatorByClean.set(clean(c.ofUsername), c);
            }
        }

        // Fuzzy match: tries exact → cleaned → username → first-word → substring
        const matchCreator = (csvName: string) => {
            const lower = csvName.toLowerCase().trim();
            const cleaned = clean(csvName);
            // Remove common suffixes like "Free", "VIP", "OFTV", "Paid" for base matching
            const baseName = cleaned.replace(/\b(free|vip|oftv|paid)\b/gi, "").trim();

            // 1. Exact match on name or username
            if (creatorByExact.has(lower)) return creatorByExact.get(lower)!;
            if (creatorByUsername.has(lower)) return creatorByUsername.get(lower)!;

            // 2. Cleaned match
            if (creatorByClean.has(cleaned)) return creatorByClean.get(cleaned)!;
            if (creatorByClean.has(baseName)) return creatorByClean.get(baseName)!;

            // 3. CSV name contained in DB name or vice versa
            for (const { creator, cleaned: dbCleaned } of allCreatorClean) {
                if (baseName && dbCleaned.includes(baseName)) return creator;
                if (baseName && baseName.includes(dbCleaned) && dbCleaned.length >= 3) return creator;
            }

            // 4. First word match (for single-name creators like "Rebecca", "Dolly", "Katelyn")
            const firstWord = baseName.split(" ")[0];
            if (firstWord && firstWord.length >= 4 && creatorByFirstWord.has(firstWord)) {
                return creatorByFirstWord.get(firstWord)!;
            }

            return null;
        };

        let imported = 0;
        let skipped = 0;
        let errors: string[] = [];
        const unmatchedCreators = new Set<string>();

        // Process data rows
        for (let i = 1; i < lines.length; i++) {
            const vals = parseCSVLine(lines[i]);
            if (vals.length < 5) continue; // skip empty/malformed rows

            const dateStr = vals[iDate];
            const creatorName = vals[iCreator]?.trim();

            if (!dateStr || !creatorName) {
                skipped++;
                continue;
            }

            // Match creator (fuzzy)
            const creator = matchCreator(creatorName);
            if (!creator) {
                unmatchedCreators.add(creatorName);
                skipped++;
                continue;
            }

            // Parse date (YYYY-MM-DD or MM/DD/YYYY or DD/MM/YYYY)
            let reportDate: Date;
            if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
                reportDate = new Date(dateStr.slice(0, 10) + "T00:00:00.000Z");
            } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) {
                const parts = dateStr.split("/");
                // Assume MM/DD/YYYY (US format)
                reportDate = new Date(`${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}T00:00:00.000Z`);
            } else {
                errors.push(`Row ${i + 1}: unparseable date "${dateStr}"`);
                skipped++;
                continue;
            }

            if (isNaN(reportDate.getTime())) {
                errors.push(`Row ${i + 1}: invalid date "${dateStr}"`);
                skipped++;
                continue;
            }

            // Update creator group if present in CSV and not already set
            const csvGroup = iGroup >= 0 ? vals[iGroup]?.trim() : "";
            if (csvGroup && !creator.group) {
                if (!dryRun) {
                    await prisma.creator.update({
                        where: { id: creator.id },
                        data: { group: csvGroup },
                    });
                }
            }

            const v = (idx: number) => idx >= 0 ? num(vals[idx] || "") : 0;

            const totalGross = v(iTotalGross);
            const subsGross = v(iSubsGross);
            const subscribersCount = v(iActiveFans) || v(iFollowing); // best guess for subs

            const reportData = {
                totalGross,
                totalNet: null as number | null,
                subsGross,
                newSubsGross: v(iNewSubsGross),
                recurringSubsGross: v(iRecurSubsGross),
                tipsGross: v(iTipsGross),
                messagesGross: v(iMsgGross),
                postsGross: v(iPostsGross),
                streamsGross: v(iStreamsGross),
                refundGross: v(iRefundGross),
                subscribersCount: Math.round(v(iActiveFans) || v(iFollowing)),
                followingCount: Math.round(v(iFollowing)),
                topPercentage: v(iOfRank) || null,
                newSubs: Math.round(v(iNewFans)),
                activeFans: Math.round(v(iActiveFans)),
                fansRenewOn: Math.round(v(iRenewOn)),
                expiredFanChange: Math.round(v(iExpired)),
                avgSpendPerSpender: v(iAvgSpender),
                avgSpendPerTransaction: v(iAvgTx),
                avgEarningsPerFan: v(iAvgFan),
                avgSubLength: v(iAvgSubLen),
            };

            if (!dryRun) {
                try {
                    await prisma.creatorDailyReport.upsert({
                        where: {
                            creatorId_date: {
                                creatorId: creator.id,
                                date: reportDate,
                            },
                        },
                        create: { creatorId: creator.id, date: reportDate, ...reportData },
                        update: reportData,
                    });
                    imported++;
                } catch (e: any) {
                    errors.push(`Row ${i + 1} (${creatorName} ${dateStr}): ${e.message}`);
                    skipped++;
                }
            } else {
                imported++;
            }
        }

        return NextResponse.json({
            success: true,
            dryRun,
            totalRows: lines.length - 1,
            imported,
            skipped,
            unmatchedCreators: Array.from(unmatchedCreators),
            errors: errors.slice(0, 50), // Cap error list
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
