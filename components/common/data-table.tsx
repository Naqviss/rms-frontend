'use client'

import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Cell,
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns3Icon,
  DownloadIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { OptionSelect } from '@/components/common/option-select'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { downloadCsv, type CsvRow } from '@/lib/utils/csv'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface DataTableProps<T extends { id: string }> {
  columns: ColumnDef<T, unknown>[]
  data: T[] | undefined
  isLoading?: boolean
  /** Filter controls rendered next to the search box. */
  filters?: React.ReactNode
  /** Page-level actions rendered at the end of the toolbar. */
  toolbarActions?: React.ReactNode
  exportName?: string
  exportRows?: (rows: T[]) => CsvRow[]
  onBulkDelete?: (rows: T[]) => void | Promise<void>
  onRowClick?: (row: T) => void
  defaultPageSize?: number
  emptyTitle?: string
  emptyDescription?: string
  initialSort?: SortingState
  initialHidden?: VisibilityState
  /** Column shown as the card heading on small screens. Defaults to the first data column. */
  cardTitle?: string
  /** Small column (icon, rank...) shown before the card heading on small screens. */
  cardLead?: string
}

const PAGE_SIZES = ['10', '25', '50']

const renderCell = <T,>(cell: Cell<T, unknown>) => flexRender(cell.column.columnDef.cell, cell.getContext())

