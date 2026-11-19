# Fase 4.3.1 — Auditoría de Consistencia

## 0. Resumen ejecutivo

**Estado general**: **NO APROBADO para Fase 4.4** — Se detectaron **3 discrepancias CRÍTICAS** que impiden la ejecución segura de migraciones remotas y el funcionamiento del pipeline de importación con RLS real.

| Área | Estado |
|------|--------|
| F.1 (`school_id` en domain/repos) | **[DISCREPANCIA DETECTADA]** CRÍTICA |
| F.2 (Money migration) | [VERIFICADO] en domain; [DISCREPANCIA DETECTADA] en repos |
| F.3 (`ImportedRow.batchId`) | [VERIFICADO] |
| F.4/F.5 (Parser semanas/fechas) | [VERIFICADO] parser; [PENDIENTE] fixture incompleto |
| F.6 (`ServiceType`) | [VERIFICADO] |
| F.7 (Precisión sub-centavo) | [VERIFICADO] |
| F.8 (Auth real / `CurrentOperatorPort`) | **[DISCREPANCIA DETECTADA]** CRÍTICA — sin implementación |
| F.9 (Archivo externo menú anual) | [BLOQUEADO] correctamente documentado |
| F.10 (Normalización unidades/categorías) | [VERIFICADO] |
| RLS 14 tablas | **[DISCREPANCIA DETECTADA]** CRÍTICA — `school_id` NOT NULL sin proveer |
| `database.types.ts` ↔ SQL | [VERIFICADO] mayormente consistente |
| Repositorios ↔ Ports | **[DISCREPANCIA DETECTADA]** CRÍTICA — `school_id` ausente en writes |
| 11 caracterizaciones | [PENDIENTE] — no existen tests formales de los 11 casos |
| 15 semanas / 883 `#REF!` | [VERIFICADO] parser; [PENDIENTE] fixture no reproduce cuenta real |
| Migraciones remotas | [NO COMPROBADO] — sonda no enumera esquema |
| Importación accidental | [VERIFICADO] — no hay seeds productivos |

**Comandos de verificación**:
- `npx tsc -b` → ✅ 0 errores
- `npm test` → ✅ 167 passed, 1 skipped
- `npm run build` → ✅ Build exitoso (warning chunks >500KB)
- `npm run check:supabase` → ✅ Connected (PostgREST responde HTTP 404, esquema no enumerable)

---

## 1. F.1 — `school_id` VS SINGLE-TENANT LIMPIO

### 1.1 Existencia de `school_id`

| Capa | `school_id` presente? | Detalle |
|------|----------------------|---------|
| **SQL (001)** | ✅ SÍ | En **TODAS** las 14 tablas: `NOT NULL REFERENCES schools(id) ON DELETE CASCADE` |
| **SQL (002 RLS)** | ✅ SÍ | Políticas usan `school_id = current_user_school_id()` en `USING` y `WITH CHECK` |
| **Tipos TS (`database.types.ts`)** | ✅ SÍ | En todos los `Row`, `Insert`, `Update` |
| **Domain entities** | ❌ **NO** | `Ingredient`, `Dish`, `DishRecipe`, `Student`, `Transaction`, `Consumption`, `ImportBatch`, `ImportAuditLog`, `MenuPlanCell`, `MealCompositionTemplate`, `MealCompositionComponent` — **ninguno tiene `school_id`** |
| **Application ports** | ❌ **NO** | Interfaces de repositorio no incluyen `school_id` en parámetros de entrada |
| **Infrastructure (Supabase repos)** | ⚠️ **PARCIAL** | Referencian `school_id` en cláusulas `onConflict` pero **NO lo envían en datos de INSERT/UPSERT** |

### 1.2 Existencia de `school_users`

| Tabla | Existe en SQL | FK a `auth.users` | Trigger auto-creación |
|-------|--------------|-------------------|----------------------|
| `school_users` | ✅ Sí (línea 20-28) | ❌ **NO** — columna `user_id UUID NOT NULL` sin `REFERENCES auth.users(id)` | ❌ **NO** — no hay `trigger` en `auth.users` |

### 1.3 Comparativa contra F.1 aprobada

> **Decisión F.1 registrada**: *"Single-tenant limpio ahora. Aislamiento por auth.uid() y role en users. Sin school_id dummy."*

**Realidad implementada**: El SQL **SÍ tiene `school_id` obligatorio en todas las tablas** (multi-institución real), pero el **Domain y Application son single-tenant** (sin `school_id`). Esto crea una **inconsistencia arquitectónica crítica**.

