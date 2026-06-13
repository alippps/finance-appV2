import { NextResponse } from "next/server";
import { initialFinanceState } from "@/lib/mock-data";
import { getPrisma } from "@/lib/db";

let memoryState = initialFinanceState;

export async function GET() {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json(memoryState);

  // Database mapping is intentionally isolated here. Once the PostgreSQL
  // connection from DBeaver is ready, this route can read real records.
  return NextResponse.json(memoryState);
}

export async function POST(request: Request) {
  const payload = await request.json();
  memoryState = payload;

  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json(memoryState);

  // Write-through to PostgreSQL will live here after the final table policy is
  // confirmed. For now the frontend can exercise the sync action safely.
  return NextResponse.json(memoryState);
}
