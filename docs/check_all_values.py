import re

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-migration.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Find all VALUES blocks
pattern = r'\(VALUES\n(.*?)\n\) AS v'
blocks = re.findall(pattern, sql, re.DOTALL)

print(f"Total VALUES blocks found: {len(blocks)}")

# Parse each block
uuid_pattern = r"\('([0-9a-f-]{36})'::UUID, '([0-9a-f-]{36})'::UUID\)"

for i, block in enumerate(blocks):
    pairs = re.findall(uuid_pattern, block)
    ri_ids = set(p[0] for p in pairs)
    ing_ids = set(p[1] for p in pairs)
    print(f"\nBlock {i+1}: {len(pairs)} pairs, {len(ri_ids)} unique RI, {len(ing_ids)} unique ING")
    if i > 0:
        first_pairs = re.findall(uuid_pattern, blocks[0])
        if pairs == first_pairs:
            print(f"  IDENTICAL to block 1")
        else:
            print(f"  DIFFERS from block 1!")
            # Find differences
            first_set = set(first_pairs)
            this_set = set(pairs)
            print(f"  In block 1 not in {i+1}: {len(first_set - this_set)}")
            print(f"  In {i+1} not in block 1: {len(this_set - first_set)}")

# Also check the UPDATE statement separately
update_match = re.search(r'UPDATE recipe_ingredients.*?;', sql, re.DOTALL)
if update_match:
    update_sql = update_match.group()
    update_blocks = re.findall(pattern, update_sql, re.DOTALL)
    print(f"\nUPDATE statement VALUES blocks: {len(update_blocks)}")
    for i, block in enumerate(update_blocks):
        pairs = re.findall(uuid_pattern, block)
        print(f"  UPDATE block {i+1}: {len(pairs)} pairs")