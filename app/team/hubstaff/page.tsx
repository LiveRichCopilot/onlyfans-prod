"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, RefreshCw, Trash2, Plus, CheckCircle, XCircle, Link2 } from "lucide-react";

type MappedCreator = { creatorId: string; creatorName: string };
type HubstaffMember = { hubstaffUserId: string; name: string; email: string; status: string; mappedCreators: MappedCreator[] };
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
  const [showUpdateToken, setShowUpdateToken] = useState(false);
  const [updateToken, setUpdateToken] = useState("");
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);

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
      setMembersError(memData.error || null);
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

  async function handleUpdateToken() {
    if (!updateToken.trim() || !config?.organizationId) return;
    setUpdateStatus("Exchanging token...");
    try {
      const res = await fetch("/api/hubstaff/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: updateToken.trim(), organizationId: config.organizationId }),
      });
      if (res.ok) {
        setUpdateStatus("Token updated! Refreshing...");
        setUpdateToken("");
        setShowUpdateToken(false);
        load();
      } else {
        const data = await res.json();
        setUpdateStatus(`Failed: ${data.error}`);
      }
    } catch (e: any) {
      setUpdateStatus(`Error: ${e.message}`);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/hubstaff/sync-now", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`Synced! Online: ${data.onlineUsers || 0}, Clocked in: ${data.clockedIn || 0}, Activity updated: ${data.activityUpdated || 0}`);
        load();
      } else {
        setSyncResult(`Sync failed: ${data.error}`);
      }
    } catch (e: any) {
      setSyncResult(`Error: ${e.message}`);
    }
    setSyncing(false);
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

  const totalMappings = mappings.length;
  const mappedMembers = members.filter(m => m.mappedCreators.length > 0).length;

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
              onChange={e => setSetupToken(e.target.value.replace(/[\s\n\r]+/g, ""))}
              onPaste={e => {
                e.preventDefault();
                const pasted = e.clipboardData.getData("text").replace(/[\s\n\r]+/g, "");
                setSetupToken(pasted);
              }}
              placeholder="Paste your Hubstaff refresh token here..."
              rows={3}
              className="w-full glass-inset rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm resize-none font-mono break-all"
            />
            <button onClick={handleSetup} className="glass-prominent rounded-xl px-6 py-2.5 text-white font-medium text-sm">
              Connect Hubstaff
            </button>
          </div>
        </div>
      )}

      {/* Status Card */}
      {config?.configured && (
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-teal-400" />
              <span className="text-white font-medium">Connected</span>
              <span className="text-white/60 text-sm">Org: {config.organizationId}</span>
            </div>
            <div className="text-xs text-white/60">
              Last sync: {config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "Never"}
            </div>
          </div>

          {config.tokenExpiresAt && (
            <div className="text-xs text-white/40">
              Token expires: {new Date(config.tokenExpiresAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}
              {new Date(config.tokenExpiresAt) < new Date() && (
                <span className="text-red-400 font-semibold ml-2">EXPIRED</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="glass-button rounded-xl px-4 py-2 text-sm text-teal-400 font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
            <button
              onClick={() => setShowUpdateToken(!showUpdateToken)}
              className="glass-button rounded-xl px-4 py-2 text-sm text-white/60 font-medium"
            >
              Update Token
            </button>
          </div>

          {syncResult && (
            <div className={`text-xs px-3 py-2 rounded-lg ${syncResult.startsWith("Synced") ? "bg-teal-500/10 text-teal-400" : "bg-red-500/10 text-red-400"}`}>
              {syncResult}
            </div>
          )}

          {showUpdateToken && (
            <div className="space-y-3 border-t border-white/5 pt-4">
              <p className="text-white/60 text-sm font-medium">Paste new Hubstaff refresh token:</p>
              <textarea
                value={updateToken}
                onChange={e => setUpdateToken(e.target.value.replace(/[\s\n\r]+/g, ""))}
                onPaste={e => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text").replace(/[\s\n\r]+/g, "");
                  setUpdateToken(pasted);
                }}
                placeholder="eyJ0eXAiOiJKV1Qi..."
                rows={3}
                className="w-full glass-inset rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm resize-none font-mono break-all"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleUpdateToken}
                  disabled={!updateToken.trim()}
                  className="glass-prominent rounded-xl px-6 py-2.5 text-white font-medium text-sm disabled:opacity-30"
                >
                  Update Token
                </button>
                <button
                  onClick={() => { setShowUpdateToken(false); setUpdateStatus(null); }}
                  className="text-white/40 text-sm hover:text-white/60"
                >
                  Cancel
                </button>
              </div>
              {updateStatus && (
                <div className={`text-xs px-3 py-2 rounded-lg ${updateStatus.includes("updated") ? "bg-teal-500/10 text-teal-400" : updateStatus.includes("Failed") || updateStatus.includes("Error") ? "bg-red-500/10 text-red-400" : "bg-white/5 text-white/50"}`}>
                  {updateStatus}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Current Mappings */}
      {totalMappings > 0 && (
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users size={18} className="text-teal-400" /> Active Mappings ({totalMappings})
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

      {/* All Hubstaff Members — map to multiple creators */}
      {config?.configured && (
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Plus size={18} className="text-white/60" /> Hubstaff Members
            {members.length > 0 && (
              <span className="text-white/40 text-sm font-normal ml-1">
                ({mappedMembers}/{members.length} mapped)
              </span>
            )}
          </h2>
          {membersError && (
            <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400">
              Failed to load members: {membersError}
            </div>
          )}
          <div className="space-y-2">
            {members.map(m => (
              <MemberRow key={m.hubstaffUserId} member={m} creators={creators} onMap={addMapping} />
            ))}
            {members.length === 0 && !membersError && (
              <p className="text-white/40 text-sm">No members found in Hubstaff org</p>
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
  const [selectedCreator, setSelectedCreator] = useState("");

  // Filter out creators already mapped to this member
  const mappedIds = new Set(member.mappedCreators.map(mc => mc.creatorId));
  const availableCreators = creators.filter(c => !mappedIds.has(c.id));

  function handleMap() {
    if (!email || !selectedCreator) return;
    onMap(member.hubstaffUserId, member.name, email, selectedCreator);
    setSelectedCreator("");
  }

  return (
    <div className="glass-inset rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-white text-sm font-medium min-w-[140px]">{member.name}</span>

        {/* Existing mapped creators as badges */}
        {member.mappedCreators.map(mc => (
          <span
            key={mc.creatorId}
            className="text-[10px] bg-teal-500/15 text-teal-400 px-2 py-0.5 rounded-full border border-teal-500/20"
          >
            {mc.creatorName}
          </span>
        ))}

        {/* Add more mapping controls */}
        <div className="flex items-center gap-2 ml-auto">
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="chatter@email.com"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm w-[180px] placeholder-white/25"
          />
          <select
            value={selectedCreator}
            onChange={e => setSelectedCreator(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm max-w-[180px]"
          >
            <option value="">+ Add model...</option>
            {availableCreators.map(c => (
              <option key={c.id} value={c.id} className="bg-neutral-900">{c.name || c.id}</option>
            ))}
          </select>
          <button
            onClick={handleMap}
            disabled={!email || !selectedCreator}
            className="glass-button rounded-lg px-3 py-1.5 text-sm text-teal-400 disabled:opacity-30"
          >
            Map
          </button>
        </div>
      </div>
    </div>
  );
}
