'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { OptionSelect, type Option } from '@/components/common/option-select'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'

export type FormValue = string | number | boolean
export type FormValues = Record<string, FormValue>

export interface FieldDef {
  name: string
  label: string
  type?: 'text' | 'number' | 'email' | 'tel' | 'date' | 'time' | 'textarea' | 'select' | 'switch'
  options?: Option[]
  required?: boolean
  placeholder?: string
  /** Occupy both columns on wider screens. */
  wide?: boolean
}

interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  fields: FieldDef[]
  initial: FormValues
  submitLabel?: string
  onSubmit: (values: FormValues) => void | Promise<void>
  /** Live summary shown under the fields, computed from the values being edited. */
  preview?: (values: FormValues) => React.ReactNode
}

export function FormDialog({ open, onOpenChange, title, description, fields, initial, submitLabel, onSubmit, preview }: FormDialogProps) {
  const { t } = useT()
  const [values, setValues] = useState<FormValues>(initial)
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setValues(initial)
      setTouched(false)
    }
    // Reset only when the dialog opens; `initial` is a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = (name: string, v: FormValue) => setValues((p) => ({ ...p, [name]: v }))
  const invalid = (f: FieldDef) => !!f.required && f.type !== 'switch' && String(values[f.name] ?? '').trim() === ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (fields.some(invalid)) return
    setSubmitting(true)
    const out: FormValues = {}
    for (const f of fields) out[f.name] = f.type === 'number' ? Number(values[f.name] ?? 0) : (values[f.name] ?? '')
    await onSubmit(out)
    setSubmitting(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={cn(!description && 'sr-only')}>{description ?? title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => {
              const id = `field-${f.name}`
              const bad = touched && invalid(f)
              return (
                <Field
                  key={f.name}
                  data-invalid={bad || undefined}
                  className={cn(f.wide && 'sm:col-span-2', f.type === 'switch' && 'flex-row items-center justify-between')}
                >
                  <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
                  {f.type === 'select' ? (
                    <OptionSelect
                      id={id}
                      value={String(values[f.name] ?? '')}
                      onValueChange={(v) => set(f.name, v)}
                      options={f.options ?? []}
                      placeholder={f.placeholder}
                    />
                  ) : f.type === 'textarea' ? (
                    <Textarea
                      id={id}
                      value={String(values[f.name] ?? '')}
                      onChange={(e) => set(f.name, e.target.value)}
                      placeholder={f.placeholder}
                      aria-invalid={bad || undefined}
                      rows={3}
                    />
                  ) : f.type === 'switch' ? (
                    <Switch id={id} checked={!!values[f.name]} onCheckedChange={(v) => set(f.name, v)} />
                  ) : (
                    <Input
                      id={id}
                      type={f.type ?? 'text'}
                      value={String(values[f.name] ?? '')}
                      onChange={(e) => set(f.name, e.target.value)}
                      placeholder={f.placeholder}
                      aria-invalid={bad || undefined}
                      inputMode={f.type === 'number' ? 'decimal' : undefined}
                    />
                  )}
                </Field>
              )
            })}
          </FieldGroup>
          {preview?.(values)}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitLabel ?? t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