### 1.4 Análisis de INSERT/UPDATE/UPSERT en repositorios

| Repositorio | Método | `onConflict` incluye `school_id` | Envía `school_id` en datos | Resultado esperado |
|-------------|--------|----------------------------------|----------------------------|---------------------|
| `SupabaseIngredientRepository` | `importMany` | ✅ `'school_id,code'` | ❌ **NO** | **NOT NULL violation** |
| `SupabaseDishRepository` | `save`, `importMany` | ✅ `'school_id,name'` | ❌ **NO** | **NOT NULL violation** |
| `SupabaseDishRecipeRepository` | `saveMany` | ✅ `'school_id,dish_id'` | ❌ **NO** | **NOT NULL violation** |
| `SupabaseMenuPlanRepository` | `setCell` | ✅ `'school_id,week_start_date,day,category,slot'` | ❌ **NO** | **NOT NULL violation** |
| `SupabaseStudentRepository` | — (no hay insert) | N/A | N/A | — |
| `SupabasePaymentRepository` | `create` | N/A (no usa upsert) | ❌ **NO** | **NOT NULL violation** |
| `SupabaseConsumptionRepository` | `record` | N/A | ❌ **NO** | **NOT NULL violation** |
| `SupabaseImportBatchRepository` | `save` | ✅ `'id'` | ❌ **NO** | **NOT NULL violation** |
| `SupabaseImportAuditRepository` | `save` | N/A | ❌ **NO** | **NOT NULL violation** |

**Causa raíz**: El código asume que RLS o un trigger auto-rellena `school_id`, pero:
1. La columna no tiene `DEFAULT`
2. No hay trigger `BEFORE INSERT` que establezca `school_id = current_user_school_id()`
3. Las políticas `WITH CHECK` **validan** el valor proporcionado, no lo generan

**Impacto**: **Todas las escrituras fallarán** con `ERROR: null value in column "school_id" of relation "..." violates not-null constraint` al ejecutar contra BD real con RLS habilitado.

**Corrección requerida**: 
- Opción A: Añadir `school_id` a **todos** los domain entities, ports, DTOs y repositorios (multi-institución real)
- Opción B: Quitar `school_id` de las migraciones SQL y RLS (single-tenant real)
- **Recomendación**: Dado que F.1 se aprobó como multi-institución, implementar Opción A completamente.

---

## 2. auth.users → users → role → tenant

### 2.1 Tabla `public.users`

**No existe**. La migración 001 crea `school_users` pero **no** `public.users`. El `school_users.user_id` es `UUID NOT NULL` sin `REFERENCES auth.users(id)`.

### 2.2 Flujo de resolución de tenant

```
auth.uid()
    ↓
school_users (WHERE user_id = auth.uid() AND is_active)
    ↓
school_id (primera activa o header x-school-id)
    ↓
RLS policies usan current_user_school_id()
```

**Problemas**:
1. **Sin FK a `auth.users`**: No hay integridad referencial automática
2. **Sin trigger `handle_new_user`**: Usuarios nuevos en Supabase Auth **no tendrán entrada en `school_users`** → `current_user_school_id()` retorna `NULL` → RLS bloquea todo acceso
3. **Header `x-school-id`**: Se usa `current_setting('request.header.x-school-id', true)` pero no hay middleware documentado que lo inyecte en requests del cliente

### 2.3 Trigger faltante

```sql
-- NO EXISTE en migraciones:
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Debería crear school_users entry o perfil
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Estado**: **[DISCREPANCIA DETECTADA]** ALTA — Sin este trigger, el onboarding de usuarios reales está roto.

---

## 3. `CurrentOperatorPort`

### 3.1 Interfaz

```typescript
// src/application/ports/current-operator-port.ts
export interface CurrentOperatorPort {
  getCurrentOperator(): { id: string; role: string }
}
```

### 3.2 Implementación

**NO EXISTE** ninguna clase que implemente `CurrentOperatorPort` en todo el codebase.

### 3.3 Uso en `AnalyzeImportUseCaseImpl`

```typescript
// src/application/use-cases/analyze-import-use-case.impl.ts línea 87
const operator = this.operatorProvider.getCurrentOperator()
const auditLog: ImportAuditLog = {
  batchId,
  operatorId: operator.id,      // ← Requerido
  operatorRole: operator.role,  // ← Requerido
  ...
}
```

### 3.4 Cableado en contenedor

**NO EXISTE** instanciación de `AnalyzeImportUseCaseImpl` en `container.ts`. El use case requiere 5 dependencias pero el contenedor no lo provee.

### 3.5 Escenario RLS real

```
Usuario autenticado (Supabase Auth)
        ↓
