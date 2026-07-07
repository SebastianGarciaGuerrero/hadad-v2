"""
Endpoint de consulta del audit log — SOLO ADMIN, SOLO LECTURA.

  GET /api/auditoria → lista de cambios, filtrable por tabla, registro,
      usuario y acción. Sin POST/PUT/DELETE: el log lo escribe únicamente
      la auditoría automática (app/auditoria.py) y nunca se modifica.

Uso típico: "¿quién cambió el estado de la cobranza X y cuándo?"
→ GET /api/auditoria?tabla=cobranzas&registro_id=<uuid>
"""

from uuid import UUID
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import require_admin
from app.models.audit import AuditLog


router = APIRouter(
    prefix="/api/auditoria",
    tags=["Auditoría (admin)"],
    dependencies=[Depends(require_admin)],
)


class AuditResponse(BaseModel):
    id: UUID
    usuario_id: Optional[UUID] = None
    accion: str
    tabla: str
    registro_id: str
    datos_anteriores: Optional[dict] = None
    datos_nuevos: Optional[dict] = None
    ip_origen: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.get("/", response_model=List[AuditResponse])
def consultar_auditoria(
    tabla: Optional[str] = Query(None, description="Filtrar por tabla (ej. cobranzas)"),
    registro_id: Optional[str] = Query(None, description="ID del registro afectado"),
    usuario_id: Optional[UUID] = Query(None, description="Quién hizo el cambio"),
    accion: Optional[str] = Query(None, description="INSERT / UPDATE / DELETE"),
    skip: int = 0,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    """Consulta el historial de cambios, del más reciente al más antiguo."""
    query = db.query(AuditLog)
    if tabla is not None:
        query = query.filter(AuditLog.tabla == tabla)
    if registro_id is not None:
        query = query.filter(AuditLog.registro_id == registro_id)
    if usuario_id is not None:
        query = query.filter(AuditLog.usuario_id == usuario_id)
    if accion is not None:
        query = query.filter(AuditLog.accion == accion.upper())
    return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
