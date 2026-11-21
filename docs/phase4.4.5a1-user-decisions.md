# Decisiones de Usuario Requeridas — Fase 4.4.5.A.1

**Fecha:** 2026-11-21  
**Proyecto:** Lunch v2  
**Fuente:** Validación forense de 1000 registros `recipe_ingredients` vs 462 catálogo  
**Estado:** Solo lectura — **NINGUNA ESCRITURA EJECUTADA**

---

## Resumen de Decisiones Pendientes

| Onda | Clasificación | Registros | Acción Requerida |
|------|---------------|-----------|------------------|
| **Onda 1** | EXACT_MATCH (auto-aprobable) | **881** | **NINGUNA** — Migración automática |
| **Onda 2** | Compatibles semánticamente | **78** | **APROBAR EN BLOQUE** — Identidad confirmada, presentación compatible o equivalencia documentada |
| **Onda 3** | Requieren investigación usuario | **40** | **DECISIÓN INDIVIDUAL** — Precio divergente >15%, presentación incompatible, marca distinta |
| **Onda 4** | Irresolubles sin catálogo | **1** | **CREAR INGREDIENTE** o marcar UNRESOLVED |

**Total decisiones de usuario:** **119** (78 Onda 2 + 40 Onda 3 + 1 Onda 4)  
**Migración automática:** **881** (88.1%)

---

## Onda 2 — Aprobación en Bloque Recomendada (78 registros)

Estos 78 registros tienen **identidad confirmada** y **compatibilidad semántica validada**. Se recomienda aprobación única en bloque.

### 2.1 SEMANTICALLY_DIFFERENT Compatibles (64 registros)

| Ingrediente | Registros | Evidencia | Nota |
|-------------|-----------|-----------|------|
| **APIO/800 GR** | 28 | RI qty 800g = Catálogo ATADO (800 GR) | 2 recetas excluidas (Onda 3) |
| **MELON 600GR** | 6 | RI qty 600g = Catálogo UNIDAD (600 GR) | Normalizar notación (600G/600GR/600g) |
| **SANDIA** | 3 | RI qty 4000g ∈ Catálogo UNIDAD (4-5 KILOS) | — |
| **CEBOLLA BLANCA 1 KILO** | 16 | RI qty 1000g = Catálogo ATADO (1 KG) | Normalizar notación (1KG/1kg) |
| **LECHUGA NACIONAL** | 6 | RI peso 4000g/6000g, 0 "Unidades" | Nota: 6000g excede 4kg nominal catálogo |
| **ARROZ MACAREÑO ARROBA** | 3 | Unidad arroba coincide, 13% diff peso (25lb vs 22lb) | Documentar discrepancia definición arroba |
| **REMOLACHA** | 2 | RI qty 1000g = Catálogo ATADO (1 KILO) | Normalizar notación (1KG/1kg) |

**Decisión recomendada:** **APROBAR TODOS** con notas de normalización de notación.

### 2.2 POSSIBLE_MATCH (4 registros)

| # | Receta Ingredient | Catálogo Candidato | Código | Evidencia | Match Basis |
|---|-------------------|-------------------|--------|-----------|-------------|
| 1 | AZUCAR ARROBA | AZUCAR ARROBA SAN FRANCISCO | 09c8cbec... | Excel: nombre completo con marca | ABBREVIATION_TO_FULL_NAME |
| 2 | TORTILLA TRIGO SUAVES MAMA FANY 400 GR X12 | TORTILLA TRIGO SUAVES MAMA FANY 400 GR | a1220be3... | "X12" = pack 12, mismo producto base | PACK_TO_UNIT |
| 3 | CARNE MOLIDA 1 KILO | CARNE MOLIDA 1 KILO MACAFRI | b423b28f... | Marca MACAFRI en catálogo, genérico en receta | GENERIC_TO_BRANDED |
| 4 | CANGUIL 500GR | CANGUIL 500GR - EL ARTESANAL | d0100787... | Marca EL ARTESANAL en catálogo | ABBREVIATION_TO_FULL_NAME |

**Decisión recomendada:** **APROBAR TODOS** con `match_basis` documentado.

### 2.3 MULTIPLE_MATCH Resuelto (1 registro)

| Receta Ingredient | Candidato Seleccionado | Candidato Descartado | Justificación |
|-------------------|------------------------|----------------------|---------------|
| FIDEO TORNILLO 400 GR - EL ARTESANAL | id `5587842c...` UNIDAD 40c | id `341e7562...` UNIDAD 45c | Precio receta = 40c coincide candidato 1; candidato 2 duplicado en catálogo |

