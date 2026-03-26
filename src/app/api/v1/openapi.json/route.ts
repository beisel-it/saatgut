import { NextResponse } from "next/server";

import { getOpenApiDocument } from "@/lib/server/openapi";

export function GET() {
  return NextResponse.json(getOpenApiDocument());
}