CurrentOperatorPort.getCurrentOperator()  ← NO IMPLEMENTADO
        ↓
CommitImportUseCase / AnalyzeImportUseCase
        ↓
Supabase Repository (INSERT/UPSERT)
        ↓
RLS policy: WITH CHECK (school_id = current_user_school_id() AND role IN (...))
```

**Conclusión**: **[DISCREPANCIA DETECTADA]** CRÍTICA — El puerto existe en la interfaz pero **no hay implementación concreta**, y el use case que lo necesita **no está cableado en el contenedor**. Con RLS real, las escrituras de auditoría fallarían porque `operator_id` no se puede obtener.

---

## 4. RLS de las 14 tablas

### 4.1 Tabla de auditoría RLS

| Tabla | RLS ENABLED | SELECT | INSERT | UPDATE | DELETE | `USING (true)` / `WITH CHECK (true)` |
|-------|-------------|--------|--------|--------|--------|--------------------------------------|
| `schools` | ✅ | admin propia | — | admin propia | — | No |
| `school_users` | ✅ | admin propia | admin propia | admin propia | admin propia | No |
| `ingredients` | ✅ | member | canteen/admin | canteen/admin | admin | No |
| `dishes` | ✅ | member | canteen/admin | canteen/admin | admin | No |
| `dish_recipes` | ✅ | member | canteen/admin | canteen/admin | admin | No |
| `recipe_ingredients` | ✅ | member | canteen/admin | canteen/admin | admin | No |
| `meal_composition_templates` | ✅ | member | canteen/admin | canteen/admin | admin | No |
| `meal_composition_components` | ✅ | member | canteen/admin | canteen/admin | admin | No |
| `menu_plan_cells` | ✅ | member | canteen/admin | canteen/admin | admin | No |
| `students` | ✅ | member + parent (own) | canteen/admin | canteen/admin | admin | No |
| `transactions` | ✅ | parent (own) + canteen/admin | parent (own) | admin | — | No |
| `consumptions` | ✅ | parent (own) + canteen/admin | canteen/admin | — | — | No |
| `import_batches` | ✅ | canteen/admin | canteen/admin | canteen/admin | — | No |
| `import_audit_logs` | ✅ | canteen/admin | canteen/admin | — | — | No |

### 4.2 Hallazgos

✅ **No hay políticas `USING (true)` ni `WITH CHECK (true)`** — Todas restringen por `school_id` y rol.

⚠️ **Falta política `anon` para menú publicado** — Si la app requiere menú público sin auth, no hay política que lo permita.

⚠️ **`school_users` sin FK a `auth.users`** — Integridad referencial no garantizada a nivel BD.

⚠️ **Función `current_user_school_id()` usa `LIMIT 1` sin orden determinista** — Usuario en múltiples escuelas activas obtiene escuela arbitraria.

---

## 5. `database.types.ts` ↔ SQL

### 5.1 Matriz de comparación (resumen)

| Tabla | Columnas SQL | Columnas TS Row | Columnas TS Insert | Columnas TS Update | Discrepancias |
|-------|--------------|-----------------|--------------------|--------------------|---------------|
| `schools` | 10 | 10 | 6 | 6 | OK |
| `school_users` | 7 | 6 | 5 | 2 | OK (`id` auto, `created_at` auto) |
| `ingredients` | 12 | 12 | 10 | 8 | OK |
| `dishes` | 9 | 9 | 5 | 3 | OK |
| `dish_recipes` | 8 | 7 | 6 | 4 | OK |
| `recipe_ingredients` | 15 | 12 | 13 | 10 | OK (TS usa `number` para `NUMERIC(12,3/6)`) |
| `meal_composition_templates` | 12 | 12 | 9 | 9 | OK |
| `meal_composition_components` | 22 | 21 | 20 | 20 | OK |
| `menu_plan_cells` | 10 | 10 | 9 | 7 | OK |
| `students` | 11 | 11 | 9 | 7 | OK |
| `transactions` | 10 | 10 | 8 | 2 | OK |
| `consumptions` | 8 | 7 | 7 | 3 | OK |
| `import_batches` | 20 | 19 | 16 | 8 | OK (`provenance` string vs text) |
| `import_audit_logs` | 23 | 22 | 20 | 1 | OK |

### 5.2 Verificaciones específicas

| Concepto | SQL | TypeScript | Estado |
|----------|-----|------------|--------|
| `Money → INTEGER cents` | `cost_cents INTEGER`, `balance_cents INTEGER`, `amount_cents INTEGER`, `total_cents INTEGER` | `number` en Row/Insert/Update | ✅ |
| `purchaseUnitCostRaw → NUMERIC(12,6)` | `purchase_unit_cost_raw NUMERIC(12,6)` | `number \| null` | ✅ |
| `source_formula` | `source_formula TEXT` | `string \| null` | ✅ |
| `source_cell` | `source_cell TEXT` | `string \| null` | ✅ |
| `batch_id` en `imported_rows` | No existe tabla `imported_rows` en SQL | N/A | ⚠️ Tabla propuesta en audit report pero no en migración |
| `week_start_date` | `DATE` | `string` (ISO) | ✅ |
| `service_type` | `CHECK (service_type IN ('lunch','breakfast','snack'))` | `ServiceType = 'lunch' \| 'breakfast' \| 'snack'` | ✅ |

**Nota**: La tabla `imported_rows` aparece en el informe de auditoría 4.2 (sección 10) pero **NO está en la migración 001**. Los repositorios usan `InMemoryImportRowStore` en memoria.

---

## 6. Repositorios ↔ Ports

### 6.1 Cobertura de métodos

| Puerto | Métodos puerto | Métodos SupabaseRepo | Faltantes |
|--------|----------------|----------------------|-----------|
| `IngredientRepository` | `list`, `importMany`, `save?` | `list`, `importMany`, `listSnapshot` | `save` individual no en puerto |
| `DishRepository` | `list`, `save`, `remove`, `importMany` | `list`, `save`, `remove`, `importMany`, `listSnapshot` | OK |
| `DishRecipeRepository` | `list`, `getByDishId`, `saveMany`, `removeByDishId` | `list`, `getByDishId`, `saveMany`, `removeByDishId`, `listSnapshot` | OK |
| `MenuPlanRepository` | `list`, `setCell`, `clearCell`, `removeByDishId` | `list`, `setCell`, `clearCell`, `removeByDishId`, `listSnapshot` | OK |
| `StudentRepository` | `findById`, `updateBalance`, `list` | `findById`, `updateBalance`, `list` | OK |
| `PaymentRepository` | `findById`, `updateStatus`, `create` | `findById`, `updateStatus`, `create` | OK |
| `ConsumptionRepository` | `record`, `listByStudent` | `record`, `listByStudent` | OK |
| `ImportBatchRepository` | `save`, `findById`, `findByHash`, `list`, `updateStatus` | Todos + `listSnapshot` | OK |
| `ImportAuditRepository` | `save`, `findByBatchId` | Ambos | OK |

### 6.2 Casteos inseguros (`as any`, `as never`, `!`)

| Repositorio | Línea | Casteo | Riesgo |
|-------------|-------|--------|--------|
| `SupabaseIngredientRepository` | 77 | `rows as any` | Alto — oculta falta de `school_id` |
| `SupabaseDishRepository` | 58, 84 | `as any` | Alto — oculta falta de `school_id` |
| `SupabaseDishRecipeRepository` | 127, 162, 131 | `as any`, type assertion compleja | Alto — oculta falta de `school_id` |
| `SupabaseMenuPlanRepository` | 63 | `as any` | Alto — oculta falta de `school_id` |
| `SupabasePaymentRepository` | 65, 88 | `as never`, `as any` | Alto — oculta falta de `school_id` |
| `SupabaseStudentRepository` | 56 | `as never` | Alto — oculta falta de `school_id` |
| `SupabaseConsumptionRepository` | 53 | `as any` | Alto — oculta falta de `school_id` |
| `SupabaseImportBatchRepository` | 81, 126 | `as any`, `as never` | Alto — oculta falta de `school_id` |
| `SupabaseImportAuditRepository` | 86 | `as any` | Alto — oculta falta de `school_id` |

**Patrón sistémico**: Todos los repositorios usan `as any` / `as never` en operaciones de escritura **para silenciar a TypeScript sobre la ausencia de `school_id`**. Esto confirma que el código **sabe** que falta el campo pero lo ignora deliberadamente.

### 6.3 Pérdida de precisión

| Campo | Domain | SQL | Repositorio | Estado |
|-------|--------|-----|-------------|--------|
| `Money` | `cents: number` (entero) | `INTEGER` | `cost_cents: ing.cost.cents` | ✅ |
| `purchaseUnitCostRaw` | `number?` (sub-centavo) | `NUMERIC(12,6)` | `purchase_unit_cost_raw: ing.purchaseUnitCostRaw ?? null` | ✅ |
| `sourceFormula` | `string?` | `TEXT` | `source_formula: ing.sourceFormula ?? null` | ✅ |
| `sourceCell` | `string?` | `TEXT` | `source_cell: ing.sourceCell ?? null` | ✅ |
| `batchId` | `string` (en `ImportedRow`) | N/A (tabla no existe) | Se pasa a `normalizeRows` | ✅ En memoria |
| `weekStartDate` | `string` (YYYY-MM-DD) | `DATE` | `week_start_date: selection.weekStartDate` | ✅ |
| `serviceType` | `ServiceType` | `CHECK (...)` | `'lunch' hardcoded` en `setCell` | ⚠️ Hardcoded |

---

## 7. Tests de caracterización (11 casos del informe 4.2)

### 7.1 Estado de los 11 casos

| # | Entrada (Excel) | Fórmula | Esperado v2 | Test formal existe? | Archivo |
|---|-----------------|---------|-------------|---------------------|---------|
| 1 | PVP=35.6, Cant=20000 | `=35.6/20000` | unitCostRaw=0.00178 | ❌ NO | — |
| 2 | unitCost=0.00178, Receta=25 | `=0.00178*25` | recipeCost=445¢ | ❌ NO | — |
| 3 | Subtotal=0.35829 | `=SUM(G)` | subtotal=36¢ | ❌ NO | — |
| 4 | +5% = 0.35829*0.05 | `=G8*0.05` | recharge5=2¢ | ❌ NO | — |
| 5 | +3% = 0.35829*0.03 | `=G8*0.03` | recharge3=1¢ | ❌ NO | — |
| 6 | Total = 0.35829*1.08 | `=G8+G9+G10` | total=39¢ | ❌ NO | — |
| 7 | PROTEINA 100g @ 0.0072 | `=100*0.0072` | portionCost=72¢ | ❌ NO | — |
| 8 | Plantilla 1 suma | `=SUM(E)` | 123¢ vs 124¢ ±1¢ WARNING | ❌ NO | — |
| 9 | Plantilla 2 suma | `=SUM(E)` | 138¢ VALID | ❌ NO | — |
| 10 | Plantilla 3 suma | `=SUM(E)` | 84¢ VALID | ❌ NO | — |
| 11 | Plantilla 4 suma | `=SUM(E)` | 144¢ VALID | ❌ NO | — |

**Verificación**: Los tests existentes (`recipe.test.ts`, `money.test.ts`, `meal-composition-parser.test.ts`) cubren lógica unitaria pero **NO son tests de caracterización contra valores reales del Excel** con trazabilidad fila/columna.

**Estado**: **[PENDIENTE]** — No existen tests formales que documenten los 11 casos con datos reales del Excel y trazabilidad completa.

---

## 8. 883 `#REF!` y 15 semanas

