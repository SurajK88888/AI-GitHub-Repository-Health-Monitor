"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MotionCard } from "@/components/ui/MotionCard";
import type { Repository, HealthScore, Finding, AIAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type TechLayer = "client" | "backend" | "data" | "devops";

export type TechStatus = "connected" | "monitored" | "attention" | "standby";

export interface TechNode {
  id: string;
  name: string;
  layer: TechLayer;
  icon: string;
  color: string;
  bgLight: string;
  borderColor: string;
  purpose: string;
  connectionStatus: TechStatus;
  statusLabel: string;
  detectedVia: string;
  metricsSummary?: string;
  version?: string;
  tags: string[];
}

interface TechStackVisualizerProps {
  repo: Repository;
  health?: HealthScore | null;
  findings?: Finding[];
  hasNoCode?: boolean;
  aiAnalysis?: AIAnalysis | null;
}

// ── Technology Catalog & Heuristics ────────────────────────────────────────

const LAYER_CONFIG: Record<
  TechLayer,
  { label: string; badge: string; color: string; bg: string; icon: string }
> = {
  client: {
    label: "Client & UI",
    badge: "Frontend Layer",
    color: "#3b82f6",
    bg: "bg-blue-50/70 border-blue-200 text-blue-700",
    icon: "💻",
  },
  backend: {
    label: "API & Backend",
    badge: "Service Layer",
    color: "#8b5cf6",
    bg: "bg-purple-50/70 border-purple-200 text-purple-700",
    icon: "⚡",
  },
  data: {
    label: "Data & Storage",
    badge: "Persistence Layer",
    color: "#10b981",
    bg: "bg-emerald-50/70 border-emerald-200 text-emerald-700",
    icon: "🗄️",
  },
  devops: {
    label: "DevOps & CI/CD",
    badge: "Operations Layer",
    color: "#f59e0b",
    bg: "bg-amber-50/70 border-amber-200 text-amber-700",
    icon: "🚀",
  },
};

function getTechVisuals(name: string, layer: TechLayer): {
  icon: string;
  color: string;
  bgLight: string;
  borderColor: string;
  tags: string[];
} {
  const n = name.toLowerCase();
  if (n.includes("next")) {
    return { icon: "▲", color: "#000000", bgLight: "bg-gray-100", borderColor: "border-gray-300", tags: ["Full-Stack", "SSR", "App Router"] };
  }
  if (n.includes("react")) {
    return { icon: "⚛️", color: "#06b6d4", bgLight: "bg-cyan-50", borderColor: "border-cyan-200", tags: ["UI Library", "Hooks", "Components"] };
  }
  if (n.includes("vue")) {
    return { icon: "💚", color: "#10b981", bgLight: "bg-emerald-50", borderColor: "border-emerald-200", tags: ["SFC", "Reactivity"] };
  }
  if (n.includes("svelte")) {
    return { icon: "🔥", color: "#f97316", bgLight: "bg-orange-50", borderColor: "border-orange-200", tags: ["Compiler", "Reactive"] };
  }
  if (n.includes("typescript")) {
    return { icon: "🔷", color: "#3178c6", bgLight: "bg-blue-50", borderColor: "border-blue-200", tags: ["Type Safety", "ESNext"] };
  }
  if (n.includes("tailwind")) {
    return { icon: "🎨", color: "#06b6d4", bgLight: "bg-cyan-50", borderColor: "border-cyan-200", tags: ["Styling", "CSS Utility"] };
  }
  if (n.includes("fastapi")) {
    return { icon: "⚡", color: "#059669", bgLight: "bg-emerald-50", borderColor: "border-emerald-200", tags: ["ASGI", "OpenAPI", "AsyncIO"] };
  }
  if (n.includes("django")) {
    return { icon: "🎸", color: "#047857", bgLight: "bg-emerald-50", borderColor: "border-emerald-200", tags: ["ORM", "Python Framework"] };
  }
  if (n.includes("flask")) {
    return { icon: "🧪", color: "#4b5563", bgLight: "bg-gray-50", borderColor: "border-gray-200", tags: ["WSGI", "Microservice"] };
  }
  if (n.includes("python")) {
    return { icon: "🐍", color: "#3776ab", bgLight: "bg-blue-50", borderColor: "border-blue-200", tags: ["Runtime", "Async Services"] };
  }
  if (n.includes("node")) {
    return { icon: "🟢", color: "#22c55e", bgLight: "bg-green-50", borderColor: "border-green-200", tags: ["Runtime", "V8 Engine"] };
  }
  if (n.includes("go") || n.includes("golang")) {
    return { icon: "🐹", color: "#00add8", bgLight: "bg-cyan-50", borderColor: "border-cyan-200", tags: ["Concurrency", "Compiled"] };
  }
  if (n.includes("postgres") || n.includes("psql") || n.includes("sqlalchemy")) {
    return { icon: "🐘", color: "#336791", bgLight: "bg-sky-50", borderColor: "border-sky-200", tags: ["SQL", "Relational DB", "ACID"] };
  }
  if (n.includes("redis") || n.includes("arq") || n.includes("celery")) {
    return { icon: "🔴", color: "#dc2626", bgLight: "bg-red-50", borderColor: "border-red-200", tags: ["Cache", "Key-Value", "In-Memory"] };
  }
  if (n.includes("supabase")) {
    return { icon: "⚡", color: "#22c55e", bgLight: "bg-emerald-50", borderColor: "border-emerald-200", tags: ["PostgreSQL", "RLS", "Realtime"] };
  }
  if (n.includes("mongo")) {
    return { icon: "🍃", color: "#16a34a", bgLight: "bg-emerald-50", borderColor: "border-emerald-200", tags: ["NoSQL", "Document Store"] };
  }
  if (n.includes("sqlite")) {
    return { icon: "💾", color: "#0284c7", bgLight: "bg-blue-50", borderColor: "border-blue-200", tags: ["Embedded DB", "Serverless"] };
  }
  if (n.includes("docker")) {
    return { icon: "🐳", color: "#2496ed", bgLight: "bg-blue-50", borderColor: "border-blue-200", tags: ["Containers", "Virtualization"] };
  }
  if (n.includes("action") || n.includes("workflow") || n.includes("ci") || n.includes("cd")) {
    return { icon: "⚙️", color: "#2088ff", bgLight: "bg-indigo-50", borderColor: "border-indigo-200", tags: ["Automated CI", "Workflows"] };
  }

  const layerMap: Record<TechLayer, { icon: string; color: string; bgLight: string; borderColor: string; tags: string[] }> = {
    client: { icon: "💻", color: "#3b82f6", bgLight: "bg-blue-50", borderColor: "border-blue-200", tags: ["Client", "Frontend"] },
    backend: { icon: "⚡", color: "#8b5cf6", bgLight: "bg-purple-50", borderColor: "border-purple-200", tags: ["Backend", "API Service"] },
    data: { icon: "🗄️", color: "#10b981", bgLight: "bg-emerald-50", borderColor: "border-emerald-200", tags: ["Database", "Persistence"] },
    devops: { icon: "🚀", color: "#f59e0b", bgLight: "bg-amber-50", borderColor: "border-amber-200", tags: ["DevOps", "Infrastructure"] },
  };
  return layerMap[layer] || layerMap.backend;
}

export function TechStackVisualizer({
  repo,
  health,
  findings = [],
  hasNoCode = false,
  aiAnalysis,
}: TechStackVisualizerProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [layerFilter, setLayerFilter] = useState<TechLayer | "all">("all");

  const isAiDetected = useMemo(() => {
    return Array.isArray(aiAnalysis?.result?.tech_stack) && aiAnalysis.result.tech_stack.length > 0;
  }, [aiAnalysis]);

  // ── Intelligent Stack Detection (AI Primary + Local Heuristics Fallback/Merge) ──
  const detectedNodes = useMemo<TechNode[]>(() => {
    if (hasNoCode) return [];

    const openFindingTitles = findings
      .filter((f) => f.status === "OPEN")
      .map((f) => f.title.toLowerCase());

    const hasDepFindings = openFindingTitles.some((t) => t.includes("lockfile") || t.includes("manifest"));
    const hasSecFindings = openFindingTitles.some((t) => t.includes("secret") || t.includes("vulnerability"));
    const hasCiFinding = openFindingTitles.some((t) => t.includes("ci/cd") || t.includes("workflow"));

    // 1. Process AI-detected tech stack items if present
    const aiItems = aiAnalysis?.result?.tech_stack;
    const aiNodes: TechNode[] = [];
    const seenNames = new Set<string>();

    if (Array.isArray(aiItems) && aiItems.length > 0) {
      for (const item of aiItems) {
        if (!item || !item.name) continue;
        const normalizedName = item.name.trim();
        const key = normalizedName.toLowerCase();
        if (seenNames.has(key)) continue;
        seenNames.add(key);

        const layer: TechLayer = (["client", "backend", "data", "devops"].includes(item.layer)
          ? item.layer
          : "backend") as TechLayer;
        const visuals = getTechVisuals(normalizedName, layer);

        const isAttention =
          (layer === "data" && hasSecFindings) ||
          (layer === "devops" && hasCiFinding) ||
          (layer === "backend" && hasDepFindings && (health?.overall_score ?? 100) < 60);

        aiNodes.push({
          id: `ai-${key.replace(/[^a-z0-9]/g, "-")}`,
          name: normalizedName,
          layer,
          icon: visuals.icon,
          color: visuals.color,
          bgLight: visuals.bgLight,
          borderColor: visuals.borderColor,
          purpose: item.purpose || `${normalizedName} component configured for the project.`,
          connectionStatus: isAttention ? "attention" : "connected",
          statusLabel: isAttention ? "Needs Review" : `Active (${item.confidence || "high"} confidence)`,
          detectedVia: "Gemini AI Architecture Analysis",
          tags: [...visuals.tags, item.confidence ? `${item.confidence} confidence` : "verified"],
        });
      }
    }

    // 2. Local Heuristics
    const nodes: TechNode[] = [];
    const textBlob = [
      repo.name,
      repo.full_name,
      repo.description ?? "",
      repo.language ?? "",
      ...(repo as unknown as { topics?: string[] }).topics ?? [],
      ...findings.map((f) => `${f.title} ${f.description} ${JSON.stringify(f.evidence ?? "")}`),
    ]
      .join(" ")
      .toLowerCase();

    // ── 1. Client / UI Detection ───────────────────────────────────────────
    const isNext = textBlob.includes("next") || textBlob.includes("nextjs");
    const isReact = isNext || textBlob.includes("react");
    const isVue = textBlob.includes("vue");
    const isSvelte = textBlob.includes("svelte");
    const isTypeScript = textBlob.includes("typescript") || textBlob.includes("tsconfig") || (repo.language?.toLowerCase() === "typescript");
    const isTailwind = textBlob.includes("tailwind") || textBlob.includes("postcss");

    if (isNext) {
      nodes.push({
        id: "nextjs",
        name: "Next.js",
        layer: "client",
        icon: "▲",
        color: "#000000",
        bgLight: "bg-gray-100",
        borderColor: "border-gray-300",
        purpose: "Full-Stack React Framework with Server-Side Rendering (SSR) and edge-routing architecture.",
        connectionStatus: "connected",
        statusLabel: "Active Core Framework",
        detectedVia: "package.json / Project structure",
        tags: ["React 19", "SSR", "App Router"],
      });
    } else if (isReact) {
      nodes.push({
        id: "react",
        name: "React",
        layer: "client",
        icon: "⚛️",
        color: "#06b6d4",
        bgLight: "bg-cyan-50",
        borderColor: "border-cyan-200",
        purpose: "Component-based User Interface library powering reactive interactive frontends.",
        connectionStatus: "connected",
        statusLabel: "Active UI Library",
        detectedVia: "package.json / JSX dependencies",
        tags: ["Components", "Hooks", "Virtual DOM"],
      });
    } else if (isVue) {
      nodes.push({
        id: "vue",
        name: "Vue.js",
        layer: "client",
        icon: "💚",
        color: "#10b981",
        bgLight: "bg-emerald-50",
        borderColor: "border-emerald-200",
        purpose: "Progressive JavaScript framework for interactive single-page application views.",
        connectionStatus: "connected",
        statusLabel: "Active Client View",
        detectedVia: "Vue manifest indicators",
        tags: ["SFC", "Reactivity"],
      });
    } else if (isSvelte) {
      nodes.push({
        id: "svelte",
        name: "Svelte",
        layer: "client",
        icon: "🔥",
        color: "#f97316",
        bgLight: "bg-orange-50",
        borderColor: "border-orange-200",
        purpose: "Cybernetically enhanced web app compiler delivering zero runtime overhead.",
        connectionStatus: "connected",
        statusLabel: "Active Client View",
        detectedVia: "Svelte configuration",
        tags: ["Compiler", "Reactive"],
      });
    } else if (textBlob.includes("html") || textBlob.includes("css") || textBlob.includes("mathematician")) {
      nodes.push({
        id: "web-ui",
        name: "Modern Web UI",
        layer: "client",
        icon: "🌐",
        color: "#2563eb",
        bgLight: "bg-blue-50",
        borderColor: "border-blue-200",
        purpose: "Semantic Web structure, interactive DOM interfaces, and presentation stylesheets.",
        connectionStatus: "connected",
        statusLabel: "Active Web Client",
        detectedVia: "Repository assets & HTML5 templates",
        tags: ["HTML5", "CSS3", "JavaScript"],
      });
    }

    if (isTypeScript) {
      nodes.push({
        id: "typescript",
        name: "TypeScript",
        layer: "client",
        icon: "🔷",
        color: "#3178c6",
        bgLight: "bg-blue-50",
        borderColor: "border-blue-200",
        purpose: "Static type-checking system providing enterprise-grade developer confidence and interfaces.",
        connectionStatus: "monitored",
        statusLabel: "Strict Type Safety",
        detectedVia: "tsconfig.json / .ts source tree",
        tags: ["Type Safety", "ESNext"],
      });
    }

    if (isTailwind) {
      nodes.push({
        id: "tailwind",
        name: "Tailwind CSS",
        layer: "client",
        icon: "🎨",
        color: "#06b6d4",
        bgLight: "bg-cyan-50",
        borderColor: "border-cyan-200",
        purpose: "Utility-first CSS engine for composable, performant, and responsive interface design.",
        connectionStatus: "connected",
        statusLabel: "Styling Engine",
        detectedVia: "tailwind.config.js / styling modules",
        tags: ["Design System", "CSS"],
      });
    }

    // ── 2. Backend & API Detection ─────────────────────────────────────────
    const isPython = textBlob.includes("python") || textBlob.includes(".py") || (repo.language?.toLowerCase() === "python");
    const isFastAPI = textBlob.includes("fastapi") || textBlob.includes("uvicorn");
    const isDjango = textBlob.includes("django");
    const isFlask = textBlob.includes("flask");
    const isNode = textBlob.includes("express") || textBlob.includes("nestjs") || textBlob.includes("node");
    const isGo = textBlob.includes("golang") || textBlob.includes("go.mod") || (repo.language?.toLowerCase() === "go");

    if (isFastAPI) {
      nodes.push({
        id: "fastapi",
        name: "FastAPI",
        layer: "backend",
        icon: "⚡",
        color: "#059669",
        bgLight: "bg-emerald-50",
        borderColor: "border-emerald-200",
        purpose: "Modern, high-performance asynchronous Python REST API engine with OpenAPI & Pydantic validation.",
        connectionStatus: "connected",
        statusLabel: "Active REST API",
        detectedVia: "pyproject.toml / main.py routes",
        tags: ["ASGI", "OpenAPI", "AsyncIO"],
      });
    } else if (isDjango) {
      nodes.push({
        id: "django",
        name: "Django",
        layer: "backend",
        icon: "🎸",
        color: "#047857",
        bgLight: "bg-emerald-50",
        borderColor: "border-emerald-200",
        purpose: "High-level batteries-included Python framework for secure, scalable web services.",
        connectionStatus: "connected",
        statusLabel: "Active Backend",
        detectedVia: "manage.py / Django configuration",
        tags: ["ORM", "Batteries-included"],
      });
    } else if (isFlask) {
      nodes.push({
        id: "flask",
        name: "Flask",
        layer: "backend",
        icon: "🧪",
        color: "#4b5563",
        bgLight: "bg-gray-50",
        borderColor: "border-gray-200",
        purpose: "Lightweight WSGI Python microframework providing composable API endpoints.",
        connectionStatus: "connected",
        statusLabel: "Microservice API",
        detectedVia: "app.py / Flask imports",
        tags: ["WSGI", "Microservice"],
      });
    } else if (isPython) {
      nodes.push({
        id: "python",
        name: "Python Service",
        layer: "backend",
        icon: "🐍",
        color: "#3776ab",
        bgLight: "bg-blue-50",
        borderColor: "border-blue-200",
        purpose: "Core algorithm processing, data transformations, and asynchronous service orchestration.",
        connectionStatus: "connected",
        statusLabel: "Execution Engine",
        detectedVia: "Python source files & runtime",
        tags: ["Python 3.12+", "Algorithms"],
      });
    } else if (isNode) {
      nodes.push({
        id: "node",
        name: "Node.js Server",
        layer: "backend",
        icon: "🟢",
        color: "#22c55e",
        bgLight: "bg-green-50",
        borderColor: "border-green-200",
        purpose: "Event-driven asynchronous JavaScript runtime for high-throughput I/O services.",
        connectionStatus: "connected",
        statusLabel: "Active Server Runtime",
        detectedVia: "package.json server entrypoints",
        tags: ["Event Loop", "V8 Engine"],
      });
    } else if (isGo) {
      nodes.push({
        id: "go",
        name: "Go Service",
        layer: "backend",
        icon: "🐹",
        color: "#00add8",
        bgLight: "bg-cyan-50",
        borderColor: "border-cyan-200",
        purpose: "Compiled, concurrent backend microservice engineered for high performance and low memory overhead.",
        connectionStatus: "connected",
        statusLabel: "Compiled Binary",
        detectedVia: "go.mod / Go source tree",
        tags: ["Goroutines", "Concurrency"],
      });
    }

    // ── 3. Data & Storage Detection ────────────────────────────────────────
    const isSupabase = textBlob.includes("supabase");
    const isPostgres = isSupabase || textBlob.includes("postgres") || textBlob.includes("psycopg") || textBlob.includes("sqlalchemy");
    const isRedis = textBlob.includes("redis") || textBlob.includes("arq") || textBlob.includes("celery");
    const isMongo = textBlob.includes("mongo") || textBlob.includes("mongoose");
    const isSqlite = textBlob.includes("sqlite");

    if (isSupabase) {
      nodes.push({
        id: "supabase",
        name: "Supabase",
        layer: "data",
        icon: "⚡",
        color: "#22c55e",
        bgLight: "bg-emerald-50",
        borderColor: "border-emerald-200",
        purpose: "Open-source Firebase alternative: Managed Postgres database, Row Level Security, and Realtime auth.",
        connectionStatus: "connected",
        statusLabel: "Cloud Database & Auth",
        detectedVia: "Supabase client / cloud connector",
        tags: ["PostgreSQL", "RLS", "Realtime"],
      });
    } else if (isPostgres) {
      nodes.push({
        id: "postgres",
        name: "PostgreSQL",
        layer: "data",
        icon: "🐘",
        color: "#336791",
        bgLight: "bg-sky-50",
        borderColor: "border-sky-200",
        purpose: "Enterprise-grade ACID relational database managing schemas, relational constraints, and indexes.",
        connectionStatus: "connected",
        statusLabel: "Primary Relational DB",
        detectedVia: "Database connection strings / ORM models",
        tags: ["ACID", "Relational", "SQL"],
      });
    } else if (isMongo) {
      nodes.push({
        id: "mongo",
        name: "MongoDB",
        layer: "data",
        icon: "🍃",
        color: "#16a34a",
        bgLight: "bg-emerald-50",
        borderColor: "border-emerald-200",
        purpose: "Document-oriented database storing schema-flexible JSON collections and aggregates.",
        connectionStatus: "connected",
        statusLabel: "NoSQL Datastore",
        detectedVia: "MongoDB client connector",
        tags: ["NoSQL", "BSON"],
      });
    } else if (isSqlite) {
      nodes.push({
        id: "sqlite",
        name: "SQLite",
        layer: "data",
        icon: "🗄️",
        color: "#0284c7",
        bgLight: "bg-sky-50",
        borderColor: "border-sky-200",
        purpose: "Self-contained serverless transactional SQL database embedded inside application process.",
        connectionStatus: "connected",
        statusLabel: "Embedded Database",
        detectedVia: "Local SQLite database storage",
        tags: ["Serverless", "Local Storage"],
      });
    }

    if (isRedis) {
      nodes.push({
        id: "redis",
        name: "Redis Cache",
        layer: "data",
        icon: "🔴",
        color: "#dc2626",
        bgLight: "bg-rose-50",
        borderColor: "border-rose-200",
        purpose: "In-memory data structure store powering caching, distributed rate-limiting, and async queue brokers.",
        connectionStatus: "connected",
        statusLabel: "In-Memory Cache & Broker",
        detectedVia: "Redis connection pool / ARQ workers",
        tags: ["In-Memory", "Queue Broker", "Sub-ms"],
      });
    }

    // ── 4. DevOps, CI/CD & Infrastructure ──────────────────────────────────
    const isDocker = textBlob.includes("docker") || textBlob.includes("dockerfile");
    const isGhActions = textBlob.includes("github actions") || textBlob.includes("workflows") || !hasCiFinding;
    const isDependabot = textBlob.includes("dependabot");

    if (isGhActions) {
      nodes.push({
        id: "github-actions",
        name: "GitHub Actions",
        layer: "devops",
        icon: "⚙️",
        color: "#2563eb",
        bgLight: "bg-blue-50",
        borderColor: "border-blue-200",
        purpose: "Continuous Integration & Deployment pipelines executing automated test suites, linting, and releases.",
        connectionStatus: hasCiFinding ? "attention" : "connected",
        statusLabel: hasCiFinding ? "CI Workflows Missing" : "Automated CI Pipeline",
        detectedVia: ".github/workflows/ CI definitions",
        tags: ["CI/CD", "Automated Tests", "DevOps"],
      });
    }

    if (isDocker) {
      nodes.push({
        id: "docker",
        name: "Docker",
        layer: "devops",
        icon: "🐳",
        color: "#0284c7",
        bgLight: "bg-sky-50",
        borderColor: "border-sky-200",
        purpose: "Containerized environments providing reproducible isolated builds across development and production.",
        connectionStatus: "connected",
        statusLabel: "Container Runtime",
        detectedVia: "Dockerfile / docker-compose.yml",
        tags: ["Containers", "Microservices"],
      });
    }

    if (isDependabot || !hasSecFindings) {
      nodes.push({
        id: "dependabot",
        name: "Security Updates",
        layer: "devops",
        icon: "🛡️",
        color: "#059669",
        bgLight: "bg-emerald-50",
        borderColor: "border-emerald-200",
        purpose: "Continuous dependency vulnerability monitoring, automated pull requests, and security patching.",
        connectionStatus: hasSecFindings ? "attention" : "monitored",
        statusLabel: hasSecFindings ? "Vulnerabilities Detected" : "Security Audited",
        detectedVia: "GitHub Security Advisories & Dependency Scanner",
        tags: ["Security", "Automated PRs"],
      });
    }

    // Guarantee at least foundational components if it's an active codebase
    if (nodes.length === 0) {
      nodes.push({
        id: "code-repo",
        name: repo.language || "Source Code",
        layer: "backend",
        icon: "💻",
        color: "#6366f1",
        bgLight: "bg-indigo-50",
        borderColor: "border-indigo-200",
        purpose: `Primary source codebase implemented in ${repo.language || "standard programming languages"}.`,
        connectionStatus: "connected",
        statusLabel: "Active Repository",
        detectedVia: "Repository Language Metadata",
        tags: [repo.language || "Codebase", "Git"],
      });
    }

    // Merge AI-detected nodes with unique heuristic nodes
    if (aiNodes.length > 0) {
      for (const h of nodes) {
        if (!seenNames.has(h.name.toLowerCase())) {
          seenNames.add(h.name.toLowerCase());
          aiNodes.push(h);
        }
      }
      return aiNodes;
    }

    return nodes;
  }, [repo, findings, hasNoCode, aiAnalysis, health]);

  // Filter nodes according to selected tier tab
  const filteredNodes = useMemo(() => {
    if (layerFilter === "all") return detectedNodes;
    return detectedNodes.filter((n) => n.layer === layerFilter);
  }, [detectedNodes, layerFilter]);

  // Selected node object
  const activeNode = useMemo(() => {
    if (!selectedNodeId) return detectedNodes[0] || null;
    return detectedNodes.find((n) => n.id === selectedNodeId) || detectedNodes[0] || null;
  }, [detectedNodes, selectedNodeId]);

  // Group nodes by architectural tier for the grid view
  const nodesByLayer = useMemo(() => {
    const grouped: Record<TechLayer, TechNode[]> = {
      client: [],
      backend: [],
      data: [],
      devops: [],
    };
    for (const node of detectedNodes) {
      grouped[node.layer].push(node);
    }
    return grouped;
  }, [detectedNodes]);

  return (
    <MotionCard className="mb-6 p-6 border-white/[0.12] rounded-[24px] shadow-none overflow-hidden bg-[#0F171E]/55 backdrop-blur-[20px] text-white">
      {/* Container Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-[#F59E0B] border border-white/[0.12] text-sm font-bold">
              🗺️
            </span>
            <h3 className="text-base font-bold text-white">
              Interactive Tech Stack Visualizer
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {detectedNodes.length} Components Mapped
            </span>
            {isAiDetected && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 flex items-center gap-1">
                <span>✨</span> AI Architecture Scan
              </span>
            )}
          </div>
          <p className="text-xs text-white/50 mt-1">
            Dynamic architectural node map. Hover or click any technology node to inspect its system role, live connection status, and configuration origin.
          </p>
        </div>

        {/* Layer Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-full border border-white/[0.10] text-xs self-start sm:self-auto">
          {(["all", "client", "backend", "data", "devops"] as const).map((layer) => (
            <button
              key={layer}
              onClick={() => setLayerFilter(layer)}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer capitalize text-[11px]",
                layerFilter === layer
                  ? "bg-white text-[#090D11] shadow-sm font-medium rounded-full"
                  : "text-white/60 hover:text-white rounded-full"
              )}
            >
              {layer === "all" ? "All Layers" : LAYER_CONFIG[layer].label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State when no code is present */}
      {hasNoCode || detectedNodes.length === 0 ? (
        <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-xl mb-3 shadow-2xs">
            ⚠️
          </div>
          <h4 className="text-sm font-semibold text-white">
            No Architectural Components Detected
          </h4>
          <p className="text-xs text-gray-500 max-w-md mt-1">
            This repository has no recognizable source code files, manifests, or framework configurations. Commit code or dependency manifests to generate the live tech stack architecture map.
          </p>
        </div>
      ) : (
        <div className="pt-6">
          {/* Architecture Tier Columns View */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {(["client", "backend", "data", "devops"] as const).map((layerKey) => {
              const layerMeta = LAYER_CONFIG[layerKey];
              const layerNodes = nodesByLayer[layerKey];
              const isFilteredOut = layerFilter !== "all" && layerFilter !== layerKey;

              return (
                <div
                  key={layerKey}
                  className={cn(
                    "flex flex-col rounded-2xl p-3.5 border transition-all duration-200",
                    isFilteredOut
                      ? "opacity-30 bg-white/[0.02] border-dashed border-white/[0.08]"
                      : "bg-white/[0.03] border-white/[0.08] shadow-none"
                  )}
                >
                  {/* Layer Header */}
                  <div className="flex items-center justify-between gap-1.5 pb-2.5 mb-2.5 border-b border-white/[0.08]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{layerMeta.icon}</span>
                      <span className="text-xs font-semibold text-white">
                        {layerMeta.label}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.10] text-white/70">
                      {layerNodes.length}
                    </span>
                  </div>

                  {/* Nodes in this layer */}
                  <div className="space-y-2 flex-1">
                    {layerNodes.length === 0 ? (
                      <div className="h-20 rounded-xl border border-dashed border-white/[0.10] flex items-center justify-center text-[11px] text-white/40 font-medium">
                        None detected
                      </div>
                    ) : (
                      layerNodes.map((node) => {
                        const isSelected = activeNode?.id === node.id;
                        return (
                          <motion.button
                            key={node.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedNodeId(node.id)}
                            className={cn(
                              "w-full text-left p-3 rounded-xl border transition-all duration-200 relative group cursor-pointer",
                              isSelected
                                ? "bg-white/[0.08] border-[#F59E0B] shadow-sm ring-2 ring-[#F59E0B]/20"
                                : "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.10] hover:border-white/[0.20] shadow-none"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-lg shrink-0">{node.icon}</span>
                                <div className="min-w-0">
                                  <h5 className="text-xs font-medium text-white truncate group-hover:text-[#F59E0B] transition-colors">
                                    {node.name}
                                  </h5>
                                  <p className="text-[10px] text-gray-400 truncate">
                                    {node.tags[0] || layerMeta.badge}
                                  </p>
                                </div>
                              </div>

                              {/* Status Pulse Dot */}
                              <span
                                className={cn(
                                  "w-2 h-2 rounded-full shrink-0",
                                  node.connectionStatus === "connected" &&
                                    "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
                                  node.connectionStatus === "monitored" &&
                                    "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
                                  node.connectionStatus === "attention" &&
                                    "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                                )}
                                title={node.statusLabel}
                              />
                            </div>
                          </motion.button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Inspection Detail Card */}
          <AnimatePresence mode="wait">
            {activeNode && (
              <motion.div
                key={activeNode.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="rounded-2xl border border-white/[0.12] bg-[#0F161E]/90 backdrop-blur-md p-5 text-white"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Node Info & Purpose */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-white/[0.06] border border-white/[0.12] flex items-center justify-center text-2xl shrink-0">
                      {activeNode.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="text-sm font-semibold text-white">
                          {activeNode.name}
                        </h4>
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-semibold border",
                            LAYER_CONFIG[activeNode.layer].bg
                          )}
                        >
                          {LAYER_CONFIG[activeNode.layer].badge}
                        </span>

                        {/* Live Status Pill */}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border",
                            activeNode.connectionStatus === "connected" &&
                              "bg-emerald-50 text-emerald-800 border-emerald-200",
                            activeNode.connectionStatus === "monitored" &&
                              "bg-blue-50 text-blue-800 border-blue-200",
                            activeNode.connectionStatus === "attention" &&
                              "bg-amber-50 text-amber-800 border-amber-200"
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              activeNode.connectionStatus === "connected" && "bg-emerald-600 animate-pulse",
                              activeNode.connectionStatus === "monitored" && "bg-blue-600",
                              activeNode.connectionStatus === "attention" && "bg-amber-600"
                            )}
                          />
                          {activeNode.statusLabel}
                        </span>
                      </div>

                      <p className="text-xs text-white/70 mt-1.5 leading-relaxed max-w-2xl">
                        {activeNode.purpose}
                      </p>
                    </div>
                  </div>

                  {/* Right: Metadata Origin & Tags */}
                  <div className="flex flex-col lg:items-end gap-1.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-100 text-xs">
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <span className="text-gray-400">Detected Source:</span>
                      <code className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.12] text-white/80 font-mono text-[11px]">
                        {activeNode.detectedVia}
                      </code>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {activeNode.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-md bg-white/[0.06] text-white/60 text-[10px] font-medium border border-white/[0.08]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </MotionCard>
  );
}
