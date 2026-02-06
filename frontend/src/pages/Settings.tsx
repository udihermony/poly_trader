import { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle, Key, Shield, Activity, Crosshair, Percent } from 'lucide-react';
import { configApi, tradingApi, snipeApi, spreadApi } from '../services/api';

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Credentials
  const [credentials, setCredentials] = useState({
    polymarket_api_key: '',
    polymarket_secret: '',
    polymarket_passphrase: '',
    polymarket_funder_address: '',
    polymarket_private_key: '',
    claude_api_key: '',
    gemini_api_key: '',
    local_llm_url: '',
  });

  const [hasCredentials, setHasCredentials] = useState({
    hasPolymarketCredentials: false,
    hasClaudeApiKey: false,
    hasGeminiApiKey: false,
    hasLocalLLM: false,
    hasPrivateKey: false,
    localLLMUrl: '',
  });

  // Risk config
  const [riskConfig, setRiskConfig] = useState({
    max_bet_size: 10,
    daily_budget: 100,
    max_open_positions: 10,
    min_confidence_threshold: 0.6,
    max_market_exposure: 50,
  });

  // Snipe config
  const [snipeConfig, setSnipeConfig] = useState({
    snipeSize: 10,
    profitTarget: 0.05,
    snipeEnabled: false,
  });

  // Spread config
  const [spreadConfig, setSpreadConfig] = useState({
    spreadEnabled: false,
    scanIntervalSeconds: 60,
    minSpreadThreshold: 0.01,
    maxSpreadBetSize: 10,
    autoExecute: false,
    scanMultiOutcome: true,
  });

  // App config
  const [appConfig, setAppConfig] = useState({
    paper_trading_mode: true,
    trading_enabled: false,
    analysis_interval_minutes: 5,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [credsRes, riskRes, appRes, snipeRes, spreadRes] = await Promise.all([
        configApi.getCredentials(),
        configApi.getRiskConfig(),
        configApi.getAppConfig(),
        snipeApi.getStatus(),
        spreadApi.getStatus(),
      ]);

      setHasCredentials(credsRes.data.data);
      if (credsRes.data.data.funderAddress) {
        setCredentials((prev) => ({
          ...prev,
          polymarket_funder_address: credsRes.data.data.funderAddress,
        }));
      }
      if (credsRes.data.data.localLLMUrl) {
        setCredentials((prev) => ({
          ...prev,
          local_llm_url: credsRes.data.data.localLLMUrl,
        }));
      }

      setRiskConfig(riskRes.data.data);
      setAppConfig(appRes.data.data);
      setSnipeConfig({
        snipeSize: snipeRes.data.data.snipeSize || 10,
        profitTarget: snipeRes.data.data.profitTarget || 0.05,
        snipeEnabled: snipeRes.data.data.snipeEnabled || false,
      });
      setSpreadConfig({
        spreadEnabled: spreadRes.data.data.spreadEnabled || false,
        scanIntervalSeconds: spreadRes.data.data.scanIntervalSeconds || 60,
        minSpreadThreshold: spreadRes.data.data.minSpreadThreshold || 0.01,
        maxSpreadBetSize: spreadRes.data.data.maxSpreadBetSize || 10,
        autoExecute: spreadRes.data.data.autoExecute || false,
        scanMultiOutcome: spreadRes.data.data.scanMultiOutcome ?? true,
      });
    } catch (error: any) {
      showMessage('error', 'Failed to load settings: ' + error.message);
    }
  };

  const saveCredentials = async () => {
    setLoading(true);
    try {
      // Only send fields that have values (not empty strings)
      // This prevents overwriting existing credentials with empty values
      const payload: any = {};

      Object.keys(credentials).forEach((key) => {
        const value = credentials[key as keyof typeof credentials];
        // Only include non-empty values
        if (value && value.trim() !== '') {
          payload[key] = value;
        } else {
          // For empty fields, send null to keep existing value
          payload[key] = null;
        }
      });

      await configApi.updateCredentials(payload);
      showMessage('success', 'Credentials saved successfully');

      // Clear the input fields after saving
      setCredentials({
        polymarket_api_key: '',
        polymarket_secret: '',
        polymarket_passphrase: '',
        polymarket_funder_address: '',
        polymarket_private_key: '',
        claude_api_key: '',
        gemini_api_key: '',
        local_llm_url: '',
      });

      await loadSettings();
    } catch (error: any) {
      showMessage('error', 'Failed to save credentials: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveRiskConfig = async () => {
    setLoading(true);
    try {
      await configApi.updateRiskConfig(riskConfig);
      showMessage('success', 'Risk configuration saved successfully');
    } catch (error: any) {
      showMessage('error', 'Failed to save risk configuration: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveSnipeConfig = async () => {
    setLoading(true);
    try {
      await snipeApi.updateSettings(snipeConfig);
      showMessage('success', 'Snipe configuration saved successfully');
    } catch (error: any) {
      showMessage('error', 'Failed to save snipe configuration: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveSpreadConfig = async () => {
    setLoading(true);
    try {
      await spreadApi.updateSettings(spreadConfig);
      showMessage('success', 'Spread configuration saved successfully');
    } catch (error: any) {
      showMessage('error', 'Failed to save spread configuration: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveAppConfig = async () => {
    setLoading(true);
    try {
      await configApi.updateAppConfig(appConfig);
      showMessage('success', 'App configuration saved successfully');

      // Restart trading service if enabled
      if (appConfig.trading_enabled) {
        await tradingApi.stop();
        await tradingApi.start();
      } else {
        await tradingApi.stop();
      }
    } catch (error: any) {
      showMessage('error', 'Failed to save app configuration: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Settings</h1>

      {message && (
        <div
          className={`flex items-center p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 mr-2" />
          ) : (
            <AlertCircle className="w-5 h-5 mr-2" />
          )}
          {message.text}
        </div>
      )}

      {/* API Credentials */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Key className="w-6 h-6 text-blue-500 mr-2" />
          <h2 className="text-xl font-semibold">API Credentials</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Polymarket API Key
            </label>
            <input
              type="password"
              value={credentials.polymarket_api_key}
              onChange={(e) =>
                setCredentials({ ...credentials, polymarket_api_key: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={hasCredentials.hasPolymarketCredentials ? '••••••••' : ''}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Polymarket Secret
            </label>
            <input
              type="password"
              value={credentials.polymarket_secret}
              onChange={(e) =>
                setCredentials({ ...credentials, polymarket_secret: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={hasCredentials.hasPolymarketCredentials ? '••••••••' : ''}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Polymarket Passphrase
            </label>
            <input
              type="password"
              value={credentials.polymarket_passphrase}
              onChange={(e) =>
                setCredentials({ ...credentials, polymarket_passphrase: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={hasCredentials.hasPolymarketCredentials ? '••••••••' : ''}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Polymarket Funder Address
            </label>
            <input
              type="text"
              value={credentials.polymarket_funder_address}
              onChange={(e) =>
                setCredentials({ ...credentials, polymarket_funder_address: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0x..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wallet Private Key (for signing trades)
            </label>
            <input
              type="password"
              value={credentials.polymarket_private_key}
              onChange={(e) =>
                setCredentials({ ...credentials, polymarket_private_key: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={hasCredentials.hasPrivateKey ? '••••••••' : '0x... or 64 hex characters'}
            />
            <p className="text-xs text-gray-500 mt-1">
              Required for real trading. Stored locally in .env file, never sent to any server.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Claude API Key
            </label>
            <input
              type="password"
              value={credentials.claude_api_key}
              onChange={(e) =>
                setCredentials({ ...credentials, claude_api_key: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={hasCredentials.hasClaudeApiKey ? '••••••••' : 'sk-ant-...'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gemini API Key (Fallback #1)
            </label>
            <input
              type="password"
              value={credentials.gemini_api_key}
              onChange={(e) =>
                setCredentials({ ...credentials, gemini_api_key: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={hasCredentials.hasGeminiApiKey ? '••••••••' : 'AIza...'}
            />
            <p className="text-xs text-gray-500 mt-1">
              Free Google API - used as first fallback when Claude fails
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Local LLM URL (Fallback #2) 🏠
            </label>
            <input
              type="text"
              value={credentials.local_llm_url}
              onChange={(e) =>
                setCredentials({ ...credentials, local_llm_url: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="http://192.168.1.252:1234"
            />
            <p className="text-xs text-gray-500 mt-1">
              LM Studio or any OpenAI-compatible local LLM (e.g. http://localhost:1234)
            </p>
          </div>

          <button
            onClick={saveCredentials}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Credentials
          </button>
        </div>
      </div>

      {/* Risk Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Shield className="w-6 h-6 text-green-500 mr-2" />
          <h2 className="text-xl font-semibold">Risk Management</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Bet Size ($)
            </label>
            <input
              type="number"
              value={riskConfig.max_bet_size}
              onChange={(e) =>
                setRiskConfig({ ...riskConfig, max_bet_size: parseFloat(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Daily Budget ($)
            </label>
            <input
              type="number"
              value={riskConfig.daily_budget}
              onChange={(e) =>
                setRiskConfig({ ...riskConfig, daily_budget: parseFloat(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Open Positions
            </label>
            <input
              type="number"
              value={riskConfig.max_open_positions}
              onChange={(e) =>
                setRiskConfig({ ...riskConfig, max_open_positions: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Confidence Threshold ({(riskConfig.min_confidence_threshold * 100).toFixed(0)}%)
            </label>
            <input
              type="range"
              value={riskConfig.min_confidence_threshold}
              onChange={(e) =>
                setRiskConfig({
                  ...riskConfig,
                  min_confidence_threshold: parseFloat(e.target.value),
                })
              }
              className="w-full"
              min="0"
              max="1"
              step="0.05"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Market Exposure ($)
            </label>
            <input
              type="number"
              value={riskConfig.max_market_exposure}
              onChange={(e) =>
                setRiskConfig({ ...riskConfig, max_market_exposure: parseFloat(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              min="1"
            />
          </div>

          <button
            onClick={saveRiskConfig}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Risk Settings
          </button>
        </div>
      </div>

      {/* Snipe Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Crosshair className="w-6 h-6 text-green-500 mr-2" />
          <h2 className="text-xl font-semibold">Snipe Settings (Copy Trading)</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Auto-Snipe Enabled</h3>
              <p className="text-sm text-gray-600">
                Automatically copy positions from top traders
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={snipeConfig.snipeEnabled}
                onChange={(e) =>
                  setSnipeConfig({ ...snipeConfig, snipeEnabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Snipe Size ($) - Amount to invest per copied position
            </label>
            <input
              type="number"
              value={snipeConfig.snipeSize}
              onChange={(e) =>
                setSnipeConfig({ ...snipeConfig, snipeSize: parseFloat(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profit Target ({(snipeConfig.profitTarget * 100).toFixed(0)}%) - Auto-close when reached
            </label>
            <input
              type="range"
              value={snipeConfig.profitTarget}
              onChange={(e) =>
                setSnipeConfig({ ...snipeConfig, profitTarget: parseFloat(e.target.value) })
              }
              className="w-full"
              min="0.01"
              max="0.50"
              step="0.01"
            />
            <p className="text-xs text-gray-500 mt-1">
              Positions will auto-close when they reach {(snipeConfig.profitTarget * 100).toFixed(0)}% profit
            </p>
          </div>

          <button
            onClick={saveSnipeConfig}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Snipe Settings
          </button>
        </div>
      </div>

      {/* Arbitrage Scanner Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Percent className="w-6 h-6 text-indigo-500 mr-2" />
          <h2 className="text-xl font-semibold">Arbitrage Scanner Settings</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Spread Scanner Enabled</h3>
              <p className="text-sm text-gray-600">
                Enable scanning for spread/arbitrage opportunities
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={spreadConfig.spreadEnabled}
                onChange={(e) =>
                  setSpreadConfig({ ...spreadConfig, spreadEnabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Auto-Execute</h3>
              <p className="text-sm text-gray-600">
                Automatically execute spread trades when found
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={spreadConfig.autoExecute}
                onChange={(e) =>
                  setSpreadConfig({ ...spreadConfig, autoExecute: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Scan Multi-Outcome Events</h3>
              <p className="text-sm text-gray-600">
                Include multi-outcome events (not just binary YES/NO)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={spreadConfig.scanMultiOutcome}
                onChange={(e) =>
                  setSpreadConfig({ ...spreadConfig, scanMultiOutcome: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scan Interval (seconds)
            </label>
            <input
              type="number"
              value={spreadConfig.scanIntervalSeconds}
              onChange={(e) =>
                setSpreadConfig({ ...spreadConfig, scanIntervalSeconds: parseInt(e.target.value) || 60 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              min="10"
              max="3600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Spread Bet Size ($)
            </label>
            <input
              type="number"
              value={spreadConfig.maxSpreadBetSize}
              onChange={(e) =>
                setSpreadConfig({ ...spreadConfig, maxSpreadBetSize: parseFloat(e.target.value) || 10 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Spread Threshold ({(spreadConfig.minSpreadThreshold * 100).toFixed(1)}%)
            </label>
            <input
              type="range"
              value={spreadConfig.minSpreadThreshold}
              onChange={(e) =>
                setSpreadConfig({ ...spreadConfig, minSpreadThreshold: parseFloat(e.target.value) })
              }
              className="w-full"
              min="0.001"
              max="0.20"
              step="0.001"
            />
            <p className="text-xs text-gray-500 mt-1">
              Only show opportunities with spread above {(spreadConfig.minSpreadThreshold * 100).toFixed(1)}%
            </p>
          </div>

          <button
            onClick={saveSpreadConfig}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Spread Settings
          </button>
        </div>
      </div>

      {/* App Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Activity className="w-6 h-6 text-purple-500 mr-2" />
          <h2 className="text-xl font-semibold">App Configuration</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Paper Trading Mode</h3>
              <p className="text-sm text-gray-600">
                Simulates trades without real execution (Recommended for testing)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={appConfig.paper_trading_mode}
                onChange={(e) =>
                  setAppConfig({ ...appConfig, paper_trading_mode: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Trading Enabled</h3>
              <p className="text-sm text-gray-600">
                Enable autonomous trading (requires valid API credentials)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={appConfig.trading_enabled}
                onChange={(e) =>
                  setAppConfig({ ...appConfig, trading_enabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Analysis Interval (minutes)
            </label>
            <input
              type="number"
              value={appConfig.analysis_interval_minutes}
              onChange={(e) =>
                setAppConfig({
                  ...appConfig,
                  analysis_interval_minutes: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              min="1"
              max="60"
            />
            <p className="text-sm text-gray-500 mt-1">
              How often to analyze each monitored market
            </p>
          </div>

          <button
            onClick={saveAppConfig}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            Save App Settings
          </button>
        </div>
      </div>
    </div>
  );
}
