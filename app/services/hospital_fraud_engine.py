# app/services/hospital_fraud_engine.py

from sqlalchemy.orm import Session
from uuid import UUID
from app.models.hospital_verification import FraudSignal, FraudSignalTypeEnum, FraudSeverityEnum
from app.models.core import Hospital

class HospitalFraudEngine:
    """
    Evaluates incoming hospital registrations for potential fraud signals
    and calculates an overall risk score.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.risk_score = 0
        self.signals = []

    def evaluate_hospital(self, hospital_id: UUID) -> int:
        hospital = self.db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if not hospital:
            return 0
            
        self.risk_score = 0
        self.signals = []
        
        self._check_duplicate_gst(hospital)
        self._check_disposable_email(hospital)
        self._check_duplicate_domain(hospital)
        
        # Save signals to DB
        for signal in self.signals:
            self.db.add(signal)
            
        # Update hospital risk score
        hospital.risk_score = self.risk_score
        self.db.commit()
        
        return self.risk_score

    def _check_duplicate_gst(self, hospital: Hospital):
        if not hospital.gst_number:
            return
            
        duplicate = self.db.query(Hospital).filter(
            Hospital.gst_number == hospital.gst_number,
            Hospital.id != hospital.id
        ).first()
        
        if duplicate:
            self.risk_score += 50
            self.signals.append(
                FraudSignal(
                    hospital_id=hospital.id,
                    signal_type=FraudSignalTypeEnum.duplicate_gst,
                    severity=FraudSeverityEnum.critical,
                    description=f"GST number exactly matches hospital {duplicate.id}"
                )
            )

    def _check_disposable_email(self, hospital: Hospital):
        if not hospital.hospital_email:
            return
            
        disposable_domains = ['yopmail.com', 'mailinator.com', 'guerrillamail.com']
        domain = hospital.hospital_email.split('@')[-1].lower()
        
        if domain in disposable_domains:
            self.risk_score += 30
            self.signals.append(
                FraudSignal(
                    hospital_id=hospital.id,
                    signal_type=FraudSignalTypeEnum.disposable_email,
                    severity=FraudSeverityEnum.high,
                    description=f"Using known disposable email domain: {domain}"
                )
            )

    def _check_duplicate_domain(self, hospital: Hospital):
        if not hospital.domain:
            return
            
        duplicate = self.db.query(Hospital).filter(
            Hospital.domain == hospital.domain,
            Hospital.id != hospital.id
        ).first()
        
        if duplicate:
            self.risk_score += 40
            self.signals.append(
                FraudSignal(
                    hospital_id=hospital.id,
                    signal_type=FraudSignalTypeEnum.duplicate_domain,
                    severity=FraudSeverityEnum.high,
                    description=f"Domain exactly matches hospital {duplicate.id}"
                )
            )
