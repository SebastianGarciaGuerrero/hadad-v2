"""
Schemas Pydantic para la ficha judicial de una cobranza.

A diferencia de gestiones/pagos, la ficha judicial SÍ se edita: el estado
del proceso cambia con el tiempo (notificación, embargo, sentencia...).
"""

from uuid import UUID
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class JudicialBase(BaseModel):
    """Campos editables de la ficha judicial."""
    numero_rol: Optional[str] = Field(None, max_length=50, examples=["C-1234-2026"])
    tribunal: Optional[str] = Field(None, max_length=200)
    fecha_ingreso: Optional[date] = None
    estado_proceso: Optional[str] = Field(None, max_length=100)
    abogado_id: Optional[UUID] = None
    observaciones: Optional[str] = None


class JudicialCreate(JudicialBase):
    """
    Crea la ficha judicial de una cobranza (una sola por cobranza).
    Al crearla, la cobranza pasa a estado 'judicial' y tipo 'judicial'.
    """
    cobranza_id: UUID


class JudicialUpdate(JudicialBase):
    """Actualiza la ficha (el proceso avanza). cobranza_id no se cambia."""
    pass


class JudicialResponse(JudicialBase):
    """Ficha judicial tal como se devuelve."""
    id: UUID
    cobranza_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
