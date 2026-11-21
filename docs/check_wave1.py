import csv

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5a1-final-mapping.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    data = list(reader)

wave1 = [r for r in data if r['wave_assignment'] == 'WAVE_1_AUTO']
print(f'WAVE_1_AUTO records: {len(wave1)}')

# Check for duplicates
ids = [r['recipe_ingredient_id'] for r in wave1]
print(f'Unique recipe_ingredient_ids: {len(set(ids))}')

# Check candidates
candidates = [r['ingredient_id_candidate'] for r in wave1]
print(f'Unique candidate ingredient_ids: {len(set(candidates))}')

# Check match_type
mt = {}
for r in wave1:
    mt[r['match_type']] = mt.get(r['match_type'], 0) + 1
print(f'Match types: {mt}')

# Check semantic_compatibility
sc = {}
for r in wave1:
    sc[r['semantic_compatibility']] = sc.get(r['semantic_compatibility'], 0) + 1
print(f'Semantic compatibility: {sc}')

# Check for any NULL or empty candidate
null_cand = [r for r in wave1 if not r['ingredient_id_candidate'] or r['ingredient_id_candidate'].strip() == '']
print(f'Records with empty candidate: {len(null_cand)}')

# Show first few
for r in wave1[:3]:
    print(f"  {r['recipe_ingredient_id']} -> {r['ingredient_id_candidate']} | {r['original_ingredient_name']} | {r['catalog_ingredient_name']}")