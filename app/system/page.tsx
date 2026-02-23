export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import {
  Database,
  DollarSign,
  Brain,
  Target,
  Activity,
  Shield,
  Zap,
  RefreshCw,
  Sparkles,
  ArrowRightLeft,
  User,
  Users,
  BarChart3,
  Heart,
  MessageSquare,
  FileText,
  Clock,
  Eye,
  Lock,
  Server,
  Layers,
} from "lucide-react";

// ---------- data fetching ----------

async function getSystemStats() {
  const [
    totalFans,
    totalTransactions,
    connectedCreators,
    aiClassifications,
    intentEvents,
    fanFacts,
    // table counts
    userCount,
    sessionCount,
    accountCount,
    creatorAssignmentCount,
    mediaAssetCount,
    fanPreferenceCount,
    fanLifecycleEventCount,
    chatQAReviewCount,
    verificationTokenCount,
  ] = await Promise.all([
    prisma.fan.count(),
    prisma.transaction.count(),
    prisma.creator.count({ where: { active: true } }),
    prisma.fanLifecycleEvent.count({ where: { type: "ai_classification" } }),
    prisma.fanIntentEvent.count(),
    prisma.fanFact.count(),
    // tables
    prisma.user.count(),
    prisma.session.count(),
    prisma.account.count(),
    prisma.creatorAssignment.count(),
    prisma.mediaAsset.count(),
    prisma.fanPreference.count(),
    prisma.fanLifecycleEvent.count(),
    prisma.chatQAReview.count(),
    prisma.verificationToken.count(),
  ]);

  return {
    totalFans,
    totalTransactions,
    connectedCreators,
    aiClassifications,
    intentEvents,
    fanFacts,
    tables: [
      { name: "Creator", purpose: "Connected OF accounts", count: connectedCreators },
      { name: "Fan", purpose: "Individual fan profiles + 55 intelligence fields", count: totalFans },
      { name: "Transaction", purpose: "Tips, PPV, subs, messages", count: totalTransactions },
      { name: "FanFact", purpose: "Structured long-term memory per fan", count: fanFacts },
      { name: "FanIntentEvent", purpose: "Buying intent signals from messages", count: intentEvents },
      { name: "FanPreference", purpose: "Content/format preference tags", count: fanPreferenceCount },
      { name: "FanLifecycleEvent", purpose: "Stage changes, milestones, follow-ups", count: fanLifecycleEventCount },
      { name: "ChatQAReview", purpose: "Chatter quality-assurance scores", count: chatQAReviewCount },
      { name: "MediaAsset", purpose: "Vault content metadata", count: mediaAssetCount },
      { name: "User", purpose: "Auth accounts (agency/cfo/employee)", count: userCount },
      { name: "CreatorAssignment", purpose: "Team-member to creator scoping", count: creatorAssignmentCount },
      { name: "Session", purpose: "Active login sessions", count: sessionCount },
      { name: "Account", purpose: "OAuth provider links", count: accountCount },
      { name: "VerificationToken", purpose: "Email verification tokens", count: verificationTokenCount },
    ],
  };
}

// ---------- sub-components ----------

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-white/50 text-xs font-semibold uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="text-3xl font-bold text-white tracking-tight">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function SectionHeading({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-xs font-bold text-teal-400/70 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
          {number}
        </span>
        <h2 className="text-xl font-bold text-white/90">{title}</h2>
      </div>
      {subtitle && (
        <p className="text-sm text-white/40 ml-11">{subtitle}</p>
      )}
    </div>
  );
}

