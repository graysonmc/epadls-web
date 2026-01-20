/**
 * TicketService - Generate PDF tickets using PDFKit
 */

import PDFDocument from 'pdfkit';
import { DateService } from './DateService.js';

export const TicketService = {
  /**
   * Generate PDF tickets for selected services
   */
  async generateTickets(services) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Generate a ticket for each service
        services.forEach((service, index) => {
          if (index > 0) {
            doc.addPage();
          }
          this.generateTicketPage(doc, service);
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Generate a single ticket page
   */
  generateTicketPage(doc, service) {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('SERVICE TICKET', { align: 'center' });

    doc.moveDown(2);

    // Ticket border
    const startY = doc.y;
    doc
      .rect(50, startY, pageWidth, 300)
      .stroke();

    doc.y = startY + 20;
    doc.x = 70;

    // Service details
    const labelWidth = 120;

    this.addField(doc, 'Job Site:', service.job_site_name || service.jobSite || 'N/A', labelWidth);
    this.addField(doc, 'Address:', service.address || 'N/A', labelWidth);
    this.addField(doc, 'City:', service.city || 'N/A', labelWidth);

    doc.moveDown(0.5);

    this.addField(doc, 'Service Type:', service.service_type || service.serviceType || 'N/A', labelWidth);
    this.addField(doc, 'Frequency:', service.frequency || 'N/A', labelWidth);
    this.addField(doc, 'Scheduled Date:', this.formatDate(service.scheduled_date || service.scheduledDate), labelWidth);

    doc.moveDown(0.5);

    if (service.time_constraint || service.timeConstraint) {
      this.addField(doc, 'Time Window:', service.time_constraint || service.timeConstraint, labelWidth);
    }

    if (service.notes) {
      doc.moveDown(0.5);
      this.addField(doc, 'Notes:', service.notes, labelWidth);
    }

    // Signature section
    doc.y = startY + 220;
    doc.x = 70;

    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Service Completed:', { continued: false });

    doc.moveDown(1.5);

    // Signature line
    doc
      .moveTo(70, doc.y)
      .lineTo(300, doc.y)
      .stroke();

    doc
      .fontSize(8)
      .text('Signature', 70, doc.y + 5);

    // Date line
    doc
      .moveTo(350, doc.y - 5)
      .lineTo(500, doc.y - 5)
      .stroke();

    doc
      .text('Date', 350, doc.y);

    // Footer
    doc
      .fontSize(8)
      .text(
        `Generated: ${new Date().toLocaleString()}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );
  },

  /**
   * Add a labeled field
   */
  addField(doc, label, value, labelWidth) {
    const startX = doc.x;

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(label, { continued: true, width: labelWidth });

    doc
      .font('Helvetica')
      .text(` ${value || 'N/A'}`, { continued: false });

    doc.x = startX;
  },

  /**
   * Format date for display
   */
  formatDate(date) {
    if (!date) return 'N/A';
    return DateService.format(date);
  },
};
