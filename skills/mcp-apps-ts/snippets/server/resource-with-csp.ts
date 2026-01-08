/**
 * UI resource with Content Security Policy (CSP) metadata.
 *
 * CSP metadata tells the host which external domains the UI needs access to.
 * The host enforces these policies via Content-Security-Policy headers.
 *
 * Customize:
 * - Add domains your UI needs for fetch/XHR to connectDomains
 * - Add domains for images/scripts/styles to resourceDomains
 * - Leave arrays empty for maximum security (no external access)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import {
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

function registerResourceWithCSP(server: McpServer): void {
  const resourceUri = "ui://secure-dashboard/mcp-app.html";

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Secure Dashboard</title></head>
          <body>
            <div id="app">Loading...</div>
            <script type="module">
              // Your bundled app code
            </script>
          </body>
        </html>
      `;

      return {
        contents: [
          {
            uri: resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            // CSP metadata - host enforces these policies
            _meta: {
              ui: {
                csp: {
                  // Domains allowed for fetch(), XMLHttpRequest, WebSocket
                  connectDomains: [
                    "api.example.com",
                    "ws.example.com",
                  ],
                  // Domains allowed for images, scripts, stylesheets, fonts
                  resourceDomains: [
                    "cdn.example.com",
                    "fonts.googleapis.com",
                  ],
                },
              },
            },
          },
        ],
      };
    }
  );
}

/**
 * Example: Maximum security (no external access)
 * Empty arrays = no external connections or resources allowed
 */
function registerRestrictedResource(server: McpServer): void {
  const resourceUri = "ui://offline-tool/mcp-app.html";

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = "<!-- Your self-contained HTML -->";

      return {
        contents: [
          {
            uri: resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                csp: {
                  // Empty = no external connections allowed
                  connectDomains: [],
                  // Empty = no external resources allowed
                  resourceDomains: [],
                },
              },
            },
          },
        ],
      };
    }
  );
}

/**
 * Example: No CSP metadata (host uses defaults)
 * Default CSP: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'
 * This blocks all external access and only allows inline scripts/styles.
 */
function registerDefaultCSPResource(server: McpServer): void {
  const resourceUri = "ui://default-csp/mcp-app.html";

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = "<!-- Your HTML -->";

      // No _meta.ui.csp = host applies restrictive defaults
      return {
        contents: [
          { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    }
  );
}

export {
  registerResourceWithCSP,
  registerRestrictedResource,
  registerDefaultCSPResource,
};
