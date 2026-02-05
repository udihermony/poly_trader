# Docker Setup Guide

This guide explains how to run PolyTrader in Docker containers for complete isolation from your system.

## Why Docker?

✅ **Complete Isolation**: All Node.js dependencies stay in containers
✅ **Clean System**: Nothing installed on your machine except Docker
✅ **Consistent Environment**: Same setup on any machine
✅ **Easy Updates**: Just rebuild containers
✅ **Data Persistence**: Database survives container restarts

## Prerequisites

Install Docker Desktop:
- **Mac**: [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
- **Windows**: [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
- **Linux**: [Docker Engine](https://docs.docker.com/engine/install/)

Verify installation:
```bash
docker --version
docker-compose --version
```

## Setup

### 1. Configure Environment Variables

```bash
# Copy example file
cp .env.example .env

# Edit with your credentials
nano .env  # or use any text editor
```

Required variables:
```env
POLYMARKET_API_KEY=your_key
POLYMARKET_SECRET=your_secret
POLYMARKET_PASSPHRASE=your_passphrase
POLYMARKET_FUNDER_ADDRESS=your_address
ANTHROPIC_API_KEY=your_claude_key
```

### 2. Start Services

**Option A: Using the convenience script**
```bash
./start.sh
```

**Option B: Using docker-compose directly**
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f
```

### 3. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Health Check: http://localhost:8000/health

## Container Architecture

### Services

**backend**
- Node.js 18 Alpine
- Express API server
- Port: 8000
- Volume: Database persisted in `polytrader-data`

**frontend**
- Node.js 18 Alpine
- Vite dev server
- Port: 3000
- Hot reload enabled

### Networks

Both containers run in isolated `polytrader-network` bridge network.

### Volumes

- `polytrader-data`: Persists SQLite database across container restarts
- `./backend:/app`: Live code sync for development
- `./frontend:/app`: Live code sync for development
- `/app/node_modules`: Prevents local node_modules from overwriting container's

## Common Commands

### Starting & Stopping

```bash
# Start in background
docker-compose up -d

# Start with logs visible
docker-compose up

# Stop containers
docker-compose down

# Stop and remove volumes (deletes database!)
docker-compose down -v
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100 -f
```

### Rebuilding

```bash
# Rebuild after code changes
docker-compose build

# Rebuild specific service
docker-compose build backend

# Rebuild without cache
docker-compose build --no-cache

# Rebuild and restart
docker-compose up -d --build
```

### Accessing Containers

```bash
# Open shell in backend container
docker-compose exec backend sh

# Open shell in frontend container
docker-compose exec frontend sh

# Run command in backend
docker-compose exec backend npm run build
```

### Database Management

```bash
# Access database directly
docker-compose exec backend sh
cd database
sqlite3 polytrader.db

# Backup database
docker-compose exec backend cat /app/database/polytrader.db > backup.db

# Restore database
cat backup.db | docker-compose exec -T backend sh -c 'cat > /app/database/polytrader.db'
```

## Production Deployment

For production, use the optimized configuration:

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d
```

Production differences:
- Multi-stage builds for smaller images
- No development dependencies
- Frontend served by nginx
- No live reload/hot module replacement
- Optimized for performance

## Troubleshooting

### Containers won't start

```bash
# Check container status
docker-compose ps

# View error logs
docker-compose logs

# Check Docker is running
docker info
```

### Port already in use

```bash
# Find what's using port 8000
lsof -i :8000

# Change port in docker-compose.yml
ports:
  - "8001:8000"  # Changed from 8000:8000
```

### Database issues

```bash
# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d

# View database location
docker volume inspect polytrader_polytrader-data
```

### Permission issues

```bash
# Fix permissions (Mac/Linux)
sudo chown -R $(whoami) backend/database
sudo chown -R $(whoami) frontend/dist
```

### Out of disk space

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

### Container keeps restarting

```bash
# Check what's failing
docker-compose logs backend
docker-compose logs frontend

# Common issues:
# - Missing .env file
# - Invalid credentials
# - Port conflicts
```

## Development Workflow

### Making Code Changes

Since volumes are mounted, changes are reflected immediately:

**Backend**: Auto-restarts with nodemon
```bash
# Edit backend/src/services/trading.service.ts
# Changes apply automatically
docker-compose logs -f backend  # Watch for restart
```

**Frontend**: Hot module replacement
```bash
# Edit frontend/src/pages/Dashboard.tsx
# Browser updates automatically
```

### Installing New Dependencies

```bash
# Backend
docker-compose exec backend npm install <package>
docker-compose restart backend

# Frontend
docker-compose exec frontend npm install <package>
docker-compose restart frontend
```

### Running Tests

```bash
# Backend tests
docker-compose exec backend npm test

# Frontend tests
docker-compose exec frontend npm test
```

## Environment Variables

### Available in Containers

All `.env` variables are automatically passed to containers via `docker-compose.yml`.

### Adding New Variables

1. Add to `.env`:
   ```env
   NEW_VARIABLE=value
   ```

2. Add to `docker-compose.yml`:
   ```yaml
   environment:
     - NEW_VARIABLE=${NEW_VARIABLE}
   ```

3. Restart:
   ```bash
   docker-compose restart
   ```

## Data Persistence

### What's Persisted

- ✅ SQLite database (`polytrader-data` volume)
- ✅ All trade history
- ✅ Market configurations
- ✅ Analysis logs

### What's Not Persisted

- ❌ Container logs (use `docker-compose logs` before stopping)
- ❌ Runtime memory/state

### Backing Up Data

```bash
# Backup database
docker-compose exec backend cat /app/database/polytrader.db > backup_$(date +%Y%m%d).db

# Automated backup script
./backup.sh  # (create this if needed)
```

## Security Best Practices

1. **Never commit `.env`** - It's in `.gitignore`
2. **Use secrets management** for production (Docker secrets, AWS Secrets Manager, etc.)
3. **Limit network exposure** - Don't expose ports unnecessarily
4. **Update base images** regularly:
   ```bash
   docker-compose pull
   docker-compose up -d --build
   ```

## Performance Tips

1. **Use BuildKit** for faster builds:
   ```bash
   DOCKER_BUILDKIT=1 docker-compose build
   ```

2. **Prune regularly**:
   ```bash
   docker system prune -f
   ```

3. **Allocate more resources** in Docker Desktop settings (Memory/CPU)

## Migrating from Non-Docker Setup

If you were running without Docker:

```bash
# 1. Stop local services
# Kill any running npm processes

# 2. Copy database (optional)
cp backend/database/polytrader.db ./backup.db

# 3. Start with Docker
./start.sh

# 4. Restore database (optional)
cat backup.db | docker-compose exec -T backend sh -c 'cat > /app/database/polytrader.db'
docker-compose restart backend
```

## Uninstalling

To completely remove everything:

```bash
# Stop and remove containers, networks, volumes
docker-compose down -v

# Remove images
docker rmi polytrader-backend polytrader-frontend

# Remove orphaned volumes
docker volume prune

# Remove the project directory
cd ..
rm -rf polytrader
```

## Getting Help

- Check logs: `docker-compose logs -f`
- Check container status: `docker-compose ps`
- Restart: `docker-compose restart`
- Full reset: `docker-compose down -v && docker-compose up -d`

---

**Remember**: With Docker, your system stays clean. All Node.js, npm packages, and dependencies are isolated in containers!
