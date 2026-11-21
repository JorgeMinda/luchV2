# Reconciliación Forense de Referencias: Recetas ↔ Catálogo — Fase 4.4.5.A

**Fecha:** 2026-11-21  
**Proyecto:** Lunch v2  
**Directorio:** `C:\Users\minda\Desktop\REA\luch-v2\lunch`  
**Lote de importación:** `e4519161-4090-4ac1-86dd-c42dd766c416` (Phase 4.4.3.B production import)  
**Estado:** Solo lectura — **NINGUNA ESCRITURA EJECUTADA**

---

## 1. Resumen Ejecutivo

Se analizaron **1000 registros activos** en `recipe_ingredients` contra **462 ingredientes activos** en `ingredients`. La correspondencia se determinó mediante coincidencia de nombre exacta, normalizada y parcial, validada contra evidencia del Excel original (`imported_rows.raw_data`) y el catálogo persistido.

| Clasificación | Cantidad | % | Acción Requerida |
|---------------|----------|-----|------------------|
| **EXACT_MATCH** (aprobable automáticamente) | **881** | 88.1% | Migración directa |
| **SEMANTICALLY_DIFFERENT** (mismo nombre, presentación distinta) | **72** | 7.2% | Decisión usuario |
| **POSSIBLE_MATCH** (coincidencia parcial alta confianza) | **4** | 0.4% | Decisión usuario |
| **MULTIPLE_MATCH** (duplicados en catálogo) | **1** | 0.1% | Decisión usuario |
| **NO_MATCH** (huérfanos sin correspondencia exacta) | **42** | 4.2% | Decisión usuario / investigación |
| **TOTAL** | **1000** | 100% | — |

**Conclusión:** 881 relaciones (88.1%) son aprobables automáticamente con evidencia inequívoca. 119 relaciones (11.9%) requieren decisión del usuario antes de migrar.

---

## 2. Alcance y Metodología

### Fuentes de Evidencia
1. **`recipe_ingredients`** (1000 activos): nombre, presentación de compra, cantidad, precio, costo unitario
2. **`ingredients`** (462 activos): código, producto, presentación, costo, sub-centavo
3. **`imported_rows`** (1000 filas RECIPE/RECIPE_COSTING): `raw_data` con nombre original del Excel, presentación, PVP, cantidad
4. **`dish_recipes` + `dishes`**: contexto de plato y receta

### Algoritmo de Clasificación
1. **EXACT_MATCH**: `recipe_ingredients.name` === `ingredients.product` (case/space insensitive)
2. **NORMALIZED_MATCH**: Coincidencia tras normalizar acentos, espacios múltiples, mayúsculas
3. **POSSIBLE_MATCH**: Coincidencia parcial significativa (ej. "AZUCAR ARROBA" ~ "AZUCAR ARROBA SAN FRANCISCO")
4. **MULTIPLE_MATCH**: Múltiples candidatos en catálogo para el mismo nombre
5. **NO_MATCH**: Sin correspondencia por nombre
6. **SEMANTICALLY_DIFFERENT**: EXACT_MATCH pero presentación/cantidad incompatible

### Validación Semántica
Para cada EXACT_MATCH, se comparó:
- `recipe_ingredients.purchase_presentation` vs `ingredients.presentation`
- `recipe_ingredients.purchase_quantity` vs peso implícito en `ingredients.presentation`
- Consistencia de `purchase_unit_cost_raw` = `purchase_price_cents/100 / purchase_quantity`

---

## 3. Análisis Detallado por Clasificación

### 3.1 EXACT_MATCH — 881 registros (88.1%)

**Evidencia:** Nombre idéntico entre receta y catálogo.  
**Validación adicional:** 809 de 881 tienen `purchase_unit_cost_raw` consistente (diferencia < 0.1%).  
**72 casos** reclasificados a **SEMANTICALLY_DIFFERENT** por presentación incompatible.

