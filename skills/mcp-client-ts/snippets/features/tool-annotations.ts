/**
 * Tool Annotations - Interpret tool behavior hints for UI warnings and confirmations
 *
 * This module is standalone. Copy this file to add tool annotation handling to any MCP client.
 *
 * Usage:
 *   import { Client } from '@modelcontextprotocol/sdk/client/index.js';
 *   import {
 *     getWarningLevel,
 *     requiresConfirmation,
 *     isReadOnly,
 *     groupByWarningLevel,
 *   } from './features/tool-annotations.js';
 *
 *   const { tools } = await client.listTools();
 *
 *   // Check individual tool safety
 *   for (const tool of tools) {
 *     console.log(`${tool.name}: ${getWarningLevel(tool)}`);
 *     if (requiresConfirmation(tool)) {
 *       console.log('  Requires user confirmation before calling');
 *     }
 *   }
 *
 *   // Group tools by warning level for UI display
 *   const grouped = groupByWarningLevel(tools);
 *   console.log('Safe tools:', grouped.safe.map(t => t.name));
 *
 * SECURITY WARNING:
 *   Tool annotations are HINTS ONLY. Do NOT make security decisions based on
 *   annotations from untrusted servers. A malicious server could mark a
 *   destructive tool as readOnlyHint: true. Always verify server trustworthiness
 *   independently.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Warning levels for tool safety classification.
 */
export type WarningLevel = 'safe' | 'caution' | 'danger';

/**
 * Default values when annotations are not provided.
 * These assume the MOST DANGEROUS behavior.
 */
export const ANNOTATION_DEFAULTS = {
  readOnlyHint: false,      // Assumes tool DOES modify its environment
  destructiveHint: true,    // Assumes tool IS destructive
  idempotentHint: false,    // Assumes tool is NOT safe to retry
  openWorldHint: true,      // Assumes tool interacts with external systems
} as const;

/**
 * Check if a tool is read-only (does not modify its environment).
 * Returns false (assumes modifying) if not specified.
 */
export function isReadOnly(tool: Tool): boolean {
  return tool.annotations?.readOnlyHint ?? ANNOTATION_DEFAULTS.readOnlyHint;
}

/**
 * Check if a tool is destructive (performs destructive updates like deletes).
 * Returns true (assumes destructive) if not specified.
 *
 * Note: Only meaningful when readOnlyHint is false.
 */
export function isDestructive(tool: Tool): boolean {
  return tool.annotations?.destructiveHint ?? ANNOTATION_DEFAULTS.destructiveHint;
}

/**
 * Check if a tool is idempotent (safe to call multiple times with same result).
 * Returns false (assumes NOT idempotent) if not specified.
 *
 * Note: Only meaningful when readOnlyHint is false.
 */
export function isIdempotent(tool: Tool): boolean {
  return tool.annotations?.idempotentHint ?? ANNOTATION_DEFAULTS.idempotentHint;
}

/**
 * Check if a tool interacts with external systems (open world).
 * Returns true (assumes external interaction) if not specified.
 */
export function isOpenWorld(tool: Tool): boolean {
  return tool.annotations?.openWorldHint ?? ANNOTATION_DEFAULTS.openWorldHint;
}

/**
 * Get the warning level for a tool based on its annotations.
 *
 * - 'safe': Read-only tools
 * - 'caution': Non-destructive or idempotent tools
 * - 'danger': Destructive, non-idempotent tools (or no annotations)
 */
export function getWarningLevel(tool: Tool): WarningLevel {
  const annotations = tool.annotations;

  // No annotations = assume dangerous
  if (!annotations) return 'danger';

  // Read-only tools are safe
  if (annotations.readOnlyHint) return 'safe';

  // Destructive, non-idempotent tools need confirmation
  if (isDestructive(tool) && !isIdempotent(tool)) {
    return 'danger';
  }

  // Non-destructive or idempotent tools are lower risk
  if (!isDestructive(tool) || isIdempotent(tool)) {
    return 'caution';
  }

  return 'danger';
}

/**
 * Check if a tool should require user confirmation before calling.
 * Returns true for 'danger' level tools.
 */
export function requiresConfirmation(tool: Tool): boolean {
  return getWarningLevel(tool) === 'danger';
}

/**
 * Filter to only safe (read-only) tools.
 */
export function filterSafeTools(tools: Tool[]): Tool[] {
  return tools.filter((tool) => getWarningLevel(tool) === 'safe');
}

/**
 * Filter to tools that don't require confirmation (safe or caution level).
 */
export function filterAutoApprovable(tools: Tool[]): Tool[] {
  return tools.filter((tool) => !requiresConfirmation(tool));
}

/**
 * Group tools by their warning level.
 */
export function groupByWarningLevel(tools: Tool[]): Record<WarningLevel, Tool[]> {
  const groups: Record<WarningLevel, Tool[]> = {
    safe: [],
    caution: [],
    danger: [],
  };

  for (const tool of tools) {
    const level = getWarningLevel(tool);
    groups[level].push(tool);
  }

  return groups;
}

/**
 * Get a human-readable description of why a tool has its warning level.
 * Useful for UI tooltips or explanations.
 */
export function getWarningReason(tool: Tool): string {
  const annotations = tool.annotations;

  if (!annotations) {
    return 'No annotations provided - assuming dangerous behavior';
  }

  if (annotations.readOnlyHint) {
    return 'Read-only tool - does not modify environment';
  }

  if (isDestructive(tool) && !isIdempotent(tool)) {
    return 'Destructive and non-idempotent - may cause permanent changes';
  }

  if (!isDestructive(tool)) {
    return 'Non-destructive - does not delete or permanently modify data';
  }

  if (isIdempotent(tool)) {
    return 'Idempotent - safe to retry without additional side effects';
  }

  return 'May modify environment';
}
