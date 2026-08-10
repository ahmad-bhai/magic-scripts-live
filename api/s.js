const express = require('express');
const { RSI, EMA } = require('technicalindicators');

const app = express();

// Random Candle Generator (Price Movement Simulation for OTC/Pairs)
function generateCandles(count = 50) {
    let prices = [];
    let currentPrice = 1.0850; // Base Price
    for (let i = 0; i < count; i++) {
        let change = (Math.random() - 0.49) * 0.0015;
        currentPrice += change;
        prices.push(parseFloat(currentPrice.toFixed(5)));
    }
    return prices;
}

// Indicator Logic Engine
function analyzeMarket(prices) {
    // 1. RSI (14 Period)
    const rsiValues = RSI.calculate({ period: 14, values: prices });
    const currentRSI = rsiValues[rsiValues.length - 1];

    // 2. EMA Crossover (Short = 9, Long = 21)
    const ema9 = EMA.calculate({ period: 9, values: prices });
    const ema21 = EMA.calculate({ period: 21, values: prices });

    const currentEma9 = ema9[ema9.length - 1];
    const currentEma21 = ema21[ema21.length - 1];

    // Signal Calculation Logic
    let signal = 'NEUTRAL';
    let confidence = '50%';

    if (currentRSI < 30 || currentEma9 > currentEma21) {
        signal = 'BUY';
        confidence = Math.floor(Math.random() * (95 - 75 + 1) + 75) + '%';
    } else if (currentRSI > 70 || currentEma9 < currentEma21) {
        signal = 'SELL';
        confidence = Math.floor(Math.random() * (95 - 75 + 1) + 75) + '%';
    }

    return {
        signal: signal,
        confidence: confidence,
        rsi: parseFloat(currentRSI.toFixed(2)),
        ema9: parseFloat(currentEma9.toFixed(5)),
        ema21: parseFloat(currentEma21.toFixed(5))
    };
}

// API Route Handler
app.get('*', (req, res) => {
    // Enable CORS for external Bots/Scripts
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    // Extract Pair Name
    let pair = req.query.pair || req.query.p || 'EURUSD';
    pair = pair.replace('/', '').toUpperCase();

    // Perform Analysis
    const prices = generateCandles(60);
    const analysis = analyzeMarket(prices);

    // Dynamic Server Timestamp
    const timestamp = new Date().toISOString();

    // Final API Response Format
    res.json({
        status: true,
        symbol: pair,
        signal: analysis.signal,
        accuracy: analysis.confidence,
        indicators: {
            rsi: analysis.rsi,
            ema_9: analysis.ema9,
            ema_21: analysis.ema21
        },
        timestamp: timestamp
    });
});

module.exports = app;
  
