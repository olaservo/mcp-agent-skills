# mcp-apps-ts

Agent skill for developing MCP Apps hosts (AppBridge) and accessing comprehensive MCP Apps reference documentation.

## Overview

### Primary Use Cases

1. **Host Development**: Build applications that embed MCP App UIs
   - AppBridge integration for iframe communication
   - Multi-server routing and tool aggregation
   - Sandbox security implementation

2. **Reference Documentation**: Access complete MCP Apps API without cloning ext-apps
   - Full API reference (App, AppBridge, React hooks)
   - Architecture deep-dive with common pitfalls
   - Protocol flow and security model

### Secondary Use Cases (Reference)

- **Server snippets**: Learn how tools link to UIs (use official `create-mcp-app` skill for scaffolding)
- **App snippets**: Understand UI lifecycle (use official `create-mcp-app` skill for scaffolding)

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

### 2026-01-25 - Repositioned for host development focus

**Reduced trigger overlap with official ext-apps skills:**
- Updated skill description to emphasize host development and reference documentation
- Restructured SKILL.md to lead with host snippets and AppBridge guidance
- Added "When to Use This Skill" section with clear positioning
- Added `@mcp-ui/client` as React alternative for hosts
- Reordered snippets catalog: Host (Primary) → Server/App (Reference) → Scaffold (Learning)
- Updated snippet descriptions in manifest.json with [HOST], [Reference], [Learning] prefixes

**Why:** Official `create-mcp-app` skill now covers server/app development well. This skill's unique value is host development (AppBridge documentation) and comprehensive self-contained reference.

### 2026-01-24 - Official skills acknowledgment

- Updated SDK version in scaffold: `^0.3.1` → `^0.4.1`
- Added notice about official ext-apps Agent Skills (`create-mcp-app`, `migrate-oai-app`)
- Added cross-references to new ext-apps documentation (overview, quickstart, patterns, migration)
- Repositioned as complementary self-contained alternative for learning and agents without plugin access

### 2026-01-21 - Updated for ext-apps post-v0.4.1 changes

**API Reference:**
- Added missing `onlistresourcetemplates` AppBridge handler

**Architecture Docs:**
- Updated "Open PRs & Issues to Watch" with current high-priority PRs (#313, #294, #316, #314, #295)
- Updated "Recent Changes" section with post-v0.4.1 additions (say-server, shadertoy improvements, etc.)

**SKILL.md:**
- Added "Common Gotchas" section covering:
  - Always describe UI in `content` for model context
  - Data flow to model (`content`/`structuredContent` vs `_meta`)
  - Upcoming `hasUiSupport()` pattern for conditional tool registration

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
