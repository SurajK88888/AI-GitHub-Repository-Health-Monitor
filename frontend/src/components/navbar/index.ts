/**
 * Navbar module — public barrel export.
 *
 * Usage:
 *   import { GlobalNavbar } from "@/components/navbar";
 *
 * To add/remove nav links, edit `navItems.ts` in this folder.
 */
export { GlobalNavbar } from "./GlobalNavbar";
export type { NavbarItem } from "./navItems";
export { NAVBAR_ITEMS, NAVBAR_CTA_AUTHENTICATED, NAVBAR_CTA_UNAUTHENTICATED } from "./navItems";
