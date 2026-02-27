import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { seedAllModules } from "@/lib/modules";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { role, orgName } = body as { role: string; orgName?: string };

  if (!role || !["AGENCY", "CREATOR"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Find or create Prisma user
  let prismaUser = await prisma.user.findUnique({
    where: { email: user.email },
  });

  if (!prismaUser) {
    prismaUser = await prisma.user.create({
      data: {
        email: user.email,
        name: user.user_metadata?.full_name || user.email.split("@")[0],
      },
    });
  }

  if (role === "AGENCY") {
    const name = orgName || `${prismaUser.name}'s Agency`;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Create org + member + modules in a transaction
    const org = await prisma.organization.create({
      data: {
        name,
        slug: `${slug}-${prismaUser.id.slice(0, 6)}`,
      },
    });

    await prisma.orgMember.create({
      data: {
        userId: prismaUser.id,
        organizationId: org.id,
        role: "OWNER",
        roleTemplate: "owner",
      },
    });

    await prisma.user.update({
      where: { id: prismaUser.id },
      data: { role: "AGENCY", organizationId: org.id },
    });

    await seedAllModules(org.id);

    return NextResponse.json({ redirect: "/", orgId: org.id });
  }

  // CREATOR flow
  const name = `${prismaUser.name}'s Studio`;
  const slug = `creator-${prismaUser.id.slice(0, 8)}`;

  const org = await prisma.organization.create({
    data: { name, slug },
  });

  await prisma.orgMember.create({
    data: {
      userId: prismaUser.id,
      organizationId: org.id,
      role: "OWNER",
      roleTemplate: "owner",
    },
  });

  await prisma.user.update({
    where: { id: prismaUser.id },
    data: { role: "CREATOR", organizationId: org.id },
  });

  await seedAllModules(org.id);

  return NextResponse.json({ redirect: "/creator", orgId: org.id });
}
