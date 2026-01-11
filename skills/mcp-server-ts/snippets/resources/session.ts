/**
 * Source: https://github.com/modelcontextprotocol/servers/blob/main/src/everything/resources/session.ts
 *
 * Demonstrates session-scoped temporary resources.
 * These resources are available only during the session lifetime and are not persisted.
 * Useful for dynamically generated content like API responses or computed results.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Resource, ResourceLink } from "@modelcontextprotocol/sdk/types.js";

/**
 * Generates a session-scoped resource URI string based on the provided resource name.
 *
 * @param {string} name - The name of the resource to create a URI for.
 * @returns {string} The formatted session resource URI.
 */
export const getSessionResourceURI = (name: string): string => {
  return `myapp://resource/session/${name}`;
};

/**
 * Registers a session-scoped resource with the provided server and returns a resource link.
 *
 * The registered resource is available during the life of the session only; it is not otherwise persisted.
 *
 * @param {McpServer} server - The server instance responsible for handling the resource registration.
 * @param {Resource} resource - The resource object containing metadata such as URI, name, description, and mimeType.
 * @param {"text"|"blob"} type - The type of content (text or binary blob).
 * @param {string} payload - The content to store (text string or base64-encoded blob).
 * @returns {ResourceLink} An object representing the resource link, with associated metadata.
 */
export const registerSessionResource = (
  server: McpServer,
  resource: Resource,
  type: "text" | "blob",
  payload: string
): ResourceLink => {
  // Destructure resource
  const {
    uri,
    name,
    mimeType,
    description,
    title,
    annotations,
    icons,
    _meta,
  } = resource;

  // Prepare the resource content to return
  // See https://modelcontextprotocol.io/specification/2025-11-25/server/resources#resource-contents
  const resourceContent =
    type === "text"
      ? {
          uri: uri.toString(),
          mimeType,
          text: payload,
        }
      : {
          uri: uri.toString(),
          mimeType,
          blob: payload,
        };

  // Register file resource
  server.registerResource(
    name,
    uri,
    { mimeType, description, title, annotations, icons, _meta },
    async (uri) => {
      return {
        contents: [resourceContent],
      };
    }
  );

  return { type: "resource_link", ...resource };
};

/**
 * Example usage:
 *
 * const resource: Resource = {
 *   uri: getSessionResourceURI("my-data"),
 *   name: "my-data",
 *   mimeType: "application/json",
 *   description: "Dynamically generated JSON data",
 * };
 *
 * const link = registerSessionResource(
 *   server,
 *   resource,
 *   "text",
 *   JSON.stringify({ key: "value" })
 * );
 *
 * // The link can be returned from a tool to let clients fetch the resource
 */
