import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/health
// Liveness probe for the Render health check. Deliberately DB-free: the
// health check must not depend on the database being reachable.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}