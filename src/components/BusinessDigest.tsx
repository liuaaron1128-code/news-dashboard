'use client'

import { Briefcase, Rocket, Lightbulb, Factory, ExternalLink, ArrowUpRight } from 'lucide-react'
import businessData from '@/data/business.json'
import { BusinessDigest as BusinessDigestType } from '@/types/business'

const data = businessData as BusinessDigestType

const KIND_LABEL: Record<string, string> = {
  launch: 'Launch HN',
  show: 'Show HN',
  funding: '募資',
  top: '熱門',
}

export default function BusinessDigest() {
  const { stories, founderStory, caseStudy, industryInsights } = data

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-3">
        <Briefcase size={16} className="text-slate-700" />
        <h2 className="text-base font-bold text-slate-900">商業・創業</h2>
        <span className="text-[10px] text-slate-400 ml-auto">{data.asOf} · {data.source}</span>
      </div>

      {/* Founder story */}
      {founderStory && (
        <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-xl p-4 shadow-sm mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Rocket size={14} className="text-amber-500" />
            <span className="text-sm font-bold text-slate-800">創業故事・創辦人心法</span>
          </div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">{founderStory.title}</div>
          <p className="text-[12.5px] text-slate-700 leading-relaxed">{founderStory.body}</p>
          {founderStory.takeaways?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {founderStory.takeaways.map((t, i) => (
                <li key={i} className="flex gap-2 text-[12px] text-amber-800">
                  <span className="text-amber-400 flex-shrink-0">▍</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Business-model breakdown */}
      {caseStudy && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb size={14} className="text-indigo-500" />
            <span className="text-sm font-bold text-slate-800">商業模式拆解</span>
            {caseStudy.company && caseStudy.company !== '—' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{caseStudy.company}</span>
            )}
          </div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">{caseStudy.title}</div>
          <p className="text-[12.5px] text-slate-700 leading-relaxed">{caseStudy.body}</p>
          {caseStudy.points?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {caseStudy.points.map((t, i) => (
                <li key={i} className="flex gap-2 text-[12px] text-slate-600">
                  <span className="text-indigo-400 flex-shrink-0">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Industry insights */}
      {industryInsights?.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Factory size={14} className="text-slate-500" />
            <span className="text-sm font-bold text-slate-800">關注產業動態</span>
          </div>
          <div className="space-y-2.5">
            {industryInsights.map((ins, i) => (
              <div key={i}>
                <div className="text-[12.5px] font-bold text-slate-700">{ins.industry}</div>
                <p className="text-[12px] text-slate-600 leading-relaxed mt-0.5">{ins.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real startup/tech stories */}
      {stories?.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
          <div className="px-4 py-2.5 flex items-center gap-1.5">
            <ArrowUpRight size={14} className="text-slate-500" />
            <span className="text-sm font-bold text-slate-800">創業・科技真實動態</span>
            <span className="text-[10px] text-slate-400 ml-auto">Hacker News</span>
          </div>
          {stories.map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 hover:bg-slate-50 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-slate-900 leading-snug">
                    {s.titleZh || s.title}
                  </div>
                  {s.titleZh && <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{s.title}</div>}
                  {s.takeaway && <div className="text-[12px] text-slate-600 mt-1 leading-relaxed">{s.takeaway}</div>}
                </div>
                <ExternalLink size={13} className="text-slate-300 mt-0.5 flex-shrink-0" />
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                {s.kind && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {KIND_LABEL[s.kind] || s.kind}
                  </span>
                )}
                {s.points != null && <span className="text-[10px] text-slate-400">▲ {s.points}</span>}
              </div>
            </a>
          ))}
        </div>
      )}

      {data.placeholder && (
        <div className="text-[10px] text-slate-400 mt-2">
          商業/創業內容於每日 04:00 由 Hacker News + GitHub Models 自動更新（免費、免額外金鑰）。
        </div>
      )}
    </div>
  )
}
