// Express setup for Key Management
const express = require('express');
const crypto = require('crypto');
const app = express();

// Shared global storage across serverless functions execution context
global.validKeys = global.validKeys || {
    "Ahmad Bhai00": { status: "active" }
};
global.deletedKeys = global.deletedKeys || {};

const handleKeyManagement = (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 1. Handle Add Query: url/keys/add=true or url/keys?add=true
    const addParam = req.query.add;
    if (addParam !== undefined) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        
        if (addParam === 'true' || addParam === '') {
            // Generate a secure unique random API Key
            const newKey = 'KEY_' + crypto.randomBytes(6).toString('hex').toUpperCase();
            global.validKeys[newKey] = { status: "active", createdAt: new Date().toISOString() };
            return res.status(200).send(`New API Key Generated Successfully: ${newKey}`);
        } else {
            return res.status(200).send("Okay false not generated");
        }
    }

    // 2. Handle Delete Query: url/keys/delete={key} or url/keys?delete={key}
    const deleteParam = req.query.delete;
    if (deleteParam !== undefined) {
        res.setHeader('Content-Type', 'application/json');
        const targetKey = decodeURIComponent(deleteParam);

        if (global.validKeys[targetKey]) {
            delete global.validKeys[targetKey];
            global.deletedKeys[targetKey] = { deletedAt: new Date().toISOString() };
            return res.status(200).json({
                status: "success",
                message: `${targetKey} has been deleted permanently!`
            });
        } else if (global.deletedKeys[targetKey]) {
            return res.status(400).json({
                status: "error",
                message: `${targetKey} is already deleted!`
            });
        } else {
            return res.status(404).json({
                status: "error",
                message: `Key '${targetKey}' not found!`
            });
        }
    }

    // Default Fallback Info Response
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
        status: "success",
        message: "Key Management API is running. Use ?add=true, ?add=false, or ?delete=KEY_NAME"
    });
};

// Route definitions supporting Vercel and direct routing
app.get('/api/keys', handleKeyManagement);
app.get('/keys', handleKeyManagement);
app.get('/keys/', handleKeyManagement);

module.exports = app;
module.exports.default = handleKeyManagement;
