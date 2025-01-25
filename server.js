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

// Brute force protection settings
const MAX_ATTEMPTS = 5;  // Maximum attempts before lockout
const LOCKOUT_TIME = 15 * 60 * 1000;  // 15 minutes in milliseconds
const ATTEMPT_RESET_TIME = 60 * 60 * 1000;  // 1 hour in milliseconds

// Store attempts in memory (you might want to use Redis in production)
const attempts = new Map();

// Rate limiting and attempt tracking
function trackAttempt(ip) {
    const now = Date.now();
    const attempt = attempts.get(ip) || { count: 0, firstAttempt: now, lockoutUntil: 0 };
    
    // Reset attempts if it's been long enough since first attempt
    if (now - attempt.firstAttempt > ATTEMPT_RESET_TIME) {
        attempt.count = 0;
        attempt.firstAttempt = now;
    }
    
    attempt.count++;
    attempts.set(ip, attempt);
    
    // Check if we should lock out
    if (attempt.count >= MAX_ATTEMPTS) {
        attempt.lockoutUntil = now + LOCKOUT_TIME;
    }
    
    return attempt;
}

function isLockedOut(ip) {
    const attempt = attempts.get(ip);
    if (!attempt) return false;
    
    // Check if lockout period has expired
    if (attempt.lockoutUntil && Date.now() < attempt.lockoutUntil) {
        const remainingTime = Math.ceil((attempt.lockoutUntil - Date.now()) / 1000 / 60);
        return remainingTime;
    }
    
    return false;
}

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
    const lockoutTime = isLockedOut(req.ip);
    res.json({ 
        required: !!PIN,
        length: PIN ? PIN.length : MIN_PIN_LENGTH,
        locked: lockoutTime ? true : false,
        lockoutMinutes: lockoutTime || 0
    });
});

app.post('/api/verify-pin', (req, res) => {
    const { pin } = req.body;
    
    // Check for lockout
    const lockoutTime = isLockedOut(req.ip);
    if (lockoutTime) {
        return res.status(429).json({ 
            valid: false, 
            error: `Too many attempts. Please try again in ${lockoutTime} minutes.`,
            locked: true,
            lockoutMinutes: lockoutTime
        });
    }
    
    // Validate PIN length
    if (PIN && (pin.length < MIN_PIN_LENGTH || pin.length > MAX_PIN_LENGTH)) {
        return res.status(401).json({ 
            valid: false,
            error: `PIN must be between ${MIN_PIN_LENGTH} and ${MAX_PIN_LENGTH} digits`
        });
    }
    
    // Track this attempt
    const attempt = trackAttempt(req.ip);
    const remainingAttempts = MAX_ATTEMPTS - attempt.count;
    
    if (!PIN || secureCompare(pin, PIN)) {
        // Reset attempts on successful login
        attempts.delete(req.ip);
        res.json({ valid: true });
    } else {
        res.status(401).json({ 
            valid: false,
            remainingAttempts,
            error: `Invalid PIN. ${remainingAttempts} attempts remaining before lockout.`
        });
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