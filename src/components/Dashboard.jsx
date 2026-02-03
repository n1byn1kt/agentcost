import { useState, useEffect } from 'react'
import { fetchOpenAIUsage, fetchAnthropicUsage } from '../lib/providers'

export default function Dashboard({ provider, apiKey, onError }) {
  const [loading, setLoading] = useState(true)
  const [usageData, setUsageData] = useState(null)
  const [dateRange, setDateRange] = useState('30') // days

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      onError(null)
      
      try {
        let data
        if (provider === 'openai') {
          data = await fetchOpenAIUsage(apiKey, parseInt(dateRange))
        } else if (provider === 'anthropic') {
          data = await fetchAnthropicUsage(apiKey, parseInt(dateRange))
        }
        setUsageData(data)
      } catch (err) {
        onError(err.message)
        setUsageData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [provider, apiKey, dateRange, onError])

  if (loading) {
    return (
      <div className="p-8 bg-gray-900/50 rounded-xl border border-gray-800">
        <div className="flex items-center justify-center gap-3">
          <svg className="w-6 h-6 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-gray-400">Fetching usage data from {provider}...</span>
        </div>
      </div>
    )
  }

  if (!usageData) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Demo Mode Banner */}
      {usageData._demo && (
        <div className="p-4 bg-amber-900/20 border border-amber-800/50 rounded-lg">
          <div className="flex items-center gap-2 text-amber-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Demo Mode</span>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Showing simulated data. Direct API access is blocked by CORS in browsers. 
            The full version uses a local agent for true privacy.
          </p>
        </div>
      )}
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="Total Spend"
          value={`$${usageData.totalCost.toFixed(2)}`}
          subtitle={`Last ${dateRange} days`}
          icon="💰"
        />
        <SummaryCard
          title="Total Tokens"
          value={formatNumber(usageData.totalTokens)}
          subtitle={`${formatNumber(usageData.promptTokens)} prompt / ${formatNumber(usageData.completionTokens)} completion`}
          icon="🔤"
        />
        <SummaryCard
          title="Projected Monthly"
          value={`$${usageData.projectedMonthly.toFixed(2)}`}
          subtitle="Based on current usage"
          icon="📈"
          highlight={usageData.projectedMonthly > 100}
        />
      </div>

      {/* Date Range Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Time range:</span>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {/* Daily Usage Chart */}
      <div className="p-6 bg-gray-900/50 rounded-xl border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">Daily Spend</h3>
        <div className="h-48 flex items-end gap-1">
          {usageData.daily.map((day, _i) => {
            const maxCost = Math.max(...usageData.daily.map(d => d.cost))
            const height = maxCost > 0 ? (day.cost / maxCost) * 100 : 0
            return (
              <div
                key={day.date}
                className="flex-1 group relative"
              >
                <div
                  className="bg-emerald-500/70 hover:bg-emerald-500 rounded-t transition-all cursor-pointer"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 rounded text-xs whitespace-nowrap z-10">
                  <div className="font-medium">${day.cost.toFixed(2)}</div>
                  <div className="text-gray-400">{day.date}</div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{usageData.daily[0]?.date}</span>
          <span>{usageData.daily[usageData.daily.length - 1]?.date}</span>
        </div>
      </div>

      {/* Model Breakdown */}
      <div className="p-6 bg-gray-900/50 rounded-xl border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">Spend by Model</h3>
        <div className="space-y-3">
          {usageData.byModel.map((model) => {
            const percentage = usageData.totalCost > 0 
              ? (model.cost / usageData.totalCost) * 100 
              : 0
            return (
              <div key={model.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{model.name}</span>
                  <span className="text-gray-400">${model.cost.toFixed(2)}</span>
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
      <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
    </div>
  )
}

function formatNumber(num) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}
