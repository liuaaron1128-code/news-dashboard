// Shared LLM helper for the data-fetch scripts.
//
// Calls the Anthropic Claude Messages API over raw HTTP (no SDK dependency, to
// keep the scripts npm-install-free in CI). Exposes a small OpenAI-chat-shaped
// interface so the fetch scripts can swap their old GitHub Models calls with a
// minimal change: build the same [{role, content}] messages, call chat(), and
// parse the returned text.
//
// GitHub Models (the previous free backend) was retired — its endpoint now
// returns HTTP 410 github_models_retirement_brownout — so these scripts moved to
// Claude via the ANTHROPIC_API_KEY secret already used by fetch-market-signals.
// If ANTHROPIC_API_KEY is unset, callers degrade gracefully and leave their JSON
// untouched (never blanked).

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const ENDPOINT = 'https://api.anthropic.com/v1/messages'

// Default model matches fetch-market-signals.mjs. Override per run with NEWS_LLM_MODEL.
export const LLM_MODEL = process.env.NEWS_LLM_MODEL || 'claude-opus-4-8'

export const hasLLM = () => Boolean(ANTHROPIC_KEY)

/**
 * Send an OpenAI-style messages array to Claude and return the assistant text.
 * `system` messages are hoisted into the top-level system field; the rest map to
 * user/assistant turns. Throws on missing key, HTTP error, refusal, or empty
 * output so callers can fall back to their previous data.
 */
export async function chat(messages, { maxTokens = 4000, model = LLM_MODEL } = {}) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not set')
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
  const convo = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: convo,
  })

  let lastErr
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body,
        signal: AbortSignal.timeout(120000),
      })
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300)
        const err = new Error(`Anthropic HTTP ${res.status}: ${detail}`)
        // Retry transient rate-limit / overload / server errors only.
        if (res.status === 429 || res.status >= 500) throw err
        throw Object.assign(err, { fatal: true })
      }
      const json = await res.json()
      if (json.stop_reason === 'refusal') throw Object.assign(new Error('Anthropic refusal'), { fatal: true })
      const text = (json.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
      if (!text) throw new Error('empty response')
      return text
    } catch (e) {
      lastErr = e
      if (e.fatal || attempt === 3) throw e
      await new Promise((r) => setTimeout(r, attempt * 3000))
    }
  }
  throw lastErr
}

/**
 * Parse a JSON object out of an LLM text response, tolerating code fences or
 * incidental prose around it. Throws (via JSON.parse) if no object is found.
 */
export function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced ? fenced[1] : text).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  return JSON.parse(start >= 0 && end > start ? body.slice(start, end + 1) : body)
}
