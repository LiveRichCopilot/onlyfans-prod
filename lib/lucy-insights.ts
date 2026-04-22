import { prisma } from "./prisma";

export type Stats = {
  saleCount: number;
  revenue: number;
  avgSale: number;
  uniqueFans: number;
  dateStart: Date | null;
  dateEnd: Date | null;
};

export type PhraseRow = {
  text: string;
  avgRevenue: number;
  occurrences: number;
  totalRevenue: number;
};

export type SaleTypeRow = {
  type: string;
  count: number;
  revenue: number;
  pctOfRevenue: number;
};

export type WinMessage = {
  text: string;
  isFromCreator: boolean;
  sentAt: Date;
  price: number;
  isTip: boolean;
  tipAmount: number;
};

export type Win = {
  fanNumber: number;
  amount: number;
  type: string;
  date: Date;
  messages: WinMessage[];
};

export type EmojiRow = { emoji: string; count: number; pctOfMessages: number };

export type ThemeRow = {
  key: string;
  label: string;
  description: string;
  fanMentions: number;
  salesLeadUps: number;
  revenue: number;
};

export type VoiceFingerprint = {
  totalMessages: number;
  avgCharLength: number;
  avgWordLength: number;
  lowercaseOnlyPct: number;
  trailingDotsPct: number;
  emojiMidSentencePct: number;
  medianReplySec: number | null;
  topEmojis: EmojiRow[];
  openers: Array<{ text: string; count: number }>;
  signOffs: Array<{ text: string; count: number }>;
};

export type LucyReport = {
  creator: {
    id: string;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
    headerUrl: string | null;
  };
  stats: Stats;
  fanPhrases: PhraseRow[];
  lucyPhrases: PhraseRow[];
  saleTypes: SaleTypeRow[];
  themes: ThemeRow[];
  wins: Win[];
  voice: VoiceFingerprint;
};

const THEMES: Array<{ key: string; label: string; description: string; patterns: RegExp[] }> = [
  {
    key: "anal",
    label: "Anal",
    description: "Anal content and anal creampies",
    patterns: [/\banal\b/i, /\bass(fuck|play|fucking)\b/i],
  },
  {
    key: "dp",
    label: "DP",
    description: "Double penetration",
    patterns: [/\bdp\b/i, /double.?pen/i],
  },
  {
    key: "squirt",
    label: "Squirting",
    description: "Squirting scenes",
    patterns: [/squirt/i],
  },
  {
    key: "bbc",
    label: "BBC",
    description: "BBC scenes",
    patterns: [/\bbbc\b/i],
  },
  {
    key: "breeding",
    label: "Breeding / creampie",
    description: "Breeding and creampie",
    patterns: [/breed/i, /creampie/i, /cream.?pie/i],
  },
  {
    key: "bondage",
    label: "Bondage / BDSM",
    description: "Bondage, rope, BDSM",
    patterns: [/bondage/i, /\btied\b/i, /\brope\b/i, /\bbdsm\b/i],
  },
  {
    key: "custom",
    label: "Customs",
    description: "Custom video requests",
    patterns: [/\bcustom\b/i],
  },
  {
    key: "solo",
    label: "Solo / masturbation",
    description: "Solo play",
    patterns: [/\bsolo\b/i, /masturbat/i, /fingering/i, /fingered/i],
  },
  {
    key: "gg",
    label: "Girl / girl",
    description: "Girl on girl",
    patterns: [/\bg.?g\b/i, /girl.{0,4}girl/i, /lesbian/i],
  },
  {
    key: "feet",
    label: "Feet",
    description: "Feet content",
    patterns: [/\bfeet\b/i, /\bfoot\b/i, /\btoes\b/i],
  },
  {
    key: "cumshot",
    label: "Cumshot / facial",
    description: "Cumshots and facials",
    patterns: [/cumshot/i, /facial/i, /\bcum on\b/i],
  },
  {
    key: "dom",
    label: "Dom / daddy",
    description: "Dom and daddy dynamic",
    patterns: [/\bdaddy\b/i, /\bdom\b/i, /\bsir\b/i],
  },
  {
    key: "live",
    label: "Live / sext",
    description: "Live sexting",
    patterns: [/\blive\b/i, /\bsext/i],
  },
  {
    key: "renew",
    label: "Sub renewal",
    description: "Subscription renewals",
    patterns: [/renew/i, /rebill/i, /resub/i],
  },
];

