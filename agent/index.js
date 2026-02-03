#!/usr/bin/env node
/**
 * AgentCost Local Agent
 * 
 * A local proxy that forwards API calls and tracks usage.
 * Your API keys and data never leave your machine.
 * 
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ PRIVACY GUARANTEE                                                   │
 * │                                                                     │
 * │ This agent ONLY stores:                                             │
 * │   ✓ Token counts (input/output)                                     │
 * │   ✓ Model names                                                     │
 * │   ✓ Calculated costs                                                │
 * │   ✓ Request timestamps                                              │
 * │                                                                     │
 * │ This agent NEVER stores:                                            │
 * │   ✗ Request content (prompts)                                       │
 * │   ✗ Response content (completions)                                  │
 * │   ✗ API keys                                                        │
 * │   ✗ Any personally identifiable information                         │
 * │                                                                     │
 * │ All content passes through memory only and is immediately           │
 * │ forwarded without logging or persistence.                           │
 * └─────────────────────────────────────────────────────────────────────┘
 * 
 * Usage:
 *   node agent/index.js [--port 8787]
 * 
 * Then point your SDK at:
 *   ANTHROPIC_BASE_URL=http://localhost:8787/anthropic
 *   OPENAI_BASE_URL=http://localhost:8787/openai
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.argv.find((_, i, a) => a[i-1] === '--port') || '8787');
const DATA_FILE = path.join(__dirname, 'usage-data.json');
const BUDGET_FILE = path.join(__dirname, 'budget-config.json');

// Get local date string (YYYY-MM-DD) instead of UTC
function getLocalDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Get local month prefix (YYYY-MM)
function getLocalMonthPrefix() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Pricing per 1M tokens (as of 2024/2025)
const PRICING = {
  // Anthropic
  'claude-3-5-sonnet': { input: 3, output: 15 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-3-5-haiku': { input: 0.25, output: 1.25 },
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'o3': { input: 10, output: 40 },
  'o4-mini': { input: 1.1, output: 4.4 },
};

// Model downgrade suggestions (same-provider, cheaper tier)
const DOWNGRADES = {
  // Anthropic
  'claude-opus-4': 'claude-sonnet-4',
  'claude-sonnet-4': 'claude-3-5-haiku',
  'claude-3-opus': 'claude-3-5-sonnet',
  'claude-3-5-sonnet': 'claude-3-5-haiku',
  // OpenAI
  'gpt-4o': 'gpt-4o-mini',
  'gpt-4-turbo': 'gpt-4o-mini',
  'o3': 'o4-mini',
};

// Get pricing for a model (with partial matching)
function getPricing(model) {
  for (const [key, p] of Object.entries(PRICING)) {
    if (model.includes(key)) return p;
  }
  return { input: 3, output: 15 }; // default to sonnet pricing
}

// Load or initialize usage data
function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      byModel: {},
      byDay: {},
      requests: 0,
      lastUpdated: null,
    };
  }
}

function saveData(data) {
  // PRIVACY: Only aggregated counts are saved, never content
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Load or initialize budget config
function loadBudgetConfig() {
  try {
    return JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
  } catch {
    return {
      dailyLimit: null,
      monthlyLimit: null,
      createdAt: null,
      updatedAt: null,
    };
  }
}

function saveBudgetConfig(config) {
  const now = new Date().toISOString();
  if (!config.createdAt) config.createdAt = now;
  config.updatedAt = now;
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(config, null, 2));
}

// Get today's spend from usage data
function getDailySpent() {
  const data = loadData();
  const today = getLocalDateString();
  return data.byDay[today]?.cost || 0;
}

// Get current month's spend from usage data
function getMonthlySpent() {
  const data = loadData();
  const monthPrefix = getLocalMonthPrefix(); // "2026-02"
  return Object.entries(data.byDay)
    .filter(([date]) => date.startsWith(monthPrefix))
    .reduce((sum, [, day]) => sum + day.cost, 0);
}

// Build budget status object
function getBudgetStatus() {
  const config = loadBudgetConfig();
  const dailySpent = getDailySpent();
  const monthlySpent = getMonthlySpent();

  return {
    config: {
      dailyLimit: config.dailyLimit,
      monthlyLimit: config.monthlyLimit,
    },
    daily: {
      spent: dailySpent,
      limit: config.dailyLimit,
      remaining: config.dailyLimit ? Math.max(0, config.dailyLimit - dailySpent) : null,
      percentUsed: config.dailyLimit ? (dailySpent / config.dailyLimit) * 100 : null,
    },
    monthly: {
      spent: monthlySpent,
      limit: config.monthlyLimit,
      remaining: config.monthlyLimit ? Math.max(0, config.monthlyLimit - monthlySpent) : null,
      percentUsed: config.monthlyLimit ? (monthlySpent / config.monthlyLimit) * 100 : null,
    },
  };
}

// Estimate cost for a request
function estimateCost(model, inputTokens, outputTokens) {
  const pricing = getPricing(model);
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

// Determine warning level based on budget status
function getWarningLevel(status) {
  const { daily, monthly } = status;

  // Hard block: monthly exceeded
  if (monthly.limit && monthly.percentUsed >= 100) return 'blocked';

  // Soft exceeded: daily over 100%
  if (daily.limit && daily.percentUsed >= 100) return 'exceeded';

  // Warning: daily over 80%
  if (daily.limit && daily.percentUsed >= 80) return 'high';

  return 'none';
}

// Get downgrade suggestion for a model
function getSuggestedModel(model, warningLevel) {
  if (warningLevel === 'none') return null;

  // Find matching downgrade (partial match)
  for (const [key, downgrade] of Object.entries(DOWNGRADES)) {
    if (model.includes(key)) return downgrade;
  }
  return null;
}

// Get ISO string for first of next month (for retryAfter)
function getFirstOfNextMonth() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toISOString();
}

// Check if monthly budget allows request (returns null if ok, error object if blocked)
function checkMonthlyBudget() {
  const config = loadBudgetConfig();
  if (!config.monthlyLimit) return null; // No limit set

  const monthlySpent = getMonthlySpent();
  if (monthlySpent >= config.monthlyLimit) {
    return {
      error: 'monthly_budget_exceeded',
      message: `Monthly budget limit reached ($${monthlySpent.toFixed(2)} spent of $${config.monthlyLimit.toFixed(2)} limit)`,
      monthly: {
        spent: monthlySpent,
        limit: config.monthlyLimit,
      },
      blocked: true,
      retryAfter: getFirstOfNextMonth(),
    };
  }
  return null;
}

// Calculate cost for a model
function calculateCost(model, inputTokens, outputTokens) {
  const pricing = getPricing(model);
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

/**
 * Record usage statistics from API response
 * 
 * PRIVACY: This function ONLY extracts and stores:
 *   - Token counts (numbers)
 *   - Model name (string)
 *   - Calculated cost (number)
 * 
 * It does NOT store any request/response content.
 */
