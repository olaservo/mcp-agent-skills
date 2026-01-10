/**
 * Claude Agent SDK - Connecting to MCP Servers
 *
 * Connect your agent to external MCP servers for advanced capabilities
 * like resources, prompts, sampling, and tasks.
 *
 * For BUILDING MCP servers, see the mcp-server-ts skill which covers:
 * - Tools, Resources, Prompts, Subscriptions
 * - Logging, Roots, Sampling, Tasks
 * - Full @modelcontextprotocol/sdk patterns
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * MCP Server Connection Types:
 *
 * 1. STDIO (Recommended for local servers)
 *    - Server runs as a separate process
 *    - Communicates via stdin/stdout
 *    - Best for: Local tools, different languages, isolation
 *
 * 2. STREAMABLE HTTP (Recommended for remote servers)
 *    - Server runs as HTTP endpoint
 *    - Modern replacement for SSE transport
 *    - Best for: Shared servers, cloud-hosted, multi-client
 *
 * NOTE: The simplified createSdkMcpServer() only supports tools.
 * For full MCP features (resources, prompts, sampling, tasks),
 * build a proper MCP server and connect via stdio or HTTP.
 */

// =============================================================================
// STDIO SERVER CONFIGURATION
// =============================================================================

/**
 * Connect to an MCP server running as a local process.
 * The SDK spawns the process and communicates via stdin/stdout.
 */
async function runWithStdioServer() {
  const q = query({
    prompt: 'List files in the current directory',
    options: {
      model: 'sonnet',
      maxTurns: 10,

      mcpServers: {
        // Filesystem server - access files in allowed directories
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
        },

        // GitHub server - search repos, read files, create issues
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: {
            GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
          },
        },

        // Your custom MCP server (built with @modelcontextprotocol/sdk)
        'my-server': {
          command: 'node',
          args: ['./dist/my-mcp-server.js'],
          env: {
            DATABASE_URL: process.env.DATABASE_URL || '',
          },
        },

        // Python MCP server
        'python-tools': {
          command: 'python',
          args: ['-m', 'my_mcp_server'],
          env: {
            API_KEY: process.env.MY_API_KEY || '',
          },
        },
      },

      // Tool allowlisting options:
      //
      // 1. Allow ALL tools from a TRUSTED server:
      //    'mcp__filesystem'  - allows all tools from filesystem server
      //    WARNING: Only use this with servers you fully trust!
      //
      // 2. Allow specific tools (safer for untrusted servers):
      //    'mcp__filesystem__read_file'  - allows only read_file
      //
      // For dynamic tools (list_changed), use option 1 so newly
      // registered tools are automatically allowed.
      allowedTools: [
        'mcp__filesystem',           // All tools (trusted server)
        'mcp__github',               // All tools (trusted server)
        'mcp__my-server__safe_tool', // Specific tool only (less trusted)
      ],
    },
  });

  for await (const msg of q) {
    if (msg.type === 'assistant' && msg.message) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && 'text' in block) {
          console.log(block.text);
        }
      }
    }
  }
}

// =============================================================================
// STREAMABLE HTTP SERVER CONFIGURATION
// =============================================================================

/**
 * Connect to a remote MCP server via Streamable HTTP.
 * Modern transport replacing SSE - supports bidirectional streaming.
 */
async function runWithHttpServer() {
  const q = query({
    prompt: 'Search for recent AI papers',
    options: {
      model: 'sonnet',
      maxTurns: 10,

      mcpServers: {
        // Remote MCP server via Streamable HTTP
        'remote-tools': {
          url: 'https://my-mcp-server.example.com/mcp',
          // Optional: Authentication headers
          // headers: {
          //   Authorization: `Bearer ${process.env.MCP_SERVER_TOKEN}`,
          // },
        },
      },

      // Allow all tools from the server (supports dynamic tool discovery)
      allowedTools: ['mcp__remote-tools'],
    },
  });

  for await (const msg of q) {
    // Process messages...
  }
}

// =============================================================================
// POPULAR MCP SERVERS (npm)
// =============================================================================

/**
 * Common MCP servers available via npx:
 *
 * @modelcontextprotocol/server-filesystem
 *   Tools: read_file, write_file, list_directory, create_directory, etc.
 *   Args: ['/path/to/allowed/directory']
 *
 * @modelcontextprotocol/server-github
 *   Tools: search_repositories, get_file_contents, create_issue, etc.
 *   Env: GITHUB_TOKEN
 *
 * @modelcontextprotocol/server-postgres
 *   Tools: query, list_tables, describe_table
 *   Args: [connectionString]
 *
 * @modelcontextprotocol/server-sqlite
 *   Tools: query, list_tables, describe_table
 *   Args: ['/path/to/database.db']
 *
 * @anthropics/mcp-server-brave-search
 *   Tools: brave_web_search, brave_local_search
 *   Env: BRAVE_API_KEY
 *
 * @anthropics/mcp-server-puppeteer
 *   Tools: puppeteer_navigate, puppeteer_screenshot, puppeteer_click, etc.
 *
 * For the full list, see: https://github.com/modelcontextprotocol/servers
 */

// =============================================================================
// COMBINING MULTIPLE SERVERS
// =============================================================================

async function runWithMultipleServers() {
  const q = query({
    prompt: `
      1. Search GitHub for "mcp server" repositories
      2. Read the README from the top result
      3. Save a summary to ./mcp-summary.txt
    `,
    options: {
      model: 'opus',
      maxTurns: 30,

      mcpServers: {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN || '' },
        },
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
        },
      },

      // Allow all tools from trusted servers
      // ONLY do this with servers you trust!
      allowedTools: ['mcp__github', 'mcp__filesystem'],
    },
  });

  for await (const msg of q) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log(`Done! Cost: $${msg.total_cost_usd?.toFixed(4)}`);
    }
  }
}

// =============================================================================
// BEST PRACTICES
// =============================================================================

/**
 * MCP Server Configuration Best Practices:
 *
 * 1. SECURITY
 *    - Use environment variables for secrets (never hardcode)
 *    - Limit filesystem access to specific directories
 *    - Review server capabilities before enabling
 *
 * 2. TOOL ALLOWLISTING
 *    - 'mcp__server-name' allows ALL tools (only for trusted servers!)
 *    - 'mcp__server-name__tool-name' allows specific tool (safer)
 *    - For dynamic tools (list_changed), use server-level allowlist
 *    - Use disallowedTools as a blocklist alternative
 *
 * 3. TOOL NAMING
 *    - MCP tools are prefixed: mcp__<server-name>__<tool-name>
 *    - Use descriptive, short server names
 *    - Document available tools for your agents
 *
 * 4. ERROR HANDLING
 *    - Stdio servers can crash - the SDK handles process restarts
 *    - HTTP servers can timeout - consider retry logic
 *    - Check for error messages in tool results
 *
 * 5. BUILDING CUSTOM SERVERS
 *    - Use @modelcontextprotocol/sdk for full MCP features
 *    - See the mcp-server-ts skill for patterns:
 *      - Tools, Resources, Prompts
 *      - Subscriptions, Logging, Roots
 *      - Sampling, Tasks
 *
 * 6. WHEN TO USE EACH TRANSPORT
 *    - Stdio: Local development, language isolation, no network
 *    - Streamable HTTP: Production, shared servers, cloud hosting
 */

runWithStdioServer().catch(console.error);
