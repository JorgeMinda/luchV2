import csv
import re

# Read the approved candidates CSV
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-approved-candidates.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    approved = list(reader)

# Read the migration pairs CSV
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-migration-pairs.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    pairs = list(reader)

# Read the full mapping CSV to get the 119 pending
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5a1-final-mapping.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    full = list(reader)

print("=== BASIC COUNTS ===")
print(f"Approved candidates: {len(approved)}")
print(f"Migration pairs: {len(pairs)}")
print(f"Full mapping: {len(full)}")

# Check unique IDs
approved_ri_ids = set(r['recipe_ingredient_id'] for r in approved)
pairs_ri_ids = set(r['recipe_ingredient_id'] for r in pairs)
print(f"\nUnique recipe_ingredient_id in approved: {len(approved_ri_ids)}")
print(f"Unique recipe_ingredient_id in pairs: {len(pairs_ri_ids)}")
print(f"Sets equal: {approved_ri_ids == pairs_ri_ids}")

# Check candidate IDs
approved_ing_ids = set(r['ingredient_id_candidate'] for r in approved)
pairs_ing_ids = set(r['ingredient_id_candidate'] for r in pairs)
print(f"\nUnique ingredient_id_candidate in approved: {len(approved_ing_ids)}")
print(f"Unique ingredient_id_candidate in pairs: {len(pairs_ing_ids)}")
print(f"Sets equal: {approved_ing_ids == pairs_ing_ids}")

# Check match_type and wave_assignment in approved
mt = set(r['match_type'] for r in approved)
wave = set(r['wave_assignment'] for r in approved)
compat = set(r['semantic_compatibility'] for r in approved)
print(f"\nMatch types in approved: {mt}")
print(f"Wave assignments in approved: {wave}")
print(f"Semantic compatibility in approved: {compat}")

# Check the 119 pending
pending = [r for r in full if r['wave_assignment'] != 'WAVE_1_AUTO']
print(f"\nPending records (non-WAVE_1): {len(pending)}")
pending_ri_ids = set(r['recipe_ingredient_id'] for r in pending)
print(f"Unique pending recipe_ingredient_id: {len(pending_ri_ids)}")

# Check no overlap
overlap = approved_ri_ids & pending_ri_ids
print(f"Overlap between approved and pending: {len(overlap)}")

# Verify all 1000 accounted for
all_ri_ids = set(r['recipe_ingredient_id'] for r in full)
print(f"\nTotal unique recipe_ingredient_id in full: {len(all_ri_ids)}")
print(f"Approved + Pending = {len(approved_ri_ids) + len(pending_ri_ids)}")
print(f"All accounted: {approved_ri_ids | pending_ri_ids == all_ri_ids}")

# Now read the migration SQL and extract the VALUES pairs
print("\n=== READING MIGRATION SQL ===")
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5b-wave1-migration.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Extract VALUES clauses - there should be 3 identical ones (precheck1, precheck2, update, postcheck1, postcheck2, postcheck3)
# Let's find all VALUES blocks
values_pattern = r'FROM \(VALUES\n(.*?)\n\) AS v'
matches = re.findall(values_pattern, sql, re.DOTALL)
print(f"Number of VALUES blocks found: {len(matches)}")

if matches:
    # Parse first VALUES block
    first_block = matches[0]
    # Extract UUID pairs
    uuid_pattern = r"\('([0-9a-f-]{36})'::UUID, '([0-9a-f-]{36})'::UUID\)"
    sql_pairs = re.findall(uuid_pattern, first_block)
    print(f"Pairs in first VALUES block: {len(sql_pairs)}")
    
    sql_ri_ids = set(p[0] for p in sql_pairs)
    sql_ing_ids = set(p[1] for p in sql_pairs)
    print(f"Unique RI IDs in SQL: {len(sql_ri_ids)}")
    print(f"Unique ING IDs in SQL: {len(sql_ing_ids)}")
    
    # Compare with CSV
    print(f"\nRI IDs match CSV: {sql_ri_ids == approved_ri_ids}")
    print(f"ING IDs match CSV: {sql_ing_ids == approved_ing_ids}")
    
    if sql_ri_ids != approved_ri_ids:
        missing_in_sql = approved_ri_ids - sql_ri_ids
        extra_in_sql = sql_ri_ids - approved_ri_ids
        print(f"Missing in SQL: {len(missing_in_sql)}")
        print(f"Extra in SQL: {len(extra_in_sql)}")
    
    if sql_ing_ids != approved_ing_ids:
        missing_in_sql = approved_ing_ids - sql_ing_ids
        extra_in_sql = sql_ing_ids - approved_ing_ids
        print(f"Missing ING in SQL: {len(missing_in_sql)}")
        print(f"Extra ING in SQL: {len(extra_in_sql)}")

# Check all VALUES blocks are identical
for i, match in enumerate(matches):
    uuids = re.findall(uuid_pattern, match)
    print(f"VALUES block {i+1}: {len(uuids)} pairs")
    if i > 0:
        if uuids != sql_pairs:
            print(f"  WARNING: Block {i+1} differs from block 1!")
        else:
            print(f"  OK: Identical to block 1")

print("\n=== AUDIT COMPLETE ===")