import { useState } from 'react'

const BUDGET_KEY = 'agentcost_monthly_budget'

export default function BudgetTracker({ projectedMonthly }) {
  const [budget, setBudget] = useState(() => {
    const saved = localStorage.getItem(BUDGET_KEY)
    return saved ? parseFloat(saved) : null
  })
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(() => {
    return localStorage.getItem(BUDGET_KEY) || ''
  })

  const saveBudget = () => {
    const value = parseFloat(inputValue)
    if (value > 0) {
      localStorage.setItem(BUDGET_KEY, value.toString())
      setBudget(value)
    }
    setEditing(false)
  }

  const clearBudget = () => {
    localStorage.removeItem(BUDGET_KEY)
    setBudget(null)
    setInputValue('')
    setEditing(false)
  }

  // No budget set yet
  if (!budget && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full p-4 bg-gray-800/50 border border-dashed border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-600 transition-colors text-sm"
      >
        + Set monthly budget
      </button>
    )
  }

  // Editing mode
  if (editing) {
    return (
      <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
        <label className="text-sm text-gray-400 mb-2 block">Monthly Budget</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="100"
              className="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              autoFocus
            />
          </div>
          <button
            onClick={saveBudget}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditing(false)
              setInputValue(budget?.toString() || '')
            }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          {budget && (
            <button
              onClick={clearBudget}
              className="px-4 py-2 bg-red-900/50 hover:bg-red-800 text-red-400 rounded-lg text-sm transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    )
  }

  // Budget display
  const percentUsed = (projectedMonthly / budget) * 100
  const isOverBudget = percentUsed > 100
  const isWarning = percentUsed > 75 && percentUsed <= 100

  return (
    <div className={`p-4 rounded-xl border ${
      isOverBudget 
        ? 'bg-red-900/20 border-red-800/50' 
        : isWarning 
          ? 'bg-amber-900/20 border-amber-800/50'
          : 'bg-gray-900/50 border-gray-800'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <span className="text-sm text-gray-400">Monthly Budget</span>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Edit
        </button>
      </div>
      
      <div className="flex items-baseline gap-2 mb-3">
        <span className={`text-2xl font-bold ${
          isOverBudget ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white'
        }`}>
          ${projectedMonthly.toFixed(2)}
        </span>
        <span className="text-gray-500">/ ${budget.toFixed(2)}</span>
        <span className={`text-sm ml-auto ${
          isOverBudget ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
        }`}>
          {percentUsed.toFixed(0)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOverBudget 
              ? 'bg-red-500' 
              : isWarning 
                ? 'bg-amber-500'
                : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>

      {isOverBudget && (
        <p className="mt-2 text-xs text-red-400">
          ⚠️ Projected to exceed budget by ${(projectedMonthly - budget).toFixed(2)}
        </p>
      )}
      
      <p className="mt-2 text-xs text-gray-500">
        Based on current usage rate • {(budget - projectedMonthly).toFixed(2) > 0 
          ? `$${(budget - projectedMonthly).toFixed(2)} remaining` 
          : 'Over budget'}
      </p>
    </div>
  )
}
