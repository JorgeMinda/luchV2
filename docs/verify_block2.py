import re

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-wave1-migration.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Get second DO block
do_blocks = re.findall(r'DO \$\$.*?END \$\$;', sql, re.DOTALL)
second_block = do_blocks[1]

# Find both VALUES sections in second block
# First one: FROM (VALUES ... ) AS v
# Second one: FROM (VALUES ... ) AS v (in the subquery)

# Let's split by "FROM (VALUES"
parts = second_block.split('FROM (VALUES')
print('Parts after split: {}'.format(len(parts)))

uuid_pattern = r"\('([0-9a-f-]{36})'::UUID, '([0-9a-f-]{36})'::UUID\)"

for i, part in enumerate(parts[1:], 1):  # Skip first part (before first VALUES)
    # Find up to ") AS v"
    vals_end = part.find(') AS v')
    if vals_end > 0:
        vals_content = part[:vals_end]
        pairs = re.findall(uuid_pattern, vals_content)
        ri_ids = set(p[0] for p in pairs)
        print('VALUES section {}: {} pairs, {} unique RI'.format(i, len(pairs), len(ri_ids)))

# Now check DO Block 4 (postchecks) which has 5 VALUES
print()
print('=== DO Block 4 (postchecks) ===')
fourth_block = do_blocks[3]
parts = fourth_block.split('FROM (VALUES')
print('Parts after split: {}'.format(len(parts)))

for i, part in enumerate(parts[1:], 1):
    vals_end = part.find(') AS v')
    if vals_end > 0:
        vals_content = part[:vals_end]
        pairs = re.findall(uuid_pattern, vals_content)
        ri_ids = set(p[0] for p in pairs)
        print('VALUES section {}: {} pairs, {} unique RI'.format(i, len(pairs), len(ri_ids)))