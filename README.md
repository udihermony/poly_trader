# PolyTrader - Polymarket Auto-Trading Platform

An autonomous trading application for Polymarket that uses Claude AI to analyze markets and execute trades based on configurable risk parameters.

## Features

- **Claude AI Analysis**: Uses Claude to analyze Polymarket markets and provide trading recommendations
- **Autonomous Trading**: Executes trades automatically based on AI analysis and risk parameters
- **Paper Trading Mode**: Test strategies without risking real money
- **Risk Management**: Configurable bet sizes, daily budgets, and position limits
- **Real-time Monitoring**: Live dashboard showing positions, budget, and recent analyses
- **Market Management**: Search and add Polymarket markets to monitor
- **Trade History**: Complete audit trail with Claude's reasoning for each trade

## Prerequisites

Before running this application, you need:

1. **Polymarket API Credentials**:
   - API Key
   - Secret
   - Passphrase
   - Funder Address (your Polymarket wallet address)

2. **Claude API Key**:
   - Get one from [Anthropic Console](https://console.anthropic.com/)

3. **Docker** (Recommended - keeps everything isolated):
   - [Docker Desktop](https://www.docker.com/products/docker-desktop) for Mac/Windows
   - Docker Engine for Linux

**OR**

3. **Node.js**: Version 18 or higher (if not using Docker)

## Quick Start with Docker (Recommended)

This is the easiest way - all dependencies are isolated in containers, nothing touches your system!

### 1. Setup Credentials

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your API credentials
# (You can use any text editor)
```

### 2. Start the Application

```bash
# Simple one-command start
./start.sh
```

That's it! The script will:
- Build Docker containers (first time only, takes ~2-3 minutes)
- Start backend and frontend services
- Open at http://localhost:3000

### 3. Stop the Application

```bash
./stop.sh
```

### Docker Commands

```bash
# View logs
docker-compose logs -f

# View backend logs only
docker-compose logs -f backend

# View frontend logs only
docker-compose logs -f frontend

# Restart services
docker-compose restart

# Stop and remove containers (keeps database)
docker-compose down

# Stop and remove everything including database
docker-compose down -v
```

## Manual Installation (Without Docker)

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit the `.env` file with your credentials:

```env
# Polymarket API Credentials
POLYMARKET_API_KEY=your_api_key_here
POLYMARKET_SECRET=your_secret_here
POLYMARKET_PASSPHRASE=your_passphrase_here
POLYMARKET_FUNDER_ADDRESS=your_funder_address_here

# Claude API
ANTHROPIC_API_KEY=your_claude_api_key_here

# App Configuration
PORT=8000
NODE_ENV=development
DATABASE_PATH=./database/polytrader.db

# Trading Configuration (optional - can also configure via UI)
PAPER_TRADING_MODE=true
ANALYSIS_INTERVAL_MINUTES=5
MIN_CONFIDENCE_THRESHOLD=0.6
```

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

The backend will start on `http://localhost:8000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:3000`

### Production Mode

**Build Backend:**
```bash
cd backend
npm run build
npm start
```

**Build Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

## Getting Started

### 1. Configure API Credentials

1. Open the application at `http://localhost:3000`
2. Navigate to **Settings** page
3. Enter your Polymarket API credentials
4. Enter your Claude API key
5. Click **Save Credentials**

### 2. Configure Risk Parameters

In the Settings page:

- **Max Bet Size**: Maximum amount per trade (e.g., $10)
- **Daily Budget**: Maximum total spending per day (e.g., $100)
- **Max Open Positions**: Maximum number of concurrent positions (e.g., 10)
- **Min Confidence Threshold**: Minimum Claude confidence to execute a trade (e.g., 60%)
- **Max Market Exposure**: Maximum total exposure per market (e.g., $50)

### 3. Enable Paper Trading (Recommended)

- Keep **Paper Trading Mode** enabled initially
- This simulates trades without real execution
- Test the system before going live

### 4. Add Markets to Monitor

1. Go to **Markets** page
2. Search for Polymarket markets
3. Click **Add** to start monitoring a market
4. The system will analyze these markets periodically

### 5. Start Trading

1. Go to **Settings** page
2. Toggle **Trading Enabled** to ON
3. The system will start analyzing markets and executing trades
4. Monitor activity on the **Dashboard**

## How It Works

### Trading Flow

1. **Market Monitoring**: The system monitors all active markets you've added
2. **Analysis Cooldown**: Each market is analyzed every N minutes (configurable)
3. **Claude Analysis**: Claude analyzes market data and provides:
   - Trading decision (BUY_YES, BUY_NO, SELL_YES, SELL_NO, or HOLD)
   - Confidence score (0-1)
   - Reasoning and key factors
   - Suggested position size
4. **Risk Validation**: The system checks:
   - Confidence threshold
   - Daily budget remaining
   - Bet size limits
   - Position limits
   - Market exposure limits
5. **Trade Execution**: If approved, the trade is executed (or simulated in paper mode)
6. **Logging**: All analyses and trades are logged with full details

### Claude's Analysis

Claude receives:
- Market question
- Current YES/NO prices and probabilities
- 24-hour volume and liquidity
- Time remaining until market close
- Recent price trends

Claude evaluates:
- Whether the current price accurately reflects true probability
- Potential mispricing or trading opportunities
- Liquidity and slippage risks
- Time decay considerations

## Dashboard Overview

### System Status Card
- Shows whether trading is active
- Displays paper/live trading mode
- Shows Polymarket and Claude connection status

### Budget Card
- Daily spending vs. budget
- Utilization percentage with visual indicator
- Warns when approaching limit

### Active Markets Card
- Number of markets being monitored
- Open positions count
- Trades executed today

### P&L Card
- Profit/loss for the day
- Color-coded (green for profit, red for loss)

### Recent Analyses
- Claude's latest market analyses
- Decision, confidence, and reasoning
- Key factors identified

## Paper Trading vs. Live Trading

### Paper Trading (Default)
- ✅ Simulates all trades
- ✅ No real money at risk
- ✅ Full analysis and logging
- ✅ Perfect for testing
- ⚠️ Order IDs are prefixed with "PAPER_"

### Live Trading
- ⚠️ Executes real trades on Polymarket
- ⚠️ Uses your actual funds
- ⚠️ Requires valid API credentials
- ⚠️ Cannot undo executed trades

**Recommendation**: Always test with paper trading first!

## Risk Management Best Practices

1. **Start Small**: Begin with low bet sizes and daily budgets
2. **Test Thoroughly**: Use paper trading mode extensively
3. **Monitor Closely**: Check the dashboard regularly
4. **Adjust Parameters**: Tune risk settings based on performance
5. **Diversify**: Don't put all budget in one market
6. **Set Confidence High**: Use higher confidence thresholds (70%+) for live trading
7. **Emergency Stop**: Use the Stop Trading button if needed

## Troubleshooting

### Backend won't start
- Check that port 8000 is not in use
- Verify `.env` file exists and has correct format
- Check `npm install` completed successfully

### Frontend won't connect
- Ensure backend is running on port 8000
- Check browser console for errors
- Verify CORS settings in backend

### Trades not executing
- Check **Trading Enabled** is ON in Settings
- Verify API credentials are correct
- Ensure markets are added and active
- Check budget hasn't been exhausted
- Review confidence threshold settings

### Claude analysis fails
- Verify Claude API key is correct
- Check API rate limits
- Review backend logs for error details

### Polymarket connection issues
- Verify all Polymarket credentials are correct
- Check funder address is valid
- Ensure API key has necessary permissions

## Database

The application uses SQLite to store:
- Monitored markets
- Trade history
- Analysis logs
- Risk configuration
- Budget tracking

Database location: `backend/database/polytrader.db`

## API Endpoints

### Config
- `GET /api/config/risk` - Get risk configuration
- `PUT /api/config/risk` - Update risk configuration
- `GET /api/config/app` - Get app configuration
- `PUT /api/config/app` - Update app configuration
- `GET /api/config/credentials` - Check credentials status
- `PUT /api/config/credentials` - Update credentials
- `GET /api/config/budget` - Get today's budget

### Markets
- `GET /api/markets` - Get monitored markets
- `GET /api/markets/search` - Search Polymarket markets
- `POST /api/markets` - Add market to monitoring
- `PATCH /api/markets/:marketId/status` - Toggle market status

### Trades
- `GET /api/trades` - Get all trades
- `GET /api/trades/positions` - Get open positions
- `GET /api/trades/analyses` - Get recent analyses

### Trading
- `GET /api/trading/status` - Get trading service status
- `POST /api/trading/start` - Start trading service
- `POST /api/trading/stop` - Stop trading service

## Architecture

### Backend (Node.js/TypeScript)
- Express server with REST API
- SQLite database for persistence
- WebSocket for real-time updates
- Service-based architecture:
  - **PolymarketService**: Handles CLOB API integration
  - **ClaudeService**: Manages Claude AI analysis
  - **RiskService**: Enforces risk management rules
  - **TradingService**: Orchestrates the trading loop

### Frontend (React/TypeScript)
- Vite for fast development
- TailwindCSS for styling
- React Router for navigation
- Axios for API calls
- Real-time updates via WebSocket

## Security Considerations

- API credentials stored locally in SQLite
- Never log sensitive credentials
- All trades logged for audit trail
- Paper trading mode for safe testing
- Risk limits enforced at multiple levels

## Future Enhancements

- Performance analytics and backtesting
- Email/SMS notifications
- Multiple Claude model comparison
- Portfolio optimization
- Advanced charting
- Mobile app

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review backend logs
3. Check browser console for frontend errors

## License

MIT License

## Disclaimer

This software is for educational purposes. Prediction market trading involves risk. Always start with paper trading mode and small amounts. The developers are not responsible for any financial losses.

## Contributing

Contributions welcome! Please open an issue or pull request.

---

**Built with:**
- [Polymarket CLOB API](https://docs.polymarket.com/)
- [Claude AI by Anthropic](https://www.anthropic.com/)
- Node.js, Express, React, TypeScript, SQLite
