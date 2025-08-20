const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const USERS_FILE = path.join(__dirname, '../data/users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Ensure users file exists
async function ensureUsersFile() {
    if (!await fs.pathExists(USERS_FILE)) {
        await fs.writeJson(USERS_FILE, []);
    }
}

// Load users
async function loadUsers() {
    await ensureUsersFile();
    return await fs.readJson(USERS_FILE);
}

// Save users
async function saveUsers(users) {
    await fs.writeJson(USERS_FILE, users, { spaces: 2 });
}

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { username, password, githubToken } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (username.length < 3 || password.length < 6) {
            return res.status(400).json({ 
                error: 'Username must be at least 3 characters and password at least 6 characters' 
            });
        }

        const users = await loadUsers();
        
        // Check if user already exists
        if (users.find(u => u.username === username)) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create new user
        const newUser = {
            id: uuidv4(),
            username,
            password: hashedPassword,
            githubToken: githubToken || null,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        users.push(newUser);
        await saveUsers(users);


        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                username: newUser.username,
                createdAt: newUser.createdAt
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const users = await loadUsers();
        const user = users.find(u => u.username === username);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        user.lastLogin = new Date().toISOString();
        await saveUsers(users);

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );


        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                hasGithubToken: !!user.githubToken,
                lastLogin: user.lastLogin
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Update GitHub token
router.put('/github-token', authenticateToken, async (req, res) => {
    try {
        const { githubToken } = req.body;

        if (!githubToken) {
            return res.status(400).json({ error: 'GitHub token is required' });
        }

        const users = await loadUsers();
        const userIndex = users.findIndex(u => u.id === req.user.userId);

        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Validate GitHub token by making a test API call
        try {
            const axios = require('axios');
            const response = await axios.get('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            // Update user's GitHub token
            users[userIndex].githubToken = githubToken;
            users[userIndex].githubUser = {
                login: response.data.login,
                name: response.data.name,
                avatar_url: response.data.avatar_url,
                updatedAt: new Date().toISOString()
            };

            await saveUsers(users);


            res.json({
                message: 'GitHub token updated successfully',
                githubUser: users[userIndex].githubUser
            });

        } catch (githubError) {
            console.error('GitHub token validation failed:', githubError.response?.data || githubError.message);
            res.status(400).json({ error: 'Invalid GitHub token' });
        }

    } catch (error) {
        console.error('GitHub token update error:', error);
        res.status(500).json({ error: 'Failed to update GitHub token' });
    }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const users = await loadUsers();
        const user = users.find(u => u.id === req.user.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                username: user.username,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin,
                hasGithubToken: !!user.githubToken,
                githubUser: user.githubUser || null
            }
        });

    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Logout (client-side token removal, but we can log it)
router.post('/logout', authenticateToken, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

module.exports = { router, authenticateToken, loadUsers };
