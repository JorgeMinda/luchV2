import csv

# Read source mapping
with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5a-reconciliation-mapping.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    data = list(reader)

# Semantic compatibility rules
def get_semantic_compatibility(row):
    name = row['original_ingredient_name']
    ri_pres = row['ri_purchase_presentation'].strip().upper()
    ri_qty = int(float(row['ri_purchase_quantity'])) if row['ri_purchase_quantity'] else 0
    cat_pres = row['candidate_presentation'].strip()
    match_type = row['match_type']
    
    if match_type == 'EXACT_MATCH':
        return 'COMPATIBLE'
    elif match_type == 'SEMANTICALLY_DIFFERENT':
        if name == 'APIO/800 GR':
            return 'COMPATIBLE' if ri_qty == 800 else 'INCOMPATIBLE_QTY_MISMATCH'
        elif name == 'MELON 600GR':
            return 'COMPATIBLE' if ri_qty == 600 else 'INCOMPATIBLE_QTY_MISMATCH'
        elif name == 'SANDIA':
            return 'COMPATIBLE' if ri_qty == 4000 else 'INCOMPATIBLE_QTY_MISMATCH'
        elif name == 'CEBOLLA BLANCA 1 KILO':
            return 'COMPATIBLE' if ri_qty == 1000 else 'INCOMPATIBLE_QTY_MISMATCH'
        elif name == 'LECHUGA NACIONAL':
            return 'COMPATIBLE' if (ri_qty in (4000, 6000) and 'UNIDAD' not in ri_pres) else 'INCOMPATIBLE_UNIT'
        elif name == 'ZUCCHINI VERDE 1 KILO':
            return 'INCOMPATIBLE_QTY_BELOW_RANGE'
        elif name == 'ARROZ MACAREÑO ARROBA':
            return 'COMPATIBLE_UNIT_MATCH'
        elif name == 'REMOLACHA':
            return 'COMPATIBLE' if ri_qty == 1000 else 'INCOMPATIBLE_QTY_MISMATCH'
        return 'UNKNOWN'
    elif match_type == 'NO_MATCH':
        # Check price consistency for known candidates
        name_lower = name.upper()
        if name_lower == 'SAL 1 KL':
            price = int(row['ri_purchase_price_cents']) if row['ri_purchase_price_cents'] else 0
            return 'INCOMPATIBLE_PRICE' if price != 49 else 'COMPATIBLE_PRICE'
        elif name_lower == 'ACEITE CANECA 20LT':
            price = int(row['ri_purchase_price_cents']) if row['ri_purchase_price_cents'] else 0
            return 'INCOMPATIBLE_PRICE' if abs(price - 3560) > 100 else 'COMPATIBLE_PRICE'
        elif name_lower == 'COMINO 200 GR':
            price = int(row['ri_purchase_price_cents']) if row['ri_purchase_price_cents'] else 0
            return 'COMPATIBLE_PRICE' if price == 131 else 'INCOMPATIBLE_PRICE'
        elif name_lower == 'OREGANO 200 GR':
            price = int(row['ri_purchase_price_cents']) if row['ri_purchase_price_cents'] else 0
            return 'INCOMPATIBLE_PRICE'
        elif name_lower == 'PIMIENTA 1 KL':
            price = int(row['ri_purchase_price_cents']) if row['ri_purchase_price_cents'] else 0
            return 'INCOMPATIBLE_PRICE'
        elif name_lower == 'MARGARINA LB':
            return 'COMPATIBLE_PRICE_HISTORICAL'
        elif name_lower == 'MOSTAZA 4 LT':
            return 'INCOMPATIBLE_PRICE_UNITS'
        elif name_lower == 'MAYONESA ADEREZO LA PRIMERA 3.7 KG':
            return 'INCOMPATIBLE_PRICE_BRAND'
        elif name_lower == 'PASTA LASAÑA PRECOCIDA SUPERMAXI 200 GR':
            return 'COMPATIBLE_PRICE_SAME'
        elif name_lower == 'ACHIOTE ILE EN PASTA 1 KG':
            return 'INCOMPATIBLE_FORM'
        elif name_lower == 'LOMO PULPA NEGRA 1 KILO':
            return 'COMPATIBLE_PRICE'
        elif name_lower == 'GARBANZO KILO':
            return 'COMPATIBLE_PRICE'
        return 'UNKNOWN'
    elif match_type == 'POSSIBLE_MATCH':
        return 'COMPATIBLE'
    elif match_type == 'MULTIPLE_MATCH':
        return 'COMPATIBLE_SELECTED'
    return 'UNKNOWN'

