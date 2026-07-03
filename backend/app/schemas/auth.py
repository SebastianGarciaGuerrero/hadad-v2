"""
Schemas Pydantic para autenticación.

El login usa OAuth2PasswordRequestForm (form-data: username + password), que
es lo que espera el botón "Authorize" de /docs. Por eso no hay un schema de
entrada aquí: solo el de salida (el token).
"""

from pydantic import BaseModel


class Token(BaseModel):
    """Lo que devuelve POST /api/auth/login."""
    access_token: str
    token_type: str = "bearer"