**Decisión recomendada:** **APROBAR candidato 1 (40c)**, marcar candidato 2 (45c) para revisión/eliminación en catálogo.

### 2.4 NO_MATCH Precio Consistente (7 registros)

| Ingrediente | Ocurrencias | Candidato | Evidencia Precio |
|-------------|-------------|-----------|------------------|
| MARGARINA LB | 4 | MARGARINA INDUSTRIAL LB - DANEC (164) | Receta 79c vs Catálogo 93c (15% menor histórico) |
| GARBANZO KILO | 1 | GARBANZO LB (330) | Receta 115c vs Catálogo 121c (cercano) |
| PASTA LASAÑA PRECOCIDA SUPERMAXI 200 GR | 1 | PASTA LASAÑA PRECOCIDA 200 GR - LA ORIGINAL (210) | Precio idéntico 172c, marca distinta |
| LOMO PULPA NEGRA 1 KILO | 1 | LOMO PULPA AGUJA KG (152) | Receta 670c vs Catálogo 695c (3.6% menor) |
| COMINO 200 GR | 4/5 | COMINO LB (75) | 4 recetas 131c = catálogo; 1 receta 160c (Onda 3) |
| SAL 1 KL | 1/10 | SAL YODADA 1 KL (273) | 1 receta 49c = catálogo; 9 recetas 28c/30c (Onda 3) |

**Decisión recomendada:** **APROBAR** los 7 registros con precio consistente/histórico. Los casos con precio divergente van a Onda 3.

---

## Onda 3 — Decisión Individual Requerida (40 registros)

Estos requieren decisión caso por caso. Presentados por prioridad.

### 3.1 NO_MATCH — Precio Inconsistente (29 registros)

#### 3.1.1 SAL 1 KL — 9 registros (precio 28c/30c vs catálogo 49c)
| Receta | Precio Receta | Precio Catálogo | Diferencia |
|--------|---------------|-----------------|------------|
| BE7839B6... PAN DE AJO | 28c | 49c | -43% |
| 778EB86E... PAN DE AJO | 28c | 49c | -43% |
| 80DE6E0E... GUARNICION 2 | 28c | 49c | -43% |
| 53B32314... LASAÑA DE CARNE | 28c | 49c | -43% |
| 10F7D415... CERDO EN SALSA | 28c | 49c | -43% |
| BE69AF51... CREMA ESPINACA | 28c | 49c | -43% |
| B5C53A7F... SHAWARMA | 28c | 49c | -43% |
| E8166ED0... SOPA CHINA | 49c | 49c | 0% (Onda 2) |
| E2F68D91... PARILLADA | 30c | 49c | -39% |

**Opciones:**
- [ ] **Aprobar todos** — Aceptar precio histórico 28c/30c, actualizar catálogo a precio ponderado
- [ ] **Aprobar solo receta E8166ED0 (49c)** — Las 9 restantes: crear ingrediente "SAL 1 KL ECONÓMICA" o investigar proveedor
- [ ] **Rechazar todos** — Mantener UNRESOLVED hasta clarificar proveedor

#### 3.1.2 ACEITE CANECA 20lt — 7 registros (3190c/3233c vs catálogo 3560c)
| Receta | Precio Receta | Precio Catálogo | Diferencia |
|--------|---------------|-----------------|------------|
| 6 recetas | 3190c | 3560c | -10.4% |
| 1 receta (CERDO EN SALSA) | 3233c | 3560c | -9.2% |

**Opciones:**
- [ ] **Aprobar todos** — Actualizar catálogo a ~3200c (precio real vigente)
- [ ] **Investigar proveedor** — VETOIL/SF vs marca real en recetas

#### 3.1.3 COMINO 200 GR — 1 registro divergente (160c vs 131c)
| Receta | Precio Receta | Precio Catálogo | Diferencia |
|--------|---------------|-----------------|------------|
| F44B9F55... PARILLADA | 160c | 131c | +22% |

**Opciones:**
- [ ] **Aprobar** — Variación puntual de proveedor/lote
- [ ] **Rechazar** — Investigar por qué esta receta difiere

#### 3.1.4 OREGANO 200 GR — 4 registros (200c/290c vs catálogo 130c)
| Receta | Precio Receta | Precio Catálogo | Diferencia |
|--------|---------------|-----------------|------------|
| 2E7FF60B... CREMA ESPINACA | 290c | 130c | +123% |
| B27CE953... PAN DE AJO | 290c | 130c | +123% |
| B849534A... POLLO AL CURRY | 290c | 130c | +123% |
| CFC9A173... PARILLADA | 200c | 130c | +54% |

