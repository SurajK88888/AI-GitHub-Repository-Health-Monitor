# Widget Architecture & Folder Rules

All floating, draggable, or utility widgets must adhere to the modular widget architecture located under `frontend/src/components/widgets/`.

## 1. Directory Structure

Never place widget implementation files directly at the root of `widgets/`. Every distinct widget must reside in its own dedicated subfolder:

```text
frontend/src/components/widgets/
├── <widget-name>/               # Dedicated folder per widget (e.g., clock, weather, notes)
│   ├── <WidgetName>Widget.tsx   # Core widget component
│   ├── types.ts                 # Type definitions & interfaces specific to this widget
│   ├── <helpers>.ts             # Specialized helpers/utilities (e.g., timezones.ts)
│   └── index.ts                 # Barrel export for the widget folder
├── WidgetContainer.tsx          # Global orchestrator rendering all active widgets
└── index.ts                     # Central barrel export for the widgets directory
```

## 2. Global Integration

- **Container Mounting**: `WidgetContainer.tsx` is mounted globally in `frontend/src/app/layout.tsx` within `<AuthProvider>`, ensuring widgets persist seamlessly across route changes and public/authenticated views.
- **Registration**: When a new widget is created, export it from its local `index.ts`, register it in `WidgetContainer.tsx`, and re-export it in `frontend/src/components/widgets/index.ts`.

## 3. Widget Design & Implementation Standards

- **Self-Contained & Encapsulated**: A widget must manage its own state, persistence (e.g., `localStorage` for coordinates or preferences), and sub-components without leaking into parent layouts.
- **Zero-Lag & Performance**: Use precision timers, requestAnimationFrame, or event-driven mechanisms. Re-sync immediately on `visibilitychange` / tab focus. Use `tabular-nums font-mono` for numeric displays to eliminate jitter.
- **Draggable & Boundary Constrained**: If a widget is draggable, clamp it to the viewport (`window.innerWidth`, `window.innerHeight`) so it cannot be dragged off-screen, and provide a reset button to restore default positioning.
- **Responsive & Minimalist**: Provide expand/collapse or compact modes so users can minimize the widget's visual footprint.
- **Design System Consistency**: Maintain the application's glassmorphism style (`bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-2xl shadow-...`), dark-mode compatibility, and brand palette accents (`brand-500`, `indigo-500`).
- **SSR Safety**: Use `"use client";` and guard against hydration mismatches by ensuring client-specific state (e.g. system clock, `localStorage`) only renders after mount.
