# Phase 4.4.3.A Import Preview Report

**Fecha:** 2026-11-20
**Duración:** 1802ms
**Archivo analizado:** `17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx`
**SHA-256:** `059556f2c304766295fc7314bf83df0d0bca2ea74c062c9e9b57153b92faed20`
**Tamaño:** 778472 bytes
**Entorno:** In-memory only — **CERO escrituras a Supabase**

## A. Identidad del Archivo

| Campo | Valor |
|-------|-------|
| Nombre | real-workbook.xlsx |
| Tamaño | 778472 bytes |
| SHA-256 | `059556f2c304766295fc7314bf83df0d0bca2ea74c062c9e9b57153b92faed20` |
| Formato | xlsx |
| Fecha de análisis | 2026-11-20T13:11:26.648Z |

### Hojas Detectadas

| Índice | Nombre Original | Normalizado | Filas | SourceType | Confianza |
|--------|----------------|-------------|-------|------------|-----------|
| 0 | CATALOGO COSTEO 17-08-2 | CATALOGO COSTEO 17-08-2 | 463 | CATALOG | MEDIUM |
| 1 | COSTEO RECETA ALMUERZOS | COSTEO RECETA ALMUERZOS | 4844 | RECIPE_COSTING | HIGH |
| 2 | MENÚ AGSTO-JULIO2026-2027 | MENÚ AGSTO-JULIO2026-2027 | 1000 | MENU_PLAN | HIGH |
| 3 | COSTEO REFRIGERIOS  | COSTEO REFRIGERIOS | 973 | RECIPE_COSTING | HIGH |
| 4 | MENU REFRIGERIOS | MENU REFRIGERIOS | 78 | MENU_PLAN | HIGH |
| 5 | COMPOSICION DE CADA PLATO | COMPOSICION DE CADA PLATO | 45 | MEAL_COMPOSITION | HIGH |

## B. Resumen Ejecutivo

**VEREDICTO: READY_FOR_PERSISTENCE**

El Import Preview procesó las 6 hojas del archivo Excel auditado. Todos los conteos coinciden con los valores esperados.

Validación general: **WARNING**

## C. Resultados por Hoja

### 1. CATALOGO COSTEO 17-08-2

- **Items parseados:** 462
- **Items con costo:** 461
- **Items con incidencias:** 1
- **Filas de datos:** 462
- **Incidencias totales:** 1

### 2. COSTEO RECETA ALMUERZOS

- **Bloques válidos:** 257
- **Filas de ingredientes:** 1550
- **Ingredientes sueltos:** 5
- **Incidencias ERROR:** 0
- **Total filas procesadas:** 4844
- **Incidencias totales:** 789

### 3. COSTEO REFRIGERIOS

- **Bloques válidos:** 10
- **Filas de ingredientes:** 77
- **Ingredientes sueltos:** 0
- **Incidencias ERROR:** 0
- **Total filas procesadas:** 973
- **Incidencias totales:** 25

### 4. MENÚ AGSTO-JULIO2026-2027 (ANUAL)

- **Bloques físicos:** 15
- **Semanas calendario:** 14
- **Días hábiles:** 70
- **Celdas #REF!:** 883
- **Entradas de menú:** 694
- **Total filas procesadas:** 1000
- **Incidencias totales:** 888

#### Detalle de Semanas (Anual)

| Semana | weekStartDate | Tipo Header | Fechas Válidas | Entradas | Feriados |
|--------|---------------|-------------|----------------|----------|----------|
| SEMANA 1 | 2026-08-24 | semana | 5/5 | 50 | 0 |
| SEMANA 2 | 2026-08-31 | semana | 5/5 | 50 | 0 |
| SEMANA 3 | 2026-09-07 | semana | 5/5 | 50 | 0 |
| Bloque fila 40 |  | date_only | 0/5 | 0 | 0 |
| SEMANA 4 | 2026-09-14 | semana | 5/5 | 50 | 0 |
| SEMANA 5 | 2026-09-21 | semana | 5/5 | 50 | 0 |
| SEMANA 6 | 2026-09-28 | semana | 5/5 | 50 | 0 |
| SEMANA 7 | 2026-10-05 | semana | 5/5 | 50 | 0 |
| SEMANA 7 | 2026-10-12 | semana | 5/5 | 50 | 0 |
| SEMANA 8 | 2026-10-19 | semana | 5/5 | 50 | 0 |
| SEMANA 9 | 2026-10-26 | semana | 5/5 | 50 | 0 |
| SEMANA 10 | 2026-11-02 | semana | 5/5 | 32 | 0 |
| SEMANA 11 | 2026-11-09 | semana | 5/5 | 50 | 0 |
| SEMANA 12 | 2026-11-16 | semana | 5/5 | 41 | 0 |
| SEMANA 13 | 2026-11-23 | semana | 5/5 | 71 | 0 |

