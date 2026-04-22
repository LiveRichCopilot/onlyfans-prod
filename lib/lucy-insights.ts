import { prisma } from "./prisma";
import decemberData from "./data/lucy-december.json";

export type RevenueRow = { type: string; count: number; revenue: number };
export type ThemeRow = {
  key: string;
  label: string;
  fanMentions: number;
  salesAfter: number;
};
export type WinMessage = {
  text: string;
  fromCreator: boolean;
  time: string;
  price?: number;
};
export type Win = {
  fanNumber: number;
  amount: number;
  type: string;
  date: string;
  source: string;
  chatter: string;
  messages: WinMessage[];
};
export type VoiceFingerprint = {
  totalMessages: number;
  avgCharLength: number;
  avgWordLength: number;
  lowercaseOnlyPct: number;
  trailingDotsPct: number;
  emojiMessagesPct: number;
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
  window: string;
  revenue: {
    total: number;
    count: number;
    byType: RevenueRow[];
  };
  themes: ThemeRow[];
  wins: Win[];
  voice: VoiceFingerprint;
};

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

  const data = decemberData as {
    window: string;
    revenue: { total: number; count: number; byType: RevenueRow[] };
    themes: ThemeRow[];
    wins: Win[];
    voice: VoiceFingerprint;
  };

  return {
    creator: {
      id: lucy.id,
      name: lucy.name,
      username: lucy.ofUsername,
      avatarUrl: lucy.avatarUrl,
      headerUrl: lucy.headerUrl,
    },
    window: data.window,
    revenue: data.revenue,
    themes: data.themes,
    wins: data.wins,
    voice: data.voice,
  };
}
