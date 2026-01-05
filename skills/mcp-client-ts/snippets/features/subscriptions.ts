/**
 * Resource Subscriptions - Subscribe to real-time resource updates
 *
 * Copy this file to add subscription support to any MCP client.
 *
 * Usage:
 *   import { Client } from '@modelcontextprotocol/sdk/client/index.js';
 *   import { setupSubscriptions, serverSupportsSubscriptions } from './subscriptions.js';
 *
 *   const client = new Client({ name: 'my-client', version: '1.0.0' }, { capabilities: {} });
 *
 *   setupSubscriptions(client, async (uri) => {
 *     console.log('Resource updated:', uri);
 *     const content = await client.readResource({ uri });
 *     // Handle updated content...
 *   });
 *
 *   await client.connect(transport);
 *
 *   // Subscribe (if server supports it)
 *   if (serverSupportsSubscriptions(client)) {
 *     await client.subscribeResource({ uri: 'file:///data.json' });
 *   }
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ResourceUpdatedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * Set up notification handler for resource updates.
 */
export function setupSubscriptions(
  client: Client,
  onResourceUpdated: (uri: string) => void
): void {
  client.setNotificationHandler(ResourceUpdatedNotificationSchema, async (notification) => {
    onResourceUpdated(notification.params.uri);
  });
}

/**
 * Check if server supports resource subscriptions.
 */
export function serverSupportsSubscriptions(client: Client): boolean {
  const caps = client.getServerCapabilities();
  return caps?.resources?.subscribe === true;
}
