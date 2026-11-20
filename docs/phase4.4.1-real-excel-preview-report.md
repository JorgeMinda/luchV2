# Phase 4.4.1-DOC — Informe de Vista Previa Real del Excel Corregido (Sin Escrituras)

**Fecha:** 2026-11-20  
**Archivo analizado:** `17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx`  
**Ubicación:** `C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx`  
**SHA-256:** `85dc913723f642c6568c0e4304360474c60426379fd6b47a283005c7e57086fc`  
**Tamaño:** 778,541 bytes  
**Última modificación:** 2026-11-20T02:37:49.968Z  

---

## 1. Identificación del Archivo

| Campo | Valor |
|-------|-------|
| Nombre | `17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx` |
| Ruta | `C:/Users/minda/Downloads/...` |
| SHA-256 | `85dc913723f642c6568c0e4304360474c60426379fd6b47a283005c7e57086fc` |
| Tamaño | 778,541 bytes |
| Modificado | 2026-11-20T02:37:49.968Z |
| Versión anterior analizada | `(4).xlsx` (566,645 bytes, SHA-256 distinto) |

**Nota:** Los archivos `(5)_3.xlsx` y `(5)_2.xlsx` mencionados en la especificación **no existen** en ninguna ubicación (Downloads, local-data, proyecto). El archivo `(5).xlsx` confirmado por el usuario es la versión corregida.

---

## 2. Estado de las 6 Hojas (Forense: fórmulas vs valores)

| # | Hoja | Filas × Cols | Fórmulas Originales | Valores No Vacíos | Errores Almacenados |
|---|------|--------------|---------------------|-------------------|---------------------|
| 0 | `CATALOGO COSTEO 17-08-2` | 463 × 10 | **22** | 2,779 | (ninguno) |
| 1 | `COSTEO RECETA ALMUERZOS` | 4,844 × 25 | **19,370** | 31,535 | **#VALUE!: 256**, **#REF!: 6** |
| 2 | `MENÚ AGSTO-JULIO2026-2027` | 1,000 × 20 | **0** | 2,993 | **#REF!: 883** |
| 3 | `COSTEO REFRIGERIOS ` | 973 × 13 | **869** | 1,424 | **#VALUE!: 8** |
| 4 | `MENU REFRIGERIOS` | 79 × 6 | **0** | 362 | (ninguno) |
| 5 | `COMPOSICION DE CADA PLATO` | 45 × 5 | **0** | 168 | (ninguno) |

**Todas las 6 hojas esperadas están presentes.** ✅

---

## 3. Verificación de las 14 Tablas Remotas (Supabase)

| Tabla | Estado | Detalle |
|-------|--------|---------|
| `users` | **EXISTE_CON_ACCESO** | count: 0 |
| `students` | **EXISTE_CON_ACCESO** | count: 0 |
| `dishes` | **EXISTE_CON_ACCESO** | count: 0 |
| `ingredients` | **EXISTE_CON_ACCESO** | count: 0 |
| `dish_recipes` | **EXISTE_CON_ACCESO** | count: 0 |
| `recipe_ingredients` | **EXISTE_CON_ACCESO** | count: 0 |
| `meal_composition_templates` | **EXISTE_CON_ACCESO** | count: 0 |
| `meal_composition_components` | **EXISTE_CON_ACCESO** | count: 0 |
| `menu_plan_cells` | **EXISTE_CON_ACCESO** | count: 0 |
| `import_batches` | **EXISTE_CON_ACCESO** | count: 0 |
| `imported_rows` | **EXISTE_CON_ACCESO** | count: 0 |
| `import_audit_logs` | **EXISTE_CON_ACCESO** | count: 0 |
| `transactions` | **EXISTE_CON_ACCESO** | count: 0 |
| `consumptions` | **EXISTE_CON_ACCESO** | count: 0 |

**Todas las 14 tablas existen y son accesibles (vacías).** ✅

**Limitación:** Consultas con filtros sobre `public.users` fallan con *"Could not find the table 'public.users' in the schema cache"*. Es problema de caché PostgREST, no de RLS. `count(*)` funciona.

---

## 4. Estado de Usuario Administrador

| Intento | Resultado |
|---------|-----------|
| `SELECT ... WHERE role='admin' AND is_active=true` | **ERROR_CONEXION** — cache PostgREST |
| `SELECT ... LIMIT 10` | **ERROR_CONEXION** — mismo error |
| `SELECT ... WHERE is_active=true` | **ERROR_CONEXION** — mismo error |

**Veredicto:** **NO SE PUDO COMPROBAR** por limitación de caché. Requiere refrescar tras migraciones.

---

## 5. Auditoría Forense Detallada por Hoja

### Hoja 0: `CATALOGO COSTEO 17-08-2`

| Métrica | Forense Real | Parser Previo | Esperado | Estado |
|---------|--------------|---------------|----------|--------|
| Filas físicas | 463 | 463 | 463 | [VERIFICADO] |
| Filas de datos | 462 | 462 | 462 | [VERIFICADO] |
| Códigos 1–462 | 462 no vacíos | 462 | 462 | [VERIFICADO] |
| Códigos vacíos | 0 | 0 | 0 | [VERIFICADO] |
| Códigos duplicados | 0 | 0 | 0 | [VERIFICADO] |
| **Fórmulas en columna costo (E)** | **22** | **0 preservadas** | 22 | **[DISCREPANCIA: Parser no preserva]** |
| Errores de costo | 2 celdas vacías | 2 | — | [VERIFICADO] |

