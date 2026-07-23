'use client'

import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const BRAND_NAVY = '#0d1e45'
const BRAND_RED = '#c8102e'

// Tooltip com classes Tailwind (com variante dark:) em vez de contentStyle —
// o contentStyle do recharts não define cor de texto, só herda do body, o
// que no tema escuro resultava em texto claro sobre a caixa branca padrão.
function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg px-3 py-2 text-xs">
      {children}
    </div>
  )
}

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
          cursor={{ stroke: 'rgba(148, 163, 184, 0.4)', strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const count = Number(payload[0]?.value ?? 0)
            return (
              <TooltipBox>
                <p className="text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{count} uso{count === 1 ? '' : 's'}</p>
              </TooltipBox>
            )
          }}
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
          cursor={{ fill: 'rgba(148, 163, 184, 0.18)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const entry = payload[0]
            const count = Number(entry?.value ?? 0)
            const label = (entry?.payload as ToolDistributionEntry | undefined)?.label ?? ''
            return (
              <TooltipBox>
                <p className="text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{count} execuç{count === 1 ? 'ão' : 'ões'}</p>
              </TooltipBox>
            )
          }}
        />
        <Bar dataKey="count" fill={BRAND_NAVY} radius={[0, 4, 4, 0]} activeBar={{ fill: BRAND_RED }} />
      </BarChart>
    </ResponsiveContainer>
  )
}
