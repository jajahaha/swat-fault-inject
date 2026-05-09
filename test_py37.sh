#!/bin/bash

# Python 3.7.9 Offline Installation Verification Script
# Run this on a machine with Python 3.7.9

echo "=========================================="
echo "  Python 3.7.9 Offline Installation Test"
echo "=========================================="

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

if [ "$PYTHON_MAJOR" != "3" ] || [ "$PYTHON_MINOR" != "7" ]; then
    echo "ERROR: This script requires Python 3.7.x"
    echo "Current Python version: $PYTHON_VERSION"
    exit 1
fi

echo "Python version: $PYTHON_VERSION (OK)"

# Navigate to backend directory
cd backend || exit 1

# Clean existing environment
echo "Cleaning existing environment..."
rm -rf venv data.db venv/.installed __pycache__ app/__pycache__ tests/__pycache__

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Count wheel files
echo ""
echo "Checking wheel files..."
TOTAL_WHEELS=$(ls packages/*.whl 2>/dev/null | wc -l)
echo "Total wheel files: $TOTAL_WHEELS"

# Determine wheel tag
WHEEL_TAG="cp3${PYTHON_MINOR}"
echo "Wheel compatibility tag: $WHEEL_TAG"

# Select compatible wheels
echo ""
echo "Selecting compatible wheels..."
COMPAT_DIR=$(mktemp -d)
cp packages/*-py3-none-any.whl "$COMPAT_DIR/" 2>/dev/null
cp packages/*${WHEEL_TAG}*.whl "$COMPAT_DIR/" 2>/dev/null
COMPAT_COUNT=$(ls "$COMPAT_DIR"/*.whl 2>/dev/null | wc -l)
echo "Selected $COMPAT_COUNT compatible wheels"

# Install packages
echo ""
echo "Installing packages (offline)..."
pip install --no-index --no-deps "$COMPAT_DIR"/*.whl
rm -rf "$COMPAT_DIR"

if [ $? -ne 0 ]; then
    echo "ERROR: Installation failed!"
    exit 1
fi

echo ""
echo "Installation successful!"

# Verify critical packages
echo ""
echo "Verifying installation..."
python -c "import fastapi; print('FastAPI:', fastapi.__version__)"
python -c "import asyncpg; print('asyncpg:', asyncpg.__version__)"
python -c "import uvicorn; print('uvicorn: OK')"
python -c "import sqlalchemy; print('SQLAlchemy:', sqlalchemy.__version__)"
python -c "import pydantic; print('pydantic:', pydantic.VERSION)"

# Run backend tests
echo ""
echo "Running backend tests..."
pytest tests/ -v --tb=short -x 2>&1 | tail -20

# Start backend server
echo ""
echo "Starting backend server..."
uvicorn app.main:app --host 0.0.0.0 --port 9010 &
BACKEND_PID=$!
sleep 3

# Test API
echo ""
echo "Testing API..."
curl -s http://localhost:9010/api/database-configs/types

# Stop backend
kill $BACKEND_PID 2>/dev/null

echo ""
echo "=========================================="
echo "  Python 3.7.9 Test Complete!"
echo "=========================================="