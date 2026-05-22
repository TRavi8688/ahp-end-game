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

classes_to_move = ["Patient", "PatientVisit", "PatientDashboard", "FamilyMember"]
# Wait, let's just move Patient, PatientVisit, and PatientDashboard and FamilyMember if they exist.
# Let's check if FamilyMember and PatientDashboard exist in models.py.
# Using python directly to do this.

clinical_content = ""
for cls in classes_to_move:
    cls_code = extract_class(cls, content)
    if cls_code:
        clinical_content += cls_code + "\n"
        content = remove_class(cls, content)

if not os.path.exists("app/models/clinical.py"):
    header = """from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, func, Enum as SQLEnum, UUID
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import enum
import uuid
from app.core.encryption import StringEncryptedType, TextEncryptedType
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin, TimestampMixin
from app.models.core import Base, JSON_TYPE, VisitStatusEnum

"""
    with open("app/models/clinical.py", "w", encoding="utf-8") as f:
        f.write(header + clinical_content)
else:
    with open("app/models/clinical.py", "a", encoding="utf-8") as f:
        f.write("\n" + clinical_content)

# Update models.py to import clinical at the top
if "from .clinical import *" not in content:
    content = content.replace("from .core import *", "from .core import *\nfrom .clinical import *")

with open("app/models/models.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Batch 1 Extraction completed successfully.")
