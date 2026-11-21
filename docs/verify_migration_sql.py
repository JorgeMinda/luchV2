import re

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b1-wave1-migration.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Count VALUES blocks in the file
# The pattern "(VALUES" followed by newline
vals_count = sql.count('(VALUES\n')
print('Occurrences of (VALUES\\n: {}'.format(vals_count))

# Find all DO $$ blocks
blocks = re.findall(r'DO \$\$.*?END \$\$;', sql, re.DOTALL)
print('DO $$ blocks: {}'.format(len(blocks)))
for i, block in enumerate(blocks):
    print('  Block {}: {} chars, VALUES: {}'.format(i+1, len(block), block.count('(VALUES')))

# Find UPDATE statement
update_match = re.search(r'UPDATE recipe_ingredients.*?;', sql, re.DOTALL)
if update_match:
    update_sql = update_match.group()
    print('UPDATE statement: {} chars, VALUES: {}'.format(len(update_sql), update_sql.count('(VALUES')))

# Verify the comment about "6 uses" in the instructions
print()
print('Comment about 6 uses in instructions:')
if '6 veces' in sql:
    print('  Found Spanish "6 veces"')
elif '6 times' in sql:
    print('  Found "6 times"')
else:
    print('  Not found - checking for "6 veces" in Spanish')
    # Search for the instruction section
    idx = sql.find('INSTRUCCIONES PARA USO')
    if idx > 0:
        print('  INSTRUCCIONES section found at char {}'.format(idx))
        print('  Context: {}'.format(sql[idx:idx+500]))