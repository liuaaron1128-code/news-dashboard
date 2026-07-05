import { Slide } from '@/types/deck'

// Renders one slide in the 杏碩資訊 / Medus Technology template, reconstructed from
// the company's own decks: deep-navy gradient cover + light-ribbon curves, cool
// off-white internal pages, navy headings, blue->navy gradient number badges,
// rounded white content cards, and a navy footer bar on every internal page.

const NAVY = '#1F3A6D'
const NAVY_DEEP = '#0C1B4D'
const NAVY_MID = '#1B2A6D'
const ROYAL = '#2E5BAA'
const BG = '#F2F3F5'
const INK = '#1F2A44'
const MUTED = '#5A6478'
const LINE = '#E3E7EE'

const CJK = '"Microsoft JhengHei","PingFang TC","Noto Sans TC",var(--font-geist-sans),sans-serif'
const DISPLAY = '"Century Gothic","Futura","Questrial","Twentieth Century Gothic",var(--font-geist-sans),sans-serif'

const BADGE = ['#5B9BD5', '#4A85C8', '#3A6EB4', '#2C57A0', '#1B3E7E', '#002060']
const badgeColor = (i: number) => BADGE[Math.min(i, BADGE.length - 1)]

const CHART_FILL = [NAVY, '#5B9BD5', ROYAL]

function Ribbons() {
  // Evokes the flowing light-streaks in the top-right of the Medus cover.
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="rib" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9CC3FF" stopOpacity="0.9" />
          <stop offset="1" stopColor="#3E63C8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#rib)" strokeLinecap="round">
        <path d="M280 560 C 520 380, 760 300, 1060 120" strokeWidth="2.5" opacity="0.9" />
        <path d="M240 600 C 520 420, 800 320, 1080 60" strokeWidth="1.4" opacity="0.7" />
        <path d="M360 560 C 600 400, 820 340, 1040 200" strokeWidth="3.5" opacity="0.55" />
        <path d="M300 620 C 620 440, 860 360, 1120 160" strokeWidth="1" opacity="0.9" />
      </g>
    </svg>
  )
}

function Footer() {
  return (
    <div
      className="absolute left-0 right-0 bottom-0 h-[7.5%] min-h-[24px] px-[3.5%] flex items-center justify-between"
      style={{ background: `linear-gradient(90deg, #16305F, #0E2249)` }}
    >
      <span className="text-white text-[11px] sm:text-sm tracking-wide" style={{ fontFamily: DISPLAY }}>
        Medus
      </span>
      <span className="text-[8px] sm:text-[10px] text-white/55 tracking-wide">
        Medus Technology Inc.
      </span>
    </div>
  )
}

// Light internal frame: cool bg, padded content area, navy footer bar.
function Frame({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: BG, fontFamily: CJK }}>
      <div className={`absolute inset-0 px-[6%] pt-[6%] pb-[10%] flex flex-col ${center ? 'justify-center items-center text-center' : ''}`}>
        {children}
      </div>
      <Footer />
    </div>
  )
}

function TitleBar({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-[3.5%]">
      <span className="w-1.5 self-stretch rounded-sm min-h-[26px]" style={{ background: NAVY }} />
      <h2 className="text-xl sm:text-3xl font-extrabold leading-tight text-balance" style={{ color: NAVY, fontFamily: CJK }}>
        {title}
      </h2>
    </div>
  )
}

function NavyCenter({
  eyebrow,
  title,
  subtitle,
  contact,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  contact?: string
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden flex flex-col justify-center items-center text-center px-[8%]"
      style={{ background: `radial-gradient(120% 120% at 78% 12%, ${NAVY_MID}, ${NAVY_DEEP} 72%)`, fontFamily: CJK }}
    >
      <Ribbons />
      <div className="relative flex flex-col items-center gap-3 sm:gap-4">
        <div className="text-lg sm:text-2xl text-white tracking-[0.18em]" style={{ fontFamily: DISPLAY }}>
          {eyebrow ? <span className="text-white/80 text-xs sm:text-sm tracking-widest">{eyebrow}</span> : 'Medus'}
        </div>
        <h1 className="text-2xl sm:text-5xl font-extrabold text-white leading-tight text-balance" style={{ fontFamily: CJK }}>
          {title}
        </h1>
        {subtitle && <p className="text-sm sm:text-xl leading-relaxed" style={{ color: '#AEC3E8' }}>{subtitle}</p>}
        {contact && <p className="text-[11px] sm:text-sm text-white/60 mt-2">{contact}</p>}
      </div>
      <div className="absolute bottom-[6%] left-0 right-0 text-center text-[9px] sm:text-[11px] tracking-wide" style={{ color: '#9DB2D8' }}>
        杏碩資訊 ｜ Medus Technology Inc.
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm" style={{ borderColor: LINE }}>
      {children}
    </div>
  )
}

