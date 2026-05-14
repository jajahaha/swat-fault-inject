"""
数据库迁移脚本 - 添加 deployment_mode 字段

为 database_configs 表添加 deployment_mode 列
默认值为 'centralized'（集中式）
"""

import asyncio
import os
import sys

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine


async def migrate():
    """执行迁移"""
    async with engine.begin() as conn:
        # 检查列是否已存在
        result = await conn.execute(
            text("SELECT column_name FROM pragma_table_info('database_configs') WHERE column_name='deployment_mode'")
        )
        existing = result.fetchone()

        if existing:
            print("deployment_mode 列已存在，无需迁移")
            return

        # 添加 deployment_mode 列
        await conn.execute(
            text("ALTER TABLE database_configs ADD COLUMN deployment_mode VARCHAR(20) NOT NULL DEFAULT 'centralized'")
        )

        # 更新现有数据
        await conn.execute(
            text("UPDATE database_configs SET deployment_mode = 'centralized' WHERE deployment_mode IS NULL OR deployment_mode = ''")
        )

        print("迁移成功: 添加 deployment_mode 列")


if __name__ == "__main__":
    asyncio.run(migrate())