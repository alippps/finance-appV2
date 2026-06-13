import { NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

type FinanceUserRow = {
  id: number;
  username: string | null;
};

export async function GET(request: Request) {
  const userFromToken = verifySessionToken(readCookie(request, sessionCookieName));
  if (!userFromToken) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const prisma = await getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "DATABASE_URL belum disetel." }, { status: 503 });
    }

    const users = await prisma.$queryRaw<FinanceUserRow[]>`
      SELECT id_user as id, ussername as username
      FROM finance
      WHERE id_user = ${userFromToken.id}
      LIMIT 1
    `;
    const user = users[0] || null;

    if (!user?.username) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error("Session database error:", error);
    return NextResponse.json({ message: "Koneksi database gagal. Cek DATABASE_URL di file .env." }, { status: 503 });
  }
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
