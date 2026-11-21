import re

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-wave1-migration.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Get all DO $$ blocks
do_blocks = re.findall(r'DO \$\$.*?END \$\$;', sql, re.DOTALL)
print('Total DO $$ blocks:', len(do_blocks))

for i, block in enumerate(do_blocks):
    print()
    print('=== DO Block {} ({} chars) ==='.format(i+1, len(block)))
    # Count occurrences of VALUES
    vals_count = block.count('(VALUES\n')
    print('  (VALUES\\n count:', vals_count)
    # Show first 300 chars
    print('  First 300 chars:')
    print('  ' + block[:300].replace('\n', '\n  '))
    print('  ...')
    # Show last 200 chars
    print('  Last 200 chars:')
    print('  ' + block[-200:].replace('\n', '\n  '))