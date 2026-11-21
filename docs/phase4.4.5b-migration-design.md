# Diseño de Migración de Integridad Referencial — Fase 4.4.5.B (WAVE 1)

**Fecha:** 2026-11-21  
**Proyecto:** Lunch v2  
**Directorio:** `C:\Users\minda\Desktop\REA\luch-v2\lunch`  
**Estado:** Solo lectura — **NINGUNA ESCRITURA EJECUTADA**

---

## 1. Esquema Real de la Relación

### 1.1 Tabla `recipe_ingredients` (Origen)

| Columna | Tipo | Nullable | Default | Comentario |
|---------|------|----------|---------|------------|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `recipe_id` | UUID | NO | — | FK → `dish_recipes(id)` ON DELETE CASCADE |
| `ingredient_id` | UUID | **SÍ** | — | **FK → `ingredients(id)` ON DELETE SET NULL** (actualmente NULL ∀ filas) |
| `name` | TEXT | NO | — | Nombre en receta |
| `purchase_presentation` | TEXT | NO | — | |
| `purchase_price_cents` | INTEGER | NO | — | |
| `purchase_quantity` | NUMERIC(12,3) | NO | — | |
| `recipe_quantity` | NUMERIC(12,3) | NO | — | |
| `purchase_unit_cost_raw` | NUMERIC(12,6) | SÍ | — | |
| `source_formula` | TEXT | SÍ | — | |
| `source_cell` | TEXT | SÍ | — | |
| `yield_percentage` | NUMERIC(5,4) | SÍ | — | |
| `is_active` | BOOLEAN | NO | `true` | Borrado lógico |
| `deleted_at` | TIMESTAMPTZ | SÍ | — | |
| `deleted_by` | UUID | SÍ | — | FK → `users(id)` |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |

**Índices existentes:**
- `idx_recipe_ingredients_recipe_id` ON `recipe_id`
- `idx_recipe_ingredients_ingredient_id` ON `ingredient_id`  ← **Ya existe**
- `idx_recipe_ingredients_is_active` ON `is_active`

**FK existente:**
```sql
ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL
```

**Triggers:** No hay triggers sobre `recipe_ingredients` (no tiene columna `updated_at`).

**RLS:** Habilitado. Políticas permiten UPDATE solo a `admin` y `canteen`. El **service role bypassa RLS**.

---

### 1.2 Tabla `ingredients` (Destino)

| Columna | Tipo | Nullable | Default | Comentario |
|---------|------|----------|---------|------------|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `code` | TEXT | NO | — | UNIQUE |
| `category` | TEXT | NO | — | |
| `product` | TEXT | NO | — | |
| `presentation` | TEXT | NO | — | |
| `cost_cents` | INTEGER | NO | — | |
| `purchase_unit_cost_raw` | NUMERIC(12,6) | SÍ | — | |
| `source_formula` | TEXT | SÍ | — | |
| `status` | TEXT | NO | `'ACTIVO'` | CHECK IN ('ACTIVO','INACTIVO') |
| `is_active` | BOOLEAN | NO | `true` | |
| `deleted_at` | TIMESTAMPTZ | SÍ | — | |
| `deleted_by` | UUID | SÍ | — | FK → `users(id)` |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | Trigger `update_ingredients_updated_at` |

**Total ingredientes activos:** 462 (según auditoría Fase 4.4.4)

---

## 2. Cantidades y Validación

| Métrica | Valor | Fuente |
|---------|-------|--------|
| Registros totales `recipe_ingredients` | 1000 | CSV validado |
| Registros WAVE 1 (EXACT_MATCH) | **881** | `phase4.4.5a1-final-mapping.csv` |
| Registros WAVE 2,3,4 (pendientes) | 119 | No se tocan |
| `ingredient_id` actualmente NULL | 1000 | Auditoría Fase 4.4.4 |
| Candidatos únicos en `ingredients` | 153 | 881 filas → 153 ingredientes distintos |
| Validaciones WAVE 1 | **0 issues** | Verificación automatizada |

**Condiciones verificadas para cada uno de los 881 registros:**
1. ✅ Existe exactamente un `ingredient_id_candidate` no nulo
2. ✅ `match_type = 'EXACT_MATCH'`
3. ✅ `wave_assignment = 'WAVE_1_AUTO'`
4. ✅ `semantic_compatibility = 'COMPATIBLE'`
4. ✅ `recipe_ingredient_id` único (881 distintos)
5. ✅ Sin contradicciones con datos originales
6. ✅ Ningún registro de WAVE 2/3/4 incluido

**Registros excluidos:** 0 (todos los 881 WAVE 1 son válidos)

---

