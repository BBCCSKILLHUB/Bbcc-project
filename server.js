// ============================================
// BBCC SKILL HUB SERVER - COMPLETE
// ============================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bbcc_portal';

// ============================================
// SCHEMA DEFINITIONS
// ============================================

// Admin Schema
const AdminSchema = new mongoose.Schema({
    adminID: { type: String, required: true, unique: true },
    pws: { type: String, required: true },
    name: { type: String, default: 'Admin' },
    role: { type: String, default: 'admin' },
    photo: { type: String, default: '' },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Settings Schema - For all site settings
const SettingsSchema = new mongoose.Schema({
    // Header Settings
    logo: { type: String, default: '' },           // Base64
    title: { type: String, default: 'BBCC Skill Hub' },
    subTitle: { type: String, default: 'Empowering Skills, Building Futures' },
    
    // Footer Settings - Social Media
    whatsappNumber: { type: String, default: '' },
    whatsappChannelLink: { type: String, default: '' },
    youtubeChannelLink: { type: String, default: '' },
    facebookLink: { type: String, default: '' },
    instagramLink: { type: String, default: '' },
    telegramLink: { type: String, default: '' },
    twitterLink: { type: String, default: '' },
    linkedinLink: { type: String, default: '' },
    
    updatedAt: { type: Date, default: Date.now }
});

// Create Models
const Admin = mongoose.model('Admin', AdminSchema);
const Settings = mongoose.model('Settings', SettingsSchema);

// ============================================
// DATABASE CONNECTION
// ============================================
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ MongoDB Connected Successfully');
        
        // Check if admin exists, if not create default
        const adminExists = await Admin.findOne({ adminID: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await Admin.create({
                adminID: 'admin',
                pws: hashedPassword,
                name: 'Super Admin',
                role: 'super_admin'
            });
            console.log('✅ Default admin created: admin / admin123');
        }
        
        // Check if settings exist, if not create default
        const settingsExists = await Settings.findOne();
        if (!settingsExists) {
            await Settings.create({
                title: 'BBCC Skill Hub',
                subTitle: 'Empowering Skills, Building Futures'
            });
            console.log('✅ Default settings created');
        }
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
    });

// ============================================
// JWT MIDDLEWARE
// ============================================
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: "No token provided" });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bbcc_secret_2026');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: "Invalid token" });
    }
};

// ============================================
// AUTH APIs
// ============================================

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    const { adminID, password } = req.body;
    
    try {
        const admin = await Admin.findOne({ adminID, isActive: true });
        
        if (!admin) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        
        const isValid = await bcrypt.compare(password, admin.pws);
        if (!isValid) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        
        admin.lastLogin = new Date();
        await admin.save();
        
        const token = jwt.sign(
            { id: admin._id, adminID: admin.adminID, role: admin.role },
            process.env.JWT_SECRET || 'bbcc_secret_2026',
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            message: "Login successful",
            token,
            admin: {
                name: admin.name,
                adminID: admin.adminID,
                role: admin.role
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Verify Token
app.get('/api/admin/verify', verifyToken, async (req, res) => {
    try {
        const admin = await Admin.findOne({ adminID: req.user.adminID }).select('-pws');
        res.json({ success: true, admin });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// SETTINGS APIs
// ============================================

// Get Settings
app.get('/api/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({
                title: 'BBCC Skill Hub',
                subTitle: 'Empowering Skills, Building Futures'
            });
        }
        res.json({ success: true, data: settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Settings
app.put('/api/settings', verifyToken, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }
        
        const updates = req.body;
        
        // Update header
        if (updates.logo !== undefined) settings.logo = updates.logo;
        if (updates.title !== undefined) settings.title = updates.title;
        if (updates.subTitle !== undefined) settings.subTitle = updates.subTitle;
        
        // Update footer - social media
        const socialFields = [
            'whatsappNumber', 'whatsappChannelLink', 'youtubeChannelLink',
            'facebookLink', 'instagramLink', 'telegramLink', 'twitterLink', 'linkedinLink'
        ];
        
        for (const field of socialFields) {
            if (updates[field] !== undefined) {
                settings[field] = updates[field];
            }
        }
        
        settings.updatedAt = new Date();
        await settings.save();
        
        res.json({ 
            success: true, 
            message: "Settings updated successfully",
            data: settings
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// ============================================
// ADMIN PROFILE APIS - ADD THIS TO SERVER.JS
// ============================================

// Update Admin Profile (Name, Photo)
app.put('/api/admin/profile', verifyToken, async (req, res) => {
    try {
        const { name, photo } = req.body;
        const admin = await Admin.findOne({ adminID: req.user.adminID });
        
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }
        
        if (name) admin.name = name;
        if (photo !== undefined) admin.photo = photo;
        
        await admin.save();
        
        res.json({ 
            success: true, 
            message: "Profile updated successfully",
            admin: {
                name: admin.name,
                adminID: admin.adminID,
                photo: admin.photo,
                role: admin.role
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get Admin Profile
app.get('/api/admin/profile', verifyToken, async (req, res) => {
    try {
        const admin = await Admin.findOne({ adminID: req.user.adminID }).select('-pws');
        res.json({ success: true, admin });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Change Admin Password with Strength Check
app.put('/api/admin/change-password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        const admin = await Admin.findOne({ adminID: req.user.adminID });
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }
        
        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, admin.pws);
        if (!isValid) {
            return res.status(401).json({ success: false, message: "Current password is incorrect" });
        }
        
        // Check password strength
        if (newPassword.length < 4) {
            return res.status(400).json({ 
                success: false, 
                message: "Password must be at least 4 characters long" 
            });
        }
        
        // Hash and save new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        admin.pws = hashedPassword;
        await admin.save();
        
        res.json({ 
            success: true, 
            message: "Password changed successfully" 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Change Admin ID
app.put('/api/admin/change-id', verifyToken, async (req, res) => {
    try {
        const { newAdminID, password } = req.body;
        
        if (!newAdminID || newAdminID.length < 3) {
            return res.status(400).json({ 
                success: false, 
                message: "Admin ID must be at least 3 characters" 
            });
        }
        
        const admin = await Admin.findOne({ adminID: req.user.adminID });
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }
        
        // Verify password
        const isValid = await bcrypt.compare(password, admin.pws);
        if (!isValid) {
            return res.status(401).json({ success: false, message: "Password is incorrect" });
        }
        
        // Check if new ID already exists
        const existing = await Admin.findOne({ adminID: newAdminID });
        if (existing) {
            return res.status(400).json({ success: false, message: "Admin ID already exists" });
        }
        
        admin.adminID = newAdminID;
        await admin.save();
        
        res.json({ 
            success: true, 
            message: "Admin ID changed successfully. Please login again." 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// ============================================
// SERVE HTML PAGES
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/management', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'management.html'));
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n✅ BBCC Skill Hub Server Running!`);
    console.log(`🔗 http://localhost:${PORT}`);
    console.log(`🔑 Login: admin / admin123`);
    console.log(`📊 MongoDB: ${MONGO_URI}\n`);
});
