import { Slide } from '@/types/deck'

// Renders one slide's content, filling its parent stage. Pure presentational —
// every class mirrors the existing dashboard design system (slate/blue/indigo,
// white cards, rounded-xl, emerald/orange for deltas).

function Head({ index, title }: { index?: number; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-5 sm:mb-7">
      {index != null && (
        <span className="text-xs sm:text-sm font-extrabold text-slate-400 tabular-nums">
          {String(index).padStart(2, '0')}
        </span>
      )}
      <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 text-balance">
        {title}
      </h2>
    </div>
  )
}

const SERIES_BAR = ['bg-blue-600', 'bg-indigo-400', 'bg-emerald-500']
const SERIES_SWATCH = ['bg-blue-600', 'bg-indigo-400', 'bg-emerald-500']

export default function SlideView({ slide, index }: { slide: Slide; index: number }) {
  const pos = index + 1

  switch (slide.layout) {
    case 'cover':
      return (
        <div className="h-full flex flex-col justify-center gap-4 bg-gradient-to-br from-indigo-50 to-white">
          {slide.eyebrow && (
            <div className="text-xs sm:text-sm font-bold tracking-widest uppercase text-blue-600">
              {slide.eyebrow}
            </div>
          )}
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight text-balance">
            {slide.title}
          </h1>
          {slide.subtitle && (
            <p className="text-base sm:text-xl text-slate-500 leading-relaxed">{slide.subtitle}</p>
          )}
        </div>
      )

    case 'agenda':
      return (
        <div className="h-full flex flex-col">
          <Head index={pos} title={slide.title} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 flex-1 content-start">
            {slide.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 sm:py-4"
              >
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 grid place-items-center font-extrabold text-sm tabular-nums flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm sm:text-lg font-semibold text-slate-800">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )

    case 'section':
      return (
        <div className="h-full flex flex-col justify-center gap-3 bg-gradient-to-br from-blue-50 to-white">
          {slide.index && (
            <div className="text-5xl sm:text-8xl font-extrabold text-blue-200 leading-none tabular-nums tracking-tighter">
              {slide.index}
            </div>
          )}
          <div className="text-xs sm:text-sm font-bold tracking-widest uppercase text-blue-600">章節</div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight text-balance">
            {slide.title}
          </h2>
          {slide.subtitle && <p className="text-sm sm:text-lg text-slate-500">{slide.subtitle}</p>}
        </div>
      )

    case 'bullets':
      return (
        <div className="h-full flex flex-col">
          <Head index={pos} title={slide.title} />
          <ul className="flex flex-col gap-3 sm:gap-4 flex-1 justify-center">
            {slide.points.map((p, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span
                  className={`font-extrabold flex-shrink-0 text-lg sm:text-2xl leading-snug ${
                    p.emphasis ? 'text-indigo-500' : 'text-blue-600'
                  }`}
                >
                  ▍
                </span>
                <span className={`text-sm sm:text-xl leading-relaxed ${p.emphasis ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                  {p.text}
                  {p.sub && p.sub.length > 0 && (
                    <span className="block text-xs sm:text-sm text-slate-500 mt-1 font-normal">
                      {p.sub.join('　·　')}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {slide.takeaway && (
            <div className="mt-4 sm:mt-5 flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              <span className="text-[11px] font-extrabold text-indigo-600 tracking-wide whitespace-nowrap pr-3 border-r border-indigo-200">
                核心判斷
              </span>
              <span className="text-xs sm:text-base font-semibold text-slate-800">{slide.takeaway}</span>
            </div>
          )}
        </div>
      )

    case 'two-column':
      return (
        <div className="h-full flex flex-col">
          <Head index={pos} title={slide.title} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {[slide.left, slide.right].map((col, ci) => (
              <div key={ci} className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
                <div className="text-sm sm:text-base font-bold text-slate-800 mb-3">{col.heading}</div>
                <ul className="flex flex-col gap-2">
                  {col.points.map((pt, i) => (
                    <li key={i} className="flex gap-2 text-xs sm:text-base text-slate-700 leading-relaxed">
                      <span className={ci === 0 ? 'text-blue-500' : 'text-indigo-500'}>•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )

    case 'kpi-grid':
      return (
        <div className="h-full flex flex-col">
          <Head index={pos} title={slide.title} />
          <div
            className="grid gap-3 sm:gap-4 flex-1 content-center"
            style={{ gridTemplateColumns: `repeat(${Math.min(slide.kpis.length, 4)}, minmax(0, 1fr))` }}
          >
            {slide.kpis.map((k, i) => (
              <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col gap-1.5">
                <span className="text-[11px] sm:text-xs text-slate-400 font-semibold">{k.label}</span>
                <span className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums leading-none">
                  {k.value}
                </span>
                {k.delta && (
                  <span
                    className={`text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-full self-start ${
                      k.positive === false
                        ? 'text-orange-700 bg-orange-100'
                        : k.positive === true
                          ? 'text-emerald-700 bg-emerald-100'
                          : 'text-slate-600 bg-slate-100'
                    }`}
                  >
                    {k.delta}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )

    case 'chart': {
      const max = Math.max(...slide.chart.series.flatMap((s) => s.data), 1)
      return (
        <div className="h-full flex flex-col">
          <Head index={pos} title={slide.title} />
          <div className="flex gap-4 mb-3 text-xs text-slate-500 font-semibold">
            {slide.chart.series.map((s, si) => (
              <span key={si} className="inline-flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${SERIES_SWATCH[si % 3]}`} />
                {s.name}
              </span>
            ))}
          </div>
          <div className="flex items-end gap-3 sm:gap-8 flex-1 min-h-0 pt-3">
            {slide.chart.categories.map((cat, ci) => (
              <div key={ci} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div className="w-full flex gap-1.5 items-end justify-center flex-1">
                  {slide.chart.series.map((s, si) => (
                    <div
                      key={si}
                      className={`rounded-t-md min-w-[10px] ${SERIES_BAR[si % 3]}`}
                      style={{ width: '26%', height: `${Math.round(((s.data[ci] ?? 0) / max) * 100)}%` }}
                    />
                  ))}
                </div>
                <span className="text-[11px] sm:text-sm text-slate-500 font-semibold">{cat}</span>
              </div>
            ))}
          </div>
          {slide.caption && <p className="text-xs text-slate-400 mt-3">{slide.caption}</p>}
        </div>
      )
    }

    case 'quote':
      return (
        <div className="h-full flex flex-col justify-center gap-5">
          <div className="text-5xl text-blue-200 leading-none font-serif">&ldquo;</div>
          <p className="text-xl sm:text-3xl font-bold text-slate-900 leading-snug text-balance -mt-4">
            {slide.quote}
          </p>
          {slide.attribution && <p className="text-sm sm:text-base text-slate-500 font-semibold">— {slide.attribution}</p>}
        </div>
      )

    case 'timeline':
      return (
        <div className="h-full flex flex-col">
          <Head index={pos} title={slide.title} />
          <div className="flex flex-col gap-3 sm:gap-4 flex-1 justify-center">
            {slide.events.map((e, i) => (
              <div key={i} className="flex gap-3 sm:gap-4 items-start">
                <span className="text-xs sm:text-sm font-bold text-blue-600 w-16 sm:w-20 flex-shrink-0 pt-0.5 tabular-nums">
                  {e.date}
                </span>
                <div className="flex-1 border-l-2 border-slate-200 pl-3 sm:pl-4 pb-1">
                  <div className="text-sm sm:text-lg font-semibold text-slate-800 leading-snug">{e.title}</div>
                  {e.detail && <div className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">{e.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )

    case 'closing':
      return (
        <div className="h-full flex flex-col justify-center gap-3.5">
          <div className="text-xs sm:text-sm font-bold tracking-widest uppercase text-blue-600">結尾</div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight text-balance">
            {slide.title}
          </h2>
          {slide.subtitle && <p className="text-sm sm:text-lg text-slate-500 leading-relaxed">{slide.subtitle}</p>}
          {slide.contact && <p className="text-xs sm:text-sm text-slate-400 font-semibold mt-2">{slide.contact}</p>}
        </div>
      )

    default:
      return null
  }
}
