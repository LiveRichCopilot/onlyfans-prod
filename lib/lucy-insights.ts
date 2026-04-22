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
  creator: { id: string; name: string | null; username: string | null };
  stats: Stats;
  fanPhrases: PhraseRow[];
  lucyPhrases: PhraseRow[];
  saleTypes: SaleTypeRow[];
  wins: Win[];
  voice: VoiceFingerprint;
};

const SALE_MIN = 25;
const CONTEXT_MESSAGES = 15;
const TOP_WINS = 50;
const TOP_PHRASES = 15;
const MIN_PHRASE_OCCURRENCES = 2;
const MIN_PHRASE_CHARS = 2;

// Extended pictographic + some common emoji-related codepoints
const EMOJI_RE = /\p{Extended_Pictographic}/gu;

function normalize(text: string | null | undefined): string {
  if (!text) return "";
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function findLucy() {
  return prisma.creator.findFirst({
    where: {
      OR: [
        { ofUsername: { contains: "lucy", mode: "insensitive" } },
        { name: { contains: "lucy", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, ofUsername: true },
  });
}

export async function buildLucyReport(): Promise<LucyReport | null> {
  const lucy = await findLucy();
  if (!lucy) return null;

  // Pull sales ≥ $25
  const sales = await prisma.transaction.findMany({
    where: { creatorId: lucy.id, amount: { gte: SALE_MIN } },
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

  // Pull all of Lucy's messages once, index by chatId
  const allMessages = await prisma.rawChatMessage.findMany({
    where: { creatorId: lucy.id },
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
          text: m.text ?? "",
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

  return {
    creator: { id: lucy.id, name: lucy.name, username: lucy.ofUsername },
    stats,
    fanPhrases,
    lucyPhrases,
    saleTypes,
    wins,
    voice,
  };
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
