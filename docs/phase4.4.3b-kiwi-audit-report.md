# Auditoría Correctiva de KIWI y Validación de Precisión del Catálogo

**Fecha:** 2026-11-20
**Proyecto:** Lunch v2 - Fase 4.4.3.B Post-Import Audit
**Archivo Excel:** `17-09-2026 REQ. COPIA MENU DESDE AGOSTO A JULIO 2026-2027 YUMISI (5).xlsx`
**SHA-256:** `059556f2c304766295fc7314bf83df0d0bca2ea74c062c9e9b57153b92faed20`

---

## 1. EVIDENCIA DE LA CELDA ORIGINAL DE KIWI

### Ubicación en Excel
- **Hoja:** `CATALOGO COSTEO 17-08-2`
- **Fila:** 140 (índice 139 base 0)
- **Columna:** E (índice 4, cabecera "costo")
- **Valor crudo:** `"5*1.00"` (tipo **string**, no fórmula Excel)

```text
Col 0: number = 139          (CÓDIGO)
Col 1: string = FRUTAS Y VEGETALES  (BODEGA)
Col 2: string = KIWI         (PRODUCTO)
Col 3: string = UNIDAD (100 GR)       (Presentación)
Col 4: string = 5*1.00       (costo)  ← TEXTO, no fórmula (=)
Col 5: string = ACTIVO       (estado)
```

### Comportamiento del Parser
El parser `parseCatalogSheet`:
1. Detecta que `"5*1.00"` no es numérico (`parseAmount` retorna `kind: 'unparseable-text'`)
2. Genera incidencia `CATALOG_COST_INVALID` severity ERROR
3. Deja `cost: undefined` (no convierte a Money)

**Incidencia generada:**
```json
{
  "code": "CATALOG_COST_INVALID",
  "field": "costo",
  "originalValue": "5*1.00",
  "severity": "ERROR",
  "description": "El costo de la fila 140 no es numérico ('5*1.00'). No se convirtió en cero."
}
```

---

## 2. INTERPRETACIÓN CORRECTA DEL PRECIO

### Significado comercial del texto `"5*1.00"`
- **No es una fórmula Excel** (falta signo `=`)
- **Es texto comercial** digitado manualmente significando:
  - 5 unidades × $1.00 = **$1.00 total por las 5 unidades**
  - 5 unidades × 100 g = **500 g peso total**
  - Precio total de compra: **USD 1.00 = 100 centavos**
  - Coste derivado por 100 g: **USD 0.20 = 20 centavos**
  - Coste por gramo: **USD 0.002000 = 0.2 centavos/g**

### Valores esperados según modelo aprobado

| Campo | Valor Esperado | Justificación |
|-------|----------------|---------------|
| `cost_cents` | **100** | Precio total de compra según modelo (F.2: Money en centavos enteros) |
| `purchase_unit_cost_raw` | **0.002** | Precisión sub-centavo por gramo (NUMERIC(12,6), ej. 0.0072 USD/g) |
| `source_formula` | **null** | No es fórmula Excel (no tiene `=`); el texto crudo `"5*1.00"` se conserva en `imported_rows.costRaw` |

> **Nota sobre `cost_cents`:** El esquema SQL comenta `cost_cents INTEGER NOT NULL, -- Money en centavos enteros`. El modelo `RecipeIngredient` usa `purchasePrice` como "PVP de compra de la presentación completa". Para consistencia, `ingredients.cost_cents` debe ser el **precio total de compra** del paquete comercial (100 centavos = $1.00 por 500g), no el precio unitario por presentación de catálogo.

---

## 3. SEMÁNTICA DEMOSTRADA DE LOS CAMPOS MONETARIOS

### Tabla `ingredients` (migración 001)
```sql
cost_cents INTEGER NOT NULL,              -- Money en centavos enteros
purchase_unit_cost_raw NUMERIC(12,6),     -- Precisión sub-centavo (ej. 0.007234 USD/g)
source_formula TEXT,                      -- Fórmula Excel original (ej. "=C5/D5")
```

### Entidad de dominio `Ingredient`
```typescript
cost: Money                              // Precio total de compra
purchaseUnitCostRaw?: number             // Costo unitario sub-centavo (ej. 0.0072 USD/g)
sourceFormula?: string                   // Fórmula Excel original (ej. "=C5/D5")
```

### Entidad `RecipeIngredient` (referencia de uso)
```typescript
purchasePrice: Money          // "PVP de compra de la presentación completa"
purchaseQuantity: number      // Cantidad en gramos
purchaseUnitCostRaw?: number  // "Costo unitario sub-centavo (ej. 0.0072 USD/g)"
```

