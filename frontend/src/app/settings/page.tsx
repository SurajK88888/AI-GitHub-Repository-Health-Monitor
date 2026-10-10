/**
 * /settings — User settings: notification preferences.
 */

"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MotionCard } from "@/components/ui/MotionCard";
import { Button } from "@/components/ui/Button";
import { Skeleton, ErrorState } from "@/components/ui/Spinner";
import { useFetch } from "@/lib/hooks";
import { api } from "@/lib/api";

interface NotificationPreference {
  critical_finding: boolean;
  score_degradation: boolean;
  scan_failed: boolean;
  scan_completed: boolean;
  action_completed: boolean;
  action_failed: boolean;
}

type PrefKey = keyof NotificationPreference;

const PREF_LABELS: Record<PrefKey, { label: string; description: string }> = {
  critical_finding:  { label: "Critical Findings",    description: "When a CRITICAL severity finding is detected" },
  score_degradation: { label: "Score Degradation",    description: "When health score drops by 10+ points" },
  scan_failed:       { label: "Scan Failures",        description: "When a repository scan fails" },
  scan_completed:    { label: "Scan Completed",       description: "When a scan finishes successfully" },
  action_completed:  { label: "Action Completed",     description: "When an AI remediation action succeeds" },
  action_failed:     { label: "Action Failed",        description: "When an AI remediation action fails" },
};

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
        enabled ? "bg-brand-500" : "bg-gray-200"
      }`}
    >
      <motion.span
        layout
        className="inline-block w-4 h-4 rounded-full bg-white shadow-sm"
        animate={{ x: enabled ? 24 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<NotificationPreference | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const { data: prefs, loading, error } =
    useFetch<NotificationPreference>("/notifications/preferences");

  useEffect(() => {
    if (prefs && !localPrefs) {
      setLocalPrefs(prefs);
    }
  }, [prefs, localPrefs]);

  const togglePref = useCallback((key: PrefKey) => {
    setLocalPrefs((p) => p ? { ...p, [key]: !p[key] } : p);
  }, []);

  const save = useCallback(async () => {
    if (!localPrefs) return;
    setSaving(true);
    try {
      await api.put("/notifications/preferences", localPrefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }, [localPrefs]);

  if (status === "loading") return null;

  return (
    <DashboardLayout title="Settings" subtitle="Manage your preferences">
      <div className="max-w-2xl space-y-5">
        {/* Profile card */}
        <MotionCard className="p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Profile
          </h2>
          <div className="flex items-center gap-4">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt="Avatar"
                style={{ width: "56px", height: "56px", objectFit: "cover", borderRadius: "50%" }}
                className="w-14 h-14 rounded-full border-2 border-brand-200 object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-brand flex items-center justify-center text-white text-xl font-bold">
                {session?.user?.name?.[0] ?? "?"}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{session?.user?.name ?? "—"}</p>
              <p className="text-sm text-gray-500">{session?.user?.email ?? "—"}</p>
              <p className="text-xs text-gray-400 mt-0.5">GitHub OAuth</p>
            </div>
          </div>
        </MotionCard>

        {/* Notification preferences */}
        <MotionCard className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Notification Preferences
            </h2>
            {saved && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs font-semibold text-emerald-600"
              >
                ✓ Saved
              </motion.span>
            )}
          </div>

          {error ? (
            <ErrorState message={error} />
          ) : loading || !localPrefs ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(Object.keys(PREF_LABELS) as PrefKey[]).map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {PREF_LABELS[key].label}
                    </p>
                    <p className="text-xs text-gray-400">
                      {PREF_LABELS[key].description}
                    </p>
                  </div>
                  <Toggle
                    enabled={localPrefs[key]}
                    onChange={() => togglePref(key)}
                  />
                </div>
              ))}

              <div className="pt-4 border-t border-gray-100">
                <Button
                  variant="primary"
                  size="md"
                  loading={saving}
                  onClick={save}
                >
                  Save Preferences
                </Button>
              </div>
            </div>
          )}
        </MotionCard>
      </div>
    </DashboardLayout>
  );
}