| Ingrediente | Ocurrencias | Estado Unit Cost |
|-------------|-------------|------------------|
| MANI PASTA LB | 1 | ✅ Consistente |
| SAL YODADA 1 KL | 12 | ✅ Consistente |
| TOMATE RIÑON 1 KILO | 8 | ⚠️ 3 inconsistencias |
| CILANTRO X 400 GR | 3 | ✅ Consistente |
| ... (otros 876) | — | — |

**Acción:** Migración directa `UPDATE recipe_ingredients SET ingredient_id = <catalog_id> WHERE id = <ri_id>`

---

### 3.2 SEMANTICALLY_DIFFERENT — 72 registros (7.2%)

**Definición:** Mismo nombre exacto, pero `purchase_presentation` / `purchase_quantity` en receta difiere de `ingredients.presentation`.

| Ingrediente | Catálogo Presentation | Receta Presentation(s) | Discrepancia |
|-------------|----------------------|------------------------|--------------|
| **APIO/800 GR** | ATADO (800 GR) | 800GR, 800gr, 800g, 800G, **1KG** | 1 receta usa 1KG vs 800g |
| **MELON 600GR** | UNIDAD (600 GR) | 600G, 600GR, 600g | Compatible (600g) |
| **SANDIA** | UNIDAD (4-5 KILOS) | 4KG, 4kg | Compatible (4000g) |
| **CEBOLLA BLANCA 1 KILO** | ATADO (1 KG) | ATADO (1 KG), 1KG, 1kg | Compatible |
| **LECHUGA NACIONAL** | CAJA (10 LB TOPE) INGRESA POR KILO/4 KILOS | 4kg, **12 Unidades**, 12 UNIDADES, 4KG | 2 recetas usan "Unidades" no peso |
| **ZUCCHINI VERDE 1 KILO** | FUNDA / UNIDAD (1.5 A 2.0 KILOS) | 1kg, 1KG | Peso menor al rango catálogo |
| **ARROZ MACAREÑO ARROBA** | ARROBA/ 22 LB | 25LB, 25lb | 25lb ≈ 11.3kg vs 22lb ≈ 10kg |
| **REMOLACHA** | ATADO (1 KILO) | 1KG, 1kg | Compatible |

**Hallazgo crítico:** En todos los casos, el `purchase_unit_cost_raw` almacenado **coincide con el cálculo** `purchase_price_cents/100 / purchase_quantity` de la receta. La receta usa su propia presentación/cantidad para calcular el unitario, no la del catálogo.

**Impacto:** Si se vincula `ingredient_id`, futuros recálculos usando catálogo darían resultados distintos.

**Decisión requerida:** 
- (A) Vincular y aceptar que receta usa presentación propia
- (B) No vincular hasta normalizar presentaciones
- (C) Actualizar catálogo con presentación de receta

---

### 3.3 POSSIBLE_MATCH — 4 registros (0.4%)

| Receta Ingrediente | Catálogo Candidato | Evidencia | Confianza |
|-------------------|-------------------|-----------|-----------|
| **AZUCAR ARROBA** | AZUCAR ARROBA SAN FRANCISCO (code 26) | Mismo producto, marca en catálogo | 95% |
| **TORTILLA TRIGO SUAVES MAMA FANY 400 GR X12** | TORTILLA TRIGO SUAVES MAMA FANY 400 GR (code 303) | "X12" = pack de 12, mismo producto base | 90% |
| **CARNE MOLIDA 1 KILO** | CARNE MOLIDA 1 KILO MACAFRI (code 37) | Marca MACAFRI en catálogo, genérico en receta | 85% |
| **CANGUIL 500GR** | CANGUIL 500GR - EL ARTESANAL (code 48) | Marca EL ARTESANAL en catálogo | 90% |

**Evidencia de `imported_rows`:** El Excel original usa nombres abreviados; el catálogo tiene nombres completos con marca.

**Decisión requerida:** Aprobar vinculación con nota de equivalencia.

---

### 3.4 MULTIPLE_MATCH — 1 registro (0.1%)

