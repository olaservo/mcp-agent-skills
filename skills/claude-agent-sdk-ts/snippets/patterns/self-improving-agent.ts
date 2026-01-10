/**
 * Claude Agent SDK - Self-Improving Agent Pattern
 *
 * Agents that can develop, test, and persist reusable skills.
 * Uses built-in file tools (Write, Read, Glob) - no custom MCP server needed.
 *
 * SECURITY: This pattern requires sandboxing and careful controls.
 * See: https://www.anthropic.com/engineering/code-execution-with-mcp
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * Self-Improving Agent Requirements:
 *
 * 1. SANDBOXING (Critical)
 *    - Execute generated code in isolated environment
 *    - Use containers, VMs, or sandboxed processes
 *    - Limit filesystem, network, and resource access
 *
 * 2. SKILL VALIDATION
 *    - Test skills before persisting
 *    - Validate syntax and behavior
 *    - Review generated code before activation
 *
 * 3. VERSION CONTROL
 *    - Track skill versions and changes
 *    - Allow rollback to previous versions
 *    - Log all skill modifications
 */

/**
 * Skills are just files! No custom MCP server needed.
 *
 * Directory structure:
 * .claude/skills/
 * └── my-skill/
 *     ├── SKILL.md        # Required: Instructions with YAML frontmatter
 *     ├── scripts/        # Optional: Executable code
 *     │   └── helper.py
 *     └── references/     # Optional: Documentation
 *         └── api-docs.md
 *
 * SKILL.md format:
 * ```markdown
 * ---
 * name: my-skill
 * description: "What this skill does and when to use it"
 * ---
 *
 * # My Skill
 *
 * Instructions for Claude on how to use this skill...
 * ```
 */

/**
 * Self-improving agent using built-in file tools
 */
async function runSelfImprovingAgent() {
  console.log('Starting self-improving agent...\n');

  const q = query({
    prompt: `You are a self-improving agent. When you solve a problem,
             consider whether the solution could be useful in the future.

             If so, save it as a skill by writing to .claude/skills/<skill-name>/SKILL.md

             Current task: Create a utility that formats dates in multiple
             locales (US, UK, ISO). If this is useful, save it as a reusable skill.`,
    options: {
      model: 'sonnet',
      maxTurns: 20,
      cwd: process.cwd(),

      // File tools to create skills + Skill tool to use them
      allowedTools: ['Write', 'Read', 'Glob', 'Bash', 'Skill'],

      // Load existing skills so agent can see what's already available
      settingSources: ['project', 'local'],

      systemPrompt: `You are a self-improving coding assistant.

SKILL WORKFLOW:
1. Before creating, use Glob to check .claude/skills/ for existing skills
2. Create skills at: .claude/skills/<skill-name>/SKILL.md
3. To USE a skill: Skill({ skill: "skill-name" })

PROGRESSIVE DISCLOSURE (Critical for token efficiency):
Skills load in 3 stages - design for this:
- Stage 1: name + description (~100 tokens) - always loaded for discovery
- Stage 2: SKILL.md body (<5000 tokens) - loaded when skill activates
- Stage 3: scripts/, references/ - loaded on demand

Keep SKILL.md under 500 lines. Move detailed docs to references/.

NAME CONSTRAINTS:
- 1-64 chars, lowercase alphanumeric + hyphens only
- Cannot start/end with hyphen, no consecutive hyphens (--)
- Directory name MUST match the name field exactly

DESCRIPTION QUALITY (Most Important):
Include BOTH what it does AND when to use it (activation triggers).
Good: "Formats dates in US, UK, and ISO formats. Use when working with
       international dates, data exports, or localization."
Bad: "Date formatting utility."

SKILL.md FORMAT:
\`\`\`markdown
---
name: skill-name
description: "What it does AND when to use it (activation triggers)"
---

# Skill Title

Brief overview (1-2 sentences).

## When to Use
- Trigger phrase 1
- Trigger phrase 2

## Instructions
Step-by-step guidance...

## Examples
Concrete usage examples...
\`\`\`

DIRECTORY STRUCTURE:
.claude/skills/<skill-name>/
├── SKILL.md           # Required: <500 lines, <5000 tokens
├── scripts/           # Optional: executable code (Python, Bash, JS)
├── references/        # Optional: detailed docs loaded on demand
└── assets/            # Optional: templates, data files

DEPENDENCIES (Important):
- NEVER bundle node_modules, __pycache__, .venv, or similar
- Document dependencies in SKILL.md under "## Requirements"
- For Python: list in requirements.txt or mention pip packages
- For Node: list in package.json or mention npm packages
- Scripts should fail gracefully with clear install instructions

SECURITY:
- Skills run in the user's environment
- Never save credentials or secrets
- Test before saving`,
    },
  });

  for await (const msg of q) {
    if (msg.type === 'assistant' && msg.message) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && 'text' in block) {
          console.log(block.text);
        }
        if (block.type === 'tool_use' && 'name' in block) {
          console.log(`\n[Tool: ${block.name}]\n`);
        }
      }
    }

    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log(`\n--- Session complete. Cost: $${msg.total_cost_usd?.toFixed(4)} ---`);
    }
  }
}

