import React, { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BankStatementUploadProps {
  businessId: string;
  onSuccess: () => void;
  className?: string;
  showDownloadButton?: boolean;
}

export function BankStatementUpload({ businessId, onSuccess, className }: BankStatementUploadProps) {
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be less than 5MB');
      e.target.value = '';
      return;
    }

    // Get file extension
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    // Validate file type - be more permissive with Excel files
    const isCSV = file.type === 'text/csv' || fileExtension === '.csv';
    const isPDF = file.type === 'application/pdf' || fileExtension === '.pdf';
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                   file.type === 'application/vnd.ms-excel' ||
                   fileExtension === '.xlsx' || 
                   fileExtension === '.xls';
    
    if (!isCSV && !isPDF && !isExcel) {
      toast.error('Please upload a CSV, Excel (.xlsx/.xls), or PDF file');
      e.target.value = '';
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('businessId', businessId);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-bank-statement`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: formData
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      toast.success(data.message);
      onSuccess();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to process bank statement');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <label className={`cursor-pointer ${className || 'w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50'}`}>
      <div className="flex items-center justify-center w-full">
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        <span>{loading ? 'Processing...' : 'Upload Statement'}</span>
      </div>
      <input
        type="file"
        accept=".csv,.xlsx,.xls,.pdf"
        onChange={handleFileUpload}
        disabled={loading}
        className="hidden"
      />
    </label>
  );
}