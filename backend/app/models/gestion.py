"""
Modelos SQLAlchemy para 'tipos_gestion' (catálogo) y 'gestiones' (historial).

*** Las gestiones son el CORAZÓN del sistema y son INMUTABLES ***
  - No tienen updated_at.
  - No hay endpoint PUT ni DELETE.
  - Un error se corrige agregando una gestión correctiva nueva, nunca editando.
  - Esto protege la integridad del historial legal.
"""

from sqlalchemy import (
    Column, String, Boolean, Text, Integer, Date, TIMESTAMP,
    ForeignKey, text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class TipoGestion(Base):
    """
    Catálogo de tipos para clasificar y filtrar gestiones.
    Ej: 'Llamada telefónica', 'Email enviado', 'Acuerdo de pago'.
    Usa id SERIAL (entero), no UUID, por ser catálogo chico.
    """

    __tablename__ = "tipos_gestion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False, unique=True)
    activo = Column(Boolean, server_default=text("true"))

    def __repr__(self):
        return f"<TipoGestion(id={self.id}, nombre='{self.nombre}')>"


class Gestion(Base):
    """
    Cada acción realizada con el deudor sobre una cobranza concreta.
    INMUTABLE por diseño: sin updated_at.
    """

    __tablename__ = "gestiones"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )
    # ON DELETE RESTRICT: no se puede borrar una cobranza que tenga gestiones.
    cobranza_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cobranzas.id", ondelete="RESTRICT"),
        nullable=False
    )
    # usuario_id es obligatorio. Mientras no exista auth JWT, el cliente lo
    # envía explícitamente; luego saldrá del token del usuario autenticado.
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    fecha_gestion = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()"))
    tipo_id = Column(Integer, ForeignKey("tipos_gestion.id"))
    descripcion = Column(Text, nullable=False)
    fecha_proximo_contacto = Column(Date)
    # Marca las gestiones cargadas en bloque (carga masiva de gestiones), para
    # distinguirlas de las registradas una a una. Se muestra como "(masivo)".
    es_masivo = Column(Boolean, nullable=False, server_default=text("false"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("NOW()"))
    # SIN updated_at → INMUTABLE

    # Relaciones de navegación.
    tipo = relationship("TipoGestion")
    usuario = relationship("Usuario")
    # cobranza.gestiones devuelve el historial completo de esa cobranza.
    cobranza = relationship("Cobranza", backref="gestiones")

    @property
    def usuario_nombre(self):
        """Nombre de quien registró la gestión (para mostrar en el historial)."""
        return self.usuario.nombre if self.usuario else None

    def __repr__(self):
        return f"<Gestion(cobranza_id={self.cobranza_id}, fecha={self.fecha_gestion})>"