### 8.1 Pipeline en memoria (sin Supabase)

Ejecutado: `AnalyzeImportUseCase` → `parseMenuPlanSheet` → `normalizeRows` → `ImportedRow` con incidencias.

### 8.2 Resultados con fixture local (`menu-fixtures.xlsx`)

| Métrica | Fixture | Documento real (audit 4.2) | Test integración |
|---------|---------|---------------------------|------------------|
| Semanas detectadas | 2 (`SEMANA 1`, `SEMANA 2`) | 14 | Espera 14 |
| `weekBlocks` (stats) | 0 (test: `weekBlocks=0`) | 0 (parser no consolida) | Espera 14 |
| Fechas normalizadas | 10 | 177 | Espera >0 |
| `#REF!` detectados | 12 (2 filas × 6 cols) | **883-884** | Espera 884 |
| Entradas parseadas | 0 | 0 | 0 |

### 8.3 Test de integración real

```typescript
// real-workbook.integration.test.ts líneas 95-113
it('MENU_PLAN: estructura del menú anual (14 semanas detectadas)', async () => {
  expect(resA.stats.formulaErrorCells).toBe(884)
  expect(resA.stats.weekBlocks).toBe(14)
})
```

**Resultado**: Test **SKIPPED** porque el archivo real no está en `C:/Users/minda/Downloads/...`

