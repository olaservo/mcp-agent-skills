# MCP App Server Scaffold (Vanilla JS)

A complete, runnable MCP App server with vanilla JavaScript UI. Copy this entire directory and run immediately.

## Quick Start

```bash
# Install dependencies
npm install

# Build and start server (development mode with hot reload)
npm run dev
```

Server runs at `http://localhost:3102/mcp`

## Test with a Host

The server alone won't display the UI - you need an MCP host that supports MCP Apps. Options:

1. **basic-host example** from ext-apps repo:
   ```bash
   git clone https://github.com/modelcontextprotocol/ext-apps
   cd ext-apps/examples/basic-host
   npm install && npm start
   ```

2. **MCP Inspector** - Connect to `http://localhost:3102/mcp` and invoke the tool

## Project Structure

```
vanilla-server/
├── server.ts           # MCP server: tool + UI resource registration
├── server-utils.ts     # HTTP transport helper (stateless mode)
├── mcp-app.html        # HTML entry point for the UI
├── src/
│   ├── mcp-app.ts      # App logic: lifecycle handlers + event handlers
│   ├── global.css      # Base styles (box-sizing, fonts)
│   └── mcp-app.css     # App-specific styles
├── vite.config.ts      # Vite build config (bundles to single HTML file)
├── package.json        # Dependencies and scripts
└── tsconfig.json       # TypeScript configuration
```

## How It Works

1. **Server registers a tool** (`get-time`) with metadata linking to a UI resource
2. **Server registers a resource** (`ui://get-time/mcp-app.html`) that serves bundled HTML
3. **Host invokes tool** → receives result + displays linked UI
4. **App connects to host** and can call tools, send messages, logs, open links

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Build + serve with hot reload |
| `npm run build` | Production build |
| `npm run serve` | Start server (after build) |
| `npm start` | Build once + serve |

## Customization Checklist

- [ ] Rename package in `package.json`
- [ ] Update tool name in `server.ts` (replace `"get-time"`)
- [ ] Update `RESOURCE_URI` to match your tool name
- [ ] Modify `inputSchema` for your parameters
- [ ] Implement your tool handler logic
- [ ] Update HTML in `mcp-app.html`
- [ ] Customize app logic in `src/mcp-app.ts`
- [ ] Update styles in `src/mcp-app.css`

## Key Patterns

### Tool + UI Registration (server.ts)

```typescript
// Tools need _meta to link to their UI
registerAppTool(server, "my-tool", {
  title: "My Tool",
  description: "What it does",
  inputSchema: { /* zod or JSON schema */ },
  _meta: { [RESOURCE_URI_META_KEY]: "ui://my-tool/app.html" },
}, async (params) => {
  // Return tool result
  return { content: [{ type: "text", text: "result" }] };
});

// Resource serves the bundled UI HTML
registerAppResource(server, "ui://my-tool/app.html", /* ... */);
```

### App Lifecycle (src/mcp-app.ts)

```typescript
const app = new App({ name: "My App", version: "1.0.0" });

// Register handlers BEFORE connecting
app.ontoolresult = (result) => { /* update UI */ };
app.ontoolinput = (params) => { /* handle input */ };
app.onerror = (error) => { /* handle errors */ };
app.onteardown = async () => { /* cleanup */ };

// Then connect
await app.connect();
```

## Related Snippets

For individual patterns, see the skill's other snippets:
- `server/tool-with-ui.ts` - Tool registration patterns
- `app/app-vanilla-full.ts` - Full lifecycle handlers
- `host/app-bridge-basic.ts` - Host-side integration
