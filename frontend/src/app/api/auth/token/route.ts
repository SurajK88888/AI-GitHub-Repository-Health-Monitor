/**
 * GET /api/auth/token
 *
 * Server-side route handler that issues a standard RFC 7519 HS256 JWT
 * for the FastAPI backend. Decodes the NextAuth session server-side
 * and signs a token with NEXTAUTH_SECRET that PyJWT validates.
 */

import { auth } from "@/lib/auth";
import crypto from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const secret =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "aZ9kQ7mX2vH3pR8tYcL4wN6sDf1GhJ5T";

  const email =
    session.user.email ||
    `${(session.user.name || "user").toLowerCase().replace(/\s+/g, "")}@users.noreply.github.com`;
  const sub = session.user.email || session.user.name || "github-user";

  const s = session as typeof session & {
    login?: string;
    githubId?: number;
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      login?: string;
      githubId?: number;
    };
  };

  const login =
    s.login ||
    s.user?.login ||
    (session.user.name ? session.user.name.toLowerCase().replace(/\s+/g, "") : null);
  const githubId = s.githubId || s.user?.githubId || null;

  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub,
    email,
    name: session.user.name || "User",
    picture: session.user.image || null,
    login,
    github_id: githubId,
    iat: now,
    exp: now + 30 * 24 * 60 * 60, // 30 days
  };

  const b64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const encHeader = b64url(header);
  const encPayload = b64url(payload);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encHeader}.${encPayload}`)
    .digest("base64url");

  const token = `${encHeader}.${encPayload}.${signature}`;

  return NextResponse.json({ token });
}
