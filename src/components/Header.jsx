export default function Header() {
  return (
    <header className="border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 32 32" className="w-8 h-8">
            <defs>
              <linearGradient id="headerGauge" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981"/>
                <stop offset="65%" stopColor="#10b981"/>
                <stop offset="85%" stopColor="#f59e0b"/>
                <stop offset="100%" stopColor="#ef4444"/>
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="15" fill="#1f2937"/>
            <circle cx="16" cy="16" r="10" fill="none" 
                    stroke="url(#headerGauge)" strokeWidth="4"
                    strokeDasharray="47 16"
                    strokeLinecap="round"
                    transform="rotate(135 16 16)"/>
            <circle cx="16" cy="16" r="2" fill="#10b981"/>
            <line x1="16" y1="16" x2="16" y2="8" 
                  stroke="#fff" strokeWidth="1.5" strokeLinecap="round"
                  transform="rotate(50 16 16)"/>
          </svg>
          <div>
            <h1 className="text-xl font-bold text-white">AgentCost</h1>
            <p className="text-xs text-gray-500">Know what you're spending</p>
          </div>
        </div>
        
        <nav className="flex items-center gap-6">
          <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
            Docs
          </a>
          <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
            Pricing
          </a>
          <a 
            href="https://github.com/agentcost" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
            </svg>
          </a>
        </nav>
      </div>
    </header>
  )
}
