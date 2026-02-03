#!/usr/bin/env node
/**
 * AgentCost CLI
 * 
 * Wrap any command to track its AI API usage.
 * 
 * Usage:
 *   agentcost run <command>     - Run command with usage tracking
 *   agentcost stats             - Show current stats
 *   agentcost reset             - Reset stats
 *   agentcost agent             - Start the agent (foreground)
 *   agentcost status            - Check if agent is running
 */

import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_PORT = process.env.AGENTCOST_PORT || 8787;
const AGENT_URL = `http://localhost:${AGENT_PORT}`;
const AGENT_SCRIPT = path.join(__dirname, '..', 'agent', 'index.js');

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  switch (command) {
    case 'run':
      await runCommand(args.slice(1));
      break;
    case 'stats':
      await showStats();
      break;
    case 'reset':
      await resetStats();
      break;
    case 'agent':
      await startAgent();
      break;
    case 'status':
      await checkStatus();
      break;
    default:
      // Assume it's a command to run
      await runCommand(args);
  }
}

function showHelp() {
  console.log(`
${c.bold}🦞 AgentCost${c.reset} — Track your AI API spending

${c.bold}Usage:${c.reset}
  agentcost run <command>     Wrap a command with usage tracking
  agentcost stats             Show current usage stats
  agentcost reset             Reset all stats
  agentcost agent             Start the agent (foreground)
  agentcost status            Check if agent is running

${c.bold}Examples:${c.reset}
  ${c.dim}# Track a Python script${c.reset}
  agentcost run python my_ai_script.py

  ${c.dim}# Track Cursor IDE${c.reset}
  agentcost run cursor

  ${c.dim}# Track aider${c.reset}
  agentcost run aider --model claude-3-5-sonnet

  ${c.dim}# Just run any command${c.reset}
  agentcost python my_script.py

${c.bold}How it works:${c.reset}
  1. Starts the local agent if not running
  2. Sets ANTHROPIC_BASE_URL and OPENAI_BASE_URL
  3. Runs your command with those env vars
  4. All API calls route through the agent
  5. Usage is tracked locally (never uploaded)

${c.bold}Privacy:${c.reset}
  ✓ All data stays on your machine
  ✓ Only tracks commands you explicitly wrap
  ✓ API keys never logged
  ✓ Request/response content not stored
`);
}

