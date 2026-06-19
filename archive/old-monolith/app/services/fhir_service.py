from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import FHIRResource, MedicalDevice, LabResult, Patient
from sqlalchemy import select
from app.core.logging import logger
import uuid

class FHIRService:
    """
    CLINICAL INTEROPERABILITY ENGINE (Phase 3.1).
    Ingests standardized data from hospital machines and wearables.
    """
    def __init__(self, db: AsyncSession):
        self.db = db

    async def ingest_observation(self, device_serial: str, patient_id: uuid.UUID, fhir_data: dict):
        """
        Normalizes a machine observation into the Hospyn timeline.
        """
        # 1. Resolve Device
        stmt = select(MedicalDevice).where(MedicalDevice.serial_number == device_serial)
        result = await self.db.execute(stmt)
        device = result.scalar_one_or_none()
        
        if not device:
            logger.error(f"UNRECOGNIZED_DEVICE: {device_serial}")
            raise ValueError("DEVICE_NOT_REGISTERED")

        # 2. Store the Raw FHIR Resource (Audit Trail)
        resource = FHIRResource(
            hospital_id=device.hospital_id,
            patient_id=patient_id,
            resource_type="Observation",
            fhir_json=fhir_data,
            source_device_id=device.id
        )
        self.db.add(resource)

        # 3. Map to Longitudinal Clinical Data (Trending)
        # FHIR Observations often contain LOINC codes or simple value/unit pairs.
        test_name = fhir_data.get("code", {}).get("text", "Unknown Observation")
        value = fhir_data.get("valueQuantity", {}).get("value")
        unit = fhir_data.get("valueQuantity", {}).get("unit")

        if value is not None:
            lab_entry = LabResult(
                patient_id=patient_id,
                hospital_id=device.hospital_id,
                test_name=test_name,
                value=str(value),
                unit=unit,
                is_abnormal=False, # Logic: compare against ref range if available
                observation_date=fhir_data.get("effectiveDateTime")
            )
            self.db.add(lab_entry)

        await self.db.commit()
        logger.info(f"FHIR_INGESTION_SUCCESS: {test_name} from {device.name}")
        return True
