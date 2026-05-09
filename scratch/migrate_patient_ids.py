import re

path = 'app/models/models.py'
with open(path, 'r') as f:
    content = f.read()

# Pattern for Patient ID migration
content = re.sub(r'class Patient\(Base, TenantScopedMixin, VersionedMixin, AuditableMixin\):\n    __tablename__ = "patients"\n    \n    id: Mapped\[int\] = mapped_column\(primary_key=True, index=True\)', 
                 'class Patient(Base, TenantScopedMixin, VersionedMixin, AuditableMixin):\n    __tablename__ = "patients"\n    \n    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)', content)

# Pattern for Department ID migration
content = re.sub(r'class Department\(Base\):\n    __tablename__ = "departments"\n    \n    id: Mapped\[int\] = mapped_column\(primary_key=True, index=True\)', 
                 'class Department(Base):\n    __tablename__ = "departments"\n    \n    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)', content)

# Update ForeignKeys to Patient and Department
content = re.sub(r'patient_id: Mapped\[int\]', 'patient_id: Mapped[uuid.UUID]', content)
content = re.sub(r'department_id: Mapped\[int\]', 'department_id: Mapped[uuid.UUID]', content)

with open(path, 'w') as f:
    f.write(content)

print("SUCCESS: Migrated Patient and Department IDs to uuid.UUID.")
