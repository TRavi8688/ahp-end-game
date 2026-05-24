from pydantic import BaseModel, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime
from enum import Enum
from app.models.models import PartnerReferralStatusEnum


class InventoryTransactionType(str, Enum):
    PURCHASE = "PURCHASE"
    SALE = "SALE"
    ADJUSTMENT = "ADJUSTMENT"
    EXPIRY = "EXPIRY"
    RETURN = "RETURN"

class PharmacyBase(BaseModel):
    item_name: str
    generic_name: Optional[str] = None
    batch_number: str
    expiry_date: datetime
    stock_quantity: float
    unit_price: float
    reorder_level: float = 10.0
    hsn_code: Optional[str] = None
    tax_percent: float = 12.0

class PharmacyCreate(PharmacyBase):
    pass

class PharmacyUpdate(BaseModel):
    stock_quantity: Optional[float] = None
    unit_price: Optional[float] = None
    reorder_level: Optional[float] = None

class Pharmacy(PharmacyBase):
    id: uuid.UUID
    hospital_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class InventoryTransactionBase(BaseModel):
    inventory_item_id: uuid.UUID
    transaction_type: InventoryTransactionType
    quantity: float
    reference_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None

class InventoryTransactionCreate(InventoryTransactionBase):
    pass

class InventoryTransaction(InventoryTransactionBase):
    id: uuid.UUID
    hospital_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DispenseRequest(BaseModel):
    patient_id: uuid.UUID
    visit_id: Optional[uuid.UUID] = None
    items: List[InventoryTransactionCreate]
    notes: Optional[str] = None

class PartnerPharmacyRequestCreate(BaseModel):
    prescription_id: uuid.UUID
    partner_pharmacy_id: uuid.UUID

class PartnerPharmacyRequestResponse(BaseModel):
    id: uuid.UUID
    prescription_id: uuid.UUID
    referring_hospital_id: uuid.UUID
    partner_pharmacy_id: uuid.UUID
    patient_id: uuid.UUID
    status: PartnerReferralStatusEnum
    created_at: datetime
    
    # Optional nested details could be added here
    
    model_config = ConfigDict(from_attributes=True)

class PharmacyAIScanRequest(BaseModel):
    image_base64: str

class PharmacyAIScanResponse(BaseModel):
    item_name: str
    generic_name: str
    batch_number: str
    expiry_date: str # YYYY-MM-DD
    unit_price: float
    confidence: float
