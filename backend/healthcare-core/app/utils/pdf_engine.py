"""
backend/healthcare-core/app/utils/pdf_engine.py

HOSPAIN Enterprise PDF Invoice Generator.

Shared by:
  - api/v1/billing.py         (hospital billing receipts)
  - api/v1/pharmacy_walkin.py (pharmacy counter sale invoices)
  - api/v1/pharmacy_orders.py (Hospin order invoices)

Features:
  - HOSPAIN logo on every page
  - Pharmacy/Hospital name and address
  - Invoice number, date, payment method
  - Itemized table with quantity, unit price, discount, line total
  - Subtotal / discount / GST / total summary
  - "Care Beyond Today" tagline footer
  - Computer-generated disclaimer
  - Returns io.BytesIO ready for StreamingResponse

Usage:
    from app.utils.pdf_engine import build_invoice_pdf
    buf = build_invoice_pdf(invoice_data)
    return StreamingResponse(buf, media_type="application/pdf", headers={...})
"""

import io
import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import List

# Brand constants
BRAND_NAME = "HOSPAIN"
BRAND_TAGLINE = "Care Beyond Today"
BRAND_NAVY = "#0F2A5E"      # Dark navy from logo wordmark
BRAND_BLUE = "#1565C0"      # Mid-blue from logo gradient
BRAND_LIGHT = "#E8F1FB"     # Soft blue tint for header backgrounds
HOSPAIN_LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "static", "hospain-logo.png")


@dataclass
class InvoiceLineItem:
    description: str
    quantity: float
    unit_price: float
    discount_percent: float = 0.0   # e.g. 5 for 5%
    discount_amount: float = 0.0    # per-unit absolute discount (overrides percent if set)
    tax_percent: float = 0.0        # GST rate for this line
    category: str = ""

    @property
    def effective_unit_price(self) -> float:
        if self.discount_amount:
            return max(0.0, self.unit_price - self.discount_amount)
        return max(0.0, self.unit_price * (1 - self.discount_percent / 100))

    @property
    def line_subtotal(self) -> float:
        return self.effective_unit_price * self.quantity

    @property
    def gst_amount(self) -> float:
        return self.line_subtotal * self.tax_percent / 100

    @property
    def line_total(self) -> float:
        return self.line_subtotal + self.gst_amount


@dataclass
class InvoiceData:
    invoice_number: str
    issued_at: datetime
    pharmacy_name: str
    pharmacy_address: str = ""
    pharmacy_phone: str = ""
    pharmacy_gstin: str = ""
    patient_name: str = ""
    patient_phone: str = ""
    patient_hospain_id: str = ""
    items: List[InvoiceLineItem] = field(default_factory=list)
    extra_discount_amount: float = 0.0    # pharmacy-level discount on the whole bill
    extra_discount_label: str = "Pharmacy Discount"
    payment_method: str = ""
    payment_ref: str = ""
    invoice_type: str = "Tax Invoice"     # "Tax Invoice" | "Receipt" | "Order Invoice"
    status: str = ""
    notes: str = ""

    @property
    def items_subtotal(self) -> float:
        return sum(item.effective_unit_price * item.quantity for item in self.items)

    @property
    def total_item_discount(self) -> float:
        return sum(
            (item.unit_price - item.effective_unit_price) * item.quantity
            for item in self.items
        )

    @property
    def subtotal_after_item_discounts(self) -> float:
        return self.items_subtotal

    @property
    def total_gst(self) -> float:
        return sum(item.gst_amount for item in self.items)

    @property
    def grand_total(self) -> float:
        return max(0.0, self.items_subtotal + self.total_gst - self.extra_discount_amount)


