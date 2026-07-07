"""
Endpoints de autenticación.

  POST /api/auth/login  → email + contraseña → devuelve un JWT
  GET  /api/auth/me     → devuelve el usuario dueño del token (protegido)

El login recibe form-data (username = email, password) para que funcione el
botón "Authorize" de /docs: pegas email y contraseña ahí y Swagger manda el
token en todas las llamadas siguientes.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auditoria import CLAVE_CONTEXTO

from app.database import get_db
from app.models.usuario import Usuario
from app.security import (
    verificar_password,
    hashear_password,
    crear_access_token,
    get_current_user,
)
from app.schemas.auth import Token
from app.schemas.usuario import UsuarioResponse, CambiarPassword


router = APIRouter(
    prefix="/api/auth",
    tags=["Autenticación"]
)


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Valida email + contraseña y devuelve un token de acceso (JWT)."""
    usuario = db.query(Usuario).filter(Usuario.email == form_data.username).first()

    # Mismo mensaje para "no existe" y "contraseña mala": no revelar cuál falló.
    if not usuario or not verificar_password(form_data.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )

    # Contexto para que la auditoría atribuya este cambio al propio usuario
    # (el login no pasa por get_current_user, que es quien suele fijarlo).
    db.info[CLAVE_CONTEXTO] = {
        "usuario_id": usuario.id,
        "ip": request.client.host if request.client else None,
    }

    # Registrar el último acceso.
    usuario.ultimo_acceso = datetime.now(timezone.utc)
    db.commit()

    token = crear_access_token({"sub": str(usuario.id), "rol_id": usuario.rol_id})
    return Token(access_token=token)


@router.get("/me", response_model=UsuarioResponse)
def leer_usuario_actual(usuario: Usuario = Depends(get_current_user)):
    """Devuelve los datos del usuario autenticado (requiere token)."""
    return usuario


@router.put("/cambiar-password", status_code=status.HTTP_204_NO_CONTENT)
def cambiar_mi_password(
    datos: CambiarPassword,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    El usuario autenticado cambia SU PROPIA contraseña.
    Exige la contraseña actual como confirmación (protege si alguien deja
    la sesión abierta y otro intenta secuestrar la cuenta).
    """
    if not verificar_password(datos.password_actual, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La contraseña actual no es correcta",
        )
    usuario.password_hash = hashear_password(datos.password_nueva)
    db.commit()
    return None
