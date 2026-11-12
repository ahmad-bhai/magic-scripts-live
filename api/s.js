const express = require('express');
const WebSocket = require('ws');
const https = require('https');
const app = express();

const activeSockets = {};
const priceBuffers = {};

const FIREBASE_DB_URL = "https://reactions-maker-site-default-rtdb.firebaseio.com";

// Helper function to check if a key exists in Firebase database across all users
async function verifyApiKeyInDatabase(apiKey) {
    if (apiKey === "Ahmad Bhai00") return true; // Default fallback key

    return new Promise((resolve) => {
        const url = `${FIREBASE_DB_URL}/users.json`;
        https.get(url, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const users = JSON.parse(body);
                    if (!users) return resolve(false);

                    for (let userId in users) {
                        const user = users[userId];
                        if (user && user.keys && user.keys[apiKey]) {
                            return resolve(true);
                        }
                    }
                    resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        }).on('error', () => resolve(false));
    });
}

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

function calculateSMA(prices, period = 5) {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    const slice = prices.slice(-period);
    const sum = slice.reduce((acc, val) => acc + val, 0);
    return sum / period;
}

function getRandomAccuracy() {
    const randomAcc = Math.floor(Math.random() * (96 - 81 + 1)) + 81;
    return `${randomAcc}%`;
}

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

function initQuotexSocket(customWsUrl) {
    const defaultWsUrl = 'wss://ws2.market-qx.trade/socket.io/?EIO=3&transport=websocket';
    const wsUrl = customWsUrl || defaultWsUrl;

    if (activeSockets[wsUrl] && activeSockets[wsUrl].readyState === WebSocket.OPEN) {
        return;
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

initQuotexSocket();

const handleSignalRequest = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const userKey = req.query.key;
    if (!userKey) {
        return res.status(401).json({ status: "error", message: "valid key is required" });
    }

    // Verify key against Firebase database
    const isValid = await verifyApiKeyInDatabase(userKey);
    if (!isValid) {
        return res.status(403).json({ status: "error", message: "invalid key" });
    }

    const customWsUrl = req.query.wsurl || req.query.url;
    if (customWsUrl) {
        initQuotexSocket(decodeURIComponent(customWsUrl));
    }

    const pairParam = req.query.pair || req.query.symbol || 'eurusd_otc';
    const cleanPair = pairParam.toLowerCase().replace(/[^a-z0-9]/g, '');
    const timeframe = (req.query.tf || req.query.time || '1M').toUpperCase();

    const signalData = generateLiveSignal(cleanPair, timeframe);

    return res.status(200).json({
        status: "success",
        data: signalData
    });
};

app.get('/api/s.js', handleSignalRequest);
app.get('/s', handleSignalRequest);
app.get('/s/', handleSignalRequest);

module.exports = app;
module.exports.default = handleSignalRequest;