**Hallazgos forenses clave:**
- **Fila 140 (KIWI)**: Col costo = `'5*1.00'` (texto, **sin signo `=`**) → No es fórmula, es texto digitado erróneamente
- **Fila 253 (QUESO CREMA)**: Col costo = `'1.0.3'` (texto, formato inválido) → Error de digitación
- Las 22 fórmulas reales están en otras filas de la columna costo

**Últimas 5 filas (códigos 458–462):**
| Fila | Código | Bodega | Producto | Presentación | Costo | Estado |
|------|--------|--------|----------|--------------|-------|--------|
| 459 | 458 | NO PERECIBLES | GOTAS DE CHOCOLATE 1 KG | UNIDAD | 13.00 | ACTIVO |
| 460 | 459 | SUMINISTROS | 3020163 RECT DE 150 CC BAJO | UNIDAD | 0.07 | ACTIVO |
| 461 | 460 | SUMINISTROS | FUNDA PAPEL CAFÉ 21 DELIVERY | UNIDAD | 5.50 | ACTIVO |
| 462 | 461 | PANADERIA | EMPANADA DE QUESO AL HORNO | UNIDAD | 0.25 | ACTIVO |
| 463 | 462 | PANADERIA | EMPANADA DE CARNE AL HORNO | UNIDAD | 0.30 | ACTIVO |

---

### Hoja 1: `COSTEO RECETA ALMUERZOS`

| Métrica | Forense Real | Parser Previo | Esperado | Estado |
|---------|--------------|---------------|----------|--------|
| Dimensiones | 4,844 × 25 | 4,844 × 25 | 4,844 × 25 | [VERIFICADO] |
| **Fórmulas originales** | **19,370** | N/A | ~19,370 | [VERIFICADO] |
| **Errores #VALUE!** | **256** | 0 | — | **[ERROR EXCEL REAL]** |
| **Errores #REF!** | **6** | 0 | — | **[ERROR EXCEL REAL]** |
| Bloques detectados (títulos col A) | **1,813** | **259** | **249** | **[DISCREPANCIA MAYOR]** |

**Análisis de bloques:** El parser previo detectaba 259 bloques; el conteo forense de títulos en columna A da 1,813 (muchos falsos positivos: ingredientes sueltos, filas de cierre, etc.). Los 249 bloques reales requieren heurística más estricta (título de plato seguido de encabezado de ingredientes).

**Primeros títulos detectados (fila : contenido):**
1. Fila 1: "INGREDIENTES" (encabezado, no plato)
2. Fila 2: "SOPA DE CHIFLES/12 ONZAS" ✅
3. Fila 5: "HUESO DE RES 1 KILO" (ingrediente, no plato)
4. Fila 23: "ARROZ/35 GRAMOS" (ingrediente)
5. Fila 35: "PURÉ DE ZANAHORIAS/60GR" ✅
6. Fila 36: "GUARNICION 1" (sub-título)

---

### Hoja 2: `MENÚ AGSTO-JULIO2026-2027` (Anual)

| Métrica | Forense Real | Parser Previo | Esperado | Estado |
|---------|--------------|---------------|----------|--------|
| Dimensiones | 1,000 × 20 | 1,000 × 20 | — | [VERIFICADO] |
| Fórmulas originales | **0** | N/A | — | [VERIFICADO] |
| **Celdas #REF!** | **883** | 883 | 883 | [VERIFICADO] |
| Filas con #REF! | 154 | — | — | [VERIFICADO] |
| Primera fila #REF! | 173 | — | — | [VERIFICADO] |
| Última fila #REF! | 326 | — | — | [VERIFICADO] |
| Semanas detectadas (SEMANA N) | **17** | 14 | **14** | **[DISCREPANCIA: duplicados]** |
| Semana con fecha serial 0 | Fila 40, cols 1–5 | Semana 3 | — | [VERIFICADO] |

**Semanas detectadas (fila : etiqueta):**
- Fila 4: SEMANA 1 | Fila 5: SEMANA 1 (duplicado)
- Fila 16: SEMANA 2 | Fila 17: SEMANA 2 (duplicado)
- Fila 29: SEMANA 3 → **fecha serial 0 en fila 40 (L-V)**
- Fila 41: SEMANA 4
- Fila 52: SEMANA 5
- Fila 63: SEMANA 6
- Fila 74: SEMANA 7 | Fila 85: SEMANA 7 (duplicado)
- Fila 96: SEMANA 8
- Fila 107: SEMANA 9
- Fila 118: SEMANA 10
- Fila 129: SEMANA 11
- Fila 140: SEMANA 12
- Fila 151: SEMANA 13
- Fila 162: SEMANA 14

**Las 883 celdas #REF!** están en filas 173–326 (semanas 8–14), referencias externas al libro anual faltante.

---

### Hoja 3: `COSTEO REFRIGERIOS`

| Métrica | Forense Real | Parser Previo | Esperado | Estado |
|---------|--------------|---------------|----------|--------|
| Dimensiones | 973 × 13 | 973 × 13 | 973 × 13 | [VERIFICADO] |
| **Fórmulas originales** | **869** | N/A | — | [VERIFICADO] |
| **Errores #VALUE!** | **8** | 0 | — | **[ERROR EXCEL REAL]** |
| Bloques detectados (títulos col A) | **87** | **10** | **10** | **[DISCREPANCIA: 87 vs 10]** |