### 5. MENU REFRIGERIOS

- **Bloques físicos:** 14
- **Semanas calendario:** 13
- **Días hábiles:** 65
- **Celdas #REF!:** 0
- **Entradas de menú:** 232
- **Total filas procesadas:** 78
- **Incidencias totales:** 0

#### Detalle de Semanas (Refrigerios)

| Semana | weekStartDate | Tipo Header | Fechas Válidas | Entradas | Feriados |
|--------|---------------|-------------|----------------|----------|----------|
| OPCION PLATO | 2026-08-31 | opcion_plato | 5/5 | 15 | 0 |
| OPCION PLATO | 2026-09-07 | opcion_plato | 5/5 | 15 | 0 |
| OPCION PLATO | 2026-09-14 | opcion_plato | 5/5 | 15 | 0 |
| OPCION PLATO | 2026-09-21 | opcion_plato | 5/5 | 15 | 0 |
| OPCION PLATO | 2026-09-28 | opcion_plato | 3/5 | 9 | 0 |
| Bloque fila 26 | 2026-09-28 | date_only | 5/5 | 20 | 0 |
| Bloque fila 31 | 2026-10-05 | date_only | 5/5 | 20 | 0 |
| Bloque fila 36 | 2026-10-12 | date_only | 5/5 | 20 | 0 |
| Bloque fila 41 | 2026-10-19 | date_only | 5/5 | 20 | 0 |
| Bloque fila 46 | 2026-10-26 | date_only | 2/5 | 10 | 0 |
| DÍAS | 2026-11-02 | dias | 5/5 | 12 | 0 |
| DÍAS | 2026-11-09 | dias | 5/5 | 20 | 0 |
| DÍAS | 2026-11-16 | dias | 5/5 | 16 | 0 |
| DÍAS | 2026-11-23 | dias | 5/5 | 25 | 0 |

### 6. COMPOSICION DE CADA PLATO

- **Plantillas:** 4
- **Componentes:** 28
- **Plantillas validadas:** 4
- **Total filas procesadas:** 45
- **Incidencias totales:** 1

#### Almuerzo Saludable Estudiantil

- **Servicio:** lunch
- **Objetivo hoja:** $1.24
- **Objetivo verificado:** $1.24
- **Calculado:** $1.23
- **Validación:** WARNING
- **Componentes:** 7

  - PROTEINA: PROTEINA | Cantidad: 100 g | Costo unitario: 0.007200 | Costo porción: $0.72
  - GUARNICION: GUARNICION | Cantidad: 50 g | Costo unitario: 0.001000 | Costo porción: $0.05
  - ARROZ: ARROZ | Cantidad: 40 g | Costo unitario: 0.003000 | Costo porción: $0.12
  - ENSALADA: ENSALADA | Cantidad: 55 g | Costo unitario: 0.002000 | Costo porción: $0.11
  - FRUTA: FRUTA | Cantidad: 37 g | Costo unitario: 0.003000 | Costo porción: $0.11
  - SALSAS: Salsas | Cantidad: 3 g | Costo unitario: 0.004000 | Costo porción: $0.01
  - JUGO: JUGO | Cantidad: 8 oz | Costo unitario: 0.014000 | Costo porción: $0.11

#### Almuerzo Estudiantil Completo Especial

- **Servicio:** lunch
- **Objetivo hoja:** $1.38
- **Objetivo verificado:** $1.38
- **Calculado:** $1.38
- **Validación:** VALID
- **Componentes:** 8

  - SOPA: SOPA | Cantidad: 10 oz | Costo unitario: 0.015000 | Costo porción: $0.15
  - PROTEINA: PROTEINA | Cantidad: 100 g | Costo unitario: 0.007200 | Costo porción: $0.72
  - GUARNICION: GUARNICION | Cantidad: 48 g | Costo unitario: 0.001000 | Costo porción: $0.05
  - ARROZ: ARROZ | Cantidad: 41 g | Costo unitario: 0.003000 | Costo porción: $0.12
  - ENSALADA: ENSALADA | Cantidad: 42 g | Costo unitario: 0.002000 | Costo porción: $0.08
  - POSTRE: POSTRE MASA | Cantidad: 45 g | Costo unitario: 0.003000 | Costo porción: $0.14
  - SALSAS: Salsas | Cantidad: 3 g | Costo unitario: 0.004000 | Costo porción: $0.01
  - JUGO: JUGO | Cantidad: 8 oz | Costo unitario: 0.014000 | Costo porción: $0.11

