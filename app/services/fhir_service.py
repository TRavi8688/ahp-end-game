from typing import Dict, Any, List
from datetime import datetime
from app.models.models import MedicalRecord, Patient
import uuid

class FHIRService:
    """
    HL7 FHIR R4 INTEROPERABILITY LAYER.
    Maps internal Hospyn models to standardized FHIR resources.
    """
    
    @staticmethod
    def to_fhir_observation(record: MedicalRecord, patient: Patient) -> Dict[str, Any]:
        """Maps a MedicalRecord (Vitals/Lab) to a FHIR Observation."""
        return {
            "resourceType": "Observation",
            "id": str(record.id),
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "vital-signs" if record.type == "vitals" else "laboratory"
                        }
                    ]
                }
            ],
            "subject": {
                "reference": f"Patient/{patient.hospyn_id}"
            },
            "effectiveDateTime": record.created_at.isoformat(),
            "issued": datetime.utcnow().isoformat() + "Z",
            "valueString": record.summary or "See attached report",
            "note": [
                {"text": record.notes}
            ] if record.notes else []
        }

    @staticmethod
    def to_fhir_diagnostic_report(record: MedicalRecord, patient: Patient) -> Dict[str, Any]:
        """Maps a MedicalRecord (Scan/Lab) to a FHIR DiagnosticReport."""
        return {
            "resourceType": "DiagnosticReport",
            "id": str(record.id),
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                            "code": "LAB" if record.type == "lab_report" else "RAD"
                        }
                    ]
                }
            ],
            "subject": {
                "reference": f"Patient/{patient.hospyn_id}"
            },
            "effectiveDateTime": record.created_at.isoformat(),
            "issued": datetime.utcnow().isoformat() + "Z",
            "conclusion": record.summary,
            "presentedForm": [
                {
                    "contentType": "application/pdf" if record.file_url.endswith(".pdf") else "image/jpeg",
                    "url": record.file_url
                }
            ] if record.file_url else []
        }

    @classmethod
    def generate_bulk_export(cls, records: List[MedicalRecord], patient: Patient) -> List[Dict[str, Any]]:
        """Generates a FHIR Bundle for bulk data portability."""
        entries = []
        for record in records:
            if record.type in ["vitals", "lab_report"]:
                entries.append({
                    "fullUrl": f"urn:uuid:{record.id}",
                    "resource": cls.to_fhir_observation(record, patient),
                    "request": {"method": "POST", "url": "Observation"}
                })
        
        return {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": entries
        }

fhir_service = FHIRService()
