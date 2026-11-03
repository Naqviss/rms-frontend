'use client'

import { useMemo, useState } from 'react'
import { PlusIcon, UserPlusIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { useAccess } from '@/hooks/use-access'
import { addDays, assignShift, createShift, endShiftAssignment, todayIso, useShiftAssignments, useShifts } from '@/hooks/use-insights'
import { useScope } from '@/hooks/use-scope'
import { branchName, currentTenantBranches } from '@/lib/directory'
import { errorMessage } from '@/services/api/client'
import type { ShiftAssignmentResponseDto } from '@/services/api/generated/schemas'
import type { Employee } from '@/types'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** "1-6" / "1,2,3" / "Mon-Sat" → ISO weekdays 1..7. */
function parseDays(input: string): number[] {
  const out = new Set<number>()
  const val = (s: string) => {
    const n = Number(s)
    if (n >= 1 && n <= 7) return n
    const i = WEEKDAYS.findIndex((d) => d.toLowerCase() === s.slice(0, 3).toLowerCase())
    return i >= 0 ? i + 1 : NaN
  }
  for (const part of input.split(',').map((p) => p.trim()).filter(Boolean)) {
    const [a, b] = part.split('-').map((p) => val(p.trim()))
    if (Number.isNaN(a)) continue
    if (b === undefined || Number.isNaN(b)) out.add(a)
    else for (let d = a; d <= b; d++) out.add(d)
  }
  return [...out].sort()
}

/**
 * Branch shifts (`GET/POST /api/staff/shifts`) with today's assignments
 * (`GET /api/staff/shift-assignments?active_on=today`), assigning an employee
 * (`POST /api/staff/shifts/{id}/assignments`) and ending an assignment (`POST …/{id}/end`).
 */
export function ShiftsCard({ employees }: { employees: Employee[] }) {
  const { can } = useAccess()
  const { primaryBranch } = useScope()
  const today = todayIso()
  const shifts = useShifts()
  const assignments = useShiftAssignments(today)
  const [dialog, setDialog] = useState<'shift' | 'assign' | null>(null)
  const [ending, setEnding] = useState<ShiftAssignmentResponseDto | null>(null)
  const [busy, setBusy] = useState(false)
  const canEdit = can('employees', 'edit')
  const nameOf = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees])

  const submit = async (v: FormValues) => {
    try {
      if (dialog === 'shift') {
        const working_days = parseDays(String(v.days))
        if (!working_days.length) {
          toast.error('Enter working days, e.g. 1-6 or Mon-Sat')
          return false
        }
        await createShift({
          branch_id: String(v.branchId),
          name: String(v.name).trim(),
          start_time: String(v.start),
          end_time: String(v.end),
          working_days,
          effective_from: String(v.from),
        })
        await shifts.mutate()
        toast.success('Shift added')
      } else if (dialog === 'assign') {
        await assignShift(String(v.shiftId), { employee_id: String(v.employeeId), effective_from: String(v.from) })
        await assignments.mutate()
        toast.success('Shift assigned')
      }
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  const end = async (a: ShiftAssignmentResponseDto) => {
    setBusy(true)
    try {
      // The assignment covers today; it ends after yesterday (or today if it only started today).
      await endShiftAssignment(a, a.effective_from >= today ? today : addDays(today, -1))
      await assignments.mutate()
      toast.success('Assignment ended')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const active = (shifts.data ?? []).filter((s) => s.is_active)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Shifts</CardTitle>
        <CardDescription>Who is on which shift today</CardDescription>
        {canEdit && (
          <CardAction className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDialog('assign')} disabled={!active.length}>
              <UserPlusIcon data-icon="inline-start" />
              Assign
            </Button>
            <Button size="sm" onClick={() => setDialog('shift')}>
              <PlusIcon data-icon="inline-start" />
              Add shift
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {shifts.isLoading && !shifts.data ? (
          <Skeleton className="h-24 w-full" />
        ) : !shifts.data ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Shifts are not available.</p>
        ) : active.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No shifts defined for the selected branches.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {active.map((s) => {
              const people = (assignments.data ?? []).filter((a) => a.shift_id === s.id)
              return (
                <li key={s.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {s.working_days.map((d) => WEEKDAYS[d - 1] ?? d).join(' ')} · {branchName(s.branch_id)}
                      </p>
                    </div>
                    <Badge variant="secondary">{people.length}</Badge>
                  </div>
                  {people.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {people.map((a) => (
                        <li key={a.id}>
                          <Badge variant="outline" className="gap-1">
                            {nameOf.get(a.employee_id) ?? 'Employee'}
                            {canEdit && (
                              <button type="button" onClick={() => setEnding(a)} disabled={busy} aria-label="End assignment" className="rounded-sm hover:text-destructive">
                                <XIcon className="size-3" />
                              </button>
                            )}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
      <FormDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === 'shift' ? 'Add shift' : 'Assign shift'}
        fields={
          dialog === 'shift'
            ? [
                { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Morning' },
                { name: 'branchId', label: 'Branch', type: 'select', options: currentTenantBranches.map((b) => ({ value: b.id, label: b.name })) },
                { name: 'start', label: 'Starts', type: 'time', required: true },
                { name: 'end', label: 'Ends', type: 'time', required: true },
                { name: 'days', label: 'Working days', required: true, placeholder: '1-6 or Mon-Sat' },
                { name: 'from', label: 'Effective from', type: 'date', required: true },
              ]
            : [
                { name: 'shiftId', label: 'Shift', type: 'select', options: active.map((s) => ({ value: s.id, label: `${s.name} · ${branchName(s.branch_id)}` })) },
                { name: 'employeeId', label: 'Employee', type: 'select', options: employees.map((e) => ({ value: e.id, label: e.name })) },
                { name: 'from', label: 'Effective from', type: 'date', required: true },
              ]
        }
        initial={
          dialog === 'shift'
            ? { name: '', branchId: primaryBranch ?? '', start: '09:00', end: '17:00', days: '1-6', from: today }
            : { shiftId: active[0]?.id ?? '', employeeId: employees[0]?.id ?? '', from: today }
        }
        onSubmit={submit}
      />
      <ConfirmDialog
        open={!!ending}
        onOpenChange={(o) => !o && setEnding(null)}
        title="End this shift assignment?"
        description={ending ? `${nameOf.get(ending.employee_id) ?? 'The employee'} will no longer be on this shift from today.` : ''}
        confirmLabel="End assignment"
        onConfirm={() => {
          if (ending && !busy) void end(ending)
        }}
      />
    </Card>
  )
}