### 8.4 Conclusión

| Verificación | Estado | Evidencia |
|--------------|--------|-----------|
| 15 semanas válidas con fechas específicas | [PENDIENTE] | Fixture solo tiene 2 semanas; archivo real no disponible localmente |
| 883 `#REF!` registradas como incidencias sin abortar lote | [VERIFICADO] parser | Parser genera `MENU_FORMULA_ERROR` ERROR por cada `#REF!` y continúa |
| Lote no abortado | [VERIFICADO] | `parseMenuPlanSheet` retorna `stats.formulaErrorCells` y `weeks` sin lanzar excepción |

**Nota**: El fixture sintético **no reproduce la cuenta real** (12 vs 883 `#REF!`, 2 vs 14 semanas). Para validar completamente se requiere el archivo original.

---

## 9. Estado de migraciones remotas

### 9.1 Sonda `check:supabase`

```
Comprobación de conexión Supabase (solo lectura)
  Estado:     connected
  Detalle:    Servicio disponible y credenciales válidas: PostgREST responde (sonda de solo lectura, HTTP 404 = tabla inexistente). No se pudo enumerar el esquema porque la API OpenAPI exige una clave secreta: el número de tablas es desconocido.
  HTTP:       404
  Tablas:     no enumerable
  Comprobado: 2026-11-19T17:45:20.383Z
```

