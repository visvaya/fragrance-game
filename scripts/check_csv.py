import pandas as pd
import hashlib
import re

# Load
df = pd.read_csv('e:/fragrance-game/fragrance-webapp/data/dataset.csv', sep=';', decimal=',')
print(f'Total CSV rows: {len(df)}')

# Clean
df['Release Year'] = pd.to_numeric(df['Release Year'], errors='coerce').fillna(0).astype(int)
df['Brand'] = df['Brand'].fillna('Unknown')
df['Name'] = df['Name'].fillna('Unknown')
df['Concentration'] = df['Concentration'].fillna('Unknown')

# Fingerprint
def norm(x):
    t = str(x).lower().strip()
    return re.sub(r'\s+', ' ', t)

def fp(b, n, c, y):
    year_str = str(int(y)) if y > 0 else '0'
    return hashlib.sha256(f'{norm(b)}|{norm(n)}|{norm(c)}|{year_str}'.encode()).hexdigest()

df['fp'] = df.apply(lambda x: fp(x['Brand'], x['Name'], x['Concentration'], x['Release Year']), axis=1)

# Dedup
df_dedup = df.sort_values('Rating Count', ascending=False).drop_duplicates('fp', keep='first')
print(f'After dedup: {len(df_dedup)} unique perfumes')

# Check brands
df_real = df_dedup[df_dedup['Brand'] != 'Unknown']
print(f'With valid brands: {len(df_real)}')
