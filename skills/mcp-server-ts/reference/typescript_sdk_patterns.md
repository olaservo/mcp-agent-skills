# TypeScript SDK Patterns

Quick reference for MCP TypeScript SDK patterns. For complete examples, fetch snippets using the `add` script.

---

## Key Imports

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
```

---

## Server Initialization

```typescript
const server = new McpServer(
  {
    name: "my-service-mcp-server",
    title: "My Service MCP Server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: true },
      logging: {}
    },
    instructions: "Optional instructions for LLM on how to use this server"
  }
);
```

**Naming convention:** `{service}-mcp-server` (lowercase with hyphens)

---

## Tool Registration

**Use `server.registerTool()` - NOT the deprecated `server.tool()` API**

```typescript
// Define Zod schema for input validation
const MyToolSchema = z.object({
  query: z.string().describe("Search query"),
  limit: z.number().int().min(1).max(100).default(20).describe("Max results")
});

// Register the tool
server.registerTool(
  "my_tool_name",  // Use snake_case with service prefix
  {
    title: "My Tool",
    description: "What this tool does. Include parameter descriptions and examples.",
    inputSchema: MyToolSchema,
    annotations: {
      readOnlyHint: true,      // Does not modify environment
      destructiveHint: false,  // Does not perform destructive updates
      idempotentHint: true,    // Safe to call multiple times
      openWorldHint: true      // Interacts with external entities
    }
  },
  async (args): Promise<CallToolResult> => {
    const validated = MyToolSchema.parse(args);

    // Your implementation here
    const result = await doSomething(validated.query, validated.limit);

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);
```

### Tool Result Content Types

```typescript
// Text content
{ type: "text", text: "Result string" }

// Image content
{ type: "image", data: base64String, mimeType: "image/png" }

// Structured content (modern SDK feature)
return {
  content: [{ type: "text", text: JSON.stringify(output) }],
  structuredContent: output  // Typed object for programmatic access
};
```

---

## Resource Registration

```typescript
// Static resource
server.registerResource(
  "config",  // Resource name
  undefined, // No template (static URI)
  {
    uri: "myapp://config",
    name: "Configuration",
    description: "Application configuration",
    mimeType: "application/json"
  },
  async () => ({
    contents: [{
      uri: "myapp://config",
      mimeType: "application/json",
      text: JSON.stringify(config)
    }]
  })
);

// Dynamic resource with URI template
server.registerResource(
  "user",
  new ResourceTemplate("myapp://users/{userId}", { list: undefined }),
  {
    name: "User Profile",
    description: "User profile by ID",
    mimeType: "application/json"
  },
  async (uri, { userId }) => ({
    contents: [{
      uri,
      mimeType: "application/json",
      text: JSON.stringify(await getUser(userId))
    }]
  })
);
```

---

## Prompt Registration

```typescript
// Simple prompt (no arguments)
server.registerPrompt(
  "summarize",
  {
    name: "Summarize",
    description: "Summarize the current context"
  },
  async () => ({
    messages: [{
      role: "user",
      content: { type: "text", text: "Please summarize the key points." }
    }]
  })
);

// Prompt with arguments
const AnalyzeArgsSchema = z.object({
  topic: z.string().describe("Topic to analyze"),
  depth: z.enum(["brief", "detailed"]).default("brief")
});

server.registerPrompt(
  "analyze",
  {
    name: "Analyze Topic",
    description: "Analyze a specific topic",
    argsSchema: AnalyzeArgsSchema
  },
  async (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Analyze "${args.topic}" with ${args.depth} depth.`
      }
    }]
  })
);
```

---

## Transport Configuration

### stdio (Local/CLI)

```typescript
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Server running via stdio");
}

main().catch(console.error);
```

### Streamable HTTP (Remote)

```typescript
import express from "express";

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on('close', () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3000, () => {
  console.error("Server running on http://localhost:3000/mcp");
});
```

---

## Zod Schema Patterns

```typescript
// Basic types with validation
z.string().min(1).max(100).describe("Description")
z.number().int().min(0).max(100).default(10)
z.boolean().default(false)
z.array(z.string()).min(1).max(10)

// Enums
z.enum(["option1", "option2", "option3"])
z.nativeEnum(MyEnum)  // For TypeScript enums

// Optional with defaults
z.string().optional()
z.number().default(20)

// Strict objects (reject unknown fields)
z.object({
  name: z.string(),
  age: z.number()
}).strict()

// Type inference
type MyInput = z.infer<typeof MySchema>;
```

---

## Error Handling

```typescript
server.registerTool("my_tool", config, async (args) => {
  try {
    const result = await riskyOperation(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  } catch (error) {
    // Return error as content, don't throw
    return {
      content: [{
        type: "text",
        text: formatError(error)
      }],
      isError: true
    };
  }
});

function formatError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return `Validation error: ${error.errors.map(e => e.message).join(", ")}`;
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Unknown error: ${String(error)}`;
}
```

---

## Progress Notifications

For long-running operations:

```typescript
server.registerTool("long_operation", config, async (args, extra) => {
  const { sendProgress } = extra;

  for (let i = 0; i < 100; i += 10) {
    await doWork();
    await sendProgress({ progress: i, total: 100 });
  }

  return {
    content: [{ type: "text", text: "Complete!" }]
  };
});
```

---

## Checking Client Capabilities

```typescript
server.server.oninitialized = async () => {
  const capabilities = server.server.getClientCapabilities();

  if (capabilities?.sampling) {
    // Client supports sampling - can register sampling-dependent tools
    registerSamplingTools(server);
  }

  if (capabilities?.roots?.listChanged) {
    // Client supports roots
    await syncRoots(server);
  }
};
```

---

## Project Configuration

### package.json

```json
{
  "name": "my-service-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "my-service-mcp-server": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "inspector": "npx @modelcontextprotocol/inspector node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.24.3",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Best Practices

1. **Use modern APIs**: `registerTool()`, `registerResource()`, `registerPrompt()` - NOT deprecated `tool()`, `resource()`, etc.

2. **Service-prefix tool names**: `github_create_issue` not `create_issue`

3. **Comprehensive descriptions**: Include parameter explanations, examples, and error conditions

4. **Zod for validation**: Always use Zod schemas with `.strict()` for input validation

5. **Error as content**: Return errors in content array with `isError: true`, don't throw

6. **Type safety**: Use `z.infer<typeof Schema>` for type inference

7. **ES modules**: Use `.js` extensions in imports, set `"type": "module"` in package.json