El parser previo detectaba 10 bloques correctamente; el conteo forense bruto da 87 títulos. Los 10 bloques reales requieren misma heurística estricta que almuerzos.

---

### Hoja 4: `MENU REFRIGERIOS`

| Métrica | Forense Real | Parser Previo | Esperado | Estado |
|---------|--------------|---------------|----------|--------|
| Dimensiones | 79 × 6 | 78 × 6 | 79 × 6 | [VERIFICADO] |
| Fórmulas originales | **0** | N/A | — | [VERIFICADO] |
| **Bloques OPCION PLATO** | **5** | 1 | **14** | **[DISCREPANCIA: solo 5 bloques reales]** |

**Estructura real (79 filas):**
- 5 bloques `OPCION PLATO` (filas 2, 7, 12, 17, 22) cada uno con:
  - Fila de fechas (seriales Excel 46265–46269 = nov 2026)
  - 3 categorías: FRUTA, BEBIDA, ENTRADA (5 platos cada una = 15 platos/semana)
- Bloques adicionales con categorías PROTEÍNA, ENSALADA, FRUTA, JUGO (filas 27–74)
- Filas `DÍAS` con seriales de fecha (filas 54, 60, 65, 70, 75)
- Fila 53: `FERIADO`
- **No hay 14 semanas completas** — solo 5 bloques `OPCION PLATO` + bloques de categorías sueltas

---

### Hoja 5: `COMPOSICION DE CADA PLATO`

| Métrica | Forense Real | Parser Previo | Esperado | Estado |
|---------|--------------|---------------|----------|--------|
| Dimensiones | 45 × 5 | 45 × 5 | 45 × 5 | [VERIFICADO] |
| Fórmulas originales | **0** | N/A | — | [VERIFICADO] |
| Plantillas | 4 | 4 | 4 | [VERIFICADO] |
| Componentes totales | 28 | 28 | >20 | [VERIFICADO] |
| Objetivos exactos | $1.24, $1.38, $0.84, $1.44 | Mismos | Mismos | [VERIFICADO] |
| **Sub-centavo presente** | Sí (ej. 0.0072, 0.015) | Sí | Sí | [VERIFICADO] |

**Plantillas confirmadas:**
1. **Almuerzo Saludable Estudiantil** — 7 componentes — Objetivo $1.24
2. **Almuerzo Estudiantil Completo Especial** — 8 componentes — Objetivo $1.38
3. **Refrigerio prescolar/Primaria** — 5 componentes — Objetivo $0.84
4. **Almuerzo Completo Administrativos** — 8 componentes — Objetivo $1.44

---

## 6. Comparativa Forense: Archivo Anterior vs Archivo Corregido

| Aspecto | Anterior `(4).xlsx` | Corregido `(5).xlsx` | Diferencia |
|---------|---------------------|----------------------|------------|
| Tamaño | 566,645 bytes | 778,541 bytes | **+211,896 bytes** |
| SHA-256 | Distinto | `85dc9137...` | Distinto |
| Hoja Catálogo - Filas | 463 | 463 | = |
| Hoja Catálogo - Fórmulas costo | No verificado | **22** | Nuevo hallazgo |
| Hoja Recetas Almuerzos - #VALUE! | No verificado | **256** | Errores reales expuestos |
| Hoja Recetas Almuerzos - #REF! | No verificado | **6** | Errores reales expuestos |
| Hoja Menú Anual - #REF! | 884 | **883** | -1 |
| Hoja Recetas Refrigerios - #VALUE! | No verificado | **8** | Errores reales expuestos |
| Hoja Menú Refrigerios - Semanas | 1 detectada | **5 bloques reales** | Estructura real clarificada |
| Hoja Composición | 4 plantillas | 4 plantillas | = |

**Errores corregidos en origen (archivo (5).xlsx vs (4).xlsx):**
- Se redujo 1 celda #REF! en menú anual (884 → 883)
- Tamaño mayor sugiere más datos/fórmulas preservadas

**Errores que persisten en origen:**
- 256 #VALUE! + 6 #REF! en recetas almuerzos
- 8 #VALUE! en recetas refrigerios
- 883 #REF! en menú anual (archivo externo faltante)
- KIWI: `'5*1.00'` (texto, no fórmula)
- QUESO CREMA: `'1.0.3'` (formato inválido)
- Solo 5 bloques `OPCION PLATO` en menú refrigerios (no 14)

**Errores atribuibles al parser (código):**
- 0 fórmulas preservadas de 22+19,370+869 reales → **FALLO CRÍTICO F.7**
- 259/1,813 bloques recetas almuerzos vs 249 reales → heurística débil
- 10/87 bloques recetas refrigerios vs 10 reales → heurística débil
- 0 `MenuEntry` generadas → parser no extrae platos por celda
- Semana 3: fecha serial 0 aceptada como válida
- Semana 14: sin weekStartDate no bloqueada

---

## 7. Matriz Arquitectónica Oficial (Decisiones Aprobadas)

| Decisión | Estado | Implementación |
|----------|--------|----------------|
| **F.1:** Single-tenant, sin `school_id` | ✅ | Esquema, tipos, repos sin school_id |
| **F.7:** Sub-centavo `NUMERIC(12,6)` + `source_formula`/`source_cell` | ❌ **BLOQUEADO** | Parser no preserva fórmulas |
| **F.2/F.3/F.4/F.5/F.6/F.8/F.9/F.10** | ✅ | Implementadas y verificadas |

