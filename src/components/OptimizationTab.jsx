/**
 * OptimizationTab - Model comparison and savings calculator
 * 
 * Shows what you could save by switching models, based on your actual usage.
 */

// Model pricing and capability data (2025 rates)
const MODEL_DATA = {
  // Anthropic
  'claude-3-opus': { 
    input: 15, output: 75, 
    provider: 'Anthropic',
    tier: 'premium',
    capability: 95,
    desc: 'Most capable, highest cost'
  },
  'claude-sonnet-4': { 
    input: 3, output: 15, 
    provider: 'Anthropic',
    tier: 'standard',
    capability: 90,
    desc: 'Best balance of cost/capability'
  },
  'claude-3-5-sonnet': { 
    input: 3, output: 15, 
    provider: 'Anthropic',
    tier: 'standard',
    capability: 88,
    desc: 'Previous gen Sonnet'
  },
  'claude-3-5-haiku': { 
    input: 0.25, output: 1.25, 
    provider: 'Anthropic',
    tier: 'fast',
    capability: 75,
    desc: 'Fast and cheap, good for simple tasks'
  },
  'claude-3-haiku': { 
    input: 0.25, output: 1.25, 
    provider: 'Anthropic',
    tier: 'fast',
    capability: 70,
    desc: 'Previous gen Haiku'
  },
  // OpenAI
  'gpt-4o': { 
    input: 2.5, output: 10, 
    provider: 'OpenAI',
    tier: 'standard',
    capability: 88,
    desc: 'Flagship multimodal model'
  },
  'gpt-4o-mini': { 
    input: 0.15, output: 0.6, 
    provider: 'OpenAI',
    tier: 'fast',
    capability: 78,
    desc: 'Cheap and fast'
  },
  'gpt-4-turbo': { 
    input: 10, output: 30, 
    provider: 'OpenAI',
    tier: 'premium',
    capability: 85,
    desc: 'Previous flagship'
  },
  'o3': { 
    input: 10, output: 40, 
    provider: 'OpenAI',
    tier: 'reasoning',
    capability: 95,
    desc: 'Advanced reasoning model'
  },
  'o4-mini': { 
    input: 1.1, output: 4.4, 
    provider: 'OpenAI',
    tier: 'reasoning',
    capability: 82,
    desc: 'Efficient reasoning model'
  },
};

// Tier order for comparison
const TIER_ORDER = { premium: 3, reasoning: 2, standard: 1, fast: 0 };

export default function OptimizationTab({ stats }) {
  if (!stats || stats.requests === 0) {
    return (
      <div className="p-8 bg-gray-900/50 rounded-xl border border-gray-800 text-center">
        <div className="text-4xl mb-4">🎯</div>
        <h3 className="text-lg font-semibold mb-2">No Usage Data Yet</h3>
        <p className="text-gray-400">
          Start using the API through the local agent to see optimization opportunities.
        </p>
      </div>
    );
  }

  // Calculate savings opportunities
  const savings = calculateSavings(stats.byModel);
  const recommendations = generateRecommendations(stats.byModel);

  return (
    <div className="space-y-6">
      {/* Potential Savings Card */}
      <div className={`p-6 rounded-xl border ${
        savings.totalPotential > 0 
          ? 'bg-emerald-900/20 border-emerald-800/50' 
          : 'bg-gray-900/50 border-gray-800'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-2xl">💡</span>
              Potential Monthly Savings
            </h3>
            <p className="text-gray-400 text-sm mt-1">
              If you moved expensive tasks to cheaper models where possible
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-emerald-400">
              ${savings.totalPotential.toFixed(2)}
            </div>
            <div className="text-sm text-gray-400">
              {savings.percentSavings.toFixed(0)}% of current spend
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="p-6 bg-gray-900/50 rounded-xl border border-gray-800">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>📋</span> Recommendations
          </h3>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div key={i} className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-white">{rec.title}</div>
                    <div className="text-sm text-gray-400 mt-1">{rec.description}</div>
                    <div className="text-xs text-gray-500 mt-2 font-mono">
                      {rec.from} → {rec.to}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-semibold">
                      Save ${rec.monthlySavings.toFixed(2)}/mo
                    </div>
                    <div className="text-xs text-gray-500">
                      ~{rec.capabilityDrop}% capability trade-off
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Comparison Table */}
      <div className="p-6 bg-gray-900/50 rounded-xl border border-gray-800">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>📊</span> Model Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4">Model</th>
                <th className="pb-2 pr-4">Provider</th>
                <th className="pb-2 pr-4 text-right">Input $/1M</th>
                <th className="pb-2 pr-4 text-right">Output $/1M</th>
                <th className="pb-2 pr-4 text-right">Capability</th>
                <th className="pb-2">Tier</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {Object.entries(MODEL_DATA)
                .sort((a, b) => b[1].capability - a[1].capability)
                .map(([name, data]) => {
                  const isUsed = stats.byModel.some(m => m.name.includes(name) || name.includes(m.name.split('-').slice(0, 3).join('-')));
                  return (
                    <tr key={name} className={`border-b border-gray-800 ${isUsed ? 'bg-emerald-900/10' : ''}`}>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {isUsed && <span className="text-emerald-400 mr-1">●</span>}
                        {name}
                      </td>
                      <td className="py-2 pr-4 text-gray-400">{data.provider}</td>
                      <td className="py-2 pr-4 text-right">${data.input}</td>
                      <td className="py-2 pr-4 text-right">${data.output}</td>
                      <td className="py-2 pr-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${data.capability}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-8">{data.capability}</span>
                        </div>
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${getTierColor(data.tier)}`}>
                          {data.tier}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-gray-500">
          <span className="text-emerald-400 mr-1">●</span> Models you're currently using
        </div>
      </div>

      {/* Privacy Note */}
      <div className="text-xs text-gray-500 text-center">
        💡 These recommendations are based on public benchmark data, not your prompt content.
        <br />
        Your actual results may vary based on specific use cases.
      </div>
    </div>
  );
}

