import { NextResponse } from "next/server";
import { createSessionToken, hashPassword, sessionCookieName, sessionMaxAgeSeconds } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

type FinanceUserRow = {
  id: number;
  username: string | null;
};

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const username = String(payload?.username || "").trim();
  const password = String(payload?.password || "");

  if (!username || !password) {
    return NextResponse.json({ message: "Username dan password wajib diisi." }, { status: 400 });
  }

  if (username.length > 120) {
    return NextResponse.json({ message: "Username maksimal 120 karakter." }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return NextResponse.json({ message: "Username hanya boleh huruf, angka, titik, underscore, atau strip." }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ message: "Password minimal 6 karakter." }, { status: 400 });
  }

  try {
    const prisma = await getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "DATABASE_URL belum disetel." }, { status: 503 });
    }

    const existingUsers = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id_user as id
      FROM finance
      WHERE ussername = ${username}
      LIMIT 1
    `;

    if (existingUsers.length > 0) {
      return NextResponse.json({ message: "Username sudah dipakai." }, { status: 409 });
    }

    const users = await prisma.$queryRaw<FinanceUserRow[]>`
      INSERT INTO finance (ussername, password)
      VALUES (${username}, ${hashPassword(password)})
      RETURNING id_user as id, ussername as username
    `;
    const user = users[0];

    const publicUser = {
      id: user.id,
      username: user.username || username
    };
    const response = NextResponse.json(
      {
        user: {
          id: publicUser.id,
          username: publicUser.username
        }
      },
      { status: 201 }
    );
    response.cookies.set(sessionCookieName, createSessionToken(publicUser), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: sessionMaxAgeSeconds
    });

    return response;
  } catch (error) {
    console.error("Register database error:", error);
    return NextResponse.json({ message: "Gagal membuat akun. Cek koneksi database." }, { status: 503 });
  }
}
