import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function RequireOnboarding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const prismaUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { organizationId: true, role: true },
  });

  if (!prismaUser || !prismaUser.organizationId || prismaUser.role === "UNASSIGNED") {
    redirect("/onboarding");
  }

  return null;
}
