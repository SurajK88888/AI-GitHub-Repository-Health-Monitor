"use client";

import React from "react";
import { ClockWidget } from "./clock";

/**
 * WidgetContainer — Global container for all floating, draggable, and utility widgets.
 * 
 * Add any future dashboard/system widgets here to have them available globally across all pages.
 */
export function WidgetContainer() {
  return (
    <div id="app-widget-container" className="pointer-events-auto">
      {/* Real-time Draggable System Clock */}
      <ClockWidget />
      
      {/* Future widgets can be registered here */}
    </div>
  );
}
