import React, { useState } from 'react';
import { Upload, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

interface BankStatementUploadProps {
  businessId: string;
  onSuccess: () => void;
  className?: string;
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

    // Validate file type
    if (file.type !== 'text/csv') {
      toast.error('Please upload a CSV file');
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

  const downloadTemplate = () => {
    // Create CSV content with the specified headers
    const csvContent = [
      'Date/Time,Money In,Money Out,To / From,Description',
      '2025-05-24 09:00:00,5000.00,,Employer Name,Salary Payment',
      '2025-05-23 14:30:00,,150.25,Supplier Name,Office Supplies Purchase'
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bank_statement_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <button
        onClick={downloadTemplate}
        className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
      >
        <Download className="h-4 w-4 mr-2" />
        Download Template
      </button>

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
          accept=".csv"
          onChange={handleFileUpload}
          disabled={loading}
          className="hidden"
        />
      </label>
    </div>
  );
}