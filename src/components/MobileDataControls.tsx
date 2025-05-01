import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MobileDataControlsProps {
  totalItems: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

export function MobileDataControls({
  totalItems,
  page,
  perPage,
  onPageChange,
  onPerPageChange
}: MobileDataControlsProps) {
  const totalPages = Math.ceil(totalItems / perPage);
  const startItem = (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, totalItems);

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-3 sm:hidden">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className="rounded-md border-gray-300 py-1.5 pl-3 pr-8 text-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
          <div className="text-sm text-gray-700">
            {startItem}-{endItem} of {totalItems}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}