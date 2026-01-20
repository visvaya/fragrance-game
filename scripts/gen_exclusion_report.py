import pandas as pd
import hashlib
import re

# Same normalization as etl_v5.py
def normalize_text(text):
    if pd.isna(text) or text is None:
        return ""
    t = str(text).lower().strip()
    return re.sub(r'\s+', ' ', t)

def get_fingerprint(row):
    brand = normalize_text(row['Brand'])
    name = normalize_text(row['Name'])
    conc = normalize_text(row['Concentration'])
    year = normalize_text(str(int(row['Release Year']))) if pd.notnull(row['Release Year']) and row['Release Year'] > 0 else "0"
    
    fp_str = f"{brand}|{name}|{conc}|{year}"
    return hashlib.sha256(fp_str.encode()).hexdigest()

# Load
df = pd.read_csv('e:/fragrance-game/fragrance-webapp/data/dataset.csv', sep=';', decimal=',')
print(f"Total raw rows: {len(df)}")

# Apply temporary FP Column
df['temp_fp'] = df.apply(get_fingerprint, axis=1)

# Sort by Rating Count to pick best
df_sorted = df.sort_values(by='Rating Count', ascending=False)

# Identify Duplicates
duplicates = df_sorted[df_sorted.duplicated(subset=['temp_fp'], keep='first')].copy()
original = df_sorted.drop_duplicates(subset=['temp_fp'], keep='first').copy()

print(f"Unique perfumes to be imported: {len(original)}")
print(f"Excluded duplicates: {len(duplicates)}")

# Save report data
report_samples = []
# Group by FP and take some samples where count > 1
duplicate_groups = df_sorted.groupby('temp_fp')
count = 0
for fp, group in duplicate_groups:
    if len(group) > 1:
        # The first is kept (highest rating), others are excluded
        kept = group.iloc[0]
        excluded = group.iloc[1:]
        for exc_idx, exc_row in excluded.iterrows():
            report_samples.append({
                'Name': exc_row['Name'],
                'Brand': exc_row['Brand'],
                'Conc': exc_row['Concentration'],
                'Year': exc_row['Release Year'],
                'Excluded_Rating': exc_row['Rating Count'],
                'Kept_Rating': kept['Rating Count'],
                'Diff_Image': exc_row['Image URL'] != kept['Image URL'],
                'Diff_URL': exc_row['URL'] != kept['URL'],
                'Reason': 'Duplicate (lower Rating Count)'
            })
        count += 1
    if count >= 30: # Max 30 groups for example
        break

pdf_report = pd.DataFrame(report_samples)
pdf_report.to_csv('e:/fragrance-game/fragrance-webapp/scripts/exclusion_samples.csv', index=False, sep=';')

# Summary Stats
summary = {
    'total_raw': len(df),
    'total_imported': len(original),
    'total_excluded': len(duplicates)
}
with open('e:/fragrance-game/fragrance-webapp/scripts/exclusion_summary.json', 'w') as f:
    import json
    json.dump(summary, f)
