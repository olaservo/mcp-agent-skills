# mcp-apps-ts

Agent skill for building interactive HTML UIs for MCP servers using the MCP Apps extension (SEP-1865).

## Overview

This skill provides guidance, code snippets, and reference documentation for:

- **Server developers**: Register tools with UI resources
- **App developers**: Build HTML UIs that run in sandboxed iframes
- **Host developers**: Embed MCP Apps in chat applications

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Main guidance and workflow |
| `manifest.json` | Snippet index and metadata |
| `reference/mcp_apps_api_reference.md` | Complete API documentation |
| `reference/mcp_apps_architecture.md` | Architecture, security, pitfalls |
| `snippets/` | Code snippets organized by role |

## Usage

Load this skill when working on MCP Apps projects. The SKILL.md provides a phased workflow:

1. **Research** - Understand the architecture and browse snippets
2. **Implement** - Copy and customize snippets for your use case
3. **Test** - Build and test with the reference host

## Upstream

This skill tracks the [ext-apps repository](https://github.com/modelcontextprotocol/ext-apps). Check there for the latest SDK changes.

---

## Changelog

### 2026-01-16 (Audit Fix) - AppBridge documentation gaps

**Added to API Reference:**
- AppBridge methods: `getAppCapabilities`, `getAppVersion`, `getCapabilities`, `setHostContext`, `sendHostContextChange`, `sendToolInputPartial`, `teardownResource`, `sendToolListChanged`, `sendResourceListChanged`, `sendPromptListChanged`
- AppBridge handlers: `onrequestdisplaymode`, `onupdatemodelcontext`, `oncalltool`, `onlistresources`, `onreadresource`, `onlistprompts`, `onsandboxready`
- Helper function: `buildAllowAttribute`

### 2026-01-16 - Updated for ext-apps v0.4.1

**New Features Documented:**
- Display modes (fullscreen, pip) - `requestDisplayMode()`
- Model context updates - `updateModelContext()`
- Host context and styling - `getHostContext()`, `onhostcontextchanged`
- Tool cancellation - `ontoolcancelled` handler
- Tool visibility - `visibility: ["app"]` for private tools
- React styling hooks - `useHostStyleVariables`, `useHostFonts`, `useHostStyles`

**New Snippets:**
- `app-with-display-mode.ts` - Request fullscreen/pip modes
- `app-react-with-styles.tsx` - React with host styling hooks
- `server-with-private-tools.ts` - Tools hidden from model
- `app-with-model-context.ts` - Update model context with app state

**Updated Snippets:**
- `app-vanilla-full.ts` - Added `ontoolcancelled`, `onhostcontextchanged`, host context
- `app-react-basic.tsx` - Added all new handlers and host context support

**Documentation:**
- Added "Host Context" section to architecture docs
- Added "Display Modes" section
- Added "Model Context Updates" section
- Added "Tool Visibility" section
- Added "Open PRs & Issues to Watch" section
- Updated Common Pitfalls with handler overwrite warning (#225)
- Added v0.4.1 changes summary

**API Reference:**
- Added new App methods: `updateModelContext`, `requestDisplayMode`, `sendSizeChanged`, `setupSizeChangedNotifications`, `getHostCapabilities`, `getHostVersion`, `getHostContext`
- Added new handlers: `ontoolcancelled`, `ontoolinputpartial`, `onhostcontextchanged`, `oncalltool`, `onlisttools`
- Added new React hooks: `useHostStyleVariables`, `useHostFonts`, `useHostStyles`, `useDocumentTheme`, `useAutoResize`
- Added `McpUiHostContext` type documentation
- Added Style Utilities section

### Initial Release

- Basic skill structure with SKILL.md, manifest.json, reference docs
- Snippets for server, app, and host roles
- Scaffold starter project (vanilla-server)
