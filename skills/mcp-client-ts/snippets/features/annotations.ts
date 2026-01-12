/**
 * Content Annotations - Filter, sort, and display annotated content
 *
 * This module is standalone. Copy this file to add annotation handling to any MCP client.
 *
 * Usage:
 *   import { Client } from '@modelcontextprotocol/sdk/client/index.js';
 *   import {
 *     filterByAudience,
 *     sortByPriority,
 *     formatLastModified,
 *   } from './features/annotations.js';
 *
 *   const result = await client.callTool({ name: 'search', arguments: { query: 'test' } });
 *
 *   // Filter content by audience
 *   const userContent = filterByAudience(result.content, 'user');
 *   const assistantContent = filterByAudience(result.content, 'assistant');
 *
 *   // Sort by priority (highest first)
 *   const sorted = sortByPriority(result.content);
 *
 *   // Get formatted modification time
 *   const modified = formatLastModified(result.content[0]);
 */

import type {
  Annotations,
  TextContent,
  ImageContent,
  AudioContent,
  EmbeddedResource,
  ResourceLink,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Content types that can have annotations.
 */
export type AnnotatedContent =
  | TextContent
  | ImageContent
  | AudioContent
  | EmbeddedResource
  | ResourceLink;

/**
 * Valid audience roles for content annotations.
 */
export type Role = 'user' | 'assistant';

/**
 * Get annotations from a content item, if present.
 */
export function getAnnotations(content: AnnotatedContent): Annotations | undefined {
  return content.annotations;
}

/**
 * Check if content is intended for a specific audience.
 * Returns true if no audience is specified (default to all).
 */
export function isForAudience(content: AnnotatedContent, role: Role): boolean {
  const audience = content.annotations?.audience;
  if (!audience || audience.length === 0) return true;
  return audience.includes(role);
}

/**
 * Filter content items by audience.
 * Items without audience annotation are included for all audiences.
 */
export function filterByAudience<T extends AnnotatedContent>(
  content: T[],
  role: Role
): T[] {
  return content.filter((item) => isForAudience(item, role));
}

/**
 * Get the priority of a content item.
 * Returns default (0.5) if not specified.
 */
export function getPriority(content: AnnotatedContent, defaultPriority = 0.5): number {
  return content.annotations?.priority ?? defaultPriority;
}

/**
 * Sort content items by priority (highest first).
 * Items without priority use the default value (0.5).
 */
export function sortByPriority<T extends AnnotatedContent>(
  content: T[],
  defaultPriority = 0.5
): T[] {
  return [...content].sort((a, b) => {
    const priorityA = getPriority(a, defaultPriority);
    const priorityB = getPriority(b, defaultPriority);
    return priorityB - priorityA;
  });
}

/**
 * Get high-priority content (priority >= threshold).
 * Default threshold is 0.7.
 */
export function getHighPriority<T extends AnnotatedContent>(
  content: T[],
  threshold = 0.7
): T[] {
  return content.filter((item) => getPriority(item) >= threshold);
}

/**
 * Get the lastModified date from a content item.
 * Returns null if not specified or invalid.
 */
export function getLastModified(content: AnnotatedContent): Date | null {
  const lastModified = content.annotations?.lastModified;
  if (!lastModified) return null;

  const date = new Date(lastModified);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format the lastModified date as a localized string.
 * Returns null if not specified.
 */
export function formatLastModified(
  content: AnnotatedContent,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string | null {
  const date = getLastModified(content);
  if (!date) return null;

  return date.toLocaleString(locale, options);
}

/**
 * Sort content items by modification time (most recent first).
 * Items without lastModified are placed at the end.
 */
export function sortByRecency<T extends AnnotatedContent>(content: T[]): T[] {
  return [...content].sort((a, b) => {
    const dateA = getLastModified(a);
    const dateB = getLastModified(b);

    // Items without dates go to the end
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    return dateB.getTime() - dateA.getTime();
  });
}

/**
 * Prepare content for display by filtering and sorting.
 * Convenience function that applies common transformations.
 */
export function prepareForDisplay<T extends AnnotatedContent>(
  content: T[],
  options: {
    audience?: Role;
    sortBy?: 'priority' | 'recency';
    limit?: number;
  } = {}
): T[] {
  let result = [...content];

  // Filter by audience
  if (options.audience) {
    result = filterByAudience(result, options.audience);
  }

  // Sort
  if (options.sortBy === 'priority') {
    result = sortByPriority(result);
  } else if (options.sortBy === 'recency') {
    result = sortByRecency(result);
  }

  // Limit
  if (options.limit && options.limit > 0) {
    result = result.slice(0, options.limit);
  }

  return result;
}