function recordUsage(provider, model, usage) {
  const data = loadData();
  
  // PRIVACY: Only extracting numeric token counts, not content
  const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
  const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
  const cost = calculateCost(model, inputTokens, outputTokens);
  
  const today = getLocalDateString();
  
  // Update totals
  data.totalInputTokens += inputTokens;
  data.totalOutputTokens += outputTokens;
  data.totalCost += cost;
  data.requests += 1;
  
  // Update by model (PRIVACY: only model name, not content)
  if (!data.byModel[model]) {
    data.byModel[model] = { inputTokens: 0, outputTokens: 0, cost: 0, requests: 0 };
  }
  data.byModel[model].inputTokens += inputTokens;
  data.byModel[model].outputTokens += outputTokens;
  data.byModel[model].cost += cost;
  data.byModel[model].requests += 1;
  
  // Update by day
  if (!data.byDay[today]) {
    data.byDay[today] = { inputTokens: 0, outputTokens: 0, cost: 0, requests: 0 };
  }
  data.byDay[today].inputTokens += inputTokens;
  data.byDay[today].outputTokens += outputTokens;
  data.byDay[today].cost += cost;
  data.byDay[today].requests += 1;
  
  saveData(data);
  
  // PRIVACY: Log only shows counts, not content
  console.log(`📊 ${provider}/${model}: ${inputTokens} in, ${outputTokens} out, $${cost.toFixed(4)}`);
}

