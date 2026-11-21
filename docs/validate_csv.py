import csv

with open('phase4.4.5a-reconciliation-mapping.csv', 'r', encoding='utf-8') as f:
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

# Verify unique IDs
ids = set(r['recipe_ingredient_id'] for r in data)
print(f"\nUnique recipe_ingredient_ids: {len(ids)}")

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

# SEMANTICALLY_DIFFERENT details
sem_diff = [r for r in data if r['match_type'] == 'SEMANTICALLY_DIFFERENT']
print(f"\nSEMANTICALLY_DIFFERENT rows: {len(sem_diff)}")
sem_diff_ingredients = {}
for r in sem_diff:
    name = r['original_ingredient_name']
    sem_diff_ingredients[name] = sem_diff_ingredients.get(name, 0) + 1
print(f"Unique SEMANTICALLY_DIFFERENT ingredients: {len(sem_diff_ingredients)}")
for name, count in sorted(sem_diff_ingredients.items(), key=lambda x: -x[1]):
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

# Per-recipe breakdown for SEMANTICALLY_DIFFERENT
print("\n=== SEMANTICALLY_DIFFERENT per-recipe breakdown ===")
for name in sorted(sem_diff_ingredients.keys()):
    rows = [r for r in sem_diff if r['original_ingredient_name'] == name]
    print(f"\n{name} ({len(rows)} occurrences):")
    recipes = {}
    for r in rows:
        recipe = r['dish_name']
        if recipe not in recipes:
            recipes[recipe] = []
        recipes[recipe].append(r)
    for recipe, rlist in recipes.items():
        print(f"  Recipe: {recipe} ({len(rlist)} rows)")
        for r in rlist:
            print(f"    RI pres: {r['ri_purchase_presentation']}, qty: {r['ri_purchase_quantity']}")
            print(f"    Cat pres: {r['candidate_presentation']}, cost: {r['candidate_cost_cents']}")
            print(f"    Recipe qty: {r['ri_recipe_quantity']}, unit cost: {r['ri_purchase_unit_cost_raw']}")

# NO_MATCH per-recipe breakdown with evidence
print("\n=== NO_MATCH per-recipe breakdown with evidence ===")
for name in sorted(no_match_ingredients.keys()):
    rows = [r for r in no_match if r['original_ingredient_name'] == name]
    print(f"\n{name} ({len(rows)} occurrences):")
    for r in rows:
        print(f"  Recipe: {r['dish_name']}")
        print(f"    RI pres: {r['ri_purchase_presentation']}, qty: {r['ri_purchase_quantity']}, price: {r['ri_purchase_price_cents']}")
        print(f"    Unit cost: {r['ri_purchase_unit_cost_raw']}")

# Verify that EXACT_MATCH + SEMANTICALLY_DIFFERENT = 953 (name matches)
name_matches = len(exact) + len(sem_diff)
print(f"\nName matches (EXACT + SEMANTICALLY_DIFFERENT): {name_matches}")

# Check compatible vs incompatible SEMANTICALLY_DIFFERENT
print("\n=== SEMANTICALLY_DIFFERENT compatibility analysis ===")
compatible = 0
incompatible = 0
for name in sorted(sem_diff_ingredients.keys()):
    rows = [r for r in sem_diff if r['original_ingredient_name'] == name]
    for r in rows:
        ri_pres = r['ri_purchase_presentation'].strip().upper()
        ri_qty = int(r['ri_purchase_quantity']) if r['ri_purchase_quantity'].isdigit() else 0
        cat_pres = r['candidate_presentation'].strip()
        # Check compatibility based on prior analysis
        is_compat = False
        if name == 'APIO/800 GR':
            is_compat = ri_qty == 800
        elif name == 'MELON 600GR':
            is_compat = ri_qty == 600
        elif name == 'SANDIA':
            is_compat = ri_qty == 4000
        elif name == 'CEBOLLA BLANCA 1 KILO':
            is_compat = ri_qty == 1000
        elif name == 'LECHUGA NACIONAL':
            is_compat = ri_qty in (4000, 6000) and 'UNIDAD' not in ri_pres
        elif name == 'ZUCCHINI VERDE 1 KILO':
            is_compat = False  # All incompatible per prior analysis
        elif name == 'ARROZ MACAREÑO ARROBA':
            is_compat = True  # Per prior analysis
        elif name == 'REMOLACHA':
            is_compat = ri_qty == 1000
        if is_compat:
            compatible += 1
        else:
            incompatible += 1
print(f"Compatible: {compatible}")
print(f"Incompatible: {incompatible}")
print(f"Total: {compatible + incompatible}")