import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Settings, TrendingUp, History, BarChart3, Trophy, Percent, Wallet, Bot, DollarSign } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import MarketConfig from './pages/MarketConfig';
import TradeHistory from './pages/TradeHistory';
import SettingsPage from './pages/Settings';
import Leaderboard from './pages/Leaderboard';
import Arbitrage from './pages/Arbitrage';
import Account from './pages/Account';
import AITrading from './pages/AITrading';
import Trade from './pages/Trade';

function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/trade', label: 'Trade', icon: DollarSign },
    { path: '/markets', label: 'Markets', icon: TrendingUp },
    { path: '/leaderboard', label: 'Top Traders', icon: Trophy },
    { path: '/arbitrage', label: 'Arbitrage', icon: Percent },
    { path: '/ai-trading', label: 'AI Trading', icon: Bot },
    { path: '/history', label: 'History', icon: History },
    { path: '/account', label: 'Account', icon: Wallet },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="bg-gray-800 text-white sticky top-0 z-50 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-8 h-8 text-blue-400" />
            <span className="text-xl font-bold">PolyTrader</span>
          </div>
          <div className="flex space-x-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trade" element={<Trade />} />
            <Route path="/markets" element={<MarketConfig />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/arbitrage" element={<Arbitrage />} />
            <Route path="/ai-trading" element={<AITrading />} />
            <Route path="/history" element={<TradeHistory />} />
            <Route path="/account" element={<Account />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
