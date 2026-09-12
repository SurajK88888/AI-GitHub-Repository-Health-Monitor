import Link from "next/link";

/**
 * Landing page — shown to unauthenticated users.
 * Phase 3 will redirect authenticated users to /dashboard.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-4xl font-bold mb-4">
        GitHub Repository Health Monitor
      </h1>
      <p className="text-lg text-gray-600 max-w-xl mb-8">
        Get automated health scores, security findings, AI recommendations, and
        trend analysis for your GitHub repositories.
      </p>
      <Link
        href="/api/auth/signin"
        className="rounded-lg bg-gray-900 text-white px-6 py-3 font-semibold hover:bg-gray-700 transition-colors"
      >
        Sign in with GitHub
      </Link>
    </main>
  );
}
