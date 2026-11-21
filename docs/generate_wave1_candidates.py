import csv

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5a1-final-mapping.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    data = list(reader)

wave1 = [r for r in data if r['wave_assignment'] == 'WAVE_1_AUTO']
print(f'WAVE_1_AUTO records: {len(wave1)}')

# Verify all conditions
issues = []
for r in wave1:
    # 1. Exactly one candidate
    if not r['ingredient_id_candidate'] or r['ingredient_id_candidate'].strip() == '':
        issues.append(f"EMPTY_CANDIDATE: {r['recipe_ingredient_id']}")
    # 2. match_type = EXACT_MATCH
    if r['match_type'] != 'EXACT_MATCH':
        issues.append(f"WRONG_MATCH_TYPE: {r['recipe_ingredient_id']} = {r['match_type']}")
    # 3. wave_assignment = WAVE_1_AUTO
    if r['wave_assignment'] != 'WAVE_1_AUTO':
        issues.append(f"WRONG_WAVE: {r['recipe_ingredient_id']} = {r['wave_assignment']}")
    # 4. semantic_compatibility = COMPATIBLE
    if r['semantic_compatibility'] != 'COMPATIBLE':
        issues.append(f"WRONG_COMPAT: {r['recipe_ingredient_id']} = {r['semantic_compatibility']}")

# Check for duplicate recipe_ingredient_ids
ri_ids = [r['recipe_ingredient_id'] for r in wave1]
dup_ri = [x for x in set(ri_ids) if ri_ids.count(x) > 1]
if dup_ri:
    issues.append(f"DUPLICATE_RECIPE_INGREDIENT_IDS: {dup_ri}")

# Check for duplicate candidate mappings (same recipe_ingredient_id -> different candidates)
# Not applicable since each row has one candidate

print(f"Issues found: {len(issues)}")
for issue in issues:
    print(f"  - {issue}")

if not issues:
    print("ALL VALIDATIONS PASSED")

# Write wave1-approved-candidates.csv
output_fields = [
    'recipe_ingredient_id',
    'recipe_id',
    'dish_name',
    'original_ingredient_name',
    'ingredient_id_candidate',
    'catalog_ingredient_name',
    'match_type',
    'confidence',
    'evidence',
    'semantic_compatibility',
    'validation_notes',
    'wave_assignment'
]

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-approved-candidates.csv', 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=output_fields)
    writer.writeheader()
    for row in wave1:
        writer.writerow({k: row[k] for k in output_fields})

print(f"\nWritten {len(wave1)} records to phase4.4.5b-wave1-approved-candidates.csv")

# Also create a minimal version for the migration (just the two IDs)
minimal_fields = ['recipe_ingredient_id', 'ingredient_id_candidate']
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-migration-pairs.csv', 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=minimal_fields)
    writer.writeheader()
    for row in wave1:
        writer.writerow({k: row[k] for k in minimal_fields})

print(f"Written minimal pairs to phase4.4.5b-wave1-migration-pairs.csv")