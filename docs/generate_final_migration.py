import csv

# Read the minimal pairs CSV
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-migration-pairs.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    pairs = list(reader)

print(f"Total pairs: {len(pairs)}")

# Build VALUES clause (881 lines)
values_lines = []
for row in pairs:
    ri_id = row['recipe_ingredient_id']
    ing_id = row['ingredient_id_candidate']
    values_lines.append(f"    ('{ri_id}'::UUID, '{ing_id}'::UUID)")

values_clause = ',\n'.join(values_lines)

# Generate migration SQL with ACTUAL pairs in every VALUES block
migration_sql = f"""-- ============================================================
-- MIGRACIÓN WAVE 1: Vinculación de integridad referencial
-- Fase 4.4.5.B.1 — EXACT_MATCH (881 registros)
-- ============================================================
-- EJECUTAR CON SERVICE ROLE KEY (bypass RLS)
-- NO EJECUTAR SIN REVISIÓN Y AUTORIZACIÓN EXPRESA
-- ============================================================

-- Esta migración actualiza SOLO los 881 registros clasificados como
-- EXACT_MATCH / WAVE_1_AUTO en phase4.4.5a1-final-mapping.csv
-- Los 119 registros restantes (WAVE 2/3/4) permanecen con ingredient_id = NULL

-- ------------------------------------------------------------
-- COMPORTAMIENTO IDEMPOTENTE:
-- ------------------------------------------------------------
-- PRIMERA EJECUCIÓN (estado inicial: 881 NULL, 119 NULL):
--   - Prechecks pasan (881 RI existen, 153 ingredients existen, 881 NULL)
--   - UPDATE aplica 881 vínculos
--   - Postchecks pasan (881 vinculados, 0 NULL en WAVE 1, 0 huérfanos, 119 pendientes NULL)
--   - COMMIT
--
-- SEGUNDA EJECUCIÓN (estado: 881 ya vinculados correctamente, 119 NULL):
--   - Precheck 1.1: pasa (881 RI existen y activos)
--   - Precheck 1.2: pasa (153 ingredients existen y activos)
--   - Precheck 1.3: FALLA - detecta 881 registros YA vinculados (no NULL)
--   - RAISE EXCEPTION -> ROLLBACK automático
--   - NO se ejecuta UPDATE, NO se modifican datos
--   - Resultado: Estado inalterado, error informativo
--
-- EJECUCIÓN CON ESTADO PARCIAL (p.ej. 400/881 vinculados por fallo previo):
--   - Precheck 1.1: pasa
--   - Precheck 1.2: pasa
--   - Precheck 1.3: FALLA - detecta 400 ya vinculados
--   - RAISE EXCEPTION -> ROLLBACK
--   - NO continúa. Requiere rollback manual o investigación.
--
-- EJECUCIÓN CON MODIFICACIONES POSTERIORES (algunos ingredient_id cambiados):
--   - Precheck 1.3: FALLA - detecta registros con ingredient_id NOT NULL
--   - RAISE EXCEPTION -> ROLLBACK
--   - NO sobrescribe relaciones diferentes.
--
-- ------------------------------------------------------------

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
        RAISE EXCEPTION 'PRECHECK 1.1 FALLÓ: % recipe_ingredient_id no existen o no están activos', missing_count;
    END IF;
    RAISE NOTICE 'PRECHECK 1.1 OK: Todos los 881 recipe_ingredient_id existen y están activos';
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
        RAISE EXCEPTION 'PRECHECK 1.2 FALLÓ: % ingredient_id candidatos no existen o no están activos en ingredients', missing_ing;
    END IF;
    RAISE NOTICE 'PRECHECK 1.2 OK: Todos los % ingredient_id candidatos existen y están activos', 
        (SELECT COUNT(DISTINCT ing_id) FROM (VALUES
{values_clause}
    ) AS v(ri_id, ing_id));
END $$;

-- 1.3 Confirmar que NINGUNO de los 881 ya tiene ingredient_id (deben ser TODOS NULL)
-- ESTE CHECK GARANTIZA IDEMPOTENCIA: falla si ya se ejecutó la migración
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
        RAISE EXCEPTION 'PRECHECK 1.3 FALLÓ (IDEMPOTENCIA): % de 881 registros ya tienen ingredient_id NOT NULL. '
            'La migración ya se ejecutó o hubo modificación externa. '
            'No se sobrescribirán relaciones existentes. Ejecute rollback si desea revertir.', 
            already_linked;
    END IF;
    RAISE NOTICE 'PRECHECK 1.3 OK: Todos los 881 registros tienen ingredient_id = NULL (primera ejecución)';
END $$;

-- ============================================================
-- 2. ACTUALIZACIÓN MASIVA (UPDATE con JOIN a VALUES)
-- ============================================================
-- Solo actualiza registros donde ingredient_id IS NULL (seguridad adicional)

UPDATE recipe_ingredients ri
SET ingredient_id = v.ing_id
FROM (VALUES
{values_clause}
) AS v(ri_id, ing_id)
WHERE ri.id = v.ri_id
  AND ri.ingredient_id IS NULL;  -- Doble seguridad: solo NULLs

-- ============================================================
-- 3. VERIFICACIÓN POST-UPDATE DENTRO DE LA TRANSACCIÓN
-- ============================================================

DO $$
DECLARE
    updated_count INTEGER;
    still_null_count INTEGER;
    orphan_count INTEGER;
    pending_null_count INTEGER;
BEGIN
    -- 3.1 Contar registros actualizados (deben ser exactamente 881)
    SELECT COUNT(*) INTO updated_count
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id = v.ing_id;

    IF updated_count <> 881 THEN
        RAISE EXCEPTION 'POSTCHECK 3.1 FALLÓ: Se actualizaron % registros, se esperaban 881. '
            'Posible estado parcial o fallo en UPDATE.', updated_count;
    END IF;
    RAISE NOTICE 'POSTCHECK 3.1 OK: % registros actualizados correctamente', updated_count;

    -- 3.2 Verificar que NO quedaron NULL entre los 881
    SELECT COUNT(*) INTO still_null_count
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id IS NULL;

    IF still_null_count > 0 THEN
        RAISE EXCEPTION 'POSTCHECK 3.2 FALLÓ: % registros de WAVE 1 siguen con NULL', still_null_count;
    END IF;
    RAISE NOTICE 'POSTCHECK 3.2 OK: 0 registros con NULL entre los 881 WAVE 1';

    -- 3.3 Verificar que todas las FK apuntan a ingredients existentes (no huérfanos)
    SELECT COUNT(*) INTO orphan_count
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    LEFT JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE i.id IS NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'POSTCHECK 3.3 FALLÓ: % referencias huérfanas (ingredient_id no existe en ingredients)', orphan_count;
    END IF;
    RAISE NOTICE 'POSTCHECK 3.3 OK: 0 referencias huérfanas';

    -- 3.4 Verificar que los 119 pendientes SIGUEN NULL (no fueron tocados)
    SELECT COUNT(*) INTO pending_null_count
    FROM recipe_ingredients
    WHERE is_active
      AND ingredient_id IS NULL
      AND id NOT IN (SELECT ri_id FROM (VALUES
{values_clause}
    ) AS v(ri_id, ing_id));

    -- Debe ser exactamente 119 (1000 total - 881 wave1)
    IF pending_null_count <> 119 THEN
        RAISE EXCEPTION 'POSTCHECK 3.4 FALLÓ: Registros pendientes NULL = %, se esperaban 119. '
            'Algún registro ajeno a WAVE 1 fue modificado.', pending_null_count;
    END IF;
    RAISE NOTICE 'POSTCHECK 3.4 OK: % registros pendientes siguen NULL (correcto)', pending_null_count;

    -- 3.5 Verificar que NINGÚN registro ajeno a WAVE 1 fue vinculado
    DECLARE
        non_wave1_linked INTEGER;
    BEGIN
        SELECT COUNT(*) INTO non_wave1_linked
        FROM recipe_ingredients ri
        WHERE ri.is_active
          AND ri.ingredient_id IS NOT NULL
          AND ri.id NOT IN (SELECT ri_id FROM (VALUES
{values_clause}
    ) AS v(ri_id, ing_id));

        IF non_wave1_linked > 0 THEN
            RAISE EXCEPTION 'POSTCHECK 3.5 FALLÓ: % registros ajenos a WAVE 1 fueron vinculados', non_wave1_linked;
        END IF;
        RAISE NOTICE 'POSTCHECK 3.5 OK: 0 registros ajenos a WAVE 1 modificados';
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
-- - RLS policies intactas
-- ============================================================

-- ============================================================
-- INSTRUCCIONES PARA USO:
-- ============================================================
-- 1. Este archivo YA CONTIENE los 881 pares reales (no requiere edición).
--    La lista aparece en CADA bloque VALUES (prechecks, UPDATE, postchecks).
--
-- 2. Ejecutar con service role key (psql o Supabase SQL Editor)
--
-- 3. Si falla PRECHECK 1.3 (ya ejecutado), NO repetir. Usar rollback si needed.
-- ============================================================
"""

# Write the corrected migration SQL
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-wave1-migration.sql', 'w', encoding='utf-8') as f:
    f.write(migration_sql)

print("Migration SQL generated successfully with actual 881 pairs in all VALUES blocks")