**Opciones:**
- [ ] **Rechazar vinculación** — Precio 1.5-2.2x catálogo sugiere producto distinto (marca premium, presentación distinta)
- [ ] **Crear ingrediente** — "OREGANO 200 GR PREMIUM" con precio real
- [ ] **Investigar proveedor** — ¿Marca distinta en estas recetas?

#### 3.1.5 PIMIENTA 1 KL — 5 registros (158c/400c vs catálogo 116c)
| Receta | Precio Receta | Precio Catálogo | Diferencia |
|--------|---------------|-----------------|------------|
| 041067B7... PARILLADA | 158c | 116c | +36% |
| D22FE42B... CERDO EN SALSA | 400c | 116c | +245% |
| 4108291A... POLLO AL CURRY | 400c | 116c | +245% |
| 52DE6CDA... SOPA CHINA | 400c | 116c | +245% |
| A0F759F8... CREMA ESPINACA | 400c | 116c | +245% |

**Opciones:**
- [ ] **Rechazar vinculación** — Diferencia extrema sugiere producto distinto (pimienta negra vs blanca, marca, molido vs grano)
- [ ] **Crear ingredientes** — "PIMIENTA NEGRA 1 KL", "PIMIENTA BLANCA 1 KL" con precios reales
- [ ] **Investigar** — Excel original para estas recetas específicas

#### 3.1.6 MOSTAZA 4 LT — 2 registros (unidades/precio inconsistentes)
| Receta | Precio Receta | Precio Catálogo | Nota |
|--------|---------------|-----------------|------|
| 28F89B16... SHAWARMA | 822c (4LT) | 451c (3.7KG) | Unidades LT vs KG, 82% mayor |
| 9CAA1EA5... PARILLADA | 485c (4LT) | 451c (3.7KG) | Unidades LT vs KG, 7% mayor |

**Opciones:**
- [ ] **Convertir unidades** — 4LT mostaza ≈ 3.7-4KG; precio/kg: 205c vs 122c (SHAWARMA) / 130c vs 122c (PARILLADA)
- [ ] **Crear ingrediente** — "MOSTAZA 4 LT" con precio real por receta
- [ ] **Investigar** — ¿Misma marca DELY/LA ORIGINAL en recetas?

#### 3.1.7 MAYONESA ADEREZO LA PRIMERA 3.7 KG — 1 registro (marca distinta, 36% mayor)
| Receta | Precio Receta | Precio Catálogo | Marca Receta | Marca Catálogo |
|--------|---------------|-----------------|--------------|----------------|
| DD9669C8... SHAWARMA | 1036c | 761c | LA PRIMERA | DELY/LA ORIGINAL |

**Opciones:**
- [ ] **Crear ingrediente** — "MAYONESA ADEREZO LA PRIMERA 3.7 KG" (marca distinta, precio real)
- [ ] **Investigar** — ¿LA PRIMERA es proveedor actual? Actualizar catálogo

---

### 3.2 SEMANTICALLY_DIFFERENT Incompatibles (8 registros)

#### 3.2.1 APIO/800 GR — 2 registros (qty ≠ 800g)
| Receta | RI Presentation | RI Qty | Catálogo | Problema |
|--------|-----------------|--------|----------|----------|
| 462A... LOCRO DE ACELGA | 1KG | 1000g | ATADO (800 GR) | Compra 1KG vs catálogo 800g |
| 5355... PARILLADA CHORIZO | 800GR | 2200g | ATADO (800 GR) | Qty 2200g anómala (¿error dato?) |

**Opciones:**
- [ ] **LOCRO:** Crear "APIO 1 KG" o aprobar con factor conversión 1000/800 = 1.25
- [ ] **PARILLADA:** Investigar error dato (2200g para 10 porciones = 220g c/u, excesivo)

#### 3.2.2 ZUCCHINI VERDE 1 KILO — 6 registros (qty 1000g < rango catálogo 1500-2000g)
| Receta | RI Presentation | RI Qty | Catálogo | Problema |
|--------|-----------------|--------|----------|----------|
| 6 recetas | 1KG | 1000g | FUNDA/UNIDAD (1.5-2.0 KG) | Compra 1kg vs catálogo 1.5-2kg |

**Opciones:**
- [ ] **Crear ingrediente** — "ZUCCHINI VERDE 1 KG" (presentación distinta a catálogo)
- [ ] **Actualizar catálogo** — Ampliar rango a 1-2 KG si ambas presentaciones coexisten
- [ ] **Investigar** — ¿Recetas compran por kg suelto vs catálogo por funda?