# Wave assignment logic
def get_wave_assignment(row):
    match_type = row['match_type']
    sem_compat = get_semantic_compatibility(row)
    name = row['original_ingredient_name']
    
    if match_type == 'EXACT_MATCH':
        return 'WAVE_1_AUTO'
    elif match_type == 'SEMANTICALLY_DIFFERENT':
        if sem_compat == 'COMPATIBLE':
            return 'WAVE_2_SEMANTIC_COMPATIBLE'
        else:
            return 'WAVE_3_INVESTIGATE'
    elif match_type == 'POSSIBLE_MATCH':
        return 'WAVE_2_SEMANTIC_COMPATIBLE'
    elif match_type == 'MULTIPLE_MATCH':
        return 'WAVE_2_SEMANTIC_COMPATIBLE'
    elif match_type == 'NO_MATCH':
        if sem_compat in ('COMPATIBLE_PRICE', 'COMPATIBLE_PRICE_HISTORICAL', 'COMPATIBLE_PRICE_SAME'):
            return 'WAVE_2_SEMANTIC_COMPATIBLE'
        elif sem_compat == 'INCOMPATIBLE_FORM':
            return 'WAVE_4_UNRESOLVABLE'
        else:
            return 'WAVE_3_INVESTIGATE'
    return 'WAVE_3_INVESTIGATE'

# Validation notes
def get_validation_notes(row):
    name = row['original_ingredient_name']
    match_type = row['match_type']
    sem_compat = get_semantic_compatibility(row)
    ri_pres = row['ri_purchase_presentation'].strip().upper()
    ri_qty = int(float(row['ri_purchase_quantity'])) if row['ri_purchase_quantity'] else 0
    cat_pres = row['candidate_presentation'].strip()
    
    if match_type == 'EXACT_MATCH':
        return ''
    elif match_type == 'SEMANTICALLY_DIFFERENT':
        if name == 'APIO/800 GR':
            if ri_qty == 800:
                return 'RI qty 800g = catálogo 800g'
            elif ri_qty == 1000:
                return 'RI qty 1000g (1KG) ≠ catálogo 800g - LOCRO DE ACELGA'
            elif ri_qty == 2200:
                return 'RI qty 2200g ≠ catálogo 800g - PARILLADA CHORIZO'
        elif name == 'MELON 600GR':
            return 'RI qty 600g = catálogo 600g' if ri_qty == 600 else f'RI qty {ri_qty}g ≠ 600g'
        elif name == 'SANDIA':
            return 'RI qty 4000g within catálogo 4-5kg range' if ri_qty == 4000 else f'RI qty {ri_qty}g'
        elif name == 'CEBOLLA BLANCA 1 KILO':
            return 'RI qty 1000g = catálogo 1KG' if ri_qty == 1000 else f'RI qty {ri_qty}g'
        elif name == 'LECHUGA NACIONAL':
            return f'Weight-based {ri_qty}g, catálogo CAJA 4kg nominal'
        elif name == 'ZUCCHINI VERDE 1 KILO':
            return 'RI qty 1000g below catálogo range 1500-2000g'
        elif name == 'ARROZ MACAREÑO ARROBA':
            return 'Arroba unit match, 13% weight diff (25lb vs 22lb)'
        elif name == 'REMOLACHA':
            return 'RI qty 1000g = catálogo 1KILO' if ri_qty == 1000 else f'RI qty {ri_qty}g'
    elif match_type == 'NO_MATCH':
        candidates = {
            'SAL 1 KL': 'SAL YODADA 1 KL (code 273)',
            'ACEITE CANECA 20lt': 'ACEITE CANECA 20 LT - VETOIL/SF (code 1)',
            'COMINO 200 GR': 'COMINO LB (code 75)',
            'OREGANO 200 GR': 'OREGANO LB (code 190)',
            'PIMIENTA 1 KL': 'PIMIENTA LB (code 237)',
            'MARGARINA LB': 'MARGARINA INDUSTRIAL LB - DANEC (code 164)',
            'MOSTAZA 4 LT': 'BALDE MOSTAZA 3.7 KG - DELY/LA ORIGINAL (code 181)',
            'MAYONESA ADEREZO LA PRIMERA 3.7 KG': 'BALDE MAYONESA 3.7 KG - DELY/LA ORIGINAL (code 166)',
            'PASTA LASAÑA PRECOCIDA SUPERMAXI 200 GR': 'PASTA LASAÑA PRECOCIDA 200 GR - LA ORIGINAL (code 210)',
            'ACHIOTE ILE EN PASTA 1 KG': 'ACHIOTE LIQUIDO 200 ML (code 5) - FORMA DISTINTA',
            'LOMO PULPA NEGRA 1 KILO': 'LOMO PULPA AGUJA KG (code 152)',
            'GARBANZO KILO': 'GARBANZO LB (code 330)'
        }
        cand = candidates.get(name, 'Sin candidato identificado')
        price = row['ri_purchase_price_cents']
        if name == 'SAL 1 KL' and price == '49':
            return f'Candidato: {cand} - precio receta 49c = catálogo 49c ✓'
        elif name == 'SAL 1 KL':
            return f'Candidato: {cand} - precio receta {price}c vs catálogo 49c'
        elif name == 'ACEITE CANECA 20lt':
            return f'Candidato: {cand} - precio receta {price}c vs catálogo 3560c (10-11% menor)'
        elif name == 'COMINO 200 GR' and price == '131':
            return f'Candidato: {cand} - precio receta 131c = catálogo 131c ✓'
        elif name == 'COMINO 200 GR':
            return f'Candidato: {cand} - precio receta {price}c vs catálogo 131c'
        elif name == 'OREGANO 200 GR':
            return f'Candidato: {cand} - precio receta {price}c vs catálogo 130c (2.2x mayor)'
        elif name == 'PIMIENTA 1 KL':
            cat_price = 116
            mult = int(price) / cat_price if cat_price else 0
            return f'Candidato: {cand} - precio receta {price}c vs catálogo {cat_price}c ({mult:.1f}x mayor)'
        elif name == 'MARGARINA LB':
            return f'Candidato: {cand} - precio receta {price}c vs catálogo 93c (15% menor histórico) ✓'
        elif name == 'MOSTAZA 4 LT':
            return f'Candidato: {cand} - 4LT vs 3.7KG, precio {price}c vs 451c'
        elif name == 'MAYONESA ADEREZO LA PRIMERA 3.7 KG':
            return f'Candidato: {cand} - marca distinta (LA PRIMERA), precio 1036c vs 761c (36% mayor)'
        elif name == 'PASTA LASAÑA PRECOCIDA SUPERMAXI 200 GR':
            return f'Candidato: {cand} - precio idéntico 172c, marca distinta (SUPERMAXI) ✓'
        elif name == 'ACHIOTE ILE EN PASTA 1 KG':
            return f'Candidato: {cand} - FORMA DISTINTA: pasta vs líquido, NO VINCULAR'
        elif name == 'LOMO PULPA NEGRA 1 KILO':
            return f'Candidato: {cand} - precio receta 670c vs catálogo 695c (3.6% menor) ✓'
        elif name == 'GARBANZO KILO':
            return f'Candidato: {cand} - precio receta 115c vs catálogo 121c (cercano) ✓'
    elif match_type == 'POSSIBLE_MATCH':
        if name == 'AZUCAR ARROBA':
            return 'Excel: nombre completo con marca SAN FRANCISCO'
        elif name == 'TORTILLA TRIGO SUAVES MAMA FANY 400 GR X12':
            return 'X12 = pack 12 unidades, mismo producto base'
        elif name == 'CARNE MOLIDA 1 KILO':
            return 'Marca MACAFRI en catálogo, genérico en receta'
        elif name == 'CANGUIL 500GR':
            return 'Marca EL ARTESANAL en catálogo'
    elif match_type == 'MULTIPLE_MATCH':
        return 'Duplicado en catálogo: candidato 1 (40c) coincide precio receta; candidato 2 (45c) para revisión'
    return ''

