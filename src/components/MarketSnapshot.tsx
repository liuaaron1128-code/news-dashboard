'use client'

import { MarketSnapshot as MarketSnapshotType } from '@/types/news'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function MarketSnapshot({ data }: { data: MarketSnapshotType[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
      {data.map((item) => (
        <div key={item.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 text-center">
          <div className="text-slate-500 text-xs mb-1 truncate">{item.label}</div>
          <div className="text-slate-900 font-bold text-sm">{item.value}</div>
          <div className={`text-xs flex items-center justify-center gap-0.5 mt-1 font-medium ${
            item.positive === true ? 'text-green-600' :
            item.positive === false ? 'text-red-600' : 'text-slate-400'
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
