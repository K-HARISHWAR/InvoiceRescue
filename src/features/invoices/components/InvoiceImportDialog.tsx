import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

type ImportStep = 'upload' | 'map' | 'preview' | 'importing';

const EXPECTED_COLUMNS = [
  { key: 'invoice_number', label: 'Invoice Number', required: true },
  { key: 'customer_name', label: 'Customer Name', required: true },
  { key: 'customer_email', label: 'Customer Email', required: false },
  { key: 'invoice_date', label: 'Issue Date (YYYY-MM-DD)', required: true },
  { key: 'due_date', label: 'Due Date (YYYY-MM-DD)', required: false },
  { key: 'total_amount', label: 'Total Amount', required: true },
  { key: 'outstanding_amount', label: 'Outstanding Amount', required: false },
  { key: 'currency', label: 'Currency (e.g. INR, USD)', required: false },
];

export default function InvoiceImportDialog({ open, onOpenChange, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess: () => void }) {
  const { business } = useSession();
  const [step, setStep] = useState<ImportStep>('upload');
// file state removed
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  
  const [mapping, setMapping] = useState<Record<string, string>>({});
  
  const [validationResults, setValidationResults] = useState<{valid: any[], errors: any[]}>({ valid: [], errors: [] });
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      const f = acceptedFiles[0];
      Papa.parse(f, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.meta.fields) {
            setCsvHeaders(results.meta.fields);
            setCsvData(results.data);
            
            // Auto-map where possible
            const autoMap: Record<string, string> = {};
            EXPECTED_COLUMNS.forEach(col => {
              const match = results.meta.fields?.find(f => f.toLowerCase().includes(col.key.replace('_', '')) || f.toLowerCase().includes(col.label.toLowerCase()));
              if (match) autoMap[col.key] = match;
            });
            setMapping(autoMap);
            setStep('map');
          } else {
            toast.error("Could not read CSV headers");
          }
        },
        error: (error) => toast.error(`Error parsing CSV: ${error.message}`)
      });
    }
  });

  const handleValidation = () => {
    const valid: any[] = [];
    const errors: any[] = [];

    csvData.forEach((row, i) => {
      const parsedRow: any = {};
      let hasError = false;
      let errorMsg = '';

      for (const col of EXPECTED_COLUMNS) {
        const mappedHeader = mapping[col.key];
        const val = mappedHeader ? row[mappedHeader] : undefined;

        if (col.required && !val) {
          hasError = true;
          errorMsg = `Missing required field: ${col.label}`;
          break;
        }

        if (val) {
          if (col.key === 'total_amount' || col.key === 'outstanding_amount') {
            const num = parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
            if (isNaN(num)) {
              hasError = true;
              errorMsg = `Invalid number for ${col.label}: ${val}`;
              break;
            }
            parsedRow[col.key] = num;
          } else if (col.key === 'invoice_date' || col.key === 'due_date') {
            const date = new Date(val);
            if (isNaN(date.getTime())) {
              hasError = true;
              errorMsg = `Invalid date for ${col.label}: ${val}`;
              break;
            }
            parsedRow[col.key] = date.toISOString().split('T')[0];
          } else {
            parsedRow[col.key] = val;
          }
        }
      }

      if (hasError) {
        errors.push({ row: i + 2, error: errorMsg, data: row });
      } else {
        // If outstanding is missing, assume it's equal to total
        if (parsedRow.total_amount && parsedRow.outstanding_amount === undefined) {
          parsedRow.outstanding_amount = parsedRow.total_amount;
        }
        if (!parsedRow.currency) parsedRow.currency = 'INR';
        
        valid.push(parsedRow);
      }
    });

    setValidationResults({ valid, errors });
    setStep('preview');
  };

  const handleImport = async () => {
    if (!business) return;
    setStep('importing');
    
    try {
      // Create customers first if they don't exist, then invoices
      // For a robust implementation, this should ideally be an edge function or RPC to ensure transactional integrity.
      // Doing it in batches via RPC is safest to avoid client timeouts for large lists.
      
      const payload = validationResults.valid.map(v => ({
        ...v,
        business_id: business.id
      }));

      // Call a generic RPC or just loop here if RPC isn't built yet
      // Assuming no RPC for bulk import exists, we will map them manually here for MVP
      // We will resolve customer names to IDs.
      const customerNames = Array.from(new Set(payload.map(p => p.customer_name)));
      
      // Get existing customers
      const { data: existingCustomers } = await supabase
        .from('customers')
        .select('id, name')
        .eq('business_id', business.id)
        .in('name', customerNames);
        
      const customerMap = new Map((existingCustomers || []).map(c => [c.name, c.id]));
      
      // Find missing customers
      const missingNames = customerNames.filter(n => !customerMap.has(n));
      if (missingNames.length > 0) {
        const newCustomers = missingNames.map(name => ({
          business_id: business.id,
          name: name,
          primary_email: payload.find(p => p.customer_name === name)?.customer_email || null
        }));
        const { data: created } = await supabase.from('customers').insert(newCustomers).select();
        created?.forEach(c => customerMap.set(c.name, c.id));
      }

      // Fetch default entity_id
      const { data: entities } = await supabase
        .from('business_entities')
        .select('id')
        .eq('business_id', business.id)
        .limit(1);
      
      const defaultEntityId = entities?.[0]?.id;
      if (!defaultEntityId) {
        throw new Error("No business entity found. Cannot import invoices.");
      }
      
      // Map invoices
      const invoicesToInsert = payload.map(p => ({
        business_id: business.id,
        entity_id: defaultEntityId,
        customer_id: customerMap.get(p.customer_name),
        invoice_number: String(p.invoice_number),
        invoice_date: p.invoice_date,
        due_date: p.due_date,
        currency: p.currency,
        total_amount: p.total_amount,
        outstanding_amount: p.outstanding_amount,
        subtotal: p.total_amount, // Simplified
        tax_amount: 0,
        payment_status: p.outstanding_amount <= 0 ? 'paid' : 'open'
      }));

      // Insert invoices in batches of 100
      const batchSize = 100;
      for (let i = 0; i < invoicesToInsert.length; i += batchSize) {
        const batch = invoicesToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from('invoices').insert(batch);
        if (error) throw error;
      }
      
      toast.success(`Successfully imported ${validationResults.valid.length} invoices`);
      onSuccess();
      onOpenChange(false);
      
    } catch (err: any) {
      toast.error('Import failed: ' + err.message);
      setStep('preview');
    }
  };

  const handleClose = () => {
    setStep('upload');
    setMapping({});
    setCsvHeaders([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Invoices</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import invoices.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-neutral-200 hover:border-primary/50 hover:bg-neutral-50'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
            <p className="text-xs text-muted-foreground mt-1">CSV file only</p>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="text-sm font-medium mb-4">Map your CSV columns to InvoiceRescue fields:</div>
            {EXPECTED_COLUMNS.map(col => (
              <div key={col.key} className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg border">
                <div className="w-1/2">
                  <span className="text-sm font-medium">{col.label}</span>
                  {col.required && <span className="text-red-500 ml-1">*</span>}
                </div>
                <div className="w-1/2">
                  <select 
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={mapping[col.key] || ''}
                    onChange={e => setMapping({...mapping, [col.key]: e.target.value})}
                  >
                    <option value="">-- Ignore / Not present --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            ))}
            <div className="flex justify-end pt-4">
              <Button onClick={handleValidation}>Validate & Preview <ChevronRight className="ml-2 h-4 w-4"/></Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-700">{validationResults.valid.length}</div>
                <div className="text-sm font-medium text-green-600">Valid Rows</div>
              </div>
              <div className={`p-4 border rounded-lg text-center ${validationResults.errors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-neutral-50 border-neutral-200'}`}>
                <AlertCircle className={`h-8 w-8 mx-auto mb-2 ${validationResults.errors.length > 0 ? 'text-red-600' : 'text-neutral-400'}`} />
                <div className={`text-2xl font-bold ${validationResults.errors.length > 0 ? 'text-red-700' : 'text-neutral-700'}`}>{validationResults.errors.length}</div>
                <div className={`text-sm font-medium ${validationResults.errors.length > 0 ? 'text-red-600' : 'text-neutral-600'}`}>Need Correction</div>
              </div>
            </div>

            {validationResults.errors.length > 0 && (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200 max-h-48 overflow-y-auto">
                <h4 className="text-sm font-semibold text-red-800 mb-2">Errors</h4>
                <ul className="text-xs text-red-700 space-y-1">
                  {validationResults.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>Row {e.row}: {e.error}</li>
                  ))}
                  {validationResults.errors.length > 10 && (
                    <li className="font-semibold mt-2">...and {validationResults.errors.length - 10} more errors.</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
              <Button 
                onClick={handleImport} 
                disabled={validationResults.valid.length === 0}
              >
                Import {validationResults.valid.length} Invoices
              </Button>
            </div>
          </div>
        )}
        
        {step === 'importing' && (
          <div className="py-12 text-center space-y-4">
            <UploadCloud className="h-12 w-12 text-primary mx-auto animate-bounce" />
            <h3 className="text-lg font-medium">Importing Data...</h3>
            <p className="text-sm text-muted-foreground">Please do not close this window.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
