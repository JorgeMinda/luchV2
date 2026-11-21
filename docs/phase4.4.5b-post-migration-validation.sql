-- ============================================================
-- VALIDACIÓN POST-MIGRACIÓN — Fase 4.4.5.B (WAVE 1)
-- ============================================================
-- Ejecutar DESPUÉS de la migración para confirmar resultado
-- Debe ejecutarse con service role key (bypass RLS)
-- ============================================================

-- 1. Conteos globales
SELECT
    'recipe_ingredients_total_active' AS metric,
    COUNT(*)::TEXT AS value,
    '1000'::TEXT AS expected
FROM recipe_ingredients
WHERE is_active;

SELECT
    'recipe_ingredients_with_ingredient_id' AS metric,
    COUNT(ingredient_id)::TEXT AS value,
    '881'::TEXT AS expected
FROM recipe_ingredients
WHERE is_active;

SELECT
    'recipe_ingredients_null_ingredient_id' AS metric,
    (COUNT(*) - COUNT(ingredient_id))::TEXT AS value,
    '119'::TEXT AS expected
FROM recipe_ingredients
WHERE is_active;

-- 2. Verificar exactamente 881 relaciones nuevas (los WAVE 1)
-- Usar la lista de 881 recipe_ingredient_id del CSV
/*
WITH wave1_ri AS (
    SELECT unnest(ARRAY[ ... 881 UUIDs ... ]) AS ri_id
)
SELECT
    'wave1_linked_count' AS metric,
    COUNT(*)::TEXT AS value,
    '881'::TEXT AS expected
FROM wave1_ri w
JOIN recipe_ingredients ri ON w.ri_id = ri.id
WHERE ri.ingredient_id IS NOT NULL;
*/

-- 3. Verificar que los 119 pendientes siguen NULL
/*
WITH wave1_ri AS (
    SELECT unnest(ARRAY[ ... 881 UUIDs ... ]) AS ri_id
)
SELECT
    'pending_still_null' AS metric,
    COUNT(*)::TEXT AS value,
    '119'::TEXT AS expected
FROM recipe_ingredients ri
WHERE ri.is_active
  AND ri.ingredient_id IS NULL
  AND ri.id NOT IN (SELECT ri_id FROM wave1_ri);
*/

-- 4. Verificar que NINGÚN registro ajeno a WAVE 1 fue modificado
-- (Todos los que tienen ingredient_id deben estar en la lista WAVE 1)
/*
WITH wave1_ri AS (
    SELECT unnest(ARRAY[ ... 881 UUIDs ... ]) AS ri_id
)
SELECT
    'non_wave1_linked' AS metric,
    COUNT(*)::TEXT AS value,
    '0'::TEXT AS expected
FROM recipe_ingredients ri
WHERE ri.is_active
  AND ri.ingredient_id IS NOT NULL
  AND ri.id NOT IN (SELECT ri_id FROM wave1_ri);
*/

-- 5. Verificar que todas las FK apuntan a ingredients existentes (no huérfanos)
SELECT
    'orphan_fk_count' AS metric,
    COUNT(*)::TEXT AS value,
    '0'::TEXT AS expected
FROM recipe_ingredients ri
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
WHERE ri.is_active
  AND ri.ingredient_id IS NOT NULL
  AND i.id IS NULL;

-- 6. Verificar que las 881 FK apuntan a ingredients activos
/*
WITH wave1_ri AS (
    SELECT unnest(ARRAY[ ... 881 UUIDs ... ]) AS ri_id
)
SELECT
    'wave1_fk_to_active_ingredients' AS metric,
    COUNT(*)::TEXT AS value,
    '881'::TEXT AS expected
FROM wave1_ri w
JOIN recipe_ingredients ri ON w.ri_id = ri.id
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE i.is_active;
*/

-- 7. Verificar no hay duplicados en la relación (un recipe_ingredient -> un ingredient)
SELECT
    'duplicate_ri_per_ingredient' AS metric,
    COUNT(*)::TEXT AS value,
    '0'::TEXT AS expected
FROM (
    SELECT ingredient_id, COUNT(*) AS cnt
    FROM recipe_ingredients
    WHERE is_active AND ingredient_id IS NOT NULL
    GROUP BY ingredient_id
    HAVING COUNT(*) > 1
) sub;

-- Nota: Un ingredient puede estar en múltiples recetas (normal),
-- pero cada recipe_ingredient debe tener máximo 1 ingredient_id (garantizado por PK)

-- 8. Verificar integridad de la FK (todas las referencias válidas)
SELECT
    'fk_integrity_ok' AS metric,
    CASE WHEN COUNT(*) = 0 THEN 'YES' ELSE 'NO' END AS value,
    'YES'::TEXT AS expected
FROM recipe_ingredients ri
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
WHERE ri.is_active
  AND ri.ingredient_id IS NOT NULL
  AND i.id IS NULL;

-- 9. Verificar que ingredient_id sigue siendo nullable (no se añadió NOT NULL)
SELECT
    'ingredient_id_still_nullable' AS metric,
    CASE WHEN is_nullable = 'YES' THEN 'YES' ELSE 'NO' END AS value,
    'YES'::TEXT AS expected
FROM information_schema.columns
WHERE table_name = 'recipe_ingredients' AND column_name = 'ingredient_id';

-- 10. Verificar que FK sigue siendo ON DELETE SET NULL
SELECT
    'fk_on_delete_set_null' AS metric,
    CASE WHEN delete_rule = 'SET NULL' THEN 'YES' ELSE 'NO' END AS value,
    'YES'::TEXT AS expected
FROM information_schema.referential_constraints
WHERE constraint_name = (
    SELECT constraint_name
    FROM information_schema.key_column_usage
    WHERE table_name = 'recipe_ingredients' AND column_name = 'ingredient_id'
);

-- 11. Verificar que el índice sigue existiendo
SELECT
    'idx_still_exists' AS metric,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'recipe_ingredients' AND indexname = 'idx_recipe_ingredients_ingredient_id'
    ) THEN 'YES' ELSE 'NO' END AS value,
    'YES'::TEXT AS expected;

-- 12. Distribución por ingrediente (top 20)
SELECT
    i.name AS ingredient_name,
    i.code AS ingredient_code,
    COUNT(ri.id) AS recipe_ingredient_count
FROM recipe_ingredients ri
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE ri.is_active
GROUP BY i.id, i.name, i.code
ORDER BY recipe_ingredient_count DESC
LIMIT 20;

-- 13. Resumen final
-- Todos los checks deben pasar:
-- - total_active = 1000
-- - with_ingredient_id = 881
-- - null_ingredient_id = 119
-- - wave1_linked = 881
-- - pending_still_null = 119
-- - non_wave1_linked = 0
-- - orphan_fk = 0
-- - fk_to_active = 881
-- - duplicate_check = 0
-- - fk_integrity = YES
-- - still_nullable = YES
-- - fk_on_delete = YES
-- - idx_exists = YES

-- ============================================================
-- NOTA: Para validaciones 2, 3, 4, 6 usar los UUIDs reales del CSV:
-- phase4.4.5b-wave1-migration-pairs.csv (881 filas)
-- phase4.4.5b-wave1-approved-candidates.csv (881 filas con detalles)
-- ============================================================