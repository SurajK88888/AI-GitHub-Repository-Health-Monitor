"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { WidgetVisibilitySettings } from "./types";
import { REGISTERED_WIDGETS } from "./registry";

const STORAGE_KEY = "gh_health_widgets_controller_settings";

const DEFAULT_SETTINGS: WidgetVisibilitySettings = {
  masterEnabled: true,
  widgets: REGISTERED_WIDGETS.reduce<Record<string, boolean>>((acc, widget) => {
    acc[widget.id] = widget.defaultVisible;
    return acc;
  }, {}),
};

interface WidgetContextValue {
  settings: WidgetVisibilitySettings;
  mounted: boolean;
  setMasterEnabled: (enabled: boolean) => void;
  setWidgetVisible: (widgetId: string, visible: boolean) => void;
  showAllWidgets: () => void;
  hideAllWidgets: () => void;
  resetAllPositions: () => void;
  isWidgetVisible: (widgetId: string) => boolean;
}

const WidgetContext = createContext<WidgetContextValue | null>(null);

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<WidgetVisibilitySettings>(DEFAULT_SETTINGS);

  // Load saved settings from localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({
          masterEnabled: typeof parsed.masterEnabled === "boolean" ? parsed.masterEnabled : true,
          widgets: {
            ...DEFAULT_SETTINGS.widgets,
            ...(parsed.widgets || {}),
          },
        });
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const persistSettings = useCallback((newSettings: WidgetVisibilitySettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch {
      // silent
    }
  }, []);

  const setMasterEnabled = useCallback((enabled: boolean) => {
    persistSettings({
      ...settings,
      masterEnabled: enabled,
    });
  }, [settings, persistSettings]);

  const setWidgetVisible = useCallback((widgetId: string, visible: boolean) => {
    persistSettings({
      ...settings,
      widgets: {
        ...settings.widgets,
        [widgetId]: visible,
      },
    });
  }, [settings, persistSettings]);

  const showAllWidgets = useCallback(() => {
    const allEnabled = REGISTERED_WIDGETS.reduce<Record<string, boolean>>((acc, widget) => {
      acc[widget.id] = true;
      return acc;
    }, {});
    persistSettings({
      masterEnabled: true,
      widgets: allEnabled,
    });
  }, [persistSettings]);

  const hideAllWidgets = useCallback(() => {
    persistSettings({
      ...settings,
      masterEnabled: false,
    });
  }, [settings, persistSettings]);

  const resetAllPositions = useCallback(() => {
    try {
      localStorage.removeItem("gh_health_clock_widget_position");
      localStorage.removeItem("gh_health_theme_widget_position");
      localStorage.removeItem("gh_health_controller_widget_position");
      // Notify active widgets to snap back
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("gh_health_reset_widget_positions"));
      }
    } catch {
      // silent
    }
  }, []);

  const isWidgetVisible = useCallback((widgetId: string): boolean => {
    if (!settings.masterEnabled) return false;
    return settings.widgets[widgetId] ?? true;
  }, [settings]);

  return (
    <WidgetContext.Provider
      value={{
        settings,
        mounted,
        setMasterEnabled,
        setWidgetVisible,
        showAllWidgets,
        hideAllWidgets,
        resetAllPositions,
        isWidgetVisible,
      }}
    >
      {children}
    </WidgetContext.Provider>
  );
}

export function useWidgetController() {
  const ctx = useContext(WidgetContext);
  if (!ctx) {
    throw new Error("useWidgetController must be used within a WidgetProvider");
  }
  return ctx;
}
