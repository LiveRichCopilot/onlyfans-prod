import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { isSoraAllowed, listModelsForUser } from "@/lib/sora-access";
import { ContentPlan } from "@/components/sora/ContentPlan";

export const dynamic = "force-dynamic";

export default async function SoraPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || null;
  const role = (session?.user as any)?.role || null;
  const userId = (session?.user as any)?.id || null;

  if (!email) {
    redirect("/api/auth/signin");
  }

  if (!isSoraAllowed({ email, role })) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="glass-panel rounded-3xl p-10 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-3">Sora</h1>
          <p className="text-white/60">This page is private. Ask Sora to add your email if you need access.</p>
        </div>
      </main>
    );
  }

  const models = await listModelsForUser({ email, role, userId });

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Sora</h1>
          <p className="text-white/50 text-sm mt-1">Content Plan — last 14 days of paid masses, per model.</p>
        </div>
        <ContentPlan models={models} />
      </div>
    </main>
  );
}
