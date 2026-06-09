"""
Configuración centralizada de la aplicación.
Lee las variables de entorno desde el archivo .env
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Configuración tipada de la aplicación.
    Pydantic valida automáticamente los tipos al leer el .env
    """
    
    # Base de datos
    database_url: str
    
    # Configuración general
    app_name: str = "Hadad 2.0 API"
    environment: str = "development"
    debug: bool = True
    
    # Configuración para leer el archivo .env
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


# Instancia única de configuración (singleton)
# Se importa desde cualquier parte del código con: from app.config import settings
settings = Settings()