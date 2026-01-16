/**
 * MCP Server with private (app-only) tools.
 *
 * Shows how to:
 * - Create tools visible to both model and app (default)
 * - Create tools only visible to the app (hidden from model)
 * - Use visibility for UI-triggered actions
 *
 * Customize:
 * - Add your own public and private tools
 * - Match tool names with your UI actions
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import * as fs from "fs";

const server = new McpServer({
  name: "Shop Server",
  version: "1.0.0",
});

// Simulated cart data
let cart: { id: string; name: string; quantity: number; price: number }[] = [];

// ============================================================
// PUBLIC TOOL - Visible to both model and app
// ============================================================

/**
 * This tool can be called by the model ("show me the cart")
 * or by the app UI.
 */
registerAppTool(
  server,
  "show-cart",
  {
    title: "Show Shopping Cart",
    description: "Display the user's shopping cart",
    _meta: {
      ui: {
        resourceUri: "ui://shop/cart.html",
        // Default visibility: ["model", "app"] - both can call this tool
      },
    },
  },
  async () => {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return {
      content: [
        {
          type: "text",
          text: `Cart has ${cart.length} items, total: $${total.toFixed(2)}`,
        },
      ],
      structuredContent: { items: cart, total },
    };
  }
);

// ============================================================
// PRIVATE TOOLS - Only visible to the app (hidden from model)
// ============================================================

/**
 * This tool is ONLY callable by the app UI.
 * The model won't see it in the tools list.
 * Use this for UI-specific actions like quantity updates.
 */
registerAppTool(
  server,
  "update-quantity",
  {
    title: "Update Item Quantity",
    description: "Update the quantity of an item in the cart",
    inputSchema: {
      itemId: z.string().describe("The item ID to update"),
      quantity: z.number().min(0).describe("New quantity (0 to remove)"),
    },
    _meta: {
      ui: {
        resourceUri: "ui://shop/cart.html",
        visibility: ["app"],  // PRIVATE: Only app can call this
      },
    },
  },
  async ({ itemId, quantity }) => {
    const itemIndex = cart.findIndex((item) => item.id === itemId);

    if (itemIndex === -1) {
      return {
        content: [{ type: "text", text: `Item ${itemId} not found` }],
        isError: true,
      };
    }

    if (quantity === 0) {
      cart.splice(itemIndex, 1);
      return {
        content: [{ type: "text", text: `Removed item ${itemId}` }],
        structuredContent: { items: cart },
      };
    }

    cart[itemIndex].quantity = quantity;
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      content: [{ type: "text", text: `Updated ${itemId} quantity to ${quantity}` }],
      structuredContent: { items: cart, total },
    };
  }
);

/**
 * Another private tool for UI-specific actions.
 */
registerAppTool(
  server,
  "remove-item",
  {
    title: "Remove Item",
    description: "Remove an item from the cart",
    inputSchema: {
      itemId: z.string().describe("The item ID to remove"),
    },
    _meta: {
      ui: {
        resourceUri: "ui://shop/cart.html",
        visibility: ["app"],  // PRIVATE: Only app can call this
      },
    },
  },
  async ({ itemId }) => {
    const itemIndex = cart.findIndex((item) => item.id === itemId);

    if (itemIndex === -1) {
      return {
        content: [{ type: "text", text: `Item ${itemId} not found` }],
        isError: true,
      };
    }

    const removed = cart.splice(itemIndex, 1)[0];
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      content: [{ type: "text", text: `Removed ${removed.name} from cart` }],
      structuredContent: { items: cart, total },
    };
  }
);

/**
 * Clear the entire cart - also private.
 */
registerAppTool(
  server,
  "clear-cart",
  {
    title: "Clear Cart",
    description: "Remove all items from the cart",
    _meta: {
      ui: {
        resourceUri: "ui://shop/cart.html",
        visibility: ["app"],  // PRIVATE: Only app can call this
      },
    },
  },
  async () => {
    cart = [];
    return {
      content: [{ type: "text", text: "Cart cleared" }],
      structuredContent: { items: [], total: 0 },
    };
  }
);

// ============================================================
// UI RESOURCE
// ============================================================

registerAppResource(
  server,
  "Shopping Cart UI",
  "ui://shop/cart.html",
  {
    description: "Interactive shopping cart interface",
  },
  async () => ({
    contents: [
      {
        uri: "ui://shop/cart.html",
        mimeType: RESOURCE_MIME_TYPE,
        text: fs.readFileSync("dist/cart.html", "utf-8"),
      },
    ],
  })
);

// ============================================================
// START SERVER
// ============================================================

async function main() {
  // Add some sample data
  cart = [
    { id: "item-1", name: "Widget", quantity: 2, price: 9.99 },
    { id: "item-2", name: "Gadget", quantity: 1, price: 24.99 },
  ];

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Shop server running");
}

main().catch(console.error);