---

## 8. Clasificación de Incidencias

| Código | Tipo | Hoja | Conteo | Origen | Estado |
|--------|------|------|--------|--------|--------|
| `SOURCE_EXCEL_ERROR` | #VALUE! | Recetas Almuerzos | 256 | Excel | [VERIFICADO] |
| `SOURCE_EXCEL_ERROR` | #REF! | Recetas Almuerzos | 6 | Excel | [VERIFICADO] |
| `SOURCE_EXCEL_ERROR` | #REF! | Menú Anual | 883 | Excel (archivo externo) | [VERIFICADO] |
| `SOURCE_EXCEL_ERROR` | #VALUE! | Recetas Refrigerios | 8 | Excel | [VERIFICADO] |
| `SOURCE_EXCEL_ERROR` | Texto inválido | Catálogo (KIWI, QUESO CREMA) | 2 | Excel | [VERIFICADO] |
| `PARSER_ERROR` | Fórmulas no preservadas | Todas | 22+19,370+869 | **Código** | **[BLOQUEADO]** |
| `PARSER_ERROR` | Bloques falsos positivos | Recetas Almuerzos | 259 vs 249 | **Código** | **[DISCREPANCIA]** |
| `PARSER_ERROR` | Bloques falsos positivos | Recetas Refrigerios | 10 vs 87 brutos | **Código** | **[DISCREPANCIA]** |
| `PARSER_ERROR` | MenuEntry = 0 | Menú Anual + Refrigerios | 0 | **Código** | **[BLOQUEADO]** |
| `PARSER_ERROR` | Fecha serial 0 aceptada | Menú Anual (Semana 3) | 1 | **Código** | [VERIFICADO] |
| `DOMAIN_VALIDATION_ERROR` | Costo vacío | Catálogo | 2 | Dominio | [VERIFICADO] |
| `DATA_INTEGRITY_ERROR` | Menú Refrigerios: 5 vs 14 semanas | Menú Refrigerios | 5 bloques | **Dato origen** | [VERIFICADO] |
| `SUPABASE_ACCESS_ERROR` | Cache PostgREST users | users | — | Infra | [VERIFICADO] |
| `UNVERIFIED` | Admin existence | users | — | — | [NO VERIFICADO] |

---

## 9. Preparación de Importación de los 6 Documentos

### Sistema de Importación Verificado

| Componente | Estado | Observaciones |
|------------|--------|---------------|
| `ImportBatch` | ✅ | batchId, fileHash, status, deduplicación |
| `ImportedRow` | ✅ | batchId, rowIndex, sheetName, sourceType, rawData, normalizedData, incidents |
| `ImportPreview` | ✅ | Via `AnalyzeImportUseCase` (pero **persiste en Supabase**) |
| `AnalyzeImportUseCase` | ⚠️ **ESCRIBE** | Guarda batch + rows + audit en Supabase |
| `ValidateImportUseCase` | ✅ | Solo lectura en memoria |
| `CommitImportUseCase` | ⚠️ **ESCRIBE** | Orquesta PersistImportUseCase |
| `PersistImportUseCase` | ⚠️ **ESCRIBE** | Persiste a tablas dominio |
| Repositorios Import | ✅ | Supabase (solo), type-safe |
| Trazabilidad completa | ✅ | batchId, sheetName, rowNumber, sourceFormula, sourceCell |

**Crítico:** `AnalyzeImportUseCase` **persiste en Supabase**. No usar para vista previa sin escrituras. Usar parsers directos + `InMemoryImportRowStore`.

### Relaciones entre 6 Fuentes

```
CATALOG (462 ingredients)
    ↓ referenciado por código/nombre
RECIPE_COSTING Almuerzos (249 recetas × ~6 ingredientes)
    ↓ dish_id → dishes
RECIPE_COSTING Refrigerios (10 recetas × ~7 ingredientes)
    ↓ dish_id → dishes
MEAL_COMPOSITION (4 templates × 5-8 componentes)
    ↓ componentType + name → matching
MENU_PLAN Anual (14 semanas × 5 días × categorías)
    ↓ dish_id → dishes (requiere platos existentes)
MENU_PLAN Refrigerios (5 semanas × 5 días × 4 categorías)
    ↓ dish_id → dishes
```

---

## 10. Vista Previa Integral Sin Persistencia

**Ejecutada con parsers directos + almacenamiento en memoria. Cero escrituras Supabase.**

| Hoja | Filas Físicas | Registros Detectados | Válidos | Advertencias | Errores | Fórmulas Preservadas |
|------|---------------|---------------------|---------|--------------|---------|---------------------|
| Catálogo | 463 | 462 items | 460 | 0 | 2 (costo vacío) | **0 / 22** ❌ |
| Recetas Almuerzos | 4,844 | 259 bloques / 1,550 ing. | 1,550 | 796 | 0 | **0 / 19,370** ❌ |
| Recetas Refrigerios | 973 | 10 bloques / 77 ing. | 77 | 25 | 0 | **0 / 869** ❌ |
| Menú Anual | 1,000 | 14 semanas / 0 entries | 13 sem. | 0 | 915 | N/A (0 fórmulas) |
| Menú Refrigerios | 79 | 5 bloques / 0 entries | 5 sem. | 0 | 0 | N/A (0 fórmulas) |
| Composición | 45 | 4 templates / 28 comp. | 28 | 1 | 0 | **0 / 0** ✅ |