async function checkAgentRunning() {
  return new Promise((resolve) => {
    const req = http.get(`${AGENT_URL}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function getStats() {
  return new Promise((resolve, reject) => {
    http.get(`${AGENT_URL}/stats`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (_e) {
          reject(new Error('Failed to parse response'));
        }
      });
    }).on('error', reject);
  });
}

async function startAgentBackground() {
  return new Promise((resolve) => {
    const agent = spawn('node', [AGENT_SCRIPT, '--port', AGENT_PORT.toString()], {
      detached: true,
      stdio: 'ignore',
    });
    agent.unref();
    
    // Wait for agent to be ready
    let attempts = 0;
    const check = setInterval(async () => {
      attempts++;
      if (await checkAgentRunning()) {
        clearInterval(check);
        resolve(true);
      } else if (attempts > 20) {
        clearInterval(check);
        resolve(false);
      }
    }, 100);
  });
}

async function runCommand(args) {
  if (args.length === 0) {
    console.error(`${c.red}Error: No command specified${c.reset}`);
    console.log(`Usage: agentcost run <command>`);
    process.exit(1);
  }

  // Check if agent is running, start if not
  const agentRunning = await checkAgentRunning();
  
  if (!agentRunning) {
    process.stdout.write(`${c.cyan}🦞 Starting agent...${c.reset} `);
    const started = await startAgentBackground();
    if (started) {
      console.log(`${c.green}ready${c.reset}`);
    } else {
      console.log(`${c.red}failed${c.reset}`);
      console.error(`Could not start agent. Try running: agentcost agent`);
      process.exit(1);
    }
  }

  // Get stats before
  let statsBefore;
  try {
    statsBefore = await getStats();
  } catch (_e) {
    statsBefore = { totalCost: 0, requests: 0 };
  }

  // Set up environment
  const env = {
    ...process.env,
    ANTHROPIC_BASE_URL: `${AGENT_URL}/anthropic`,
    OPENAI_BASE_URL: `${AGENT_URL}/openai/v1`,
    OPENAI_API_BASE: `${AGENT_URL}/openai/v1`, // Some older SDKs use this
  };

  console.log(`${c.cyan}🦞 AgentCost tracking:${c.reset} ${args.join(' ')}`);
  console.log(`${c.dim}   → API calls routed through localhost:${AGENT_PORT}${c.reset}`);
  console.log();

  // Run the command
  const child = spawn(args[0], args.slice(1), {
    env,
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (err) => {
    console.error(`${c.red}Error running command:${c.reset}`, err.message);
    process.exit(1);
  });

  child.on('exit', async (code) => {
    // Get stats after
    let statsAfter;
    try {
      statsAfter = await getStats();
    } catch (_e) {
      statsAfter = statsBefore;
    }

    const costDiff = statsAfter.totalCost - statsBefore.totalCost;
    const requestsDiff = statsAfter.requests - statsBefore.requests;

    if (requestsDiff > 0) {
      console.log();
      console.log(`${c.cyan}🦞 Session usage:${c.reset}`);
      console.log(`   ${c.bold}$${costDiff.toFixed(4)}${c.reset} (${requestsDiff} request${requestsDiff === 1 ? '' : 's'})`);
      console.log(`   ${c.dim}Total: $${statsAfter.totalCost.toFixed(4)} across ${statsAfter.requests} requests${c.reset}`);
    }

    process.exit(code || 0);
  });
}

async function showStats() {
  const running = await checkAgentRunning();
  
  if (!running) {
    console.log(`${c.yellow}Agent not running.${c.reset} Start with: agentcost agent`);
    process.exit(1);
  }

  const stats = await getStats();
  
  console.log(`
${c.bold}🦞 AgentCost Stats${c.reset}

${c.bold}Total${c.reset}
  Cost:     ${c.green}$${stats.totalCost.toFixed(4)}${c.reset}
  Tokens:   ${stats.totalInputTokens.toLocaleString()} in / ${stats.totalOutputTokens.toLocaleString()} out
  Requests: ${stats.requests}

${c.bold}By Model${c.reset}`);

  for (const [model, data] of Object.entries(stats.byModel || {})) {
    console.log(`  ${c.cyan}${model}${c.reset}`);
    console.log(`    $${data.cost.toFixed(4)} • ${data.requests} req • ${data.inputTokens + data.outputTokens} tokens`);
  }

  if (stats.lastUpdated) {
    console.log();
    console.log(`${c.dim}Last updated: ${new Date(stats.lastUpdated).toLocaleString()}${c.reset}`);
  }
}

async function resetStats() {
  const running = await checkAgentRunning();
  
  if (!running) {
    console.log(`${c.yellow}Agent not running.${c.reset}`);
    process.exit(1);
  }

  await new Promise((resolve, reject) => {
    const req = http.request(`${AGENT_URL}/reset`, { method: 'POST' }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', reject);
    req.end();
  });

  console.log(`${c.green}✓ Stats reset${c.reset}`);
}

async function startAgent() {
  const running = await checkAgentRunning();
  
  if (running) {
    console.log(`${c.yellow}Agent already running on port ${AGENT_PORT}${c.reset}`);
    process.exit(0);
  }

  console.log(`${c.cyan}🦞 Starting AgentCost agent...${c.reset}`);
  
  const agent = spawn('node', [AGENT_SCRIPT, '--port', AGENT_PORT.toString()], {
    stdio: 'inherit',
  });

  agent.on('exit', (code) => {
    process.exit(code || 0);
  });
}

async function checkStatus() {
  const running = await checkAgentRunning();
  
  if (running) {
    console.log(`${c.green}✓ Agent running${c.reset} on port ${AGENT_PORT}`);
    const stats = await getStats();
    console.log(`  ${stats.requests} requests tracked, $${stats.totalCost.toFixed(4)} total`);
  } else {
    console.log(`${c.red}✗ Agent not running${c.reset}`);
    console.log(`  Start with: ${c.cyan}agentcost agent${c.reset}`);
  }
}

main().catch((err) => {
  console.error(`${c.red}Error:${c.reset}`, err.message);
  process.exit(1);
});
