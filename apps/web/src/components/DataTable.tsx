import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react';
import * as React from 'react';

import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@batac/ui';
import { cn } from '@batac/ui/lib/utils';

interface DataTableProps<TData> {
  // TanStack's own `columns` option is typed `ColumnDef<TData, any>[]`, and the
  // column arrays built by `createColumnHelper` carry per-column value types
  // that cannot be unified under `unknown` (see `ColumnDef` in table-core).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  data: TData[];
  enableSorting?: boolean;
  showGlobalFilter?: boolean;
  globalFilterPlaceholder?: string;
  emptyMessage?: string;
  onSortingChange?: (sorting: SortingState) => void;
  onGlobalFilterChange?: (value: string) => void;
}

export function DataTable<TData>({
  columns,
  data,
  enableSorting = true,
  showGlobalFilter = true,
  globalFilterPlaceholder = 'Search all columns…',
  emptyMessage = 'No results.',
  onSortingChange,
  onGlobalFilterChange,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    enableSorting,
    getCoreRowModel: getCoreRowModel(),
    ...(enableSorting ? { getSortedRowModel: getSortedRowModel() } : {}),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Notify the owner when the user changes the sort or the global filter so it
  // can reset cursor-based pagination back to the first page. Callbacks are
  // held in refs so identity changes on every parent render do not re-fire the
  // effect.
  const onSortingChangeRef = React.useRef(onSortingChange);
  const onGlobalFilterChangeRef = React.useRef(onGlobalFilterChange);
  React.useEffect(() => {
    onSortingChangeRef.current = onSortingChange;
    onGlobalFilterChangeRef.current = onGlobalFilterChange;
  });

  const prevSorting = React.useRef(sorting);
  const prevGlobalFilter = React.useRef(globalFilter);
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (prevSorting.current !== sorting) {
      prevSorting.current = sorting;
      onSortingChangeRef.current?.(sorting);
    }
    if (prevGlobalFilter.current !== globalFilter) {
      prevGlobalFilter.current = globalFilter;
      onGlobalFilterChangeRef.current?.(globalFilter);
    }
  }, [sorting, globalFilter]);

  return (
    <div className="space-y-4">
      {showGlobalFilter && (
        <div className="relative max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={globalFilterPlaceholder}
            aria-label="Filter table rows"
            className="h-9 pr-9 pl-9"
          />
          {globalFilter !== '' && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setGlobalFilter('')}
              aria-label="Clear filter"
              className="absolute top-0.5 right-0.5"
            >
              <X />
            </Button>
          )}
        </div>
      )}

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = enableSorting && header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={
                        canSort
                          ? header.column.getIsSorted() === 'asc'
                            ? 'ascending'
                            : header.column.getIsSorted() === 'desc'
                              ? 'descending'
                              : 'none'
                          : undefined
                      }
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'hover:text-text-primary flex items-center gap-1 font-medium select-none',
                            header.column.getIsSorted() !== false && 'text-text-primary',
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="text-muted-foreground h-3.5 w-3.5 opacity-60" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
