const express = require('express');
const crypto = require('crypto');
const https = require('https');
const app = express();

app.use(express.json());

const FIREBASE_DB_URL = "https://reactions-maker-site-default-rtdb.firebaseio.com";

// Helper function for Firebase HTTP requests
function firebaseRequest(method, path = "", data = null) {
    return new Promise((resolve, reject) => {
        const targetUrl = `${FIREBASE_DB_URL}${path}.json`;
        const urlObj = new URL(targetUrl);
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : null);
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', (err) => reject(err));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

const handleKeyManagement = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const action = req.query.action || req.body.action;
    const email = (req.query.email || req.body.email || "").toLowerCase().trim();
    const password = req.query.password || req.body.password || "";

    if (!email || !password) {
        return res.status(400).json({ status: "error", message: "Email and password are required." });
    }

    const userKeyId = crypto.createHash('md5').update(email).digest('hex');
    const hashedPassword = hashPassword(password);

    try {
        const userRecord = await firebaseRequest("GET", `/users/${userKeyId}`);

        // 1. AUTHENTICATION / LOGIN
        if (action === "auth") {
            if (userRecord) {
                if (userRecord.passwordHash !== hashedPassword) {
                    return res.status(401).json({ status: "error", message: "Incorrect password! Please check your credentials." });
                }
                return res.status(200).json({
                    status: "success",
                    message: "Login successful",
                    keys: userRecord.keys ? Object.values(userRecord.keys) : []
                });
            } else {
                const newUser = {
                    email: email,
                    passwordHash: hashedPassword,
                    createdAt: new Date().toISOString(),
                    keys: {}
                };
                await firebaseRequest("PUT", `/users/${userKeyId}`, newUser);
                return res.status(200).json({
                    status: "success",
                    message: "Account created and synced successfully",
                    keys: []
                });
            }
        }

        // 2. ADD NEW API KEY
        if (action === "add") {
            if (!userRecord || userRecord.passwordHash !== hashedPassword) {
                return res.status(401).json({ status: "error", message: "Unauthorized access or incorrect password." });
            }

            const newApiKey = 'KEY_' + crypto.randomBytes(6).toString('hex').toUpperCase();
            const fullUrl = `https://magic-scripts-live.vercel.app/s?pair=eurusd_otc&tf=1M&key=${newApiKey}`;
            
            const keyObj = {
                key: newApiKey,
                url: fullUrl,
                createdAt: new Date().toISOString()
            };

            await firebaseRequest("PUT", `/users/${userKeyId}/keys/${newApiKey}`, keyObj);

            return res.status(200).json({
                status: "success",
                message: "API Key generated successfully",
                keyData: keyObj
            });
        }

        // 3. DELETE API KEY
        if (action === "delete") {
            const targetKey = req.query.key || req.body.key;
            if (!userRecord || userRecord.passwordHash !== hashedPassword) {
                return res.status(401).json({ status: "error", message: "Unauthorized access." });
            }

            await firebaseRequest("DELETE", `/users/${userKeyId}/keys/${targetKey}`);

            return res.status(200).json({
                status: "success",
                message: `${targetKey} has been deleted permanently!`
            });
        }

        return res.status(400).json({ status: "error", message: "Invalid action specified." });

    } catch (err) {
        return res.status(500).json({ status: "error", message: "Internal server error connecting to database." });
    }
};

app.get('/api/keys', handleKeyManagement);
app.post('/api/keys', handleKeyManagement);
app.get('/keys', handleKeyManagement);
app.post('/keys', handleKeyManagement);

module.exports = app;
module.exports.default = handleKeyManagement;
