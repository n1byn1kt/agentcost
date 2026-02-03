/**
 * Local Agent Integration
 * 
 * Fetches usage stats from the locally running AgentCost agent.
 * No API keys needed — the agent already has the data.
 */

const AGENT_URL = 'http://localhost:8787';

export async function checkAgentStatus() {
  try {
    const response = await fetch(`${AGENT_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      const data = await response.json();
      return { connected: true, service: data.service };
    }
    return { connected: false, error: 'Agent not responding' };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

export async function fetchLocalAgentStats() {
  const response = await fetch(`${AGENT_URL}/stats`);
  
  if (!response.ok) {
    throw new Error(`Agent error: ${response.status}`);
  }
  
  const data = await response.json();
  return transformAgentData(data);
}

export async function resetLocalAgentStats() {
  const response = await fetch(`${AGENT_URL}/reset`, { method: 'POST' });
  return response.ok;
}

function transformAgentData(data) {
  // Generate last 7 days for consistent chart display (using local dates)
  const today = new Date();
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    // Format as YYYY-MM-DD in local timezone
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    last7Days.push(`${yyyy}-${mm}-${dd}`);
  }
  
  // Map to daily data, filling in zeros for missing days
  const daily = last7Days.map(date => {
    const dayData = data.byDay ? data.byDay[date] : null;
    return {
      date,
      cost: dayData ? dayData.cost : 0,
      inputTokens: dayData ? dayData.inputTokens : 0,
      outputTokens: dayData ? dayData.outputTokens : 0,
      requests: dayData ? dayData.requests : 0,
    };
  });
  
  const byModel = Object.entries(data.byModel || {}).map(([name, stats]) => ({
    name,
    cost: stats.cost,
    inputTokens: stats.inputTokens,
    outputTokens: stats.outputTokens,
    requests: stats.requests,
  })).sort((a, b) => b.cost - a.cost);
  
  // Calculate projected monthly (based on days with data)
  const daysWithData = daily.length || 1;
  const avgDailyCost = data.totalCost / daysWithData;
  const projectedMonthly = avgDailyCost * 30;
  
  return {
    totalCost: data.totalCost || 0,
    totalTokens: (data.totalInputTokens || 0) + (data.totalOutputTokens || 0),
    promptTokens: data.totalInputTokens || 0,
    completionTokens: data.totalOutputTokens || 0,
    projectedMonthly,
    daily,
    byModel,
    requests: data.requests || 0,
    lastUpdated: data.lastUpdated,
    _source: 'local-agent',
  };
}
