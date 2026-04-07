import { redirect } from "next/navigation";
import { getSoraAuthSafe, listAllModels } from "@/lib/sora-access";
import { ContentPlan } from "@/components/sora/ContentPlan";

export const dynamic = "force-dynamic";

export default async function SoraPage() {
  const ctx = await getSoraAuthSafe();
  if (!ctx) {
    redirect("/login?next=/sora");
  }

  const models = await listAllModels();

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
