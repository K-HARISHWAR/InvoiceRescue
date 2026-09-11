import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { Button } from '@/components/ui/button';
import { type ExtractedInvoiceData, type DocumentDetails } from '../types';

export type BatchExtractionResult = {
  data: ExtractedInvoiceData | null;
  documentDetails?: DocumentDetails;
  ai_run_id?: string;
};

interface InvoiceUploadProps {
  invoiceId?: string;
  onUploadSuccess?: () => void;
  onExtractionComplete?: (results: BatchExtractionResult[]) => void;
}

type UploadTask = {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'extracting' | 'success' | 'error';
  error?: string;
  data?: ExtractedInvoiceData | null;
  documentDetails?: DocumentDetails;
  ai_run_id?: string;
};

export default function InvoiceUpload({ invoiceId, onUploadSuccess, onExtractionComplete }: InvoiceUploadProps) {
  const { business, user } = useSession();
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const newTasks = acceptedFiles.map(f => ({
        id: crypto.randomUUID(),
        file: f,
        status: 'pending' as const
      }));
      setTasks(prev => [...prev, ...newTasks]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxFiles: 20,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const updateTask = (id: string, updates: Partial<UploadTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const processQueue = async () => {
    if (!business || !user || isProcessingQueue) return;
    setIsProcessingQueue(true);

    const pendingTasks = tasks.filter(t => t.status === 'pending');
    
    for (const task of pendingTasks) {
      try {
        updateTask(task.id, { status: 'uploading' });
        let targetInvoiceId = invoiceId;

        // 1. Upload to Storage
        const folderId = targetInvoiceId || `temp-${task.id}`;
        const filePath = `${business.id}/${folderId}/${task.id}-${task.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        const { error: uploadError } = await supabase.storage
          .from('invoice-documents')
          .upload(filePath, task.file);

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        // 2. Hash calculation
        const buffer = await task.file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        const documentDetails = {
          storage_path: filePath,
          original_file_name: task.file.name,
          mime_type: task.file.type,
          size_bytes: task.file.size,
          sha256: hashHex,
        };

        // 3. Link if we have invoice ID
        if (targetInvoiceId) {
          const { error: docError } = await supabase
            .from('invoice_documents')
            .insert([{
              business_id: business.id,
              invoice_id: targetInvoiceId,
              document_type: 'invoice',
              uploaded_by: user.id,
              ...documentDetails
            }]);
          if (docError) throw new Error(`Failed to link: ${docError.message}`);
        }

        // 4. Extraction
        if (onExtractionComplete && !targetInvoiceId) {
          updateTask(task.id, { status: 'extracting', documentDetails });
          
          const { data: parseResponse, error: parseError } = await supabase.functions.invoke('parse-invoice', {
            body: { storage_path: filePath, mime_type: task.file.type, business_id: business.id, user_id: user?.id }
          });
          
          if (parseError) throw parseError;
          if (!parseResponse?.success) throw new Error(parseResponse?.error?.message || 'Parsing failed');

          console.log("PARSE RESPONSE:", parseResponse);
          console.log("AI RUN ID:", parseResponse.ai_run_id);

          updateTask(task.id, { status: 'success', data: parseResponse.data, ai_run_id: parseResponse.ai_run_id });
          
          // If this is a single file upload, call immediately
          if (tasks.length === 1 && onExtractionComplete) {
            onExtractionComplete([{
              data: parseResponse.data,
              documentDetails,
              ai_run_id: parseResponse.ai_run_id
            }]);
          }
        } else {
          updateTask(task.id, { status: 'success', documentDetails });
        }

      } catch (err: any) {
        updateTask(task.id, { status: 'error', error: err.message });
      }
    }
    
    setIsProcessingQueue(false);
    
    // If all tasks are done and success
    const allFinished = tasks.every(t => t.status === 'success' || t.status === 'error');
    if (onUploadSuccess && allFinished) {
      onUploadSuccess();
    }
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const confirmBatch = () => {
    const successfulTasks = tasks.filter(t => t.status === 'success' && t.data);
    if (successfulTasks.length > 0 && onExtractionComplete) {
      const batchItems = successfulTasks.map(t => ({
        data: t.data || null,
        documentDetails: t.documentDetails,
        ai_run_id: t.ai_run_id
      }));
      onExtractionComplete(batchItems);
      // Remove all successful tasks from the list
      successfulTasks.forEach(t => removeTask(t.id));
    }
  };

  return (
    <div className="w-full space-y-4">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-neutral-300 hover:border-blue-400 hover:bg-neutral-50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <UploadCloud className="h-6 w-6 text-blue-600" />
        </div>
        <p className="text-sm font-medium text-neutral-900 mb-1">
          Click to upload or drag and drop (up to 20 files)
        </p>
        <p className="text-xs text-neutral-500 mb-4">
          PDF, PNG, JPG (max 10MB)
        </p>
        <div className="bg-primary/5 p-3 rounded-md text-xs text-primary/80 max-w-sm mx-auto text-left flex items-start space-x-2">
          <div className="mt-0.5 font-bold">ⓘ</div>
          <p><strong>Upload your invoice.</strong> InvoiceRescue will securely extract the details using AI. You will review everything before it is saved.</p>
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="border rounded-lg bg-neutral-50 divide-y overflow-hidden max-h-[300px] overflow-y-auto">
          {tasks.map((task) => (
            <div key={task.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center space-x-3 overflow-hidden">
                <File className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div className="truncate">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {task.file.name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {(task.file.size / 1024 / 1024).toFixed(2)} MB
                    {task.status === 'uploading' && ' • Uploading...'}
                    {task.status === 'extracting' && ' • Extracting...'}
                    {task.status === 'error' && <span className="text-red-500"> • {task.error}</span>}
                    {task.status === 'success' && <span className="text-green-600"> • Ready</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 pl-2">
                {task.status === 'uploading' || task.status === 'extracting' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                ) : task.status === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : task.status === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : null}
                
                {task.status !== 'uploading' && task.status !== 'extracting' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeTask(task.id); }}
                    className="p-1 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tasks.length > 0 && (
        <div className="flex justify-end pt-2">
          {tasks.some(t => t.status === 'pending') ? (
            <Button onClick={processQueue} disabled={isProcessingQueue} className="w-full sm:w-auto">
              {isProcessingQueue ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Queue...</> : 'Process Queue'}
            </Button>
          ) : tasks.some(t => t.status === 'success' && t.data) ? (
            <Button onClick={confirmBatch} className="w-full sm:w-auto">
              Review Parsed Document
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
