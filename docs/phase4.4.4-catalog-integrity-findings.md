# Hallazgos Detallados — Auditoría Fase 4.4.4

**Fecha:** 2026-11-21  
**Proyecto:** Lunch v2  
**Documento complementario a:** `phase4.4.4-catalog-integrity-audit.md`

---

## Formato de Cada Hallazgo

| Campo | Descripción |
|-------|-------------|
| **ID** | Identificador único (INT-XXX) |
| **Severidad** | CRÍTICA / ALTA / MEDIA / BAJA |
| **Evidencia** | Datos observados, consultas, capturas |
| **Archivo/Tabla/Campo** | Ubicación técnica |
| **Impacto** | Consecuencia funcional o de integridad |
| **Recomendación** | Acción propuesta |
| **Requiere Migración** | SÍ / NO |
| **Requiere Corrección Código** | SÍ / NO |
| **Requiere Decisión Usuario** | SÍ / NO |

---

## Hallazgos

### INT-001 — FK `recipe_ingredients.ingredient_id` 100% NULL

| Campo | Valor |
|-------|-------|
| **Severidad** | CRÍTICA |
| **Evidencia** | `SELECT COUNT(*) FROM recipe_ingredients WHERE is_active AND ingredient_id IS NOT NULL` → 0/1000. `SELECT COUNT(*) FROM recipe_ingredients WHERE is_active AND ingredient_id IS NULL` → 1000. |
| **Archivo/Tabla/Campo** | `recipe_ingredients.ingredient_id` (UUID, nullable, FK a `ingredients.id` definida en migración pero no poblada) |
| **Impacto** | Sin enlace referencial catálogo ↔ recetas. Cambios en precio/presentación de ingrediente no propagan. Match por nombre es frágil (typos, 46 sin match). Impide trazabilidad F.7 y consistencia F.8. |
| **Recomendación** | Migración de datos: `UPDATE recipe_ingredients SET ingredient_id = (SELECT id FROM ingredients WHERE product = recipe_ingredients.name) WHERE ingredient_id IS NULL`. Luego validar 46 huérfanos manualmente. Añadir `NOT NULL` constraint tras limpieza. |
| **Requiere Migración** | SÍ |
| **Requiere Corrección Código** | SÍ (persist-import-use-case debe poblar `ingredient_id` al crear recetas) |
| **Requiere Decisión Usuario** | SÍ (cómo resolver 46 sin match: crear ingredientes faltantes, renombrar en recetas, o mapear manualmente) |

---

### INT-002 — Trazabilidad Celular Ausente en Recetas (`source_formula`, `source_cell`, `yield_percentage`)

| Campo | Valor |
|-------|-------|
| **Severidad** | CRÍTICA |
| **Evidencia** | `SELECT COUNT(*) FROM recipe_ingredients WHERE is_active AND source_formula IS NOT NULL AND source_formula != ''` → 0. `source_cell` → 0. `yield_percentage` → 0. Lo mismo en `meal_composition_components`. |
| **Archivo/Tabla/Campo** | `recipe_ingredients.source_formula`, `recipe_ingredients.source_cell`, `recipe_ingredients.yield_percentage`; `meal_composition_components.source_formula`, `meal_composition_components.source_cell` |
| **Impacto** | Imposible auditar origen de un costo unitario en receta. No se sabe si viene de Excel (fórmula), de catálogo, o se digitó manualmente. F.7 no cumplido. Merma no configurada → cálculos de costo de receta asumen 100% rendimiento. |
| **Recomendación** | 1. Parser de recetas (`recipe-costing-parser.ts`) debe extraer `source_formula` y `source_cell` de cada fila y guardarlos en `imported_rows.normalized_data`. 2. `persist-import-use-case` debe propagar a `recipe_ingredients`. 3. Añadir `yield_percentage` con default 1.0 (100%) y permitir edición. |
| **Requiere Migración** | SÍ (añadir defaults, backfill) |
| **Requiere Corrección Código** | SÍ (parser, persist-use-case, repositorios) |
| **Requiere Decisión Usuario** | NO (técnico, pero validar default de merma) |

---

### INT-003 — `meal_composition_components.reference_unit_cost_raw` Inconsistente (26/28)