/**
 * Proxy request to upstream API
 * 
 * PRIVACY NOTES:
 *   - Request body (prompt) passes through memory, NOT logged or stored
 *   - Response body (completion) passes through memory, NOT logged or stored
 *   - API key passes through headers, NOT logged or stored
 *   - Only the 'usage' field from response is extracted (token counts only)
 */
function proxyRequest(provider, req, res) {
  // HARD LIMIT: Check monthly budget before proxying
  const budgetBlock = checkMonthlyBudget();
  if (budgetBlock) {
    console.log(`🚫 Blocked: Monthly budget exceeded ($${budgetBlock.monthly.spent.toFixed(2)}/$${budgetBlock.monthly.limit.toFixed(2)})`);
    res.writeHead(402, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(budgetBlock, null, 2));
    return;
  }

  const upstream = provider === 'anthropic'
    ? { host: 'api.anthropic.com', port: 443 }
    : { host: 'api.openai.com', port: 443 };

  // Build path (remove /anthropic or /openai prefix)
  const upstreamPath = req.url.replace(/^\/(anthropic|openai)/, '');
  
  // PRIVACY: Headers (including API key) are forwarded, not logged
  const headers = { ...req.headers };
  headers.host = upstream.host;
  delete headers['content-length']; // Will be recalculated
  
  let body = [];
  
  req.on('data', chunk => body.push(chunk));
  req.on('end', () => {
    // PRIVACY: Request body is buffered only to forward, never logged
    body = Buffer.concat(body);
    
    const options = {
      hostname: upstream.host,
      port: upstream.port,
      path: upstreamPath,
      method: req.method,
      headers: {
        ...headers,
        'content-length': body.length,
      },
    };
    
    const proxyReq = https.request(options, proxyRes => {
      let responseBody = [];
      
      proxyRes.on('data', chunk => responseBody.push(chunk));
      proxyRes.on('end', () => {
        // PRIVACY: Response body buffered only to forward and extract usage
        responseBody = Buffer.concat(responseBody);
        
        // Extract usage stats from response
        try {
          const json = JSON.parse(responseBody.toString());
          if (json.usage) {
            // PRIVACY: Only extracting 'usage' field (token counts)
            // NOT extracting 'content', 'messages', or any text
            const model = json.model || 'unknown';
            recordUsage(provider, model, json.usage);
          }
          // PRIVACY: 'json' variable (containing content) is not stored
          // and will be garbage collected after this function exits
        } catch (_e) {
          // Not JSON or no usage field, ignore
        }
        
        // PRIVACY: Response forwarded to client, then buffer is released
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        res.end(responseBody);
      });
    });
    
    proxyReq.on('error', err => {
      // PRIVACY: Only error message logged, not request content
      console.error('Proxy error:', err.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'Proxy error', details: err.message }));
    });
    
    // PRIVACY: Request body forwarded, then buffer is released
    proxyReq.write(body);
    proxyReq.end();
  });
}

