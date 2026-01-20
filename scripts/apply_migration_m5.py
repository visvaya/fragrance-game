
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

# Database Configuration from .env.local
DB_HOST = os.getenv("SUPABASE_DB_HOST", "db.rirboszzqowftfrfmmzp.supabase.co")
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PASS = os.getenv("SUPABASE_DB_PASSWORD")
DB_PORT = "5432"

# Relative path to migration file
MIGRATION_FILE = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations", "20260120100000_perfume_assets.sql")

def apply_migration():
    if not DB_PASS:
        print("Error: SUPABASE_DB_PASSWORD not found in .env.local")
        return

    try:
        print(f"Connecting to {DB_HOST}...")
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=DB_PORT
        )
        conn.autocommit = True
        cur = conn.cursor()

        print(f"Reading migration file: {MIGRATION_FILE}")
        with open(MIGRATION_FILE, 'r', encoding='utf-8') as f:
            sql = f.read()

        # Prepend DROP statements to ensure clean recreation
        clean_sql = """
        DROP TABLE IF EXISTS public.perfume_assets CASCADE;
        DROP TABLE IF EXISTS public.perfume_asset_sources CASCADE;
        """ + sql

        print("Executing SQL...")
        cur.execute(clean_sql)
        
        print("Migration applied successfully!")
        
        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error applying migration: {e}")

if __name__ == "__main__":
    apply_migration()
