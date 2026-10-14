/**
 * Navbar navigation items config.
 * Add, remove, or reorder items here to update the navbar without touching component logic.
 */

export interface NavbarItem {
  label: string;
  href: string;
  /** Set to true to highlight this link as a primary CTA button */
  isCta?: boolean;
  /** Optional icon (emoji or text) shown next to the label */
  icon?: string;
}

/**
 * Public links shown in the global navbar (landing page, sign-in, etc.).
 * Authenticated-only nav is handled by the Sidebar inside DashboardLayout.
 */
export const NAVBAR_ITEMS: NavbarItem[] = [
  { label: "Features",      href: "/#features" },
  { label: "Repositories",  href: "/repositories", icon: "⬡" },
  { label: "Dashboard",     href: "/dashboard",    icon: "⊞" },
];

/** The single call-to-action shown on the right of the navbar (unauthenticated state). */
export const NAVBAR_CTA_UNAUTHENTICATED: NavbarItem = {
  label: "Sign in with GitHub",
  href: "/auth/signin",
  isCta: true,
};

/** CTA shown when the user IS authenticated. */
export const NAVBAR_CTA_AUTHENTICATED: NavbarItem = {
  label: "Go to Dashboard →",
  href: "/dashboard",
  isCta: true,
};
