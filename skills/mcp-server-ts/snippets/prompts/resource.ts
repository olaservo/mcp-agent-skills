/**
 * Source: https://github.com/modelcontextprotocol/servers/blob/main/src/everything/prompts/resource.ts
 *
 * Demonstrates embedding resource references directly in prompt messages.
 * The prompt returns messages that include both text and resource content.
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";

// Resource type constants
const RESOURCE_TYPE_TEXT = "text";
const RESOURCE_TYPE_BLOB = "blob";
const RESOURCE_TYPES = [RESOURCE_TYPE_TEXT, RESOURCE_TYPE_BLOB] as const;

// Completers for resource arguments
const resourceTypeCompleter = completable(
  z.string().describe("The type of resource (text or blob)"),
  (value) => RESOURCE_TYPES.filter((t) => t.startsWith(value))
);

const resourceIdCompleter = completable(
  z.string().describe("The resource ID (positive integer)"),
  (value) => {
    // Suggest some example IDs
    return ["1", "2", "3", "4", "5"].filter((id) => id.startsWith(value));
  }
);

/**
 * Register a prompt with an embedded resource reference
 * - Takes a resource type and id
 * - Returns prompt messages that include the resource content
 *
 * @param server
 */
export const registerEmbeddedResourcePrompt = (server: McpServer) => {
  // Prompt arguments
  const promptArgsSchema = {
    resourceType: resourceTypeCompleter,
    resourceId: resourceIdCompleter,
  };

  // Register the prompt
  server.registerPrompt(
    "resource-prompt",
    {
      title: "Resource Prompt",
      description: "A prompt that includes an embedded resource reference",
      argsSchema: promptArgsSchema,
    },
    (args) => {
      // Validate resource type argument
      const resourceType = args.resourceType;
      if (
        !RESOURCE_TYPES.includes(
          resourceType as typeof RESOURCE_TYPE_TEXT | typeof RESOURCE_TYPE_BLOB
        )
      ) {
        throw new Error(
          `Invalid resourceType: ${args?.resourceType}. Must be ${RESOURCE_TYPE_TEXT} or ${RESOURCE_TYPE_BLOB}.`
        );
      }

      // Validate resourceId argument
      const resourceId = Number(args?.resourceId);
      if (
        !Number.isFinite(resourceId) ||
        !Number.isInteger(resourceId) ||
        resourceId < 1
      ) {
        throw new Error(
          `Invalid resourceId: ${args?.resourceId}. Must be a finite positive integer.`
        );
      }

      // Build the resource URI and content
      // Note: Replace with your actual resource URI scheme and content
      const uri =
        resourceType === RESOURCE_TYPE_TEXT
          ? `myapp://resource/text/${resourceId}`
          : `myapp://resource/blob/${resourceId}`;

      const mimeType =
        resourceType === RESOURCE_TYPE_TEXT
          ? "text/plain"
          : "application/octet-stream";

      // Build a sample resource object
      // In practice, you would fetch this from your resource store
      const resource = {
        uri,
        mimeType,
        text:
          resourceType === RESOURCE_TYPE_TEXT
            ? `Sample text content for resource ${resourceId}`
            : undefined,
        blob:
          resourceType === RESOURCE_TYPE_BLOB
            ? Buffer.from(`Sample blob ${resourceId}`).toString("base64")
            : undefined,
      };

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `This prompt includes the ${resourceType} resource with id: ${resourceId}. Please analyze the following resource:`,
            },
          },
          {
            role: "user",
            content: {
              type: "resource",
              resource: resource,
            },
          },
        ],
      };
    }
  );
};