#### Refrigerio prescolar/Primaria

- **Servicio:** snack
- **Objetivo hoja:** $0.84
- **Objetivo verificado:** $0.84
- **Calculado:** $0.84
- **Validación:** VALID
- **Componentes:** 5

  - PROTEINA: PROTEÍNA | Cantidad: 60 g | Costo unitario: 0.004700 | Costo porción: $0.28
  - GUARNICION: GUARNICIÓN | Cantidad: 40 g | Costo unitario: 0.003600 | Costo porción: $0.14
  - ENSALADA: ENSALADA | Cantidad: 15 g | Costo unitario: 0.006400 | Costo porción: $0.10
  - FRUTA: FRUTA | Cantidad: 25 g | Costo unitario: 0.006400 | Costo porción: $0.16
  - JUGO: JUGO | Cantidad: 8 oz | Costo unitario: 0.020000 | Costo porción: $0.16

#### Almuerzo Completo Administrativos

- **Servicio:** lunch
- **Objetivo hoja:** $1.44
- **Objetivo verificado:** $1.44
- **Calculado:** $1.44
- **Validación:** VALID
- **Componentes:** 8

  - SOPA: SOPA | Cantidad: 12 oz | Costo unitario: 0.015000 | Costo porción: $0.18
  - PROTEINA: PROTEINA | Cantidad: 110 g | Costo unitario: 0.007200 | Costo porción: $0.79
  - GUARNICION: GUARNICION | Cantidad: 60 g | Costo unitario: 0.001000 | Costo porción: $0.06
  - ARROZ: ARROZ | Cantidad: 35 g | Costo unitario: 0.003000 | Costo porción: $0.11
  - ENSALADA: ENSALADA | Cantidad: 42 g | Costo unitario: 0.002000 | Costo porción: $0.08
  - POSTRE: POSTRE/masa o fruta | Cantidad: 45 g | Costo unitario: 0.002300 | Costo porción: $0.10
  - SALSAS: Salsas | Cantidad: 2 g | Costo unitario: 0.004000 | Costo porción: $0.01
  - JUGO: JUGO | Cantidad: 8 oz | Costo unitario: 0.014000 | Costo porción: $0.11

## D. Conteos

| Métrica | Valor |
|---------|-------|
| Catálogo | 462 |
| Recetas almuerzos | 257 |
| Recetas refrigerios | 10 |
| Menú anual | 694 |
| Menú refrigerios | 232 |
| Plantillas composición | 4 |
| **MenuEntry total** | **926** |

## E. Incidencias

### ERROR (889)

#### CATALOG_COST_INVALID (1)

- Fila 140 | costo | El costo de la fila 140 no es numérico ('5*1.00'). No se convirtió en cero.

#### MENU_DATE_SERIAL_INVALID (5)

- Fila 40 | Fecha | La fecha serial 0 (fila 40) no puede interpretarse de forma segura (Serial de fecha inválido o cero: 0).
- Fila 40 | Fecha | La fecha serial 0 (fila 40) no puede interpretarse de forma segura (Serial de fecha inválido o cero: 0).
- Fila 40 | Fecha | La fecha serial 0 (fila 40) no puede interpretarse de forma segura (Serial de fecha inválido o cero: 0).
- Fila 40 | Fecha | La fecha serial 0 (fila 40) no puede interpretarse de forma segura (Serial de fecha inválido o cero: 0).
- Fila 40 | Fecha | La fecha serial 0 (fila 40) no puede interpretarse de forma segura (Serial de fecha inválido o cero: 0).

#### MENU_FORMULA_ERROR (883)

- Fila 173 | A | La celda (fila 173, columna A) contiene '#REF!' (referencia externa rota). No se convirtió en vacío ni en cero.
- Fila 173 | B | La celda (fila 173, columna B) contiene '#REF!' (referencia externa rota). No se convirtió en vacío ni en cero.
- Fila 173 | C | La celda (fila 173, columna C) contiene '#REF!' (referencia externa rota). No se convirtió en vacío ni en cero.
- Fila 173 | D | La celda (fila 173, columna D) contiene '#REF!' (referencia externa rota). No se convirtió en vacío ni en cero.
- Fila 173 | E | La celda (fila 173, columna E) contiene '#REF!' (referencia externa rota). No se convirtió en vacío ni en cero.
- ... y 878 más

### WARNING (815)

#### RECIPE_CLOSING_ROW_UNCLASSIFIED (266)

