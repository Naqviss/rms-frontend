'use client'

import { useEffect, useState } from 'react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  GripVerticalIcon,
  LayoutDashboardIcon,
  Maximize2Icon,
  PlusIcon,
  RotateCcwIcon,
  Settings2Icon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { PageHeader } from '@/components/common/page-header'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { useDashboardStore, type WidgetInstance, type WidgetSize } from '@/stores/dashboard-store'
import { useDashboardData } from './use-dashboard-data'
import { widgetById, widgetRegistry } from './widgets'

const spanClass: Record<WidgetSize, string> = {
  sm: 'col-span-12 sm:col-span-6 xl:col-span-3',
  md: 'col-span-12 xl:col-span-6',
  lg: 'col-span-12 xl:col-span-8',
  full: 'col-span-12',
}

function move<T>(list: T[], from: number, to: number) {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function DashboardGrid() {
  const { t, td } = useT()
  const layout = useDashboardStore((s) => s.layout)
  const setLayout = useDashboardStore((s) => s.setLayout)
  const reset = useDashboardStore((s) => s.reset)
  const data = useDashboardData()
  const [editing, setEditing] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  useEffect(() => {
    void useDashboardStore.persist.rehydrate()
  }, [])

  const items = layout.filter((w) => widgetById[w.id])
  const available = widgetRegistry.filter((w) => !items.some((i) => i.id === w.id))

  const cycleSize = (index: number) => {
    const w = items[index]
    const sizes = widgetById[w.id].sizes
    const next = sizes[(sizes.indexOf(w.size) + 1) % sizes.length] ?? sizes[0]
    setLayout(items.map((x, i) => (i === index ? { ...x, size: next } : x)))
  }

  const addWidget = (id: string) => {
    const def = widgetById[id]
    const entry: WidgetInstance = { id, size: def.sizes[0] === 'sm' ? 'sm' : 'md' }
    setLayout([...items, entry])
  }

  const finishDrag = () => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      setLayout(move(items, dragIndex, overIndex))
    }
    setDragIndex(null)
    setOverIndex(null)
  }

  const toggleEditing = () => {
    if (editing) toast.success(t('dashboard.layoutSaved'))
    setEditing((v) => !v)
  }

  return (
    <>
      <PageHeader
        title={t('dashboard.greeting')}
        description={editing ? t('dashboard.dragHint') : t('dashboard.subtitle')}
        actions={
          <>
            {editing && (
              <>
                <Button variant="outline" onClick={() => setLibraryOpen(true)}>
                  <PlusIcon data-icon="inline-start" />
                  {t('dashboard.addWidget')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    reset()
                    toast.success(t('dashboard.layoutReset'))
                  }}
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  {t('dashboard.resetLayout')}
                </Button>
              </>
            )}
            <Button variant={editing ? 'default' : 'outline'} onClick={toggleEditing}>
              {editing ? <CheckIcon data-icon="inline-start" /> : <Settings2Icon data-icon="inline-start" />}
              {editing ? t('dashboard.done') : t('dashboard.customize')}
            </Button>
          </>
        }
      />

      {items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutDashboardIcon />
            </EmptyMedia>
            <EmptyTitle>{t('dashboard.noWidgets')}</EmptyTitle>
            <EmptyDescription>{t('dashboard.noWidgetsHint')}</EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => { setEditing(true); setLibraryOpen(true) }}>
            <PlusIcon data-icon="inline-start" />
            {t('dashboard.addWidget')}
          </Button>
        </Empty>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {items.map((w, index) => {
            const def = widgetById[w.id]
            const title = td(`w.${w.id}`, w.id)
            return (
              <div
                key={w.id}
                draggable={editing}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => {
                  if (editing && dragIndex !== null) {
                    e.preventDefault()
                    setOverIndex(index)
                  }
                }}
                onDragEnd={finishDrag}
                className={cn(
                  'relative min-w-0 rounded-xl transition-shadow',
                  spanClass[w.size],
                  editing && 'cursor-grab outline-2 outline-dashed outline-border active:cursor-grabbing',
                  dragIndex === index && 'opacity-40',
                  overIndex === index && dragIndex !== index && 'outline-primary',
                )}
              >
                {editing && (
                  <div className="absolute inset-x-2 top-2 z-10 flex items-center justify-between rounded-lg border bg-popover/95 p-1 shadow-sm backdrop-blur">
                    <span className="flex items-center gap-1 ps-1 text-xs text-muted-foreground">
                      <GripVerticalIcon className="size-4" aria-hidden />
                      <span className="max-w-32 truncate">{title}</span>
                    </span>
                    <span className="flex items-center">
                      <Button variant="ghost" size="icon-xs" aria-label="Move earlier" disabled={index === 0} onClick={() => setLayout(move(items, index, index - 1))}>
                        <ArrowUpIcon />
                      </Button>
                      <Button variant="ghost" size="icon-xs" aria-label="Move later" disabled={index === items.length - 1} onClick={() => setLayout(move(items, index, index + 1))}>
                        <ArrowDownIcon />
                      </Button>
                      <Button variant="ghost" size="icon-xs" aria-label="Change size" onClick={() => cycleSize(index)}>
                        <Maximize2Icon />
                      </Button>
                      <Button variant="ghost" size="icon-xs" aria-label={`Remove ${title}`} onClick={() => setLayout(items.filter((_, i) => i !== index))}>
                        <XIcon />
                      </Button>
                    </span>
                  </div>
                )}
                <div className={cn('h-full', editing && 'pointer-events-none select-none pt-12')}>
                  <def.Component data={data} title={title} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('dashboard.widgetLibrary')}</SheetTitle>
            <SheetDescription>{t('dashboard.widgetLibraryHint')}</SheetDescription>
          </SheetHeader>
          <ul className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
            {available.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Every widget is already on your dashboard.</li>}
            {available.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <w.icon className="size-4" aria-hidden />
                  </span>
                  <span className="truncate text-sm font-medium">{td(`w.${w.id}`, w.id)}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => addWidget(w.id)}>
                  <PlusIcon data-icon="inline-start" />
                  {t('common.add')}
                </Button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  )
}
