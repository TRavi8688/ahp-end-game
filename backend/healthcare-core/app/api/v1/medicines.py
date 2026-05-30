import json
from fastapi import APIRouter, Query
from typing import List, Dict

router = APIRouter()

MEDICINES_DB = [
    {
        "name": "Paracetamol",
        "generic_name": "Acetaminophen",
        "common_dosages": "500mg, 650mg",
    },
    {
        "name": "Amoxicillin",
        "generic_name": "Amoxicillin",
        "common_dosages": "250mg, 500mg",
    },
    {
        "name": "Ibuprofen",
        "generic_name": "Ibuprofen",
        "common_dosages": "200mg, 400mg",
    },
    {
        "name": "Omeprazole",
        "generic_name": "Omeprazole",
        "common_dosages": "20mg, 40mg",
    },
    {"name": "Cetirizine", "generic_name": "Cetirizine", "common_dosages": "10mg"},
    {
        "name": "Azithromycin",
        "generic_name": "Azithromycin",
        "common_dosages": "250mg, 500mg",
    },
    {
        "name": "Metformin",
        "generic_name": "Metformin",
        "common_dosages": "500mg, 850mg, 1000mg",
    },
    {
        "name": "Atorvastatin",
        "generic_name": "Atorvastatin",
        "common_dosages": "10mg, 20mg, 40mg",
    },
    {"name": "Amlodipine", "generic_name": "Amlodipine", "common_dosages": "5mg, 10mg"},
    {
        "name": "Losartan",
        "generic_name": "Losartan",
        "common_dosages": "25mg, 50mg, 100mg",
    },
    {
        "name": "Pantoprazole",
        "generic_name": "Pantoprazole",
        "common_dosages": "20mg, 40mg",
    },
    {
        "name": "Ciprofloxacin",
        "generic_name": "Ciprofloxacin",
        "common_dosages": "250mg, 500mg",
    },
    {
        "name": "Levothyroxine",
        "generic_name": "Levothyroxine",
        "common_dosages": "25mcg, 50mcg, 75mcg, 100mcg",
    },
    {
        "name": "Albuterol",
        "generic_name": "Salbutamol",
        "common_dosages": "90mcg/actuation",
    },
    {
        "name": "Gabapentin",
        "generic_name": "Gabapentin",
        "common_dosages": "100mg, 300mg, 400mg",
    },
]


@router.get("/search")
async def search_medicines(q: str = Query(..., min_length=1)):
    """Search for medicines by name or generic name."""
    query = q.lower()
    results = [
        med
        for med in MEDICINES_DB
        if query in med["name"].lower() or query in med["generic_name"].lower()
    ]
    return {"results": results}
