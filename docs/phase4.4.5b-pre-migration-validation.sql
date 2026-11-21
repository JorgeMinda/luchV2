-- ============================================================
-- VALIDACIÓN PRE-MIGRACIÓN — Fase 4.4.5.B (WAVE 1)
-- ============================================================
-- Ejecutar ANTES de la migración para confirmar estado inicial
-- Debe ejecutarse con service role key (bypass RLS)
-- ============================================================

-- 1. Estado general de recipe_ingredients
SELECT
    'recipe_ingredients_total' AS metric,
    COUNT(*)::TEXT AS value
FROM recipe_ingredients
WHERE is_active;

SELECT
    'recipe_ingredients_with_ingredient_id' AS metric,
    COUNT(ingredient_id)::TEXT AS value
FROM recipe_ingredients
WHERE is_active;

SELECT
    'recipe_ingredients_null_ingredient_id' AS metric,
    (COUNT(*) - COUNT(ingredient_id))::TEXT AS value
FROM recipe_ingredients
WHERE is_active;

-- 2. Verificar que no hay registros ya vinculados (debería ser 0)
SELECT
    'already_linked_count' AS metric,
    COUNT(*)::TEXT AS value
FROM recipe_ingredients
WHERE is_active AND ingredient_id IS NOT NULL;

-- 3. Verificar huérfanos: ingredient_id que no existen en ingredients
SELECT
    'orphan_ingredient_id_count' AS metric,
    COUNT(*)::TEXT AS value
FROM recipe_ingredients ri
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
WHERE ri.is_active
  AND ri.ingredient_id IS NOT NULL
  AND i.id IS NULL;

-- Detalle de huérfanos (si los hay)
SELECT
    ri.id AS recipe_ingredient_id,
    ri.ingredient_id AS missing_ingredient_id,
    ri.name AS recipe_ingredient_name
FROM recipe_ingredients ri
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
WHERE ri.is_active
  AND ri.ingredient_id IS NOT NULL
  AND i.id IS NULL;

-- 4. Contar candidatos WAVE 1 únicos en ingredients
-- (Requiere la tabla temporal o CSV; aquí consulta de referencia)
-- Ver archivo phase4.4.5b-wave1-migration-pairs.csv para la lista completa

-- 5. Verificar existencia de los 153 ingredient_id únicos candidatos
-- Ejemplo de verificación (reemplazar con lista real):
/*
WITH candidate_ids AS (
    SELECT unnest(ARRAY[
        'fd3ecfc6-7f08-4136-bf18-4e39507cd4eb'::UUID,
        'dc3eb263-76cf-457f-9708-d08b8c020101'::UUID,
        '861a0072-1061-4c1f-90f1-5b1e2af4d680'::UUID
        -- ... agregar los 153 UUIDs del CSV phase4.4.5b-wave1-migration-pairs.csv
    ]) AS ing_id
)
SELECT
    'candidates_exist_in_ingredients' AS metric,
    COUNT(*)::TEXT AS value,
    (SELECT 153)::TEXT AS expected
FROM candidate_ids ci
JOIN ingredients i ON ci.ing_id = i.id
WHERE i.is_active;
*/

-- 6. Verificar que los 881 recipe_ingredient_id existen y están activos
/*
WITH wave1_ri AS (
    SELECT unnest(ARRAY[
        '1e5769d2-4543-428e-bcbc-9ec08acf3162'::UUID,
        '3d23e1cc-160e-4487-a2b8-4c5f5b1a5af8'::UUID,
        '6b64f78c-4f42-4efc-a987-8a87415d70f5'::UUID
        -- ... agregar los 881 UUIDs del CSV
    ]) AS ri_id
)
SELECT
    'wave1_ri_exist_and_active' AS metric,
    COUNT(*)::TEXT AS value,
    (SELECT 881)::TEXT AS expected
FROM wave1_ri w
JOIN recipe_ingredients ri ON w.ri_id = ri.id
WHERE ri.is_active;
*/

-- 7. Verificar que ninguno de los 881 ya tiene ingredient_id
/*
WITH wave1_ri AS (
    SELECT unnest(ARRAY[ ... 881 UUIDs ... ]) AS ri_id
)
SELECT
    'wave1_already_linked' AS metric,
    COUNT(*)::TEXT AS value,
    '0'::TEXT AS expected
FROM wave1_ri w
JOIN recipe_ingredients ri ON w.ri_id = ri.id
WHERE ri.ingredient_id IS NOT NULL;
*/

-- 8. Verificar ingredients activos totales
SELECT
    'ingredients_active_total' AS metric,
    COUNT(*)::TEXT AS value
FROM ingredients
WHERE is_active;

-- 9. Verificar índice en ingredient_id
SELECT
    'idx_recipe_ingredients_ingredient_id_exists' AS metric,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'recipe_ingredients' AND indexname = 'idx_recipe_ingredients_ingredient_id'
    ) THEN 'YES' ELSE 'NO' END AS value;

-- 10. Verificar FK existente
SELECT
    'fk_recipe_ingredients_ingredient_id_exists' AS metric,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'recipe_ingredients'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'ingredient_id'
    ) THEN 'YES' ELSE 'NO' END AS value;

-- 11. Verificar que ingredient_id es nullable (no NOT NULL)
SELECT
    'ingredient_id_is_nullable' AS metric,
    CASE WHEN is_nullable = 'YES' THEN 'YES' ELSE 'NO' END AS value
FROM information_schema.columns
WHERE table_name = 'recipe_ingredients' AND column_name = 'ingredient_id';

-- 12. Resumen de validación pre-migración
-- Todos los valores esperados:
-- - recipe_ingredients_total: 1000
-- - recipe_ingredients_null_ingredient_id: 1000
-- - already_linked_count: 0
-- - orphan_ingredient_id_count: 0
-- - candidates_exist_in_ingredients: 153
-- - wave1_ri_exist_and_active: 881
-- - wave1_already_linked: 0
-- - ingredients_active_total: 462
-- - idx_recipe_ingredients_ingredient_id_exists: YES
-- - fk_recipe_ingredients_ingredient_id_exists: YES
-- - ingredient_id_is_nullable: YES

-- ============================================================
-- NOTA: Para validaciones 4, 5, 6, 7 usar los UUIDs reales del CSV:
-- phase4.4.5b-wave1-migration-pairs.csv (881 filas)
-- phase4.4.5b-wave1-approved-candidates.csv (881 filas con detalles)
-- ============================================================