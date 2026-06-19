from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
import io
import base64
from datetime import datetime, timezone

class ReportService:
    """
    Hospyn Print Engine: Generates professional PDFs for clinical and financial proof.
    """
    
    @staticmethod
    def generate_prescription_pdf(data: dict) -> str:
        """
        Generates a professional digital prescription.
        """
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # Header: Hospyn Branding
        p.setFont("Helvetica-Bold", 24)
        p.drawString(1 * inch, height - 1 * inch, "HOSPYN")
        p.setFont("Helvetica", 10)
        p.drawString(1 * inch, height - 1.2 * inch, f"Organization ID: {data.get('hospyn_id')}")
        
        # Clinical Info
        p.setFont("Helvetica-Bold", 14)
        p.drawString(1 * inch, height - 2 * inch, f"Patient: {data.get('patient_name')}")
        p.drawString(1 * inch, height - 2.3 * inch, f"Doctor: {data.get('doctor_name')}")
        p.line(1 * inch, height - 2.5 * inch, width - 1 * inch, height - 2.5 * inch)

        # Rx Content
        p.setFont("Helvetica-Bold", 16)
        p.drawString(1 * inch, height - 3 * inch, "Rx:")
        
        y_offset = 3.3
        p.setFont("Helvetica", 12)
        for item in data.get("medications", []):
            p.drawString(1.2 * inch, height - y_offset * inch, f"- {item['name']} ({item['dosage']}) - {item['frequency']}")
            y_offset += 0.3

        # Footer & Security
        p.setFont("Helvetica-Oblique", 8)
        p.drawString(1 * inch, 1 * inch, f"Digitally signed by Hospyn OS at {datetime.now(timezone.utc).isoformat()}")
        p.drawString(1 * inch, 0.8 * inch, "This is a computer-generated document and requires no physical signature.")

        p.showPage()
        p.save()
        
        pdf_base64 = base64.b64encode(buffer.getvalue()).decode()
        return f"data:application/pdf;base64,{pdf_base64}"

    @staticmethod
    def generate_receipt_pdf(data: dict) -> str:
        """
        Generates a financial receipt for hospital owners/partners.
        """
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        
        p.setFont("Helvetica-Bold", 20)
        p.drawString(1 * inch, 10 * inch, "PAYMENT RECEIPT")
        p.setFont("Helvetica", 12)
        p.drawString(1 * inch, 9.5 * inch, f"Invoice #: {data.get('invoice_no')}")
        p.drawString(1 * inch, 9.3 * inch, f"Amount Paid: {data.get('currency')} {data.get('amount')}")
        p.drawString(1 * inch, 9.1 * inch, f"Tier: {data.get('tier_name')}")
        
        p.save()
        return base64.b64encode(buffer.getvalue()).decode()
