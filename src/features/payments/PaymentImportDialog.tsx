import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, AlertTriangle, X, ChevronRight, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { invoiceKeys } from '@/lib/queryKeys';

type ImportStep = 'upload' | 'map' | 'preview' | 'importing';

const EXPECTED_COLUMNS = [
  { key: 'invoice_number', label: 'Invoice Number', required: true },
  { key: 'amount', label: 'Payment Amount', required: true },
  { key: 'payment_date', label: 'Payment Date (YYYY-MM-DD)', required: true },
  { key: 'reference', label: 'Reference / UTR', required: false },
];

type PreviewRow = {
  raw: any;
  parsed: any;
  invoice_id: string | null;
  matchStatus: 'Matched' | 'Possible Match' | 'No Match' | 'Duplicate';
  matchReason?: string;
  duplicate_of?: string;
};

export default function PaymentImportDialog({ open, onOpenChange, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess: () => void }) {
  const { business } = useSession();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  
  const [mapping, setMapping] = useState<Record<string, string>>({});
  
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('upload');
        setCsvHeaders([]);
        setCsvData([]);
        setMapping({});
        setPreviewData([]);
        setIsProcessing(false);
      }, 300);
    }
  }, [open]);

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
              const match = results.meta.fields?.find(f => f.toLowerCase().includes(col.key.replace('_', '')) || f.toLowerCase().includes(col.label.toLowerCase().split(' ')[0]));
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

  const handleValidationAndMatching = async () => {
    if (!business) return;
    setIsProcessing(true);
    
    try {
      const parsedRows: any[] = [];
      const validationErrors: string[] = [];

      csvData.forEach((row, i) => {
        const parsedRow: any = {};
        let hasError = false;

        for (const col of EXPECTED_COLUMNS) {
          const mappedHeader = mapping[col.key];
          const val = mappedHeader ? row[mappedHeader] : undefined;

          if (col.required && !val) {
            validationErrors.push(`Row ${i + 2}: Missing ${col.label}`);
            hasError = true;
            break;
          }

          if (val) {
            if (col.key === 'amount') {
              const num = parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
              if (isNaN(num) || num <= 0) {
                validationErrors.push(`Row ${i + 2}: Invalid amount ${val}`);
                hasError = true;
                break;
              }
              parsedRow[col.key] = num;
            } else if (col.key === 'payment_date') {
              const date = new Date(val);
              if (isNaN(date.getTime())) {
                validationErrors.push(`Row ${i + 2}: Invalid date ${val}`);
                hasError = true;
                break;
              }
              parsedRow[col.key] = date.toISOString().split('T')[0];
            } else {
              parsedRow[col.key] = String(val).trim();
            }
          }
        }

        if (!hasError) {
          parsedRows.push(parsedRow);
        }
      });

      if (validationErrors.length > 0) {
        toast.error(`Found ${validationErrors.length} errors. First: ${validationErrors[0]}`);
        setIsProcessing(false);
        return;
      }

      // Step 2: Fetch invoices to match
      const invoiceNumbers = Array.from(new Set(parsedRows.map(r => r.invoice_number)));
      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, outstanding_amount, total_amount')
        .eq('business_id', business.id)
        .in('invoice_number', invoiceNumbers);
        
      const invoiceMap = new Map((existingInvoices || []).map(i => [i.invoice_number, i]));

      // Step 3: Fetch existing payments to detect duplicates
      const { data: existingPayments } = await supabase
        .from('payments')
        .select('id, invoice_id, amount, paid_at, payment_reference')
        .eq('business_id', business.id);

      // Analyze matches
      const preview: PreviewRow[] = parsedRows.map(row => {
        const invoice = invoiceMap.get(row.invoice_number);
        
        if (!invoice) {
          return { raw: row, parsed: row, invoice_id: null, matchStatus: 'No Match', matchReason: 'Invoice not found' };
        }

        // Check for duplicate
        const isDuplicate = existingPayments?.find(p => 
          p.invoice_id === invoice.id && 
          p.amount === row.amount && 
          p.paid_at.startsWith(row.payment_date) &&
          (!row.reference || p.payment_reference === row.reference)
        );

        if (isDuplicate) {
          return { raw: row, parsed: row, invoice_id: invoice.id, matchStatus: 'Duplicate', duplicate_of: isDuplicate.id, matchReason: 'Payment already recorded' };
        }

        // Check overpayment
        if (row.amount > invoice.outstanding_amount) {
          return { raw: row, parsed: row, invoice_id: invoice.id, matchStatus: 'Possible Match', matchReason: `Overpayment: Exceeds outstanding \u20B9${invoice.outstanding_amount}` };
        }

        return { raw: row, parsed: row, invoice_id: invoice.id, matchStatus: 'Matched' };
      });

      setPreviewData(preview);
      setStep('preview');
    } catch (err) {
      console.error(err);
      toast.error('Failed to validate and match payments');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!business) return;
    setStep('importing');
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      // Filter out 'No Match' and 'Duplicate' automatically, unless we want to allow forced duplicates? 
      // The requirement says "User confirms ambiguous matches". We'll just import Matched and Possible Match.
      const toImport = previewData.filter(r => r.matchStatus === 'Matched' || r.matchStatus === 'Possible Match');

      if (toImport.length === 0) {
        toast.error("No valid payments to import.");
        setStep('preview');
        return;
      }

      // We need to insert payments and then recalculate the outstanding amount for each affected invoice.
      const paymentsToInsert = toImport.map(row => ({
        business_id: business.id,
        invoice_id: row.invoice_id,
        amount: row.parsed.amount,
        paid_at: row.parsed.payment_date,
        payment_reference: row.parsed.reference || null,
        reconciliation_status: 'unmatched', // default for CSV imports
        recorded_by: user?.id,
        notes: 'Imported via CSV'
      }));

      const { error } = await supabase.from('payments').insert(paymentsToInsert);

      if (error) throw error;

      // Recalculate invoice states
      const uniqueInvoiceIds = Array.from(new Set(toImport.map(r => r.invoice_id)));
      
      for (const invId of uniqueInvoiceIds) {
        await supabase.rpc('calculate_payment_state', { target_invoice_id: invId });
      }

      toast.success(`Successfully imported ${toImport.length} payments.`);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(business.id) });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
      setStep('preview');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Payments</DialogTitle>
          <DialogDescription>
            Upload a CSV file containing payment records to reconcile against your invoices.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {step === 'upload' && (
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-neutral-300 hover:border-blue-400 hover:bg-neutral-50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <UploadCloud size={24} />
              </div>
              <p className="text-sm font-medium text-neutral-900 mb-1">
                {isDragActive ? 'Drop the CSV here' : 'Drag & drop a CSV file here'}
              </p>
              <p className="text-xs text-neutral-500">
                or click to browse from your computer
              </p>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">Map the columns from your CSV to the required fields.</p>
              </div>

              <div className="space-y-4">
                {EXPECTED_COLUMNS.map(col => (
                  <div key={col.key} className="flex items-center gap-4">
                    <div className="w-1/3">
                      <Label className="text-sm font-medium">
                        {col.label} {col.required && <span className="text-red-500">*</span>}
                      </Label>
                    </div>
                    <div className="w-2/3">
                      <select 
                        className="w-full rounded-md border border-neutral-300 p-2 text-sm"
                        value={mapping[col.key] || ''}
                        onChange={(e) => setMapping({...mapping, [col.key]: e.target.value})}
                      >
                        <option value="">-- Ignore this field --</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex gap-4 mb-6">
                <div className="flex-1 bg-white border border-neutral-200 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold text-green-600">{previewData.filter(r => r.matchStatus === 'Matched').length}</span>
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider mt-1">Matched</span>
                </div>
                <div className="flex-1 bg-white border border-neutral-200 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold text-yellow-600">{previewData.filter(r => r.matchStatus === 'Possible Match').length}</span>
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider mt-1">Ambiguous</span>
                </div>
                <div className="flex-1 bg-white border border-neutral-200 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold text-red-600">{previewData.filter(r => r.matchStatus === 'Duplicate' || r.matchStatus === 'No Match').length}</span>
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider mt-1">Ignored</span>
                </div>
              </div>

              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-neutral-50 sticky top-0 border-b border-neutral-200 shadow-sm z-10">
                      <tr>
                        <th className="px-4 py-3 font-medium text-neutral-900">Status</th>
                        <th className="px-4 py-3 font-medium text-neutral-900">Invoice</th>
                        <th className="px-4 py-3 font-medium text-neutral-900">Amount</th>
                        <th className="px-4 py-3 font-medium text-neutral-900">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {previewData.map((row, i) => (
                        <tr key={i} className="hover:bg-neutral-50">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                              row.matchStatus === 'Matched' ? 'bg-green-50 text-green-700' :
                              row.matchStatus === 'Possible Match' ? 'bg-yellow-50 text-yellow-700' :
                              'bg-red-50 text-red-700'
                            }`}>
                              {row.matchStatus === 'Matched' && <CheckCircle2 size={14} />}
                              {row.matchStatus === 'Possible Match' && <AlertTriangle size={14} />}
                              {(row.matchStatus === 'Duplicate' || row.matchStatus === 'No Match') && <X size={14} />}
                              {row.matchStatus}
                            </span>
                            {row.matchReason && <div className="text-xs text-neutral-500 mt-1 max-w-[150px]">{row.matchReason}</div>}
                          </td>
                          <td className="px-4 py-3 font-medium">{row.parsed.invoice_number}</td>
                          <td className="px-4 py-3 font-medium">{row.parsed.amount}</td>
                          <td className="px-4 py-3 text-neutral-600">{row.parsed.payment_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-neutral-500 text-center">Only "Matched" and "Ambiguous" payments will be imported.</p>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-neutral-900 mb-1">Importing Payments...</h3>
              <p className="text-sm text-neutral-500">This may take a moment. Please don't close this window.</p>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-neutral-200 flex justify-between mt-auto">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          
          {step === 'map' && (
            <Button onClick={handleValidationAndMatching} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Next: Preview Matches'} <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {step === 'preview' && (
            <Button onClick={handleImport}>
              <Check className="mr-2 h-4 w-4" /> Confirm Import
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
