import re

with open("app/models/models.py", "r", encoding="utf-8") as f:
    content = f.read()

# We need to extract the enums, Base, User, OrganizationTypeEnum, Hospital, HospitalSettings, Department, StaffProfile.
# First, let's grab everything from the top of the file up to Patient (line 164)
# Wait, Patient is before Hospital. So we can't just split by a single line.

# Let's extract by regex matching classes.
def extract_class(class_name, text):
    # Matches `class Name(...):` and all indented lines following it
    pattern = rf"^(class {class_name}\b.*?(?:\n    .*|\n)*?)(?=\nclass |\Z)"
    match = re.search(pattern, text, re.MULTILINE)
    if match:
        return match.group(1)
    return ""

def remove_class(class_name, text):
    pattern = rf"^(class {class_name}\b.*?(?:\n    .*|\n)*?)(?=\nclass |\Z)"
    return re.sub(pattern, "", text, flags=re.MULTILINE)

core_classes = [
    "RoleEnum", "LicenseStatusEnum", "VerificationStatusEnum", "BedStatusEnum", 
    "QueueStatusEnum", "AccessLevelEnum", "AccessStatusEnum", "RecordTypeEnum", 
    "AddedByEnum", "NotificationTypeEnum", "MessageRoleEnum", "PrescriptionStatusEnum", 
    "LabOrderStatusEnum", "PartnerReferralStatusEnum", "AISafetyMode", "LabTestCategory", 
    "VisitStatusEnum", "Base", "User", "OrganizationTypeEnum", "Hospital", 
    "HospitalSettings", "Department", "StaffProfile"
]

header = """from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, func, Enum as SQLEnum, UUID
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import enum
import uuid
from app.core.encryption import StringEncryptedType, TextEncryptedType
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin, TimestampMixin

JSON_TYPE = JSON().with_variant(JSONB, "postgresql")

"""

core_content = header
new_models_content = content

for cls in core_classes:
    cls_code = extract_class(cls, new_models_content)
    core_content += cls_code + "\n"
    new_models_content = remove_class(cls, new_models_content)

# We also need to remove the original imports and JSON_TYPE from new_models_content 
# and replace it with `from .core import *`
# Let's find the first `class ` in the modified new_models_content
first_class_idx = new_models_content.find("class ")
if first_class_idx != -1:
    # Retain standard imports, but add `from .core import *`
    # Actually, if we just keep the existing imports in models.py it's fine, 
    # but we MUST add `from .core import *` at the top.
    
    top_part = new_models_content[:first_class_idx]
    bottom_part = new_models_content[first_class_idx:]
    
    # We remove the `JSON_TYPE = ...` from top_part if it exists to avoid duplication,
    # or just leave it. Let's just add the import.
    new_top = top_part.replace('JSON_TYPE = JSON().with_variant(JSONB, "postgresql")', '')
    new_top += "\nfrom .core import *\n\n"
    new_models_content = new_top + bottom_part

with open("app/models/core.py", "w", encoding="utf-8") as f:
    f.write(core_content)

with open("app/models/models.py", "w", encoding="utf-8") as f:
    f.write(new_models_content)

print("Extraction completed successfully.")
