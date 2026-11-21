import re

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-migration.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Find all DO $$ blocks
blocks = re.findall(r'DO \$\$.*?END \$\$;', sql, re.DOTALL)
print(f'DO $$ blocks: {len(blocks)}')
for i, block in enumerate(blocks):
    print(f'  Block {i+1}: {len(block)} chars')
    vals = block.count('(VALUES')
    print(f'    VALUES occurrences: {vals}')

# Find the UPDATE statement
update_match = re.search(r'UPDATE recipe_ingredients.*?;', sql, re.DOTALL)
if update_match:
    update_sql = update_match.group()
    print(f'\nUPDATE statement: {len(update_sql)} chars')
    print(f'  VALUES occurrences: {update_sql.count("(VALUES")}')