## 3. Estrategia de Migración

### 3.1 Principios
- **Transacción única**: Todo en una transacción para atomicidad
- **Idempotencia**: Usar `WHERE ingredient_id IS NULL` para evitar re-escrituras
- **Seguridad**: Verificar existencia del `ingredient_id` en `ingredients` antes de vincular
- **Aislamiento**: No tocar los 119 registros pendientes (permanecen NULL)
- **Trazabilidad**: Registrar `migration_batch_id` en logs si se desea

### 3.2 Enfoque: UPDATE con JOIN a VALUES

Usar `UPDATE ... FROM (VALUES ...) AS v(ri_id, ing_id)` para:
- Evitar 881 queries individuales
- Garantizar atomicidad
- Permitir verificación previa en la misma transacción

### 3.3 Service Role
La migración debe ejecutarse con **service role key** para bypassar RLS (políticas requieren `canteen`/`admin`).

---

## 4. SQL de Migración Propuesto

Ver archivo: `phase4.4.5b-wave1-migration.sql`

Características clave:
```sql
BEGIN;

-- 1. Verificación previa dentro de la transacción
-- 2. UPDATE masivo con JOIN a VALUES (881 pares)
-- 3. Verificación post-UPDATE dentro de la transacción
-- 4. COMMIT solo si todo OK

-- No se altera la FK (ya existe ON DELETE SET NULL)
-- No se añade NOT NULL (119 pendientes deben seguir NULL)
-- No se crea índice (ya existe idx_recipe_ingredients_ingredient_id)
```

---

## 5. Estrategia de Rollback

Ver archivo: `phase4.4.5b-rollback.sql`

**Principio:** Revertir **exclusivamente** las 881 relaciones creadas por esta migración.

Método: Usar la tabla temporal de mapeo (o el CSV) para identificar exactamente qué `recipe_ingredient_id` se actualizaron, y poner su `ingredient_id` a NULL.

```sql
-- Rollback preciso: solo los 881 IDs conocidos
UPDATE recipe_ingredients
SET ingredient_id = NULL
WHERE id IN (SELECT recipe_ingredient_id FROM wave1_mapping);
```

**NO** hacer: `UPDATE recipe_ingredients SET ingredient_id = NULL WHERE ingredient_id IS NOT NULL`
(Riesgo: borraría relaciones pre-existentes si las hubiera).

---

## 6. Validaciones Pre/Post

Ver archivos:
- `phase4.4.5b-pre-migration-validation.sql`
- `phase4.4.5b-post-migration-validation.sql`

**Pre-migración:**
- Total registros, NULLs, ya vinculados, huérfanos, conteo candidatos WAVE 1
- Verificar que los 153 `ingredient_id_candidate` existen en `ingredients`

**Post-migración:**
- Exactamente 881 relaciones nuevas
- 119 pendientes siguen NULL
- Ningún registro ajeno a WAVE 1 modificado
- Todas las FK apuntan a `ingredients` existentes
- Sin duplicados ni referencias inválidas

---

## 7. Riesgos Identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Algún `ingredient_id_candidate` no existe en `ingredients` | Baja (validado) | Alto | Verificación `EXISTS` en transacción |
| RLS bloquea UPDATE | Media | Alto | Usar service role key |
| Deadlock por transacciones concurrentes | Baja | Medio | Migración en ventana de mantenimiento |
| Error en CSV (ID mal formado) | Baja (validado) | Alto | Validación UUID regex previa |
| Trigger inesperado | Ninguna (no hay triggers) | — | Confirmado en esquema |

---

## 8. Confirmación de Solo Lectura

**NINGUNA ESCRITURA EJECUTADA** en esta fase. Todos los entregables son:
- Documentación Markdown
- Scripts SQL (para revisión)
- CSV de mapeo validado

La migración solo se ejecutará tras **revisión y autorización expresa** del usuario.

---

## 9. Archivos Generados

| Archivo | Descripción |
|---------|-------------|
| `phase4.4.5b-migration-design.md` | Este documento |
| `phase4.4.5b-pre-migration-validation.sql` | Consultas de validación previa |
| `phase4.4.5b-wave1-migration.sql` | Migración SQL propuesta |
| `phase4.4.5b-post-migration-validation.sql` | Consultas de validación posterior |
| `phase4.4.5b-rollback.sql` | Plan de rollback |
| `phase4.4.5b-wave1-approved-candidates.csv` | 881 registros validados (fuente) |
| `phase4.4.5b-wave1-migration-pairs.csv` | Pares mínimos (recipe_ingredient_id, ingredient_id) |

---

**Fin del diseño de migración**  
Listo para revisión del usuario antes de ejecución.