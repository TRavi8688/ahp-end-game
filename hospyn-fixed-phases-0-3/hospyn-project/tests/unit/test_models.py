import pytest
from app.services.ai_service import MedicalEntities
import json

def test_medical_entities_pydantic_validation():
    """Verify that the AI output model correctly handles medical data structures."""
    valid_data = {
        "conditions": [{"name": "Diabetes", "status": "active"}],
        "medications": [{"name": "Metformin", "dosage": "500mg"}],
        "lab_results": []
    }
    
    entities = MedicalEntities(**valid_data)
    assert entities.conditions[0]["name"] == "Diabetes"
    assert len(entities.lab_results) == 0

def test_medical_entities_empty_defaults():
    """Ensure that the model provides safe defaults for missing AI data."""
    entities = MedicalEntities()
    assert isinstance(entities.conditions, list)
    assert len(entities.medications) == 0