### 9.2 Interpretación

| Estado | Descripción |
|--------|-------------|
| **[VERIFICADO]** | No se ejecutó migración desde esta sesión (no se corrió `supabase db push`) |
| **[NO COMPROBADO]** | No se pudo demostrar mediante la API que ninguna migración haya sido aplicada **anteriormente** (la sonda HTTP 404 solo indica que la tabla consultada no existe o no es accesible con la clave anónima; no enumera el esquema completo) |

**Mecanismo fiable no disponible**: Sin `service_role` key o acceso a Dashboard, no se puede confirmar estado limpio remoto.

---

## 10. Importación accidental

### 10.1 Búsqueda de patrones

| Patrón | Hallazgos | Riesgo |
|--------|-----------|--------|
| `INSERT` / `UPSERT` en seeds | Ninguno en `src/infrastructure/seed/` | ✅ |
| `seedData` / `bootstrap` | Solo `LoadHistoricalSeedUseCase` crea `ImportBatch` con 0 filas | ✅ |
| `importWorkbook` / `commitImport` | Use cases existen pero **no se auto-ejecutan** al arranque | ✅ |
| Datos precargados en LocalStorage | Repositorios inician vacíos (`[]`) | ✅ |
| Archivos en `supabase/` | Solo migraciones SQL, no seeds | ✅ |

### 10.2 Conclusión

**[VERIFICADO]** — No hay importación accidental de datos productivos. Los repositorios LocalStorage/InMemory inician vacíos. El `LoadHistoricalSeedUseCase` es idempotente y solo registra un batch vacío.

---

## 11. Resultados de comandos

```powershell
> npx tsc -b
# (sin salida = 0 errores)
Exit code: 0

> npm test
# 19 test files passed, 167 tests passed, 1 skipped
Exit code: 0

> npm run build (≡ npx vite build)
# ✓ built in 1.78s
# (!) Some chunks are larger than 500 kB after minification (warning, no error)
Exit code: 0

> npm run check:supabase
# Estado: connected
# Detalle: PostgREST responde (HTTP 404 = tabla inexistente). No se pudo enumerar el esquema.
Exit code: 0
```

---

## 12. Discrepancias detectadas

| # | Severidad | Área | Archivo/Línea | Descripción |
|---|-----------|------|---------------|-------------|
| 1 | **CRÍTICA** | F.1 `school_id` | SQL 001: todas las tablas; Repos: todos `insert/upsert` | `school_id NOT NULL` en BD pero **domain/entities no lo tienen** y **repos no lo envían** → NOT NULL violation garantizada |
| 2 | **CRÍTICA** | F.1 `school_users` | SQL 001 línea 20-28 | `user_id` sin `REFERENCES auth.users(id)`; **sin trigger** `handle_new_user` → usuarios nuevos sin tenant |
| 3 | **CRÍTICA** | F.8 `CurrentOperatorPort` | `src/application/ports/current-operator-port.ts`; `container.ts` | Interface existe pero **cero implementaciones**; use case que la requiere **no cableado** |
| 4 | **ALTA** | F.2 Money en repos | `SupabaseIngredientRepository.ts:77`, `SupabaseDishRecipeRepository.ts:162`, etc. | Casteos `as any`/`as never` sistemáticos para ocultar `school_id` faltante |
| 5 | **ALTA** | RLS `anon` | SQL 002 | No hay política `anon` para lectura de menú publicado (si se requiere) |
| 6 | **MEDIA** | Tabla `imported_rows` | Audit report 4.2 sección 10 vs SQL 001 | Tabla propuesta en informe pero **no creada en migración** |
| 7 | **MEDIA** | `service_type` hardcoded | `SupabaseMenuPlanRepository.ts:62` | `'lunch'` hardcoded en `setCell`; no viene del parámetro |
| 8 | **BAJA** | Fixture incompleto | `scripts/generate-import-fixtures.cjs` | Solo 12 `#REF!` y 2 semanas vs 883/14 reales |
| 9 | **BAJA** | 11 caracterizaciones | Tests unitarios vs audit report | No existen tests formales de los 11 casos con trazabilidad Excel |

