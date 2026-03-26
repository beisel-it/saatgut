import { NextResponse } from "next/server";
import { getAppHealth } from "@/lib/health";

export function GET() {
  return NextResponse.json(getAppHealth());
}
