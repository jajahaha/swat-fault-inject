#!/bin/bash

# SWAT Fault Inject Platform - Stop Script
# Version: 1.1.0

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "  SWAT Fault Inject Platform v1.2.0"
echo "  Stopping services..."
echo "=========================================="

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Stop Backend
echo -e "${YELLOW}Stopping Backend...${NC}"
if [ -f "$LOG_DIR/backend.pid" ]; then
    BACKEND_PID=$(cat "$LOG_DIR/backend.pid")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        kill $BACKEND_PID 2>/dev/null
        echo "Killed backend process (PID: $BACKEND_PID)"
    fi
    rm -f "$LOG_DIR/backend.pid"
fi

# Kill any remaining backend processes
pkill -f "uvicorn app.main:app" 2>/dev/null
if check_port 9010; then
    echo -e "${YELLOW}Port 9010 still in use, force killing...${NC}"
    fuser -k 9010/tcp 2>/dev/null
fi

# Stop Frontend
echo -e "${YELLOW}Stopping Frontend...${NC}"
if [ -f "$LOG_DIR/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$LOG_DIR/frontend.pid")
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        kill $FRONTEND_PID 2>/dev/null
        echo "Killed frontend process (PID: $FRONTEND_PID)"
    fi
    rm -f "$LOG_DIR/frontend.pid"
fi

# Kill any remaining frontend processes
pkill -f "vite" 2>/dev/null
pkill -f "node.*swat-fault-inject/frontend" 2>/dev/null
if check_port 9020; then
    echo -e "${YELLOW}Port 9020 still in use, force killing...${NC}"
    fuser -k 9020/tcp 2>/dev/null
fi

# Wait for ports to be released
sleep 2

# Verify services are stopped
BACKEND_STOPPED=true
FRONTEND_STOPPED=true

if check_port 9010; then
    echo -e "${RED}Backend (port 9010) is still running!${NC}"
    BACKEND_STOPPED=false
fi

if check_port 9020; then
    echo -e "${RED}Frontend (port 9020) is still running!${NC}"
    FRONTEND_STOPPED=false
fi

echo ""
if $BACKEND_STOPPED && $FRONTEND_STOPPED; then
    echo -e "${GREEN}=========================================="
    echo -e "  All services stopped successfully!"
    echo -e "==========================================${NC}"
else
    echo -e "${RED}=========================================="
    echo -e "  Some services failed to stop!"
    echo -e "==========================================${NC}"
    echo ""
    echo "  Run 'ps aux | grep uvicorn' or 'ps aux | grep vite' to find remaining processes"
fi
echo ""