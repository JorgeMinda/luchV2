-- ============================================================
-- PLAN DE ROLLBACK — Fase 4.4.5.B (WAVE 1)
-- ============================================================
-- Revierte EXCLUSIVAMENTE las 881 relaciones creadas por la migración WAVE 1
-- NO elimina ingredientes ni recetas
-- NO asume que todos los valores no-NULL son de esta migración
-- ============================================================
-- EJECUTAR CON SERVICE ROLE KEY (bypass RLS)
-- SOLO EJECUTAR SI LA MIGRACIÓN FALLA O SE REQUIERE REVERSIÓN
-- ============================================================

-- ============================================================
-- MÉTODO RECOMENDADO: Usar la lista exacta de 881 recipe_ingredient_id
-- ============================================================
-- Esta es la forma MÁS SEGURA: identificar exactamente qué registros
-- fueron modificados por esta migración y revertir solo esos.

BEGIN;

-- Verificación previa: confirmar estado actual
DO $$
DECLARE
    currently_linked INTEGER;
BEGIN
    SELECT COUNT(*) INTO currently_linked
    FROM (VALUES
    -- PEGAR AQUÍ LA LISTA DE 881 PARES DEL CSV phase4.4.5b-wave1-migration-pairs.csv
    -- FORMATO: ('uuid-ri'::UUID, 'uuid-ing'::UUID),
    -- Ejemplo:
    -- ('1e5769d2-4543-428e-bcbc-9ec08acf3162'::UUID, 'fd3ecfc6-7f08-4136-bf18-4e39507cd4eb'::UUID),
    -- ('3d23e1cc-160e-4487-a2b8-4c5f5b1a5af8'::UUID, 'dc3eb263-76cf-457f-9708-d08b8c020101'::UUID),
    -- ... 881 líneas totales ...
    ) AS v(ri_id, ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id = v.ing_id;

    RAISE NOTICE 'ROLLBACK PRECHECK: % de 881 registros actualmente vinculados al candidato esperado', currently_linked;
    
    IF currently_linked = 0 THEN
        RAISE NOTICE 'ROLLBACK: Nada que revertir (ya están NULL o no coinciden)';
    END IF;
END $$;

-- Rollback preciso: poner a NULL solo los 881 recipe_ingredient_id conocidos
UPDATE recipe_ingredients ri
SET ingredient_id = NULL
FROM (VALUES
    -- PEGAR AQUÍ LA MISMA LISTA DE 881 recipe_ingredient_id (solo la primera columna)
    -- FORMATO: ('uuid-ri'::UUID),
    -- Ejemplo:
    -- ('1e5769d2-4543-428e-bcbc-9ec08acf3162'::UUID),
    -- ('3d23e1cc-160e-4487-a2b8-4c5f5b1a5af8'::UUID),
    -- ... 881 líneas totales ...
) AS v(ri_id)
WHERE ri.id = v.ri_id
  AND ri.ingredient_id IS NOT NULL;  -- Solo afectar los que no sean NULL

-- Verificación post-rollback
DO $$
DECLARE
    reverted_count INTEGER;
    still_linked INTEGER;
BEGIN
    -- Contar cuántos se revirtieron
    SELECT COUNT(*) INTO reverted_count
    FROM (VALUES
        -- MISMA LISTA DE 881 UUIDs
    ) AS v(ri_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id IS NULL;

    -- Verificar que no quedaron vinculados al candidato original
    SELECT COUNT(*) INTO still_linked
    FROM (VALUES
        -- MISMA LISTA DE 881 PARES
    ) AS v(ri_id, ing_id)
    JOIN recipe_ingredients ri ON v.ri_id = ri.id
    WHERE ri.ingredient_id = v.ing_id;

    RAISE NOTICE 'ROLLBACK RESULT: % revertidos a NULL, % aún vinculados (debería ser 0)', reverted_count, still_linked;
    
    IF still_linked > 0 THEN
        RAISE WARNING 'ROLLBACK INCOMPLETO: % registros no se revirtieron', still_linked;
    ELSE
        RAISE NOTICE 'ROLLBACK COMPLETO: Todas las 881 relaciones revertidas';
    END IF;
END $$;

COMMIT;

-- ============================================================
-- MÉTODO ALTERNATIVO (SOLO SI NO SE TIENE LA LISTA CSV):
-- ============================================================
-- NO USAR A MENOS QUE SEA IMPOSIBLE ACCEDER AL CSV
-- Este método es MENOS SEGURO porque afecta CUALQUIER relación
-- que coincida con los 153 ingredient_id candidatos, no solo
-- los 881 específicos de WAVE 1.

/*
BEGIN;

-- Identificar los 153 ingredient_id únicos que fueron candidatos en WAVE 1
-- (Requiere la lista del CSV)

UPDATE recipe_ingredients ri
SET ingredient_id = NULL
WHERE ri.ingredient_id IN (
    -- LISTA DE 153 UUIDs DE INGREDIENTES CANDIDATOS
    -- 'fd3ecfc6-7f08-4136-bf18-4e39507cd4eb',
    -- 'dc3eb263-76cf-457f-9708-d08b8c020101',
    -- ...
)
AND ri.ingredient_id IS NOT NULL;

-- PELIGRO: Esto revertiría TODAS las relaciones a esos 153 ingredientes,
-- incluidas las que pudieran haber existido ANTES de la migración
-- (aunque la auditoría Fase 4.4.4 dice que eran 0).

COMMIT;
*/

-- ============================================================
-- VERIFICACIÓN POST-ROLLBACK (ejecutar después de cualquier método)
-- ============================================================

-- 1. Confirmar que los 881 WAVE 1 vuelven a NULL
/*
WITH wave1_ri AS (
    SELECT unnest(ARRAY[ ... 881 UUIDs ... ]) AS ri_id
)
SELECT
    'wave1_back_to_null' AS metric,
    COUNT(*)::TEXT AS value,
    '881'::TEXT AS expected
FROM wave1_ri w
JOIN recipe_ingredients ri ON w.ri_id = ri.id
WHERE ri.ingredient_id IS NULL;
*/

-- 2. Confirmar total NULL = 1000 (881 revertidos + 119 pendientes originales)
SELECT
    'total_null_after_rollback' AS metric,
    (COUNT(*) - COUNT(ingredient_id))::TEXT AS value,
    '1000'::TEXT AS expected
FROM recipe_ingredients
WHERE is_active;

-- 3. Confirmar que no hay huérfanos
SELECT
    'orphans_after_rollback' AS metric,
    COUNT(*)::TEXT AS value,
    '0'::TEXT AS expected
FROM recipe_ingredients ri
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
WHERE ri.is_active
  AND ri.ingredient_id IS NOT NULL
  AND i.id IS NULL;

-- ============================================================
-- NOTAS IMPORTANTES
-- ============================================================
-- 1. El rollback DEBE usar la lista exacta de 881 recipe_ingredient_id
--    del archivo phase4.4.5b-wave1-migration-pairs.csv
--
-- 2. NO hacer: UPDATE recipe_ingredients SET ingredient_id = NULL
--    WHERE ingredient_id IS NOT NULL;
--    (Borraría relaciones legítimas pre-existentes si las hubiera)
--
-- 3. El rollback es idempotente: ejecutarlo múltiples veces es seguro
--    (WHERE ingredient_id IS NOT NULL protege contra doble NULL)
--
-- 4. Si la migración original falló a medias (p.ej. 400/881),
--    el rollback revertirá solo los que se hayan aplicado.
--
-- 5. Tras rollback, el estado es idéntico al pre-migración:
--    - 1000 recipe_ingredients activos
--    - 1000 con ingredient_id = NULL
--    - 0 relaciones
--    - Esquema inalterado (FK, índices, RLS intactos)
-- ============================================================