from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch
import io
from datetime import datetime

class InvoicePDFGenerator:
    @staticmethod
    def generate(invoice_data: dict, hospital_data: dict, patient_data: dict) -> io.BytesIO:
        """
        CO-FOUNDER LEVEL PDF GENERATION:
        Generates a professional, branded clinical invoice PDF.
        """
        buffer = io.BytesIO()
        # Set up document with professional margins
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=A4, 
            rightMargin=40, 
            leftMargin=40, 
            topMargin=40, 
            bottomMargin=40
        )
        elements = []
        styles = getSampleStyleSheet()
        
        # Define Custom Styles for Hospital Branding
        header_style = ParagraphStyle(
            'HospitalHeader',
            parent=styles['Heading1'],
            fontSize=26,
            textColor=colors.HexColor("#6366F1"), # Hospyn Indigo
            spaceAfter=8,
            fontName='Helvetica-Bold'
        )
        
        sub_header_style = ParagraphStyle(
            'SubHeader',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor("#64748B"),
            spaceAfter=2,
            fontName='Helvetica-Bold'
        )

        # 1. HOSPITAL IDENTITY SECTION
        elements.append(Paragraph(hospital_data.get('name', 'HOSPYN CLINICAL NETWORK').upper(), header_style))
        elements.append(Paragraph(f"{hospital_data.get('address', 'Clinical Zone, Enterprise Sector')}", styles['Normal']))
        elements.append(Paragraph(f"Contact: {hospital_data.get('phone', '+91 000 000 0000')} | Email: billing@hospyn.com", styles['Normal']))
        elements.append(Paragraph(f"GSTIN: {hospital_data.get('gstin', '27AAAAA0000A1Z5')}", styles['Normal']))
        elements.append(Spacer(1, 0.4 * inch))
        
        # 2. TRANSACTION METADATA (GRID)
        meta_data = [
            [Paragraph("INVOICE DETAILS", sub_header_style), Paragraph("PATIENT DETAILS", sub_header_style)],
            [f"Invoice #: {invoice_data['invoice_number']}", f"Patient Name: {patient_data['name']}"],
            [f"Date: {invoice_data['date']}", f"Patient ID: {patient_data['hospyn_id']}"],
            [f"Status: {invoice_data['status']}", f"Visit ID: {invoice_data.get('visit_id', 'N/A')}"]
        ]
        meta_table = Table(meta_data, colWidths=[3.5 * inch, 3.5 * inch])
        meta_table.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
            ('FONTSIZE', (0,1), (-1,-1), 10),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 0.4 * inch))
        
        # 3. ITEMIZED BILLING TABLE
        # Table Header
        data = [['SR #', 'DESCRIPTION', 'CATEGORY', 'QTY', 'UNIT PRICE', 'TAX %', 'TOTAL']]
        
        # Table Body
        for i, item in enumerate(invoice_data['items']):
            data.append([
                str(i+1),
                item['item_name'],
                item['item_category'],
                str(item['quantity']),
                f"₹{item['unit_price']}",
                f"{item['tax_percent']}%",
                f"₹{item['subtotal']}"
            ])
            
        table = Table(data, colWidths=[0.5*inch, 2.5*inch, 1.0*inch, 0.5*inch, 1.0*inch, 0.7*inch, 1.0*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#1E293B")),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 10),
            ('BOTTOMPADDING', (0,0), (-1,0), 12),
            ('TOPPADDING', (0,0), (-1,0), 12),
            ('BACKGROUND', (0,1), (-1,-1), colors.white),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('ALIGN', (1,1), (1,-1), 'LEFT'),
            ('FONTSIZE', (0,1), (-1,-1), 9),
            ('BOTTOMPADDING', (0,1), (-1,-1), 8),
            ('TOPPADDING', (0,1), (-1,-1), 8),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 0.3 * inch))
        
        # 4. FINANCIAL SUMMARY (RIGHT ALIGNED)
        totals_data = [
            ['', 'SUBTOTAL:', f"₹{invoice_data['total_amount']}"],
            ['', 'GST / TAX:', f"₹{invoice_data['tax_amount']}"],
            ['', 'DISCOUNT:', f"- ₹{invoice_data['discount_amount']}"],
            ['', 'NET PAYABLE:', f"₹{invoice_data['payable_amount']}"]
        ]
        totals_table = Table(totals_data, colWidths=[4.7*inch, 1.5*inch, 1.0*inch])
        totals_table.setStyle(TableStyle([
            ('ALIGN', (1,0), (2,-1), 'RIGHT'),
            ('FONTNAME', (1,0), (1,-2), 'Helvetica'),
            ('FONTNAME', (1,3), (2,3), 'Helvetica-Bold'),
            ('FONTSIZE', (1,3), (2,3), 12),
            ('TEXTCOLOR', (1,3), (2,3), colors.HexColor("#6366F1")),
            ('TOPPADDING', (1,3), (2,3), 12),
        ]))
        elements.append(totals_table)
        
        # 5. FOOTER & COMPLIANCE
        elements.append(Spacer(1, 1.5 * inch))
        elements.append(Paragraph("TERMS & CONDITIONS", sub_header_style))
        elements.append(Paragraph("1. This is a computer-generated invoice and does not require a physical signature.", styles['Normal']))
        elements.append(Paragraph("2. Please retain this receipt for insurance claims and clinical audits.", styles['Normal']))
        elements.append(Paragraph("3. Payments are subject to hospital reconciliation policies.", styles['Normal']))
        elements.append(Spacer(1, 0.5 * inch))
        elements.append(Paragraph(f"VERIFIED BY HOSPYN CORE v2.0 | TIMESTAMP: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
        
        # Build the document
        doc.build(elements)
        buffer.seek(0)
        return buffer