function TrackingCategory({
  icon,
  title,
  items,
  accent = "teal",
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  accent?: string;
}) {
  const accentMap: Record<string, string> = {
    teal: "from-teal-500/20 to-teal-500/5 border-teal-500/20",
    purple: "from-purple-500/20 to-purple-500/5 border-purple-500/20",
    blue: "from-blue-500/20 to-blue-500/5 border-blue-500/20",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/20",
    rose: "from-rose-500/20 to-rose-500/5 border-rose-500/20",
    indigo: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/20",
  };
  const colors = accentMap[accent] || accentMap.teal;

  return (
    <div className={`glass-card rounded-2xl p-5 bg-gradient-to-br ${colors}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-white/5 border border-white/10">
          {icon}
        </div>
        <h3 className="font-semibold text-white/90 text-sm">{title}</h3>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="text-xs text-white/60 flex items-start gap-2"
          >
            <span className="text-white/20 mt-0.5">-</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataFlowCard({
  icon,
  title,
  timing,
  accentColor,
  events,
  updates,
}: {
  icon: React.ReactNode;
  title: string;
  timing: string;
  accentColor: string;
  events: string[];
  updates: string[];
}) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`p-2.5 rounded-xl border`}
          style={{
            borderColor: `${accentColor}33`,
            backgroundColor: `${accentColor}15`,
          }}
        >
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-white/90">{title}</h3>
          <p className="text-xs text-white/40 italic">{timing}</p>
        </div>
      </div>
      <div className="space-y-3 mt-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
            Events
          </div>
          <div className="flex flex-wrap gap-1.5">
            {events.map((e) => (
              <span
                key={e}
                className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/60 font-mono"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
            Updates
          </div>
          <div className="flex flex-wrap gap-1.5">
            {updates.map((u) => (
              <span
                key={u}
                className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/60"
              >
                {u}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- page ----------

export default async function SystemTrackingPage() {
  const stats = await getSystemStats();

  return (
    <div className="min-h-screen bg-[#050510] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <header className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20">
            <Database size={14} className="text-teal-400" />
            <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
              System Intelligence
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent mb-3">
            System Intelligence Overview
          </h1>
          <p className="text-lg text-white/40 max-w-xl mx-auto">
            What OF HQ tracks, how it learns, and what&apos;s next.
          </p>
        </header>

        {/* Section 1: Live System Stats */}
        <section className="mb-16">
          <SectionHeading
            number="01"
            title="Live System Stats"
            subtitle="Real-time counts from the database"
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Total Fans"
              value={stats.totalFans}
              icon={<Users size={14} />}
            />
            <StatCard
              label="Transactions"
              value={stats.totalTransactions}
              icon={<DollarSign size={14} />}
            />
            <StatCard
              label="Creators"
              value={stats.connectedCreators}
              icon={<Heart size={14} />}
            />
            <StatCard
              label="AI Classifications"
              value={stats.aiClassifications}
              icon={<Brain size={14} />}
            />
            <StatCard
              label="Intent Events"
              value={stats.intentEvents}
              icon={<Target size={14} />}
            />
            <StatCard
              label="Fan Facts"
              value={stats.fanFacts}
              icon={<FileText size={14} />}
            />
          </div>
        </section>

        {/* Section 2: What We Track Per Fan */}
        <section className="mb-16">
          <SectionHeading
            number="02"
            title="What We Track Per Fan"
            subtitle="55+ data points across 7 categories"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TrackingCategory
              icon={<DollarSign size={18} className="text-amber-400" />}
              title="Money & Purchases"
              accent="amber"
              items={[
                "Lifetime spend",
                "Last purchase date / time / type / amount",
                "Average order value",
                "Biggest single purchase",
                "First purchase date",
                "Price range (low / mid / high / whale)",
                "Buyer type (ppv_buyer, tipper, custom_buyer, etc.)",
                "Conversion rate (PPV sent vs bought)",
                "Discount sensitivity (never / sometimes / always)",
                "Chargeback risk flag",
              ]}
            />
            <TrackingCategory
              icon={<Brain size={18} className="text-purple-400" />}
              title="Fan Personality (AI-Detected)"
              accent="purple"
              items={[
                "Fan type (submissive / dominant / romantic / transactional / lonely)",
                "Tone preference (playful / assertive / romantic / direct)",
                "Emotional drivers (validation, companionship, escapism...)",
                "Emotional needs",
                "Content format preference (photo / video / audio / text / bundle)",
                "Length preference (short / medium / long)",
                "Narrative summary (rolling AI portrait)",
              ]}
            />
            <TrackingCategory
              icon={<User size={18} className="text-blue-400" />}
              title="Personal Facts"
              accent="blue"
              items={[
                "Hobbies",
                "Pet names",
                "Food & drink preferences",
                "Work schedule / occupation category",
                "Location / timezone / language",
                "Relationship status",
                "Body preferences",
                "Sports teams",
                "Birthday / sub anniversary",
              ]}
            />
            <TrackingCategory
              icon={<Target size={18} className="text-rose-400" />}
              title="Buying Intent (14 Signals)"
              accent="rose"
              items={[
                "ready_to_buy",
                "wants_custom",
                "price_question",
                "discount_request",
                "wants_more",
                "high_intent",
                "churn_risk",
                "escalation_intent",
                "trust_intent",
                "attention_intent",
                "status_intent",
                "emotional_support",
                "entertainment",
                "boundary_testing",
                "Each scored with confidence 0-100%",
              ]}
            />
            <TrackingCategory
              icon={
                <ArrowRightLeft size={18} className="text-indigo-400" />
              }
              title="Relationship Stage"
              accent="indigo"
              items={[
                "new  ->  warming  ->  active_buyer",
                "active_buyer  ->  cooling_off  ->  at_risk  ->  churned",
                "reactivated (loops back to active_buyer)",
                "Stage updated timestamp",
                "Stage auto-decay via cron job",
                "Last objection / top objection tracking",
              ]}
            />
            <TrackingCategory
              icon={<Activity size={18} className="text-teal-400" />}
              title="Engagement Signals"
              accent="teal"
              items={[
                "Temperature ring (HOT / WARM / COOLING / COLD / ICE COLD)",
                "Spend tier dot",
                "Last message time",
                "Active hours (JSON array of peak hours)",
                "Avg reply time (seconds)",
                "Time waster score (0-100)",
                "Follow-up due date",
                "Next best action + reason",
                "Deprioritize cooldown timer",
              ]}
            />
          </div>
        </section>

        {/* Section 3: How Data Flows In */}
        <section className="mb-16">
          <SectionHeading
            number="03"
            title="How Data Flows In"
            subtitle="Three ingestion methods keep intelligence fresh"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DataFlowCard
              icon={<Zap size={20} className="text-green-400" />}
              title="Real-Time Webhooks"
              timing="Instant - the second they buy"
              accentColor="#22c55e"
              events={[
                "subscriptions.new",
                "tips.received",
                "messages.ppv.unlocked",
                "transactions.new",
              ]}
              updates={[
                "Fan record",
                "Transaction record",
                "Telegram alert",
                "Temperature ring",
              ]}
            />
            <DataFlowCard
              icon={<RefreshCw size={20} className="text-blue-400" />}
              title="Periodic Sync"
              timing="Round-robin: 1 creator every 5 min ~ each synced every 45 min"
              accentColor="#3b82f6"
              events={[
                "fans (24h lookback)",
                "transactions (24h lookback)",
              ]}
              updates={[
                "lifetimeSpend",
                "avgOrderValue",
                "biggestPurchase",
                "buyerType",
                "priceRange",
              ]}
            />
            <DataFlowCard
              icon={<Sparkles size={20} className="text-purple-400" />}
              title="AI Classifier"
              timing="3-window analysis: first 100 msgs + around purchases + last 400 msgs"
              accentColor="#a855f7"
              events={[
                "fan type",
                "intent signals",
                "tone detection",
                "emotional drivers",
                "personal facts",
              ]}
              updates={[
                "GPT-4o-mini",
                "$0.0005 per classification",
                "Confidence scores",
                "Fan facts DB",
              ]}
            />
          </div>
        </section>

        {/* Section 4: Database Tables */}
        <section className="mb-16">
          <SectionHeading
            number="04"
            title="Database Tables"
            subtitle="Live row counts from every table in the system"
          />
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-5 text-xs font-bold uppercase tracking-wider text-white/40">
                      Table
                    </th>
                    <th className="text-left py-3 px-5 text-xs font-bold uppercase tracking-wider text-white/40">
                      Purpose
                    </th>
                    <th className="text-right py-3 px-5 text-xs font-bold uppercase tracking-wider text-white/40">
                      Live Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.tables.map((t, i) => (
                    <tr
                      key={t.name}
                      className={`border-b border-white/5 ${
                        i % 2 === 0 ? "bg-white/[0.02]" : ""
                      }`}
                    >
                      <td className="py-3 px-5 font-mono text-teal-400/80 font-medium">
                        {t.name}
                      </td>
                      <td className="py-3 px-5 text-white/50">
                        {t.purpose}
                      </td>
                      <td className="py-3 px-5 text-right font-mono text-white/80 font-semibold">
                        {t.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 5: What's NOT Built Yet */}
        <section className="mb-16">
          <SectionHeading
            number="05"
            title="What's NOT Built Yet"
            subtitle="Roadmap items in priority order"
          />
          <div className="glass-card rounded-2xl p-6">
            <ol className="space-y-3">
              {[
                "Auto-classify on every message (real-time AI pipeline)",
                'Vault content tagging (vision AI on images & videos)',
                '"Has he bought this?" indicator per fan per asset',
                "Matching layer (fan preferences <-> vault content)",
                "Segmented mass messages (audience builder + blast)",
                "Live revenue on dashboard (real-time websocket feed)",
                "Team / CFO / Settings pages (role-based views)",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                    <span className="text-xs font-mono text-white/30 w-4">
                      {i + 1}.
                    </span>
                  </div>
                  <span className="text-sm text-white/70">{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Section 6: Security */}
        <section className="mb-8">
          <SectionHeading
            number="06"
            title="Security"
            subtitle="How every entry point is protected"
          />
          <div className="glass-card rounded-2xl p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  icon: <Shield size={18} className="text-green-400" />,
                  title: "Webhooks",
                  detail: "HMAC-SHA256 signature verification on every payload",
                },
                {
                  icon: <Lock size={18} className="text-blue-400" />,
                  title: "Sync Endpoint",
                  detail: "x-sync-key header protection on all sync routes",
                },
                {
                  icon: <Clock size={18} className="text-amber-400" />,
                  title: "Cron Jobs",
                  detail: "CRON_SECRET bearer token validation",
                },
                {
                  icon: <Users size={18} className="text-purple-400" />,
                  title: "Role-Based Access",
                  detail: "AGENCY / CFO / EMPLOYEE permission tiers",
                },
                {
                  icon: <Eye size={18} className="text-rose-400" />,
                  title: "Creator Assignments",
                  detail: "Team-member scoping per creator account",
                },
                {
                  icon: <Server size={18} className="text-teal-400" />,
                  title: "Auth Layer",
                  detail: "NextAuth session + JWT with secure cookie handling",
                },
              ].map((sec) => (
                <div
                  key={sec.title}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                >
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    {sec.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white/80">
                      {sec.title}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {sec.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 border-t border-white/5">
          <p className="text-xs text-white/20">
            OF HQ System Intelligence &middot; Data refreshes on every page
            load
          </p>
        </footer>
      </div>
    </div>
  );
}
