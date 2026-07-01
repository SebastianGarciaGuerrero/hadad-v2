"""
Modelo SQLAlchemy para 'roles' (catálogo).
Roles del sistema: admin, supervisor, operador, viewer.
"""

from sqlalchemy import Column, String, Text, Integer, TIMESTAMP, text
from app.database import Base


class Rol(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(50), nullable=False, unique=True)
    descripcion = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("NOW()"))

    def __repr__(self):
        return f"<Rol(id={self.id}, nombre='{self.nombre}')>"
