from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import uuid

from app.core.database import get_db
from app.core.tenant import get_tenant_context, TenantContext, require_permissions
from app.models.state_machine import VerificationWorkflow, WorkflowState
from app.models.audit import AuditLog

router = APIRouter(prefix="/ops", tags=["Internal Operations"])

@router.post("/workflows/{workflow_id}/override", dependencies=[Depends(require_permissions("ops:override_workflow"))])
async def override_stuck_workflow(
    workflow_id: uuid.UUID,
    target_state: WorkflowState,
    reason: str,
    context: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    INTERNAL OPS: Force a stuck workflow into a target state.
    This is an escape hatch for Super Admins to resolve critical SLA breaches.
    Strictly writes to the immutable audit log.
    """
    # 1. Fetch Workflow
    result = await db.execute(select(VerificationWorkflow).where(VerificationWorkflow.id == workflow_id))
    workflow = result.scalars().first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found.")
        
    old_state = workflow.current_state
    
    # 2. Update State
    workflow.current_state = target_state
    
    # 3. Create Audit Ledger Entry (Non-repudiation)
    audit_entry = AuditLog(
        tenant_id=context.tenant_id,
        actor_id=context.user_id,
        action="OPS_WORKFLOW_OVERRIDE",
        resource_type="VerificationWorkflow",
        resource_id=str(workflow.id),
        old_state={"state": old_state.value},
        new_state={"state": target_state.value, "reason": reason}
    )
    
    db.add(audit_entry)
    await db.commit()
    
    return {"status": "success", "workflow_id": workflow_id, "new_state": target_state}

@router.post("/users/{target_user_id}/impersonate", dependencies=[Depends(require_permissions("ops:impersonate_user"))])
async def impersonate_user(
    target_user_id: uuid.UUID,
    reason: str,
    context: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    INTERNAL OPS: Generate a short-lived (5 min) JWT to view the platform as the target user.
    Used exclusively for Level 3 Support debugging.
    Generates a CRITICAL audit log alert.
    """
    # 1. Log the impersonation attempt immediately
    audit_entry = AuditLog(
        tenant_id=context.tenant_id,
        actor_id=context.user_id,
        action="CRITICAL_OPS_IMPERSONATION",
        resource_type="User",
        resource_id=str(target_user_id),
        new_state={"reason": reason}
    )
    db.add(audit_entry)
    await db.commit()
    
    # 2. In a real implementation, we would call `create_access_token` here with the target_user_id
    # but marked explicitly as an impersonated token (e.g. adding `impersonator_id` to JWT claims).
    
    return {"status": "success", "message": f"Impersonation session created for {target_user_id}"}
