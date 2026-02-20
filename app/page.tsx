"use client";

import {
  Home,
  LayoutGrid,
  Settings,
  MessageSquare,
  BarChart,
  Users,
  Activity,
  AlertCircle,
  CheckCircle2,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
// @ts-ignore: Next relies on Vercel install
import { startOnlyFansAuthentication } from "@onlyfansapi/auth";

export default function AgencyDashboard() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newTelegramId, setNewTelegramId] = useState("");
  const [newTelegramGroupId, setNewTelegramGroupId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthenticatingId, setIsAuthenticatingId] = useState<string | null>(null);

  const [creators, setCreators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/creators")
      .then(res => res.json())
      .then(data => {
        setCreators(data.creators || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch creators", err);
        setLoading(false);
      });
  }, []);

  const modules = [
    { id: 'NOT-01', title: "Whale Alert", desc: "Push notification when fan crosses tip threshold.", active: true },
    { id: 'STF-01', title: "Chatter Monitor", desc: "Alerts when hourly revenue drops below target.", active: true },
    { id: 'INT-03', title: "AI Chat Assist", desc: "Suggested responses powered by Claude API.", active: false },
  ];

  return (
    <div className="flex min-h-screen text-white/90 overflow-hidden relative">
      {/* Apple Glass Main Sidebar */}
      <aside className="w-72 glass-panel m-4 rounded-3xl p-6 hidden md:flex flex-col z-10 border-gray-800">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-600 to-gray-700 flex items-center justify-center font-bold text-lg shadow-lg shadow-teal-900/50">
            OF
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-white/90">HQ</div>
            <div className="text-xs text-white/50">Agency Workspace</div>
          </div>
        </div>

        <nav className="space-y-8 flex-1">
          <div>
            <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 px-2">Creators</div>
            <ul className="space-y-2">
              {creators.map(c => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/10 transition cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs border border-white/20">
                        {c.name ? c.name.charAt(0) : '?'}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-black ${c.active ? 'bg-teal-500' : 'bg-gray-500'}`} />
                    </div>
                    <span className="text-sm font-medium text-white/80 group-hover:text-white">{c.name || 'Unknown'}</span>
                  </div>
                </li>
              ))}
              {creators.length === 0 && !loading && (
                <li className="px-3 py-2 text-xs text-white/40 italic">No accounts linked</li>
              )}
              <li className="mt-2 text-center">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="text-xs text-teal-400 font-medium hover:text-teal-300 transition"
                >
                  + Add Account
                </button>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 px-2">Management</div>
            <ul className="space-y-1">
              <li className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/10 text-white shadow-sm border border-white/10"><LayoutGrid size={16} /> Dashboard</li>
              <li className="flex items-center gap-3 px-3 py-2.5 text-white/60 hover:text-white transition rounded-xl hover:bg-white/5"><Activity size={16} /> Real-time Feed</li>
              <li className="flex items-center gap-3 px-3 py-2.5 text-white/60 hover:text-white transition rounded-xl hover:bg-white/5"><Users size={16} /> Team & Chatters</li>
            </ul>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 md:pl-4 overflow-y-auto z-10 h-screen no-scrollbar relative">

        <header className="flex justify-between items-center mb-8 glass-panel p-6 rounded-3xl sticky top-0 z-20 border-white/10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white/95 mb-1">Agency Overview</h1>
            <p className="text-sm text-white/60 font-medium">Monitoring {creators.length} creators globally.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="glass-button px-5 py-2.5 font-medium rounded-xl text-sm flex items-center gap-2 text-teal-400 border border-teal-500/30 md:hidden"
            >
              + Add
            </button>
            <button className="glass-button px-5 py-2.5 font-medium rounded-xl text-sm flex items-center gap-2 text-white">
              <Settings size={16} />
              <span className="hidden md:inline">Settings</span>
            </button>
          </div>
        </header>

        {/* Chatter Performance Row */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white/80 mb-4 px-2">Live Chatter Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {creators.map((c) => {
              const isUnderperforming = c.active && c.hourlyRev < c.target;
              return (
                <div key={c.id} className="glass-panel p-5 rounded-3xl border-t border-t-white/20 border-l border-l-white/10 relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-white font-medium">{c.name || 'Unknown'}</div>
                      <div className="text-xs text-white/50 mb-3">{c.ofapiCreatorId || c.telegramId}</div>
                    </div>

                    <div className="flex gap-2 items-center">
                      {!c.ofapiToken || c.ofapiToken === "unlinked" ? (
                        <button
                          onClick={async () => {
                            setIsAuthenticatingId(c.id);
                            try {
                              const sessionRes = await fetch("/api/client-session", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ displayName: c.name || "Agency Pipeline" }),
                              });
                              const { token } = await sessionRes.json();

                              startOnlyFansAuthentication(token, {
                                theme: {
                                  brandName: "HQ Security",
                                },
                                onSuccess: async (data: any) => {
                                  await fetch("/api/accounts", {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      id: c.id,
                                      ofapiToken: "linked_via_auth_module"
                                    }),
                                  });
                                  setIsAuthenticatingId(null);
                                  window.location.reload();
                                },
                                onError: (error: any) => {
                                  console.error("Auth failed:", error);
                                  setIsAuthenticatingId(null);
                                }
                              });
                            } catch (err) {
                              console.error("Session fetch failed", err);
                              setIsAuthenticatingId(null);
                            }
                          }}
                          disabled={isAuthenticatingId === c.id}
                          className="glass-button px-3 py-1.5 rounded-xl text-xs font-medium text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 flex items-center gap-2"
                        >
                          {isAuthenticatingId === c.id ? "Connecting..." : "Connect OF"}
                        </button>
                      ) : (
                        <div className="glass-button p-2 rounded-xl">
                          {isUnderperforming ? (
                            <AlertCircle size={20} className="text-red-400" />
                          ) : c.active ? (
                            <CheckCircle2 size={20} className="text-teal-400" />
                          ) : (
                            <Activity size={20} className="text-white/30" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-baseline space-x-2">
                    <span className={`text-3xl font-bold tracking-tighter ${isUnderperforming ? 'text-red-400' : 'text-white'}`}>
                      ${c.hourlyRev}
                    </span>
                    <span className="text-sm text-white/40">/ hr</span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex justify-between text-xs text-white/60 mb-2">
                      <span>Target: ${c.target}/hr</span>
                      <span>{c.active ? 'Active' : 'Offline'}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mb-4">
                      <div
                        className={`h-full rounded-full ${isUnderperforming ? 'bg-red-500' : 'bg-teal-500'}`}
                        style={{ width: `${Math.min(((c.hourlyRev || 0) / (c.target || 100)) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="pt-2 border-t border-white/10 border-dashed">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Hourly Revenue Target</label>
                        <span className="text-xs text-teal-400 font-medium">${c.hourlyTarget || 100}/hr</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="500"
                        step="10"
                        defaultValue={c.hourlyTarget || 100}
                        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-teal-500 mb-4"
                      />

                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Daily Whale Alert Threshold</label>
                        <span className="text-xs text-teal-600 font-medium">${c.whaleAlertTarget || 200}/day</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1000"
                        step="50"
                        defaultValue={c.whaleAlertTarget || 200}
                        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-teal-600"
                      />
                    </div>
                  </div>
                </div>
              )
            })}

            {creators.length === 0 && !loading && (
              <div className="glass-panel p-8 rounded-3xl border-t border-t-white/20 border-l border-l-white/10 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <AlertCircle size={32} className="text-teal-500/50" />
                </div>
                <h3 className="text-xl font-medium text-white/90 mb-2">No Accounts Linked</h3>
                <p className="text-sm text-white/50 max-w-xs">Connect your OnlyFans account using the Add Account button in the sidebar to view your chatter performance.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modules Row */}
        <div>
          <h2 className="text-lg font-semibold text-white/80 mb-4 px-2">Global Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
            {modules.map((mod) => (
              <div
                key={mod.id}
                className={`p-6 rounded-3xl backdrop-blur-3xl border-t border-t-white/20 border-l border-l-white/10 flex flex-col justify-between transition-all duration-500
                    ${mod.active
                    ? 'bg-gradient-to-br from-white/10 to-white/5 shadow-2xl shadow-blue-500/10'
                    : 'bg-black/20 border border-white/5 opacity-70'}`}
              >
                <div>
                  <div className="flex justify-between items-center mb-5">
                    <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-lg bg-white/10 text-white/90 shadow-inner">
                      {mod.id}
                    </span>
                    <div className={`h-2.5 w-2.5 rounded-full ${mod.active ? 'bg-teal-400 shadow-md shadow-teal-500/80' : 'bg-white/20'}`} />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-white mb-2">{mod.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed font-medium">
                    {mod.desc}
                  </p>
                </div>
                <button className={`mt-6 w-full py-2.5 rounded-xl text-sm font-semibold transition active:scale-95
                    ${mod.active ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10' : 'bg-white text-black hover:bg-white/90'}`}>
                  {mod.active ? 'Configure' : 'Enable API'}
                </button>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-panel p-6 rounded-3xl border-white/20 w-full max-w-md bg-gray-900/90 relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-white mb-2">Add Creator Account</h2>
            <p className="text-sm text-white/60 mb-6">
              Register a new OnlyFans account to your agency. You can route their specific alerts to a custom Telegram Group.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1 block">
                  OnlyFans Username
                </label>
                <input
                  type="text"
                  placeholder="e.g. liverichmedia"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1 block">
                  Creator Telegram ID (Personal DM)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123456789"
                  value={newTelegramId}
                  onChange={(e) => setNewTelegramId(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 mb-4"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1 block">
                  Alert Group ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. -100987654321"
                  value={newTelegramGroupId}
                  onChange={(e) => setNewTelegramGroupId(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                />
                <p className="text-[10px] text-white/40 mt-1">If set, chatter performance alerts for this model will route exclusively to this group instead of the global agency feed.</p>
              </div>
            </div>

            <button
              disabled={isSubmitting || !newUsername || !newTelegramId}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await fetch("/api/accounts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      accountId: newTelegramId,
                      username: newUsername,
                      telegramGroupId: newTelegramGroupId || undefined
                    }),
                  });
                  window.location.reload();
                } catch (e) {
                  console.error(e);
                  setIsSubmitting(false);
                }
              }}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add Creator"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
