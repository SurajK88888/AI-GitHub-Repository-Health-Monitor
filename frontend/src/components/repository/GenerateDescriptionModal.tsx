"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { Repository } from "@/lib/types";

export interface GenerateDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  repository: Repository | null;
  onDescriptionUpdated: (repoId: string, newDescription: string) => void;
}

interface GenerateResponse {
  repository_id: string;
  repository_name: string;
  description: string;
  safe_files_analyzed: string[];
}

interface UpdateResponse {
  repository_id: string;
  description: string;
  applied_to_github: boolean;
  github_error: string | null;
}

export function GenerateDescriptionModal({
  isOpen,
  onClose,
  repository,
  onDescriptionUpdated,
}: GenerateDescriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [description, setDescription] = useState("");
  const [safeFiles, setSafeFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [githubWarning, setGithubWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateDescription = useCallback(async (repoId: string) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setGithubWarning(null);
    try {
      const res = await api.post<GenerateResponse>(
        `/repositories/${repoId}/generate-description`
      );
      if (res?.description) {
        setDescription(res.description);
        setSafeFiles(res.safe_files_analyzed || []);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to generate description with AI"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && repository) {
      setDescription("");
      setSafeFiles([]);
      setError(null);
      setSuccessMsg(null);
      setGithubWarning(null);
      setCopied(false);
      generateDescription(repository.id);
    }
  }, [isOpen, repository, generateDescription]);

  if (!isOpen || !repository) return null;

  // Option 1: Add Manually (Copy & Open GitHub)
  const handleAddManually = async () => {
    if (!description.trim()) return;
    try {
      await navigator.clipboard.writeText(description.trim());
      setCopied(true);
    } catch {
      // Fallback if clipboard API is restricted
    }

    // Save locally in our database so the health score and card reflect it immediately
    try {
      await api.put<UpdateResponse>(`/repositories/${repository.id}/description`, {
        description: description.trim(),
        apply_to_github: false,
      });
      onDescriptionUpdated(repository.id, description.trim());
    } catch {
      // Non-blocking
    }

    // Open repository on GitHub in a new tab
    const githubUrl = `https://github.com/${repository.full_name}`;
    window.open(githubUrl, "_blank", "noopener,noreferrer");

    setSuccessMsg("Copied to clipboard! Opening GitHub so you can paste into 'About'.");
    setTimeout(() => {
      onClose();
    }, 1800);
  };

  // Option 2: AI Will Add (Apply directly via GitHub API)
  const handleApplyWithAI = async () => {
    if (!description.trim()) return;
    setApplying(true);
    setError(null);
    setGithubWarning(null);
    try {
      const res = await api.put<UpdateResponse>(
        `/repositories/${repository.id}/description`,
        {
          description: description.trim(),
          apply_to_github: true,
        }
      );

      if (res?.applied_to_github) {
        setSuccessMsg("✨ Success! Description was updated directly on GitHub and saved.");
        onDescriptionUpdated(repository.id, description.trim());
        setTimeout(() => {
          onClose();
        }, 1600);
      } else if (res?.github_error) {
        setGithubWarning(res.github_error);
        // Still saved locally in DB
        onDescriptionUpdated(repository.id, description.trim());
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to apply description via GitHub API"
      );
    } finally {
      setApplying(false);
    }
  };

  const charCount = description.length;
  const isOverLimit = charCount > 160;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100/80 border border-purple-200/80 flex items-center justify-center text-lg shadow-2xs">
                ✨
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <span>Generate Repository Description</span>
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 font-medium">Repository:</span>
                  <span className="px-2 py-0.5 rounded-md bg-purple-100/60 text-purple-900 text-[11px] font-bold border border-purple-200/60 font-mono">
                    {repository.name}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-4">
            {/* Security Guard Notice */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 text-xs">
              <span className="text-sm shrink-0">🛡️</span>
              <div>
                <strong className="font-semibold block text-emerald-900">
                  Security-First Scan
                </strong>
                <p className="text-[11.5px] text-emerald-800 leading-relaxed mt-0.5">
                  The AI only inspects public documentation (README) and safe manifests (e.g. <code>package.json</code>, <code>pyproject.toml</code>). 
                  <strong> All proprietary source code files are strictly ignored.</strong>
                </p>
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
                <div className="w-9 h-9 rounded-full border-3 border-purple-200 border-t-purple-600 animate-spin" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-800">
                    Scanning safe metadata & generating description…
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Synthesizing README overview and technology stack
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs space-y-2">
                <p className="font-bold">Generation failed</p>
                <p className="text-[11px]">{error}</p>
                <button
                  type="button"
                  onClick={() => generateDescription(repository.id)}
                  className="px-2.5 py-1 rounded bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Editable Description Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      AI Suggested Description (Editable):
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => generateDescription(repository.id)}
                        className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Regenerate with AI"
                      >
                        <span>🔄</span>
                        <span>Regenerate</span>
                      </button>
                      <span
                        className={`text-[11px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          isOverLimit
                            ? "bg-amber-100 text-amber-800"
                            : "text-gray-400"
                        }`}
                      >
                        {charCount} / 160 chars
                      </span>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter repository description..."
                    className="w-full text-xs font-medium text-gray-800 bg-gray-50/60 rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all resize-none"
                  />
                  {isOverLimit && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      ⚠️ GitHub repository descriptions are recommended to stay under 160 characters.
                    </p>
                  )}
                </div>

                {/* Analyzed Safe Files Badge */}
                {safeFiles.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-gray-500 pt-0.5">
                    <span className="font-semibold text-gray-600">Files analyzed:</span>
                    {safeFiles.map((f) => (
                      <span
                        key={f}
                        className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono text-[10.5px]"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                {/* Feedback Banners */}
                {successMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <span>✅</span>
                    <span>{successMsg}</span>
                  </div>
                )}

                {githubWarning && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <span>ℹ️</span>
                      <span>Saved in Monitor (GitHub requires manual update)</span>
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {githubWarning}
                    </p>
                    <button
                      type="button"
                      onClick={handleAddManually}
                      className="mt-1 px-2.5 py-1 rounded-md bg-amber-200/70 hover:bg-amber-300/80 text-amber-950 font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>📋 Open GitHub & Paste Manually ↗</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions (Step 3: User Options) */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <div className="w-full sm:w-auto flex items-center gap-2">
              {/* Option 1: Add Manually */}
              <button
                type="button"
                onClick={handleAddManually}
                disabled={loading || !description.trim() || applying}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Copy description and open GitHub repository settings"
              >
                <span>{copied ? "✓ Copied!" : "📋"}</span>
                <span>Add Manually ↗</span>
              </button>

              {/* Option 2: AI Will Add */}
              <button
                type="button"
                onClick={handleApplyWithAI}
                disabled={loading || !description.trim() || applying}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Automatically update repository description on GitHub via AI"
              >
                {applying ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Applying…</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Apply via AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
