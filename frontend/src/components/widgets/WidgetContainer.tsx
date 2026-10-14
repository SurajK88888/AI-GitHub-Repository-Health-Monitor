"use client";

import React from "react";
import { ClockWidget } from "./clock";
import { ThemeToggleWidget } from "./theme-toggle";
import { WidgetController, WidgetProvider, useWidgetController } from "./controller";

function ActiveWidgetsRenderer() {
  const { isWidgetVisible } = useWidgetController();

  return (
    <>
      {/* Widget Controller — Master Switch & Visibility Manager */}
      <WidgetController />

      {/* Dark / Bright Theme Switcher Widget */}
      {isWidgetVisible("themeToggle") && <ThemeToggleWidget />}

      {/* Real-time Draggable System Clock */}
      {isWidgetVisible("clock") && <ClockWidget />}
    </>
  );
}

/**
 * WidgetContainer — Global orchestrator for all floating, draggable, and utility widgets.
 * 
 * Powered by WidgetController: users can toggle all widgets or selectively enable individual ones.
 */
export function WidgetContainer() {
  return (
    <WidgetProvider>
      <div id="app-widget-container" className="pointer-events-auto">
        <ActiveWidgetsRenderer />
      </div>
    </WidgetProvider>
  );
}
