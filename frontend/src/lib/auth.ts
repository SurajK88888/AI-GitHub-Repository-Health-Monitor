/**
 * NextAuth.js v5 configuration.
 *
 * Providers:
 *   - GitHub OAuth (for connecting to GitHub App)
 *
 * The backend FastAPI API validates JWTs issued here.
 * Never put server-side secrets in client components.
 */

/*
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist GitHub access token and profile info in JWT
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      if (profile) {
        token.login = (profile as { login?: string }).login;
        token.githubId = (profile as { id?: number }).id;
      }
      return token;
    },
    async session({ session, token }) {
      const s = session as typeof session & {
        accessToken?: string;
        login?: string;
        githubId?: number;
      };
      s.accessToken = typeof token.accessToken === "string" ? token.accessToken : undefined;
      s.login = typeof token.login === "string" ? token.login : undefined;
      s.githubId = typeof token.githubId === "number" ? token.githubId : undefined;
      if (s.user) {
        (s.user as { id?: string; login?: string; githubId?: number }).id = token.sub;
        (s.user as { id?: string; login?: string; githubId?: number }).login =
          typeof token.login === "string" ? token.login : undefined;
        (s.user as { id?: string; login?: string; githubId?: number }).githubId =
          typeof token.githubId === "number" ? token.githubId : undefined;
      }
      return s;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});
*/

/**
 * NextAuth.js v5 configuration.
 *
 * Providers:
 *   - GitHub OAuth (for connecting to GitHub App)
 *
 * The backend FastAPI API validates JWTs issued here.
 * Never put server-side secrets in client components.
 */

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          // prompt: "consent",
          // prompt: "login",
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist GitHub access token and profile info in JWT
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      if (profile) {
        token.login = (profile as { login?: string }).login;
        token.githubId = (profile as { id?: number }).id;
      }
      return token;
    },
    async session({ session, token }) {
      const s = session as typeof session & {
        accessToken?: string;
        login?: string;
        githubId?: number;
      };
      s.accessToken = typeof token.accessToken === "string" ? token.accessToken : undefined;
      s.login = typeof token.login === "string" ? token.login : undefined;
      s.githubId = typeof token.githubId === "number" ? token.githubId : undefined;
      if (s.user) {
        (s.user as { id?: string; login?: string; githubId?: number }).id = token.sub;
        (s.user as { id?: string; login?: string; githubId?: number }).login =
          typeof token.login === "string" ? token.login : undefined;
        (s.user as { id?: string; login?: string; githubId?: number }).githubId =
          typeof token.githubId === "number" ? token.githubId : undefined;
      }
      return s;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});