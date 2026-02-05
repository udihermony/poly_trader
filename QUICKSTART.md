# PolyTrader - Quick Start Guide

## 🚀 Get Running in 3 Steps

### Step 1: Setup Credentials
```bash
cp .env.example .env
# Edit .env with your Polymarket and Claude API credentials
```

### Step 2: Start Application
```bash
./start.sh
```

### Step 3: Open Browser
```
http://localhost:3000
```

## ⚙️ First-Time Configuration

1. **Settings Page** → Add your API credentials
2. **Settings Page** → Configure risk limits (start small!)
3. **Settings Page** → Keep "Paper Trading Mode" ON (safe testing)
4. **Markets Page** → Search and add markets to monitor
5. **Settings Page** → Enable "Trading" toggle
6. **Dashboard** → Monitor Claude's analysis and trades

## 📋 Common Commands

```bash
# Start application
./start.sh

# Stop application
./stop.sh

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Complete reset (WARNING: deletes database)
docker-compose down -v
./start.sh
```

## 🛡️ Safety Checklist

- [ ] Paper Trading Mode is ON
- [ ] Max Bet Size is small (e.g., $10)
- [ ] Daily Budget is reasonable (e.g., $100)
- [ ] Confidence Threshold is high (e.g., 70%+)
- [ ] Started with 1-2 test markets
- [ ] Monitored for a few hours before going live

## 🎯 What to Monitor

**Dashboard shows:**
- System Status (Active/Disabled)
- Budget Utilization (Daily spending)
- Active Markets & Open Positions
- P&L Today
- Recent Claude Analyses

## 🔧 Troubleshooting

**Containers won't start?**
```bash
docker-compose logs
```

**Frontend can't connect?**
- Ensure backend is running: http://localhost:8000/health

**Trades not executing?**
- Check Trading is Enabled in Settings
- Verify API credentials are correct
- Ensure markets are added and active
- Check confidence threshold isn't too high

**Need to reset everything?**
```bash
docker-compose down -v
./start.sh
# Re-enter credentials in Settings
```

## 📚 Documentation

- **README.md** - Full documentation
- **DOCKER.md** - Docker details and advanced usage
- **Settings UI** - Configure everything via web interface

## 🎓 Recommended First Run

1. **Day 1**: Paper trading, add 2-3 markets, observe
2. **Day 2-3**: Adjust risk parameters, watch Claude's decisions
3. **Day 4-5**: Review trade history and reasoning
4. **Day 6+**: Consider live trading with small amounts

## ⚠️ Important Notes

- **Paper Trading**: No real money used, perfect for testing
- **Live Trading**: Real trades on Polymarket, use with caution
- **Database**: Stored in Docker volume, persists across restarts
- **Logs**: Available via `docker-compose logs -f`

## 🆘 Need Help?

1. Check logs: `docker-compose logs -f`
2. Read DOCKER.md for detailed troubleshooting
3. Review backend logs for API errors
4. Check browser console for frontend issues

---

**Your system stays clean! All dependencies run in Docker containers.**
