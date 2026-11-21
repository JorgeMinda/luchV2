import re

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-rollback.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Pattern to find individual VALUES blocks in DO $$
# Split by DO $$ blocks
do_blocks = re.findall(r'DO \$\$.*?END \$\$;', sql, re.DOTALL)
print('DO $$ blocks:', len(do_blocks))

uuid_pattern = r"\('([0-9a-f-]{36})'::UUID, '([0-9a-f-]{36})'::UUID\)"

for i, block in enumerate(do_blocks):
    # Split by "FROM (VALUES"
    parts = block.split('FROM (VALUES')
    vals_sections = len(parts) - 1
    print()
    print('DO Block {}: {} VALUES sections'.format(i+1, vals_sections))
    for j, part in enumerate(parts[1:], 1):
        vals_end = part.find(') AS v')
        if vals_end > 0:
            vals_content = part[:vals_end]
            pairs = re.findall(uuid_pattern, vals_content)
            ri_ids = set(p[0] for p in pairs)
            print('  Section {}: {} pairs, {} unique RI'.format(j, len(pairs), len(ri_ids)))

# Check UPDATE
update_match = re.search(r'UPDATE recipe_ingredients.*?;', sql, re.DOTALL)
if update_match:
    update_sql = update_match.group()
    parts = update_sql.split('FROM (VALUES')
    vals_sections = len(parts) - 1
    print()
    print('UPDATE statement: {} VALUES sections'.format(vals_sections))
    for j, part in enumerate(parts[1:], 1):
        vals_end = part.find(') AS v')
        if vals_end > 0:
            vals_content = part[:vals_end]
            pairs = re.findall(uuid_pattern, vals_content)
            ri_ids = set(p[0] for p in pairs)
            print('  Section {}: {} pairs, {} unique RI'.format(j, len(pairs), len(ri_ids)))