export function DataTable<T extends { id: string }>({
  columns,
  data,
  isLoading,
  filters,
  toolbarActions,
  exportName,
  exportRows,
  onBulkDelete,
  onRowClick,
  defaultPageSize = 10,
  emptyTitle,
  emptyDescription,
  initialSort = [],
  initialHidden = {},
  cardTitle,
  cardLead,
}: DataTableProps<T>) {
  const { t } = useT()
  const [sorting, setSorting] = useState<SortingState>(initialSort)
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [visibility, setVisibility] = useState<VisibilityState>(initialHidden)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!onBulkDelete) return columns
    const select: ColumnDef<T, unknown> = {
      id: 'select',
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all rows"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select row"
        />
      ),
    }
    return [select, ...columns]
  }, [columns, onBulkDelete])

  const table = useReactTable({
    data: data ?? [],
    columns: allColumns,
    getRowId: (r) => r.id,
    state: { sorting, globalFilter, rowSelection, columnVisibility: visibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setVisibility,
    globalFilterFn: (row, _id, value: string) =>
      Object.values(row.original as Record<string, unknown>).some((v) =>
        typeof v === 'string' || typeof v === 'number' ? String(v).toLowerCase().includes(value.toLowerCase()) : false,
      ),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: defaultPageSize } },
  })

  const selected = table.getSelectedRowModel().rows.map((r) => r.original)
  const filteredCount = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.getState().pagination
  const from = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min(filteredCount, (pageIndex + 1) * pageSize)

  const handleExport = (excel: boolean) => {
    const rows = table.getFilteredRowModel().rows.map((r) => r.original)
    const mapped = exportRows
      ? exportRows(rows)
      : rows.map((r) =>
          Object.fromEntries(
            Object.entries(r).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v)),
          ) as CsvRow,
        )
    downloadCsv(exportName ?? 'export', mapped, excel)
    toast.success(`${mapped.length} rows exported`)
  }

  // Small screens have no clickable headers, so sorting gets its own control.
  const sortOptions = table
    .getAllLeafColumns()
    .filter((c) => c.getCanSort() && c.getIsVisible() && typeof c.columnDef.header === 'string')
    .map((c) => ({ value: c.id, label: `${t('common.sortBy')}: ${c.columnDef.header as string}` }))
  const activeSort = sorting[0]

  const emptyState = (
    <Empty className="border-0 py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchIcon />
        </EmptyMedia>
        <EmptyTitle>{emptyTitle ?? (globalFilter ? t('common.noResults') : t('common.noData'))}</EmptyTitle>
        <EmptyDescription>{emptyDescription ?? t('common.noResultsHint')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )

  /** One row as a card: heading with its actions, then every other visible column as a labelled field. */
  const renderCard = (row: Row<T>) => {
    const cells = row.getVisibleCells()
    const pick = (id?: string) => (id ? cells.find((c) => c.column.id === id) : undefined)
    const fixed = ['select', 'actions', cardLead]
    const titleId = cardTitle ?? cells.find((c) => !fixed.includes(c.column.id))?.column.id
    const select = pick('select')
    const actions = pick('actions')
    const lead = pick(cardLead)
    const title = pick(titleId)
    const fields = cells.filter((c) => !fixed.includes(c.column.id) && c.column.id !== titleId)
    return (
      <li
        key={row.id}
        data-state={row.getIsSelected() ? 'selected' : undefined}
        tabIndex={onRowClick ? 0 : undefined}
        onClick={() => onRowClick?.(row.original)}
        onKeyDown={(e) => {
          if (onRowClick && e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row.original)
        }}
        className={cn(
          'rounded-xl border bg-card p-3.5 text-sm shadow-xs transition-colors data-[state=selected]:border-primary/50 data-[state=selected]:bg-primary/5',
          onRowClick && 'cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/50',
        )}
      >
        <div className="flex items-start gap-3">
          {select && <div className="flex h-5 items-center">{renderCell(select)}</div>}
          {lead && <div className="shrink-0">{renderCell(lead)}</div>}
          <div className="min-w-0 flex-1">{title && renderCell(title)}</div>
          {actions && <div className="-me-1.5 -mt-1 shrink-0">{renderCell(actions)}</div>}
        </div>
        {fields.length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3">
            {fields.map((c) => {
              const label = typeof c.column.columnDef.header === 'string' ? c.column.columnDef.header : null
              return (
                <div key={c.id} className={cn('min-w-0', !label && 'col-span-2')}>
                  {label && <dt className="truncate text-[11px] font-medium text-muted-foreground">{label}</dt>}
                  <dd className="mt-0.5 min-w-0 break-words">{renderCell(c)}</dd>
                </div>
              )
            })}
          </dl>
        )}
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-9 w-full sm:w-64">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={t('common.searchPlaceholder')}
            aria-label={t('common.search')}
          />
          {globalFilter && (
            <InputGroupAddon align="inline-end">
              <button
                type="button"
                onClick={() => setGlobalFilter('')}
                aria-label={t('common.clear')}
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            </InputGroupAddon>
          )}
        </InputGroup>
        {filters}
        {sortOptions.length > 0 && (
          <div className="flex items-center gap-1 md:hidden">
            <OptionSelect
              className="h-8 w-44"
              value={activeSort?.id ?? 'none'}
              onValueChange={(v) => setSorting(v === 'none' ? [] : [{ id: v, desc: activeSort?.desc ?? true }])}
              options={[{ value: 'none', label: `${t('common.sortBy')}: ${t('common.noSort')}` }, ...sortOptions]}
              aria-label={t('common.sortBy')}
            />
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!activeSort}
              onClick={() => activeSort && setSorting([{ ...activeSort, desc: !activeSort.desc }])}
              aria-label={t('common.toggleSortDirection')}
            >
              {activeSort?.desc === false ? <ArrowUpIcon /> : <ArrowDownIcon />}
            </Button>
          </div>
        )}
        <div className="ms-auto flex items-center gap-2">
          {selected.length > 0 && onBulkDelete && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              <Trash2Icon data-icon="inline-start" />
              {t('common.delete')} ({selected.length})
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Columns3Icon data-icon="inline-start" />
              <span className="hidden sm:inline">{t('common.columns')}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t('common.columns')}</DropdownMenuLabel>
                {table
                  .getAllColumns()
                  .filter((c) => c.getCanHide())
                  .map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={c.getIsVisible()}
                      onCheckedChange={(v) => c.toggleVisibility(!!v)}
                      className="capitalize"
                    >
                      {typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {exportName && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                <DownloadIcon data-icon="inline-start" />
                <span className="hidden sm:inline">{t('common.export')}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport(false)}>{t('common.exportCsv')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport(true)}>{t('common.exportExcel')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {toolbarActions}
        </div>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {onBulkDelete && !isLoading && table.getRowModel().rows.length > 0 && (
          <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
              onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            />
            {t('common.selectAll')}
          </label>
        )}
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : table.getRowModel().rows.length === 0 ? (
          <div className="rounded-xl border bg-card">{emptyState}</div>
        ) : (
          <ul className="flex flex-col gap-2">{table.getRowModel().rows.map(renderCard)}</ul>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => {
                  const sortable = h.column.getCanSort()
                  const dir = h.column.getIsSorted()
                  return (
                    <TableHead
                      key={h.id}
                      className={cn('whitespace-nowrap', h.column.id === 'select' && 'w-10')}
                      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                    >
                      {h.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          className="-ms-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {dir === 'asc' ? (
                            <ArrowUpIcon className="size-3.5" />
                          ) : dir === 'desc' ? (
                            <ArrowDownIcon className="size-3.5" />
                          ) : (
                            <ArrowUpDownIcon className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {allColumns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={allColumns.length}>{emptyState}</TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className={cn(onRowClick && 'cursor-pointer')}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{renderCell(cell)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p className="tabular-nums">
          {from}–{to} / {filteredCount}
        </p>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-xs">{t('common.rowsPerPage')}</span>
            <OptionSelect
              className="h-8 w-[72px]"
              value={String(pageSize)}
              onValueChange={(v) => table.setPageSize(Number(v))}
              options={PAGE_SIZES.map((p) => ({ value: p, label: p }))}
              aria-label={t('common.rowsPerPage')}
            />
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label={t('common.previous')}
            >
              <ChevronLeftIcon className="rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label={t('common.next')}
            >
              <ChevronRightIcon className="rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`${t('common.delete')} ${selected.length}?`}
        description="This action cannot be undone."
        confirmLabel={t('common.delete')}
        onConfirm={async () => {
          await onBulkDelete?.(selected)
          setRowSelection({})
        }}
      />
    </div>
  )
}
