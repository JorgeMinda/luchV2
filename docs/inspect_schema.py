import os
import json
from supabase import create_client

# Load environment
from dotenv import load_dotenv
load_dotenv(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\.env')

url = os.getenv('SUPABASE_URL')
service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not url or not service_key:
    print("ERROR: Missing Supabase credentials")
    exit(1)

supabase = create_client(url, service_key)

print("=== SCHEMA INSPECTION ===\n")

# 1. Check recipe_ingredients table structure
print("1. recipe_ingredients columns:")
try:
    result = supabase.rpc('get_table_columns', {'table_name': 'recipe_ingredients'}).execute()
    print(json.dumps(result.data, indent=2))
except Exception as e:
    print(f"  RPC failed: {e}")
    # Try direct query
    try:
        result = supabase.table('recipe_ingredients').select('*').limit(1).execute()
        if result.data:
            print(f"  Sample row keys: {list(result.data[0].keys())}")
    except Exception as e2:
        print(f"  Direct query failed: {e2}")

# 2. Check ingredients table structure
print("\n2. ingredients columns:")
try:
    result = supabase.table('ingredients').select('*').limit(1).execute()
    if result.data:
        print(f"  Sample row keys: {list(result.data[0].keys())}")
except Exception as e:
    print(f"  Failed: {e}")

# 3. Check if FK exists
print("\n3. Checking for existing FK constraints on recipe_ingredients.ingredient_id:")
try:
    # Query information_schema
    result = supabase.rpc('exec_sql', {'sql': """
        SELECT
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'recipe_ingredients'
            AND kcu.column_name = 'ingredient_id';
    """}).execute()
    print(json.dumps(result.data, indent=2))
except Exception as e:
    print(f"  RPC failed: {e}")

# 4. Check indexes on recipe_ingredients
print("\n4. Indexes on recipe_ingredients:")
try:
    result = supabase.rpc('exec_sql', {'sql': """
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'recipe_ingredients';
    """}).execute()
    print(json.dumps(result.data, indent=2))
except Exception as e:
    print(f"  RPC failed: {e}")

# 5. Check current state of ingredient_id in recipe_ingredients
print("\n5. Current ingredient_id status in recipe_ingredients:")
try:
    result = supabase.rpc('exec_sql', {'sql': """
        SELECT
            COUNT(*) as total,
            COUNT(ingredient_id) as with_ingredient_id,
            COUNT(*) - COUNT(ingredient_id) as null_ingredient_id
        FROM recipe_ingredients;
    """}).execute()
    print(json.dumps(result.data, indent=2))
except Exception as e:
    print(f"  RPC failed: {e}")

# 6. Check ingredients count
print("\n6. Ingredients count:")
try:
    result = supabase.rpc('exec_sql', {'sql': "SELECT COUNT(*) as count FROM ingredients;"}).execute()
    print(json.dumps(result.data, indent=2))
except Exception as e:
    print(f"  RPC failed: {e}")

# 7. Check if any recipe_ingredients already have ingredient_id that doesn't exist in ingredients
print("\n7. Orphan ingredient_id references:")
try:
    result = supabase.rpc('exec_sql', {'sql': """
        SELECT ri.ingredient_id, COUNT(*) as count
        FROM recipe_ingredients ri
        LEFT JOIN ingredients i ON ri.ingredient_id = i.id
        WHERE ri.ingredient_id IS NOT NULL
        AND i.id IS NULL
        GROUP BY ri.ingredient_id;
    """}).execute()
    print(json.dumps(result.data, indent=2))
except Exception as e:
    print(f"  RPC failed: {e}")

# 8. Check data types
print("\n8. Column data types:")
try:
    result = supabase.rpc('exec_sql', {'sql': """
        SELECT
            table_name,
            column_name,
            data_type,
            udt_name,
            is_nullable
        FROM information_schema.columns
        WHERE table_name IN ('recipe_ingredients', 'ingredients')
        AND column_name IN ('id', 'ingredient_id')
        ORDER BY table_name, column_name;
    """}).execute()
    print(json.dumps(result.data, indent=2))
except Exception as e:
    print(f"  RPC failed: {e}")

# 9. Check triggers on recipe_ingredients
print("\n9. Triggers on recipe_ingredients:")
try:
    result = supabase.rpc('exec_sql', {'sql': """
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'recipe_ingredients';
    """}).execute()
    print(json.dumps(result.data, indent=2))
except Exception as e:
    print(f"  RPC failed: {e}")

# 10. Check RLS policies
print("\n10. RLS policies on recipe_ingredients:")
try:
    result = supabase.rpc('exec_sql', {'sql': """
        SELECT policyname, permissive, roles, cmd, qual
        FROM pg_policies
        WHERE tablename = 'recipe_ingredients';
    """}).execute()
    print(json.dumps(result.data, indent=2))
except Exception as e:
    print(f"  RPC failed: {e}")

# 11. Sample WAVE 1 candidate verification
print("\n11. Verifying first 5 WAVE 1 candidates exist in ingredients:")
try:
    # Get first 5 candidate IDs
    candidates = [
        'fd3ecfc6-7f08-4136-bf18-4e39507cd4eb',
        'dc3eb263-76cf-457f-9708-d08b8c020101',
        '861a0072-1061-4c1f-90f1-5b1e2af4d680',
        'f4b38a75-c3ae-4541-9533-9481378ccd14',
        '1a2b3c4d-5e6f-7890-abcd-ef1234567890'  # dummy to test
    ]
    placeholders = ','.join([f"'{c}'" for c in candidates[:4]])
    result = supabase.rpc('exec_sql', {'sql': f"""
        SELECT id, name FROM ingredients WHERE id IN ({placeholders});
    """}).execute()
    print(json.dumps(result.data, indent=2))
except Exception as e:
    print(f"  RPC failed: {e}")