function getTierColor(tier) {
  switch (tier) {
    case 'premium': return 'bg-purple-900/50 text-purple-300';
    case 'reasoning': return 'bg-blue-900/50 text-blue-300';
    case 'standard': return 'bg-gray-700 text-gray-300';
    case 'fast': return 'bg-amber-900/50 text-amber-300';
    default: return 'bg-gray-700 text-gray-400';
  }
}

function calculateSavings(byModel) {
  let currentMonthlyCost = 0;
  let optimizedMonthlyCost = 0;

  for (const model of byModel) {
    const monthlyCost = model.cost * 30; // rough projection
    currentMonthlyCost += monthlyCost;

    // Find cheaper alternative in same tier
    const modelInfo = findModelInfo(model.name);
    if (modelInfo) {
      const cheaper = findCheaperAlternative(modelInfo);
      if (cheaper) {
        const savingsRatio = 1 - (cheaper.avgCost / modelInfo.avgCost);
        optimizedMonthlyCost += monthlyCost * (1 - savingsRatio * 0.5); // assume 50% can be moved
      } else {
        optimizedMonthlyCost += monthlyCost;
      }
    } else {
      optimizedMonthlyCost += monthlyCost;
    }
  }

  const totalPotential = currentMonthlyCost - optimizedMonthlyCost;
  const percentSavings = currentMonthlyCost > 0 ? (totalPotential / currentMonthlyCost) * 100 : 0;

  return { totalPotential, percentSavings, currentMonthlyCost };
}

function findModelInfo(modelName) {
  for (const [key, data] of Object.entries(MODEL_DATA)) {
    if (modelName.includes(key) || key.includes(modelName.split('-').slice(0, 3).join('-'))) {
      return { ...data, name: key, avgCost: (data.input + data.output) / 2 };
    }
  }
  return null;
}

function findCheaperAlternative(modelInfo) {
  const alternatives = Object.entries(MODEL_DATA)
    .filter(([_name, data]) => 
      data.provider === modelInfo.provider &&
      TIER_ORDER[data.tier] < TIER_ORDER[modelInfo.tier] &&
      data.capability >= modelInfo.capability * 0.75 // at least 75% capability
    )
    .map(([name, data]) => ({ 
      ...data, 
      name,
      avgCost: (data.input + data.output) / 2 
    }))
    .sort((a, b) => b.capability - a.capability);

  return alternatives[0] || null;
}

function generateRecommendations(byModel) {
  const recommendations = [];

  for (const model of byModel) {
    const modelInfo = findModelInfo(model.name);
    if (!modelInfo) continue;

    const cheaper = findCheaperAlternative(modelInfo);
    if (!cheaper) continue;

    const monthlyCost = model.cost * 30;
    const savingsRatio = 1 - (cheaper.avgCost / modelInfo.avgCost);
    const monthlySavings = monthlyCost * savingsRatio * 0.5; // assume 50% can move

    if (monthlySavings < 0.50) continue; // not worth mentioning

    recommendations.push({
      title: `Consider ${cheaper.name} for some ${modelInfo.name} tasks`,
      description: cheaper.desc,
      from: modelInfo.name,
      to: cheaper.name,
      monthlySavings,
      capabilityDrop: Math.round((1 - cheaper.capability / modelInfo.capability) * 100),
    });
  }

  return recommendations.sort((a, b) => b.monthlySavings - a.monthlySavings).slice(0, 3);
}
