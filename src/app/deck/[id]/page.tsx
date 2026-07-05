import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Sparkles } from 'lucide-react'
import DeckViewer from '@/components/deck/DeckViewer'
import { Deck } from '@/types/deck'
import sampleDeck from '@/data/decks/sample.json'
import medusDeck from '@/data/decks/medus.json'

// Bundled demo decks. Generated decks are previewed live on /generate (MVP has no
// server-side persistence yet — see the roadmap in the design doc).
const DECKS: Record<string, Deck> = {
  medus: medusDeck as Deck,
  sample: sampleDeck as Deck,
}

// Next 16: `params` is a Promise and must be awaited.
export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deck = DECKS[id]
  if (!deck) notFound()

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/generate" className="text-slate-400 hover:text-slate-600">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-sm font-bold text-slate-900">{deck.meta.title}</h1>
              <p className="text-[11px] text-slate-400">{deck.meta.author}</p>
            </div>
          </div>
          <Link
            href="/generate"
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1.5"
          >
            <Sparkles size={13} /> 產生新簡報
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <DeckViewer deck={deck} />
      </div>
    </div>
  )
}
