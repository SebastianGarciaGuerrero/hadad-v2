"""
Schemas Pydantic para Usuario.

REGLA INVIOLABLE: password_hash NUNCA se incluye en una respuesta. Por eso
UsuarioResponse no tiene ese campo; solo expone datos seguros.
"""

from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class UsuarioResponse(BaseModel):
    """Datos seguros de un usuario para devolver por la API."""
    id: UUID
    nombre: str
    email: EmailStr
    rol_id: int
    activo: bool
    ultimo_acceso: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
