import re

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-wave1-migration.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Get first DO $$ block
do_blocks = re.findall(r'DO \$\$.*?END \$\$;', sql, re.DOTALL)
first_block = do_blocks[0]

# Find the VALUES content in first block
vals_match = re.search(r'\(VALUES\n(.*?)\n\) AS v', first_block, re.DOTALL)
if vals_match:
    content = vals_match.group(1)
    print('VALUES content length:', len(content))
    # Count pairs
    uuid_pattern = r"\('([0-9a-f-]{36})'::UUID, '([0-9a-f-]{36})'::UUID\)"
    pairs = re.findall(uuid_pattern, content)
    print('Pairs in first block VALUES:', len(pairs))
    ri_ids = set(p[0] for p in pairs)
    print('Unique RI IDs:', len(ri_ids))
    # Show first 5 pairs
    for p in pairs[:5]:
        print('  ', p)
    print('  ...')
    for p in pairs[-5:]:
        print('  ', p)

# Now let's check all DO blocks
print()
print('=== ALL DO BLOCKS ===')
for i, block in enumerate(do_blocks):
    vals_match = re.search(r'\(VALUES\n(.*?)\n\) AS v', block, re.DOTALL)
    if vals_match:
        content = vals_match.group(1)
        pairs = re.findall(uuid_pattern, content)
        print('Block {}: {} pairs'.format(i+1, len(pairs)))

# Check second block (should have 2 VALUES)
print()
print('=== SECOND BLOCK (has 2 VALUES) ===')
second_block = do_blocks[1]
vals_matches = re.findall(r'\(VALUES\n(.*?)\n\) AS v', second_block, re.DOTALL)
print('Number of VALUES in second block:', len(vals_matches))
for j, content in enumerate(vals_matches):
    pairs = re.findall(uuid_pattern, content)
    print('  VALUES {}: {} pairs'.format(j+1, len(pairs)))