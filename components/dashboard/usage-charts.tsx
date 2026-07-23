'use client'

import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const BRAND_NAVY = '#0d1e45'
const BRAND_RED = '#c8102e'

interface DailyUsagePoint {
  key: string
  label: string
  count: number
}

export function DailyUsageChart({ data }: { data: DailyUsagePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="dailyUsageFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND_NAVY} stopOpacity={0.35} />
            <stop offset="100%" stopColor={BRAND_NAVY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-100 dark:stroke-gray-800" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'currentColor' }}
          className="text-gray-400 dark:text-gray-500"
          axisLine={false}
          tickLine={false}
          interval={Math.ceil(data.length / 8)}
        />
        <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-gray-400 dark:text-gray-500" axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip
          formatter={(value) => [`${value} uso${value === 1 ? '' : 's'}`, '']}
          labelFormatter={(label) => label}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Area type="monotone" dataKey="count" stroke={BRAND_NAVY} strokeWidth={2} fill="url(#dailyUsageFill)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface ToolDistributionEntry {
  slug: string
  label: string
  count: number
}

export function ToolDistributionChart({ data }: { data: ToolDistributionEntry[] }) {
  const height = Math.max(120, data.length * 36)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 12, fill: 'currentColor' }}
          className="text-gray-600 dark:text-gray-300"
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip
          formatter={(value) => [`${value} execuç${value === 1 ? 'ão' : 'ões'}`, '']}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          cursor={{ fill: 'rgba(13, 30, 69, 0.06)' }}
        />
        <Bar dataKey="count" fill={BRAND_NAVY} radius={[0, 4, 4, 0]} activeBar={{ fill: BRAND_RED }} />
      </BarChart>
    </ResponsiveContainer>
  )
}
