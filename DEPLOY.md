# Cómo publicar la demo de Hadad 2.0 (gratis)

Arquitectura: **una sola URL** — el backend FastAPI sirve también el frontend
compilado (por eso no usamos Vercel: acá hay Python + PostgreSQL, no solo
archivos estáticos).

- **Render** (plan gratuito) → corre la aplicación (Docker).
- **Neon** (plan gratuito) → la base de datos PostgreSQL.

> Nota del plan gratuito de Render: el servicio "se duerme" tras ~15 min sin
> visitas y la primera visita después tarda ~1 minuto en despertar. Para una
> demo está perfecto.

## Paso 1 — Base de datos en Neon (5 min)

1. Crear cuenta en https://neon.tech (con Google o GitHub).
2. Crear un proyecto (nombre: `hadad-demo`, región: São Paulo o US East).
3. Copiar la **connection string** que te muestra (algo como
   `postgresql://usuario:clave@ep-xxxx.aws.neon.tech/neondb?sslmode=require`).

## Paso 2 — Cargar el esquema y los datos de práctica (2 min)

Desde tu PC, en la carpeta `backend` con el venv activo:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python scripts/init_db_produccion.py "postgresql://...la URL de Neon..."
```

Eso crea las 16 tablas, las vistas, los datos de práctica (Redsalud, Pedro
González, cobranzas de ejemplo) y los usuarios:

| Email | Contraseña | Rol |
|---|---|---|
| admin@hadad.cl | hadad2026 | admin |
| sgg@hadad.cl | sebastian | admin |
| grv@hadad.cl | giselle | operadora |

## Paso 3 — Aplicación en Render (10 min)

1. Crear cuenta en https://render.com (entrar con GitHub).
2. **New → Blueprint** y elegir el repo `hadad-v2` (Render pide permiso para
   ver tus repos privados). Render lee el `render.yaml` del repo y propone el
   servicio ya configurado.
3. Cuando pida `DATABASE_URL`, pegar la URL de Neon del Paso 1.
4. Deploy. La primera compilación tarda unos minutos (construye el frontend
   y la imagen de Python).
5. Al terminar tendrás una URL tipo `https://hadad-v2.onrender.com` —
   esa es la que le mandas a Giselle. 🎉

## Actualizar la demo

Cada `git push` a `main` redespliega solo (Render vigila el repo).

## Si algo falla

- **La página carga pero el login falla** → revisa que `DATABASE_URL` esté
  bien pegada en Render (Environment) y que el Paso 2 se haya ejecutado.
- **"Application failed to respond"** → mira los Logs del servicio en Render.
- La API interactiva queda en `https://tu-url.onrender.com/docs`.

## Importante

- Los datos de la demo son de práctica (ficticios). **No cargar datos
  reales de deudores en la demo pública** — eso queda para el despliegue
  definitivo (VPS con HTTPS propio, Hito 5).
- Las contraseñas de demo son débiles a propósito; en producción real se
  cambian.
