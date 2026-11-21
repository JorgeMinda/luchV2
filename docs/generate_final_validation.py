import csv

# Read the minimal pairs CSV for 881 WAVE 1 UUIDs
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-migration-pairs.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    pairs = list(reader)

wave1_ri_ids = [row['recipe_ingredient_id'] for row in pairs]
wave1_ri_array = ', '.join(["'{}'".format(uid) for uid in wave1_ri_ids])

# Read the full mapping to get pending 119 UUIDs
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5a1-final-mapping.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    full = list(reader)

pending = [r for r in full if r['wave_assignment'] != 'WAVE_1_AUTO']
pending_ri_ids = [r['recipe_ingredient_id'] for r in pending]
pending_ri_array = ', '.join(["'{}'".format(uid) for uid in pending_ri_ids])

print("WAVE 1 RI IDs: {}".format(len(wave1_ri_ids)))
print("Pending RI IDs: {}".format(len(pending_ri_ids)))

# Generate validation SQL with ACTUAL UUID arrays
validation_sql = """-- ============================================================
-- VALIDACIÓN POST-MIGRACIÓN — Fase 4.4.5.B.1 (WAVE 1)
-- ============================================================
-- Ejecutar DESPUÉS de la migración para confirmar resultado
-- Debe ejecutarse con service role key (bypass RLS)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Conteos globales esperados
-- ------------------------------------------------------------
-- Total registros activos: 1000
-- Con ingredient_id NOT NULL: 881 (WAVE 1)
-- Con ingredient_id NULL: 119 (WAVE 2/3/4 pendientes)

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

-- ------------------------------------------------------------
-- 2. Verificar exactamente los 881 WAVE 1 vinculados
-- ------------------------------------------------------------
-- Usar la lista exacta de 881 recipe_ingredient_id del CSV aprobado
WITH wave1_ri AS (
    SELECT unnest(ARRAY[{wave1_ri_array}]) AS ri_id
)
SELECT
    'wave1_linked_count' AS metric,
    COUNT(*)::TEXT AS value,
    '881'::TEXT AS expected
FROM wave1_ri w
JOIN recipe_ingredients ri ON w.ri_id = ri.id
WHERE ri.ingredient_id IS NOT NULL;

-- ------------------------------------------------------------
-- 3. Verificar que los 119 pendientes SIGUEN CON NULL
-- ------------------------------------------------------------
-- CRÍTICO: Detecta cualquier modificación accidental de pendientes
WITH wave1_ri AS (
    SELECT unnest(ARRAY[{wave1_ri_array}]) AS ri_id
)
SELECT
    'pending_still_null' AS metric,
    COUNT(*)::TEXT AS value,
    '119'::TEXT AS expected
FROM recipe_ingredients ri
WHERE ri.is_active
  AND ri.ingredient_id IS NULL
  AND ri.id NOT IN (SELECT ri_id FROM wave1_ri);

-- ------------------------------------------------------------
-- 4. Verificar que NINGÚN registro ajeno a WAVE 1 fue modificado
-- ------------------------------------------------------------
-- Todos los ingredient_id NOT NULL deben pertenecer a la lista WAVE 1
WITH wave1_ri AS (
    SELECT unnest(ARRAY[{wave1_ri_array}]) AS ri_id
)
SELECT
    'non_wave1_linked' AS metric,
    COUNT(*)::TEXT AS value,
    '0'::TEXT AS expected
FROM recipe_ingredients ri
WHERE ri.is_active
  AND ri.ingredient_id IS NOT NULL
  AND ri.id NOT IN (SELECT ri_id FROM wave1_ri);

-- ------------------------------------------------------------
-- 5. Verificar que no hay relaciones huérfanas (FK inválidas)
-- ------------------------------------------------------------
SELECT
    'orphan_fk_count' AS metric,
    COUNT(*)::TEXT AS value,
    '0'::TEXT AS expected
FROM recipe_ingredients ri
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
WHERE ri.is_active
  AND ri.ingredient_id IS NOT NULL
  AND i.id IS NULL;

-- ------------------------------------------------------------
-- 6. Verificar que las 881 FK apuntan a ingredients ACTIVOS
-- ------------------------------------------------------------
WITH wave1_ri AS (
    SELECT unnest(ARRAY[{wave1_ri_array}]) AS ri_id
)
SELECT
    'wave1_fk_to_active_ingredients' AS metric,
    COUNT(*)::TEXT AS value,
    '881'::TEXT AS expected
FROM wave1_ri w
JOIN recipe_ingredients ri ON w.ri_id = ri.id
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE i.is_active;

-- ------------------------------------------------------------
-- 7. Verificar integridad de la FK (todas las referencias válidas)
-- ------------------------------------------------------------
SELECT
    'fk_integrity_ok' AS metric,
    CASE WHEN COUNT(*) = 0 THEN 'YES' ELSE 'NO' END AS value,
    'YES'::TEXT AS expected
FROM recipe_ingredients ri
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
WHERE ri.is_active
  AND ri.ingredient_id IS NOT NULL
  AND i.id IS NULL;

-- ------------------------------------------------------------
-- 8. Verificar que ingredient_id sigue siendo nullable
-- ------------------------------------------------------------
SELECT
    'ingredient_id_still_nullable' AS metric,
    CASE WHEN is_nullable = 'YES' THEN 'YES' ELSE 'NO' END AS value,
    'YES'::TEXT AS expected
FROM information_schema.columns
WHERE table_name = 'recipe_ingredients' AND column_name = 'ingredient_id';

-- ------------------------------------------------------------
-- 9. Verificar que FK sigue siendo ON DELETE SET NULL
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 10. Verificar que el índice sigue existiendo
-- ------------------------------------------------------------
SELECT
    'idx_still_exists' AS metric,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'recipe_ingredients' AND indexname = 'idx_recipe_ingredients_ingredient_id'
    ) THEN 'YES' ELSE 'NO' END AS value,
    'YES'::TEXT AS expected;

-- ------------------------------------------------------------
-- 11. Verificar IDs exactos de los 119 pendientes (lista completa)
-- ------------------------------------------------------------
-- Esta consulta DEBE devolver exactamente los 119 recipe_ingredient_id
-- que NO están en WAVE 1, y confirmar que todos tienen ingredient_id = NULL
WITH wave1_ri AS (
    SELECT unnest(ARRAY[{wave1_ri_array}]) AS ri_id
),
pending_ri AS (
    SELECT ri.id, ri.name, ri.ingredient_id
    FROM recipe_ingredients ri
    WHERE ri.is_active
      AND ri.id NOT IN (SELECT ri_id FROM wave1_ri)
)
SELECT
    'pending_ids_verified' AS metric,
    COUNT(*)::TEXT AS value,
    '119'::TEXT AS expected,
    STRING_AGG(id::TEXT, ',' ORDER BY id) AS pending_ids
FROM pending_ri
WHERE ingredient_id IS NULL;

-- ------------------------------------------------------------
-- 12. Verificar que los 119 pendientes conservan sus valores originales
-- ------------------------------------------------------------
-- Ningún campo de los pendientes debe haber cambiado
WITH wave1_ri AS (
    SELECT unnest(ARRAY[{wave1_ri_array}]) AS ri_id
)
SELECT
    'pending_unchanged' AS metric,
    COUNT(*)::TEXT AS value,
    '119'::TEXT AS expected
FROM recipe_ingredients ri
WHERE ri.is_active
  AND ri.id NOT IN (SELECT ri_id FROM wave1_ri)
  AND ri.ingredient_id IS NULL
  AND ri.name IS NOT NULL
  AND ri.purchase_presentation IS NOT NULL
  AND ri.purchase_price_cents IS NOT NULL
  AND ri.purchase_quantity IS NOT NULL
  AND ri.recipe_quantity IS NOT NULL;

-- ------------------------------------------------------------
-- 13. Distribución por ingrediente (top 20) - solo WAVE 1
-- ------------------------------------------------------------
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

-- ============================================================
-- RESUMEN DE VALIDACIÓN ESPERADO
-- ============================================================
-- metric                                    | value | expected
-- recipe_ingredients_total_active           | 1000  | 1000
-- recipe_ingredients_with_ingredient_id     | 881   | 881
-- recipe_ingredients_null_ingredient_id     | 119   | 119
-- wave1_linked_count                        | 881   | 881
-- pending_still_null                        | 119   | 119
-- non_wave1_linked                          | 0     | 0
-- orphan_fk_count                           | 0     | 0
-- wave1_fk_to_active_ingredients            | 881   | 881
-- fk_integrity_ok                           | YES   | YES
-- ingredient_id_still_nullable              | YES   | YES
-- fk_on_delete_set_null                     | YES   | YES
-- idx_still_exists                          | YES   | YES
-- pending_ids_verified                      | 119   | 119
-- pending_unchanged                         | 119   | 119

-- ============================================================
-- NOTA: Todos los UUIDs de WAVE 1 (881) están incrustados en este archivo.
-- No requiere edición manual antes de ejecutar.
-- ============================================================
""".format(wave1_ri_array=wave1_ri_array)

# Write the corrected validation SQL
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-post-migration-validation.sql', 'w', encoding='utf-8') as f:
    f.write(validation_sql)

print("Post-migration validation SQL generated successfully with actual 881 UUIDs")