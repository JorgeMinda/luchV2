import csv

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5a-reconciliation-mapping.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    data = list(reader)

print(f"Total rows: {len(data)}")

# Count by match_type
match_types = {}
for row in data:
    mt = row['match_type']
    match_types[mt] = match_types.get(mt, 0) + 1

print("\nMatch type counts:")
for k, v in sorted(match_types.items(), key=lambda x: -x[1]):
    print(f"  {k}: {v}")

# Detailed compatibility check per row for SEMANTICALLY_DIFFERENT
sem_diff = [r for r in data if r['match_type'] == 'SEMANTICALLY_DIFFERENT']

compat = 0
incompat = 0
compat_details = []
incompat_details = []

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
    
    if is_compat:
        compat += 1
        compat_details.append(f"  {name} | RI: {ri_pres} qty={ri_qty} | Cat: {cat_pres} | COMPATIBLE ({reason})")
    else:
        incompat += 1
        incompat_details.append(f"  {name} | RI: {ri_pres} qty={ri_qty} | Cat: {cat_pres} | INCOMPATIBLE ({reason})")

print(f"\nTotal compatible: {compat}")
print(f"Total incompatible: {incompat}")
print(f"Sum: {compat + incompat}")

print("\n=== COMPATIBLE ===")
for d in compat_details:
    print(d)

print("\n=== INCOMPATIBLE ===")
for d in incompat_details:
    print(d)

# NO_MATCH details
no_match = [r for r in data if r['match_type'] == 'NO_MATCH']
print(f"\nNO_MATCH rows: {len(no_match)}")
no_match_ingredients = {}
for r in no_match:
    name = r['original_ingredient_name']
    no_match_ingredients[name] = no_match_ingredients.get(name, 0) + 1
print(f"Unique NO_MATCH ingredients: {len(no_match_ingredients)}")
for name, count in sorted(no_match_ingredients.items(), key=lambda x: -x[1]):
    print(f"  {name}: {count}")

# POSSIBLE_MATCH
possible = [r for r in data if r['match_type'] == 'POSSIBLE_MATCH']
print(f"\nPOSSIBLE_MATCH rows: {len(possible)}")
for r in possible:
    print(f"  {r['original_ingredient_name']} -> {r['catalog_ingredient_name']}")

# MULTIPLE_MATCH
multiple = [r for r in data if r['match_type'] == 'MULTIPLE_MATCH']
print(f"\nMULTIPLE_MATCH rows: {len(multiple)}")
for r in multiple:
    print(f"  {r['original_ingredient_name']} -> {r['catalog_ingredient_name']}")
    print(f"    candidate IDs: {r['ingredient_id_candidate']}")

# EXACT_MATCH
exact = [r for r in data if r['match_type'] == 'EXACT_MATCH']
print(f"\nEXACT_MATCH rows: {len(exact)}")

# Decision status
decisions = {}
for r in data:
    d = r['decision_status']
    decisions[d] = decisions.get(d, 0) + 1
print("\nDecision status counts:")
for k, v in sorted(decisions.items(), key=lambda x: -x[1]):
    print(f"  {k}: {v}")

# Requires user approval
requires_user = sum(1 for r in data if r['requires_user_approval'] == 'true')
print(f"\nRequires user approval: {requires_user}")

# Sum check
total = sum(match_types.values())
print(f"\nSum of match_types: {total}")

# Verify unique IDs
ids = set(r['recipe_ingredient_id'] for r in data)
print(f"\nUnique recipe_ingredient_ids: {len(ids)}")

# Check for rows without match_type
no_match_type = [r for r in data if not r['match_type'] or r['match_type'] == '']
print(f"Rows without match_type: {len(no_match_type)}")