/**
 * Source: https://github.com/modelcontextprotocol/servers/blob/main/src/everything/tools/get-resource-links.ts
 *
 * Demonstrates returning resource_link content blocks from a tool.
 * Resource links reference resources that clients can resolve later.
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Tool input schema
const GetResourceLinksSchema = z.object({
  count: z
    .number()
    .min(1)
    .max(10)
    .default(3)
    .describe("Number of resource links to return (1-10)"),
});

// Tool configuration
const name = "get-resource-links";
const config = {
  title: "Get Resource Links Tool",
  description:
    "Returns up to ten resource links that reference different types of resources",
  inputSchema: GetResourceLinksSchema,
};

/**
 * Registers the 'get-resource-links' tool.
 *
 * The registered tool retrieves a specified number of resource links and their metadata.
 * Resource links are dynamically generated as either text or binary blob resources,
 * based on their ID being even or odd.
 *
 * The response contains a "text" introductory block and multiple "resource_link" blocks.
 *
 * @param {McpServer} server - The McpServer instance where the tool will be registered.
 */
export const registerGetResourceLinksTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const { count } = GetResourceLinksSchema.parse(args);

    // Add intro text content block
    const content: CallToolResult["content"] = [];
    content.push({
      type: "text",
      text: `Here are ${count} resource links to resources available in this server:`,
    });

    // Create resource link content blocks
    // Note: Replace these URIs and helper functions with your actual resource URIs
    for (let resourceId = 1; resourceId <= count; resourceId++) {
      const isText = resourceId % 2 === 0;
      const uri = isText
        ? `myapp://resource/text/${resourceId}`
        : `myapp://resource/blob/${resourceId}`;
      const mimeType = isText ? "text/plain" : "application/octet-stream";

      content.push({
        type: "resource_link",
        uri,
        name: `${isText ? "Text" : "Blob"} Resource ${resourceId}`,
        description: `Resource ${resourceId}: ${
          isText ? "plaintext resource" : "binary blob resource"
        }`,
        mimeType,
      });
    }

    return { content };
  });
};
