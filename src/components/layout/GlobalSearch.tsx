import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Building2, Loader2 } from 'lucide-react';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { Input } from '@/components/ui/input';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { data: results, isLoading } = useGlobalSearch(query);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (url: string) => {
    setIsOpen(false);
    setQuery('');
    navigate(url);
  };

  const invoices = results?.filter(r => r.result_type === 'invoice') || [];
  const customers = results?.filter(r => r.result_type === 'customer') || [];

  return (
    <div ref={wrapperRef} className="relative w-full">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground z-10" />
      <Input
        type="search"
        placeholder="Search invoices, customers, POs..."
        className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-4 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />

      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border shadow-lg rounded-md overflow-hidden z-50 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Searching...
            </div>
          ) : results?.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found for "{query}"
            </div>
          ) : (
            <div className="py-2">
              {invoices.length > 0 && (
                <div className="px-3 pb-1 pt-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Invoices</h4>
                  {invoices.map(inv => (
                    <button
                      key={`inv-${inv.id}`}
                      onClick={() => handleSelect(inv.url)}
                      className="w-full flex flex-col text-left px-3 py-2 hover:bg-muted rounded-md transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                        <span className="font-medium text-sm text-foreground">{inv.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground pl-6 truncate">{inv.subtitle}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {customers.length > 0 && (
                <div className="px-3 pb-1 pt-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Customers</h4>
                  {customers.map(cust => (
                    <button
                      key={`cust-${cust.id}`}
                      onClick={() => handleSelect(cust.url)}
                      className="w-full flex flex-col text-left px-3 py-2 hover:bg-muted rounded-md transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-purple-500 shrink-0" />
                        <span className="font-medium text-sm text-foreground">{cust.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground pl-6 truncate">{cust.subtitle}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
