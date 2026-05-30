'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface StreakDay {
  date: string
  topics_reviewed: number
}

interface StreakCalendarProps {
  data: StreakDay[]
  streak: number
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_LABELS = ['Mon','','Wed','','Fri','','']

function intensityClass(count: number): string {
  if (count === 0) return 'bg-primary-50 border border-primary-100'
  if (count <= 2)  return 'bg-primary-200'
  if (count <= 5)  return 'bg-primary-500'
  return 'bg-primary-700'
}

export function StreakCalendar({ data, streak }: StreakCalendarProps) {
  const { weeks, monthPositions } = useMemo(() => {
    const countMap = new Map(data.map(d => [d.date, d.topics_reviewed]))

    // Build 53 weeks ending at the most recent Sunday
    const today = new Date()
    const dayOfWeek = (today.getDay() + 6) % 7 // Mon=0 … Sun=6
    const lastSunday = new Date(today)
    lastSunday.setDate(today.getDate() + (6 - dayOfWeek))

    const startDate = new Date(lastSunday)
    startDate.setDate(lastSunday.getDate() - 52 * 7 - dayOfWeek)

    const days: { iso: string; count: number }[] = []
    const d = new Date(startDate)
    while (d <= lastSunday) {
      const iso = d.toISOString().slice(0, 10)
      days.push({ iso, count: countMap.get(iso) ?? 0 })
      d.setDate(d.getDate() + 1)
    }

    // Group into weeks (Mon=0 per row, each column is one week)
    const weeksArr: { iso: string; count: number }[][] = []
    for (let i = 0; i < days.length; i += 7) {
      weeksArr.push(days.slice(i, i + 7))
    }

    // Calculate where to show month labels (first week that includes the 1st of a month)
    const positions: { col: number; label: string }[] = []
    weeksArr.forEach((week, col) => {
      week.forEach(({ iso }) => {
        if (iso.endsWith('-01')) {
          const month = parseInt(iso.slice(5, 7), 10) - 1
          positions.push({ col, label: MONTH_LABELS[month] })
        }
      })
    })
    // Deduplicate: keep only first occurrence per label
    const seen = new Set<string>()
    const monthPositions = positions.filter(p => {
      if (seen.has(p.label)) return false
      seen.add(p.label)
      return true
    })

    return { weeks: weeksArr, monthPositions }
  }, [data])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          {streak} day streak
        </p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Less</span>
          {[0, 1, 3, 6, 9].map(n => (
            <div key={n} className={cn('w-3 h-3 rounded-sm', intensityClass(n))} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1" style={{ minWidth: 'max-content' }}>
          {/* Month labels row */}
          <div className="flex gap-1 ml-7">
            {weeks.map((_, colIdx) => {
              const label = monthPositions.find(p => p.col === colIdx)?.label ?? ''
              return (
                <div key={colIdx} className="w-3 text-[10px] text-muted-foreground leading-none">
                  {label}
                </div>
              )
            })}
          </div>

          {/* Day rows */}
          {DAY_LABELS.map((dayLabel, rowIdx) => (
            <div key={rowIdx} className="flex items-center gap-1">
              <span className="w-6 text-[10px] text-muted-foreground text-right">{dayLabel}</span>
              {weeks.map((week, colIdx) => {
                const cell = week[rowIdx]
                if (!cell) return <div key={colIdx} className="w-3 h-3" />
                return (
                  <div
                    key={colIdx}
                    title={`${cell.iso}: ${cell.count} review${cell.count !== 1 ? 's' : ''}`}
                    className={cn('w-3 h-3 rounded-sm cursor-default', intensityClass(cell.count))}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
