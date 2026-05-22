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

classes_to_move = ["PaymentStatus", "PaymentMethod", "Invoice", "BillItem"]

billing_content = ""
for cls in classes_to_move:
    cls_code = extract_class(cls, content)
    if cls_code:
        billing_content += cls_code + "\n"
        content = remove_class(cls, content)

if not os.path.exists("app/models/billing.py"):
    header = """from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, Text, func, Enum as SQLEnum, UUID, Numeric, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import enum
import uuid
from app.models.mixins import TenantScopedMixin, VersionedMixin, AuditableMixin, TimestampMixin
from app.models.core import *
from app.models.clinical import *

"""
    with open("app/models/billing.py", "w", encoding="utf-8") as f:
        f.write(header + billing_content)
else:
    with open("app/models/billing.py", "a", encoding="utf-8") as f:
        f.write("\n" + billing_content)

# Update models.py to import billing at the top
if "from .billing import *" not in content:
    content = content.replace("from .clinical import *", "from .clinical import *\nfrom .billing import *")

with open("app/models/models.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Billing Batch 1 Extraction completed successfully.")
