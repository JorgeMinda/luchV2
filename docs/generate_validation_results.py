import csv

# Read the approved candidates
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-approved-candidates.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    approved = list(reader)

# Read the full mapping to get pending
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5a1-final-mapping.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    full = list(reader)

# Build validation results
results = []

# WAVE 1 approved (881)
for r in approved:
    results.append({
        'recipe_ingredient_id': r['recipe_ingredient_id'],
        'recipe_id': r['recipe_id'],
        'dish_name': r['dish_name'],
        'original_ingredient_name': r['original_ingredient_name'],
        'ingredient_id_candidate': r['ingredient_id_candidate'],
        'catalog_ingredient_name': r['catalog_ingredient_name'],
        'match_type': r['match_type'],
        'wave_assignment': r['wave_assignment'],
        'semantic_compatibility': r['semantic_compatibility'],
        'validation_status': 'APPROVED_WAVE1',
        'validation_notes': r['validation_notes'],
        'expected_action': 'MIGRATE'
    })

# WAVE 2/3/4 pending (119)
pending = [r for r in full if r['wave_assignment'] != 'WAVE_1_AUTO']
for r in pending:
    results.append({
        'recipe_ingredient_id': r['recipe_ingredient_id'],
        'recipe_id': r['recipe_id'],
        'dish_name': r['dish_name'],
        'original_ingredient_name': r['original_ingredient_name'],
        'ingredient_id_candidate': r['ingredient_id_candidate'],
        'catalog_ingredient_name': r['catalog_ingredient_name'],
        'match_type': r['match_type'],
        'wave_assignment': r['wave_assignment'],
        'semantic_compatibility': r['semantic_compatibility'],
        'validation_status': 'PENDING_USER_DECISION',
        'validation_notes': r['validation_notes'],
        'expected_action': 'DO_NOT_MIGRATE'
    })

# Write validation results CSV
fieldnames = [
    'recipe_ingredient_id',
    'recipe_id',
    'dish_name',
    'original_ingredient_name',
    'ingredient_id_candidate',
    'catalog_ingredient_name',
    'match_type',
    'wave_assignment',
    'semantic_compatibility',
    'validation_status',
    'validation_notes',
    'expected_action'
]

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-validation-results.csv', 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(results)

print(f"Validation results written: {len(results)} rows")
print(f"  APPROVED_WAVE1: {len([r for r in results if r['validation_status'] == 'APPROVED_WAVE1'])}")
print(f"  PENDING_USER_DECISION: {len([r for r in results if r['validation_status'] == 'PENDING_USER_DECISION'])}")

# Also create a summary counts file
summary = {
    'total_records': len(results),
    'wave1_approved': len([r for r in results if r['validation_status'] == 'APPROVED_WAVE1']),
    'pending': len([r for r in results if r['validation_status'] == 'PENDING_USER_DECISION']),
    'unique_recipe_ingredients': len(set(r['recipe_ingredient_id'] for r in results)),
    'unique_candidates_wave1': len(set(r['ingredient_id_candidate'] for r in results if r['validation_status'] == 'APPROVED_WAVE1' and r['ingredient_id_candidate'])),
    'match_types_wave1': {},
    'wave_assignments': {},
    'semantic_compat_wave1': {}
}

for r in results:
    if r['validation_status'] == 'APPROVED_WAVE1':
        summary['match_types_wave1'][r['match_type']] = summary['match_types_wave1'].get(r['match_type'], 0) + 1
        summary['wave_assignments'][r['wave_assignment']] = summary['wave_assignments'].get(r['wave_assignment'], 0) + 1
        summary['semantic_compat_wave1'][r['semantic_compatibility']] = summary['semantic_compat_wave1'].get(r['semantic_compatibility'], 0) + 1

import json
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-validation-summary.json', 'w', encoding='utf-8') as f:
    json.dump(summary, f, indent=2)

print(f"\nSummary:")
for k, v in summary.items():
    if isinstance(v, dict):
        print(f"  {k}: {v}")
    else:
        print(f"  {k}: {v}")