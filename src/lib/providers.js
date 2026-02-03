/**
 * Provider API integrations
 * 
 * Uses Cloudflare Worker proxy to bypass CORS restrictions.
 * The proxy just forwards requests — no logging, no storage.
 * 
 * Privacy model: Your API key goes browser → worker → provider
 * Worker never logs or stores the key.
 */

// Proxy URL - update after deploying worker
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://agentcost-proxy.your-subdomain.workers.dev'

// Set to true to use direct API calls (will fail due to CORS in browser)
const USE_DIRECT_API = false

// ============ OPENAI ============

export async function fetchOpenAIUsage(apiKey, days = 30) {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  try {
    const params = new URLSearchParams({
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    })

    const url = USE_DIRECT_API
      ? `https://api.openai.com/v1/organization/usage/completions?${params}`
      : `${PROXY_URL}/proxy/openai/v1/organization/usage/completions?${params}`

    const headers = USE_DIRECT_API
      ? { 'Authorization': `Bearer ${apiKey}` }
      : { 'x-api-key': apiKey }

    const response = await fetch(url, { headers })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      
      // If 404 or endpoint not available, try the dashboard billing endpoint
      if (response.status === 404 || response.status === 403) {
        return await fetchOpenAIBillingUsage(apiKey, days)
      }
      
      throw new Error(err.error?.message || `OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return transformOpenAIData(data, days)

  } catch (err) {
    // If network error and proxy not configured, use demo mode
    if (err.message.includes('Failed to fetch') || PROXY_URL.includes('your-subdomain')) {
      console.warn('Proxy not configured or unreachable, using demo data')
      return generateMockData('openai', days)
    }
    throw err
  }
}

async function fetchOpenAIBillingUsage(apiKey, days) {
  // Alternative: OpenAI billing/usage endpoint (older API)
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const params = new URLSearchParams({
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
  })

  const url = USE_DIRECT_API
    ? `https://api.openai.com/v1/dashboard/billing/usage?${params}`
    : `${PROXY_URL}/proxy/openai/v1/dashboard/billing/usage?${params}`

  const headers = USE_DIRECT_API
    ? { 'Authorization': `Bearer ${apiKey}` }
    : { 'x-api-key': apiKey }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    // Fall back to demo mode
    console.warn('OpenAI billing endpoint not available, using demo data')
    return generateMockData('openai', days)
  }

  const data = await response.json()
  return transformOpenAIBillingData(data, days)
}

function transformOpenAIData(data, days) {
  const daily = []
  const byModel = {}
  let totalCost = 0
  let promptTokens = 0
  let completionTokens = 0

  // Process usage buckets from the completions endpoint
  if (data.data) {
    for (const bucket of data.data) {
      for (const result of bucket.results || []) {
        const date = new Date(bucket.start_time * 1000).toISOString().split('T')[0]
        
        // Calculate cost based on tokens and model
        const inputCost = (result.input_tokens || 0) * getModelInputPrice(result.model)
        const outputCost = (result.output_tokens || 0) * getModelOutputPrice(result.model)
        const cost = inputCost + outputCost
        
        // Aggregate by date
        const existing = daily.find(d => d.date === date)
        if (existing) {
          existing.cost += cost
        } else {
          daily.push({ date, cost })
        }
        
        totalCost += cost
        promptTokens += result.input_tokens || 0
        completionTokens += result.output_tokens || 0

        const model = result.model || 'unknown'
        if (!byModel[model]) byModel[model] = 0
        byModel[model] += cost
      }
    }
  }

  // Sort daily by date
  daily.sort((a, b) => a.date.localeCompare(b.date))

  return {
    totalCost,
    totalTokens: promptTokens + completionTokens,
    promptTokens,
    completionTokens,
    projectedMonthly: days > 0 ? (totalCost / days) * 30 : 0,
    daily: daily.slice(-days),
    byModel: Object.entries(byModel)
      .map(([name, cost]) => ({ name, cost }))
      .sort((a, b) => b.cost - a.cost)
  }
}

function transformOpenAIBillingData(data, days) {
  const daily = []
  const byModel = {}
  let totalCost = 0

  // Process daily costs from billing endpoint
  if (data.daily_costs) {
    for (const day of data.daily_costs) {
      const date = new Date(day.timestamp * 1000).toISOString().split('T')[0]
      let dayCost = 0
      
      for (const item of day.line_items || []) {
        dayCost += item.cost || 0
        const model = item.name || 'unknown'
        if (!byModel[model]) byModel[model] = 0
        byModel[model] += item.cost || 0
      }
      
      daily.push({ date, cost: dayCost / 100 }) // Convert cents to dollars
      totalCost += dayCost / 100
    }
  }

  return {
    totalCost,
    totalTokens: Math.round(totalCost * 20000), // Rough estimate
    promptTokens: Math.round(totalCost * 12000),
    completionTokens: Math.round(totalCost * 8000),
    projectedMonthly: days > 0 ? (totalCost / days) * 30 : 0,
    daily: daily.slice(-days),
    byModel: Object.entries(byModel)
      .map(([name, cost]) => ({ name, cost: cost / 100 }))
      .sort((a, b) => b.cost - a.cost)
  }
}

// ============ ANTHROPIC ============

export async function fetchAnthropicUsage(apiKey, days = 30) {
  try {
    const url = USE_DIRECT_API
      ? 'https://api.anthropic.com/v1/usage'
      : `${PROXY_URL}/proxy/anthropic/v1/usage`

    const headers = USE_DIRECT_API
      ? { 
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      : { 'x-api-key': apiKey }

    const response = await fetch(url, { headers })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error?.message || `Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    return transformAnthropicData(data, days)

  } catch (err) {
    // If network error or proxy not configured, use demo mode
    if (err.message.includes('Failed to fetch') || PROXY_URL.includes('your-subdomain')) {
      console.warn('Proxy not configured or unreachable, using demo data')
      return generateMockData('anthropic', days)
    }
    throw err
  }
}

function transformAnthropicData(data, days) {
  const daily = []
  const byModel = {}
  let totalCost = 0
  let promptTokens = 0
  let completionTokens = 0

  if (data.usage || data.data) {
    const usage = data.usage || data.data
    for (const entry of usage) {
      const cost = entry.cost || calculateAnthropicCost(entry)
      const date = entry.date || new Date().toISOString().split('T')[0]
      
      daily.push({ date, cost })
      totalCost += cost
      promptTokens += entry.input_tokens || 0
      completionTokens += entry.output_tokens || 0

      const model = entry.model || 'claude'
      if (!byModel[model]) byModel[model] = 0
      byModel[model] += cost
    }
  }

  return {
    totalCost,
    totalTokens: promptTokens + completionTokens,
    promptTokens,
    completionTokens,
    projectedMonthly: days > 0 ? (totalCost / days) * 30 : 0,
    daily: daily.slice(-days),
    byModel: Object.entries(byModel)
      .map(([name, cost]) => ({ name, cost }))
      .sort((a, b) => b.cost - a.cost)
  }
}

function calculateAnthropicCost(entry) {
  const inputTokens = entry.input_tokens || 0
  const outputTokens = entry.output_tokens || 0
  const model = entry.model || ''
  
  // Anthropic pricing (per 1M tokens)
  if (model.includes('opus')) {
    return (inputTokens * 15 + outputTokens * 75) / 1_000_000
  } else if (model.includes('sonnet')) {
    return (inputTokens * 3 + outputTokens * 15) / 1_000_000
  } else if (model.includes('haiku')) {
    return (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000
  }
  // Default to sonnet pricing
  return (inputTokens * 3 + outputTokens * 15) / 1_000_000
}

// ============ MODEL PRICING ============

function getModelInputPrice(model) {
  // OpenAI pricing per token (as of 2024)
  const prices = {
    'gpt-4o': 2.5 / 1_000_000,
    'gpt-4o-mini': 0.15 / 1_000_000,
    'gpt-4-turbo': 10 / 1_000_000,
    'gpt-4': 30 / 1_000_000,
    'gpt-3.5-turbo': 0.5 / 1_000_000,
    'text-embedding-3-small': 0.02 / 1_000_000,
    'text-embedding-3-large': 0.13 / 1_000_000,
  }
  
  for (const [key, price] of Object.entries(prices)) {
    if (model?.includes(key)) return price
  }
  return 1 / 1_000_000 // Default fallback
}

function getModelOutputPrice(model) {
  const prices = {
    'gpt-4o': 10 / 1_000_000,
    'gpt-4o-mini': 0.6 / 1_000_000,
    'gpt-4-turbo': 30 / 1_000_000,
    'gpt-4': 60 / 1_000_000,
    'gpt-3.5-turbo': 1.5 / 1_000_000,
    'text-embedding-3-small': 0.02 / 1_000_000,
    'text-embedding-3-large': 0.13 / 1_000_000,
  }
  
  for (const [key, price] of Object.entries(prices)) {
    if (model?.includes(key)) return price
  }
  return 3 / 1_000_000 // Default fallback
}

// ============ MOCK DATA (Demo Mode) ============

function generateMockData(provider, days) {
  const models = provider === 'openai' 
    ? ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'text-embedding-3-small']
    : ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307', 'claude-3-5-haiku-20241022']

  const daily = []
  const byModel = {}
  let totalCost = 0
  let promptTokens = 0
  let completionTokens = 0

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    
    const baseMultiplier = 1 + Math.sin(i * 0.3) * 0.5
    const randomness = 0.5 + Math.random() * 1
    const dayCost = (2 + Math.random() * 8) * baseMultiplier * randomness
    
    daily.push({
      date: date.toISOString().split('T')[0],
      cost: dayCost
    })
    totalCost += dayCost
  }

  const modelWeights = [0.45, 0.25, 0.15, 0.1, 0.05].slice(0, models.length)
  models.forEach((model, i) => {
    byModel[model] = totalCost * (modelWeights[i] || 0.1)
  })

  promptTokens = Math.round(totalCost * 15000)
  completionTokens = Math.round(totalCost * 8000)

  return {
    totalCost,
    totalTokens: promptTokens + completionTokens,
    promptTokens,
    completionTokens,
    projectedMonthly: (totalCost / days) * 30,
    daily,
    byModel: Object.entries(byModel)
      .map(([name, cost]) => ({ name, cost }))
      .sort((a, b) => b.cost - a.cost),
    _demo: true
  }
}

// ============ HELPERS ============

function formatDate(date) {
  return date.toISOString().split('T')[0]
}
