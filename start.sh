#!/bin/bash

# SWAT Fault Inject Platform - Start Script
# Version: 1.1.9

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
LOG_DIR="$PROJECT_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create log directory
mkdir -p "$LOG_DIR"

# Ensure database file has correct permissions
DB_FILE="$BACKEND_DIR/data.db"
if [ -f "$DB_FILE" ]; then
    chmod 666 "$DB_FILE"
fi

echo "=========================================="
echo "  SWAT Fault Inject Platform v1.4.3"
echo "  Starting services..."
echo "=========================================="

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

# Determine wheel compatibility tag based on exact Python version
# cp37 for Python 3.7, cp38 for Python 3.8, ... cp312 for Python 3.12
WHEEL_TAG="cp3${PYTHON_MINOR}"

# Detect machine architecture for binary wheels
MACHINE_ARCH=$(python3 -c "import platform; print(platform.machine())")
echo -e "${BLUE}Machine architecture: $MACHINE_ARCH${NC}"
echo -e "${BLUE}Python wheel compatibility tag: $WHEEL_TAG${NC}"

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 7 ]); then
    echo -e "${RED}Error: Python 3.7+ is required!${NC}"
    echo -e "${RED}Current version: Python $PYTHON_VERSION${NC}"
    echo ""
    echo "Please install Python 3.7 or higher:"
    echo "  - Ubuntu/Debian: sudo apt install python3.7"
    echo "  - CentOS/RHEL: sudo yum install python37"
    echo "  - macOS: brew install python@3.7"
    echo "  - Windows: Download from https://python.org"
    exit 1
fi

echo -e "${GREEN}Python version: $PYTHON_VERSION (OK)${NC}"

# Check Node.js version - try to install from local if not found
NODEJS_DIR="$PROJECT_DIR/nodejs"
NODE_INSTALL_DIR="$PROJECT_DIR/node-install"

if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js is not installed in system${NC}"

    # Check if local Node.js package exists
    NODE_TARBALL=""
    if [ "$MACHINE_ARCH" = "aarch64" ] || [ "$MACHINE_ARCH" = "arm64" ]; then
        NODE_TARBALL="$NODEJS_DIR/node-v18.20.2-linux-arm64.tar.gz"
    else
        NODE_TARBALL="$NODEJS_DIR/node-v18.20.2-linux-x64.tar.gz"
    fi

    if [ -f "$NODE_TARBALL" ]; then
        echo -e "${BLUE}Found local Node.js package: $(basename $NODE_TARBALL)${NC}"
        echo -e "${YELLOW}Installing Node.js from local package...${NC}"

        # Create installation directory
        mkdir -p "$NODE_INSTALL_DIR"

        # Extract Node.js
        tar -xzf "$NODE_TARBALL" -C "$NODE_INSTALL_DIR" --strip-components=1

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Node.js installed successfully to $NODE_INSTALL_DIR${NC}"
            # Add to PATH for this session
            export PATH="$NODE_INSTALL_DIR/bin:$PATH"
        else
            echo -e "${RED}Failed to extract Node.js package!${NC}"
            exit 1
        fi
    else
        echo -e "${RED}Error: Node.js is not installed and no local package found!${NC}"
        echo ""
        echo "Node.js 18+ is required for the frontend."
        echo ""
        echo "For offline installation:"
        echo "  1. Download Node.js for your architecture:"
        if [ "$MACHINE_ARCH" = "aarch64" ] || [ "$MACHINE_ARCH" = "arm64" ]; then
            echo "     https://nodejs.org/dist/v18.20.2/node-v18.20.2-linux-arm64.tar.gz"
        else
            echo "     https://nodejs.org/dist/v18.20.2/node-v18.20.2-linux-x64.tar.gz"
        fi
        echo "  2. Place the file in: $NODEJS_DIR/"
        echo "  3. Run ./start.sh again"
        exit 1
    fi
fi

