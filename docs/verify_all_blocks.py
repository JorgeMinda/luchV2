import re

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-wave1-migration.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Pattern to find individual VALUES blocks
# Each block: FROM (VALUES ... ) AS v
pattern = r'FROM \(VALUES\n(.*?)\n\) AS v'
blocks = re.findall(pattern, sql, re.DOTALL)

print('Total VALUES blocks found: {}'.format(len(blocks)))

uuid_pattern = r"\('([0-9a-f-]{36})'::UUID, '([0-9a-f-]{36})'::UUID\)"

all_ri_ids = set()
all_pairs = set()

for i, block in enumerate(blocks):
    pairs = re.findall(uuid_pattern, block)
    ri_ids = set(p[0] for p in pairs)
    ing_ids = set(p[1] for p in pairs)
    all_ri_ids.update(ri_ids)
    all_pairs.update(pairs)
    print('Block {}: {} pairs, {} unique RI, {} unique ING'.format(i+1, len(pairs), len(ri_ids), len(ing_ids)))

print()
print('Total unique RI IDs across all blocks: {}'.format(len(all_ri_ids)))
print('Total unique pairs across all blocks: {}'.format(len(all_pairs)))

# Check UPDATE separately
update_match = re.search(r'UPDATE recipe_ingredients.*?;', sql, re.DOTALL)
if update_match:
    update_sql = update_match.group()
    update_blocks = re.findall(pattern, update_sql, re.DOTALL)
    print()
    print('UPDATE statement VALUES blocks: {}'.format(len(update_blocks)))
    for i, block in enumerate(update_blocks):
        pairs = re.findall(uuid_pattern, block)
        ri_ids = set(p[0] for p in pairs)
        print('  UPDATE block {}: {} pairs, {} unique RI'.format(i+1, len(pairs), len(ri_ids)))