"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { useState, type ReactNode } from "react";
import type { WidgetConfig } from "@/lib/types";

// ── Sortable widget wrapper ───────────────────────────────────────────────────

function SortableWidget({
  widget,
  children,
  title,
}: {
  widget: WidgetConfig;
  children: ReactNode;
  title: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        gridColumn: (widget.size === "xl" || widget.size === "lg") ? "span 2" : "span 1",
      }}
    >
      <motion.div
        className="card h-full"
        whileHover={{
          y: -3,
          boxShadow: "0 12px 28px -6px rgba(139,92,246,0.14)",
        }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
      >
        {/* Widget header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          {/* Drag handle */}
          <button
            {...listeners}
            {...attributes}
            className="text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing text-base p-1 rounded transition-colors"
            title="Drag to reorder"
          >
            ⠿
          </button>
        </div>

        {/* Widget body */}
        <div className="p-5">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

// ── Overlay ghost ─────────────────────────────────────────────────────────────

function GhostWidget({ title }: { title: string }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 12,
        border: "2px dashed #ddd6fe",
        padding: "20px",
        opacity: 0.8,
        boxShadow: "0 20px 40px rgba(139,92,246,0.2)",
      }}
    >
      <p className="text-sm font-semibold text-brand-400">{title}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DraggableDashboardProps {
  widgets: WidgetConfig[];
  onReorder: (widgets: WidgetConfig[]) => void;
  renderWidget: (widget: WidgetConfig) => ReactNode;
  getTitle: (id: string) => string;
}

export function DraggableDashboard({
  widgets,
  onReorder,
  renderWidget,
  getTitle,
}: DraggableDashboardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (over && active.id !== over.id) {
      const oldIdx = widgets.findIndex((w) => w.id === active.id);
      const newIdx = widgets.findIndex((w) => w.id === over.id);
      onReorder(arrayMove(widgets, oldIdx, newIdx));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
          }}
        >
          <AnimatePresence>
            {widgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                title={getTitle(widget.id)}
              >
                {renderWidget(widget)}
              </SortableWidget>
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeId ? <GhostWidget title={getTitle(activeId)} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
