/**
 * Claude Agent SDK - Working Directory Configuration
 *
 * Set cwd to control where file operations occur.
 * Critical for sandboxing and multi-project setups.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import * as path from 'path';
import * as os from 'os';

/**
 * Why cwd matters:
 *
 * 1. File operations (Read, Write, Edit) resolve relative paths from cwd
 * 2. Bash commands execute in this directory
 * 3. Settings sources (.claude/) are loaded relative to cwd
 * 4. Security: limits agent's effective filesystem access
 */

/**
 * Example 1: Current working directory (most common)
 */
const currentDirQuery = query({
  prompt: 'List the files in this project.',
  options: {
    model: 'sonnet',
    cwd: process.cwd(),
    allowedTools: ['Glob', 'Read'],
  },
});

/**
 * Example 2: Specific project directory
 */
const specificProjectQuery = query({
  prompt: 'Analyze the package.json in this project.',
  options: {
    model: 'sonnet',
    cwd: '/home/user/projects/my-app',
    allowedTools: ['Read', 'Glob'],
  },
});

/**
 * Example 3: Temporary/sandbox directory
 *
 * Use for untrusted operations or testing.
 */
const sandboxQuery = query({
  prompt: 'Create some test files to experiment with.',
  options: {
    model: 'sonnet',
    cwd: path.join(os.tmpdir(), 'agent-sandbox'),
    allowedTools: ['Write', 'Read', 'Bash'],
  },
});

/**
 * Example 4: Relative to current file
 */
const relativeToFileQuery = query({
  prompt: 'Work on the agent directory.',
  options: {
    model: 'sonnet',
    cwd: path.join(__dirname, '..', 'agent'),
    allowedTools: ['Read', 'Write', 'Edit'],
  },
});

/**
 * Example 5: Dynamic project selection
 */
interface ProjectConfig {
  name: string;
  path: string;
}

const projects: ProjectConfig[] = [
  { name: 'frontend', path: '/projects/frontend' },
  { name: 'backend', path: '/projects/backend' },
  { name: 'shared', path: '/projects/shared-lib' },
];

async function workOnProject(projectName: string, prompt: string) {
  const project = projects.find((p) => p.name === projectName);
  if (!project) {
    throw new Error(`Unknown project: ${projectName}`);
  }

  console.log(`Working on project: ${project.name} at ${project.path}`);

  const q = query({
    prompt,
    options: {
      model: 'sonnet',
      cwd: project.path,
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
    },
  });

  for await (const msg of q) {
    if (msg.type === 'assistant' && msg.message) {
      const text = msg.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (text) console.log(text.text);
    }
  }
}

/**
 * Example 6: cwd with settings sources
 *
 * Settings are loaded from {cwd}/.claude/
 */
const withSettingsQuery = query({
  prompt: 'Help me with this project.',
  options: {
    model: 'sonnet',
    cwd: '/home/user/my-project',
    settingSources: ['project', 'local'], // Loads from /home/user/my-project/.claude/
  },
});

/**
 * Example 7: Creating a sandboxed environment
 */
import * as fs from 'fs';

async function createSandbox(): Promise<string> {
  const sandboxPath = path.join(os.tmpdir(), `agent-sandbox-${Date.now()}`);
  fs.mkdirSync(sandboxPath, { recursive: true });

  console.log(`Created sandbox at: ${sandboxPath}`);
  return sandboxPath;
}

async function runInSandbox(prompt: string) {
  const sandbox = await createSandbox();

  try {
    const q = query({
      prompt,
      options: {
        model: 'sonnet',
        cwd: sandbox,
        allowedTools: ['Write', 'Read', 'Edit', 'Bash'],
      },
    });

    for await (const msg of q) {
      if (msg.type === 'assistant' && msg.message) {
        const text = msg.message.content.find(
          (c: any): c is { type: 'text'; text: string } => c.type === 'text'
        );
        if (text) console.log(text.text);
      }
    }
  } finally {
    // Cleanup sandbox
    fs.rmSync(sandbox, { recursive: true, force: true });
    console.log('Sandbox cleaned up');
  }
}

async function main() {
  // Demo: run in current directory
  for await (const msg of currentDirQuery) {
    if (msg.type === 'assistant' && msg.message) {
      const text = msg.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (text) console.log(text.text);
    }
  }
}

main().catch(console.error);

/**
 * Security tip: Always set cwd explicitly rather than relying on defaults.
 * This prevents agents from accessing unexpected parts of the filesystem.
 */
