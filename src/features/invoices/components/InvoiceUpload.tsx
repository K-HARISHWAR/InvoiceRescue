import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { Button } from '@/components/ui/button';

interface InvoiceUploadProps {
  invoiceId?: string; // If provided, attaches to this invoice. If not, creates a draft invoice first.
  onUploadSuccess?: () => void;
}

export default function InvoiceUpload({ invoiceId, onUploadSuccess }: InvoiceUploadProps) {
  const { business, user } = useSession();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const uploadFile = async () => {
    if (!file || !business || !user) return;

    setIsUploading(true);
    try {
      let targetInvoiceId = invoiceId;

      // 1. Create a draft invoice if we don't have one
      if (!targetInvoiceId) {
        const { data: newInvoice, error: invError } = await supabase
          .from('invoices')
          .insert([{
            business_id: business.id,
            invoice_number: `DRAFT-${Date.now()}`,
            invoice_date: new Date().toISOString().split('T')[0],
            currency: business.default_currency,
            subtotal: 0,
            tax_amount: 0,
            total_amount: 0,
            amount_paid: 0,
            outstanding_amount: 0,
            payment_status: 'draft',
            collection_stage: 'monitoring',
            source: 'upload',
            created_by: user.id
          }])
          .select()
          .single();

        if (invError) throw new Error(`Failed to create draft invoice: ${invError.message}`);
        targetInvoiceId = newInvoice.id;
      }

      // 2. Upload to Storage
      // Path convention: {business_id}/{invoice_id}/{uuid}-{filename}
      const fileExt = file.name.split('.').pop();
      const uuid = crypto.randomUUID();
      const filePath = `${business.id}/${targetInvoiceId}/${uuid}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      const { error: uploadError } = await supabase.storage
        .from('invoice-documents')
        .upload(filePath, file);

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // 3. Create invoice_documents record
      // Hash calculation (simplified for MVP, ideally use Web Crypto API)
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { error: docError } = await supabase
        .from('invoice_documents')
        .insert([{
          business_id: business.id,
          invoice_id: targetInvoiceId,
          document_type: 'invoice',
          storage_path: filePath,
          original_file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          sha256: hashHex,
          uploaded_by: user.id
        }]);

      if (docError) throw new Error(`Failed to link document: ${docError.message}`);

      toast.success('Document uploaded successfully');
      setFile(null);
      
      if (onUploadSuccess) {
        onUploadSuccess();
      }

      // If we created a new draft invoice, redirect to it
      if (!invoiceId && targetInvoiceId) {
        navigate(`/app/invoices/${targetInvoiceId}`);
      }

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'An unexpected error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full">
      {!file ? (
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-neutral-300 hover:border-blue-400 hover:bg-neutral-50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <UploadCloud className="h-6 w-6 text-blue-600" />
          </div>
          <p className="text-sm font-medium text-neutral-900 mb-1">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-neutral-500">
            PDF, PNG, JPG (max 10MB)
          </p>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-neutral-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white rounded shadow-sm border border-neutral-200">
                <File className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900 truncate max-w-[200px] sm:max-w-[300px]">
                  {file.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            {!isUploading && (
              <button 
                onClick={() => setFile(null)}
                className="p-1 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          
          <div className="mt-4 flex justify-end">
            <Button onClick={uploadFile} disabled={isUploading} className="w-full sm:w-auto">
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Confirm Upload'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
