"""
数据库迁移脚本 - 添加三级分类字段
"""
import sqlite3
import os

# 数据库路径列表
DB_PATHS = [
    os.path.join(os.path.dirname(__file__), 'data.db'),
    os.path.join(os.path.dirname(__file__), 'data', 'fault_inject.db'),
]

def migrate_db(db_path):
    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 检查表是否存在
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='fault_scenarios'")
    if not cursor.fetchone():
        print(f"数据库 {db_path} 中没有 fault_scenarios 表")
        conn.close()
        return
    
    # 检查列是否已存在
    cursor.execute("PRAGMA table_info(fault_scenarios)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'category3' not in columns:
        print(f"添加 category3 列到 {db_path}...")
        cursor.execute("ALTER TABLE fault_scenarios ADD COLUMN category3 VARCHAR(50)")
        conn.commit()
        print(f"✓ category3 列添加成功")
    else:
        print(f"category3 列已存在于 {db_path}")
    
    conn.close()

def migrate():
    for db_path in DB_PATHS:
        migrate_db(db_path)
    print("\n迁移完成!")

if __name__ == "__main__":
    migrate()