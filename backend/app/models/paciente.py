"""
Modelo SQLAlchemy para 'pacientes' (quien recibió la atención médica).

Módulo diferido: en cobranza extrajudicial solo importa el deudor. El modelo
se define ahora para que la FK cobranzas.paciente_id resuelva su tabla destino.
El router/schema completos se construirán al abordar la parte judicial.
"""

from sqlalchemy import Column, String, Text, Date, TIMESTAMP, text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Paciente(Base):
    __tablename__ = "pacientes"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )
    rut = Column(String(12), nullable=False, unique=True)
    nombre = Column(String(200), nullable=False)
    fecha_nacimiento = Column(Date)
    direccion = Column(Text)
    departamento = Column(String(50))
    comuna = Column(String(100))
    ciudad = Column(String(100))
    region = Column(String(100))
    observaciones = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("NOW()"))

    def __repr__(self):
        return f"<Paciente(rut={self.rut}, nombre='{self.nombre}')>"