const SALE_MIN = 25;
const CONTEXT_MESSAGES = 15;
const TOP_WINS = 50;
const TOP_PHRASES = 15;
const MIN_PHRASE_OCCURRENCES = 2;
const MIN_PHRASE_CHARS = 2;
const START_DATE = new Date("2025-12-01T00:00:00Z");
const END_DATE = new Date("2026-01-01T00:00:00Z");

// Extended pictographic + some common emoji-related codepoints
const EMOJI_RE = /\p{Extended_Pictographic}/gu;

function htmlToText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(text: string | null | undefined): string {
  return htmlToText(text).toLowerCase();
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function findLucy() {
  return prisma.creator.findFirst({
    where: { ofUsername: { contains: "lucy", mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, ofUsername: true, avatarUrl: true, headerUrl: true },
  });
}

export async function buildLucyReport(): Promise<LucyReport | null> {
  const lucy = await findLucy();
  if (!lucy) return null;

  const sales = await prisma.transaction.findMany({
    where: {
      creatorId: lucy.id,
      amount: { gte: SALE_MIN },
      date: { gte: START_DATE, lt: END_DATE },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      amount: true,
      type: true,
      date: true,
      fanId: true,
      fan: { select: { ofapiFanId: true } },
    },
  });

  const allMessages = await prisma.rawChatMessage.findMany({
    where: { creatorId: lucy.id, sentAt: { gte: START_DATE, lt: END_DATE } },
    orderBy: { sentAt: "asc" },
    select: {
      chatId: true,
      text: true,
      isFromCreator: true,
      sentAt: true,
      price: true,
      isTip: true,
      tipAmount: true,
    },
  });

  const byChat = new Map<string, typeof allMessages>();
  for (const m of allMessages) {
    const arr = byChat.get(m.chatId) ?? [];
    arr.push(m);
    byChat.set(m.chatId, arr);
  }

  // Assign stable Fan #N numbers in first-seen order across the *wins* (newest-first)
  const fanNumberMap = new Map<string, number>();
  let nextFanNum = 1;
  const getFanNum = (chatId: string) => {
    const existing = fanNumberMap.get(chatId);
    if (existing) return existing;
    const n = nextFanNum++;
    fanNumberMap.set(chatId, n);
    return n;
  };

  // Build lead-ups + phrase aggregates
  const fanPhraseAgg = new Map<string, { total: number; count: number }>();
  const lucyPhraseAgg = new Map<string, { total: number; count: number }>();
  const wins: Win[] = [];
  const typeAgg = new Map<string, { count: number; revenue: number }>();

  for (const sale of sales) {
    const type = sale.type || "unknown";
    const tr = typeAgg.get(type) ?? { count: 0, revenue: 0 };
    tr.count++;
    tr.revenue += sale.amount;
    typeAgg.set(type, tr);

    const chatId = sale.fan.ofapiFanId;
    const chatMessages = byChat.get(chatId);
    if (!chatMessages) continue;

    // Last N messages before sale
    const cutoffIdx = chatMessages.findIndex((m) => m.sentAt > sale.date);
    const endIdx = cutoffIdx === -1 ? chatMessages.length : cutoffIdx;
    const contextSlice = chatMessages.slice(Math.max(0, endIdx - CONTEXT_MESSAGES), endIdx);

    for (const msg of contextSlice) {
      const norm = normalize(msg.text);
      if (norm.length < MIN_PHRASE_CHARS) continue;
      const agg = msg.isFromCreator ? lucyPhraseAgg : fanPhraseAgg;
      const entry = agg.get(norm) ?? { total: 0, count: 0 };
      entry.total += sale.amount;
      entry.count += 1;
      agg.set(norm, entry);
    }

    if (wins.length < TOP_WINS) {
      wins.push({
        fanNumber: getFanNum(chatId),
        amount: sale.amount,
        type,
        date: sale.date,
        messages: contextSlice.map((m) => ({
          text: htmlToText(m.text ?? ""),
          isFromCreator: m.isFromCreator,
          sentAt: m.sentAt,
          price: m.price,
          isTip: m.isTip,
          tipAmount: m.tipAmount,
        })),
      });
    }
  }

  const toPhraseRows = (m: Map<string, { total: number; count: number }>): PhraseRow[] =>
    Array.from(m.entries())
      .filter(([, v]) => v.count >= MIN_PHRASE_OCCURRENCES)
      .map(([text, v]) => ({
        text,
        avgRevenue: v.total / v.count,
        occurrences: v.count,
        totalRevenue: v.total,
      }))
      .sort((a, b) => b.avgRevenue - a.avgRevenue)
      .slice(0, TOP_PHRASES);

  const fanPhrases = toPhraseRows(fanPhraseAgg);
  const lucyPhrases = toPhraseRows(lucyPhraseAgg);

  const totalRev = sales.reduce((s, x) => s + x.amount, 0);
  const saleTypes: SaleTypeRow[] = Array.from(typeAgg.entries())
    .map(([type, v]) => ({
      type,
      count: v.count,
      revenue: v.revenue,
      pctOfRevenue: totalRev > 0 ? (v.revenue / totalRev) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const stats: Stats = {
    saleCount: sales.length,
    revenue: totalRev,
    avgSale: sales.length > 0 ? totalRev / sales.length : 0,
    uniqueFans: new Set(sales.map((s) => s.fanId)).size,
    dateStart: sales.length > 0 ? sales[sales.length - 1].date : null,
    dateEnd: sales.length > 0 ? sales[0].date : null,
  };

  const voice = buildVoiceFingerprint(allMessages);
  const themes = buildThemes(allMessages, sales, byChat);

  return {
    creator: {
      id: lucy.id,
      name: lucy.name,
      username: lucy.ofUsername,
      avatarUrl: lucy.avatarUrl,
      headerUrl: lucy.headerUrl,
    },
    stats,
    fanPhrases,
    lucyPhrases,
    saleTypes,
    themes,
    wins,
    voice,
  };
}

function buildThemes(
  allMessages: Msg[],
  sales: Array<{ amount: number; date: Date; fan: { ofapiFanId: string } }>,
  byChat: Map<string, Array<{ sentAt: Date; text: string | null; isFromCreator: boolean }>>,
): ThemeRow[] {
  const fanMsgTexts = allMessages
    .filter((m) => !m.isFromCreator && m.text)
    .map((m) => htmlToText(m.text ?? ""));

  const fanMentionCount = new Map<string, number>();
  for (const text of fanMsgTexts) {
    for (const theme of THEMES) {
      if (theme.patterns.some((r) => r.test(text))) {
        fanMentionCount.set(theme.key, (fanMentionCount.get(theme.key) ?? 0) + 1);
      }
    }
  }

  const salesAttr = new Map<string, { count: number; revenue: number }>();
  for (const sale of sales) {
    const chatMessages = byChat.get(sale.fan.ofapiFanId);
    if (!chatMessages) continue;
    const cutoffIdx = chatMessages.findIndex((m) => m.sentAt > sale.date);
    const endIdx = cutoffIdx === -1 ? chatMessages.length : cutoffIdx;
    const leadUp = chatMessages
      .slice(Math.max(0, endIdx - CONTEXT_MESSAGES), endIdx)
      .filter((m) => !m.isFromCreator);
    const combined = leadUp.map((m) => htmlToText(m.text ?? "")).join(" ");
    for (const theme of THEMES) {
      if (theme.patterns.some((r) => r.test(combined))) {
        const entry = salesAttr.get(theme.key) ?? { count: 0, revenue: 0 };
        entry.count += 1;
        entry.revenue += sale.amount;
        salesAttr.set(theme.key, entry);
      }
    }
  }

  return THEMES.map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    fanMentions: fanMentionCount.get(t.key) ?? 0,
    salesLeadUps: salesAttr.get(t.key)?.count ?? 0,
    revenue: salesAttr.get(t.key)?.revenue ?? 0,
  }))
    .filter((t) => t.fanMentions > 0 || t.salesLeadUps > 0)
    .sort((a, b) => b.revenue - a.revenue || b.fanMentions - a.fanMentions);
}

type Msg = {
  chatId: string;
  text: string | null;
  isFromCreator: boolean;
  sentAt: Date;
};

function buildVoiceFingerprint(all: Msg[]): VoiceFingerprint {
  const lucy = all.filter((m) => m.isFromCreator && m.text && m.text.trim().length > 0);
  const total = lucy.length;

  if (total === 0) {
    return {
      totalMessages: 0,
      avgCharLength: 0,
      avgWordLength: 0,
      lowercaseOnlyPct: 0,
      trailingDotsPct: 0,
      emojiMidSentencePct: 0,
      medianReplySec: null,
      topEmojis: [],
      openers: [],
      signOffs: [],
    };
  }

  let charSum = 0;
  let wordSum = 0;
  let lowercaseOnly = 0;
  let trailingDots = 0;
  let emojiMid = 0;
  const emojiCount = new Map<string, number>();
  const emojiMessageCount = new Map<string, number>(); // messages containing this emoji

  for (const m of lucy) {
    const t = m.text!;
    charSum += t.length;
    wordSum += wordCount(t);
    const hasLetters = /[a-z]/i.test(t);
    if (hasLetters && t === t.toLowerCase()) lowercaseOnly++;
    if (/\.\.+\s*$/.test(t)) trailingDots++;

    const emojis = t.match(EMOJI_RE) ?? [];
    const lastEmoji = emojis[emojis.length - 1];
    const firstEmoji = emojis[0];
    if (lastEmoji && firstEmoji) {
      const lastEmojiIdx = t.lastIndexOf(lastEmoji);
      const firstEmojiIdx = t.indexOf(firstEmoji);
      const stripped = t.replace(/\s+$/, "");
      if (lastEmojiIdx < stripped.length - 2 || firstEmojiIdx > 0) emojiMid++;
    }

    const seen = new Set<string>();
    for (const e of emojis) {
      emojiCount.set(e, (emojiCount.get(e) ?? 0) + 1);
      if (!seen.has(e)) {
        emojiMessageCount.set(e, (emojiMessageCount.get(e) ?? 0) + 1);
        seen.add(e);
      }
    }
  }

  const topEmojis: EmojiRow[] = Array.from(emojiCount.entries())
    .map(([emoji, count]) => ({
      emoji,
      count,
      pctOfMessages: ((emojiMessageCount.get(emoji) ?? 0) / total) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Openers / sign-offs: per-chat first and last Lucy msg
  const byChat = new Map<string, Msg[]>();
  for (const m of lucy) {
    const arr = byChat.get(m.chatId) ?? [];
    arr.push(m);
    byChat.set(m.chatId, arr);
  }
  const openerCounts = new Map<string, number>();
  const signOffCounts = new Map<string, number>();
  for (const [, msgs] of byChat) {
    if (msgs.length === 0) continue;
    const first = normalize(msgs[0].text);
    const last = normalize(msgs[msgs.length - 1].text);
    if (first.length >= MIN_PHRASE_CHARS) {
      openerCounts.set(first, (openerCounts.get(first) ?? 0) + 1);
    }
    if (last.length >= MIN_PHRASE_CHARS) {
      signOffCounts.set(last, (signOffCounts.get(last) ?? 0) + 1);
    }
  }
  const mapToTop = (m: Map<string, number>, n: number) =>
    Array.from(m.entries())
      .filter(([, c]) => c >= 2)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);

  // Response cadence: sort ALL messages by chat + time, find Lucy-after-fan pairs
  const allByChat = new Map<string, Msg[]>();
  for (const m of all) {
    const arr = allByChat.get(m.chatId) ?? [];
    arr.push(m);
    allByChat.set(m.chatId, arr);
  }
  const gaps: number[] = [];
  for (const [, msgs] of allByChat) {
    for (let i = 1; i < msgs.length; i++) {
      const prev = msgs[i - 1];
      const cur = msgs[i];
      if (!prev.isFromCreator && cur.isFromCreator) {
        const dt = (cur.sentAt.getTime() - prev.sentAt.getTime()) / 1000;
        if (dt >= 0 && dt < 24 * 3600) gaps.push(dt);
      }
    }
  }
  gaps.sort((a, b) => a - b);
  const medianReplySec = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : null;

  return {
    totalMessages: total,
    avgCharLength: charSum / total,
    avgWordLength: wordSum / total,
    lowercaseOnlyPct: (lowercaseOnly / total) * 100,
    trailingDotsPct: (trailingDots / total) * 100,
    emojiMidSentencePct: (emojiMid / total) * 100,
    medianReplySec,
    topEmojis,
    openers: mapToTop(openerCounts, 10),
    signOffs: mapToTop(signOffCounts, 10),
  };
}
