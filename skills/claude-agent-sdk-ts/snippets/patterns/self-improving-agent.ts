/**
 * Claude Agent SDK - Self-Improving Agent Pattern
 *
 * Agents that can develop, test, and persist reusable skills.
 * This pattern enables incremental capability building where proven
 * solutions are retained for future use.
 *
 * SECURITY: This pattern requires sandboxing and careful controls.
 * See: https://www.anthropic.com/engineering/code-execution-with-mcp
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

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
 * Custom MCP server for skill management
 */
const skillsDir = '.claude/skills/generated';

const skillManagementServer = createSdkMcpServer({
  name: 'skill-manager',
  version: '1.0.0',
});

/**
 * Tool: Save a new skill
 *
 * Persists agent-developed code as a reusable skill.
 * In production, add validation and sandboxed testing before saving.
 */
skillManagementServer.registerTool(
  tool({
    name: 'save_skill',
    description: `Save a reusable skill to ${skillsDir}.
                  The skill will be available in future sessions.
                  Include clear documentation and test cases.`,
    parameters: z.object({
      name: z.string().describe('Skill name (lowercase, hyphens allowed)'),
      description: z.string().describe('What this skill does'),
      code: z.string().describe('TypeScript/JavaScript implementation'),
      testCases: z.array(z.object({
        input: z.string(),
        expectedOutput: z.string(),
      })).optional().describe('Test cases to validate the skill'),
    }),
    execute: async ({ name, description, code, testCases }) => {
      // SECURITY: In production, validate and sandbox-test the code first
      const skillPath = path.join(skillsDir, name);
      await fs.mkdir(skillPath, { recursive: true });

      // Create SKILL.md with frontmatter
      const skillMd = `---
name: ${name}
description: "${description}"
generated: true
timestamp: "${new Date().toISOString()}"
---

# ${name}

${description}

## Implementation

\`\`\`typescript
${code}
\`\`\`

${testCases ? `## Test Cases

${testCases.map((tc, i) => `### Test ${i + 1}
- Input: \`${tc.input}\`
- Expected: \`${tc.expectedOutput}\`
`).join('\n')}` : ''}
`;

      await fs.writeFile(path.join(skillPath, 'SKILL.md'), skillMd);
      await fs.writeFile(path.join(skillPath, 'index.ts'), code);

      return { success: true, path: skillPath };
    },
  })
);

/**
 * Tool: List available skills
 */
skillManagementServer.registerTool(
  tool({
    name: 'list_skills',
    description: 'List all available generated skills',
    parameters: z.object({}),
    execute: async () => {
      try {
        const entries = await fs.readdir(skillsDir, { withFileTypes: true });
        const skills = entries
          .filter(e => e.isDirectory())
          .map(e => e.name);
        return { skills };
      } catch {
        return { skills: [], error: 'Skills directory not found' };
      }
    },
  })
);

/**
 * Tool: Load a skill's implementation
 */
skillManagementServer.registerTool(
  tool({
    name: 'load_skill',
    description: 'Load a skill implementation for use or modification',
    parameters: z.object({
      name: z.string().describe('Skill name to load'),
    }),
    execute: async ({ name }) => {
      const skillPath = path.join(skillsDir, name, 'SKILL.md');
      try {
        const content = await fs.readFile(skillPath, 'utf-8');
        return { found: true, content };
      } catch {
        return { found: false, error: `Skill "${name}" not found` };
      }
    },
  })
);

/**
 * Self-improving agent that can develop and persist skills
 */
async function runSelfImprovingAgent() {
  console.log('Starting self-improving agent...\n');

  const q = query({
    prompt: `You are a self-improving agent. When you solve a problem,
             consider whether the solution could be useful in the future.

             If so, save it as a skill using save_skill with:
             - Clear name and description
             - Well-documented code
             - Test cases to validate behavior

             Current task: Create a utility that formats dates in multiple
             locales (US, UK, ISO). Save it as a reusable skill.`,
    options: {
      model: 'sonnet',
      maxTurns: 20,
      cwd: process.cwd(),

      // Include skill management + standard tools
      allowedTools: ['Read', 'Write', 'Bash'],

      // Register the skill management MCP server
      mcpServers: {
        'skill-manager': skillManagementServer,
      },

      // Load existing skills
      settingSources: ['project', 'local'],

      systemPrompt: `You are a self-improving coding assistant.

SKILL DEVELOPMENT GUIDELINES:
1. When you create useful utilities, save them as skills
2. Before creating a new skill, check if one already exists
3. Include test cases to validate skill behavior
4. Document parameters, return values, and edge cases
5. Use TypeScript with proper types

SECURITY AWARENESS:
- Skills run in the user's environment
- Avoid skills that modify system settings
- Never save credentials or secrets in skills
- Test thoroughly before saving`,
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
 * Production Considerations:
 *
 * 1. SANDBOXED EXECUTION
 *    Before saving a skill, test it in a sandboxed environment:
 *    - Docker container with limited permissions
 *    - Firecracker microVM for stronger isolation
 *    - Resource limits (CPU, memory, time)
 *
 * 2. CODE REVIEW
 *    Optionally require human review before skill activation:
 *    - Log new skills to a review queue
 *    - Use a separate "pending" directory
 *    - Integrate with PR/review workflow
 *
 * 3. SKILL VERSIONING
 *    Track skill evolution:
 *    - Git-based version control
 *    - Changelog in SKILL.md
 *    - Rollback capability
 *
 * 4. ACCESS CONTROL
 *    Limit what skills can do:
 *    - Allowlist of safe imports/APIs
 *    - Restricted filesystem paths
 *    - Network access controls
 *
 * Example sandbox integration:
 *
 * ```typescript
 * async function validateInSandbox(code: string): Promise<boolean> {
 *   const container = await docker.createContainer({
 *     Image: 'node:20-slim',
 *     Cmd: ['node', '-e', code],
 *     HostConfig: {
 *       Memory: 128 * 1024 * 1024, // 128MB
 *       CpuPeriod: 100000,
 *       CpuQuota: 50000, // 50% CPU
 *       NetworkMode: 'none',
 *       ReadonlyRootfs: true,
 *     },
 *   });
 *   // Run and check exit code
 *   const result = await container.start();
 *   return result.StatusCode === 0;
 * }
 * ```
 */

// Run the agent
runSelfImprovingAgent().catch(console.error);
