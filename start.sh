#!/bin/bash

echo "🚀 Starting PolyTrader..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your API credentials."
    echo ""
    read -p "Press Enter after you've added your credentials to .env..."
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first:"
    echo "   https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "🔨 Building Docker containers (this may take a few minutes on first run)..."
docker-compose build

echo ""
echo "🎯 Starting containers..."
docker-compose up -d

echo ""
echo "✅ PolyTrader is starting!"
echo ""
echo "📊 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo ""
echo "📝 To view logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 To stop:"
echo "   docker-compose down"
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

echo ""
echo "🎉 Ready! Open http://localhost:3000 in your browser"