NODE_VERSION=$(node --version 2>&1 | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js $NODE_VERSION detected, but version 18+ is recommended${NC}"
else
    echo -e "${GREEN}Node.js version: $NODE_VERSION (OK)${NC}"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed!${NC}"
    echo "Please install npm together with Node.js"
    exit 1
fi
NPM_VERSION=$(npm --version 2>&1)
echo -e "${GREEN}npm version: $NPM_VERSION (OK)${NC}"

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to wait for service
wait_for_service() {
    local port=$1
    local max_wait=30
    local count=0
    while ! check_port $port && [ $count -lt $max_wait ]; do
        sleep 1
        count=$((count + 1))
    done
    if check_port $port; then
        return 0
    else
        return 1
    fi
}

# Stop existing services if running
echo -e "${YELLOW}Checking for existing services...${NC}"

if check_port 9010; then
    echo -e "${YELLOW}Port 9010 is in use, stopping existing backend...${NC}"
    pkill -f "uvicorn app.main:app" 2>/dev/null
    sleep 2
fi

if check_port 9020; then
    echo -e "${YELLOW}Port 9020 is in use, stopping existing frontend...${NC}"
    pkill -f "vite" 2>/dev/null
    sleep 2
fi

# Setup Backend Environment
echo -e "${BLUE}Checking backend environment...${NC}"
cd "$BACKEND_DIR"

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating Python virtual environment...${NC}"
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to create virtual environment!${NC}"
        exit 1
    fi
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies (prefer local packages for offline install)
if [ ! -f "venv/.installed" ]; then
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    # First try offline install from local packages
    if [ -d "packages" ]; then
        WHEEL_COUNT=$(ls packages/*.whl 2>/dev/null | wc -l)
        echo -e "${BLUE}Found $WHEEL_COUNT wheel files in packages directory${NC}"
        if [ "$WHEEL_COUNT" -gt 0 ]; then
            echo -e "${BLUE}Installing from local packages (offline)...${NC}"

            # Step 1: Upgrade pip first (required for manylinux2014+ wheel support)
            # Do this separately before other packages
            if [ -f "packages/pip-*.whl" ]; then
                echo -e "${YELLOW}Upgrading pip for better wheel compatibility...${NC}"
                pip_wheel=$(ls packages/pip-*.whl | head -1)
                pip install --no-deps "$pip_wheel" 2>/dev/null || python -m pip install --no-deps "$pip_wheel"
                echo -e "${GREEN}pip upgraded successfully${NC}"
            fi

            # Filter wheel files by Python version compatibility
            # - py3-none-any wheels work on all Python 3 versions
            # - py2.py3-none-any wheels work on Python 2 and 3
            # - cp37 wheels work on Python 3.7
            # - cp312 wheels work on Python 3.12+

            # Create a temporary directory for compatible wheels
            COMPAT_WHEELS_DIR=$(mktemp -d)

            # Copy pure Python wheels (py3-none-any and py2.py3-none-any)
            for wheel in packages/*-py3-none-any.whl packages/*-py2.py3-none-any.whl; do
                if [ -f "$wheel" ]; then
                    cp "$wheel" "$COMPAT_WHEELS_DIR/"
                fi
            done

            # Copy version-specific binary wheels (exact version match)
            # e.g., Python 3.7 -> cp37, Python 3.12 -> cp312
            # Special handling for architecture-specific wheels: asyncpg, greenlet, SQLAlchemy
            for wheel in packages/*${WHEEL_TAG}*.whl; do
                if [ -f "$wheel" ]; then
                    # Skip architecture-specific wheels - handle them separately
                    if [[ "$wheel" == *"asyncpg"* ]] || [[ "$wheel" == *"greenlet"* ]] || [[ "$wheel" == *"SQLAlchemy"* ]]; then
                        continue
                    fi
                    cp "$wheel" "$COMPAT_WHEELS_DIR/"
                fi
            done

            # Handle architecture-specific wheels with architecture detection
            # Supported architectures: x86_64 (Intel/AMD), aarch64 (ARM64), i686 (32-bit Intel)
            ARCH_SUFFIX=""
            if [ "$MACHINE_ARCH" = "aarch64" ] || [ "$MACHINE_ARCH" = "arm64" ]; then
                # ARM64 (Apple Silicon, ARM Linux)
                ARCH_SUFFIX="aarch64"
            elif [ "$MACHINE_ARCH" = "i686" ] || [ "$MACHINE_ARCH" = "i386" ] || [ "$MACHINE_ARCH" = "x86" ]; then
                # 32-bit Intel
                ARCH_SUFFIX="i686"
            else
                # Default: 64-bit Intel/AMD (x86_64, AMD64)
                ARCH_SUFFIX="x86_64"
            fi
            echo -e "${BLUE}Using architecture suffix: $ARCH_SUFFIX${NC}"

            # Select asyncpg wheel for detected architecture
            asyncpg_wheel=$(ls packages/asyncpg*${WHEEL_TAG}*${ARCH_SUFFIX}*.whl 2>/dev/null | head -1)
            if [ -n "$asyncpg_wheel" ] && [ -f "$asyncpg_wheel" ]; then
                echo -e "${BLUE}Selected asyncpg wheel: $(basename $asyncpg_wheel)${NC}"
                cp "$asyncpg_wheel" "$COMPAT_WHEELS_DIR/"
            else
                echo -e "${YELLOW}Warning: No matching asyncpg wheel found for $ARCH_SUFFIX${NC}"
            fi

            # Select greenlet wheel for detected architecture
            greenlet_wheel=$(ls packages/greenlet*${WHEEL_TAG}*${ARCH_SUFFIX}*.whl 2>/dev/null | head -1)
            if [ -n "$greenlet_wheel" ] && [ -f "$greenlet_wheel" ]; then
                echo -e "${BLUE}Selected greenlet wheel: $(basename $greenlet_wheel)${NC}"
                cp "$greenlet_wheel" "$COMPAT_WHEELS_DIR/"
            else
                echo -e "${YELLOW}Warning: No matching greenlet wheel found for $ARCH_SUFFIX${NC}"
            fi

            # Select SQLAlchemy wheel for detected architecture
            sqlalchemy_wheel=$(ls packages/SQLAlchemy*${WHEEL_TAG}*${ARCH_SUFFIX}*.whl 2>/dev/null | head -1)
            if [ -n "$sqlalchemy_wheel" ] && [ -f "$sqlalchemy_wheel" ]; then
                echo -e "${BLUE}Selected SQLAlchemy wheel: $(basename $sqlalchemy_wheel)${NC}"
                cp "$sqlalchemy_wheel" "$COMPAT_WHEELS_DIR/"
            else
                echo -e "${YELLOW}Warning: No matching SQLAlchemy wheel found for $ARCH_SUFFIX${NC}"
            fi

            COMPAT_COUNT=$(ls "$COMPAT_WHEELS_DIR"/*.whl 2>/dev/null | wc -l)
            echo -e "${BLUE}Selected $COMPAT_COUNT compatible wheel files for Python $PYTHON_VERSION${NC}"

            if [ "$COMPAT_COUNT" -gt 0 ]; then
                # Install all compatible wheel files directly - this works without network
                pip install --no-index --no-deps "$COMPAT_WHEELS_DIR"/*.whl
                INSTALL_RESULT=$?

                # Cleanup temp directory
                rm -rf "$COMPAT_WHEELS_DIR"

                if [ $INSTALL_RESULT -eq 0 ]; then
                    echo -e "${GREEN}Offline installation successful!${NC}"
                else
                    echo -e "${RED}Offline installation failed with error code: $INSTALL_RESULT${NC}"
                    echo -e "${YELLOW}Note: This machine has no network access, cannot fallback to online install${NC}"
                    echo -e "${RED}Please ensure packages directory contains valid wheel files for Python $PYTHON_VERSION${NC}"
                    exit 1
                fi
            else
                rm -rf "$COMPAT_WHEELS_DIR"
                echo -e "${RED}No compatible wheel files found for Python $PYTHON_VERSION!${NC}"
                echo -e "${YELLOW}Need either py3-none-any or $WHEEL_TAG wheel files${NC}"
                exit 1
            fi
        else
            echo -e "${RED}No wheel files found in packages directory!${NC}"
            echo -e "${YELLOW}Note: This machine has no network access, cannot install online${NC}"
            exit 1
        fi
    else
        echo -e "${RED}packages directory not found!${NC}"
        echo -e "${YELLOW}Note: This machine has no network access, cannot install online${NC}"
        exit 1
    fi
    touch venv/.installed
fi

# Setup Frontend Environment
echo -e "${BLUE}Checking frontend environment...${NC}"
cd "$FRONTEND_DIR"

# Extract node_modules from archive if exists and node_modules not present
if [ ! -d "node_modules" ]; then
    if [ -f "node_modules.tar.gz" ]; then
        echo -e "${YELLOW}Extracting node_modules from archive...${NC}"
        tar -xzf node_modules.tar.gz
        if [ $? -ne 0 ]; then
            echo -e "${RED}Failed to extract node_modules!${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}Installing npm dependencies...${NC}"
        npm install --silent
        if [ $? -ne 0 ]; then
            echo -e "${RED}Failed to install npm dependencies!${NC}"
            exit 1
        fi
    fi
fi

# Start Backend
echo -e "${GREEN}Starting Backend (port 9010)...${NC}"
cd "$BACKEND_DIR"
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 9010 > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
if wait_for_service 9010; then
    echo -e "${GREEN}Backend started successfully!${NC}"
    echo "  API: http://localhost:9010"
    echo "  Docs: http://localhost:9010/docs"
else
    echo -e "${RED}Backend failed to start!${NC}"
    cat "$LOG_DIR/backend.log"
    exit 1
fi

# Start Frontend
echo -e "${GREEN}Starting Frontend (port 9020)...${NC}"
cd "$FRONTEND_DIR"
nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
if wait_for_service 9020; then
    echo -e "${GREEN}Frontend started successfully!${NC}"
    echo "  UI: http://localhost:9020"
else
    echo -e "${RED}Frontend failed to start!${NC}"
    cat "$LOG_DIR/frontend.log"
    exit 1
fi

# Save PIDs to file
echo "$BACKEND_PID" > "$LOG_DIR/backend.pid"
echo "$FRONTEND_PID" > "$LOG_DIR/frontend.pid"

echo ""
echo "=========================================="
echo -e "${GREEN}  All services started!${NC}"
echo "=========================================="
echo ""
echo "  Frontend: http://localhost:9020"
echo "  Backend:  http://localhost:9010"
echo "  API Docs: http://localhost:9010/docs"
echo ""
echo "  Logs: $LOG_DIR/"
echo "  To stop: ./stop.sh"
echo ""