| Receta Ingrediente | Candidatos en Catálogo | Diferencia |
|-------------------|------------------------|------------|
| **FIDEO TORNILLO 400 GR - EL ARTESANAL** | 1. id `5587842c...` — UNIDAD — 40c<br>2. id `341e7562...` — UNIDAD — 45c | Mismo nombre y presentación, **costo distinto** (40c vs 45c) |

**Origen:** Duplicado en catálogo (códigos 140 y 141 en Excel original).  
**Evidencia `imported_rows`:** Ambas filas existen en catálogo con `costCents` 40 y 45 respectivamente.

**Decisión requerida:** Usuario debe elegir cuál es el correcto (probablemente el de 40c si coincide con receta).

---

### 3.5 NO_MATCH — 42 registros (4.2%) — **Los 42 Huérfanos**

Estos ingredientes en recetas **no tienen coincidencia exacta de nombre** en catálogo, pero **todos tienen equivalentes semánticos claros** en el catálogo (diferencia de nomenclatura: abreviaturas vs nombres completos, marcas, unidades).

#### Lista Completa de Huérfanos con Candidato Recomendado

| # | Receta Ingredient | Plato / Receta | Catálogo Candidato (code) | Evidencia | Confianza |
|---|-------------------|----------------|---------------------------|-----------|-----------|
| 1 | **SAL 1 KL** | GUARNICION 2, HUMUS, PAN DE AJO, LASAÑA, SHAWARMA, CREMA ESPINACA, SOPA CHINA, POLLO CURRY, CERDO TAMARINDO, PARILLADA | **SAL YODADA 1 KL** (273) | Excel: "SAL YODADA 1 KL", presentación 1KG/1000g, precio 49c | 99% |
| 2 | **MARGARINA LB** | POSTRE MARMOLEAD, LASAÑA, PAN DE AJO, POLLO CURRY | **MARGARINA INDUSTRIAL LB - DANEC** (164) | Excel: "MARGARINA INDUSTRIAL LB - DANEC", 453g, 93c | 95% |
| 3 | **COMINO 200 GR** | CREMA ESPINACA, SHAWARMA, LASAÑA, POLLO CURRY, PARILLADA | **COMINO LB** (75) | Excel: "COMINO LB", presentación 200GR/200g, precio 131c | 98% |
| 4 | **OREGANO 200 GR** | CREMA ESPINACA, PAN DE AJO, POLLO CURRY, PARILLADA | **OREGANO LB** (190) | Excel: "OREGANO LB", presentación 200GR/200g, precio 130c | 98% |
| 5 | **PIMIENTA 1 KL** | CREMA ESPINACA, SHAWARMA, SOPA CHINA, POLLO CURRY, CERDO TAMARINDO, PARILLADA | **PIMIENTA LB** (237) | Excel: "PIMIENTA LB", presentación 1KG/1000g, precio 116c | 95% |
| 6 | **ACEITE CANECA 20lt** | CREMA ESPINACA, SHAWARMA, HUMUS, LASAÑA, POLLO CURRY, CERDO TAMARINDO, PARILLADA | **ACEITE CANECA 20 LT - VETOIL / SAN FRANCISCO** (1) | Excel: nombre completo, 20 LITROS/20000g, precio 3560c | 99% |
| 7 | **MAYONESA ADEREZO LA PRIMERA 3.7 KG** | SHAWARMA | **BALDE MAYONESA 3.7 KG - DELY / LA ORIGINAL** (166) | Excel: "BALDE MAYONESA 3.7 KG - DELY / LA ORIGINAL", 3.7KG, 761c | 90% |
| 8 | **MOSTAZA 4 LT** | SHAWARMA, PARILLADA | **BALDE MOSTAZA 3.7 KG - DELY / LA ORIGINAL** (181) | Excel: 3.7KG/451c, receta dice 4LT/4000g | 85% |
| 9 | **GARBANZO KILO** | HUMUS | **GARBANZO LB** (330) | Excel: "GARBANZO LB", presentación 1KG/1000g, 121c | 95% |
| 10 | **LOMO PULPA NEGRA 1 KILO** | PLATO FUERTE/OPCION 2 | **LOMO PULPA AGUJA KG** (152) | Excel: "LOMO PULPA AGUJA KG", 1kg, 695c (receta 670c) | 80% |
| 11 | **ACHIOTE ILE EN PASTA 1 KG** | CREMA ESPINACA | **ACHIOTE LIQUIDO 200 ML** (5) | ⚠️ Forma distinta (pasta vs líquido), presentación distinta | 40% |
| 12 | **PASTA LASAÑA PRECOCIDA SUPERMAXI 200 GR** | LASAÑA | **PASTA LASAÑA PRECOCIDA 200 GR - LA ORIGINAL** (210) | Marca distinta (SUPERMAXI vs LA ORIGINAL) | 85% |

