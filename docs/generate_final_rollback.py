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

# Generate rollback SQL with ACTUAL pairs in every VALUES block
rollback_sql = f"""-- ============================================================
-- PLAN DE ROLLBACK — Fase 4.4.5.B.1 (WAVE 1)
-- ============================================================
-- Revierte EXCLUSIVAMENTE las 881 relaciones creadas por la migración WAVE 1
-- NO elimina ingredientes ni recetas
-- NO asume que todos los valores no-NULL son de esta migración
-- Usa la lista EXACTA de 881 recipe_ingredient_id del CSV aprobado
-- ============================================================
-- EJECUTAR CON SERVICE ROLE KEY (bypass RLS)
-- SOLO EJECUTAR SI LA MIGRACIÓN FALLA O SE REQUIERE REVERSIÓN
-- ============================================================

BEGIN;

-- ============================================================
-- 1. VERIFICACIÓN PREVIA AL ROLLBACK
-- ============================================================
-- Confirmar el estado actual de los 881 registros WAVE 1
-- Deben estar vinculados al ingredient_id esperado

DO $$
DECLARE
    correctly_linked INTEGER;
    incorrectly_linked INTEGER;
    still_null INTEGER;
BEGIN
    -- Contar cuántos de los 881 están correctamente vinculados
    SELECT COUNT(*) INTO correctly_linked
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, expected_ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id = v.expected_ing_id;

    -- Contar cuántos están vinculados a OTRO ingredient_id (modificación posterior)
    SELECT COUNT(*) INTO incorrectly_linked
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, expected_ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id IS NOT NULL
      AND ri.ingredient_id <> v.expected_ing_id;

    -- Contar cuántos siguen NULL (migración falló parcialmente)
    SELECT COUNT(*) INTO still_null
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, expected_ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id IS NULL;

    RAISE NOTICE 'ROLLBACK PRECHECK: correctamente_vinculados=%, vinculados_a_otro=%, aun_null=%', 
        correctly_linked, incorrectly_linked, still_null;
    
    IF incorrectly_linked > 0 THEN
        RAISE WARNING 'ROLLBACK: % registros tienen ingredient_id DISTINTO al esperado. '
            'Esto indica modificación POSTERIOR a la migración. '
            'El rollback NO revertirá esos registros para preservar la integridad.', 
            incorrectly_linked;
    END IF;
    
    IF correctly_linked = 0 AND still_null = 0 AND incorrectly_linked = 0 THEN
        RAISE NOTICE 'ROLLBACK: Los 881 registros no existen o ya están en estado inesperado.';
    END IF;
END $$;

-- ============================================================
-- 2. ROLLBACK PRECISO: Solo revertir los que coinciden exactamente
-- ============================================================
-- Solo pone a NULL los registros que:
--   (a) Están en la lista de 881 WAVE 1, Y
--   (b) Actualmente tienen el ingredient_id EXACTO que se asignó en la migración
-- NO afecta registros modificados posteriormente por otra operación

UPDATE recipe_ingredients ri
SET ingredient_id = NULL
FROM (VALUES
{values_clause}
) AS v(ri_id, expected_ing_id)
WHERE ri.id = v.ri_id
  AND ri.ingredient_id = v.expected_ing_id;  -- SOLO si coincide exactamente

-- ============================================================
-- 3. VERIFICACIÓN POST-ROLLBACK
-- ============================================================

DO $$
DECLARE
    reverted_count INTEGER;
    still_linked_to_expected INTEGER;
    linked_to_other INTEGER;
    still_null_count INTEGER;
BEGIN
    -- Contar cuántos se revirtieron (tenían el ingredient_id esperado y ahora son NULL)
    SELECT COUNT(*) INTO reverted_count
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, expected_ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id IS NULL;

    -- Verificar que no quedaron vinculados al ingredient_id esperado
    SELECT COUNT(*) INTO still_linked_to_expected
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, expected_ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id = v.expected_ing_id;

    -- Verificar cuántos están vinculados a OTRO ingredient_id (no tocados por rollback)
    SELECT COUNT(*) INTO linked_to_other
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, expected_ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id IS NOT NULL
      AND ri.ingredient_id <> v.expected_ing_id;

    -- Contar cuántos seguían NULL (no se habían migrado)
    SELECT COUNT(*) INTO still_null_count
    FROM (VALUES
{values_clause}
    ) AS v(ri_id, expected_ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id IS NULL;

    RAISE NOTICE 'ROLLBACK RESULT: revertidos=%, aun_con_esperado=%, con_otro_ingrediente=%, eran_null=%', 
        reverted_count, still_linked_to_expected, linked_to_other, still_null_count;
    
    IF still_linked_to_expected > 0 THEN
        RAISE EXCEPTION 'ROLLBACK INCOMPLETO: % registros siguen vinculados al ingredient_id esperado', 
            still_linked_to_expected;
    END IF;
    
    IF linked_to_other > 0 THEN
        RAISE NOTICE 'ROLLBACK: % registros NO revertidos porque tienen ingredient_id distinto (modificación posterior preservada)', 
            linked_to_other;
    END IF;
    
    RAISE NOTICE 'ROLLBACK COMPLETO para los registros que coincidían con la migración original';
END $$;

-- ============================================================
-- 4. VERIFICACIÓN GLOBAL POST-ROLLBACK
-- ============================================================

-- 4.1 Los 881 WAVE 1 deben estar NULL (o con ingredient_id distinto si hubo modificación posterior)
/*
WITH wave1_ri AS (
    SELECT unnest(ARRAY[ ... 881 UUIDs ... ]) AS ri_id
)
SELECT
    'wave1_null_or_other' AS metric,
    COUNT(*)::TEXT AS value,
    '881'::TEXT AS expected
FROM wave1_ri w
JOIN recipe_ingredients ri ON w.ri_id = ri.id
WHERE ri.ingredient_id IS NULL OR ri.ingredient_id IS NOT NULL; -- Siempre true, solo para conteo
*/

-- 4.2 Total NULL en recipe_ingredients = 1000 (881 revertidos + 119 pendientes originales)
-- Nota: Si hubo modificaciones posteriores en algunos de los 881, el total NULL será < 1000
SELECT
    'total_null_after_rollback' AS metric,
    (COUNT(*) - COUNT(ingredient_id))::TEXT AS value,
    '1000'::TEXT AS expected_min  -- Mínimo 1000 si no hubo modificaciones posteriores
FROM recipe_ingredients
WHERE is_active;

-- 4.3 Confirmar que no hay huérfanos
SELECT
    'orphans_after_rollback' AS metric,
    COUNT(*)::TEXT AS value,
    '0'::TEXT AS expected
FROM recipe_ingredients ri
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
WHERE ri.is_active
  AND ri.ingredient_id IS NOT NULL
  AND i.id IS NULL;

-- 4.4 Verificar que los 119 pendientes originales siguen intactos
/*
WITH wave1_ri AS (
    SELECT unnest(ARRAY[ ... 881 UUIDs ... ]) AS ri_id
)
SELECT
    'pending_intact' AS metric,
    COUNT(*)::TEXT AS value,
    '119'::TEXT AS expected
FROM recipe_ingredients ri
WHERE ri.is_active
  AND ri.ingredient_id IS NULL
  AND ri.id NOT IN (SELECT ri_id FROM wave1_ri);
*/

COMMIT;

-- ============================================================
-- NOTAS IMPORTANTES DEL ROLLBACK
-- ============================================================
-- 1. El rollback USA LA LISTA EXACTA de 881 pares (ri_id, expected_ing_id)
--    del archivo phase4.4.5b-wave1-migration-pairs.csv
--
-- 2. La condición `ri.ingredient_id = v.expected_ing_id` en el WHERE
--    garantiza que SOLO se reviertan las relaciones creadas POR ESTA MIGRACIÓN.
--    Si otro proceso cambió el ingredient_id después, NO se revierte.
--
-- 3. El rollback es IDEMPOTENTE: ejecutarlo múltiples veces es seguro
--    (la segunda vez no encuentra coincidencias y no hace nada).
--
-- 4. Si la migración original falló a medias (p.ej. 400/881),
--    el rollback revertirá solo los que se hayan aplicado correctamente.
--
-- 5. Tras rollback exitoso (sin modificaciones posteriores):
--    - 1000 recipe_ingredients activos
--    - 1000 con ingredient_id = NULL
--    - 0 relaciones
--    - Esquema inalterado (FK, índices, RLS intactos)
--    - 119 pendientes originales intactos
--
-- 6. Si hubo modificaciones posteriores en X de los 881:
--    - X registros mantienen su nuevo ingredient_id (no revertidos)
--    - (881 - X) registros revueltos a NULL
--    - 119 pendientes intactos
--    - Total NULL = 1000 - X
-- ============================================================
"""

# Write the corrected rollback SQL
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-rollback.sql', 'w', encoding='utf-8') as f:
    f.write(rollback_sql)

print("Rollback SQL generated successfully with actual 881 pairs in all VALUES blocks")