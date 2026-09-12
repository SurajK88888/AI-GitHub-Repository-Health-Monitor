/**
 * NextAuth.js v5 route handler.
 * Handles /api/auth/* routes (sign in, sign out, session, callback).
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
