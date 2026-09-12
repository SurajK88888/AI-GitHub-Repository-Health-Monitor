"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

/**
 * Wraps children with NextAuth SessionProvider.
 * Must be used in a Client Component so session state is available
 * to all child components without making the root layout a Client Component.
 */
export function SessionProvider({ children }: Props) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
