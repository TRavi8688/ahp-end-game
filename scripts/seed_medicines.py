import asyncio
import sys
import os

# Add the root directory to PYTHONPATH so app imports work
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.medicine import MedicineDirectory

INDIAN_MEDICINES = [
    {"name": "Dolo 650", "generic_name": "Paracetamol", "dosage_form": "Tablet", "common_dosages": "650mg", "manufacturer": "Micro Labs"},
    {"name": "Calpol 500", "generic_name": "Paracetamol", "dosage_form": "Tablet", "common_dosages": "500mg", "manufacturer": "GSK"},
    {"name": "Azithral 500", "generic_name": "Azithromycin", "dosage_form": "Tablet", "common_dosages": "500mg", "manufacturer": "Alembic"},
    {"name": "Augmentin 625 Duo", "generic_name": "Amoxicillin and Clavulanate", "dosage_form": "Tablet", "common_dosages": "625mg", "manufacturer": "GSK"},
    {"name": "Monocef-O 200", "generic_name": "Cefpodoxime", "dosage_form": "Tablet", "common_dosages": "200mg", "manufacturer": "Aristo"},
    {"name": "Taxim-O 200", "generic_name": "Cefixime", "dosage_form": "Tablet", "common_dosages": "200mg", "manufacturer": "Alkem"},
    {"name": "Pantosec D SR", "generic_name": "Pantoprazole and Domperidone", "dosage_form": "Capsule", "common_dosages": "40mg/30mg", "manufacturer": "Cipla"},
    {"name": "Pan 40", "generic_name": "Pantoprazole", "dosage_form": "Tablet", "common_dosages": "40mg", "manufacturer": "Alkem"},
    {"name": "Omez 20", "generic_name": "Omeprazole", "dosage_form": "Capsule", "common_dosages": "20mg", "manufacturer": "Dr. Reddy's"},
    {"name": "Aciloc 150", "generic_name": "Ranitidine", "dosage_form": "Tablet", "common_dosages": "150mg", "manufacturer": "Cadila"},
    {"name": "Glycomet 500 SR", "generic_name": "Metformin", "dosage_form": "Tablet", "common_dosages": "500mg", "manufacturer": "USV"},
    {"name": "Galvus Met 50/500", "generic_name": "Vildagliptin and Metformin", "dosage_form": "Tablet", "common_dosages": "50mg/500mg", "manufacturer": "Novartis"},
    {"name": "Telma 40", "generic_name": "Telmisartan", "dosage_form": "Tablet", "common_dosages": "40mg", "manufacturer": "Glenmark"},
    {"name": "Amlokind-AT", "generic_name": "Amlodipine and Atenolol", "dosage_form": "Tablet", "common_dosages": "5mg/50mg", "manufacturer": "Mankind"},
    {"name": "Thyrox 50", "generic_name": "Levothyroxine", "dosage_form": "Tablet", "common_dosages": "50mcg", "manufacturer": "Macleods"},
    {"name": "Allegra 120", "generic_name": "Fexofenadine", "dosage_form": "Tablet", "common_dosages": "120mg", "manufacturer": "Sanofi"},
    {"name": "Montair LC", "generic_name": "Montelukast and Levocetirizine", "dosage_form": "Tablet", "common_dosages": "10mg/5mg", "manufacturer": "Cipla"},
    {"name": "Okacet", "generic_name": "Cetirizine", "dosage_form": "Tablet", "common_dosages": "10mg", "manufacturer": "Cipla"},
    {"name": "Ascoril LS", "generic_name": "Levosalbutamol, Ambroxol, Guaifenesin", "dosage_form": "Syrup", "common_dosages": "100ml", "manufacturer": "Glenmark"},
    {"name": "Corex DX", "generic_name": "Chlorpheniramine and Dextromethorphan", "dosage_form": "Syrup", "common_dosages": "100ml", "manufacturer": "Pfizer"},
    {"name": "Bro-Zedex", "generic_name": "Bromhexine, Guaifenesin, Terbutaline", "dosage_form": "Syrup", "common_dosages": "100ml", "manufacturer": "Wockhardt"},
    {"name": "Volini", "generic_name": "Diclofenac", "dosage_form": "Gel", "common_dosages": "30g", "manufacturer": "Sun Pharma"},
    {"name": "Zerodol-SP", "generic_name": "Aceclofenac, Serratiopeptidase, Paracetamol", "dosage_form": "Tablet", "common_dosages": "100mg/15mg/325mg", "manufacturer": "Ipca"},
    {"name": "Combiflam", "generic_name": "Ibuprofen and Paracetamol", "dosage_form": "Tablet", "common_dosages": "400mg/325mg", "manufacturer": "Sanofi"},
    {"name": "Meftal-Spas", "generic_name": "Mefenamic Acid and Dicyclomine", "dosage_form": "Tablet", "common_dosages": "250mg/10mg", "manufacturer": "Blue Cross"},
    {"name": "Ecosprin 75", "generic_name": "Aspirin", "dosage_form": "Tablet", "common_dosages": "75mg", "manufacturer": "USV"},
    {"name": "Atorva 20", "generic_name": "Atorvastatin", "dosage_form": "Tablet", "common_dosages": "20mg", "manufacturer": "Zydus"},
    {"name": "Rosuvas 10", "generic_name": "Rosuvastatin", "dosage_form": "Tablet", "common_dosages": "10mg", "manufacturer": "Sun Pharma"},
    {"name": "Clopilet 75", "generic_name": "Clopidogrel", "dosage_form": "Tablet", "common_dosages": "75mg", "manufacturer": "Sun Pharma"},
    {"name": "Deriphyllin", "generic_name": "Etofylline and Theophylline", "dosage_form": "Tablet", "common_dosages": "150mg", "manufacturer": "Zydus"},
    {"name": "Asthalin Inhaler", "generic_name": "Salbutamol", "dosage_form": "Inhaler", "common_dosages": "100mcg/dose", "manufacturer": "Cipla"},
    {"name": "Duolin Inhaler", "generic_name": "Levosalbutamol and Ipratropium", "dosage_form": "Inhaler", "common_dosages": "50mcg/20mcg", "manufacturer": "Cipla"},
    {"name": "Foracort 200 Inhaler", "generic_name": "Formoterol and Budesonide", "dosage_form": "Inhaler", "common_dosages": "6mcg/200mcg", "manufacturer": "Cipla"},
    {"name": "O2", "generic_name": "Ofloxacin and Ornidazole", "dosage_form": "Tablet", "common_dosages": "200mg/500mg", "manufacturer": "Medley"},
    {"name": "Cifran 500", "generic_name": "Ciprofloxacin", "dosage_form": "Tablet", "common_dosages": "500mg", "manufacturer": "Sun Pharma"},
    {"name": "Erythrocin 500", "generic_name": "Erythromycin", "dosage_form": "Tablet", "common_dosages": "500mg", "manufacturer": "Pfizer"},
    {"name": "Zifi 200", "generic_name": "Cefixime", "dosage_form": "Tablet", "common_dosages": "200mg", "manufacturer": "FDC"},
    {"name": "Novamox 500", "generic_name": "Amoxicillin", "dosage_form": "Capsule", "common_dosages": "500mg", "manufacturer": "Cipla"},
    {"name": "Shelcal 500", "generic_name": "Calcium and Vitamin D3", "dosage_form": "Tablet", "common_dosages": "500mg/250IU", "manufacturer": "Torrent"},
    {"name": "Evion 400", "generic_name": "Vitamin E", "dosage_form": "Capsule", "common_dosages": "400mg", "manufacturer": "P&G"},
    {"name": "Supradyn", "generic_name": "Multivitamins and Minerals", "dosage_form": "Tablet", "common_dosages": "1s", "manufacturer": "Bayer"},
    {"name": "Becosules", "generic_name": "B Complex with Vitamin C", "dosage_form": "Capsule", "common_dosages": "1s", "manufacturer": "Pfizer"},
    {"name": "Zincovit", "generic_name": "Multivitamins with Zinc", "dosage_form": "Tablet", "common_dosages": "1s", "manufacturer": "Apex"},
    {"name": "Dextrose 5%", "generic_name": "Dextrose IV", "dosage_form": "Injection", "common_dosages": "500ml", "manufacturer": "Baxter"},
    {"name": "Normal Saline (NS)", "generic_name": "Sodium Chloride 0.9%", "dosage_form": "Injection", "common_dosages": "500ml", "manufacturer": "Neon"},
    {"name": "Ondem 4", "generic_name": "Ondansetron", "dosage_form": "Tablet", "common_dosages": "4mg", "manufacturer": "Alkem"},
    {"name": "Emeset 4", "generic_name": "Ondansetron", "dosage_form": "Injection", "common_dosages": "4mg/2ml", "manufacturer": "Cipla"},
    {"name": "Stemetil MD", "generic_name": "Prochlorperazine", "dosage_form": "Tablet", "common_dosages": "5mg", "manufacturer": "Abbott"},
    {"name": "Vertin 16", "generic_name": "Betahistine", "dosage_form": "Tablet", "common_dosages": "16mg", "manufacturer": "Abbott"},
]

async def seed_medicines():
    async with SessionLocal() as db:
        print("Seeding medicine directory...")
        added = 0
        from sqlalchemy import select
        for med in INDIAN_MEDICINES:
            # Check if it exists
            stmt = select(MedicineDirectory).where(MedicineDirectory.name == med["name"])
            res = await db.execute(stmt)
            existing = res.scalars().first()
            if not existing:
                new_med = MedicineDirectory(**med)
                db.add(new_med)
                added += 1
        
        await db.commit()
        print(f"Added {added} medicines to the directory.")

if __name__ == "__main__":
    asyncio.run(seed_medicines())
