"""
Endpoints de gestión de usuarios — SOLO ADMIN.

Modelo de aprovisionamiento interno: no hay registro público. El admin crea
las cuentas del equipo, asigna roles y resetea contraseñas.

  GET  /api/usuarios                → listar el equipo
  GET  /api/usuarios/roles          → catálogo de roles (para el select)
  GET  /api/usuarios/{id}           → obtener uno
  POST /api/usuarios                → crear usuario (con contraseña inicial)
  PUT  /api/usuarios/{id}           → editar (nombre, email, rol, activo)
  PUT  /api/usuarios/{id}/password  → resetear contraseña de otro usuario

No hay DELETE: un usuario se desactiva (activo=False) y no puede entrar más,
pero su historial (gestiones, pagos que registró) queda intacto.
"""

from uuid import UUID
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.usuario import Usuario
from app.models.rol import Rol
from app.security import require_admin, hashear_password
from app.schemas.usuario import (
    UsuarioCreate,
    UsuarioUpdate,
    UsuarioResponse,
    PasswordReset,
)


router = APIRouter(
    prefix="/api/usuarios",
    tags=["Usuarios (admin)"]
)


class RolResponse(BaseModel):
    """Un rol del catálogo (para poblar el select al crear usuarios)."""
    id: int
    nombre: str
    descripcion: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


@router.get("/roles", response_model=List[RolResponse])
def listar_roles(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    """Catálogo de roles (admin, supervisor, operador, viewer)."""
    return db.query(Rol).order_by(Rol.id).all()


@router.get("/", response_model=List[UsuarioResponse])
def listar_usuarios(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    """Lista todo el equipo (activos e inactivos)."""
    return db.query(Usuario).order_by(Usuario.nombre).all()


@router.get("/{usuario_id}", response_model=UsuarioResponse)
def obtener_usuario(
    usuario_id: UUID,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    """Obtiene un usuario por su UUID."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con id {usuario_id} no encontrado"
        )
    return usuario


@router.post("/", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    datos: UsuarioCreate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    """Crea un usuario del equipo con su contraseña inicial (hasheada)."""
    nuevo = Usuario(
        nombre=datos.nombre,
        email=datos.email,
        password_hash=hashear_password(datos.password),
        rol_id=datos.rol_id,
    )
    try:
        db.add(nuevo)
        db.commit()
        db.refresh(nuevo)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email ya registrado o rol_id inexistente."
        )
    return nuevo


@router.put("/{usuario_id}", response_model=UsuarioResponse)
def actualizar_usuario(
    usuario_id: UUID,
    datos: UsuarioUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    """Edita nombre, email, rol o estado activo de un usuario."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con id {usuario_id} no encontrado"
        )

    cambios = datos.model_dump(exclude_unset=True)

    # Protección: el admin no puede desactivarse a sí mismo (quedaría
    # el sistema sin nadie que pueda administrar).
    if usuario.id == admin.id and cambios.get("activo") is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar tu propia cuenta."
        )

    for campo, valor in cambios.items():
        setattr(usuario, campo, valor)

    try:
        db.commit()
        db.refresh(usuario)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email ya registrado o rol_id inexistente."
        )
    return usuario


@router.put("/{usuario_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def resetear_password(
    usuario_id: UUID,
    datos: PasswordReset,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    """
    El admin resetea la contraseña de un usuario (típico: la olvidó y se la
    pide en persona). Para cambiar la propia, usar /api/auth/cambiar-password.
    """
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con id {usuario_id} no encontrado"
        )
    usuario.password_hash = hashear_password(datos.password_nueva)
    db.commit()
    return None
