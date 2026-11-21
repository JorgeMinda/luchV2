import csv

with open('phase4.4.5a-reconciliation-mapping.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    data = list(reader)

sem_diff = [r for r in data if r['match_type'] == 'SEMANTICALLY_DIFFERENT']

# Detailed compatibility check per row
print("=== SEMANTICALLY_DIFFERENT row-by-row compatibility ===")
compat = 0
incompat = 0
for r in sem_diff:
    name = r['original_ingredient_name']
    ri_pres = r['ri_purchase_presentation'].strip().upper()
    ri_qty = int(float(r['ri_purchase_quantity'])) if r['ri_purchase_quantity'] else 0
    cat_pres = r['candidate_presentation'].strip()
    
    is_compat = False
    reason = ""
    
    if name == 'APIO/800 GR':
        is_compat = (ri_qty == 800)
        reason = "800g matches catalog ATADO (800 GR)" if is_compat else f"qty {ri_qty}g != 800g"
    elif name == 'MELON 600GR':
        is_compat = (ri_qty == 600)
        reason = "600g matches catalog UNIDAD (600 GR)" if is_compat else f"qty {ri_qty}g != 600g"
    elif name == 'SANDIA':
        is_compat = (ri_qty == 4000)
        reason = "4000g within catalog UNIDAD (4-5 KILOS)" if is_compat else f"qty {ri_qty}g not in 4-5kg range"
    elif name == 'CEBOLLA BLANCA 1 KILO':
        is_compat = (ri_qty == 1000)
        reason = "1000g matches catalog ATADO (1 KG)" if is_compat else f"qty {ri_qty}g != 1000g"
    elif name == 'LECHUGA NACIONAL':
        is_compat = (ri_qty in (4000, 6000) and 'UNIDAD' not in ri_pres)
        reason = f"weight-based {ri_qty}g" if is_compat else "unit-based"
    elif name == 'ZUCCHINI VERDE 1 KILO':
        is_compat = False
        reason = f"1000g below catalog range 1500-2000g"
    elif name == 'ARROZ MACAREÑO ARROBA':
        is_compat = True
        reason = "arroba unit match, 13% weight diff noted"
    elif name == 'REMOLACHA':
        is_compat = (ri_qty == 1000)
        reason = "1000g matches catalog ATADO (1 KILO)" if is_compat else f"qty {ri_qty}g != 1000g"
    
    status = "COMPATIBLE" if is_compat else "INCOMPATIBLE"
    if is_compat:
        compat += 1
    else:
        incompat += 1
    print(f"  {name} | RI: {ri_pres} qty={ri_qty} | Cat: {cat_pres} | {status} ({reason})")

print(f"\nTotal compatible: {compat}")
print(f"Total incompatible: {incompat}")
print(f"Sum: {compat + incompat}")