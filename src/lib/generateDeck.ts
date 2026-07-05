// AI orchestration layer (server-only). Provider-agnostic:
//   1. ANTHROPIC_API_KEY  -> Claude (claude-opus-4-8), structured JSON
//   2. GITHUB_TOKEN       -> GitHub Models (gpt-4o-mini), like the existing scripts
//   3. neither            -> local heuristic splitter, so the feature always works
// Every path is normalized through normalizeDeck() and never throws.

import { Deck, ThemeName } from '@/types/deck'
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/deckPrompt'
import { normalizeDeck } from '@/lib/normalizeDeck'

export interface GenerateInput {
  text: string
  theme?: ThemeName
  title?: string
}
export interface GenerateResult {
  deck: Deck
  provider: 'anthropic' | 'github-models' | 'local'
}

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
const GH_ENDPOINT =
  process.env.GITHUB_MODELS_ENDPOINT || 'https://models.github.ai/inference/chat/completions'
const GH_MODEL = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4o-mini'

// Pull the first well-formed JSON object out of a model response.
function extractJson(content: string): unknown {
  let s = content.trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('no JSON object found')
  return JSON.parse(s.slice(start, end + 1))
}

async function viaAnthropic(input: GenerateInput, theme: ThemeName): Promise<Deck> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    // Note: claude-opus-4-8 rejects `temperature`; steer via the prompt instead.
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(input.text, theme, input.title) }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${await res.text()}`)
  const json = await res.json()
  const block = Array.isArray(json?.content)
    ? json.content.find((b: { type?: string }) => b.type === 'text')
    : null
  if (!block?.text) throw new Error('no text block in Anthropic response')
  return normalizeDeck(extractJson(block.text), theme)
}

async function viaGitHubModels(input: GenerateInput, theme: ThemeName): Promise<Deck> {
  const res = await fetch(GH_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: 'application/json',
    },
    body: JSON.stringify({
      model: GH_MODEL,
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input.text, theme, input.title) },
      ],
    }),
  })
  if (!res.ok) throw new Error(`GitHub Models HTTP ${res.status}: ${await res.text()}`)
  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  if (!content) throw new Error('no content in GitHub Models response')
  return normalizeDeck(extractJson(content), theme)
}

// Deterministic fallback: split raw text into a sensible deck with no LLM.
export function heuristicDeck(input: GenerateInput, theme: ThemeName): Deck {
  const lines = input.text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s#>*\-•▍]+/, '').trim())
    .filter(Boolean)

  const title = (input.title || lines[0] || '簡報').slice(0, 40)
  const body = input.title ? lines : lines.slice(1)

  const slides: Deck['slides'] = [
    { id: 's1', layout: 'cover', eyebrow: '自動生成', title, subtitle: body[0]?.slice(0, 60) },
  ]

  const rest = body.filter((l) => l.length > 1)
  if (rest.length >= 3) {
    slides.push({ id: 's-agenda', layout: 'agenda', title: '大綱', items: rest.slice(0, 5) })
  }

  for (let i = 0; i < rest.length; i += 4) {
    const chunk = rest.slice(i, i + 4)
    slides.push({
      id: `s-b${i}`,
      layout: 'bullets',
      title: `重點 ${Math.floor(i / 4) + 1}`,
      points: chunk.map((t, j) => ({ text: t, emphasis: j === 0 })),
    })
    if (slides.length > 10) break
  }

  slides.push({ id: 's-end', layout: 'closing', title: '謝謝', subtitle: '本簡報由 AI 依既有風格自動生成' })
  return normalizeDeck({ meta: { title, theme, templateId: 'executive' }, slides }, theme)
}

// Force the user-selected template to win, even if the model echoed a different
// theme in meta — the renderer routes styling off meta.theme.
function enforceTheme(deck: Deck, theme: ThemeName): Deck {
  return { ...deck, meta: { ...deck.meta, theme, templateId: theme } }
}

export async function generateDeck(input: GenerateInput): Promise<GenerateResult> {
  const theme: ThemeName = input.theme || 'medus'

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return { deck: enforceTheme(await viaAnthropic(input, theme), theme), provider: 'anthropic' }
    } catch (e) {
      console.error('Anthropic generation failed, falling back:', (e as Error).message)
    }
  }
  if (process.env.GITHUB_TOKEN) {
    try {
      return { deck: enforceTheme(await viaGitHubModels(input, theme), theme), provider: 'github-models' }
    } catch (e) {
      console.error('GitHub Models generation failed, falling back:', (e as Error).message)
    }
  }
  return { deck: enforceTheme(heuristicDeck(input, theme), theme), provider: 'local' }
}