| Campo | Valor |
|-------|-------|
| **Severidad** | CRÍTICA |
| **Evidencia** | Para cada componente: `expected = reference_unit_cost_cents / 100 / standard_quantity`. Comparado con `reference_unit_cost_raw`: 26/28 difieren > 0.1%. Ej: GUARNICION `ref_cost_cents=10`, `std_qty=50` → esperado $0.002/g, almacenado $0.001/g. JUGO `ref_cost=140`, `std_qty=8` → esperado $0.175/g, almacenado $0.014/g (factor 12.5x). |
| **Archivo/Tabla/Campo** | `meal_composition_components.reference_unit_cost_raw`, `reference_unit_cost_cents`, `standard_quantity` |
| **Impacto** | Cálculos de costo de menú incorrectos. `reference_unit_cost_raw` parece usar unidad distinta a `standard_quantity` (posiblemente "por porción" vs "por gramo"). No hay `unit` field consistente. |
| **Recomendación** | 1. Auditar origen de estos 28 componentes (¿importación manual? ¿script?). 2. Definir semántica: `standard_quantity` en gramos → `reference_unit_cost_raw = ref_cost_cents/100 / standard_quantity`. 3. Corregir datos y añadir validación en repositorio. |
| **Requiere Migración** | SÍ (corrección de datos) |
| **Requiere Corrección Código** | SÍ (validación en insert/update) |
| **Requiere Decisión Usuario** | SÍ (confirmar semántica de `standard_quantity`: ¿gramos? ¿porciones?) |

---

### INT-004 — 445/462 Ingredientes Sin `purchase_unit_cost_raw` (Presentación No Parseable)

| Campo | Valor |
|-------|-------|
| **Severidad** | ALTA |
| **Evidencia** | Análisis de 462 presentaciones: solo 16 tienen patrón parseable a gramos (ej. "UNIDAD (100 GR)", "350 GR", "1 KILO"). 445 usan "UNIDAD", "BOTELLA", "GRAMOS", "KILOS", "LIBRA", "20 LITROS", "ARROBA", "CAJA", "FUNDA", etc. sin cantidad numérica parseable. |
| **Archivo/Tabla/Campo** | `ingredients.presentation`, `ingredients.purchase_unit_cost_raw` |
| **Impacto** | No se puede calcular costo por gramo automáticamente. Recetas que usan estos ingredientes deben definir `purchase_quantity` manualmente → fuente de errores (ver INT-007). Cálculos de costo de plato imprecisos. |
| **Recomendación** | Crear tabla `presentation_normalization` mapeando cada presentación única a gramos equivalentes (o NULL si no aplica). Poblar manualmente las 29 presentaciones únicas. Modificar importación para calcular `purchase_unit_cost_raw` automáticamente cuando sea posible. |
| **Requiere Migración** | SÍ (nueva tabla + columna `normalized_grams` en `ingredients` o `presentation_normalization`) |
| **Requiere Corrección Código** | SÍ (parser, persist-import, unit-normalizer) |
| **Requiere Decisión Usuario** | SÍ (definir equivalencias: ej. "UNIDAD" = 100g? "BOTELLA" = 500ml? "ARROBA" = 11.5kg?) |

---

### INT-005 — `source_formula` NULL en 100% de Ingredientes (Fórmulas Excel No Extraídas)

| Campo | Valor |
|-------|-------|
| **Severidad** | ALTA |
| **Evidencia** | `SELECT COUNT(*) FROM ingredients WHERE source_formula IS NOT NULL AND source_formula != ''` → 0. Fase 4.4.3.A detectó 22 fórmulas reales en columna costo (ej. "=C5/D5"). El parser `catalog-parser.ts` no las extrae a `source_formula`. |
| **Archivo/Tabla/Campo** | `ingredients.source_formula`; `src/infrastructure/import/parsers/catalog-parser.ts` |
| **Impacto** | Pérdida de trazabilidad F.7: no se sabe qué celdas참조 usó el Excel para calcular el costo. Auditoría imposible a nivel fórmula. |
| **Recomendación** | En `catalog-parser.ts`, al parsear columna costo: si valor es string y empieza con "=", guardar en `source_formula` y evaluar/guardar resultado en `cost`. Si no es fórmula, `source_formula = NULL`. |
| **Requiere Migración** | NO (solo backfill de datos existentes si se re-importa) |
| **Requiere Corrección Código** | SÍ (catalog-parser.ts, tipos de ParsedCatalogRow) |
| **Requiere Decisión Usuario** | NO |