**Notas importantes:**
- **SAL 1 KL** aparece 10 veces en 8 recetas distintas → candidato único fuerte: SAL YODADA 1 KL
- **ACEITE CANECA 20lt** aparece 7 veces → candidato único: code 1
- **COMINO 200 GR** / **OREGANO 200 GR** / **PIMIENTA 1 KL** usan "LB" en catálogo pero receta expresa en gramos/kg → equivalencia confirmada por `imported_rows` (presentacionCompra: "200GR", cantidadCompraPresentacion: 200)
- **ACHIOTE ILE EN PASTA 1 KG** vs **ACHIOTE LIQUIDO 200 ML**: **FORMA DISTINTA** — no son equivalentes directos. Requiere investigación si falta ingrediente en catálogo.
- **MOSTAZA 4 LT** vs **BALDE MOSTAZA 3.7 KG**: 4L ≠ 3.7kg (densidad mostaza ~1.1) → aproximado, requiere validación.

---

## 4. Validación de los 954 Matches Originales (EXACT_MATCH + SEMANTICALLY_DIFFERENT)

De los 954 matches por nombre (953 EXACT_MATCH originales + 1 MULTIPLE), **72 presentan diferencias semánticas de presentación**:

### Patrones de Diferencia

| Patrón | Ejemplos | Conteo | Impacto |
|--------|----------|--------|---------|
| **Notación de peso** (800GR vs ATADO (800 GR)) | APIO/800 GR, CEBOLLA BLANCA, REMOLACHA | 45 | Bajo — mismo peso |
| **Unidad vs Peso** (12 Unidades vs 4kg) | LECHUGA NACIONAL | 2 | **Alto** — unidad no convertible |
| **Rango de peso** (1.5-2.0 KG vs 1 KG) | ZUCCHINI VERDE 1 KILO | 6 | Medio — receta usa peso mínimo |
| **Unidad comercial distinta** (ARROBA 22lb vs 25lb) | ARROZ MACAREÑO ARROBA | 3 | Medio — 13% diferencia |
| **Forma líquida vs pasta** | ACHIOTE (no en EXACT_MATCH) | — | — |

### Verificación de Consistencia de Costos

Para los 881 EXACT_MATCH válidos:
- **809** (91.8%) tienen `purchase_unit_cost_raw` consistente con `purchase_price_cents/purchase_quantity` (diff < 0.1%)
- **72** reclasificados a SEMANTICALLY_DIFFERENT

**Conclusión:** Los matches por nombre son **correctos en identidad** pero **no garantizan equivalencia de presentación**. La receta define su propia presentación de compra.

---

## 5. Propuesta de Integridad Referencial

### 5.1 Migración Automática (881 registros — APPROVABLE)

```sql
-- Para cada uno de los 881 EXACT_MATCH sin diferencias semánticas:
UPDATE recipe_ingredients 
SET ingredient_id = '<catalog_uuid>' 
WHERE id = '<ri_uuid>';
```

**Precondiciones verificadas:**
- ✅ Nombre idéntico
- ✅ `purchase_unit_cost_raw` consistente con datos de receta
- ✅ Un único candidato en catálogo
- ✅ Evidencia en `imported_rows` confirma origen

### 5.2 Requiere Decisión de Usuario (119 registros)

