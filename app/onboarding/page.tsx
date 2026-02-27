"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building, UserCircle } from "lucide-react";

export default function Onboarding() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"AGENCY" | "CREATOR" | null>(
    null
  );
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedRole) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: selectedRole,
        orgName: selectedRole === "AGENCY" ? orgName || undefined : undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    router.push(data.redirect || "/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-white">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/30 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/30 rounded-full blur-[120px]" />

      <div className="glass-panel p-10 rounded-3xl z-10 w-full max-w-2xl border-white/10 mx-4">
        <h1 className="text-4xl font-bold mb-2 tracking-tight text-center">
          Welcome to OF HQ
        </h1>
        <p className="text-center text-white/60 mb-10">
          How are you planning to use the platform?
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div
            onClick={() => setSelectedRole("AGENCY")}
            className={`cursor-pointer p-6 rounded-2xl glass-panel border transition-all duration-300 flex flex-col items-center justify-center gap-4 group
              ${selectedRole === "AGENCY" ? "border-blue-500 bg-white/10 shadow-lg shadow-blue-500/30" : "border-white/5 hover:border-white/20"}`}
          >
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <Building size={32} />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold mb-1">I run an Agency</h3>
              <p className="text-sm text-white/50">
                Manage creators, monitor chatters, view analytics and reports.
              </p>
            </div>
          </div>

          <div
            onClick={() => setSelectedRole("CREATOR")}
            className={`cursor-pointer p-6 rounded-2xl glass-panel border transition-all duration-300 flex flex-col items-center justify-center gap-4 group
              ${selectedRole === "CREATOR" ? "border-purple-500 bg-white/10 shadow-lg shadow-purple-500/30" : "border-white/5 hover:border-white/20"}`}
          >
            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <UserCircle size={32} />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold mb-1">I'm a Creator</h3>
              <p className="text-sm text-white/50">
                Connect your OnlyFans, view your stats, and manage content.
              </p>
            </div>
          </div>
        </div>

        {selectedRole === "AGENCY" && (
          <div className="mb-6">
            <input
              type="text"
              placeholder="Agency name (e.g. LiveRich Agency)"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm text-center mb-4">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedRole || loading}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300
            ${selectedRole ? "bg-white text-black hover:bg-white/90" : "bg-white/10 text-white/30 cursor-not-allowed"}
            ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {loading ? "Setting up..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