- Fila 21 | Costo en receta | La fila de cierre (fila 21) del bloque 'SOPA DE CHIFLES/12 ONZAS' contiene un valor no numérico ('$ -'); no se convirtió en cero.
- Fila 32 | Costo en receta | La fila de cierre (fila 32) del bloque 'ARROZ/35 GRAMOS' contiene un valor no numérico ('$ -'); no se convirtió en cero.
- Fila 50 | Costo en receta | La fila de cierre (fila 50) del bloque 'GUARNICION 1' contiene un valor no numérico ('$ -'); no se convirtió en cero.
- ... y 263 más

#### RECIPE_UNRECOGNIZED_ROW (545)

- Fila 34 | A | Fila 34 con contenido no reconocido dentro del bloque 'ARROZ/35 GRAMOS'.
- Fila 52 | A | Fila 52 con contenido no reconocido dentro del bloque 'GUARNICION 1'.
- Fila 104 | A | Fila 104 con contenido no reconocido dentro del bloque 'PLATO FUERTE/OPCION 2'.
- ... y 542 más

#### RECIPE_INCOMPLETE_BLOCK (2)

- Fila 1835 | Estructura | Bloque incompleto detectado desde fila 1835 ('sin título'): con header, 0 ingredientes, 6 filas de cierre. No se cuenta como receta válida.
- Fila 2047 | Estructura | Bloque incompleto detectado desde fila 2047 ('sin título'): con header, 0 ingredientes, 6 filas de cierre. No se cuenta como receta válida.

#### RECIPE_LOOSE_INGREDIENTS (1)

- Fila N/A | Ingredientes sin bloque | Se detectaron 5 ingredientes sueltos (sin estructura de receta completa: título + header + ingredientes + cierre). Se conservan para trazabilidad pero no forman recetas válidas.

#### COMPOSITION_ROUNDING_TOLERANCE (1)

- Fila 1 | Costo por Porción | La suma de componentes (123 centavos) difiere del objetivo (124 centavos) en 1 centavo(s), dentro de la tolerancia de ±1 centavo por redondeo.

### INFO (0)

## F. F.1–F.10

| Regla | Estado | Detalle |
|-------|--------|---------|
| F1 | ✅ PASS |  |
| F2 | ✅ PASS | Dinero en centavos integer; sub-centavo en unitCostRaw |
| F3 | ⚠️ BLOCKED/WARNING | Import Preview prepara datos para import_batch; no crea lote |
| F4 | ⚠️ BLOCKED/WARNING | weekStartDate son lunes; feriados Ecuador detectados |
| F5 | ✅ PASS | lunch (anual), snack (refrigerios) |
| F6 | ⚠️ BLOCKED/WARNING | Costos unitarios sub-centavo en crudo; totales en centavos |
| F7 | ✅ PASS | sourceCell/sourceFormula en MenuEntry; pendiente en otros dominios |
| F8 | ✅ PASS | Arquitectura soporta CurrentOperatorPort y RLS |
| F9 | ✅ PASS | 883 #REF! conservados como incidencias MENU_FORMULA_ERROR |
| F10 | ✅ PASS | MENU_CATEGORY_TO_DISH_CATEGORY aplicado; 1oz=28.35g en unit-normalizer |

## G. Trazabilidad F.7 (Pipeline)

| Fuente | sourceFile | sourceSheet | sourceRow | sourceCell | sourceFormula | Fórmulas Detectadas | Preservadas | Faltantes |
|--------|------------|-------------|-----------|------------|---------------|---------------------|-------------|-----------|
| catalog | ✅ | ✅ | ✅ | ❌ | ❌ | 0 | 0 | 0 |
| lunchRecipes | ✅ | ✅ | ✅ | ❌ | ❌ | 0 | 0 | 0 |
| snackRecipes | ✅ | ✅ | ✅ | ❌ | ❌ | 0 | 0 | 0 |
| annualMenu | ✅ | ✅ | ✅ | ✅ | ✅ | 0 | 0 | 0 |
| snackMenu | ✅ | ✅ | ✅ | ✅ | ✅ | 0 | 0 | 0 |
| mealComposition | ✅ | ✅ | ✅ | ❌ | ❌ | 0 | 0 | 0 |

**Nota:** Los parsers actuales propagan `sourceFile`, `sourceSheet`, `sourceRow` vía `ParserContext`. `sourceCell` y `sourceFormula` solo están presentes en `MenuEntry` (parser de menú). Catálogo, Recetas y Composición requieren propagación adicional en Phase 4.4.3.B.

## H. Decisión Final

**READY_FOR_PERSISTENCE**

---

## Confirmación Zero-Write

```
=== CONFIRMACIÓN: NO HUBO ESCRITURAS EN SUPABASE ===
  Este análisis usó solo parsers en memoria. No se llamaron repositorios Supabase.
```
