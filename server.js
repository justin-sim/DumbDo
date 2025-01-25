require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const app = express();
const port = process.env.PORT || 3000;

// Environment variables
const PIN = process.env.DUMBDO_PIN;
const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 10;

// Constant-time string comparison
function secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }
    
    // Use Node's built-in constant-time comparison
    return crypto.timingSafeEqual(
        Buffer.from(a.padEnd(MAX_PIN_LENGTH, '0')), 
        Buffer.from(b.padEnd(MAX_PIN_LENGTH, '0'))
    );
}

// Middleware
app.use(express.json());
app.use(express.static('.'));

// PIN validation middleware
function requirePin(req, res, next) {
    if (!PIN) {
        return next();
    }

    const providedPin = req.headers['x-pin'];
    if (!providedPin || !secureCompare(providedPin, PIN)) {
        return res.status(401).json({ error: 'Invalid PIN' });
    }

    next();
}

// Data directory and file path
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'todos.json');

// Ensure the data directory and file exist
async function initDataFile() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR);
    }
    
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify([]));
    }
    
    // Log the location of the data file
    console.log('Todo list stored at:', DATA_FILE);
}

// PIN Routes
app.get('/api/pin-required', (req, res) => {
    res.json({ 
        required: !!PIN,
        length: PIN ? PIN.length : MIN_PIN_LENGTH
    });
});

app.post('/api/verify-pin', (req, res) => {
    const { pin } = req.body;
    
    // Validate PIN length
    if (PIN && (pin.length < MIN_PIN_LENGTH || pin.length > MAX_PIN_LENGTH)) {
        return res.status(401).json({ 
            valid: false,
            error: `PIN must be between ${MIN_PIN_LENGTH} and ${MAX_PIN_LENGTH} digits`
        });
    }
    
    if (!PIN || secureCompare(pin, PIN)) {
        res.json({ valid: true });
    } else {
        res.status(401).json({ valid: false });
    }
});

// Todo Routes (Protected)
app.get('/api/todos', requirePin, async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: 'Failed to read todos' });
    }
});

app.post('/api/todos', requirePin, async (req, res) => {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save todos' });
    }
});

// Initialize and start server
initDataFile().then(() => {
    app.listen(port, () => {
        console.log(`DumbDo server running at http://localhost:${port}`);
        console.log('PIN protection:', PIN ? 'enabled' : 'disabled');
    });
}); 