import re

path = 'app/models/models.py'
with open(path, 'r') as f:
    content = f.read()

# Update ForeignKey types and types in Mapped[...]
# From: hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id")
# To: hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id")

# Patterns to match
content = re.sub(r'hospital_id: Mapped\[int\]', 'hospital_id: Mapped[uuid.UUID]', content)
content = re.sub(r'hospital_id: Mapped\[Optional\[int\]\]', 'hospital_id: Mapped[Optional[uuid.UUID]]', content)

with open(path, 'w') as f:
    f.write(content)

print("SUCCESS: Migrated hospital_id types to uuid.UUID in models.py.")
