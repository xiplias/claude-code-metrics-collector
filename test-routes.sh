#!/bin/bash

echo "Testing API routes..."
echo

# Start the server in background
echo "Starting server..."
bun run src/index.tsx &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Test API endpoints
echo "Testing /health endpoint..."
curl -s http://localhost:3000/health | jq .

echo
echo "Testing /stats endpoint..."
curl -s http://localhost:3000/stats | jq .

echo
echo "Testing React app route..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/

echo
echo "Testing React app route /dashboard..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard

# Kill the server
echo
echo "Stopping server..."
kill $SERVER_PID