---

### INT-006 — Tabla `ingredients` Carece de Campos de Trazabilidad Celular (`source_cell`, `source_sheet`, `imported_row_id`)

| Campo | Valor |
|-------|-------|
| **Severidad** | ALTA |
| **Evidencia** | Esquema `ingredients` (migración 001): columnas `source_formula` (TEXT) existe, pero NO `source_cell`, `source_sheet`, `imported_row_id`. `imported_rows` tiene `row_index` y `sheet_name` pero no hay FK. |
| **Archivo/Tabla/Campo** | `ingredients` (falta: `source_cell` TEXT, `source_sheet` TEXT, `imported_row_id` UUID REFERENCES `imported_rows(id)`) |
| **Impacto** | Trazabilidad F.7 incompleta: se sabe fila de origen (via join manual por código) pero no celda exacta (ej. "E140") ni hoja. Impide auditoría "cell-level". |
| **Recomendación** | Migración: `ALTER TABLE ingredients ADD COLUMN source_cell TEXT, ADD COLUMN source_sheet TEXT, ADD COLUMN imported_row_id UUID REFERENCES imported_rows(id)`. Poblar en `persist-import-use-case` desde `imported_rows`. |
| **Requiere Migración** | SÍ |
| **Requiere Corrección Código** | SÍ (persist-import-use-case, repository, types) |
| **Requiere Decisión Usuario** | NO |

---

### INT-007 — 34/1000 `recipe_ingredients` con `purchase_unit_cost_raw` Inconsistente

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIA |
| **Evidencia** | Verificación: `ABS(purchase_unit_cost_raw - (purchase_price_cents/100/purchase_quantity)) / expected > 0.001` en 34 filas. Ejemplos graves: HUEVOS 60 GR (qty=30 → $0.128/g vs $0.000642/g, 99.5% diff), HARINA 50 KG (qty=50000 → $0.000744 vs $0.006203, 733%), APANADURA (qty=500 → $0.0018 vs $0.00015, 91.7%). |
| **Archivo/Tabla/Campo** | `recipe_ingredients.purchase_unit_cost_raw`, `purchase_price_cents`, `purchase_quantity` |
| **Impacto** | Costos de receta incorrectos. Errores sugieren confusión de unidades: `purchase_quantity` a veces en gramos, a veces en "unidades de presentación", a veces en kg. |
| **Recomendación** | 1. Validación en repositorio: al insertar/actualizar, verificar consistencia o rechazar. 2. Normalizar `purchase_quantity` a gramos siempre (usar `presentation_normalization` de INT-004). 3. Recalcular `purchase_unit_cost_raw` automáticamente desde `purchase_price_cents` y `purchase_quantity_grams`. |
| **Requiere Migración** | SÍ (corrección de datos + constraint/trigger) |
| **Requiere Corrección Código** | SÍ (repositorio, validación) |
| **Requiere Decisión Usuario** | NO (corrección técnica) |

---

### INT-008 — 15 Ingredientes con Presentación Parseable Pero Sin `purchase_unit_cost_raw`

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIA |
| **Evidencia** | Items con presentación tipo "350 GR", "500 GR", "1 KILO", "KILOS", "UNIDAD (100 GR)" pero `purchase_unit_cost_raw = NULL`. Lista: códigos 2, 3, 4, 13, 31, 37, 38, 41, 127, 252 (QUESO CREMA - ambigua), y 5 más. |
| **Archivo/Tabla/Campo** | `ingredients.presentation`, `ingredients.purchase_unit_cost_raw` |
| **Impacto** | Oportunidad perdida: estos 15 sí permiten cálculo automático de costo/g. Recetas que los usen tendrán que definir manualmente. |
| **Recomendación** | Backfill: `UPDATE ingredients SET purchase_unit_cost_raw = (cost_cents/100.0) / grams_per_unit WHERE purchase_unit_cost_raw IS NULL AND presentation_parseable`. Implementar en script de migración o job. |
| **Requiere Migración** | SÍ (backfill) |
| **Requiere Corrección Código** | SÍ (importación futura debe calcularlo) |
| **Requiere Decisión Usuario** | NO |