---

### 3.3 NO_MATCH — Forma Distinta (1 registro)

#### 3.3.1 ACHIOTE ILE EN PASTA 1 KG — 1 registro
| Receta | Forma Receta | Catálogo | Candidato |
|--------|--------------|----------|-----------|
| 01B9BB08... CREMA ESPINACA | **Pasta** 1KG | Líquido 200ML | ACHIOTE LIQUIDO 200 ML (code 5) |

**Opciones:**
- [ ] **CREAR INGREDIENTE** — "ACHIOTE EN PASTA 1 KG" (falta en catálogo) — **RECOMENDADO**
- [ ] **Marcar UNRESOLVED** — Esperar proveedor

---

## Onda 4 — Irresoluble Sin Catálogo (1 registro)

| Ingrediente | Acción Requerida |
|-------------|------------------|
| **ACHIOTE ILE EN PASTA 1 KG** | **Crear en catálogo** con datos Excel: presentation="PASTA", purchase_quantity=1000, purchase_price=103c, category="CONDIMENTOS" |

---

## Matriz de Decisiones — Resumen para Usuario

| Grupo | Registros | Decisión Recomendada | Acción Usuario |
|-------|-----------|---------------------|----------------|
| **Onda 1: EXACT_MATCH** | 881 | **AUTO** — Sin intervención | — |
| **Onda 2: SEMANTIC_COMPATIBLE (64)** | 64 | **APROBAR EN BLOQUE** | ✅ Aprobar / ❌ Revisar individual |
| **Onda 2: POSSIBLE_MATCH (4)** | 4 | **APROBAR EN BLOQUE** | ✅ Aprobar / ❌ Revisar individual |
| **Onda 2: MULTIPLE_MATCH (1)** | 1 | **APROBAR candidato 40c** | ✅ Confirmar / ❌ Elegir 45c |
| **Onda 2: NO_MATCH precio OK (7)** | 7 | **APROBAR EN BLOQUE** | ✅ Aprobar / ❌ Revisar individual |
| **Onda 3: SAL 1 KL (9)** | 9 | **DECIDIR** | Opción A/B/C arriba |
| **Onda 3: ACEITE 20LT (7)** | 7 | **DECIDIR** | Opción A/B arriba |
| **Onda 3: COMINO 1 divergente (1)** | 1 | **DECIDIR** | Opción A/B arriba |
| **Onda 3: OREGANO (4)** | 4 | **DECIDIR** | Opción A/B/C arriba |
| **Onda 3: PIMIENTA (5)** | 5 | **DECIDIR** | Opción A/B/C arriba |
| **Onda 3: MOSTAZA (2)** | 2 | **DECIDIR** | Opción A/B/C arriba |
| **Onda 3: MAYONESA (1)** | 1 | **DECIDIR** | Opción A/B arriba |
| **Onda 3: APIO incompatible (2)** | 2 | **DECIDIR** | Opción A/B arriba |
| **Onda 3: ZUCCHINI (6)** | 6 | **DECIDIR** | Opción A/B/C arriba |
| **Onda 4: ACHIOTE PASTA (1)** | 1 | **CREAR INGREDIENTE** | ✅ Crear / ❌ Dejar UNRESOLVED |

---

## Próximos Pasos (Fase 4.4.5.B)

1. **Usuario revisa esta matriz** y marca decisiones en columna "Acción Usuario"
2. **Ejecutar migración Onda 1** (881 EXACT_MATCH) — automático
3. **Ejecutar migración Onda 2** (78 compatibles) — tras aprobación en bloque
4. **Procesar Onda 3** caso por caso — decisiones individuales
5. **Crear ingrediente Onda 4** — ACHIOTE EN PASTA 1 KG
6. **Validar integridad referencial** — FK `ingredient_id` poblado en `recipe_ingredients`
7. **Recalcular costos recetas** — propagar `unit_cost` desde catálogo vinculado

---

## Principio Rector

> **_"Es preferible conservar un registro pendiente que asignarle un ingrediente incorrecto."_**

Los 119 pendientes (11.9%) son **decisiones informadas**, no errores. La base sólida de 881 EXACT_MATCH (88.1%) permite migración inmediata de la mayoría.

---

**Fin del documento de decisiones de usuario**  
Generado desde validación forense completa de 1000 registros.  
Archivos asociados: `phase4.4.5a1-reconciliation-validation.md`, `phase4.4.5a1-final-mapping.csv`