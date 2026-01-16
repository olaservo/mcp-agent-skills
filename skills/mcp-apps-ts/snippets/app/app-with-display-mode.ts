/**
 * MCP App with display mode support (fullscreen, pip).
 *
 * Shows how to:
 * - Check available display modes from host context
 * - Request fullscreen or picture-in-picture mode
 * - Handle display mode changes
 *
 * Customize:
 * - Add UI controls for toggling display modes
 * - Handle mode-specific layouts
 */

import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({
  name: "Display Mode App",
  version: "1.0.0",
});

// Track current display mode
let currentDisplayMode: "inline" | "fullscreen" | "pip" = "inline";

// ============================================================
// DISPLAY MODE HELPERS
// ============================================================

/**
 * Check if a display mode is available
 */
function isDisplayModeAvailable(mode: "inline" | "fullscreen" | "pip"): boolean {
  const context = app.getHostContext();
  return context?.availableDisplayModes?.includes(mode) ?? false;
}

/**
 * Request a new display mode
 */
async function setDisplayMode(mode: "inline" | "fullscreen" | "pip"): Promise<boolean> {
  if (!isDisplayModeAvailable(mode)) {
    console.warn(`Display mode "${mode}" is not available`);
    return false;
  }

  try {
    const result = await app.requestDisplayMode({ mode });
    currentDisplayMode = result.mode as typeof currentDisplayMode;
    console.log("Display mode changed to:", result.mode);
    updateUI();
    return true;
  } catch (error) {
    console.error("Failed to change display mode:", error);
    return false;
  }
}

/**
 * Toggle between inline and fullscreen
 */
async function toggleFullscreen(): Promise<void> {
  if (currentDisplayMode === "fullscreen") {
    await setDisplayMode("inline");
  } else {
    await setDisplayMode("fullscreen");
  }
}

// ============================================================
// UI UPDATES
// ============================================================

function updateUI(): void {
  const modeDisplay = document.getElementById("current-mode");
  const fullscreenBtn = document.getElementById("fullscreen-btn") as HTMLButtonElement;
  const pipBtn = document.getElementById("pip-btn") as HTMLButtonElement;

  if (modeDisplay) {
    modeDisplay.textContent = currentDisplayMode;
  }

  if (fullscreenBtn) {
    fullscreenBtn.textContent = currentDisplayMode === "fullscreen"
      ? "Exit Fullscreen"
      : "Enter Fullscreen";
    fullscreenBtn.disabled = !isDisplayModeAvailable("fullscreen");
  }

  if (pipBtn) {
    pipBtn.textContent = currentDisplayMode === "pip"
      ? "Exit PiP"
      : "Enter PiP";
    pipBtn.disabled = !isDisplayModeAvailable("pip");
  }
}

// ============================================================
// EVENT HANDLERS
// ============================================================

app.ontoolresult = (result) => {
  console.log("Tool result:", result);
};

app.onhostcontextchanged = (params) => {
  console.log("Host context changed:", params);
  // Update UI when available display modes change
  updateUI();
};

app.onerror = console.error;

// ============================================================
// BUTTON HANDLERS
// ============================================================

document.getElementById("fullscreen-btn")?.addEventListener("click", () => {
  toggleFullscreen();
});

document.getElementById("pip-btn")?.addEventListener("click", async () => {
  if (currentDisplayMode === "pip") {
    await setDisplayMode("inline");
  } else {
    await setDisplayMode("pip");
  }
});

document.getElementById("inline-btn")?.addEventListener("click", () => {
  setDisplayMode("inline");
});

// ============================================================
// CONNECT
// ============================================================

app.connect().then(() => {
  console.log("Connected");

  // Log available display modes
  const context = app.getHostContext();
  console.log("Available display modes:", context?.availableDisplayModes);

  // Initialize UI
  updateUI();
});

// ============================================================
// EXAMPLE HTML (for reference)
// ============================================================
/*
<div id="app">
  <p>Current mode: <strong id="current-mode">inline</strong></p>
  <div>
    <button id="fullscreen-btn">Enter Fullscreen</button>
    <button id="pip-btn">Enter PiP</button>
    <button id="inline-btn">Inline</button>
  </div>
</div>
*/
