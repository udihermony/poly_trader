#!/bin/bash

echo "🛑 Stopping PolyTrader..."
docker-compose down

echo ""
echo "✅ PolyTrader stopped"
echo ""
echo "💾 Database is preserved in Docker volume"
echo "🔄 To start again, run: ./start.sh"