**Conclusión:** `purchase_unit_cost_raw` **siempre expresa costo por gramo (USD/g)**, no por unidad de presentación.

---

## 4. ESTADO ACTUAL EN BASE DE DATOS (Post-Import Fase 4.4.3.B)

### KIWI (código 139)
| Campo | Valor Actual | Valor Esperado | Estado |
|-------|--------------|----------------|--------|
| `cost_cents` | 20 | 100 | ❌ **INCORRECTO** (es precio por 100g, no total) |
| `purchase_unit_cost_raw` | 0.20 | 0.002 | ❌ **INCORRECTO** (factor 100x; es por 100g, no por gramo) |
| `source_formula` | `'5*1.00 (texto comercial: 5 uds × $1.00 = $0.20/ud)'` | `null` | ❌ **INCORRECTO** (texto inventado, no fórmula Excel) |

### QUESO CREMA (código 252)
| Campo | Valor Actual | Valor Esperado | Estado |
|-------|--------------|----------------|--------|
| `cost_cents` | 103 | 103 | ✅ **CORRECTO** ($1.03 por unidad de 200g) |
| `purchase_unit_cost_raw` | 1.03 | 0.00515 | ❌ **INCORRECTO** (factor 200x; es por unidad, no por gramo) |
| `source_formula` | `null` | `null` | ✅ **CORRECTO** (era valor numérico, no fórmula) |

**Cálculo QUESO CREMA:**
- Presentación: "UNIDAD" (producto dice "200 GR")
- Coste unitario: $1.03 / 200g = **$0.00515/g**

---

## 5. DISCREPANCIAS ENCONTRADAS EN LOS 462 INGREDIENTES

### Hallazgo principal: Solo 2 ingredientes tienen `purchase_unit_cost_raw` no-null
```sql
SELECT COUNT(*) FROM ingredients WHERE purchase_unit_cost_raw IS NOT NULL;
-- Resultado: 2 (KIWI y QUESO CREMA)
```

Los otros 460 ingredientes tienen `purchase_unit_cost_raw = NULL` (correcto, no se calculó sub-centavo).

### Problema sistemático en script de importación (`run-production-import.ts` líneas 559-571)
```typescript
// KIWI
purchaseUnitCostRaw = 0.20  // ❌ Debe ser 0.002 (por gramo)

// QUESO CREMA
purchaseUnitCostRaw = 1.03  // ❌ Debe ser 0.00515 (por gramo)
```

El script asigna el **costo por unidad de presentación** en lugar del **costo por gramo**.

### Otros hallazgos del catálogo (solo lectura, no requieren corrección)
| Ítem | Código | Presentación | Coste | Observación |
|------|--------|--------------|-------|-------------|
| ACEITE CANECA 20 LT | 1 | 20 LITROS | $35.60 | Coste por presentación completa ✓ |
| ARROZ MACAREÑO ARROBA | 17 | ARROBA/ 22 LB | $12.98 | Coste por presentación completa ✓ |
| AZUCAR ARROBA | 26 | ARROBA | $13.50 | Coste por presentación completa ✓ |
| HARINA TREBOL 50 KG | 127 | KILO | $37.22 | Coste por kg (no por 50kg) - verificar presentación |

> **Nota:** El catálogo usa presentaciones heterogéneas (UNIDAD, KILO, LIBRA, ARROBA, QUINTAL, 20 LITROS). El campo `cost_cents` almacena el precio **para la presentación tal como está escrita**. No se normaliza a unidad base en esta fase.

---

## 6. ESTADO DE TRAZABILIDAD F.7

| Dominio | source_formula | source_cell | purchase_unit_cost_raw | Estado |
|---------|---------------|-------------|------------------------|--------|
| **ingredients** | Parcial (KIWI tiene texto inventado) | ❌ No en tabla | 2/462 con valor (ambos incorrectos) | **REQUIERE CORRECCIÓN** |
| **recipe_ingredients** | ❌ NULL (parser no propaga) | ❌ NULL | ❌ NULL | Pendiente Phase 4.4.3.C+ |
| **meal_composition_components** | ❌ NULL (parser no propaga) | ❌ NULL | ❌ NULL | Pendiente Phase 4.4.3.C+ |

---

## 7. CORRECCIONES PROPUESTAS

