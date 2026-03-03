import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearAliasCache, normalizeEmail } from "@/lib/resolve-chatter-email";

export const dynamic = "force-dynamic";

/** GET — list all aliases */
export async function GET() {
  try {
    const aliases = await prisma.chatterAlias.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ aliases });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST — create alias(es). Body: { aliases: [{ aliasEmail, canonicalEmail, name? }] } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { aliases } = body as {
      aliases: { aliasEmail: string; canonicalEmail: string; name?: string }[];
    };

    if (!aliases || !Array.isArray(aliases) || aliases.length === 0) {
      return NextResponse.json({ error: "aliases array required" }, { status: 400 });
    }

    const results = [];
    for (const a of aliases) {
      const alias = normalizeEmail(a.aliasEmail);
      const canonical = normalizeEmail(a.canonicalEmail);

      if (!alias || !canonical) {
        results.push({ aliasEmail: alias, status: "skipped", reason: "empty email" });
        continue;
      }
      if (alias === canonical) {
        results.push({ aliasEmail: alias, status: "skipped", reason: "alias equals canonical" });
        continue;
      }

      // Upsert — update canonical if alias already exists
      const record = await prisma.chatterAlias.upsert({
        where: { aliasEmail: alias },
        update: { canonicalEmail: canonical, name: a.name || undefined },
        create: { aliasEmail: alias, canonicalEmail: canonical, name: a.name || undefined },
      });
      results.push({ aliasEmail: alias, canonicalEmail: canonical, status: "created", id: record.id });
    }

    clearAliasCache();
    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE — remove alias by id or aliasEmail. Query: ?id=X or ?email=X */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const email = req.nextUrl.searchParams.get("email");

    if (id) {
      await prisma.chatterAlias.delete({ where: { id } });
    } else if (email) {
      await prisma.chatterAlias.delete({ where: { aliasEmail: normalizeEmail(email) } });
    } else {
      return NextResponse.json({ error: "id or email required" }, { status: 400 });
    }

    clearAliasCache();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
