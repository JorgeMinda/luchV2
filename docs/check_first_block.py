import re

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-wave1-migration.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Get first DO $$ block
do_blocks = re.findall(r'DO \$\$.*?END \$\$;', sql, re.DOTALL)
first_block = do_blocks[0]
print('First DO $$ block length:', len(first_block))
print('First 200 chars:')
print(first_block[:200])
print('...')
print('Last 200 chars:')
print(first_block[-200:])

# Count VALUES in first block
print('VALUES count in first block:', first_block.count('(VALUES\n'))

# Find the VALUES content in first block
vals_match = re.search(r'\(VALUES\n(.*?)\n\) AS v', first_block, re.DOTALL)
if vals_match:
    content = vals_match.group(1)
    print('VALUES content length:', len(content))
    # Count pairs
    uuid_pattern = r"\('([0-9a-f-]{36})'::UUID, '([0-9a-f-]{36})'::UUID\)"
    pairs = re.findall(uuid_pattern, content)
    print('Pairs in first block VALUES:', len(pairs))
    # Show first 5 pairs
    for p in pairs[:5]:
        print('  ', p)
    print('  ...')
    for p in pairs[-5:]:
        print('  ', p)