import re
import csv

print("=" * 60)
print("FINAL VERIFICATION OF PHASE 4.4.5.B.1 DELIVERABLES")
print("=" * 60)

# 1. Verify validation-results.csv
print("\n1. phase4.4.5b1-validation-results.csv")
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-validation-results.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

approved = [r for r in rows if r['validation_status'] == 'APPROVED_WAVE1']
pending = [r for r in rows if r['validation_status'] == 'PENDING_USER_DECISION']
print("   Total rows: {}".format(len(rows)))
print("   APPROVED_WAVE1: {}".format(len(approved)))
print("   PENDING_USER_DECISION: {}".format(len(pending)))
print("   Unique RI IDs: {}".format(len(set(r['recipe_ingredient_id'] for r in rows))))

# 2. Verify validation-summary.json
print("\n2. phase4.4.5b1-validation-summary.json")
import json
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-validation-summary.json', 'r', encoding='utf-8') as f:
    summary = json.load(f)
for k, v in summary.items():
    print("   {}: {}".format(k, v))

# 3. Verify wave1-migration.sql structure
print("\n3. phase4.4.5b1-wave1-migration.sql")
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-wave1-migration.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Check DO blocks
do_blocks = re.findall(r'DO \$\$.*?END \$\$;', sql, re.DOTALL)
print("   DO $$ blocks: {}".format(len(do_blocks)))

uuid_pattern = r"\('([0-9a-f-]{36})'::UUID, '([0-9a-f-]{36})'::UUID\)"
total_vals_sections = 0
for i, block in enumerate(do_blocks):
    parts = block.split('FROM (VALUES')
    vals_sections = len(parts) - 1
    total_vals_sections += vals_sections
    for j, part in enumerate(parts[1:], 1):
        vals_end = part.find(') AS v')
        if vals_end > 0:
            vals_content = part[:vals_end]
            pairs = re.findall(uuid_pattern, vals_content)
            ri_ids = set(p[0] for p in pairs)
            if len(pairs) != 881 or len(ri_ids) != 881:
                print("   WARNING: DO Block {}, Section {}: {} pairs, {} unique RI".format(i+1, j, len(pairs), len(ri_ids)))

# Check UPDATE
update_match = re.search(r'UPDATE recipe_ingredients.*?;', sql, re.DOTALL)
if update_match:
    update_sql = update_match.group()
    parts = update_sql.split('FROM (VALUES')
    vals_sections = len(parts) - 1
    total_vals_sections += vals_sections
    for j, part in enumerate(parts[1:], 1):
        vals_end = part.find(') AS v')
        if vals_end > 0:
            vals_content = part[:vals_end]
            pairs = re.findall(uuid_pattern, vals_content)
            ri_ids = set(p[0] for p in pairs)
            if len(pairs) != 881 or len(ri_ids) != 881:
                print("   WARNING: UPDATE Section {}: {} pairs, {} unique RI".format(j, len(pairs), len(ri_ids)))

print("   Total VALUES sections: {}".format(total_vals_sections))
print("   Each VALUES section has 881 pairs: {}".format(all(
    len(re.findall(uuid_pattern, part[:part.find(') AS v')])) == 881
    for block in do_blocks
    for part in block.split('FROM (VALUES')[1:]
    if ') AS v' in part
)))

# 4. Verify rollback.sql structure
print("\n4. phase4.4.5b1-rollback.sql")
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-rollback.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

do_blocks = re.findall(r'DO \$\$.*?END \$\$;', sql, re.DOTALL)
print("   DO $$ blocks: {}".format(len(do_blocks)))

total_vals_sections = 0
for i, block in enumerate(do_blocks):
    parts = block.split('FROM (VALUES')
    vals_sections = len(parts) - 1
    total_vals_sections += vals_sections
    for j, part in enumerate(parts[1:], 1):
        vals_end = part.find(') AS v')
        if vals_end > 0:
            vals_content = part[:vals_end]
            pairs = re.findall(uuid_pattern, vals_content)
            ri_ids = set(p[0] for p in pairs)
            if len(pairs) != 881 or len(ri_ids) != 881:
                print("   WARNING: DO Block {}, Section {}: {} pairs, {} unique RI".format(i+1, j, len(pairs), len(ri_ids)))

update_match = re.search(r'UPDATE recipe_ingredients.*?;', sql, re.DOTALL)
if update_match:
    update_sql = update_match.group()
    parts = update_sql.split('FROM (VALUES')
    vals_sections = len(parts) - 1
    total_vals_sections += vals_sections

print("   Total VALUES sections: {}".format(total_vals_sections))

# 5. Verify post-migration-validation.sql has actual UUIDs
print("\n5. phase4.4.5b1-post-migration-validation.sql")
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-post-migration-validation.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Check for ARRAY[ with UUIDs
array_matches = re.findall(r'ARRAY\[(.*?)\]', sql, re.DOTALL)
print("   ARRAY[...] occurrences: {}".format(len(array_matches)))
for i, arr in enumerate(array_matches):
    uuids = re.findall(r"'([0-9a-f-]{36})'", arr)
    print("   Array {}: {} UUIDs".format(i+1, len(uuids)))

# 6. Verify final-audit.md exists and has content
print("\n6. phase4.4.5b1-final-audit.md")
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-final-audit.md', 'r', encoding='utf-8') as f:
    content = f.read()
print("   Length: {} chars".format(len(content)))
print("   Contains '1000 = 881 + 119': {}".format('1000 = 881' in content and '119' in content))
print("   Contains 'NO ESCRITURA EN SUPABASE': {}".format('NO ESCRITURA EN SUPABASE' in content))

print("\n" + "=" * 60)
print("VERIFICATION COMPLETE")
print("=" * 60)