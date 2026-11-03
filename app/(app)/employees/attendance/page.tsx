'use client'

import { useMemo, useState } from 'react'
import { CheckIcon, CircleDashedIcon, ClockIcon, UmbrellaIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { useEmployees } from '@/hooks/use-data'
import { useAccess } from '@/hooks/use-access'
import { addDays, todayIso, useAttendance } from '@/hooks/use-insights'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatTime, initials, titleCase } from '@/lib/utils/format'
import { errorMessage } from '@/services/api/client'
import type { AttendanceResponseDto } from '@/services/api/generated/schemas'
import type { Employee } from '@/types'
import { ShiftsCard } from './shifts-card'

type Mark = AttendanceResponseDto['status']

const markStyle: Record<Mark, string> = {
  present: 'bg-success/15 text-success',
  late: 'bg-warning/20 text-warning-foreground',
  absent: 'bg-destructive/15 text-destructive',
  leave: 'bg-muted text-muted-foreground',
}

const icons = { present: CheckIcon, late: ClockIcon, absent: XIcon, leave: UmbrellaIcon }

function lastDays(count: number, today: string) {
  return Array.from({ length: count }, (_, i) => {
    const iso = addDays(today, -(count - 1 - i))
    return { iso, label: new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) }
  })
}

/** `HH:mm` on a calendar day → ISO timestamp (browser time zone). */
const at = (date: string, time: string) => (time ? new Date(`${date}T${time}`).toISOString() : undefined)
const hhmm = (iso: string | null | undefined) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '')

interface Editing {
  employee: Employee
  date: string
  record: AttendanceResponseDto | null
}

/**
 * Attendance from `GET /api/staff/attendance` for the last 7/14 days. A cell with no record is
 * "not marked", never guessed. Clicking a cell records the day (`POST /api/staff/attendance`,
 * idempotent) or corrects it with a reason (`PATCH /api/staff/attendance/{id}`).
 */
export default function AttendancePage() {
  const { t } = useT()
  const { can } = useAccess()
  const { data, isLoading } = useEmployees()
  const { inBranch } = useScope()
  const [days, setDays] = useState('7')
  const [editing, setEditing] = useState<Editing | null>(null)
  const today = todayIso()
  const dates = useMemo(() => lastDays(Number(days), today), [days, today])
  const window = useMemo(() => ({ from: dates[0].iso, to: today }), [dates, today])
  const attendance = useAttendance(window)
  const staff = useMemo(() => inBranch(data ?? []).filter((e) => e.status === 'active'), [data, inBranch])
  const canRecord = can('employees', 'create') || can('employees', 'edit')

  const byCell = useMemo(() => new Map((attendance.data ?? []).map((r) => [`${r.employee_id}|${r.attendance_date}`, r])), [attendance.data])

  const todayCounts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, leave: 0, unmarked: 0 }
    for (const e of staff) {
      const r = byCell.get(`${e.id}|${today}`)
      if (r) c[r.status]++
      else c.unmarked++
    }
    return c
  }, [staff, byCell, today])

  const save = async (v: FormValues) => {
    if (!editing) return
    const { employee, date, record } = editing
    const status = String(v.status) as Mark
    try {
      if (record) {
        await attendance.correct(record, {
          reason: String(v.reason).trim(),
          status,
          check_in_at: at(date, String(v.checkIn)) ?? null,
          check_out_at: at(date, String(v.checkOut)) ?? null,
          note: String(v.note).trim() || null,
        })
        toast.success('Attendance corrected')
      } else {
        const res = await attendance.record({
          branch_id: employee.branchId,
          employee_id: employee.id,
          attendance_date: date,
          status,
          check_in_at: at(date, String(v.checkIn)),
          check_out_at: at(date, String(v.checkOut)),
          note: String(v.note).trim() || undefined,
        })
        toast.success(res.duplicate ? 'Already recorded' : 'Attendance recorded')
      }
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  const NA = attendance.data ? undefined : '—'

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
      {isLoading || (attendance.isLoading && !attendance.data) ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label={t('employees.present')} value={NA ?? String(todayCounts.present)} icon={CheckIcon} />
            <StatCard label={t('employees.late')} value={NA ?? String(todayCounts.late)} icon={ClockIcon} />
            <StatCard label={t('employees.absent')} value={NA ?? String(todayCounts.absent)} icon={XIcon} />
            <StatCard label={t('employees.onLeave')} value={NA ?? String(todayCounts.leave)} icon={UmbrellaIcon} />
            <StatCard label="Not marked" value={NA ?? String(todayCounts.unmarked)} icon={CircleDashedIcon} hint="No record for today yet" />
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
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-sm border border-dashed" aria-hidden />
                  Not marked
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {!attendance.data ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Attendance is not available.</p>
              ) : staff.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No active employees in the selected branches.</p>
              ) : (
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pe-3 text-start font-medium">
                        {t('common.name')}
                      </th>
                      {dates.map((d) => (
                        <th key={d.iso} scope="col" className="px-1 py-2 text-center font-medium">
                          {d.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((e) => (
                      <tr key={e.id} className="border-t">
                        <th scope="row" className="py-2 pe-3 text-start font-normal">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              <AvatarFallback style={{ backgroundColor: e.color }} className="text-[10px] text-white">
                                {initials(e.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{e.name}</p>
                              <p className="text-xs text-muted-foreground">{titleCase(e.role)}</p>
                            </div>
                          </div>
                        </th>
                        {dates.map((d) => {
                          const r = byCell.get(`${e.id}|${d.iso}`)
                          const Icon = r ? icons[r.status] : null
                          const title = r ? `${r.status}${r.check_in_at ? ` · in ${formatTime(r.check_in_at)}` : ''}${r.check_out_at ? ` · out ${formatTime(r.check_out_at)}` : ''}` : 'Not marked'
                          return (
                            <td key={d.iso} className="px-1 py-2 text-center">
                              <button
                                type="button"
                                disabled={!canRecord}
                                onClick={() => setEditing({ employee: e, date: d.iso, record: r ?? null })}
                                className={cn(
                                  'inline-flex size-7 items-center justify-center rounded-md enabled:hover:ring-2 enabled:hover:ring-ring',
                                  r ? markStyle[r.status] : 'border border-dashed text-muted-foreground',
                                )}
                                title={title}
                                aria-label={`${e.name}, ${d.label}: ${title}`}
                              >
                                {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <ShiftsCard employees={staff} />
        </>
      )}
      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing?.record ? 'Correct attendance' : 'Record attendance'}
        description={editing ? `${editing.employee.name} · ${editing.date}${editing.record ? ` · recorded ${editing.record.source}` : ''}` : undefined}
        fields={[
          {
            name: 'status',
            label: t('common.status'),
            type: 'select',
            options: (['present', 'late', 'absent', 'leave'] as const).map((m) => ({ value: m, label: titleCase(m) })),
          },
          { name: 'checkIn', label: 'Check in', type: 'time' },
          { name: 'checkOut', label: 'Check out', type: 'time' },
          { name: 'note', label: 'Note', wide: true },
          ...(editing?.record ? [{ name: 'reason', label: 'Reason for correction', required: true, wide: true }] : []),
        ]}
        initial={{
          status: editing?.record?.status ?? 'present',
          checkIn: hhmm(editing?.record?.check_in_at),
          checkOut: hhmm(editing?.record?.check_out_at),
          note: editing?.record?.note ?? '',
          reason: '',
        }}
        submitLabel={editing?.record ? 'Save correction' : 'Record'}
        onSubmit={save}
      />
    </>
  )
}