---

### INT-009 — Mezcla de Modelos Monetarios: `Money` (centavos) vs `purchase_unit_cost_raw` (float64)

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIA |
| **Evidencia** | `Money` type usa `cents: number` (entero) para todas las operaciones monetarias finales (F.2, F.6). `purchase_unit_cost_raw` es `number` (float64) en `Ingredient`, `RecipeIngredient`, `MealCompositionComponent`. Cálculos de receta: `recipeCost = purchaseUnitCostRaw * recipeQuantity` → acumula error float. No hay conversión explícita a `Money` para totales. |
| **Archivo/Tabla/Campo** | `src/domain/value-objects/money.ts`, `src/domain/entities/recipe.ts`, `src/domain/entities/ingredient.ts`, `src/application/use-cases/*` |
| **Impacto** | Deriva numérica en costos agregados de recetas/platos. Difícil auditar: ¿el total $12.3456 es correcto o error float? F.2 exige centavos enteros para montos finales. |
| **Recomendación** | 1. Mantener `purchase_unit_cost_raw` como NUMERIC(12,6) / float para precisión sub-centavo UNITARIA. 2. Al agregar: `totalCents = Math.round(purchaseUnitCostRaw * quantity * 100)` → `Money`. 3. Añadir helper `Money.fromSubCentavoPerGram(raw, grams)` que haga redondeo controlado. 4. Documentar contrato: "sub-centavo solo para unitarios; totales siempre Money". |
| **Requiere Migración** | NO |
| **Requiere Corrección Código** | SÍ (domain entities, use cases, formula engine) |
| **Requiere Decisión Usuario** | NO (decisión arquitectónica) |

---

### INT-010 — `yield_percentage` NULL en 100% de Recetas y Meal Composition

| Campo | Valor |
|-------|-------|
| **Severidad** | BAJA |
| **Evidencia** | `SELECT COUNT(*) FROM recipe_ingredients WHERE is_active AND yield_percentage IS NOT NULL` → 0. `meal_composition_components` → 0. Default implícito = 1.0 (100%). |
| **Archivo/Tabla/Campo** | `recipe_ingredients.yield_percentage`, `meal_composition_components.yield_percentage`, `meal_composition_components.merma_percentage` |
| **Impacto** | Merma no considerada en costos. Para ingredientes con desperdicio (ej. verduras peladas, huesos), costo real > costo calculado. |
| **Recomendación** | Añadir default `1.0` en migración. Permitir edición en UI. Documentar que 1.0 = sin merma, 0.8 = 20% merma. |
| **Requiere Migración** | SÍ (DEFAULT 1.0) |
| **Requiere Corrección Código** | SÍ (UI, validación 0 < yield ≤ 1) |
| **Requiere Decisión Usuario** | NO |

---

### INT-011 — 29 Patrones de Presentación No Normalizados

| Campo | Valor |
|-------|-------|
| **Severidad** | BAJA |
| **Evidencia** | `SELECT DISTINCT presentation FROM ingredients WHERE is_active` → 45 valores únicos. 29 no parseables a gramos: 'UNIDAD', 'GRAMOS', 'KILOS', 'LIBRA', 'KILO', 'LB', 'CUBETA', 'KIT', 'LT', 'DÓLAR', 'COSTAL', 'BALDE', 'BOTELLA', 'qq', 'ROLLO', 'RESMA', 'GR', 'FUNDA', 'CCF', 'ATADO', '', 'PAQ', 'CAJA', '10 UNIDAD', 'UNIIDAD', '30 UNIDADES', '28 UNIDADES', 'unidad'. |
| **Archivo/Tabla/Campo** | `ingredients.presentation` |
| **Impacto** | Impide automatización de `purchase_unit_cost_raw`. Inconsistencia semántica: "KILOS" vs "KILO" vs "KG"; "UNIDAD" vs "unidad" vs "UNIIDAD". |
| **Recomendación** | Catálogo maestro de presentaciones normalizadas. Migración: `UPDATE ingredients SET presentation = normalized_version WHERE ...`. Constraint/trigger para validar nuevas entradas. |
| **Requiere Migración** | SÍ (limpieza + constraint) |
| **Requiere Corrección Código** | SÍ (validación en importación/UI) |
| **Requiere Decisión Usuario** | SÍ (aprobar mapeo canónico de cada presentación) |

