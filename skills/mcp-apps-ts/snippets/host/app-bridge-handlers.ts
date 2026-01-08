/**
 * Source: https://github.com/modelcontextprotocol/ext-apps/blob/main/examples/basic-host/src/implementation.ts
 *
 * Full AppBridge handler configuration.
 * Register these handlers BEFORE calling connect().
 *
 * Customize each handler for your host application's needs.
 */

import { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge";

// Logging helper
const log = {
  info: console.log.bind(console, "[HOST]"),
  error: console.error.bind(console, "[HOST]"),
};

/**
 * Configure all handlers on an AppBridge instance.
 *
 * @param appBridge - The AppBridge to configure
 * @param iframe - The iframe element containing the app
 */
function configureAppBridgeHandlers(
  appBridge: AppBridge,
  iframe: HTMLIFrameElement
): void {
  /**
   * Called when the app sends a message for display in the chat.
   * Return {} to accept, or { isError: true } to reject.
   */
  appBridge.onmessage = async (params, _extra) => {
    log.info("Message from app:", params);

    // params.role: "user" | "assistant"
    // params.content: Array<{ type: "text", text: string }>

    // Example: Display in your chat UI
    // chatUI.addMessage(params.role, params.content);

    return {}; // Accept message
  };

  /**
   * Called when the app requests to open a URL.
   * You can validate the URL before opening.
   */
  appBridge.onopenlink = async (params, _extra) => {
    log.info("Open link request:", params.url);

    // Security: Validate URL before opening
    try {
      const url = new URL(params.url);

      // Only allow http/https
      if (!["http:", "https:"].includes(url.protocol)) {
        log.error("Blocked non-http URL:", params.url);
        return { isError: true };
      }

      // Open in new tab with security attributes
      window.open(params.url, "_blank", "noopener,noreferrer");
      return {}; // Accept
    } catch {
      log.error("Invalid URL:", params.url);
      return { isError: true };
    }
  };

  /**
   * Called when the app sends a log entry.
   * Useful for debugging and audit trails.
   */
  appBridge.onloggingmessage = (params) => {
    const { level, data } = params;

    // Route to appropriate log level
    switch (level) {
      case "debug":
        console.debug("[APP LOG]", data);
        break;
      case "info":
        console.info("[APP LOG]", data);
        break;
      case "warning":
        console.warn("[APP LOG]", data);
        break;
      case "error":
        console.error("[APP LOG]", data);
        break;
      default:
        console.log("[APP LOG]", level, data);
    }
  };

  /**
   * Called when the app requests a size change.
   * The app reports its desired dimensions; you decide how to honor them.
   */
  appBridge.onsizechange = async ({ width, height }) => {
    log.info("Size change request:", { width, height });

    // Get computed style to handle border-box sizing
    const style = getComputedStyle(iframe);
    const isBorderBox = style.boxSizing === "border-box";

    // Prepare animation keyframes
    const from: Keyframe = {};
    const to: Keyframe = {};

    if (width !== undefined) {
      // Account for borders if using border-box
      if (isBorderBox) {
        width +=
          parseFloat(style.borderLeftWidth) +
          parseFloat(style.borderRightWidth);
      }

      // Use min-width to allow responsive growing
      from.minWidth = `${iframe.offsetWidth}px`;
      iframe.style.minWidth = to.minWidth = `min(${width}px, 100%)`;
    }

    if (height !== undefined) {
      if (isBorderBox) {
        height +=
          parseFloat(style.borderTopWidth) +
          parseFloat(style.borderBottomWidth);
      }

      from.height = `${iframe.offsetHeight}px`;
      iframe.style.height = to.height = `${height}px`;
    }

    // Animate the size change for smooth UX
    iframe.animate([from, to], {
      duration: 300,
      easing: "ease-out",
    });
  };

  /**
   * Called when the app is fully initialized and ready.
   * This is the signal that you can start sending tool input/results.
   */
  appBridge.oninitialized = () => {
    log.info("App initialized and ready");
  };
}

/**
 * Example: Minimal handler configuration
 * Use this when you just need basic functionality.
 */
function configureMinimalHandlers(appBridge: AppBridge): void {
  // Accept all messages
  appBridge.onmessage = async () => ({});

  // Open all links (less secure)
  appBridge.onopenlink = async ({ url }) => {
    window.open(url, "_blank");
    return {};
  };

  // Log all app logs
  appBridge.onloggingmessage = ({ level, data }) => {
    console.log(`[APP ${level}]`, data);
  };
}

/**
 * Example: Restrictive handler configuration
 * Use this when security is paramount.
 */
function configureRestrictiveHandlers(appBridge: AppBridge): void {
  // Reject all messages (don't allow app to post to chat)
  appBridge.onmessage = async () => ({ isError: true });

  // Only allow specific domains
  const allowedDomains = ["modelcontextprotocol.io", "github.com"];

  appBridge.onopenlink = async ({ url }) => {
    try {
      const hostname = new URL(url).hostname;
      if (allowedDomains.some((d) => hostname.endsWith(d))) {
        window.open(url, "_blank", "noopener,noreferrer");
        return {};
      }
    } catch {
      // Invalid URL
    }
    log.info("Blocked URL:", url);
    return { isError: true };
  };

  // Silent logging (don't show to console)
  appBridge.onloggingmessage = () => {};

  // Fixed size (ignore size requests)
  appBridge.onsizechange = async () => {};
}

export {
  configureAppBridgeHandlers,
  configureMinimalHandlers,
  configureRestrictiveHandlers,
};
