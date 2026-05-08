import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{BASE_DIR}/data.db")

# Encryption key for storing passwords (in production, use proper secret management)
SECRET_KEY = os.getenv("SECRET_KEY", "swat-fault-inject-secret-key-change-in-production")