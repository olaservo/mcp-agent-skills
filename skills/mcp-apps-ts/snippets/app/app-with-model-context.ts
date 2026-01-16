/**
 * MCP App with model context updates.
 *
 * Shows how to:
 * - Update the host's model context with app state
 * - Send structured content for model reasoning
 * - Persist state across conversation turns
 *
 * Customize:
 * - Define your structured content schema
 * - Update context when meaningful state changes occur
 */

import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({
  name: "Model Context App",
  version: "1.0.0",
});

// Track app state
interface AppState {
  selectedItems: string[];
  filters: Record<string, string>;
  lastAction: string;
  timestamp: number;
}

let appState: AppState = {
  selectedItems: [],
  filters: {},
  lastAction: "initialized",
  timestamp: Date.now(),
};

// ============================================================
// MODEL CONTEXT HELPERS
// ============================================================

/**
 * Update the model context with current app state.
 *
 * The host will typically defer sending this to the model until
 * the next user message. Each call overwrites the previous context.
 */
async function updateModelContext(): Promise<void> {
  try {
    // Send both text and structured content
    await app.updateModelContext({
      // Human-readable summary
      content: [
        {
          type: "text",
          text: formatStateAsText(appState),
        },
      ],
      // Structured data for model to reference
      structuredContent: appState,
    });

    console.log("Model context updated:", appState);
  } catch (error) {
    console.error("Failed to update model context:", error);
  }
}

/**
 * Format state as human-readable text
 */
function formatStateAsText(state: AppState): string {
  const lines: string[] = [];

  if (state.selectedItems.length > 0) {
    lines.push(`Selected items: ${state.selectedItems.join(", ")}`);
  } else {
    lines.push("No items selected");
  }

  const filterEntries = Object.entries(state.filters);
  if (filterEntries.length > 0) {
    const filterStr = filterEntries
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");
    lines.push(`Active filters: ${filterStr}`);
  }

  lines.push(`Last action: ${state.lastAction}`);

  return lines.join("\n");
}

// ============================================================
// STATE MODIFICATION FUNCTIONS
// ============================================================

/**
 * Select an item and update model context
 */
async function selectItem(itemId: string): Promise<void> {
  if (!appState.selectedItems.includes(itemId)) {
    appState.selectedItems.push(itemId);
    appState.lastAction = `selected ${itemId}`;
    appState.timestamp = Date.now();

    updateUI();
    await updateModelContext();
  }
}

/**
 * Deselect an item and update model context
 */
async function deselectItem(itemId: string): Promise<void> {
  const index = appState.selectedItems.indexOf(itemId);
  if (index > -1) {
    appState.selectedItems.splice(index, 1);
    appState.lastAction = `deselected ${itemId}`;
    appState.timestamp = Date.now();

    updateUI();
    await updateModelContext();
  }
}

/**
 * Set a filter and update model context
 */
async function setFilter(key: string, value: string): Promise<void> {
  appState.filters[key] = value;
  appState.lastAction = `filtered by ${key}=${value}`;
  appState.timestamp = Date.now();

  updateUI();
  await updateModelContext();
}

/**
 * Clear all filters and update model context
 */
async function clearFilters(): Promise<void> {
  appState.filters = {};
  appState.lastAction = "cleared filters";
  appState.timestamp = Date.now();

  updateUI();
  await updateModelContext();
}

/**
 * Clear selection and update model context
 */
async function clearSelection(): Promise<void> {
  appState.selectedItems = [];
  appState.lastAction = "cleared selection";
  appState.timestamp = Date.now();

  updateUI();
  await updateModelContext();
}

// ============================================================
// UI UPDATES
// ============================================================

function updateUI(): void {
  const selectedDisplay = document.getElementById("selected-items");
  const filtersDisplay = document.getElementById("active-filters");
  const lastActionDisplay = document.getElementById("last-action");

  if (selectedDisplay) {
    selectedDisplay.textContent = appState.selectedItems.length > 0
      ? appState.selectedItems.join(", ")
      : "None";
  }

  if (filtersDisplay) {
    const filterStr = Object.entries(appState.filters)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    filtersDisplay.textContent = filterStr || "None";
  }

  if (lastActionDisplay) {
    lastActionDisplay.textContent = appState.lastAction;
  }
}

// ============================================================
// EVENT HANDLERS
// ============================================================

app.ontoolresult = (result) => {
  console.log("Tool result:", result);

  // If tool returns items, you might want to update context
  if (result.structuredContent?.items) {
    // Process items and potentially update selection
  }
};

app.onhostcontextchanged = (params) => {
  console.log("Host context changed:", params);
};

app.onerror = console.error;

// ============================================================
// BUTTON HANDLERS
// ============================================================

// Example: Select items
document.querySelectorAll("[data-select-item]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const itemId = (e.target as HTMLElement).dataset.selectItem;
    if (itemId) selectItem(itemId);
  });
});

// Example: Deselect items
document.querySelectorAll("[data-deselect-item]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const itemId = (e.target as HTMLElement).dataset.deselectItem;
    if (itemId) deselectItem(itemId);
  });
});

// Example: Filter controls
document.getElementById("apply-filter")?.addEventListener("click", () => {
  const keyInput = document.getElementById("filter-key") as HTMLInputElement;
  const valueInput = document.getElementById("filter-value") as HTMLInputElement;
  if (keyInput?.value && valueInput?.value) {
    setFilter(keyInput.value, valueInput.value);
  }
});

document.getElementById("clear-filters")?.addEventListener("click", clearFilters);
document.getElementById("clear-selection")?.addEventListener("click", clearSelection);

// ============================================================
// CONNECT
// ============================================================

app.connect().then(() => {
  console.log("Connected");
  updateUI();

  // Send initial context
  updateModelContext();
});

// ============================================================
// EXAMPLE HTML (for reference)
// ============================================================
/*
<div id="app">
  <section>
    <h2>Selection</h2>
    <p>Selected items: <span id="selected-items">None</span></p>
    <button data-select-item="item-1">Select Item 1</button>
    <button data-select-item="item-2">Select Item 2</button>
    <button id="clear-selection">Clear Selection</button>
  </section>

  <section>
    <h2>Filters</h2>
    <p>Active filters: <span id="active-filters">None</span></p>
    <input id="filter-key" placeholder="Filter key" />
    <input id="filter-value" placeholder="Filter value" />
    <button id="apply-filter">Apply Filter</button>
    <button id="clear-filters">Clear Filters</button>
  </section>

  <section>
    <p>Last action: <span id="last-action">initialized</span></p>
  </section>
</div>
*/
