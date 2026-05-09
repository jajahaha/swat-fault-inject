#!/bin/bash

# SWAT Fault Inject Platform - Start Script
# Version: 1.1.6

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
echo "  SWAT Fault Inject Platform v1.1.6"
echo "  Starting services..."
echo "=========================================="

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

# Install dependencies if needed
if [ ! -f "venv/.installed" ] || [ "requirements.txt" -nt "venv/.installed" ]; then
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    pip install -r requirements.txt -q
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install Python dependencies!${NC}"
        exit 1
    fi
    touch venv/.installed
fi

# Setup Frontend Environment
echo -e "${BLUE}Checking frontend environment...${NC}"
cd "$FRONTEND_DIR"

# Install npm dependencies if needed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    npm install --silent
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install npm dependencies!${NC}"
        exit 1
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