"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, RefreshCw, Trash2, Plus, CheckCircle, XCircle, Link2 } from "lucide-react";

type HubstaffMember = { hubstaffUserId: string; name: string; email: string; status: string; isMapped: boolean };
type Mapping = { id: string; hubstaffUserId: string; hubstaffName: string | null; chatterEmail: string; creatorId: string | null; creator?: { name: string | null } | null };
type Config = { configured: boolean; organizationId?: string; syncEnabled?: boolean; lastSyncAt?: string; tokenExpiresAt?: string };
type Creator = { id: string; name: string | null };

export default function HubstaffAdmin() {
  const [config, setConfig] = useState<Config | null>(null);
  const [members, setMembers] = useState<HubstaffMember[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupToken, setSetupToken] = useState("");
  const [setupOrg, setSetupOrg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [cfgRes, mapRes, creatorsRes] = await Promise.all([
      fetch("/api/hubstaff/setup"),
      fetch("/api/hubstaff/mapping"),
      fetch("/api/creators"),
    ]);
    const cfgData = await cfgRes.json();
    const mapData = await mapRes.json();
    setConfig(cfgData);
    setMappings(mapData.mappings || []);

    try {
      const creatorsData = await creatorsRes.json();
      setCreators(creatorsData.creators || creatorsData || []);
    } catch { /* ignore */ }

    if (cfgData.configured) {
      const memRes = await fetch("/api/hubstaff/members");
      const memData = await memRes.json();
      setMembers(memData.members || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSetup() {
    const res = await fetch("/api/hubstaff/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: setupToken, organizationId: setupOrg }),
    });
    if (res.ok) load();
  }

  async function addMapping(hubstaffUserId: string, hubstaffName: string, chatterEmail: string, creatorId: string) {
    await fetch("/api/hubstaff/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hubstaffUserId, hubstaffName, chatterEmail, creatorId }),
    });
    load();
  }

  async function removeMapping(id: string) {
    await fetch("/api/hubstaff/mapping", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  if (loading) return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center">
      <RefreshCw className="w-6 h-6 text-teal-400 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050508] p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-600 to-blue-700 flex items-center justify-center">
          <Link2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Hubstaff Integration</h1>
          <p className="text-white/50 text-sm">Auto-sync chatter clock-in from Hubstaff</p>
        </div>
      </header>

      {/* Setup Section */}
      {!config?.configured && (
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <XCircle size={18} className="text-amber-400" /> Setup Required
          </h2>
          <div className="space-y-3">
            <input
              value={setupOrg}
              onChange={e => setSetupOrg(e.target.value)}
              placeholder="Organization ID (e.g. 517938)"
              className="w-full glass-inset rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm"
            />
            <textarea
              value={setupToken}
              onChange={e => setSetupToken(e.target.value)}
              placeholder="Paste your Hubstaff refresh token here..."
              rows={3}
              className="w-full glass-inset rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm resize-none"
            />
            <button onClick={handleSetup} className="glass-prominent rounded-xl px-6 py-2.5 text-white font-medium text-sm">
              Connect Hubstaff
            </button>
          </div>
        </div>
      )}

      {/* Status Card */}
      {config?.configured && (
        <div className="glass-card rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-teal-400" />
              <span className="text-white font-medium">Connected</span>
              <span className="text-white/40 text-sm">Org: {config.organizationId}</span>
            </div>
            <div className="text-xs text-white/40">
              Last sync: {config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "Never"}
            </div>
          </div>
        </div>
      )}

      {/* Current Mappings */}
      {mappings.length > 0 && (
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users size={18} className="text-teal-400" /> Active Mappings ({mappings.length})
          </h2>
          <div className="space-y-2">
            {mappings.map(m => (
              <div key={m.id} className="flex items-center justify-between glass-inset rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-medium">{m.hubstaffName || m.hubstaffUserId}</span>
                  <span className="text-white/30">&rarr;</span>
                  <span className="text-teal-400 text-sm">{m.chatterEmail}</span>
                  {m.creator?.name && (
                    <>
                      <span className="text-white/30">&rarr;</span>
                      <span className="text-amber-400 text-sm">{m.creator.name}</span>
                    </>
                  )}
                  {!m.creatorId && (
                    <span className="text-red-400/60 text-xs bg-red-500/10 px-2 py-0.5 rounded-full">No model assigned</span>
                  )}
                </div>
                <button onClick={() => removeMapping(m.id)} className="text-red-400/60 hover:text-red-400 transition shrink-0 ml-2">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unmapped Hubstaff Members */}
      {config?.configured && (
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Plus size={18} className="text-white/60" /> Hubstaff Members
          </h2>
          <div className="space-y-2">
            {members.filter(m => !m.isMapped).map(m => (
              <MemberRow key={m.hubstaffUserId} member={m} creators={creators} onMap={addMapping} />
            ))}
            {members.filter(m => !m.isMapped).length === 0 && (
              <p className="text-white/40 text-sm">All members are mapped</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, creators, onMap }: {
  member: HubstaffMember;
  creators: Creator[];
  onMap: (userId: string, name: string, email: string, creatorId: string) => void;
}) {
  const [email, setEmail] = useState(member.email || "");
  const [selectedCreator, setSelectedCreator] = useState(creators[0]?.id || "");

  return (
    <div className="flex items-center gap-3 glass-inset rounded-xl px-4 py-3 flex-wrap">
      <span className="text-white text-sm font-medium min-w-[120px]">{member.name}</span>
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="chatter@email.com"
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm flex-1 min-w-[160px] placeholder-white/25"
      />
      <select
        value={selectedCreator}
        onChange={e => setSelectedCreator(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm max-w-[180px]"
      >
        <option value="">Select model...</option>
        {creators.map(c => <option key={c.id} value={c.id} className="bg-neutral-900">{c.name || c.id}</option>)}
      </select>
      <button
        onClick={() => email && selectedCreator && onMap(member.hubstaffUserId, member.name, email, selectedCreator)}
        disabled={!email || !selectedCreator}
        className="glass-button rounded-lg px-3 py-1.5 text-sm text-teal-400 disabled:opacity-30"
      >
        Map
      </button>
    </div>
  );
}