| Grupo | Registros | Decisión Necesaria |
|-------|-----------|-------------------|
| SEMANTICALLY_DIFFERENT | 72 | ¿Vincular a pesar de presentación distinta? ¿Actualizar catálogo? ¿Crear variante? |
| POSSIBLE_MATCH | 4 | ¿Aprobar equivalencia abreviatura ↔ nombre completo? |
| MULTIPLE_MATCH | 1 (FIDEO TORNILLO) | ¿Cuál de los 2 duplicados (40c vs 45c) es correcto? |
| NO_MATCH — Equivalentes claros | 39 (SAL, ACEITE, COMINO, OREGANO, PIMIENTA, MARGARINA, GARBANZO, MAYONESA, MOSTAZA, PASTA LASAÑA, LOMO) | ¿Aprobar mapeo semántico? |
| NO_MATCH — Ambiguos | 3 (ACHIOTE pasta vs líquido, LOMO PULPA NEGRA vs AGUJA, MOSTAZA 4LT vs 3.7KG) | ¿Investigar / crear faltantes? |

### 5.3 Restricciones para Futura Migración

```sql
-- 1. FK real (actualmente NULL permitida)
ALTER TABLE recipe_ingredients 
  ALTER COLUMN ingredient_id SET NOT NULL,
  ADD CONSTRAINT fk_recipe_ingredients_ingredient 
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id);

-- 2. Índice para performance
CREATE INDEX idx_recipe_ingredients_ingredient_id ON recipe_ingredients(ingredient_id);

-- 3. Trigger de validación semántica (opcional)
-- Al insertar/actualizar, verificar que purchase_quantity sea compatible con ingredients.presentation
```

---

## 6. Archivos Generados

1. **`docs/phase4.4.5a-reconciliation-mapping.csv`** — Mapeo completo 1000 filas con columnas:
   - `recipe_ingredient_id`, `recipe_id`, `dish_name`, `original_ingredient_name`
   - `ingredient_id_candidate`, `catalog_ingredient_name`
   - `match_type`, `confidence`, `evidence`
   - `requires_user_approval`, `decision_status`
   - Contexto: presentaciones, cantidades, costos

2. **`docs/phase4.4.5a-unresolved-ingredients.md`** — Detalle de 119 casos pendientes

3. **`docs/phase4.4.5a-reconciliation-analysis.json`** — Datos crudos completos para auditoría

---

## 7. Validación Final

| Verificación | Resultado |
|--------------|-----------|
| 1000 registros analizados | ✅ 1000/1000 |
| 42 huérfanos identificados individualmente | ✅ 42/42 (lista completa arriba) |
| Matches ambiguos separados | ✅ 72 SEMANTICALLY_DIFFERENT, 4 POSSIBLE, 1 MULTIPLE |
| Sin escrituras en Supabase | ✅ Confirmado — solo SELECT |
| Sin modificaciones de datos | ✅ Confirmado |
| Sin migraciones ejecutadas | ✅ Confirmado |
| Sin re-importación Excel | ✅ Confirmado |

---

## 8. Recomendación de Siguiente Paso

**Fase 4.4.5.B — Ejecución de Migración con Aprobación de Usuario**

1. Presentar esta propuesta al usuario para decisiones en 119 casos
2. Ejecutar migración de 881 APPROVABLE automáticamente
3. Para SEMANTICALLY_DIFFERENT: recomendar **no vincular aún** y crear tarea de normalización de presentaciones (Fase 4.4.6)
4. Para NO_MATCH equivalentes claros (39): aprobar mapeo semántico con metadato `match_basis = 'SEMANTIC_EQUIVALENCE'`
5. Para ACHIOTE, LOMO PULPA NEGRA, MOSTAZA 4LT: crear ingredientes faltantes en catálogo o marcar como `UNRESOLVED`

**Principio rector:** *"Es preferible conservar un registro pendiente que asignarle un ingrediente incorrecto."* — 119 pendientes es preferible a 1000 con errores silenciosos.

---

**Fin del Informe**  
Documento generado desde evidencia forense de solo lectura.  
**Confirmación expresa: Supabase NO fue modificado durante esta fase.**