---

### INT-012 — Errores TypeScript `tsc -b` en Archivos de Debug/Preview (38 errores)

| Campo | Valor |
|-------|-------|
| **Severidad** | BAJA |
| **Evidencia** | `npx tsc -b` falla con 38 errores en: `import-preview-types.ts`, `import-preview-use-case.ts`, `debug-catalog.ts`, `debug-recipe.ts`, `debug-refrigerios.ts`, `phase443a-import-preview.ts`. Errores: imports unused, propiedades inexistentes (`Money.amount`, `ImportIncident.rowNumber`), tipos `File` vs `buffer.File`, comparaciones de tipos disjoint. |
| **Archivo/Tabla/Campo** | Archivos en `src/application/use-cases/` y `src/infrastructure/import/parsers/` con prefijo `debug-` o `phase443a-` |
| **Impacto** | No bloquean `vite build` (usa swc/esbuild). Indican código muerto o desactualizado en herramientas de debug/preview. Deuda técnica. |
| **Recomendación** | 1. Eliminar archivos `debug-*.ts` (uso único, ya cumplieron propósito). 2. Corregir o eliminar `phase443a-import-preview.ts` y `import-preview-use-case.ts` si no se usan en producción. 3. Si se conservan, corregir tipos. |
| **Requiere Migración** | NO |
| **Requiere Corrección Código** | SÍ (limpieza o corrección) |
| **Requiere Decisión Usuario** | SÍ (¿conservar herramientas de preview/debug?) |

---

## Resumen por Severidad

| Severidad | Cuenta | IDs |
|-----------|--------|-----|
| CRÍTICA | 3 | INT-001, INT-002, INT-003 |
| ALTA | 3 | INT-004, INT-005, INT-006 |
| MEDIA | 3 | INT-007, INT-008, INT-009 |
| BAJA | 3 | INT-010, INT-011, INT-012 |
| **TOTAL** | **12** | — |

---

## Acciones Requeridas por Tipo

| Tipo | Hallazgos | Comentario |
|------|-----------|------------|
| Requiere Migración | INT-001, INT-002, INT-003, INT-004, INT-006, INT-007, INT-008, INT-010, INT-011 | 9/12 — Mayoría requiere cambios de esquema/datos |
| Requiere Corrección Código | INT-001, INT-002, INT-003, INT-004, INT-005, INT-006, INT-007, INT-008, INT-009, INT-010, INT-011, INT-012 | 12/12 — Todos tocan código |
| Requiere Decisión Usuario | INT-001, INT-003, INT-004, INT-011, INT-012 | 5/12 — Decisiones de negocio/diseño |

---

## Próximos Pasos Sugeridos

1. **Fase 4.4.5 - Migración de Esquema y Datos:** Implementar INT-001, INT-002, INT-003, INT-006 (FKs, trazabilidad, meal composition).
2. **Fase 4.4.6 - Normalización de Presentaciones:** INT-004, INT-008, INT-011 (catálogo de presentaciones, backfill sub-centavo).
3. **Fase 4.4.7 - Parser y Importación:** INT-005 (extraer fórmulas Excel), INT-009 (modelo monetario unificado).
4. **Limpieza Técnica:** INT-012 (eliminar/corregir archivos debug).
5. **Decisiones de Usuario:** Reunión para resolver INT-001 (46 huérfanos), INT-003 (semántica meal composition), INT-004/011 (equivalencias presentación), INT-012 (conservar debug tools).

---

**Fin de Hallazgos**  
Documento generado automáticamente desde evidencia de auditoría de solo lectura.  
Sin escrituras en Supabase realizadas durante esta fase.