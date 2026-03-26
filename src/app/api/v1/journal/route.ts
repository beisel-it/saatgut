import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { createJournalEntry, listJournalEntries } from "@/lib/server/journal-service";
import { serializeJournalEntry } from "@/lib/server/serializers";
import { journalEntryCreateSchema, journalQuerySchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.READ });
    const url = new URL(request.url);
    const query = journalQuerySchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      varietyId: url.searchParams.get("varietyId") ?? undefined,
      seedBatchId: url.searchParams.get("seedBatchId") ?? undefined,
      entryType: url.searchParams.get("entryType") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
    });

    const entries = await listJournalEntries(auth, query);
    return NextResponse.json({ items: entries.map(serializeJournalEntry) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = journalEntryCreateSchema.parse(await readJson(request));
    const entry = await createJournalEntry(auth, payload);
    return NextResponse.json(serializeJournalEntry(entry), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
