import { NextRequest } from 'next/server'
import { generateDeck } from '@/lib/generateDeck'
import { ThemeName } from '@/types/deck'

// POST /api/generate — turn raw text into a Deck. Runs the AI orchestration layer
// (Claude -> GitHub Models -> local fallback). Always returns a usable deck.

export const runtime = 'nodejs'

const THEMES: ThemeName[] = ['medus', 'executive', 'briefing', 'minimal']

export async function POST(request: NextRequest) {
  let body: { text?: unknown; title?: unknown; theme?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '請提供 JSON 內容' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (text.length < 10) {
    return Response.json({ error: '請貼上至少一段可供生成的文字（10 字以上）' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : undefined
  const theme = THEMES.includes(body.theme as ThemeName) ? (body.theme as ThemeName) : 'executive'

  try {
    const result = await generateDeck({ text, title, theme })
    return Response.json(result)
  } catch (e) {
    console.error('generateDeck failed:', (e as Error).message)
    return Response.json({ error: '生成失敗，請稍後再試' }, { status: 500 })
  }
}
