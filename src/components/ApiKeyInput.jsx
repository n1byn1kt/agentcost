import { useState } from 'react'

const providerLogos = {
  openai: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  ),
  anthropic: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.304 3.541h-3.483l6.196 16.918h3.483L17.304 3.541zM6.696 3.541.5 20.459h3.483l1.076-3.004h5.56l1.076 3.004h3.483L9.048 3.541H6.696zm.578 11.082l1.809-5.054 1.809 5.054H7.274z" />
    </svg>
  )
}

export default function ApiKeyInput({ 
  provider, 
  label, 
  placeholder, 
  value, 
  onSubmit, 
  onClear,
  isActive 
}) {
  const [inputValue, setInputValue] = useState(value)
  const [showKey, setShowKey] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (inputValue.trim()) {
      onSubmit(provider, inputValue.trim())
    }
  }

  const handleClear = () => {
    setInputValue('')
    onClear(provider)
  }

  const isConnected = value && value.length > 0

  return (
    <div className={`p-6 rounded-xl border transition-all ${
      isActive 
        ? 'bg-gray-800/50 border-emerald-500/50' 
        : isConnected
          ? 'bg-gray-800/30 border-gray-700'
          : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
    }`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`${isConnected ? 'text-emerald-400' : 'text-gray-500'}`}>
          {providerLogos[provider]}
        </div>
        <h3 className="font-semibold text-lg">{label}</h3>
        {isConnected && (
          <span className="ml-auto px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
            Connected
          </span>
        )}
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-gray-900/50 rounded-lg">
            <code className="text-sm text-gray-400 flex-1 font-mono">
              {showKey ? value : `${value.slice(0, 10)}${'•'.repeat(20)}`}
            </code>
            <button
              onClick={() => setShowKey(!showKey)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showKey ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onSubmit(provider, value)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {isActive ? 'Viewing' : 'View Usage'}
            </button>
            <button
              onClick={handleClear}
              className="py-2 px-4 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-red-900/50 hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <input
              type="password"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className="w-full p-3 pr-24 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-md transition-colors"
            >
              Connect
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Key stays in your browser — never sent to any server
          </p>
        </form>
      )}
    </div>
  )
}
