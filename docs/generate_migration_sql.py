import csv

# Read the minimal pairs CSV
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-migration-pairs.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    pairs = list(reader)

print(f"Total pairs: {len(pairs)}")

# Build VALUES clause
values_lines = []
for row in pairs:
    ri_id = row['recipe_ingredient_id']
    ing_id = row['ingredient_id_candidate']
    values_lines.append(f"    ('{ri_id}'::UUID, '{ing_id}'::UUID)")

values_clause = ',\n'.join(values_lines)

# Generate migration SQL
migration_sql = f"""-- ============================================================
-- MIGRACIÓN WAVE 1: Vinculación de integridad referencial
-- Fase 4.4.5.B — EXACT_MATCH (881 registros)
-- ============================================================
-- EJECUTAR CON SERVICE ROLE KEY (bypass RLS)
-- NO EJECUTAR SIN REVISIÓN Y AUTORIZACIÓN EXPRESA
-- ============================================================

-- Esta migración actualiza SOLO los 881 registros clasificados como
-- EXACT_MATCH / WAVE_1_AUTO en phase4.4.5a1-final-mapping.csv
-- Los 119 registros restantes (WAVE 2/3/4) permanecen con ingredient_id = NULL

BEGIN;

-- ============================================================
-- 1. VERIFICACIÓN PREVIA DENTRO DE LA TRANSACCIÓN
-- ============================================================

-- 1.1 Confirmar que todos los 881 recipe_ingredient_id existen y están activos
DO $$
DECLARE
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, ing_id)
    LEFT JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.id IS NULL OR NOT ri.is_active;

    IF missing_count > 0 THEN
        RAISE EXCEPTION 'PRECHECK FAILED: % recipe_ingredient_id no existen o no están activos', missing_count;
    END IF;
    RAISE NOTICE 'PRECHECK OK: Todos los 881 recipe_ingredient_id existen y están activos';
END $$;

-- 1.2 Confirmar que todos los 153 ingredient_id candidatos existen en ingredients y están activos
DO $$
DECLARE
    missing_ing INTEGER;
BEGIN
    SELECT COUNT(DISTINCT v.ing_id) INTO missing_ing
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, ing_id)
    LEFT JOIN ingredients i ON v.ing_id = i.id
    WHERE i.id IS NULL OR NOT i.is_active;

    IF missing_ing > 0 THEN
        RAISE EXCEPTION 'PRECHECK FAILED: % ingredient_id candidatos no existen o no están activos en ingredients', missing_ing;
    END IF;
    RAISE NOTICE 'PRECHECK OK: Todos los % ingredient_id candidatos existen y están activos', (SELECT COUNT(DISTINCT ing_id) FROM (VALUES
{values_clause}
    ) AS v(ri_id, ing_id));
END $$;

-- 1.3 Confirmar que ninguno de los 881 ya tiene ingredient_id (deben ser todos NULL)
DO $$
DECLARE
    already_linked INTEGER;
BEGIN
    SELECT COUNT(*) INTO already_linked
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id IS NOT NULL;

    IF already_linked > 0 THEN
        RAISE EXCEPTION 'PRECHECK FAILED: % registros ya tienen ingredient_id (no son NULL)', already_linked;
    END IF;
    RAISE NOTICE 'PRECHECK OK: Todos los 881 registros tienen ingredient_id = NULL';
END $$;

-- ============================================================
-- 2. ACTUALIZACIÓN MASIVA (UPDATE con JOIN a VALUES)
-- ============================================================

UPDATE recipe_ingredients ri
SET ingredient_id = v.ing_id
FROM (VALUES
{values_clause}
) AS v(ri_id, ing_id)
WHERE ri.id = v.ri_id
  AND ri.ingredient_id IS NULL;  -- Seguridad: solo actualizar NULLs

-- ============================================================
-- 3. VERIFICACIÓN POST-UPDATE DENTRO DE LA TRANSACCIÓN
-- ============================================================

DO $$
DECLARE
    updated_count INTEGER;
    still_null_count INTEGER;
    orphan_count INTEGER;
BEGIN
    -- 3.1 Contar registros actualizados
    SELECT COUNT(*) INTO updated_count
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id = v.ing_id;

    IF updated_count <> 881 THEN
        RAISE EXCEPTION 'POSTCHECK FAILED: Se actualizaron % registros, se esperaban 881', updated_count;
    END IF;
    RAISE NOTICE 'POSTCHECK OK: % registros actualizados correctamente', updated_count;

    -- 3.2 Verificar que no quedaron NULL entre los 881
    SELECT COUNT(*) INTO still_null_count
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id IS NULL;

    IF still_null_count > 0 THEN
        RAISE EXCEPTION 'POSTCHECK FAILED: % registros siguen con NULL', still_null_count;
    END IF;
    RAISE NOTICE 'POSTCHECK OK: 0 registros con NULL entre los 881';

    -- 3.3 Verificar que todas las FK apuntan a ingredients existentes (no huérfanos)
    SELECT COUNT(*) INTO orphan_count
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    LEFT JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE i.id IS NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'POSTCHECK FAILED: % referencias huérfanas (ingredient_id no existe en ingredients)', orphan_count;
    END IF;
    RAISE NOTICE 'POSTCHECK OK: 0 referencias huérfanas';

    -- 3.4 Verificar que los 119 pendientes siguen NULL
    DECLARE
        pending_null_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO pending_null_count
        FROM recipe_ingredients
        WHERE is_active
          AND ingredient_id IS NULL
          AND id NOT IN (SELECT ri_id FROM (VALUES
{values_clause}
        ) AS v(ri_id, ing_id));

        -- Debería ser 119 (1000 total - 881 wave1)
        IF pending_null_count <> 119 THEN
            RAISE WARNING 'POSTCHECK WARNING: Registros pendientes NULL = %, se esperaban 119', pending_null_count;
        ELSE
            RAISE NOTICE 'POSTCHECK OK: % registros pendientes siguen NULL (correcto)', pending_null_count;
        END IF;
    END;
END $$;

-- ============================================================
-- 4. CONFIRMACIÓN FINAL
-- ============================================================

-- Si llegamos aquí, todo OK
COMMIT;

-- ============================================================
-- RESUMEN ESPERADO TRAS COMMIT:
-- - 881 recipe_ingredients ahora tienen ingredient_id vinculado
-- - 119 recipe_ingredients mantienen ingredient_id = NULL
-- - Todas las FK apuntan a ingredients existentes y activos
-- - No se modificó ningún otro campo
-- - No se alteró esquema (FK, índices ya existían)
-- ============================================================
"""

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-migration.sql', 'w', encoding='utf-8') as f:
    f.write(migration_sql)

print(f"Migration SQL written ({len(migration_sql):,} bytes)")