// HTTP server
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Stats endpoint - PRIVACY: Only returns aggregated counts, never content
  if (req.url === '/stats' || req.url === '/stats/') {
    const data = loadData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
    return;
  }
  
  // Reset endpoint (for testing)
  if (req.url === '/reset' && req.method === 'POST') {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      byModel: {},
      byDay: {},
      requests: 0,
      lastUpdated: new Date().toISOString(),
    }, null, 2));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'Stats reset' }));
    return;
  }

  // Budget status endpoint
  if (req.url === '/api/budget' && req.method === 'GET') {
    const status = getBudgetStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
    return;
  }

  // Set budget config endpoint
  if (req.url === '/api/budget' && req.method === 'POST') {
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
      try {
        const input = JSON.parse(Buffer.concat(body).toString());
        const config = loadBudgetConfig();

        if (input.dailyLimit !== undefined) config.dailyLimit = input.dailyLimit;
        if (input.monthlyLimit !== undefined) config.monthlyLimit = input.monthlyLimit;

        saveBudgetConfig(config);

        const status = getBudgetStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON', details: err.message }));
      }
    });
    return;
  }

  // Pre-flight budget check endpoint
  if (req.url.startsWith('/api/budget/check') && req.method === 'GET') {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const model = url.searchParams.get('model');
    const estimatedTokens = parseInt(url.searchParams.get('estimatedTokens') || '0');
    const inputTokens = parseInt(url.searchParams.get('inputTokens') || '0');
    const outputTokens = parseInt(url.searchParams.get('outputTokens') || '0');

    if (!model) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'model parameter required' }));
      return;
    }

    // Calculate token estimates
    let inTokens = inputTokens;
    let outTokens = outputTokens;
    if (estimatedTokens && !inputTokens && !outputTokens) {
      // 50/50 split if only total provided
      inTokens = Math.floor(estimatedTokens / 2);
      outTokens = Math.ceil(estimatedTokens / 2);
    }

    const estimated = estimateCost(model, inTokens, outTokens);
    const status = getBudgetStatus();
    const warningLevel = getWarningLevel(status);
    const suggestedModel = getSuggestedModel(model, warningLevel);

    const blocked = warningLevel === 'blocked';
    const withinBudget = !blocked && (
      !status.daily.limit || status.daily.remaining >= estimated
    );

    let warning = null;
    if (warningLevel === 'blocked') {
      warning = 'Monthly budget exceeded';
    } else if (warningLevel === 'exceeded') {
      warning = 'Daily budget exceeded';
    } else if (warningLevel === 'high') {
      warning = `Daily budget at ${Math.round(status.daily.percentUsed)}%`;
    }

    const response = {
      allowed: !blocked && withinBudget,
      blocked,
      withinBudget,
      warningLevel,
      estimatedCost: estimated,
      daily: status.daily,
      monthly: status.monthly,
    };

    if (warning) response.warning = warning;
    if (suggestedModel) response.suggestedModel = suggestedModel;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response, null, 2));
    return;
  }

  // Health check
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'agentcost-local-agent',
      privacy: 'Content is never logged or stored. Only token counts are tracked.',
      endpoints: {
        stats: '/stats',
        budget: '/api/budget',
        budgetCheck: '/api/budget/check?model=<model>&estimatedTokens=<tokens>',
      },
      proxy: {
        anthropic: '/anthropic/v1/messages',
        openai: '/openai/v1/chat/completions',
      }
    }));
    return;
  }
  
  // Proxy routes
  if (req.url.startsWith('/anthropic/')) {
    proxyRequest('anthropic', req, res);
    return;
  }
  
  if (req.url.startsWith('/openai/')) {
    proxyRequest('openai', req, res);
    return;
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`
🦞 AgentCost Local Agent running on http://localhost:${PORT}

┌─────────────────────────────────────────────────────────┐
│ PRIVACY: Only token counts are stored.                  │
│ Request/response content is NEVER logged or saved.      │
└─────────────────────────────────────────────────────────┘

Endpoints:
  GET  /stats              - View accumulated usage stats
  POST /reset              - Reset stats
  GET  /api/budget         - View budget config and status
  POST /api/budget         - Set budget limits
  GET  /api/budget/check   - Pre-flight budget check

Proxy routes (point your SDK here):
  /anthropic/*    → api.anthropic.com/*
  /openai/*       → api.openai.com/*

Example:
  export ANTHROPIC_BASE_URL=http://localhost:${PORT}/anthropic

  # Set budget limits
  curl -X POST http://localhost:${PORT}/api/budget -d '{"dailyLimit":10,"monthlyLimit":200}'

  # Check before expensive operation
  curl "http://localhost:${PORT}/api/budget/check?model=claude-sonnet-4&estimatedTokens=10000"
`);
});