# Enrich data
enriched = []
for row in data:
    sem_compat = get_semantic_compatibility(row)
    wave = get_wave_assignment(row)
    notes = get_validation_notes(row)
    
    enriched.append({
        **row,
        'semantic_compatibility': sem_compat,
        'validation_notes': notes,
        'wave_assignment': wave
    })

# Write final mapping
output_fields = [
    'recipe_ingredient_id', 'recipe_id', 'dish_name', 'dish_recipe_source',
    'original_ingredient_name', 'ingredient_id_candidate', 'catalog_ingredient_name',
    'match_type', 'confidence', 'evidence', 'requires_user_approval', 'decision_status',
    'ri_purchase_presentation', 'ri_purchase_price_cents', 'ri_purchase_quantity',
    'ri_recipe_quantity', 'ri_purchase_unit_cost_raw', 'ri_yield_percentage',
    'candidate_presentation', 'candidate_category', 'candidate_cost_cents',
    'semantic_compatibility', 'validation_notes', 'wave_assignment'
]

with open(r'C:\Users\minda\Desktop\REA\luch-v2\lunch\docs\phase4.4.5a1-final-mapping.csv', 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=output_fields)
    writer.writeheader()
    for row in enriched:
        writer.writerow(row)

print(f"Written {len(enriched)} rows to final mapping CSV")

# Summary stats
wave_counts = {}
for row in enriched:
    w = row['wave_assignment']
    wave_counts[w] = wave_counts.get(w, 0) + 1

print("\nWave assignment distribution:")
for w, c in sorted(wave_counts.items()):
    print(f"  {w}: {c}")

sem_compat_counts = {}
for row in enriched:
    s = row['semantic_compatibility']
    sem_compat_counts[s] = sem_compat_counts.get(s, 0) + 1

print("\nSemantic compatibility distribution:")
for s, c in sorted(sem_compat_counts.items(), key=lambda x: -x[1]):
    print(f"  {s}: {c}")