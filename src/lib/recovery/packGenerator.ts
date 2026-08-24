import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { type TimelineEvent } from '@/hooks/useRecoveryPack';

export async function generateRecoveryZip(
  invoiceData: any, 
  timelineEvents: TimelineEvent[], 
  aiSummary: string,
  documents: {name: string, blob: Blob}[]
) {
  const zip = new JSZip();

  // 1. Create Recovery-Summary.pdf
  const summaryPdf = new jsPDF();
  
  // Header background
  summaryPdf.setFillColor(23, 37, 84); // blue-950
  summaryPdf.rect(0, 0, 210, 30, 'F');
  
  // Title
  summaryPdf.setTextColor(255, 255, 255);
  summaryPdf.setFont("helvetica", "bold");
  summaryPdf.setFontSize(22);
  summaryPdf.text('Recovery Evidence Pack', 20, 20);
  
  // Reset text color for body
  summaryPdf.setTextColor(30, 41, 59); // slate-800
  
  // Invoice Details Section
  summaryPdf.setFontSize(14);
  summaryPdf.setFont("helvetica", "bold");
  let y = 45;
  summaryPdf.text('Account Details', 20, y);
  
  // Separator
  summaryPdf.setDrawColor(203, 213, 225); // slate-300
  summaryPdf.setLineWidth(0.5);
  summaryPdf.line(20, y + 3, 190, y + 3);
  y += 12;

  summaryPdf.setFontSize(10);
  const formatMoney = (val: number) => {
    return `${invoiceData.currency || 'INR'} ${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const drawRow = (label: string, value: string, yPos: number) => {
    summaryPdf.setFont("helvetica", "bold");
    summaryPdf.text(label, 20, yPos);
    summaryPdf.setFont("helvetica", "normal");
    summaryPdf.text(value, 60, yPos);
  };

  drawRow('Creditor:', invoiceData.businesses?.legal_name || invoiceData.businesses?.name || 'N/A', y); y += 8;
  drawRow('Debtor:', invoiceData.customers?.company_name || invoiceData.customers?.name || 'N/A', y); y += 8;
  drawRow('Invoice Number:', invoiceData.invoice_number, y); y += 8;
  drawRow('Invoice Date:', new Date(invoiceData.invoice_date).toLocaleDateString(), y); y += 8;
  drawRow('Outstanding:', `${formatMoney(invoiceData.outstanding_amount)} (Original: ${formatMoney(invoiceData.total_amount)})`, y); y += 16;

  // AI Summary Section
  summaryPdf.setFontSize(14);
  summaryPdf.setFont("helvetica", "bold");
  summaryPdf.text('Executive Summary', 20, y);
  summaryPdf.line(20, y + 3, 190, y + 3);
  y += 12;
  
  summaryPdf.setFontSize(10);
  summaryPdf.setFont("helvetica", "normal");
  
  // Split text to fit width
  const splitSummary = summaryPdf.splitTextToSize(aiSummary, 170);
  summaryPdf.text(splitSummary, 20, y);
  y += (splitSummary.length * 5) + 16;

  if (y > 250) {
      summaryPdf.addPage();
      y = 30;
  }

  // Evidence Manifest Section
  summaryPdf.setFontSize(14);
  summaryPdf.setFont("helvetica", "bold");
  summaryPdf.text('Verified Timeline of Events', 20, y);
  summaryPdf.line(20, y + 3, 190, y + 3);
  y += 12;
  
  timelineEvents.forEach((event, idx) => {
    if (y > 270) {
      summaryPdf.addPage();
      y = 30;
    }
    const dateStr = new Date(event.event_date).toLocaleDateString();
    
    // Timeline dot & line
    summaryPdf.setDrawColor(59, 130, 246); // blue-500
    summaryPdf.setFillColor(59, 130, 246);
    summaryPdf.circle(23, y - 1, 1.5, 'F');
    
    summaryPdf.setFont("helvetica", "bold");
    summaryPdf.setFontSize(10);
    summaryPdf.text(`[${dateStr}] ${event.title}`, 28, y);
    y += 5;

    if (event.description) {
        summaryPdf.setFont("helvetica", "italic");
        summaryPdf.setTextColor(71, 85, 105); // slate-600
        const splitDesc = summaryPdf.splitTextToSize(event.description, 160);
        summaryPdf.text(splitDesc, 28, y);
        y += (splitDesc.length * 5) + 4;
        summaryPdf.setTextColor(30, 41, 59); // reset color
    } else {
        y += 4;
    }
  });

  const pdfBlob = summaryPdf.output('blob');
  zip.file('Recovery-Summary.pdf', pdfBlob);

  // 2. Add raw timeline data (manifest.json)
  const manifestData = {
      invoice: {
          id: invoiceData.id,
          number: invoiceData.invoice_number,
          customer: invoiceData.customers?.name
      },
      summary: aiSummary,
      timeline: timelineEvents
  };
  zip.file('manifest.json', JSON.stringify(manifestData, null, 2));

  // 3. Add supporting documents
  if (documents.length > 0) {
      const docsFolder = zip.folder('Supporting-Documents');
      if (docsFolder) {
          documents.forEach(doc => {
              docsFolder.file(doc.name, doc.blob);
          });
      }
  }

  // 4. Generate ZIP and trigger download
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `InvoiceRescue-Recovery-${invoiceData.invoice_number}.zip`);
}
