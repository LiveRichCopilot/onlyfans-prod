"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccessMsg("Check your email for a confirmation link.");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        router.push(next);
        router.refresh();
      }
    }

    setLoading(false);
  };

  return (
    <div className="glass-panel p-10 rounded-3xl z-10 w-full max-w-md border-white/10 mx-4">
      <h1 className="text-3xl font-bold mb-2 tracking-tight text-center">
        OF HQ
      </h1>
      <p className="text-center text-white/50 mb-8">
        {mode === "signin" ? "Sign in to your account" : "Create your account"}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50 transition-colors"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50 transition-colors"
        />

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
        {successMsg && (
          <p className="text-teal-400 text-sm text-center">{successMsg}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-lg bg-teal-500 hover:bg-teal-400 text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? "..."
            : mode === "signin"
              ? "Sign In"
              : "Create Account"}
        </button>
      </form>

      <p className="text-center text-white/40 text-sm mt-6">
        {mode === "signin" ? (
          <>
            No account?{" "}
            <button
              onClick={() => { setMode("signup"); setError(null); setSuccessMsg(null); }}
              className="text-teal-400 hover:text-teal-300 underline"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              onClick={() => { setMode("signin"); setError(null); setSuccessMsg(null); }}
              className="text-teal-400 hover:text-teal-300 underline"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