/**
 * Example: What the agent might create
 *
 * File: .claude/skills/date-formatter/SKILL.md
 *
 * ```markdown
 * ---
 * name: date-formatter
 * description: "Formats dates in US, UK, and ISO formats. Use when working
 *               with international dates, CSV exports, API responses, or
 *               when the user mentions date formatting or localization."
 * ---
 *
 * # Date Formatter
 *
 * Provides consistent date formatting across locales for data exports and APIs.
 *
 * ## When to Use
 * - Formatting dates for international users
 * - Preparing data for CSV/Excel exports
 * - Converting API response dates
 * - Standardizing date formats in datasets
 *
 * ## Supported Formats
 * | Locale | Format     | Example    |
 * |--------|------------|------------|
 * | US     | MM/DD/YYYY | 01/15/2025 |
 * | UK     | DD/MM/YYYY | 15/01/2025 |
 * | ISO    | YYYY-MM-DD | 2025-01-15 |
 *
 * ## Requirements
 * - Node.js 18+ (uses Intl.DateTimeFormat)
 * - No external dependencies
 *
 * ## Instructions
 * 1. For APIs and databases: always use ISO format
 * 2. For US users: use US format (MM/DD/YYYY)
 * 3. For international/EU users: use UK or ISO format
 *
 * ## Example Code
 * See scripts/format-date.ts for a reusable implementation.
 * ```
 *
 * File: .claude/skills/date-formatter/scripts/format-date.ts
 * (Detailed implementation moved to scripts/ for progressive disclosure)
 */

/**
 * Production Considerations:
 *
 * 1. SANDBOXED EXECUTION
 *    Before activating a skill, test it in a sandboxed environment:
 *    - Docker container with limited permissions
 *    - Firecracker microVM for stronger isolation
 *    - Resource limits (CPU, memory, time)
 *
 * 2. CODE REVIEW
 *    Optionally require human review before skill activation:
 *    - Save to .claude/skills-pending/ first
 *    - Use a pre-tool hook to block Skill tool until reviewed
 *    - Integrate with PR/review workflow
 *
 * 3. SKILL VERSIONING
 *    Track skill evolution:
 *    - Use git to version .claude/skills/
 *    - Add changelog section to SKILL.md
 *    - Consider timestamped backups
 *
 * 4. ACCESS CONTROL
 *    Limit what skills can do:
 *    - Review scripts before allowing execution
 *    - Use allowedTools to restrict skill capabilities
 *    - Monitor skill usage with PostToolUse hooks
 */

// Run the agent
runSelfImprovingAgent().catch(console.error);