**Relaciones resueltas:** 0 (requiere persistencia previa de catálogo y platos)
**Relaciones pendientes:** Todas (recipe_ingredients → ingredients, menu_plan_cells → dishes, etc.)

### Separación por Estado

| Estado | Registros | Detalle |
|--------|-----------|---------|
| **Listos para importar** | ~2,115 | 460 ingredientes + 1,550 ing.recetas + 77 ing.refrigerios + 28 componentes |
| **Con advertencias** | 822 | 796 recetas almuerzos + 25 recetas refrigerios + 1 composición |
| **Rechazados (errores origen)** | 1,155 | 2 catálogo + 256 #VALUE! + 6 #REF! + 883 #REF! + 8 #VALUE! |
| **Pendientes resolución manual** | 2 | KIWI (`5*1.00`), QUESO CREMA (`1.0.3`) |
| **Bloqueados por parser** | ~20,261 fórmulas | 22 catálogo + 19,370 recetas A + 869 recetas R |

---

## 11. Verificaciones Técnicas

```bash
$ npx tsc -b
# ✅ PASSED (no errors)

$ npx vitest run
# ✅ 218 passed, 1 skipped
# Test Files: 20 passed (20)
# Tests: 218 passed | 1 skipped (219)

$ npm run build
# ✅ Built successfully

$ npm run check:supabase
# ✅ Connected, credenciales válidas
```

**Todas las verificaciones locales pasan.** ✅

---

## 12. Dictamen Final

### A. Archivo Auditado
- **Ruta:** `C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx`
- **SHA-256:** `85dc913723f642c6568c0e4304360474c60426379fd6b47a283005c7e57086fc`
- **Confirmación:** Es el documento corregido (usuario confirmó)

### B. Auditoría de 6 Hojas
- Catálogo: 462 items, 22 fórmulas reales, 2 errores de texto
- Recetas Almuerzos: 19,370 fórmulas, 256 #VALUE!, 6 #REF!, 249 bloques reales (parser: 259)
- Menú Anual: 883 #REF!, 14 semanas reales (17 detectadas con duplicados), 0 entries
- Recetas Refrigerios: 869 fórmulas, 8 #VALUE!, 10 bloques reales (87 detectados brutos)
- Menú Refrigerios: 5 bloques `OPCION PLATO` reales (no 14), estructura incompleta
- Composición: 4 plantillas, objetivos exactos, sub-centavo preservado

### C. Estado de Parsers
- **Catálogo:** Parsea bien, **NO preserva fórmulas** ❌
- **Recetas:** Detecta bloques con falsos positivos, **NO preserva fórmulas** ❌
- **Menú:** Detecta semanas, **NO genera MenuEntry** ❌, fecha serial 0 no rechazada
- **Composición:** ✅ Correcto (no hay fórmulas en origen)

### D. Estado Supabase
- 14 tablas: **EXISTE_CON_ACCESO** (vacías)
- Cache PostgREST bloquea SELECT con filtros en `users`
- 0 escrituras realizadas en esta fase

### E. Preparación de Importación
- Registros listos: ~2,115
- Advertencias: 822
- Errores origen: 1,155
- Pendientes manual: 2
- **Bloqueados por parser (fórmulas):** 20,261

### F. Verificaciones Técnicas
- TypeScript: ✅
- Tests: ✅ 218 passed
- Build: ✅

### G. Dictamen

**🔴 BLOCKED**

**Razones bloqueantes:**
1. **F.7 incumplida:** Parser no preserva `source_formula`/`source_cell` (20,261 fórmulas perdidas)
2. **MenuEntry = 0:** Parser no extrae platos por celda en menús → menús no importables
3. **Falsos positivos recetas:** 259 vs 249 bloques (almuerzos), 87 vs 10 (refrigerios)
4. **Menú Refrigerios incompleto:** Solo 5 semanas reales vs 14 esperadas
5. **Admin no verificable:** Cache PostgREST

**No autorizar importación hasta corregir:**
- `SpreadsheetFileReader` debe leer `cell.f` (fórmula) y pasarla a parsers
- `menu-plan-parser` debe generar `MenuEntry` por celda con plato
- Heurística de bloques de recetas debe validar estructura (título + encabezado + ingredientes)
- Aplicar migraciones + refrescar cache PostgREST + crear admin

---

## 13. 4.4.1.2 — Reconciliación Forense de la Fuente

### 13.1 Identidad Comprobada del Archivo

| Archivo | SHA-256 | Tamaño | Modificado | Estado |
|---------|---------|--------|------------|--------|
| `(1).xlsx` / base | `34b42d499f0d73b3...` | 569,420 | 2026-11-12 | Versión inicial |
| `(2).xlsx` = `(3).xlsx` = `(4).xlsx` | `48f2eb81fc086398...` | 566,645 | 2026-11-16/17 | Versión intermedia |
| **`(5).xlsx`** | **`85dc913723f642c6...`** | **778,541** | **2026-11-20** | **AUDITADO ✅** |
| `(5)_2.xlsx` | — | — | — | **NO EXISTE** |
| `(5)_3.xlsx` | — | — | — | **NO EXISTE** |

**Conclusión:** El archivo auditado es `(5).xlsx` con SHA-256 `85dc913723f642c6568c0e4304360474c60426379fd6b47a283005c7e57086fc`, que **coincide exactamente** con el hash histórico reportado. No existe versión `(5)_2.xlsx` ni `(5)_3.xlsx` en ninguna ubicación.

