"""
Utilidades de seguridad: hashing de contraseñas y JSON Web Tokens (JWT).

Flujo de autenticación:
  1. El usuario manda email + contraseña a POST /api/auth/login.
  2. Verificamos la contraseña contra el hash bcrypt guardado en la DB.
  3. Si coincide, firmamos un JWT con su id y se lo devolvemos.
  4. En cada petición protegida, el cliente manda ese token en el header
     `Authorization: Bearer <token>`. get_current_user lo valida y devuelve
     el Usuario dueño del token.

La contraseña en texto plano NUNCA se guarda: solo su hash bcrypt.
"""

from uuid import UUID
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.usuario import Usuario
from app.auditoria import CLAVE_CONTEXTO


# Usamos la librería bcrypt directamente (passlib 1.7.4 no es compatible con
# bcrypt 5.x). bcrypt es lento a propósito: resiste ataques de fuerza bruta.

# Le dice a FastAPI de dónde sacar el token y habilita el botón "Authorize"
# en /docs. tokenUrl apunta al endpoint de login.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def _a_bytes(password: str) -> bytes:
    """
    bcrypt solo considera los primeros 72 bytes y las versiones nuevas dan
    error si se pasa de ahí, así que truncamos explícitamente.
    """
    return password.encode("utf-8")[:72]


def verificar_password(plano: str, hasheado: str) -> bool:
    """Compara una contraseña en texto plano contra su hash bcrypt."""
    try:
        return bcrypt.checkpw(_a_bytes(plano), hasheado.encode("utf-8"))
    except ValueError:
        return False  # hash mal formado


def hashear_password(plano: str) -> str:
    """Genera el hash bcrypt de una contraseña (para crear/cambiar usuarios)."""
    return bcrypt.hashpw(_a_bytes(plano), bcrypt.gensalt()).decode("utf-8")


def crear_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Firma un JWT con los datos dados y una fecha de expiración."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    """
    Dependencia para endpoints protegidos: valida el token del header
    Authorization y devuelve el Usuario correspondiente.
    Además deja registrado en el contexto de auditoría quién es el usuario
    de esta petición y desde qué IP llegó (lo usa app/auditoria.py).
    Uso en un endpoint:
        def algo(usuario: Usuario = Depends(get_current_user)): ...
    """
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar el token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        sub = payload.get("sub")
        if sub is None:
            raise cred_exc
        usuario_id = UUID(sub)  # 'sub' viaja como string; lo volvemos UUID
    except (JWTError, ValueError):
        raise cred_exc

    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if usuario is None:
        raise cred_exc
    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )

    # Contexto para la auditoría automática de esta petición. Va en
    # session.info porque la sesión es el mismo objeto compartido con el
    # endpoint (un ContextVar se perdería entre threads de FastAPI).
    db.info[CLAVE_CONTEXTO] = {
        "usuario_id": usuario.id,
        "ip": request.client.host if request.client else None,
    }
    return usuario


METODOS_ESCRITURA = {"POST", "PUT", "PATCH", "DELETE"}


def usuario_autorizado(
    request: Request,
    usuario: Usuario = Depends(get_current_user),
) -> Usuario:
    """
    Dependencia estándar de los módulos de negocio: exige token válido y
    aplica la regla de roles: el rol 'viewer' es de SOLO LECTURA (solo GET).
    admin, supervisor y operador pueden escribir.
    """
    if (
        request.method in METODOS_ESCRITURA
        and usuario.rol is not None
        and usuario.rol.nombre == "viewer"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El rol 'viewer' es de solo lectura: no puede crear ni modificar registros",
        )
    return usuario


def require_admin(usuario: Usuario = Depends(get_current_user)) -> Usuario:
    """
    Dependencia para endpoints SOLO-ADMIN (ej. gestión de usuarios).
    Se apoya en get_current_user y además exige rol 'admin'.
    Uso: def algo(admin: Usuario = Depends(require_admin)): ...
    """
    if usuario.rol is None or usuario.rol.nombre != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador para esta operación",
        )
    return usuario
