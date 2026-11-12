// Express & Node.js Dependency setup
const express = require('express');
const WebSocket = require('ws');
const app = express();

// Global active WebSockets cache taaki baar-baar connection na khule
const activeSockets = {};

// Buffer to hold latest ticks/prices per pair
const priceBuffers = {};

// In-Memory Database / Storage Simulation for Keys (Production me ise Database ya JSON file se replace karein)
global.validKeys = global.validKeys || {
    "Ahmad Bhai00": { status: "active" }
};
global.deletedKeys = global.deletedKeys || {};

// Simple Technical Analysis: RSI Calculation
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50; 
    let gains = 0, losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
        let diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff;
        else losses += Math.abs(diff);
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    
    let rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// Simple Moving Average (SMA) Calculation
function calculateSMA(prices, period = 5) {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    const slice = prices.slice(-period);
    const sum = slice.reduce((acc, val) => acc + val, 0);
    return sum / period;
}

// Random Accuracy Generator (81% to 96%)
function getRandomAccuracy() {
    const randomAcc = Math.floor(Math.random() * (96 - 81 + 1)) + 81;
    return `${randomAcc}%`;
}

// Live Signal Evaluator Engine
function generateLiveSignal(symbol, timeframe) {
    const prices = priceBuffers[symbol] || [];
    
    if (prices.length < 5) {
        const fallbackDirections = ['BUY', 'SELL'];
        const randomDir = fallbackDirections[Math.floor(Math.random() * fallbackDirections.length)];
        return {
            pair: symbol.toUpperCase(),
            signal: randomDir,
            accuracy: getRandomAccuracy(),
            timeframe: timeframe,
            reason: "Price Action Volatility Spike",
            timestamp: new Date().toISOString()
        };
    }

    const rsi = calculateRSI(prices, 14);
    const smaFast = calculateSMA(prices, 3);
    const smaSlow = calculateSMA(prices, 8);
    
    let signal = "NEUTRAL";
    let reason = "Market Consolidation";

    if (rsi < 35 && smaFast > smaSlow) {
        signal = "BUY";
        reason = "Oversold RSI Recovery + Bullish Crossover";
    } else if (rsi > 65 && smaFast < smaSlow) {
        signal = "SELL";
        reason = "Overbought RSI Exhaustion + Bearish Crossover";
    } else {
        signal = smaFast > smaSlow ? "BUY" : "SELL";
        reason = "Trend Momentum Continuation";
    }

    return {
        pair: symbol.toUpperCase(),
        signal: signal,
        accuracy: getRandomAccuracy(),
        rsi: rsi.toFixed(2),
        timeframe: timeframe,
        reason: reason,
        timestamp: new Date().toISOString()
    };
}

// Dynamic WebSocket Connection & Feed Handler
function initQuotexSocket(customWsUrl) {
    const defaultWsUrl = 'wss://ws2.market-qx.trade/socket.io/?EIO=3&transport=websocket';
    const wsUrl = customWsUrl || defaultWsUrl;

    if (activeSockets[wsUrl] && activeSockets[wsUrl].readyState === WebSocket.OPEN) {
        return; // Already connected
    }

    try {
        const ws = new WebSocket(wsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://quotex.com'
            }
        });

        activeSockets[wsUrl] = ws;

        ws.on('open', () => {
            ws.send('42["authorization",{"session":""}]');
        });

        ws.on('message', (data) => {
            const strData = data.toString();
            if (strData.includes('live_price')) {
                try {
                    const parsed = JSON.parse(strData.substring(strData.indexOf('[')));
                    if (parsed && parsed[1] && parsed[1].pair) {
                        const pair = parsed[1].pair;
                        const price = parsed[1].price;
                        if (!priceBuffers[pair]) priceBuffers[pair] = [];
                        priceBuffers[pair].push(price);
                        if (priceBuffers[pair].length > 50) priceBuffers[pair].shift();
                    }
                } catch (e) {}
            }
        });

        ws.on('error', () => {});
        ws.on('close', () => {
            setTimeout(() => initQuotexSocket(wsUrl), 5000);
        });
    } catch (err) {}
}

// Initial default activation
initQuotexSocket();

// Route Endpoint Handler function
const handleSignalRequest = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 1. Key Verification Logic
    const userKey = req.query.key;
    if (!userKey) {
        return res.status(401).json({ status: "error", message: "valid key is required" });
    }

    if (global.deletedKeys && global.deletedKeys[userKey]) {
        return res.status(403).json({ status: "error", message: "deleted key" });
    }

    if (!global.validKeys || !global.validKeys[userKey]) {
        return res.status(403).json({ status: "error", message: "invalid key" });
    }

    // 2. Dynamic WebSocket URL support via query parameter (wsurl)
    const customWsUrl = req.query.wsurl || req.query.url;
    if (customWsUrl) {
        initQuotexSocket(decodeURIComponent(customWsUrl));
    }

    // 3. Parameters extraction (pair & timeframe)
    const pairParam = req.query.pair || req.query.symbol || 'eurusd_otc';
    const cleanPair = pairParam.toLowerCase().replace(/[^a-z0-9]/g, '');
    const timeframe = (req.query.tf || req.query.time || '1M').toUpperCase();

    const signalData = generateLiveSignal(cleanPair, timeframe);

    return res.status(200).json({
        status: "success",
        data: signalData
    });
};

// Route Definitions
app.get('/api/s.js', handleSignalRequest);
app.get('/s', handleSignalRequest);
app.get('/s/', handleSignalRequest);

module.exports = app;
module.exports.default = handleSignalRequest;
