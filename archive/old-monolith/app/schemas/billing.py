from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from app.models.models import PaymentStatus, PaymentMethod

class BillItemBase(BaseModel):
    description: str
    category: str
    quantity: float = 1.0
    unit_price: float
    tax_percent: float = 0.0

class BillItemCreate(BillItemBase):
    reference_id: Optional[UUID] = None

class BillItem(BaseModel):
    id: UUID
    item_name: str = Field(alias="item_name")
    item_category: str = Field(alias="item_category")
    quantity: float
    unit_price: float
    subtotal: float
    tax_percent: float

    # Provide backward-compatible aliases for frontends expecting 'description' / 'total_price'
    @property
    def description(self) -> str:
        return self.item_name

    @property
    def total_price(self) -> float:
        return self.subtotal

    model_config = {"from_attributes": True, "populate_by_name": True}

class InvoiceBase(BaseModel):
    patient_id: UUID
    visit_id: Optional[UUID] = None
    notes: Optional[str] = None
    due_date: Optional[datetime] = None

class InvoiceCreate(InvoiceBase):
    items: List[BillItemCreate]
    discount_amount: float = 0.0

class InvoiceUpdate(BaseModel):
    status: Optional[PaymentStatus] = None
    discount_amount: Optional[float] = None
    notes: Optional[str] = None

class Invoice(InvoiceBase):
    id: UUID
    invoice_number: str
    total_amount: float
    discount_amount: float
    tax_amount: float
    payable_amount: float
    paid_amount: float
    status: PaymentStatus
    created_at: datetime
    items: List[BillItem]
    
    class Config:
        from_attributes = True

class PaymentCreate(BaseModel):
    amount: float
    method: PaymentMethod
    transaction_ref: Optional[str] = None

class PaymentResponse(BaseModel):
    id: UUID
    amount: float
    method: PaymentMethod = Field(validation_alias="payment_method")
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}

