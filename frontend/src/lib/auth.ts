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
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist GitHub access token in JWT for API calls (Phase 2)
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose access token to server components only — never to the browser
      (session as any).accessToken = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});