### 7.1 Corrección KIWI (código 139)
```sql
UPDATE ingredients
SET 
    cost_cents = 100,
    purchase_unit_cost_raw = 0.002,
    source_formula = NULL,
    updated_at = NOW()
WHERE code = '139';
```

**Valores resultantes:**
- `cost_cents = 100` (100 centavos = $1.00 total por 500g)
- `purchase_unit_cost_raw = 0.002` ($0.002/g = 0.2 centavos/g)
- `source_formula = NULL` (no hay fórmula Excel)

### 7.2 Corrección QUESO CREMA (código 252)
```sql
UPDATE ingredients
SET 
    purchase_unit_cost_raw = 0.00515,
    updated_at = NOW()
WHERE code = '252';
```

**Valores resultantes:**
- `cost_cents = 103` (sin cambio, $1.03 por unidad de 200g)
- `purchase_unit_cost_raw = 0.00515` ($1.03 / 200g = $0.00515/g)
- `source_formula = NULL` (sin cambio)

### 7.3 Corrección idempotente (segura para re-ejecución)
```sql
-- KIWI: solo actualizar si valores difieren
UPDATE ingredients
SET 
    cost_cents = 100,
    purchase_unit_cost_raw = 0.002,
    source_formula = NULL,
    updated_at = NOW()
WHERE code = '139'
  AND (cost_cents != 100 OR purchase_unit_cost_raw != 0.002 OR source_formula IS NOT NULL);

-- QUESO CREMA: solo actualizar purchase_unit_cost_raw si difiere
UPDATE ingredients
SET 
    purchase_unit_cost_raw = 0.00515,
    updated_at = NOW()
WHERE code = '252'
  AND purchase_unit_cost_raw != 0.00515;
```

---

## 8. ARCHIVOS QUE REQUIEREN CORRECCIÓN (Para futuras importaciones)

### `run-production-import.ts` (líneas 559-571)
```typescript
// ANTES (incorrecto)
if (i.costRaw === '5*1.00' || (i.code.toString() === '139' && i.product.includes('KIWI'))) {
  costCents = 20              // ❌ Precio por 100g
  purchaseUnitCostRaw = 0.20  // ❌ Por 100g, no por gramo
  sourceFormula = '5*1.00 (texto comercial: 5 uds × $1.00 = $0.20/ud)'
}

// DESPUÉS (correcto)
if (i.costRaw === '5*1.00' || (i.code.toString() === '139' && i.product.includes('KIWI'))) {
  costCents = 100             // ✅ Precio total de compra (500g = 5×100g por $1.00)
  purchaseUnitCostRaw = 0.002 // ✅ Por gramo: $1.00 / 500g = $0.002/g
  sourceFormula = null        // ✅ No es fórmula Excel
}

if (i.code.toString() === '252' && i.product.includes('QUESO CREMA')) {
  costCents = 103
  purchaseUnitCostRaw = 0.00515  // ✅ Por gramo: $1.03 / 200g = $0.00515/g
  sourceFormula = null
}
```

---

## 9. PROBLEMAS PENDIENTES (Fuera de alcance de esta auditoría)

1. **Parser de catálogo**: No extrae `source_cell` (celda origen) ni `source_sheet` para trazabilidad F.7 completa
2. **Normalización de presentaciones**: 460 items tienen `purchase_unit_cost_raw = NULL`; se requiere cálculo automático por gramo basado en presentación
3. **Fórmulas Excel reales**: 22 fórmulas detectadas en columna costo (según Fase 4.4.3.A) - no se propagan a `source_formula`
4. **Matching de platos en menú**: 320/926 celdas sin match por diferencias de nombres (Phase 4.4.3.B gap)

---

## 10. CONFIRMACIONES

- ✅ No se realizó segunda importación del Excel
- ✅ No se truncaron tablas
- ✅ No se modificaron registros sin autorización (este es solo informe de auditoría)
- ✅ No se desactivó RLS
- ✅ No se expuso Service Role Key
- ✅ Verificación mediante consultas de solo lectura con Service Role Key (bypass RLS solo para auditoría)

---

## 11. PRÓXIMOS PASOS REQUERIDOS

1. **Autorización explícita** para ejecutar correcciones SQL propuestas (sección 7)
2. **Corrección de `run-production-import.ts`** para futuras importaciones (sección 8)
3. **Verificación post-corrección**:
   - Consultar KIWI y QUESO CREMA directamente en PostgreSQL
   - Verificar que la aplicación recupera valores correctos vía `ingredientRepository.list()`
   - Ejecutar `npx tsc -b`, `npm run test`, `npm run build`