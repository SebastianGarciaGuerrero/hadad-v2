"""
Configuración de la conexión a PostgreSQL usando SQLAlchemy.
Maneja sesiones, conexiones y la base declarativa para modelos.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from app.config import settings


# El "engine" es el objeto que mantiene el pool de conexiones a la DB.
# Lo creamos una sola vez al iniciar la app.
engine = create_engine(
    settings.database_url,
    # pool_pre_ping verifica que la conexión esté viva antes de usarla.
    # Evita errores cuando la DB se reinicia o pasa mucho tiempo sin uso.
    pool_pre_ping=True,
    # echo=True imprime cada query SQL en la consola (útil para aprender)
    echo=settings.debug
)


# SessionLocal es la "fábrica" de sesiones.
# Cada petición HTTP creará su propia sesión y la cerrará al terminar.
SessionLocal = sessionmaker(
    autocommit=False,   # Los cambios no se guardan hasta hacer session.commit()
    autoflush=False,
    bind=engine
)


# Base es la clase padre de la que heredarán todos los modelos (tablas).
# Cuando definamos un modelo en models/cliente.py, heredará de Base.
Base = declarative_base()


def get_db():
    """
    Dependencia de FastAPI: provee una sesión de base de datos por petición.
    
    Uso en un endpoint:
        @app.get("/clientes")
        def listar_clientes(db: Session = Depends(get_db)):
            return db.query(Cliente).all()
    
    Yield + try/finally asegura que la sesión SIEMPRE se cierra,
    incluso si la query falla. Esto evita fugas de conexiones.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()