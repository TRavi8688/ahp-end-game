import contextvars
import uuid
from typing import Optional

# GLOBAL CONTEXT FOR MULTI-TENANCY
# This ensures that even if a developer forgets to pass hospital_id, 
# the database layer can retrieve it implicitly from the current request context.
_current_hospital_id: contextvars.ContextVar[Optional[uuid.UUID]] = contextvars.ContextVar("current_hospital_id", default=None)

def set_current_hospital_id(hospital_id: Optional[uuid.UUID]):
    _current_hospital_id.set(hospital_id)

def get_current_hospital_id() -> Optional[uuid.UUID]:
    return _current_hospital_id.get()