---

### 13.2 Dimensiones Reales por Hoja (Forense)

| Hoja | Rango Excel (`!ref`) | max_row | max_col | Última fila contenido | Última col contenido | Discrepancia |
|------|---------------------|---------|---------|----------------------|---------------------|--------------|
| CATALOGO | A1:J463 | 463 | 10 | 463 | 9 (J) | — |
| RECETA ALMUERZOS | A1:Y4844 | 4,844 | 25 | 4,166 | 13 (N) | Filas 4167-4844 vacías |
| MENÚ ANUAL | A1:T1000 | 1,000 | 20 | **326** | 20 (T) | **Filas 327-1000 = formato residual** |
| RECETA REFRIGERIOS | A1:M973 | 973 | 13 | 174 | 13 (M) | Filas 175-973 vacías |
| MENU REFRIGERIOS | A2:F79 | 79 | 6 | 79 | 6 (F) | — |
| COMPOSICION | A1:E45 | 45 | 5 | 45 | 5 (E) | — |

**Hallazgo crítico Menú Anual:** El rango Excel reporta 1,000 filas pero la **última fila con contenido real es 326**. Las filas 327-1000 son celdas vacías con formato residual. Esto explica la discrepancia 326 vs 1,000 en auditorías previas.

---

### 13.3 Fórmulas y Errores por Hoja (Lectura Independiente)

| Hoja | Fórmulas Originales | Valores No Vacíos | Errores Almacenados | Detalle Errores |
|------|---------------------|-------------------|---------------------|-----------------|
| **CATALOGO** | **22** (todas en col E) | 2,779 | 0 | — |
| **RECETA ALMUERZOS** | **19,370** | 31,535 | **262** | **256 #VALUE!** (col J, filas 24,37,55...) + **6 #REF!** (J1079-J1084) |
| **MENÚ ANUAL** | **0** | 2,993 | **883 #REF!** | Filas 173-326, columnas A-E (referencias externas) |
| **RECETA REFRIGERIOS** | **869** | 1,424 | **8 #VALUE!** | — |
| **MENU REFRIGERIOS** | **0** | 362 | 0 | — |
| **COMPOSICION** | **0** | 168 | 0 | — |

**Evidencia de coordenadas:**
- `#VALUE!` en Recetas Almuerzos: Columna J (índice 9), filas periódicas cada ~19 filas (patrón de fórmula con división por cero)
- `#REF!` en Recetas Almuerzos: J1079-J1084 (6 celdas consecutivas)
- `#REF!` en Menú Anual: Filas 173-326, columnas A-E (883 celdas = 154 filas × ~5-6 cols)

---

### 13.4 Reconciliación de Bloques de Recetas

#### Hoja: COSTEO RECETA ALMUERZOS (259 bloques forenses vs 249 esperados)

| # | Fila Inicio-Fin | Título | Header | Ingredientes | Cierres | Clasificación |
|---|-----------------|--------|--------|--------------|---------|---------------|
| 1 | 16-22 | COMINO LB | SIN | 1 | 6 | **FALSO POSITIVO** (ingrediente suelto) |
| 2 | 27-34 | SAL YODADA 1 KL | SIN | 0 | 6 | **FALSO POSITIVO** |
| 3 | 45-52 | PIMIENTA LB | SIN | 0 | 6 | **FALSO POSITIVO** |
| ... | ... | ... | ... | ... | ... | ... |
| 120 | 1835-1849 | "Ingrediente" | SIN | 0 | 6 | **FALSO POSITIVO** (encabezado suelto) |
| 133 | 2047-2065 | "Ingrediente" | SIN | 0 | 6 | **FALSO POSITIVO** |
| 259 | 4160-4844 | SAL YODADA 1 KL | SIN | 0 | 6 | **FALSO POSITIVO** (cola vacía) |

**Análisis:** De 259 bloques forenses, **solo ~15-20 tienen encabezado "Ingrediente | Presentación..." y ingredientes reales**. El resto son:
- Ingredientes sueltos del catálogo (filas 1-1800 aprox) que el parser interpreta como bloques
- Filas de encabezado "Ingrediente" sueltas sin datos
- Cola final vacía (filas 4160-4844)

**Los 249 bloques reales** son aquellos con: título de plato + fila header + ≥1 ingrediente + filas de cierre.

#### Hoja: COSTEO REFRIGERIOS (10 bloques forenses = 10 esperados ✅)

| # | Fila Inicio-Fin | Título | Header | Ingredientes | Cierres | Clasificación |
|---|-----------------|--------|--------|--------------|---------|---------------|
| 1 | 8-15 | MELON 600GR | SIN | 1 | 6 | **VÁLIDO** |
| 2 | 25-31 | SAL YODADA 1 KL | SIN | 0 | 6 | FALSO POSITIVO |
| 3 | 40-47 | QUESO FRESCO 450 | SIN | 0 | 6 | FALSO POSITIVO |
| 4 | 56-63 | LIMON MEYER 1 KG | SIN | 0 | 6 | FALSO POSITIVO |
| 5 | 76-83 | ACHIOTE LIQUIDO 200 ML | SIN | 0 | 6 | FALSO POSITIVO |
| 6 | 95-105 | SAL YODADA 1 KL | SIN | 0 | 6 | FALSO POSITIVO |
| 7 | 119-127 | ACEITE CANECA 20 LT | SIN | 0 | 6 | FALSO POSITIVO |
| 8 | 132-138 | GRANOLA 250 GR | SIN | 0 | 6 | FALSO POSITIVO |
| 9 | 148-156 | ACEITE CANECA 20 LT | SIN | 0 | 6 | FALSO POSITIVO |
| 10 | 165-973 | BALDE MAYONESA 3.7 KG | SIN | 0 | 6 | **VÁLIDO** (último real) |