def build_invoice_pdf(data: InvoiceData) -> io.BytesIO:
    """
    Build a fully-branded HOSPAIN invoice PDF and return it as an in-memory BytesIO.
    Raises ImportError if reportlab is not installed.
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, Image as RLImage,
    )
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT

    # ── Colors ────────────────────────────────────────────────────────────────
    navy    = colors.HexColor(BRAND_NAVY)
    blue    = colors.HexColor(BRAND_BLUE)
    light   = colors.HexColor(BRAND_LIGHT)
    grey    = colors.HexColor("#6B7280")
    green   = colors.HexColor("#15803D")
    red     = colors.HexColor("#DC2626")

    # ── Document ──────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=18*mm, leftMargin=18*mm,
        topMargin=15*mm, bottomMargin=15*mm,
    )
    width = A4[0] - 36*mm

    # ── Styles ────────────────────────────────────────────────────────────────
    def ps(name, **kw):
        return ParagraphStyle(name, **kw)

    brand_big   = ps("brand_big",   fontSize=22, textColor=navy, fontName="Helvetica-Bold", leading=26)
    tagline_s   = ps("tagline",     fontSize=9,  textColor=grey, fontName="Helvetica")
    section_hdr = ps("sec_hdr",     fontSize=10, textColor=navy, fontName="Helvetica-Bold", spaceAfter=3)
    normal      = ps("normal",      fontSize=9,  textColor=colors.HexColor("#1F2937"), fontName="Helvetica")
    normal_bold = ps("normal_bold", fontSize=9,  textColor=colors.HexColor("#111827"), fontName="Helvetica-Bold")
    small_grey  = ps("sm_grey",     fontSize=8,  textColor=grey, fontName="Helvetica")
    footer_s    = ps("footer",      fontSize=7.5, textColor=grey, fontName="Helvetica", alignment=TA_CENTER, leading=11)
    total_label = ps("tot_lbl",     fontSize=10, textColor=navy, fontName="Helvetica-Bold")
    total_val   = ps("tot_val",     fontSize=13, textColor=green, fontName="Helvetica-Bold", alignment=TA_RIGHT)

    story = []

    # ── Header: Logo + Brand + Pharmacy name ─────────────────────────────────
    logo_cell = ""
    if os.path.exists(HOSPAIN_LOGO_PATH):
        try:
            logo_cell = RLImage(HOSPAIN_LOGO_PATH, width=18*mm, height=18*mm)
        except Exception:
            logo_cell = ""

    brand_block = [
        [Paragraph(f"<b>{BRAND_NAME}</b>", brand_big)],
        [Paragraph(BRAND_TAGLINE, tagline_s)],
    ]
    brand_table_inner = Table(brand_block, colWidths=[width - 22*mm])
    brand_table_inner.setStyle(TableStyle([("LEFTPADDING", (0,0), (-1,-1), 0)]))

    if logo_cell:
        hdr_data = [[logo_cell, brand_table_inner]]
        hdr_table = Table(hdr_data, colWidths=[22*mm, width - 22*mm])
        hdr_table.setStyle(TableStyle([
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING", (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ]))
    else:
        hdr_data = [[Paragraph(f"<b>{BRAND_NAME}</b>", brand_big)]]
        hdr_table = Table(hdr_data, colWidths=[width])
        hdr_table.setStyle(TableStyle([("LEFTPADDING", (0,0), (-1,-1), 0)]))

    story.append(hdr_table)
    story.append(Spacer(1, 3*mm))
    story.append(HRFlowable(width="100%", thickness=2, color=navy))
    story.append(Spacer(1, 3*mm))

    # ── Invoice type + number + date row ─────────────────────────────────────
    meta_left = [
        [Paragraph(f"<b>{data.invoice_type}</b>", ps("inv_type", fontSize=14, textColor=navy, fontName="Helvetica-Bold"))],
        [Paragraph(f"<b>Invoice #:</b> {data.invoice_number}", normal_bold)],
        [Paragraph(f"<b>Date:</b> {data.issued_at.strftime('%d %b %Y, %I:%M %p')}", normal)],
    ]
    if data.payment_method:
        meta_left.append([Paragraph(f"<b>Payment:</b> {data.payment_method.upper()}", normal)])
    if data.payment_ref:
        meta_left.append([Paragraph(f"<b>Ref:</b> {data.payment_ref}", normal)])
    if data.status:
        status_color = green if data.status.upper() in ("PAID", "DELIVERED") else blue
        meta_left.append([Paragraph(
            f"<b>Status:</b> <font color='{status_color.hexval() if hasattr(status_color,'hexval') else '#15803D'}'>{data.status.upper()}</font>",
            normal_bold
        )])

    meta_right = []
    meta_right.append([Paragraph(f"<b>{data.pharmacy_name}</b>", ps("ph_name", fontSize=11, textColor=navy, fontName="Helvetica-Bold"))])
    if data.pharmacy_address:
        meta_right.append([Paragraph(data.pharmacy_address, normal)])
    if data.pharmacy_phone:
        meta_right.append([Paragraph(f"Ph: {data.pharmacy_phone}", normal)])
    if data.pharmacy_gstin:
        meta_right.append([Paragraph(f"GSTIN: {data.pharmacy_gstin}", small_grey)])

    t_left  = Table([[r[0]] for r in meta_left],  colWidths=[90*mm])
    t_right = Table([[r[0]] for r in meta_right], colWidths=[width - 90*mm])
    for t in (t_left, t_right):
        t.setStyle(TableStyle([("LEFTPADDING",(0,0),(-1,-1),0), ("BOTTOMPADDING",(0,0),(-1,-1),2)]))

    meta_outer = Table([[t_left, t_right]], colWidths=[90*mm, width - 90*mm])
    meta_outer.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),0),
        ("RIGHTPADDING",(0,0),(-1,-1),0),
    ]))
    story.append(meta_outer)
    story.append(Spacer(1, 4*mm))

    # ── Patient row ───────────────────────────────────────────────────────────
    if data.patient_name or data.patient_hospain_id:
        patient_parts = []
        if data.patient_name:
            patient_parts.append(f"<b>Patient:</b> {data.patient_name}")
        if data.patient_phone:
            patient_parts.append(f"Ph: {data.patient_phone}")
        if data.patient_hospain_id:
            patient_parts.append(f"HOSPAIN ID: {data.patient_hospain_id}")
        story.append(Paragraph("  |  ".join(patient_parts), normal))
        story.append(Spacer(1, 3*mm))

    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1")))
    story.append(Spacer(1, 3*mm))

    # ── Line Items Table ──────────────────────────────────────────────────────
    story.append(Paragraph("<b>Items</b>", section_hdr))

    col_widths = [width*0.38, width*0.08, width*0.14, width*0.12, width*0.14, width*0.14]
    item_headers = [["Description", "Qty", "Unit Price", "Discount", "GST", "Total"]]
    item_rows = []
    for item in data.items:
        disc_str = ""
        if item.discount_amount:
            disc_str = f"₹{item.discount_amount:.2f}/u"
        elif item.discount_percent:
            disc_str = f"{item.discount_percent:.1f}%"
        else:
            disc_str = "—"

        gst_str = f"₹{item.gst_amount:.2f}" if item.gst_amount else "—"
        item_rows.append([
            Paragraph(item.description + (f"\n<font size=7 color='#6B7280'>{item.category}</font>" if item.category else ""), normal),
            str(int(item.quantity) if item.quantity == int(item.quantity) else f"{item.quantity:.1f}"),
            f"₹{item.unit_price:.2f}",
            disc_str,
            gst_str,
            f"₹{item.line_total:.2f}",
        ])

    items_table_data = item_headers + item_rows
    items_table = Table(items_table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0,0), (-1,0), navy),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,0), 8.5),
        ("BOTTOMPADDING", (0,0), (-1,0), 5),
        ("TOPPADDING", (0,0), (-1,0), 5),
        # Rows
        ("FONTSIZE", (0,1), (-1,-1), 8.5),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#E2E8F0")),
        ("ALIGN", (1,0), (-1,-1), "RIGHT"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("BOTTOMPADDING", (0,1), (-1,-1), 4),
        ("TOPPADDING", (0,1), (-1,-1), 4),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 4*mm))

    # ── Summary block ─────────────────────────────────────────────────────────
    summary_rows = []
    if data.total_item_discount > 0:
        summary_rows.append(["Item Discounts", f"- ₹{data.total_item_discount:.2f}"])
    if data.total_gst > 0:
        summary_rows.append(["GST (5%)", f"₹{data.total_gst:.2f}"])
    if data.extra_discount_amount > 0:
        summary_rows.append([data.extra_discount_label, f"- ₹{data.extra_discount_amount:.2f}"])

    summary_rows.append(["", ""])  # spacer
    summary_rows.append([
        Paragraph("<b>GRAND TOTAL</b>", total_label),
        Paragraph(f"<b>₹{data.grand_total:.2f}</b>", total_val),
    ])

    summary_table = Table(summary_rows, colWidths=[width - 50*mm, 50*mm])
    summary_table.setStyle(TableStyle([
        ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("LINEABOVE", (0,-1), (-1,-1), 1, navy),
        ("BACKGROUND", (0,-1), (-1,-1), light),
        ("BOTTOMPADDING", (0,-1), (-1,-1), 6),
        ("TOPPADDING", (0,-1), (-1,-1), 6),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 5*mm))

    # ── Notes ─────────────────────────────────────────────────────────────────
    if data.notes:
        story.append(Paragraph(f"<b>Notes:</b> {data.notes}", small_grey))
        story.append(Spacer(1, 3*mm))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0")))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        f"<b>{BRAND_NAME}</b> — {BRAND_TAGLINE}  |  This is a computer-generated invoice and requires no signature.",
        footer_s,
    ))
    story.append(Paragraph(
        "For queries contact: support@hospain.in  |  HOSPAIN Healthcare Pvt. Ltd.",
        footer_s,
    ))

    doc.build(story)
    buf.seek(0)
    return buf
