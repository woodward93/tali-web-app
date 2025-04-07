import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { Transaction } from '../types';
import { formatCurrency } from './format';
import { format } from 'date-fns';

export async function generatePDF(
  elementId: string,
  transaction: Transaction,
  businessName: string,
  documentType: 'receipt' | 'invoice'
): Promise<Blob> {
  // Ensure we're running in a browser environment
  if (typeof window === 'undefined' || !window.document) {
    throw new Error('PDF generation is only available in browser environments');
  }

  // Get the element
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element with id ${elementId} not found`);

  try {
    // Wait for any pending renders to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create canvas with corrected options
    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for better quality
      useCORS: true, // Enable loading cross-origin images
      logging: false, // Disable logging
      allowTaint: true, // Allow tainted canvas
      backgroundColor: '#ffffff' // Ensure white background
    });

    // Create PDF with A4 dimensions
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Calculate dimensions to fit the content
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Add the canvas as an image
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 1.0),
      'JPEG',
      0,
      0,
      imgWidth,
      imgHeight
    );

    // Return as blob
    return pdf.output('blob');
  } catch (err) {
    console.error('Error generating PDF:', err);
    throw new Error('Failed to generate PDF');
  }
}