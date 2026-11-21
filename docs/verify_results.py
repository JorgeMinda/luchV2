import csv

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-validation-results.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

approved = [r for r in rows if r['validation_status'] == 'APPROVED_WAVE1']
pending = [r for r in rows if r['validation_status'] == 'PENDING_USER_DECISION']

print('APPROVED_WAVE1: {}'.format(len(approved)))
print('PENDING_USER_DECISION: {}'.format(len(pending)))
print('Total: {}'.format(len(rows)))

print()
print('Last 5 pending:')
for r in pending[-5:]:
    print('  {} | {} | {} | {}'.format(r['recipe_ingredient_id'], r['original_ingredient_name'], r['match_type'], r['wave_assignment']))