import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export type SessionUser = {
  id: number;
  username: string;
};

type SessionPayload = SessionUser & {
  exp: number;
};

export const sessionCookieName = "financeos_session";
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

const passwordPrefix = "scrypt";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `${passwordPrefix}:${salt}:${hash}`;
}

export function verifyPassword(savedPassword: string, incomingPassword: string) {
  const [scheme, salt, savedHash] = savedPassword.split(":");

  if (scheme !== passwordPrefix || !salt || !savedHash) {
    return savedPassword === incomingPassword;
  }

  const incomingHash = scryptSync(incomingPassword, salt, 64).toString("base64url");
  return safeEqual(savedHash, incomingHash);
}

export function isHashedPassword(password: string) {
  return password.startsWith(`${passwordPrefix}:`);
}

export function createSessionToken(user: SessionUser) {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !safeEqual(sign(encodedPayload), signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.id || !payload.username || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { id: payload.id, username: payload.username };
  } catch {
    return null;
  }
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET wajib disetel di production.");
  }

  return "financeos-dev-secret-change-me";
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