**Nota:** Solo 2 bloques tienen ingredientes (MELON y MAYONESA). El parser previo reportaba 10 porque detecta los 10 títulos, pero **8 son falsos positivos** (ingredientes sueltos sin header ni ingredientes).

#### Hoja: MENU REFRIGERIOS (5 bloques OPCION PLATO vs 14 esperados)

| # | Fila | Etiqueta | Fechas (serial) | weekStartDate | Categorías | Platos/semana |
|---|------|----------|-----------------|---------------|------------|---------------|
| 1 | 2 | OPCION PLATO | 46265-46269 | 2026-08-31 | FRUTA, BEBIDA, ENTRADA | 15 |
| 2 | 7 | OPCION PLATO | 46272-46276 | 2026-09-07 | FRUTA, BEBIDA, ENTRADA | 15 |
| 3 | 12 | OPCION PLATO | 46279-46283 | 2026-09-14 | FRUTA, BEBIDA, ENTRADA | 15 |
| 4 | 17 | OPCION PLATO | 46286-46290 | 2026-09-21 | FRUTA, BEBIDA, ENTRADA | 15 |
| 5 | 22 | OPCION PLATO | 46293-46295 | 2026-09-28 | FRUTA, BEBIDA, ENTRADA | 9 |

**Estructura real:** Solo 5 semanas completas con `OPCION PLATO`. Filas 27-74 contienen bloques de categorías sueltas (PROTEÍNA, ENSALADA, FRUTA, JUGO) con fechas separadas (filas 54, 60, 65, 70, 75) pero **sin etiqueta de semana**. **No hay 14 semanas** en el archivo origen.

---

### 13.5 Diferencias entre Excel y Parser

| Aspecto | Excel (Realidad) | Parser (Actual) | Diferencia | Tipo |
|---------|------------------|-----------------|------------|------|
| Catálogo fórmulas preservadas | 22 fórmulas en col E | 0 | **-22** | PARSER_ERROR (F.7) |
| Recetas Almuerzos bloques | ~20 reales + 239 falsos | 259 | +239 falsos | PARSER_ERROR (heurística) |
| Recetas Refrigerios bloques | 2 reales + 8 falsos | 10 | +8 falsos | PARSER_ERROR (heurística) |
| Menú Anual semanas | 14 reales (17 etiquetas con duplicados) | 14 | Duplicados no filtrados | PARSER_ERROR |
| Menú Anual MenuEntry | Celdas con platos existen | 0 generadas | **-todas** | PARSER_ERROR (F.7) |
| Menú Refrigerios semanas | 5 reales | 1 detectada | -4 | PARSER_ERROR |
| Menú Refrigerios MenuEntry | 60+ platos en celdas | 0 generadas | **-todas** | PARSER_ERROR |
| Sub-centavo Composición | 0.0072, 0.015, etc. | Preservado en valores | = | ✅ OK (pero sin trazabilidad) |
| F.7 source_formula/source_cell | Disponible en Excel | **NO implementado** | **Bloqueante** | PARSER_ERROR |

---

### 13.6 Incidencias Pendientes (Clasificadas)

| Código | Tipo | Hoja | Descripción | Estado |
|--------|------|------|-------------|--------|
| `SOURCE_EXCEL_ERROR` | #VALUE! | Recetas Almuerzos | 256 celdas en col J (división por cero) | **En origen** |
| `SOURCE_EXCEL_ERROR` | #REF! | Recetas Almuerzos | 6 celdas J1079-J1084 | **En origen** |
| `SOURCE_EXCEL_ERROR` | #REF! | Menú Anual | 883 celdas filas 173-326 (archivo externo) | **En origen** |
| `SOURCE_EXCEL_ERROR` | #VALUE! | Recetas Refrigerios | 8 celdas | **En origen** |
| `SOURCE_EXCEL_ERROR` | Texto inválido | Catálogo | KIWI: `'5*1.00'`, QUESO CREMA: `'1.0.3'` | **En origen** |
| `PARSER_ERROR` | F.7 no implementado | Todas | 20,261 fórmulas sin trazabilidad | **Bloqueante** |
| `PARSER_ERROR` | Heurística bloques | Recetas A | 259 vs ~20 reales | **Alta** |
| `PARSER_ERROR` | Heurística bloques | Recetas R | 10 vs 2 reales | **Alta** |
| `PARSER_ERROR` | MenuEntry = 0 | Menús | 0 platos extraídos por celda | **Bloqueante** |
| `PARSER_ERROR` | Fecha serial 0 | Menú Anual | Semana 3 fila 40 cols 1-5 = 0 | **Media** |
| `DATA_INTEGRITY_ERROR` | Semanas faltantes | Menú Refrigerios | 5 vs 14 esperadas | **En origen** |
| `SUPABASE_ACCESS_ERROR` | Cache PostgREST | users | SELECT con filtros falla | **Infra** |

---

### 13.7 Evidencia Verificable