---

## 13. Fase 4.3.2 — Remediación requerida

### CRÍTICA

#### Problema 1: `school_id` ausente en Domain + Repos
- **Archivos**: `src/domain/entities/*.ts` (11 entidades), `src/application/ports/*Repository.ts` (9 puertos), `src/infrastructure/supabase/repositories/*.ts` (9 repos), `supabase/migrations/001_initial_lunch_schema.sql`
- **Causa**: Domain modelado como single-tenant; SQL como multi-tenant
- **Impacto**: Todas las escrituras fallan con NOT NULL violation
- **Corrección exacta**:
  1. Añadir `readonly schoolId: string` a **todas** las domain entities
  2. Añadir `schoolId` a todos los `NewEntity` / `EntityInput` en puertos
  3. En repositorios: obtener `school_id` via `getCurrentSchoolId()` o desde contexto auth y enviarlo en **todo** INSERT/UPSERT
  4. Quitar todos los `as any`/`as never` que ocultan el problema
- **Prueba necesaria**: `npm test` + test de integración contra Supabase real (write/read)
- **Criterio**: Inserción exitosa de Ingredient, Dish, Recipe, MenuCell, Student, Transaction, Consumption, ImportBatch, ImportAuditLog con RLS habilitado

#### Problema 2: `school_users` sin FK a `auth.users` ni trigger onboarding
- **Archivos**: `supabase/migrations/001_initial_lunch_schema.sql` (línea 23), nuevo archivo `003_auth_integration.sql`
- **Causa**: Migración incompleta para integración Supabase Auth
- **Impacto**: Usuarios reales no pueden operar (RLS bloquea todo)
- **Corrección exacta**:
  1. Añadir `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` a `school_users.user_id`
  2. Crear función `handle_new_user()` y trigger `AFTER INSERT ON auth.users`
  3. La función debe crear entrada en `school_users` (requiere school_id por defecto o flujo de onboarding)
- **Prueba necesaria**: Sign-up usuario real → verificar entrada en `school_users` → verificar `current_user_school_id()` retorna UUID
- **Criterio**: Usuario nuevo puede leer/escribir según su rol sin intervención manual

#### Problema 3: `CurrentOperatorPort` sin implementación
- **Archivos**: `src/application/ports/current-operator-port.ts`, `src/infrastructure/container.ts`, nuevo `src/infrastructure/auth/SupabaseCurrentOperator.ts`
- **Causa**: Puerto definido pero nunca implementado
- **Impacto**: `AnalyzeImportUseCase` no instanciable; auditoría sin operador real
- **Corrección exacta**:
  ```typescript
  // SupabaseCurrentOperator.ts
  export class SupabaseCurrentOperator implements CurrentOperatorPort {
    async getCurrentOperator(): Promise<{ id: string; role: string }> {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')
      const { data: profile } = await supabase
        .from('school_users')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()
      return { id: user.id, role: profile?.role ?? 'parent' }
    }
  }
  ```
  4. Registrar en `container.ts` y inyectar en `AnalyzeImportUseCaseImpl`
- **Prueba necesaria**: Usuario autenticado → `getCurrentOperator()` retorna `{id, role}` correcto
- **Criterio**: Auditoría de importación registra `operator_id` = `auth.uid()` real

### ALTA

#### Problema 4: Casteos `as any`/`as never` sistémicos en repos
- **Archivos**: 9 repositorios Supabase
- **Corrección**: Eliminar casteos tras implementar `school_id` correctamente (Problema 1)
- **Prueba**: `npx tsc --strict` sin errores implícitos

