import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@batac/ui/lib/utils';
import { Button } from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface ComboboxProps<T> {
  value: string | null;
  onChange: (value: string | null) => void;
  items: T[];
  getItemId: (item: T) => string;
  getItemLabel: (item: T) => string;
  getItemSublabel?: (item: T) => string | undefined;
  onSearchChange: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean | undefined;
}

export function Combobox<T>({
  value,
  onChange,
  items,
  getItemId,
  getItemLabel,
  getItemSublabel,
  onSearchChange,
  isLoading,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found.',
  disabled,
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = React.useCallback(
    (q: string) => {
      setQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearchChange(q);
      }, 300);
    },
    [onSearchChange],
  );

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const selectedLabel = React.useMemo(() => {
    if (!value) return null;
    const item = items.find((i) => getItemId(i) === value);
    return item ? getItemLabel(item) : null;
  }, [value, items, getItemId, getItemLabel]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setQuery('');
          onSearchChange('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedLabel ?? <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={handleQueryChange}
          />
          <CommandList>
            <CommandEmpty>{isLoading ? 'Loading…' : emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => {
                const id = getItemId(item);
                return (
                  <CommandItem
                    key={id}
                    value={id}
                    onSelect={(val) => {
                      onChange(val === value ? null : val);
                      setOpen(false);
                      setQuery('');
                      onSearchChange('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{getItemLabel(item)}</span>
                      {getItemSublabel && getItemSublabel(item) && (
                        <span className="text-muted-foreground text-xs">
                          {getItemSublabel(item)}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
