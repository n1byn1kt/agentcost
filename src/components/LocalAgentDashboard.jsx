import { useState, useEffect } from 'react'
import { fetchLocalAgentStats, resetLocalAgentStats } from '../lib/localAgent'
import OptimizationTab from './OptimizationTab'
import BudgetTracker from './BudgetTracker'

export default function LocalAgentDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  const loadStats = async () => {
    try {
      const data = await fetchLocalAgentStats()
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
    
    if (autoRefresh) {
      const interval = setInterval(loadStats, 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const handleReset = async () => {
    if (confirm('Reset all usage stats? This cannot be undone.')) {
      await resetLocalAgentStats()
      loadStats()
    }
  }

  if (loading) {
    return (
      <div className="p-8 bg-gray-900/50 rounded-xl border border-gray-800 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
        Loading stats from local agent...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 bg-red-900/20 rounded-xl border border-red-800/50 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={loadStats}
          className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6">
      {/* Privacy Badge & Controls */}
      <div className="p-4 bg-emerald-900/20 border border-emerald-800/50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="font-medium">Local Agent Mode</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
              />
              Auto-refresh
            </label>
            <button
              onClick={loadStats}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors"
              title="Refresh now"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-400">
          Only token counts stored locally. API keys and content pass through, never logged.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-800/50 rounded-lg w-fit">
        <TabButton 
          active={activeTab === 'overview'} 
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </TabButton>
        <TabButton 
          active={activeTab === 'optimize'} 
          onClick={() => setActiveTab('optimize')}
        >
          💡 Optimize
        </TabButton>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab stats={stats} onReset={handleReset} />
      )}
      
      {activeTab === 'optimize' && (
        <OptimizationTab stats={stats} />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active 
          ? 'bg-emerald-600 text-white' 
          : 'text-gray-400 hover:text-white hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function OverviewTab({ stats, onReset }) {
  return (
    <div className="space-y-6">
      {/* Budget Tracker */}
      <BudgetTracker projectedMonthly={stats.projectedMonthly} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Spend"
          value={`$${stats.totalCost.toFixed(4)}`}
          icon="💰"
        />
        <SummaryCard
          title="Total Tokens"
          value={formatNumber(stats.totalTokens)}
          subtitle={`${formatNumber(stats.promptTokens)} in / ${formatNumber(stats.completionTokens)} out`}
          icon="🔤"
        />
        <SummaryCard
          title="Requests"
          value={stats.requests.toString()}
          icon="📊"
        />
        <SummaryCard
          title="Projected Monthly"
          value={`$${stats.projectedMonthly.toFixed(2)}`}
          subtitle="Based on current usage"
          icon="📈"
          highlight={stats.projectedMonthly > 50}
        />
      </div>

      {/* Daily Chart */}
      {stats.daily.length > 0 && (
        <div className="p-6 bg-gray-900/50 rounded-xl border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Daily Spend</h3>
          <div className="h-48 flex items-end gap-2">
            {stats.daily.map((day) => {
              const maxCost = Math.max(...stats.daily.map(d => d.cost), 0.0001)
              const heightPercent = day.cost > 0 
                ? Math.max((day.cost / maxCost) * 100, 20)
                : 0
              // Convert to pixels (h-48 = 192px)
              const heightPx = day.cost > 0 ? Math.max((heightPercent / 100) * 192, 40) : 8
              return (
                <div key={day.date} className="flex-1 group relative" style={{ height: '192px' }}>
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-t transition-all cursor-pointer ${
                      day.cost > 0 
                        ? 'bg-emerald-500 hover:bg-emerald-400' 
                        : 'bg-gray-700/50'
                    }`}
                    style={{ height: `${heightPx}px` }}
                  />
                  <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 rounded text-xs whitespace-nowrap z-10 pointer-events-none">
                    <div className="font-medium">${day.cost.toFixed(4)}</div>
                    <div className="text-gray-400">{day.date}</div>
                    <div className="text-gray-400">{day.requests} requests</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            {stats.daily.map((day) => (
              <span key={day.date} className="flex-1 text-center">
                {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Model Breakdown */}
      {stats.byModel.length > 0 && (
        <div className="p-6 bg-gray-900/50 rounded-xl border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Spend by Model</h3>
          <div className="space-y-3">
            {stats.byModel.map((model) => {
              const percentage = stats.totalCost > 0 
                ? (model.cost / stats.totalCost) * 100 
                : 0
              return (
                <div key={model.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300 font-mono">{model.name}</span>
                    <span className="text-gray-400">
                      ${model.cost.toFixed(4)} • {model.requests} req
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {stats.requests === 0 && (
        <div className="p-8 bg-gray-900/50 rounded-xl border border-gray-800 text-center">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-semibold mb-2">No Usage Yet</h3>
          <p className="text-gray-400 mb-4">
            Make API calls through the local agent to start tracking.
          </p>
          <div className="bg-gray-800 rounded-lg p-4 text-left max-w-lg mx-auto">
            <p className="text-xs text-gray-500 mb-2">Example:</p>
            <code className="text-xs text-emerald-400 break-all">
              curl http://localhost:8787/anthropic/v1/messages \<br />
              &nbsp;&nbsp;-H "x-api-key: $ANTHROPIC_API_KEY" \<br />
              &nbsp;&nbsp;-H "anthropic-version: 2023-06-01" \<br />
              &nbsp;&nbsp;-H "content-type: application/json" \<br />
              &nbsp;&nbsp;-d '&#123;"model":"claude-sonnet-4-20250514",...&#125;'
            </code>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center text-sm text-gray-500">
        <span>
          Last updated: {stats.lastUpdated 
            ? new Date(stats.lastUpdated).toLocaleString() 
            : 'Never'}
        </span>
        <button
          onClick={onReset}
          className="text-red-400 hover:text-red-300 transition-colors"
        >
          Reset Stats
        </button>
      </div>
    </div>
  )
}

function SummaryCard({ title, value, subtitle, icon, highlight }) {
  return (
    <div className={`p-5 rounded-xl border ${
      highlight 
        ? 'bg-amber-900/20 border-amber-800/50' 
        : 'bg-gray-900/50 border-gray-800'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm text-gray-400">{title}</span>
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
      )}
    </div>
  )
}

function formatNumber(num) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}