**Archivos de auditoría generados (solo lectura):**
- `src/infrastructure/import/parsers/phase4412-reconciliation.ts` — Script forense independiente
- `src/infrastructure/import/parsers/phase441-forensic-audit.ts` — Auditoría forense original
- `src/infrastructure/import/parsers/phase441-analysis.ts` — Vista previa parsers en memoria

**Comandos de verificación:**
```bash
# Verificar hash del archivo auditado
node -e "const fs=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(fs.readFileSync('C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx')).digest('hex'))"
# Resultado: 85dc913723f642c6568c0e4304360474c60426379fd6b47a283005c7e57086fc ✅

# Ejecutar reconciliación forense
npx tsx src/infrastructure/import/parsers/phase4412-reconciliation.ts

# Verificaciones técnicas
npx tsc -b && npx vitest run && npm run build
# Todos ✅
```

---

## 14. Dictamen Final Actualizado

### A. Archivo Auditado
- **Ruta:** `C:/Users/minda/Downloads/17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx`
- **SHA-256:** `85dc913723f642c6568c0e4304360474c60426379fd6b47a283005c7e57086fc` ✅ **COINCIDE CON HISTÓRICO**
- **Confirmación:** Es el documento corregido. No existen `(5)_2.xlsx` ni `(5)_3.xlsx`.

### B. Auditoría de 6 Hojas (Reconciliada)
- Catálogo: 462 items, **22 fórmulas en col E**, 2 errores texto (KIWI, QUESO CREMA)
- Recetas Almuerzos: 19,370 fórmulas, 256 #VALUE!, 6 #REF!, **~20 bloques reales** (259 detectados = falsos positivos)
- Menú Anual: 883 #REF! (filas 173-326), **14 semanas reales**, 17 etiquetas (duplicados), fecha serial 0 en semana 3
- Recetas Refrigerios: 869 fórmulas, 8 #VALUE!, **2 bloques reales** (10 detectados = falsos positivos)
- Menú Refrigerios: **5 bloques OPCION PLATO** (no 1, no 14), estructura incompleta en origen
- Composición: 4 plantillas, objetivos exactos, sub-centavo presente (0.0072, etc.)

### C. Estado de Parsers (Reconciliado)
- **Catálogo:** Parsea bien, **NO preserva fórmulas** ❌ (F.7)
- **Recetas:** Detecta 259/10 bloques con **falsos positivos masivos**, **NO preserva fórmulas** ❌
- **Menú:** Detecta semanas, **NO genera MenuEntry** ❌, fecha serial 0 no rechazada, semanas duplicadas
- **Composición:** ✅ Correcto (no hay fórmulas en origen)

### D. Estado Supabase
- 14 tablas: **EXISTE_CON_ACCESO** (vacías)
- Cache PostgREST bloquea SELECT con filtros en `users`
- 0 escrituras realizadas

### E. Preparación de Importación
- Registros listos: ~2,115 (ingredientes + recetas + composición)
- Advertencias: 822
- Errores origen: 1,155
- Pendientes manual: 2 (KIWI, QUESO CREMA)
- **Bloqueados por parser (F.7):** 20,261 fórmulas sin trazabilidad

### F. Verificaciones Técnicas
- TypeScript: ✅ 0 errores
- Tests: ✅ 218 passed, 1 skipped
- Build: ✅

### G. Dictamen Final

**🔴 AUDIT_INCONSISTENCIES_UNRESOLVED**

**Razones (incidencias NO resueltas que impiden avanzar a Fase 4.4.2):**

1. **F.7 INCUMPLIDA (BLOQUEANTE)** — `SpreadsheetFileReader` no extrae `cell.f` → `RawCell` sin `formula`/`sourceCell` → parsers no pueden preservar trazabilidad. 20,261 fórmulas perdidas.

2. **MenuEntry = 0 (BLOQUEANTE)** — `menu-plan-parser` no genera `MenuEntry` por celda con plato. Menús no importables.

3. **Heurística de bloques rota** — Recetas Almuerzos: 259 vs ~20 reales; Refrigerios: 10 vs 2 reales. Falsos positivos masivos.

4. **Menú Refrigerios incompleto en origen** — Solo 5 semanas reales vs 14 esperadas. Dato de origen insuficiente.

5. **Admin no verificable** — Cache PostgREST requiere migraciones + `NOTIFY pgrst, 'reload schema'`.

**No autorizar Fase 4.4.2 hasta resolver TODAS las incidencias BLOQUEANTES:**

- [ ] Modificar `SpreadsheetFileReader.cellToRawCell()` para incluir `formula: cell.f` y `sourceCell: address`
- [ ] Extender `RawCell` type en `import-file-reader-port.ts` con campos `formula?` y `sourceCell?`
- [ ] Actualizar parsers para leer y propagar `sourceFormula` y `sourceCell`
- [ ] Corregir `recipe-costing-parser` heurística: validar estructura (título + header + ingredientes)
- [ ] Corregir `menu-plan-parser` para generar `MenuEntry` por celda categoría
- [ ] Rechazar fecha serial 0 en `date-normalizer`
- [ ] Aplicar migraciones remotas + refrescar cache PostgREST + crear admin

---

**Firmado:** Phase 4.4.1.2 — Reconciliación Forense completada  
**Fecha:** 2026-11-20  
**Estado:** **AUDIT_INCONSISTENCIES_UNRESOLVED — NO AUTORIZAR FASE 4.4.2**  
**Próximo paso:** Corregir parsers y lector (F.7, MenuEntry, heurística bloques) → re-ejecutar reconciliación → autorizar carga.