import re
import csv

# Read approved candidates
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-approved-candidates.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    approved = list(reader)

approved_pairs = [(r['recipe_ingredient_id'], r['ingredient_id_candidate']) for r in approved]
approved_set = set(approved_pairs)
approved_ri_ids = set(r['recipe_ingredient_id'] for r in approved)
approved_ing_ids = set(r['ingredient_id_candidate'] for r in approved)

print(f"Approved pairs: {len(approved_pairs)}")
print(f"Unique RI IDs: {len(approved_ri_ids)}")
print(f"Unique ING IDs: {len(approved_ing_ids)}")

# Read migration SQL
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-migration.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Find all VALUES blocks more carefully - split by DO $$ and UPDATE
# Each VALUES block ends with ") AS v"
# Let's find each occurrence of "FROM (VALUES" and extract until ") AS v"

pattern = r'FROM \(VALUES\n(.*?)\n\) AS v'
blocks = re.findall(pattern, sql, re.DOTALL)

print(f"\nFound {len(blocks)} VALUES blocks")

uuid_pattern = r"\('([0-9a-f-]{36})'::UUID, '([0-9a-f-]{36})'::UUID\)"

all_sql_pairs = []
for i, block in enumerate(blocks):
    pairs = re.findall(uuid_pattern, block)
    ri_ids = set(p[0] for p in pairs)
    ing_ids = set(p[1] for p in pairs)
    print(f"\nBlock {i+1}: {len(pairs)} pairs, {len(ri_ids)} unique RI, {len(ing_ids)} unique ING")
    
    # Check against approved
    block_set = set(pairs)
    missing = approved_set - block_set
    extra = block_set - approved_set
    print(f"  Missing from approved: {len(missing)}")
    print(f"  Extra not in approved: {len(extra)}")
    
    if missing:
        print(f"  First few missing: {list(missing)[:5]}")
    if extra:
        print(f"  First few extra: {list(extra)[:5]}")
    
    all_sql_pairs.extend(pairs)

# Overall check
all_sql_set = set(all_sql_pairs)
print(f"\n=== OVERALL ===")
print(f"Total pairs in SQL (with duplicates): {len(all_sql_pairs)}")
print(f"Unique pairs in SQL: {len(all_sql_set)}")
print(f"Match approved exactly: {all_sql_set == approved_set}")

if all_sql_set != approved_set:
    missing = approved_set - all_sql_set
    extra = all_sql_set - approved_set
    print(f"Missing from SQL: {len(missing)}")
    print(f"Extra in SQL: {len(extra)}")