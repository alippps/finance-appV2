import { NextResponse } from "next/server";
import {
  createSessionToken,
  hashPassword,
  isHashedPassword,
  sessionCookieName,
  sessionMaxAgeSeconds,
  verifyPassword
} from "@/lib/auth";
import { getPrisma } from "@/lib/db";

type FinanceUserRow = {
  id: number;
  username: string | null;
  password: string | null;
};

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const username = String(payload?.username || "").trim();
  const password = String(payload?.password || "");

  if (!username || !password) {
    return NextResponse.json({ message: "Username dan password wajib diisi." }, { status: 400 });
  }

  let user: FinanceUserRow | null = null;
  try {
    const prisma = await getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "DATABASE_URL belum disetel." }, { status: 503 });
    }

    const users = await prisma.$queryRaw<FinanceUserRow[]>`
      SELECT id_user as id, ussername as username, password
      FROM finance
      WHERE ussername = ${username}
      LIMIT 1
    `;
    user = users[0] || null;

    if (user?.password && verifyPassword(user.password, password) && !isHashedPassword(user.password)) {
      const hashedPassword = hashPassword(password);
      await prisma.$executeRaw`
        UPDATE finance
        SET password = ${hashedPassword}
        WHERE id_user = ${user.id}
      `;
      user = { ...user, password: hashedPassword };
    }
  } catch (error) {
    console.error("Login database error:", error);
    return NextResponse.json({ message: "Koneksi database gagal. Cek DATABASE_URL di file .env." }, { status: 503 });
  }

  if (!user?.username || !user.password || !verifyPassword(user.password, password)) {
    return NextResponse.json({ message: "Username atau password salah." }, { status: 401 });
  }

  const publicUser = {
    id: user.id,
    username: user.username
  };
  const response = NextResponse.json({
    user: {
      id: publicUser.id,
      username: publicUser.username
    }
  });
  response.cookies.set(sessionCookieName, createSessionToken(publicUser), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds
  });

  return response;
}