#### Problema 5: Política `anon` para menú publicado
- **Archivos**: `supabase/migrations/002_rls_policies.sql`
- **Corrección**: Añadir si el modelo lo requiere:
  ```sql
  CREATE POLICY "menu_plan_cells_select_public" ON menu_plan_cells
    FOR SELECT USING (true); -- Solo si menú público sin auth
  ```
- **Decisión**: Confirmar con usuario si se requiere acceso público

### MEDIA

#### Problema 6: Tabla `imported_rows` faltante en migración
- **Archivos**: `supabase/migrations/001_initial_lunch_schema.sql` (añadir), o eliminar de audit report
- **Corrección**: Crear tabla si se persisten filas importadas; si solo en memoria, documentar

#### Problema 7: `service_type` hardcoded en `setCell`
- **Archivos**: `SupabaseMenuPlanRepository.ts:62`
- **Corrección**: Añadir `serviceType` a `MenuCellSelection` en puerto y pasarlo

### BAJA

#### Problema 8: Fixture no reproduce datos reales
- **Archivos**: `scripts/generate-import-fixtures.cjs`
- **Corrección**: Ampliar fixture a 14 semanas y ~884 `#REF!` para tests locales fieles

#### Problema 9: Tests de caracterización formales
- **Archivos**: Nuevo `src/application/use-cases/characterization.test.ts`
- **Corrección**: Implementar 11 tests con datos reales del Excel y trazabilidad fila/columna

---

## 14. Criterio de entrada a Fase 4.4

| Criterio | Estado | Acción |
|----------|--------|--------|
| F.1 consistente (school_id en domain+repos+SQL) | ❌ **FALLA** | Requiere Problema 1 |
| F.2 consistente (Money en domain+repos) | ⚠️ Parcial | Domain OK; repos OK tras Problema 1 |
| F.3 consistente (batchId) | ✅ OK | |
| F.4 consistente (parser semanas) | ✅ OK (parser) | Fixture incompleto |
| F.5 consistente (fechas local) | ✅ OK | |
| F.6 consistente (ServiceType) | ✅ OK | |
| F.7 consistente (precisión sub-centavo) | ✅ OK | |
| F.8 consistente (Auth real / CurrentOperatorPort) | ❌ **FALLA** | Requiere Problemas 2 y 3 |
| F.9 bloqueada/documentada | ✅ OK | |
| F.10 consistente (normalización) | ✅ OK | |
| RLS consistente | ❌ **FALLA** | Requiere Problemas 1 y 2 |
| database.types.ts consistente | ✅ OK | |
| Repositorios consistentes | ❌ **FALLA** | Requiere Problema 1 |
| CurrentOperatorPort compatible con RLS | ❌ **FALLA** | Requiere Problema 3 |
| 11 caracterizaciones verificadas | ❌ **FALLA** | Requiere Problema 9 |
| 15 semanas verificadas | ⚠️ PENDIENTE | Requiere archivo real o fixture ampliado |
| 883 #REF! verificadas | ⚠️ PENDIENTE | Requiere archivo real o fixture ampliado |
| Sin importación accidental | ✅ OK | |
| Sin migración remota ejecutada | ✅ OK | |
| tsc OK | ✅ OK | |
| tests OK | ✅ OK | |
| build OK | ✅ OK | |
| check:supabase OK | ✅ OK (conectado) | |

**VEREDICTO**: **NO APROBAR FASE 4.4** — 4 criterios críticos fallan (F.1, F.8, RLS, Repositorios) + 2 pendientes de validación con datos reales.

---

## 15. Conclusión

La Fase 4.3 ha producido **artefactos técnicamente compilables y testeables en modo offline** (LocalStorage/InMemory), pero **no son compatibles con la ejecución real contra Supabase con RLS habilitado**.

**Bloqueadores absolutos para `supabase db push`**:
1. **`school_id` NOT NULL sin proveer** — Garantiza fallo en toda escritura
2. **`school_users` sin FK a `auth.users` ni trigger onboarding** — Usuarios reales no tendrán tenant
3. **`CurrentOperatorPort` sin implementación** — Pipeline de importación no instanciable

**Próximos pasos obligatorios (Fase 4.3.2)**:
1. Resolver Problemas 1, 2, 3 (CRÍTICOS) en este orden
2. Validar con test de integración real contra Supabase (write + RLS)
3. Re-ejecutar auditoría completa antes de cualquier `supabase db push`

**No se debe proceder a Fase 4.4 hasta que todos los criterios de la sección 14 estén en ✅ OK.**