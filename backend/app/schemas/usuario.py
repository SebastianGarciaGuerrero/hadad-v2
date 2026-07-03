"""
Schemas Pydantic para Usuario.

REGLA INVIOLABLE: password_hash NUNCA se incluye en una respuesta. Por eso
UsuarioResponse no tiene ese campo; solo expone datos seguros.
"""

from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UsuarioCreate(BaseModel):
    """
    Datos para que el ADMIN cree un usuario nuevo del equipo.
    La contraseña llega en texto plano por HTTPS y se guarda hasheada.
    """
    nombre: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    rol_id: int


class UsuarioUpdate(BaseModel):
    """
    Cambios que el ADMIN puede hacer sobre un usuario.
    La contraseña NO va aquí: tiene sus propios endpoints.
    """
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    rol_id: Optional[int] = None
    activo: Optional[bool] = None  # desactivar = ya no puede entrar


class PasswordReset(BaseModel):
    """El ADMIN resetea la contraseña de otro usuario (que la olvidó)."""
    password_nueva: str = Field(..., min_length=8, max_length=72)


class CambiarPassword(BaseModel):
    """Un usuario cambia SU PROPIA contraseña (exige saber la actual)."""
    password_actual: str
    password_nueva: str = Field(..., min_length=8, max_length=72)


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
