'use client'

import { useMemo, useState } from 'react'
import { CheckIcon, ClockIcon, UmbrellaIcon, XIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { useEmployees } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { config } from '@/lib/config'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { initials, titleCase } from '@/lib/utils/format'
import type { Employee } from '@/types'

type Mark = 'present' | 'late' | 'absent' | 'leave'

const markStyle: Record<Mark, string> = {
  present: 'bg-success/15 text-success',
  late: 'bg-warning/20 text-warning-foreground',
  absent: 'bg-destructive/15 text-destructive',
  leave: 'bg-muted text-muted-foreground',
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}

function markFor(e: Employee, date: string): Mark {
  if (e.status === 'on-leave') return 'leave'
  if (e.status === 'inactive') return 'absent'
  const r = hash(`${e.id}-${date}`)
  const miss = 1 - e.attendanceRate / 100
  if (r < miss) return 'absent'
  if (r < miss + 0.08) return 'late'
  return 'present'
}

function lastDays(count: number) {
  const base = new Date(`${config.referenceDate}T00:00:00`)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() - (count - 1 - i))
    return { iso: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) }
  })
}

const icons = { present: CheckIcon, late: ClockIcon, absent: XIcon, leave: UmbrellaIcon }

export default function AttendancePage() {
  const { t } = useT()
  const { data, isLoading } = useEmployees()
  const { inBranch } = useScope()
  const [days, setDays] = useState('7')
  const dates = useMemo(() => lastDays(Number(days)), [days])
  const staff = useMemo(() => inBranch(data ?? []), [data, inBranch])

  const today = dates[dates.length - 1].iso
  const todayCounts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, leave: 0 }
    for (const e of staff) c[markFor(e, today)]++
    return c
  }, [staff, today])

  return (
    <>
      <PageHeader
        title={t('employees.attendance')}
        description={t('employees.attendanceSubtitle')}
        actions={
          <ToggleGroup variant="outline" value={[days]} onValueChange={(v) => v.length && setDays(v[0])} aria-label={t('employees.attendance')}>
            <ToggleGroupItem value="7">7</ToggleGroupItem>
            <ToggleGroupItem value="14">14</ToggleGroupItem>
          </ToggleGroup>
        }
      />
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('employees.present')} value={String(todayCounts.present)} icon={CheckIcon} />
            <StatCard label={t('employees.late')} value={String(todayCounts.late)} icon={ClockIcon} />
            <StatCard label={t('employees.absent')} value={String(todayCounts.absent)} icon={XIcon} />
            <StatCard label={t('employees.onLeave')} value={String(todayCounts.leave)} icon={UmbrellaIcon} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('employees.attendance')}</CardTitle>
              <CardDescription>
                {(['present', 'late', 'absent', 'leave'] as const).map((m) => (
                  <span key={m} className="me-4 inline-flex items-center gap-1.5">
                    <span className={cn('inline-block size-2.5 rounded-sm', markStyle[m])} aria-hidden />
                    <span className="capitalize">{m}</span>
                  </span>
                ))}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pe-3 text-start font-medium">{t('common.name')}</th>
                    {dates.map((d) => (
                      <th key={d.iso} scope="col" className="px-1 py-2 text-center font-medium">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.slice(0, 30).map((e) => (
                    <tr key={e.id} className="border-t">
                      <th scope="row" className="py-2 pe-3 text-start font-normal">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7">
                            <AvatarFallback style={{ backgroundColor: e.color }} className="text-[10px] text-white">{initials(e.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{e.name}</p>
                            <p className="text-xs text-muted-foreground">{titleCase(e.role)}</p>
                          </div>
                        </div>
                      </th>
                      {dates.map((d) => {
                        const m = markFor(e, d.iso)
                        const Icon = icons[m]
                        return (
                          <td key={d.iso} className="px-1 py-2 text-center">
                            <span className={cn('inline-flex size-7 items-center justify-center rounded-md', markStyle[m])} title={m}>
                              <Icon className="size-3.5" aria-hidden />
                              <span className="sr-only">{m}</span>
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}