export default function MedusSlideView({ slide }: { slide: Slide; index: number }) {
  switch (slide.layout) {
    case 'cover':
      return <NavyCenter eyebrow={slide.eyebrow} title={slide.title} subtitle={slide.subtitle} />

    case 'closing':
      return <NavyCenter title={slide.title} subtitle={slide.subtitle} contact={slide.contact} />

    case 'section':
      return (
        <Frame center>
          <div className="flex items-center gap-4 mb-3">
            <span className="text-3xl sm:text-6xl font-extrabold tabular-nums" style={{ color: NAVY, fontFamily: DISPLAY }}>
              {slide.index || '01'}
            </span>
            <span className="w-16 sm:w-28 h-[3px] rounded" style={{ background: NAVY }} />
          </div>
          <h2 className="text-2xl sm:text-5xl font-extrabold text-balance" style={{ color: NAVY_MID, fontFamily: CJK }}>
            {slide.title}
          </h2>
          {slide.subtitle && <p className="text-sm sm:text-lg mt-3" style={{ color: MUTED }}>{slide.subtitle}</p>}
        </Frame>
      )

    case 'agenda':
      return (
        <Frame>
          <div className="flex items-center gap-[5%] flex-1 min-h-0">
            <div className="hidden sm:block sm:w-[30%] text-5xl font-extrabold" style={{ color: NAVY, fontFamily: DISPLAY }}>
              Topic
            </div>
            <div className="flex-1 flex flex-col justify-center gap-2.5 sm:gap-3.5">
              {slide.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 sm:gap-4">
                  <span
                    className="w-9 h-9 sm:w-11 sm:h-11 rounded-md grid place-items-center text-white font-bold text-sm sm:text-lg flex-shrink-0 tabular-nums shadow-sm"
                    style={{ background: `linear-gradient(160deg, ${badgeColor(i)}, ${NAVY_DEEP})`, fontFamily: DISPLAY }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm sm:text-xl font-bold" style={{ color: NAVY_MID }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </Frame>
      )

    case 'bullets':
      return (
        <Frame>
          <TitleBar title={slide.title} />
          <Card>
            <ul className="flex flex-col gap-2.5 sm:gap-3.5 p-[4%] sm:p-[3.5%]">
              {slide.points.map((p, i) => (
                <li key={i} className="flex gap-2.5 items-start">
                  <span className="mt-[7px] sm:mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.emphasis ? ROYAL : NAVY }} />
                  <span className="text-[13px] sm:text-lg leading-relaxed" style={{ color: INK, fontWeight: p.emphasis ? 700 : 400 }}>
                    {p.text}
                    {p.sub && p.sub.length > 0 && (
                      <span className="block text-xs sm:text-sm mt-1 font-normal pl-1" style={{ color: MUTED }}>
                        {p.sub.map((s, j) => (
                          <span key={j} className="block">— {s}</span>
                        ))}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          {slide.takeaway && (
            <div className="mt-[2.5%] flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: '#E8EDF7', border: `1px solid ${LINE}` }}>
              <span className="text-[10px] sm:text-xs font-extrabold tracking-wide whitespace-nowrap pr-3" style={{ color: NAVY, borderRight: `1px solid #C6D2E8` }}>
                核心判斷
              </span>
              <span className="text-xs sm:text-base font-semibold" style={{ color: NAVY_MID }}>{slide.takeaway}</span>
            </div>
          )}
        </Frame>
      )

    case 'two-column':
      return (
        <Frame>
          <TitleBar title={slide.title} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[3%] flex-1 min-h-0">
            {[slide.left, slide.right].map((col, ci) => (
              <div key={ci} className="bg-white rounded-2xl border shadow-sm flex overflow-hidden" style={{ borderColor: LINE }}>
                <div className="w-[26%] flex items-center justify-center text-center px-2" style={{ background: '#EEF2F9' }}>
                  <span className="text-sm sm:text-lg font-extrabold leading-snug" style={{ color: NAVY }}>{col.heading}</span>
                </div>
                <ul className="flex-1 flex flex-col justify-center gap-2 p-[5%]">
                  {col.points.map((pt, i) => (
                    <li key={i} className="flex gap-2 text-xs sm:text-base leading-relaxed" style={{ color: INK }}>
                      <span style={{ color: ci === 0 ? NAVY : ROYAL }}>•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Frame>
      )

    case 'kpi-grid':
      return (
        <Frame>
          <TitleBar title={slide.title} />
          <div
            className="grid gap-[3%] flex-1 min-h-0 content-center"
            style={{ gridTemplateColumns: `repeat(${Math.min(slide.kpis.length, 4)}, minmax(0,1fr))` }}
          >
            {slide.kpis.map((k, i) => (
              <div key={i} className="bg-white rounded-2xl border shadow-sm p-[7%] flex flex-col gap-1.5" style={{ borderColor: LINE }}>
                <span className="text-[11px] sm:text-xs font-semibold" style={{ color: MUTED }}>{k.label}</span>
                <span className="text-2xl sm:text-4xl font-extrabold tabular-nums leading-none" style={{ color: NAVY, fontFamily: DISPLAY }}>
                  {k.value}
                </span>
                {k.delta && (
                  <span
                    className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full self-start"
                    style={
                      k.positive === false
                        ? { color: '#B91C1C', background: '#FEE2E2' }
                        : k.positive === true
                          ? { color: '#047857', background: '#D1FAE5' }
                          : { color: NAVY, background: '#E8EDF7' }
                    }
                  >
                    {k.delta}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Frame>
      )

    case 'chart': {
      const max = Math.max(...slide.chart.series.flatMap((s) => s.data), 1)
      return (
        <Frame>
          <TitleBar title={slide.title} />
          <div className="flex gap-4 mb-2 text-xs font-semibold" style={{ color: MUTED }}>
            {slide.chart.series.map((s, si) => (
              <span key={si} className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: CHART_FILL[si % 3] }} />
                {s.name}
              </span>
            ))}
          </div>
          <div className="flex items-end gap-3 sm:gap-8 flex-1 min-h-0 pt-2">
            {slide.chart.categories.map((cat, ci) => (
              <div key={ci} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div className="w-full flex gap-1.5 items-end justify-center flex-1">
                  {slide.chart.series.map((s, si) => (
                    <div
                      key={si}
                      className="rounded-t-md min-w-[10px]"
                      style={{ width: '26%', height: `${Math.round(((s.data[ci] ?? 0) / max) * 100)}%`, background: CHART_FILL[si % 3] }}
                    />
                  ))}
                </div>
                <span className="text-[11px] sm:text-sm font-semibold" style={{ color: MUTED }}>{cat}</span>
              </div>
            ))}
          </div>
          {slide.caption && <p className="text-[11px] mt-2" style={{ color: MUTED }}>{slide.caption}</p>}
        </Frame>
      )
    }

    case 'timeline':
      return (
        <Frame>
          <TitleBar title={slide.title} />
          <div className="flex flex-col gap-3 sm:gap-4 flex-1 justify-center">
            {slide.events.map((e, i) => (
              <div key={i} className="flex gap-3 sm:gap-4 items-start">
                <span className="text-xs sm:text-sm font-bold w-16 sm:w-20 flex-shrink-0 pt-0.5 tabular-nums" style={{ color: NAVY, fontFamily: DISPLAY }}>
                  {e.date}
                </span>
                <div className="flex-1 pl-3 sm:pl-4 pb-1" style={{ borderLeft: `2px solid ${LINE}` }}>
                  <div className="text-sm sm:text-lg font-semibold leading-snug" style={{ color: NAVY_MID }}>{e.title}</div>
                  {e.detail && <div className="text-xs sm:text-sm mt-0.5 leading-relaxed" style={{ color: MUTED }}>{e.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </Frame>
      )

    case 'quote':
      return (
        <Frame center>
          <div className="text-5xl leading-none font-serif" style={{ color: '#B9C6E0' }}>&ldquo;</div>
          <p className="text-xl sm:text-3xl font-bold leading-snug text-balance -mt-3" style={{ color: NAVY_MID }}>
            {slide.quote}
          </p>
          {slide.attribution && <p className="text-sm sm:text-base mt-3 font-semibold" style={{ color: MUTED }}>— {slide.attribution}</p>}
        </Frame>
      )

    default:
      return null
  }
}
