import { useState, useEffect } from 'react'
import Header from './components/Header'
import LocalAgentDashboard from './components/LocalAgentDashboard'
import { checkAgentStatus } from './lib/localAgent'

function App() {
  const [agentStatus, setAgentStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAgentStatus().then(status => {
      setAgentStatus(status)
      setLoading(false)
    })
  }, [])

  const recheckAgent = () => {
    setLoading(true)
    checkAgentStatus().then(status => {
      setAgentStatus(status)
      setLoading(false)
    })
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Loading State */}
        {loading && (
          <div className="text-center py-16 text-gray-400">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
            Connecting to local agent...
          </div>
        )}

        {/* Agent Connected */}
        {!loading && agentStatus?.connected && (
          <LocalAgentDashboard />
        )}

        {/* Agent Offline */}
        {!loading && !agentStatus?.connected && (
          <div className="p-8 bg-gray-900/50 rounded-xl border border-gray-800 text-center">
            <div className="text-6xl mb-4">🖥️</div>
            <h2 className="text-xl font-semibold mb-2">Local Agent Not Running</h2>
            <p className="text-gray-400 mb-6">
              Start the agent to track your API usage locally. All data stays on your machine.
            </p>
            
            <div className="bg-gray-800 rounded-lg p-4 text-left max-w-md mx-auto mb-6">
              <p className="text-xs text-gray-500 mb-2">Start the agent:</p>
              <code className="text-sm text-emerald-400">
                npm run agent
              </code>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 text-left max-w-md mx-auto mb-6">
              <p className="text-xs text-gray-500 mb-2">Then point your SDK:</p>
              <code className="text-sm text-emerald-400">
                ANTHROPIC_BASE_URL=http://localhost:8787/anthropic<br/>
                OPENAI_BASE_URL=http://localhost:8787/openai/v1
              </code>
            </div>
            
            <button
              onClick={recheckAgent}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors"
            >
              Check Again
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-gray-600 text-sm">
        <p>AgentCost.io — Know what you're spending on AI</p>
        <p className="mt-1">Privacy-first • Local tracking • No data stored in cloud</p>
      </footer>
    </div>
  )
}

export default App
