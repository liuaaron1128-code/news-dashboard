'use client'

import { MarketSnapshot as MarketSnapshotType } from '@/types/news'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function MarketSnapshot({ data }: { data: MarketSnapshotType[] }) {
  return (
    <div className="flex gap-2.5 overflow-x-auto no-scrollbar mb-4 -mx-4 px-4">
      {data.map((item) => (
        <div key={item.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 text-center flex-shrink-0 min-w-[90px]">
          <div className="text-slate-400 text-[11px] mb-1.5 leading-tight whitespace-nowrap">{item.label}</div>
          <div className="text-slate-900 font-bold text-[15px] leading-tight">{item.value}</div>
          <div className={`text-[11px] flex items-center justify-center gap-0.5 mt-1.5 font-semibold ${
            item.positive === true ? 'text-green-600' :
            item.positive === false ? 'text-red-500' : 'text-slate-400'
          }`}>
            {item.positive === true && <TrendingUp size={10} />}
            {item.positive === false && <TrendingDown size={10} />}
            {item.positive === null && <Minus size={10} />}
            {item.change}
          </div>
        </div>
      ))}
    </div>
  )
}
