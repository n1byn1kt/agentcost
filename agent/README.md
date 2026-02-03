# AgentCost Local Agent

A local proxy that tracks your AI API usage without sending data anywhere.

## Privacy Model

```
Your App → Local Agent → OpenAI/Anthropic
               ↓
          Logs usage locally
          (usage-data.json)
```

- ✅ API keys stay on your machine
- ✅ Request/response content is NOT logged
- ✅ Only token counts are recorded
- ✅ Data stored locally, never uploaded

## Quick Start

```bash
# Run the agent
node agent/index.js

# Or with custom port
node agent/index.js --port 9000
```

## Usage

Point your SDK at the local agent:

### Anthropic (Python)

```python
import anthropic

client = anthropic.Anthropic(
    base_url="http://localhost:8787/anthropic"
)

# Use normally - usage is tracked automatically
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### Anthropic (curl)

```bash
curl http://localhost:8787/anthropic/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":100,"messages":[{"role":"user","content":"Hi"}]}'
```

### OpenAI (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8787/openai/v1"
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Health check |
| `GET /stats` | View accumulated usage stats |
| `POST /reset` | Reset all stats |
| `/anthropic/*` | Proxy to api.anthropic.com |
| `/openai/*` | Proxy to api.openai.com |

## Stats Output

```json
{
  "totalInputTokens": 1234,
  "totalOutputTokens": 567,
  "totalCost": 0.0234,
  "byModel": {
    "claude-sonnet-4-20250514": {
      "inputTokens": 1000,
      "outputTokens": 500,
      "cost": 0.02,
      "requests": 5
    }
  },
  "byDay": {
    "2026-01-29": {
      "inputTokens": 1234,
      "outputTokens": 567,
      "cost": 0.0234,
      "requests": 10
    }
  },
  "requests": 10,
  "lastUpdated": "2026-01-29T17:30:00.000Z"
}
```
