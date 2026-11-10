import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
  className?: string
}

export function Pagination({ page, totalPages, onChange, className }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <Button
        variant="outline"
        size="icon"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </Button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
        <Button
          key={p}
          variant={p === page ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => onChange(p)}
          className="min-w-[40px]"
        >
          {p}
        </Button>
      ))}
      <Button
        variant="outline"
        size="icon"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </Button>
    </div>
  )
}

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  emptyMessage?: string
  className?: string
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No data available',
  className,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className={cn('rounded-2xl glass border border-ink/5 p-12 text-center text-sm text-slate-500', className)}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={cn('rounded-2xl glass border border-ink/5 overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/5 bg-surface-3/50">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    'px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr
                key={keyExtractor(row)}
                className="border-b border-ink/[0.03] hover:bg-ink/[0.02] transition-colors"
              >
                {columns.map(col => (
                  <td key={col.key} className={cn('px-5 py-4 text-slate-300', col.className)}>
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
