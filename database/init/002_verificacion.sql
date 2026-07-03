-- ============================================================
-- Verificación post-setup
-- Este script corre automáticamente después del DDL.
-- Inserta un usuario admin de prueba para que puedas hacer login.
-- ============================================================

-- Crear usuario admin de prueba
-- Email: admin@hadad.cl
-- Password: hadad2026 (hasheado con bcrypt)
INSERT INTO usuarios (nombre, email, password_hash, rol_id)
VALUES (
    'Admin Hadad',
    'admin@hadad.cl',
    '$2b$12$s2tivBdS2GnMw/tmjXWasuPffWBrFzbUEUAzO.0jawW0dhoO3wCLW',
    (SELECT id FROM roles WHERE nombre = 'admin')
);

-- Crear cliente de prueba: Redsalud
INSERT INTO clientes (rut, razon_social, nombre_fantasia)
VALUES ('96570220-7', 'RED SALUD S.A.', 'Redsalud');

-- Crear las 9 filiales de Redsalud
INSERT INTO filiales (cliente_id, nombre)
SELECT id, filial
FROM clientes
CROSS JOIN (VALUES
    ('Iquique'), ('Elqui'), ('Valparaíso'),
    ('Rancagua'), ('Temuco'), ('Magallanes'),
    ('Santiago'), ('Providencia'), ('Vitacura')
) AS f(filial)
WHERE rut = '96570220-7';

-- Mensaje de éxito
DO $$
BEGIN
    RAISE NOTICE '✅ Base de datos Hadad 2.0 inicializada correctamente';
    RAISE NOTICE '   - 16 tablas creadas';
    RAISE NOTICE '   - 4 roles iniciales';
    RAISE NOTICE '   - 12 tipos de gestión';
    RAISE NOTICE '   - Usuario admin: admin@hadad.cl / hadad2026';
    RAISE NOTICE '   - Cliente prueba: Redsalud con 9 filiales';
END $$;
