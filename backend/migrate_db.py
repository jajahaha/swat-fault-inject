import sqlite3
import sys

db_path = sys.argv[1] if len(sys.argv) > 1 else 'data.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 添加新列
try:
    cursor.execute('ALTER TABLE fault_scenarios ADD COLUMN run_scripts TEXT')
    print('Added run_scripts column')
except sqlite3.OperationalError as e:
    print(f'run_scripts: {e}')

try:
    cursor.execute('ALTER TABLE fault_scenarios ADD COLUMN run_timeout INTEGER DEFAULT 120')
    print('Added run_timeout column')
except sqlite3.OperationalError as e:
    print(f'run_timeout: {e}')

conn.commit()
conn.close()
print('Database migrated successfully')