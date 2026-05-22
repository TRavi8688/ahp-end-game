import re
import os

with open("app/models/models.py", "r", encoding="utf-8") as f:
    content = f.read()

def extract_class(class_name, text):
    pattern = rf"^(class {class_name}\b.*?(?:\n    .*|\n)*?)(?=\nclass |\Z)"
    match = re.search(pattern, text, re.MULTILINE)
    return match.group(1) if match else ""

def remove_class(class_name, text):
    pattern = rf"^(class {class_name}\b.*?(?:\n    .*|\n)*?)(?=\nclass |\Z)"
    return re.sub(pattern, "", text, flags=re.MULTILINE)

classes_to_move = ["Medication", "MedicationIntakeLog", "DigitalPrescription", "PrescriptionItem"]

clinical_content = ""
for cls in classes_to_move:
    cls_code = extract_class(cls, content)
    if cls_code:
        clinical_content += cls_code + "\n"
        content = remove_class(cls, content)

with open("app/models/clinical.py", "a", encoding="utf-8") as f:
    f.write("\n" + clinical_content)

with open("app/models/models.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Batch 3 Extraction completed successfully.")
