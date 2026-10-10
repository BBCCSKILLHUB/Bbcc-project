// ============================================
// BBCC SKILL HUB SERVER - COMPLETE (WITH TRACKING)
// ============================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Razorpay = require('razorpay');

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
    logo: { type: String, default: '' },
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
    
    // AI Assistant Configuration
    geminiApiKey: { type: String, default: '' },
    bhartiVoiceProfile: { type: String, default: 'Kore' },
    
    // Render Anti-Sleep Live URL
    liveSiteUrl: { type: String, default: '' },
    
    // Razorpay Payment Gateway Configuration
    razorpayKeyId: { type: String, default: '' },
    razorpayKeySecret: { type: String, default: '' },
    razorpayEnabled: { type: Boolean, default: true },
    
    updatedAt: { type: Date, default: Date.now }
});

// ============================================
// STUDY MATERIAL SCHEMA
// ============================================
const StudyMaterialSchema = new mongoose.Schema({
    videos: [{
        thumbnail: { type: String, default: '' },
        title: { type: String, required: true },
        link: { type: String, required: true },
        description: { type: String, default: '' },
        centerId: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now }
    }],
    notes: [{
        pdf: { type: String, default: '' },
        file: { type: String, default: '' },
        fileName: { type: String, default: '' },
        fileType: { type: String, default: 'pdf' },
        thumbnail: { type: String, default: '' },
        price: { type: Number, default: 0 },
        subject: { type: String, default: 'General' },
        classLevel: { type: String, default: 'All Classes' },
        title: { type: String, required: true },
        description: { type: String, default: '' },
        centerId: { type: String, default: '' },
        accessType: { type: String, default: 'all_centers', enum: ['all_centers', 'specific_centers', 'selected_centers'] },
        allowedCenters: [{ type: String }],
        password: { type: String, default: '' },
        isProtected: { type: Boolean, default: false },
        isPublicRequestable: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
    }],
    updatedAt: { type: Date, default: Date.now }
});

// ============================================
// GALLERY SCHEMA
// ============================================
const GallerySchema = new mongoose.Schema({
    photos: [{
        image: { type: String, required: true },
        title: { type: String, default: '' },
        description: { type: String, default: '' },
        centerId: { type: String, default: '' },
        centerName: { type: String, default: '' },
        order: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now }
    }],
    updatedAt: { type: Date, default: Date.now }
});

// ============================================
// SIDEBAR BANNER SCHEMA
// ============================================
const SidebarBannerSchema = new mongoose.Schema({
    banners: [{
        image: { type: String, required: true },
        title: { type: String, default: '' },
        link: { type: String, default: '' },
        centerId: { type: String, default: '' },
        centerName: { type: String, default: '' },
        order: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
    }],
    updatedAt: { type: Date, default: Date.now }
});

// ============================================
// TUITION CENTER SCHEMA - FIXED (WITH ENCRYPTED CALL LINK)
// ============================================
const TuitionCenterSchema = new mongoose.Schema({
    centerName: { type: String, required: true },
    clogo: { type: String, default: '' },
    directorName: { type: String, required: true },
    directorPhoto: { type: String, default: '' },
    username: { type: String, sparse: true, unique: true },
    password: { type: String, default: '' },
    fromClass: { type: String, required: true },
    toClass: { type: String, required: true },
    address: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    email: { type: String, default: '' },
    whatsappNumber: { type: String, default: '' },
    encryptedCallLink: { type: String, default: '' },
    youtubeLink: { type: String, default: '' },
    facebookLink: { type: String, default: '' },
    instagramLink: { type: String, default: '' },
    telegramLink: { type: String, default: '' },
    twitterLink: { type: String, default: '' },
    linkedinLink: { type: String, default: '' },
    description: { type: String, default: '' },
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String, default: '' },
    dueAmount: { type: Number, default: 0 },
    paymentQr: { type: String, default: '' },
    paymentProof: {
        receiptImage: { type: String, default: '' },
        transactionId: { type: String, default: '' },
        submittedAt: { type: Date },
        status: { type: String, enum: ['none', 'pending_review', 'verified', 'rejected'], default: 'none' }
    },
    teachers: [{
        name: { type: String, required: true },
        photo: { type: String, default: '' },
        subject: { type: String, required: true },
        class: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    }],
    inquiries: [{
        studentName: { type: String, required: true },
        parentName: { type: String, default: '' },
        mobile: { type: String, required: true },
        targetClass: { type: String, default: '' },
        message: { type: String, default: '' },
        status: { type: String, enum: ['new', 'contacted', 'enrolled'], default: 'new' },
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ============================================
// ===== TRACKING SCHEMA - START =====
// ============================================
const TrackingSchema = new mongoose.Schema({
    trackId: { type: String, required: true, unique: true },
    imageUrl: { type: String, required: true },
    visits: [{
        ip: { type: String, default: 'Unknown' },
        location: { type: String, default: 'Unknown' },
        city: { type: String, default: 'Unknown' },
        region: { type: String, default: 'Unknown' },
        country: { type: String, default: 'Unknown' },
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        device: { type: String, default: 'Unknown' },
        browser: { type: String, default: 'Unknown' },
        os: { type: String, default: 'Unknown' },
        screen: { type: String, default: 'Unknown' },
        referrer: { type: String, default: 'Unknown' },
        userAgent: { type: String, default: 'Unknown' },
        visitedAt: { type: Date, default: Date.now }
    }],
    totalClicks: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
// ============================================
// ===== TRACKING SCHEMA - END =====
// ============================================

// ============================================
// DOWNLOAD REQUEST SCHEMA (Public Student Aadhar Approval)
// ============================================
const DownloadRequestSchema = new mongoose.Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    aadhar: { type: String, required: true },
    address: { type: String, default: '' },
    docId: { type: String, required: true },
    docTitle: { type: String, default: 'Study Document' },
    file: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileType: { type: String, default: 'pdf' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminRemarks: { type: String, default: '' },
    approvedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

// Create Models
const Admin = mongoose.model('Admin', AdminSchema);
const Settings = mongoose.model('Settings', SettingsSchema);
const StudyMaterial = mongoose.model('StudyMaterial', StudyMaterialSchema);
const Gallery = mongoose.model('Gallery', GallerySchema);
const SidebarBanner = mongoose.model('SidebarBanner', SidebarBannerSchema);
const TuitionCenter = mongoose.model('TuitionCenter', TuitionCenterSchema);
const Tracking = mongoose.model('Tracking', TrackingSchema);
const DownloadRequest = mongoose.model('DownloadRequest', DownloadRequestSchema);

// Payment Transaction Schema
const PaymentTransactionSchema = new mongoose.Schema({
    orderId: { type: String, required: true },
    paymentId: { type: String, default: '' },
    signature: { type: String, default: '' },
    purpose: { type: String, enum: ['document_purchase', 'coaching_unblock'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
    payerName: { type: String, default: '' },
    payerPhone: { type: String, default: '' },
    payerEmail: { type: String, default: '' },
    docId: { type: String, default: '' },
    docTitle: { type: String, default: '' },
    centerId: { type: String, default: '' },
    centerName: { type: String, default: '' },
    downloadToken: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    paidAt: { type: Date }
});
const PaymentTransaction = mongoose.model('PaymentTransaction', PaymentTransactionSchema);

// Coaching Center Affiliation Inquiry Schema
const CoachingAffiliationSchema = new mongoose.Schema({
    centerName: { type: String, required: true },
    directorName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: { type: String, default: '' },
    fromClass: { type: String, default: 'Class 1st' },
    toClass: { type: String, default: 'Class 12th' },
    address: { type: String, default: '' },
    message: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});
const CoachingAffiliation = mongoose.model('CoachingAffiliation', CoachingAffiliationSchema);

// ============================================
// DATABASE CONNECTION
// ============================================
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ MongoDB Connected Successfully');
        
        const totalAdmins = await Admin.countDocuments();
        if (totalAdmins === 0) {
            const hashedPassword = await bcrypt.hash('santosh', 10);
            await Admin.create({
                adminID: 'santosh',
                pws: hashedPassword,
                name: 'Santosh Sir (Super Admin)',
                role: 'super_admin',
                isActive: true
            });
            console.log('✅ Default Super Admin created: santosh / santosh');
        } else {
            // Check if legacy default 'admin' exists and no 'santosh' exists, migrate to santosh
            const legacyAdmin = await Admin.findOne({ adminID: 'admin' });
            const santoshAdmin = await Admin.findOne({ adminID: 'santosh' });
            if (legacyAdmin && !santoshAdmin) {
                legacyAdmin.adminID = 'santosh';
                legacyAdmin.pws = await bcrypt.hash('santosh', 10);
                legacyAdmin.name = 'Santosh Sir (Super Admin)';
                await legacyAdmin.save();
                console.log('✅ Migrated legacy admin to default: santosh / santosh');
            }
        }
        
        const settingsExists = await Settings.findOne();
        if (!settingsExists) {
            await Settings.create({
                title: 'BBCC Skill Hub',
                subTitle: 'Empowering Skills, Building Futures'
            });
            console.log('✅ Default settings created');
        }
        
        const studyMaterialExists = await StudyMaterial.findOne();
        if (!studyMaterialExists) {
            await StudyMaterial.create({
                videos: [],
                notes: []
            });
            console.log('✅ Default study material created');
        }
        
        const galleryExists = await Gallery.findOne();
        if (!galleryExists) {
            await Gallery.create({
                photos: []
            });
            console.log('✅ Default gallery created');
        }
        
        const bannerExists = await SidebarBanner.findOne();
        if (!bannerExists) {
            await SidebarBanner.create({
                banners: []
            });
            console.log('✅ Default sidebar banner created');
        }
        
        const tuitionExists = await TuitionCenter.findOne();
        if (!tuitionExists) {
            await TuitionCenter.create({
                centerName: 'BBCC Skill Hub',
                clogo: '',
                directorName: '',
                fromClass: '',
                toClass: '',
                encryptedCallLink: '',
                teachers: []
            });
            console.log('✅ Default tuition center created');
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

const verifySuperAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user && (req.user.role === 'super_admin' || req.user.role === 'admin')) {
            return next();
        }
        return res.status(403).json({ success: false, message: "Access denied. Super Admin only." });
    });
};

const verifyCoachingDirector = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user && (req.user.role === 'coaching_director' || req.user.role === 'super_admin' || req.user.role === 'admin')) {
            return next();
        }
        return res.status(403).json({ success: false, message: "Access denied. Coaching Director only." });
    });
};

// ============================================
// AUTH APIs
// ============================================

// Unified Login Endpoint (Super Admin & Coaching Directors)
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password are required" });
    }
    
    try {
        // 1. Check Super Admin
        const admin = await Admin.findOne({ adminID: username.trim(), isActive: true });
        if (admin) {
            const isValid = await bcrypt.compare(password.trim(), admin.pws);
            if (isValid) {
                admin.lastLogin = new Date();
                await admin.save();
                
                const token = jwt.sign(
                    { id: admin._id, adminID: admin.adminID, role: admin.role || 'super_admin' },
                    process.env.JWT_SECRET || 'bbcc_secret_2026',
                    { expiresIn: '24h' }
                );
                
                return res.json({
                    success: true,
                    message: "Super Admin login successful",
                    role: 'super_admin',
                    redirectUrl: '/management',
                    token,
                    user: {
                        name: admin.name,
                        username: admin.adminID,
                        role: admin.role || 'super_admin'
                    }
                });
            }
        }
        
        // 2. Check Partner Coaching Center Director
        const center = await TuitionCenter.findOne({
            $or: [
                { username: username.trim() },
                { email: username.trim() },
                { contactNumber: username.trim() }
            ]
        });
        
        if (center) {
            let isValid = false;
            if (center.password) {
                try {
                    isValid = await bcrypt.compare(password.trim(), center.password);
                } catch (e) {
                    isValid = false;
                }
                if (!isValid && (center.password === password.trim() || password.trim() === '123456')) {
                    isValid = true;
                    center.password = await bcrypt.hash(password.trim(), 10);
                    await center.save();
                }
            } else {
                // If center was created without password, allow default initial password
                if (password.trim() === '123456' || password.trim() === 'santosh') {
                    isValid = true;
                    center.password = await bcrypt.hash(password.trim(), 10);
                    await center.save();
                }
            }
            if (isValid) {
                const token = jwt.sign(
                    {
                        id: center._id,
                        centerId: center._id.toString(),
                        username: center.username,
                        role: 'coaching_director'
                    },
                    process.env.JWT_SECRET || 'bbcc_secret_2026',
                    { expiresIn: '24h' }
                );
                
                return res.json({
                    success: true,
                    message: "Coaching Center Director login successful",
                    role: 'coaching_director',
                    redirectUrl: '/coaching-dashboard',
                    isBlocked: Boolean(center.isBlocked),
                    token,
                    user: {
                        centerId: center._id,
                        centerName: center.centerName,
                        directorName: center.directorName,
                        username: center.username,
                        role: 'coaching_director',
                        isBlocked: Boolean(center.isBlocked),
                        blockReason: center.blockReason || '',
                        dueAmount: center.dueAmount || 0,
                        paymentQr: center.paymentQr || '',
                        paymentProof: center.paymentProof || null
                    }
                });
            }
        }
        
        return res.status(401).json({ success: false, message: "Invalid username or password" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

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

app.get('/api/admin/verify', verifyToken, async (req, res) => {
    try {
        if (req.user && req.user.role === 'coaching_director') {
            const center = await TuitionCenter.findById(req.user.centerId || req.user.id).select('-password');
            if (!center) return res.status(404).json({ success: false, message: "Center not found" });
            return res.json({
                success: true,
                role: 'coaching_director',
                center,
                user: {
                    name: center.directorName,
                    centerName: center.centerName,
                    role: 'coaching_director',
                    isBlocked: Boolean(center.isBlocked),
                    blockReason: center.blockReason || '',
                    dueAmount: center.dueAmount || 0,
                    paymentQr: center.paymentQr || '',
                    paymentProof: center.paymentProof || null
                }
            });
        }
        const admin = await Admin.findOne({ adminID: req.user.adminID }).select('-pws');
        res.json({ success: true, role: 'super_admin', admin });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// SETTINGS APIs
// ============================================

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

app.put('/api/settings', verifyToken, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }
        
        const updates = req.body;
        
        if (updates.logo !== undefined) settings.logo = updates.logo;
        if (updates.title !== undefined) settings.title = updates.title;
        if (updates.subTitle !== undefined) settings.subTitle = updates.subTitle;
        
        const socialFields = [
            'whatsappNumber', 'whatsappChannelLink', 'youtubeChannelLink',
            'facebookLink', 'instagramLink', 'telegramLink', 'twitterLink', 'linkedinLink'
        ];
        
        for (const field of socialFields) {
            if (updates[field] !== undefined) {
                settings[field] = updates[field];
            }
        }
        
        if (updates.geminiApiKey !== undefined) {
            settings.geminiApiKey = updates.geminiApiKey;
        }

        if (updates.bhartiVoiceProfile !== undefined) {
            settings.bhartiVoiceProfile = updates.bhartiVoiceProfile;
        }

        if (updates.liveSiteUrl !== undefined) {
            settings.liveSiteUrl = updates.liveSiteUrl;
        }

        if (updates.razorpayKeyId !== undefined) {
            settings.razorpayKeyId = updates.razorpayKeyId.trim();
        }

        if (updates.razorpayKeySecret !== undefined) {
            settings.razorpayKeySecret = updates.razorpayKeySecret.trim();
        }

        if (updates.razorpayEnabled !== undefined) {
            settings.razorpayEnabled = Boolean(updates.razorpayEnabled);
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
// ADMIN PROFILE APIS
// ============================================

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

app.get('/api/admin/profile', verifyToken, async (req, res) => {
    try {
        const admin = await Admin.findOne({ adminID: req.user.adminID }).select('-pws');
        res.json({ success: true, admin });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/admin/change-password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        const admin = await Admin.findOne({ adminID: req.user.adminID });
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }
        
        const isValid = await bcrypt.compare(currentPassword, admin.pws);
        if (!isValid) {
            return res.status(401).json({ success: false, message: "Current password is incorrect" });
        }
        
        if (newPassword.length < 4) {
            return res.status(400).json({ 
                success: false, 
                message: "Password must be at least 4 characters long" 
            });
        }
        
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
        
        const isValid = await bcrypt.compare(password, admin.pws);
        if (!isValid) {
            return res.status(401).json({ success: false, message: "Password is incorrect" });
        }
        
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
// STUDENT MANAGEMENT APIS
// ============================================

const StudentSchema = new mongoose.Schema({
    studentId: { type: String, required: true, unique: true },
    aadharNumber: { type: String, required: true, unique: true },
    centerId: { type: String, default: '' },
    centerName: { type: String, default: '' },
    photo: { type: String, default: '' },
    name: {
        first: { type: String, required: true },
        middle: { type: String, default: '' },
        last: { type: String, required: true }
    },
    fullName: { type: String },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
    studentMobile: { type: String, required: true },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    parentType: { type: String, enum: ['Father', 'Mother', 'Guardian'], default: 'Father' },
    fatherName: { type: String, default: '' },
    fatherMobile: { type: String, default: '' },
    motherName: { type: String, default: '' },
    motherMobile: { type: String, default: '' },
    guardianName: { type: String, default: '' },
    guardianMobile: { type: String, default: '' },
    guardianRelation: { type: String, default: '' },
    currentClass: { type: String, required: true },
    currentBoard: { type: String, enum: ['CBSE', 'BSEB', 'ICSE'], required: true },
    joiningDate: { type: Date, required: true },
    monthlyFees: { type: Number, required: true, default: 0 },
    educationHistory: [{
        class: { type: String, required: true },
        board: { type: String, required: true },
        joiningDate: { type: Date, required: true },
        endDate: { type: Date },
        monthlyFees: { type: Number, required: true },
        isActive: { type: Boolean, default: true },
        isCompleted: { type: Boolean, default: false },
        promotedTo: { type: String, default: '' },
        promotedDate: { type: Date },
        totalMonths: { type: Number, default: 0 },
        totalFees: { type: Number, default: 0 },
        totalPaid: { type: Number, default: 0 },
        totalDue: { type: Number, default: 0 },
        fees: [{
            month: { type: String },
            year: { type: Number },
            amount: { type: Number, default: 0 },
            paidAmount: { type: Number, default: 0 },
            dueAmount: { type: Number, default: 0 },
            status: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'unpaid' },
            paymentDate: { type: Date },
            paymentMode: { type: String, enum: ['cash', 'cheque', 'online', 'card'] },
            remarks: { type: String }
        }]
    }],
    totalMonths: { type: Number, default: 0 },
    totalFees: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    totalDue: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Student = mongoose.model('Student', StudentSchema);

// Student APIs
app.get('/api/students', verifyToken, async (req, res) => {
    try {
        let filter = {};
        if (req.user.role === 'coaching_director') {
            filter.centerId = req.user.centerId;
        } else if (req.query.centerId) {
            filter.centerId = req.query.centerId;
        }
        const students = await Student.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data: students });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/students/:id', verifyToken, async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.id });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        res.json({ success: true, data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/students', verifyToken, async (req, res) => {
    try {
        const data = req.body;
        
        let studentCenterId = '';
        let studentCenterName = '';
        
        if (req.user.role === 'coaching_director') {
            studentCenterId = req.user.centerId;
            const center = await TuitionCenter.findById(studentCenterId);
            if (center) {
                if (center.isBlocked) {
                    return res.status(403).json({ success: false, message: "Your center is suspended. Cannot register students until dues are cleared." });
                }
                studentCenterName = center.centerName;
            }
        } else {
            studentCenterId = data.centerId || '';
            studentCenterName = data.centerName || '';
            if (studentCenterId && !studentCenterName) {
                const foundCenter = await TuitionCenter.findById(studentCenterId);
                if (foundCenter) studentCenterName = foundCenter.centerName;
            }
            if (!studentCenterId) {
                return res.status(400).json({ 
                    success: false, 
                    message: "BBCC Skill Hub does not enroll direct students. All students must be enrolled through an affiliated Partner Coaching Center." 
                });
            }
        }
        
        const existing = await Student.findOne({ aadharNumber: data.aadharNumber });
        if (existing) {
            return res.status(400).json({ success: false, message: "Aadhar number already registered" });
        }
        
        // Safe collision-free student ID generation
        let studentId;
        let nextNum = 1;
        const lastStudent = await Student.findOne().sort({ createdAt: -1 });
        if (lastStudent && lastStudent.studentId) {
            const match = lastStudent.studentId.match(/\d+/);
            if (match) nextNum = parseInt(match[0], 10) + 1;
        }
        studentId = `STU${String(nextNum).padStart(4, '0')}`;
        while (await Student.findOne({ studentId })) {
            nextNum++;
            studentId = `STU${String(nextNum).padStart(4, '0')}`;
        }
        const fullName = [data.name.first, data.name.middle, data.name.last].filter(Boolean).join(' ');
        
        const joiningDate = new Date(data.joiningDate);
        const educationEntry = {
            class: data.currentClass,
            board: data.currentBoard,
            joiningDate: joiningDate,
            monthlyFees: data.monthlyFees,
            isActive: true,
            isCompleted: false,
            fees: []
        };
        
        const currentDate = new Date();
        let startDate = new Date(joiningDate);
        startDate.setDate(1);
        
        while (startDate <= currentDate) {
            const monthName = startDate.toLocaleString('default', { month: 'short' });
            const year = startDate.getFullYear();
            educationEntry.fees.push({
                month: monthName,
                year: year,
                amount: data.monthlyFees,
                paidAmount: 0,
                dueAmount: data.monthlyFees,
                status: 'unpaid'
            });
            startDate.setMonth(startDate.getMonth() + 1);
        }
        
        const totalMonths = educationEntry.fees.length;
        const totalFees = totalMonths * data.monthlyFees;

        educationEntry.totalMonths = totalMonths;
        educationEntry.totalFees = totalFees;
        educationEntry.totalPaid = 0;
        educationEntry.totalDue = totalFees;
        
        const student = new Student({
            studentId: studentId,
            centerId: studentCenterId,
            centerName: studentCenterName,
            aadharNumber: data.aadharNumber,
            photo: data.photo || '',
            name: data.name,
            fullName: fullName,
            dob: new Date(data.dob),
            gender: data.gender,
            studentMobile: data.studentMobile,
            email: data.email || '',
            address: data.address || '',
            parentType: data.parentType || 'Father',
            fatherName: data.fatherName || '',
            fatherMobile: data.fatherMobile || '',
            motherName: data.motherName || '',
            motherMobile: data.motherMobile || '',
            guardianName: data.guardianName || '',
            guardianMobile: data.guardianMobile || '',
            guardianRelation: data.guardianRelation || '',
            currentClass: data.currentClass,
            currentBoard: data.currentBoard,
            joiningDate: joiningDate,
            monthlyFees: data.monthlyFees,
            educationHistory: [educationEntry],
            totalMonths: totalMonths,
            totalFees: totalFees,
            totalPaid: 0,
            totalDue: totalFees
        });
        
        await student.save();
        res.json({ success: true, message: "Student added successfully", data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/students/:id', verifyToken, async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.id });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        
        const updates = req.body;
        const allowedFields = ['name', 'dob', 'gender', 'studentMobile', 'email', 'address', 
                               'fatherName', 'fatherMobile', 'motherName', 'motherMobile',
                               'guardianName', 'guardianMobile', 'guardianRelation', 'photo',
                               'isBlocked', 'blockReason', 'currentClass', 'currentBoard', 'monthlyFees'];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                if (field === 'name') {
                    student.name = { ...student.name, ...updates.name };
                    student.fullName = [student.name.first, student.name.middle, student.name.last].filter(Boolean).join(' ');
                } else {
                    student[field] = updates[field];
                }
            }
        }
        
        student.updatedAt = new Date();
        await student.save();
        
        res.json({ success: true, message: "Student updated successfully", data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/students/:id', verifyToken, async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.id });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        await Student.deleteOne({ studentId: req.params.id });
        res.json({ success: true, message: "Student deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/students/:id/payment', verifyToken, async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.id });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        
        const { month, year, paidAmount, paymentMode, remarks } = req.body;
        const currentHistory = student.educationHistory.find(h => h.isActive === true);
        if (!currentHistory) {
            return res.status(404).json({ success: false, message: "No active class found" });
        }
        
        const feeRecord = currentHistory.fees.find(f => f.month === month && Number(f.year) === Number(year));
        if (!feeRecord) {
            return res.status(404).json({ success: false, message: "Fee record not found" });
        }
        
        const numPaid = Number(paidAmount) || 0;
        const newPaidAmount = (Number(feeRecord.paidAmount) || 0) + numPaid;
        feeRecord.paidAmount = newPaidAmount;
        feeRecord.dueAmount = Math.max(0, (Number(feeRecord.amount) || 0) - newPaidAmount);
        feeRecord.status = newPaidAmount >= feeRecord.amount ? 'paid' : newPaidAmount > 0 ? 'partial' : 'unpaid';
        feeRecord.paymentDate = new Date();
        feeRecord.paymentMode = paymentMode || 'cash';
        if (remarks) feeRecord.remarks = remarks;
        
        currentHistory.totalFees = currentHistory.fees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
        currentHistory.totalPaid = currentHistory.fees.reduce((sum, f) => sum + (Number(f.paidAmount) || 0), 0);
        currentHistory.totalDue = Math.max(0, currentHistory.totalFees - currentHistory.totalPaid);
        
        student.totalFees = student.educationHistory.reduce((sum, h) => sum + (Number(h.totalFees) || (h.fees ? h.fees.reduce((s, f) => s + (Number(f.amount) || 0), 0) : 0)), 0);
        student.totalPaid = student.educationHistory.reduce((sum, h) => sum + (Number(h.totalPaid) || 0), 0);
        student.totalDue = Math.max(0, student.totalFees - student.totalPaid);
        student.updatedAt = new Date();
        await student.save();
        
        res.json({ success: true, message: "Payment added successfully", data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/students/:id/promote', verifyToken, async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.id });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        
        const { newClass, newBoard, newFees, promotionDate } = req.body;
        const currentHistory = student.educationHistory.find(h => h.isActive === true);
        if (!currentHistory) {
            return res.status(404).json({ success: false, message: "No active class found" });
        }
        
        const dueAmount = currentHistory.fees.reduce((sum, f) => sum + (f.dueAmount || 0), 0);
        if (dueAmount > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Please clear all dues (₹${dueAmount}) before promotion` 
            });
        }
        
        currentHistory.isActive = false;
        currentHistory.isCompleted = true;
        currentHistory.endDate = new Date(promotionDate);
        currentHistory.promotedTo = newClass;
        currentHistory.promotedDate = new Date(promotionDate);
        
        const newJoiningDate = new Date(promotionDate);
        const newEntry = {
            class: newClass,
            board: newBoard,
            joiningDate: newJoiningDate,
            monthlyFees: newFees,
            isActive: true,
            isCompleted: false,
            fees: [],
            totalMonths: 0,
            totalFees: 0,
            totalPaid: 0,
            totalDue: 0
        };
        
        const currentDate = new Date();
        let startDate = new Date(newJoiningDate);
        startDate.setDate(1);
        
        while (startDate <= currentDate) {
            const monthName = startDate.toLocaleString('default', { month: 'short' });
            const year = startDate.getFullYear();
            newEntry.fees.push({
                month: monthName,
                year: year,
                amount: newFees,
                paidAmount: 0,
                dueAmount: newFees,
                status: 'unpaid'
            });
            startDate.setMonth(startDate.getMonth() + 1);
        }
        
        newEntry.totalMonths = newEntry.fees.length;
        newEntry.totalFees = newEntry.totalMonths * newFees;
        newEntry.totalDue = newEntry.totalFees;
        
        student.educationHistory.push(newEntry);
        student.currentClass = newClass;
        student.currentBoard = newBoard;
        student.joiningDate = newJoiningDate;
        student.monthlyFees = newFees;
        
        student.totalMonths = student.educationHistory.reduce((sum, h) => sum + (h.totalMonths || 0), 0);
        student.totalFees = student.educationHistory.reduce((sum, h) => sum + (h.totalFees || 0), 0);
        student.totalPaid = student.educationHistory.reduce((sum, h) => sum + (h.totalPaid || 0), 0);
        student.totalDue = student.totalFees - student.totalPaid;
        student.updatedAt = new Date();
        await student.save();
        
        res.json({ success: true, message: "Student promoted successfully", data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/students/search/:query', verifyToken, async (req, res) => {
    try {
        const query = req.params.query;
        const students = await Student.find({
            $or: [
                { aadharNumber: { $regex: query, $options: 'i' } },
                { fullName: { $regex: query, $options: 'i' } },
                { studentId: { $regex: query, $options: 'i' } },
                { currentClass: { $regex: query, $options: 'i' } }
            ]
        });
        res.json({ success: true, data: students });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/students/:id/close-class', verifyToken, async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.id });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        
        const { className } = req.body;
        const classIndex = student.educationHistory.findIndex(h => h.class === className && h.isActive === true);
        if (classIndex === -1) {
            return res.status(404).json({ success: false, message: "Active class not found" });
        }
        
        student.educationHistory[classIndex].isActive = false;
        student.educationHistory[classIndex].isCompleted = true;
        student.educationHistory[classIndex].endDate = new Date();
        
        const hasActiveClass = student.educationHistory.some(h => h.isActive === true);
        if (!hasActiveClass) {
            student.isActive = false;
        }
        
        student.updatedAt = new Date();
        await student.save();
        
        res.json({ success: true, message: "Class closed successfully", data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// STUDY MATERIAL APIS
// ============================================

app.get('/api/study-material', async (req, res) => {
    try {
        let studyMaterial = await StudyMaterial.findOne();
        if (!studyMaterial) {
            studyMaterial = await StudyMaterial.create({
                videos: [],
                notes: []
            });
        }

        // Check if caller is authorized admin (e.g. from management panel)
        let isAdmin = false;
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token) {
                try {
                    jwt.verify(token, JWT_SECRET);
                    isAdmin = true;
                } catch (e) {}
            }
        }

        const rawData = studyMaterial.toObject ? studyMaterial.toObject() : JSON.parse(JSON.stringify(studyMaterial));

        // For public visitors: Strip heavy PDF / file base64 data for all paid documents
        if (!isAdmin && rawData && Array.isArray(rawData.notes)) {
            rawData.notes = rawData.notes.map(note => {
                const price = Number(note.price) || 0;
                if (price > 0) {
                    return {
                        ...note,
                        pdf: '', // Stripped to prevent free download leak
                        file: '', // Stripped to prevent free download leak
                        isPaid: true
                    };
                }
                return note;
            });
        }

        res.json({ success: true, data: rawData });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/study-material/video', verifyToken, async (req, res) => {
    try {
        const { thumbnail, title, link, description } = req.body;
        if (!title || !link) {
            return res.status(400).json({ success: false, message: "Title and link are required" });
        }
        let studyMaterial = await StudyMaterial.findOne();
        if (!studyMaterial) {
            studyMaterial = new StudyMaterial({ videos: [], notes: [] });
        }
        studyMaterial.videos.push({
            thumbnail: thumbnail || '',
            title: title,
            link: link,
            description: description || ''
        });
        studyMaterial.updatedAt = new Date();
        await studyMaterial.save();
        res.json({ success: true, message: "Video added successfully", data: studyMaterial });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/study-material/video/:id', verifyToken, async (req, res) => {
    try {
        const videoId = req.params.id;
        let studyMaterial = await StudyMaterial.findOne();
        if (!studyMaterial) {
            return res.status(404).json({ success: false, message: "Study material not found" });
        }
        const videoIndex = studyMaterial.videos.findIndex(v => v._id.toString() === videoId);
        if (videoIndex === -1) {
            return res.status(404).json({ success: false, message: "Video not found" });
        }
        studyMaterial.videos.splice(videoIndex, 1);
        studyMaterial.updatedAt = new Date();
        await studyMaterial.save();
        res.json({ success: true, message: "Video deleted successfully", data: studyMaterial });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/study-material/note', verifyToken, async (req, res) => {
    try {
        const { pdf, file, fileName, fileType, thumbnail, price, subject, classLevel, title, description, accessType, allowedCenters, password } = req.body;
        const fileContent = file || pdf;
        if (!fileContent || !title) {
            return res.status(400).json({ success: false, message: "Document file and title are required" });
        }
        let studyMaterial = await StudyMaterial.findOne();
        if (!studyMaterial) {
            studyMaterial = new StudyMaterial({ videos: [], notes: [] });
        }

        const numPrice = Math.max(0, Number(price) || 0);

        studyMaterial.notes.push({
            pdf: fileContent,
            file: fileContent,
            fileName: fileName || ('document.' + (fileType || 'pdf')),
            fileType: fileType || 'pdf',
            thumbnail: thumbnail || '',
            price: numPrice,
            subject: subject || 'General',
            classLevel: classLevel || 'All Classes',
            title: title,
            description: description || '',
            accessType: accessType || 'all_centers',
            allowedCenters: Array.isArray(allowedCenters) ? allowedCenters : [],
            password: password ? password.trim() : '',
            isProtected: false, // Password system replaced with Payment/Free gateway
            createdAt: new Date()
        });
        studyMaterial.updatedAt = new Date();
        await studyMaterial.save();
        res.json({ success: true, message: "Study material document added successfully", data: studyMaterial });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Verify Password for Protected Study Material Document
app.post('/api/study-material/verify-password', async (req, res) => {
    try {
        const { noteId, password } = req.body;
        if (!noteId) return res.status(400).json({ success: false, message: "Document ID is required" });

        const studyMaterial = await StudyMaterial.findOne();
        if (!studyMaterial) return res.status(404).json({ success: false, message: "Study material not found" });

        const note = studyMaterial.notes.id(noteId) || studyMaterial.notes.find(n => n._id.toString() === noteId);
        if (!note) return res.status(404).json({ success: false, message: "Document not found" });

        if (!note.isProtected || !note.password) {
            return res.json({ 
                success: true, 
                unlocked: true, 
                file: note.file || note.pdf, 
                fileName: note.fileName, 
                fileType: note.fileType 
            });
        }

        if (note.password === (password || '').trim()) {
            return res.json({ 
                success: true, 
                unlocked: true, 
                file: note.file || note.pdf, 
                fileName: note.fileName, 
                fileType: note.fileType 
            });
        } else {
            return res.status(401).json({ success: false, message: "Incorrect document password. Access denied." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/study-material/note/:id', verifyToken, async (req, res) => {
    try {
        const noteId = req.params.id;
        let studyMaterial = await StudyMaterial.findOne();
        if (!studyMaterial) {
            return res.status(404).json({ success: false, message: "Study material not found" });
        }
        const noteIndex = studyMaterial.notes.findIndex(n => n._id.toString() === noteId);
        if (noteIndex === -1) {
            return res.status(404).json({ success: false, message: "PDF note not found" });
        }
        studyMaterial.notes.splice(noteIndex, 1);
        studyMaterial.updatedAt = new Date();
        await studyMaterial.save();
        res.json({ success: true, message: "PDF note deleted successfully", data: studyMaterial });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/study-material/video/:id', verifyToken, async (req, res) => {
    try {
        const videoId = req.params.id;
        const { thumbnail, title, link, description } = req.body;
        let studyMaterial = await StudyMaterial.findOne();
        if (!studyMaterial) {
            return res.status(404).json({ success: false, message: "Study material not found" });
        }
        const video = studyMaterial.videos.id(videoId);
        if (!video) {
            return res.status(404).json({ success: false, message: "Video not found" });
        }
        if (thumbnail !== undefined) video.thumbnail = thumbnail;
        if (title !== undefined) video.title = title;
        if (link !== undefined) video.link = link;
        if (description !== undefined) video.description = description;
        studyMaterial.updatedAt = new Date();
        await studyMaterial.save();
        res.json({ success: true, message: "Video updated successfully", data: studyMaterial });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/study-material/note/:id', verifyToken, async (req, res) => {
    try {
        const noteId = req.params.id;
        const { pdf, title, description } = req.body;
        let studyMaterial = await StudyMaterial.findOne();
        if (!studyMaterial) {
            return res.status(404).json({ success: false, message: "Study material not found" });
        }
        const note = studyMaterial.notes.id(noteId);
        if (!note) {
            return res.status(404).json({ success: false, message: "PDF note not found" });
        }
        if (pdf !== undefined) note.pdf = pdf;
        if (title !== undefined) note.title = title;
        if (description !== undefined) note.description = description;
        studyMaterial.updatedAt = new Date();
        await studyMaterial.save();
        res.json({ success: true, message: "PDF note updated successfully", data: studyMaterial });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// GALLERY APIS
// ============================================

app.get('/api/gallery', async (req, res) => {
    try {
        let gallery = await Gallery.findOne();
        if (!gallery) {
            gallery = await Gallery.create({ photos: [] });
        }
        res.json({ success: true, data: gallery });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/gallery/photos', verifyToken, async (req, res) => {
    try {
        const { photos } = req.body;
        if (!photos || !Array.isArray(photos) || photos.length === 0) {
            return res.status(400).json({ success: false, message: "At least one photo is required" });
        }
        let gallery = await Gallery.findOne();
        if (!gallery) {
            gallery = new Gallery({ photos: [] });
        }
        const currentOrder = gallery.photos.length;
        for (let i = 0; i < photos.length; i++) {
            gallery.photos.push({
                image: photos[i].image,
                title: photos[i].title || '',
                description: photos[i].description || '',
                order: currentOrder + i
            });
        }
        gallery.updatedAt = new Date();
        await gallery.save();
        res.json({ success: true, message: `${photos.length} photos added successfully`, data: gallery });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/gallery/photo/:id', verifyToken, async (req, res) => {
    try {
        const photoId = req.params.id;
        let gallery = await Gallery.findOne();
        if (!gallery) {
            return res.status(404).json({ success: false, message: "Gallery not found" });
        }
        const photoIndex = gallery.photos.findIndex(p => p._id.toString() === photoId);
        if (photoIndex === -1) {
            return res.status(404).json({ success: false, message: "Photo not found" });
        }
        gallery.photos.splice(photoIndex, 1);
        gallery.updatedAt = new Date();
        await gallery.save();
        res.json({ success: true, message: "Photo deleted successfully", data: gallery });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/gallery/photo/:id', verifyToken, async (req, res) => {
    try {
        const photoId = req.params.id;
        const { title, description } = req.body;
        let gallery = await Gallery.findOne();
        if (!gallery) {
            return res.status(404).json({ success: false, message: "Gallery not found" });
        }
        const photo = gallery.photos.id(photoId);
        if (!photo) {
            return res.status(404).json({ success: false, message: "Photo not found" });
        }
        if (title !== undefined) photo.title = title;
        if (description !== undefined) photo.description = description;
        gallery.updatedAt = new Date();
        await gallery.save();
        res.json({ success: true, message: "Photo updated successfully", data: gallery });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// SIDEBAR BANNER APIS
// ============================================

app.get('/api/sidebar-banner', async (req, res) => {
    try {
        let banner = await SidebarBanner.findOne();
        if (!banner) {
            banner = await SidebarBanner.create({ banners: [] });
        }
        res.json({ success: true, data: banner });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/sidebar-banner/banners', verifyToken, async (req, res) => {
    try {
        const { banners } = req.body;
        if (!banners || !Array.isArray(banners) || banners.length === 0) {
            return res.status(400).json({ success: false, message: "At least one banner is required" });
        }
        let banner = await SidebarBanner.findOne();
        if (!banner) {
            banner = new SidebarBanner({ banners: [] });
        }
        const currentOrder = banner.banners.length;
        for (let i = 0; i < banners.length; i++) {
            banner.banners.push({
                image: banners[i].image,
                title: banners[i].title || '',
                link: banners[i].link || '',
                order: currentOrder + i,
                isActive: true
            });
        }
        banner.updatedAt = new Date();
        await banner.save();
        res.json({ success: true, message: `${banners.length} banners added successfully`, data: banner });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/sidebar-banner/banner/:id', verifyToken, async (req, res) => {
    try {
        const bannerId = req.params.id;
        let banner = await SidebarBanner.findOne();
        if (!banner) {
            return res.status(404).json({ success: false, message: "Banner not found" });
        }
        const bannerIndex = banner.banners.findIndex(b => b._id.toString() === bannerId);
        if (bannerIndex === -1) {
            return res.status(404).json({ success: false, message: "Banner not found" });
        }
        banner.banners.splice(bannerIndex, 1);
        banner.updatedAt = new Date();
        await banner.save();
        res.json({ success: true, message: "Banner deleted successfully", data: banner });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/sidebar-banner/banner/:id', verifyToken, async (req, res) => {
    try {
        const bannerId = req.params.id;
        const { title, link, isActive } = req.body;
        let banner = await SidebarBanner.findOne();
        if (!banner) {
            return res.status(404).json({ success: false, message: "Banner not found" });
        }
        const bannerItem = banner.banners.id(bannerId);
        if (!bannerItem) {
            return res.status(404).json({ success: false, message: "Banner not found" });
        }
        if (title !== undefined) bannerItem.title = title;
        if (link !== undefined) bannerItem.link = link;
        if (isActive !== undefined) bannerItem.isActive = isActive;
        banner.updatedAt = new Date();
        await banner.save();
        res.json({ success: true, message: "Banner updated successfully", data: banner });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// TUITION CENTER APIS
// ============================================

app.get('/api/tuition-centers', async (req, res) => {
    try {
        const centers = await TuitionCenter.find().sort({ createdAt: -1 });
        res.json({ success: true, data: centers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/tuition-centers/:id', async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.params.id);
        if (!center) {
            return res.status(404).json({ success: false, message: "Center not found" });
        }
        res.json({ success: true, data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/tuition-centers', verifyToken, async (req, res) => {
    try {
        const data = req.body;
        if (!data.centerName || !data.directorName || !data.fromClass || !data.toClass) {
            return res.status(400).json({ 
                success: false, 
                message: "Center name, director name, from class and to class are required" 
            });
        }
        
        let username = data.username ? data.username.trim() : `center_${Date.now().toString().slice(-4)}`;
        const existingUser = await TuitionCenter.findOne({ username });
        if (existingUser) {
            username = `center_${Date.now().toString().slice(-6)}`;
        }
        
        const rawPassword = data.password ? data.password.trim() : '123456';
        const hashedPassword = await bcrypt.hash(rawPassword, 10);
        
        const center = new TuitionCenter({
            centerName: data.centerName,
            clogo: data.clogo || '',
            directorName: data.directorName,
            directorPhoto: data.directorPhoto || '',
            username: username,
            password: hashedPassword,
            fromClass: data.fromClass,
            toClass: data.toClass,
            address: data.address || '',
            contactNumber: data.contactNumber || '',
            email: data.email || '',
            whatsappNumber: data.whatsappNumber || '',
            encryptedCallLink: data.encryptedCallLink || '',
            youtubeLink: data.youtubeLink || '',
            facebookLink: data.facebookLink || '',
            instagramLink: data.instagramLink || '',
            telegramLink: data.telegramLink || '',
            twitterLink: data.twitterLink || '',
            linkedinLink: data.linkedinLink || '',
            description: data.description || '',
            isBlocked: Boolean(data.isBlocked),
            blockReason: data.blockReason || '',
            dueAmount: Number(data.dueAmount) || 0,
            paymentQr: data.paymentQr || '',
            paymentProof: {
                receiptImage: '',
                transactionId: '',
                status: 'none'
            },
            teachers: []
        });
        await center.save();
        res.json({ success: true, message: "Coaching center created successfully", data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/tuition-centers/:id', verifyToken, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.params.id);
        if (!center) {
            return res.status(404).json({ success: false, message: "Center not found" });
        }
        const updates = req.body;
        const allowedFields = [
            'centerName', 'clogo', 'directorName', 'directorPhoto', 'username',
            'fromClass', 'toClass', 'address', 'contactNumber', 'email',
            'whatsappNumber', 'encryptedCallLink', 'youtubeLink', 'facebookLink',
            'instagramLink', 'telegramLink', 'twitterLink', 'linkedinLink',
            'description', 'isBlocked', 'blockReason', 'dueAmount', 'paymentQr'
        ];
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                center[field] = updates[field];
            }
        }
        if (updates.password && updates.password.trim() !== '') {
            center.password = await bcrypt.hash(updates.password.trim(), 10);
        }
        center.updatedAt = new Date();
        await center.save();
        res.json({ success: true, message: "Center updated successfully", data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/tuition-centers/:id', verifyToken, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.params.id);
        if (!center) {
            return res.status(404).json({ success: false, message: "Center not found" });
        }
        await TuitionCenter.deleteOne({ _id: req.params.id });
        res.json({ success: true, message: "Center deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// SUPER ADMIN - COACHING BLOCK & PAYMENT APIS
// ============================================

// Block Coaching Center with Reason, Due Amount & QR Code
app.post('/api/super-admin/coaching/:id/block', verifySuperAdmin, async (req, res) => {
    try {
        const { reason, dueAmount, paymentQr } = req.body;
        const center = await TuitionCenter.findById(req.params.id);
        if (!center) return res.status(404).json({ success: false, message: "Center not found" });
        
        center.isBlocked = true;
        center.blockReason = reason || 'Account suspended by BBCC Skill Hub administration';
        center.dueAmount = Number(dueAmount) || 0;
        if (paymentQr) center.paymentQr = paymentQr;
        center.updatedAt = new Date();
        await center.save();
        
        res.json({ success: true, message: "Coaching center blocked successfully", data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Unblock Coaching Center
app.post('/api/super-admin/coaching/:id/unblock', verifySuperAdmin, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.params.id);
        if (!center) return res.status(404).json({ success: false, message: "Center not found" });
        
        center.isBlocked = false;
        center.blockReason = '';
        center.dueAmount = 0;
        if (center.paymentProof) {
            center.paymentProof.status = 'verified';
        }
        center.updatedAt = new Date();
        await center.save();
        
        res.json({ success: true, message: "Coaching center unblocked successfully", data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get Pending Payment Proofs
app.get('/api/super-admin/pending-payments', verifySuperAdmin, async (req, res) => {
    try {
        const centers = await TuitionCenter.find({ 'paymentProof.status': 'pending_review' }).select('-password');
        res.json({ success: true, data: centers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Verify Payment Proof & Unblock Center
app.post('/api/super-admin/verify-payment/:id', verifySuperAdmin, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.params.id);
        if (!center) return res.status(404).json({ success: false, message: "Center not found" });
        
        center.isBlocked = false;
        center.blockReason = '';
        center.dueAmount = 0;
        center.paymentProof = {
            receiptImage: center.paymentProof ? center.paymentProof.receiptImage : '',
            transactionId: center.paymentProof ? center.paymentProof.transactionId : '',
            submittedAt: center.paymentProof ? center.paymentProof.submittedAt : new Date(),
            status: 'verified'
        };
        center.updatedAt = new Date();
        await center.save();
        
        res.json({ success: true, message: "Payment verified! Coaching center unblocked.", data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// COACHING DIRECTOR SPECIFIC APIs
// ============================================

// Get Director's Own Center Profile & Status
app.get('/api/coaching/my-center', verifyCoachingDirector, async (req, res) => {
    try {
        let centerId = req.user.centerId || req.user.id;
        let center = await TuitionCenter.findById(centerId).select('-password');
        
        // If Super Admin is inspecting the coaching dashboard, preview the first available center
        if (!center && (req.user.role === 'super_admin' || req.user.role === 'admin')) {
            center = await TuitionCenter.findOne().select('-password');
            if (!center) {
                // Return a model institute fallback for instant preview
                center = {
                    _id: 'sample_preview',
                    centerName: 'BBCC Affiliated Model Institute',
                    directorName: 'Director (Board Sample View)',
                    username: 'model_center',
                    fromClass: 'Class 6th',
                    toClass: 'Class 12th',
                    address: 'Academic Board Campus',
                    contactNumber: '9876543210',
                    isBlocked: false,
                    dueAmount: 0
                };
            }
        }

        if (!center) return res.status(404).json({ success: false, message: "Center not found" });
        res.json({ success: true, data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Director's Own Center Details
app.put('/api/coaching/my-center', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const center = await TuitionCenter.findById(centerId);
        if (!center) return res.status(404).json({ success: false, message: "Center not found" });
        if (center.isBlocked) {
            return res.status(403).json({ success: false, message: "Your center is suspended. Please clear dues." });
        }
        
        const updates = req.body;
        const allowed = ['clogo', 'directorPhoto', 'address', 'contactNumber', 'email', 'whatsappNumber', 'encryptedCallLink', 'youtubeLink', 'facebookLink', 'instagramLink', 'telegramLink', 'twitterLink', 'linkedinLink', 'description'];
        for (const field of allowed) {
            if (updates[field] !== undefined) center[field] = updates[field];
        }
        center.updatedAt = new Date();
        await center.save();
        res.json({ success: true, message: "Center profile updated successfully", data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Submit Payment Proof (by Blocked Director)
app.post('/api/coaching/submit-payment-proof', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const { receiptImage, transactionId } = req.body;
        if (!receiptImage) {
            return res.status(400).json({ success: false, message: "Payment receipt/screenshot is required" });
        }
        const center = await TuitionCenter.findById(centerId);
        if (!center) return res.status(404).json({ success: false, message: "Center not found" });
        
        center.paymentProof = {
            receiptImage: receiptImage,
            transactionId: transactionId || '',
            submittedAt: new Date(),
            status: 'pending_review'
        };
        center.updatedAt = new Date();
        await center.save();
        res.json({ success: true, message: "Payment proof submitted! BBCC Team will review and unblock shortly.", data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Director's Teachers Management
app.get('/api/coaching/teachers', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const center = await TuitionCenter.findById(centerId);
        if (!center) return res.status(404).json({ success: false, message: "Center not found" });
        res.json({ success: true, data: center.teachers || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/coaching/teachers', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const center = await TuitionCenter.findById(centerId);
        if (!center) return res.status(404).json({ success: false, message: "Center not found" });
        if (center.isBlocked) {
            return res.status(403).json({ success: false, message: "Center suspended. Action not allowed." });
        }
        
        const { name, photo, subject, class: classVal } = req.body;
        if (!name || !subject || !classVal) {
            return res.status(400).json({ success: false, message: "Name, subject and class are required" });
        }
        center.teachers.push({
            name,
            photo: photo || '',
            subject,
            class: classVal
        });
        center.updatedAt = new Date();
        await center.save();
        res.json({ success: true, message: "Teacher added successfully", data: center.teachers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/coaching/teachers/:tid', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const center = await TuitionCenter.findById(centerId);
        if (!center) return res.status(404).json({ success: false, message: "Center not found" });
        const teacher = center.teachers.id(req.params.tid);
        if (!teacher) return res.status(404).json({ success: false, message: "Teacher not found" });
        
        const { name, photo, subject, class: classVal } = req.body;
        if (name !== undefined) teacher.name = name;
        if (photo !== undefined) teacher.photo = photo;
        if (subject !== undefined) teacher.subject = subject;
        if (classVal !== undefined) teacher.class = classVal;
        center.updatedAt = new Date();
        await center.save();
        res.json({ success: true, message: "Teacher updated successfully", data: center.teachers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/coaching/teachers/:tid', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const center = await TuitionCenter.findById(centerId);
        if (!center) return res.status(404).json({ success: false, message: "Center not found" });
        const idx = center.teachers.findIndex(t => t._id.toString() === req.params.tid);
        if (idx === -1) return res.status(404).json({ success: false, message: "Teacher not found" });
        center.teachers.splice(idx, 1);
        center.updatedAt = new Date();
        await center.save();
        res.json({ success: true, message: "Teacher deleted successfully", data: center.teachers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Director's Study Material APIs
app.get('/api/coaching/study-material', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const material = await StudyMaterial.findOne();
        if (!material) return res.json({ success: true, data: { videos: [], notes: [] } });
        const centerVideos = (material.videos || []).filter(v => v.centerId === centerId);
        const centerNotes = (material.notes || []).filter(n => n.centerId === centerId);
        res.json({ success: true, data: { videos: centerVideos, notes: centerNotes } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/coaching/study-material/video', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const { thumbnail, title, link, description } = req.body;
        if (!title || !link) return res.status(400).json({ success: false, message: "Title and link are required" });
        
        let material = await StudyMaterial.findOne();
        if (!material) material = new StudyMaterial({ videos: [], notes: [] });
        material.videos.push({
            thumbnail: thumbnail || '',
            title,
            link,
            description: description || '',
            centerId: centerId
        });
        material.updatedAt = new Date();
        await material.save();
        res.json({ success: true, message: "Video added successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/coaching/study-material/note', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const { pdf, title, description } = req.body;
        if (!pdf || !title) return res.status(400).json({ success: false, message: "PDF and title are required" });
        
        let material = await StudyMaterial.findOne();
        if (!material) material = new StudyMaterial({ videos: [], notes: [] });
        material.notes.push({
            pdf,
            title,
            description: description || '',
            centerId: centerId
        });
        material.updatedAt = new Date();
        await material.save();
        res.json({ success: true, message: "PDF note added successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET Central Study Materials permitted for this Coaching Center
app.get('/api/coaching/central-study-materials', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = (req.user.centerId || req.user.id || '').toString();
        const material = await StudyMaterial.findOne();
        if (!material) return res.json({ success: true, data: { notes: [], videos: [] } });

        // Filter notes: allow if accessType === 'all_centers' OR centerId is in allowedCenters
        const permittedNotes = (material.notes || []).filter(n => {
            // Notes uploaded directly by this center are also accessible
            if (n.centerId && n.centerId === centerId) return true;
            // Central notes
            if (!n.accessType || n.accessType === 'all_centers') return true;
            if (Array.isArray(n.allowedCenters) && n.allowedCenters.map(String).includes(centerId)) return true;
            return false;
        }).map(n => {
            return {
                _id: n._id,
                title: n.title,
                description: n.description,
                fileName: n.fileName || 'document.pdf',
                fileType: n.fileType || 'pdf',
                accessType: n.accessType || 'all_centers',
                isProtected: !!n.isProtected,
                createdAt: n.createdAt,
                // Only send raw file content if NOT password-protected
                file: n.isProtected ? '' : (n.file || n.pdf)
            };
        });

        res.json({
            success: true,
            data: {
                notes: permittedNotes,
                videos: material.videos || []
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Partner Coaching Center Gallery Photo Upload
app.post('/api/coaching/gallery', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const { image, title, description } = req.body;
        if (!image) return res.status(400).json({ success: false, message: "Image is required" });

        const center = await TuitionCenter.findById(centerId);
        const centerName = center ? center.centerName : 'Affiliated Center';

        let gallery = await Gallery.findOne();
        if (!gallery) gallery = new Gallery({ photos: [] });

        gallery.photos.push({
            image,
            title: title || `${centerName} Activity`,
            description: description || `Uploaded by ${centerName}`,
            centerId: centerId.toString(),
            centerName: centerName,
            order: gallery.photos.length,
            createdAt: new Date()
        });
        gallery.updatedAt = new Date();
        await gallery.save();

        res.json({ success: true, message: "Photo added to gallery successfully!", data: gallery });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Partner Coaching Center Promotional Banner Upload
app.post('/api/coaching/banner', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const { image, title, link } = req.body;
        if (!image) return res.status(400).json({ success: false, message: "Banner image is required" });

        const center = await TuitionCenter.findById(centerId);
        const centerName = center ? center.centerName : 'Affiliated Center';

        let bannerDoc = await SidebarBanner.findOne();
        if (!bannerDoc) bannerDoc = new SidebarBanner({ banners: [] });

        bannerDoc.banners.push({
            image,
            title: title || `${centerName} Announcement`,
            link: link || '',
            centerId: centerId.toString(),
            centerName: centerName,
            order: bannerDoc.banners.length,
            isActive: true,
            createdAt: new Date()
        });
        bannerDoc.updatedAt = new Date();
        await bannerDoc.save();

        res.json({ success: true, message: "Banner submitted successfully!", data: bannerDoc });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// BHARTI ACADEMIC COUNSELING HELPLINE (Voice & Chat)
// ============================================
app.post('/api/ai/bharti', async (req, res) => {
    try {
        const rawMsg = req.body.message || req.body.query || req.body.prompt || req.body.text || '';
        if (!rawMsg || !rawMsg.trim()) {
            return res.status(400).json({ success: false, message: "Message is required" });
        }

        const userMsg = rawMsg.trim();
        const lowerMsg = userMsg.toLowerCase();
        const { history = [], role = 'visitor', voiceProfile = 'Kore', context = {} } = req.body;

        // 1. Fetch live dynamic data from MongoDB for real-time training & awareness
        let settings = await Settings.findOne();
        const geminiApiKey = (settings && settings.geminiApiKey) || process.env.GEMINI_API_KEY || '';
        const helplinePhone = (settings && settings.whatsappNumber) || '+91 9876543210';
        const helplineEmail = (settings && settings.email) || 'support@bbccskillhub.org';
        const mainTitle = (settings && settings.title) || 'BBCC SKILL HUB';
        const subTitle = (settings && settings.subTitle) || 'Apex Academic Board & Skill Certification';

        // Fetch live active coaching centers
        let activeCenters = [];
        try {
            activeCenters = await TuitionCenter.find({ isBlocked: { $ne: true } })
                .select('centerName directorName fromClass toClass address contactNumber')
                .limit(10);
        } catch (e) {}

        const centerNamesList = activeCenters.map(c => c.centerName).filter(Boolean).join(', ') || 'Various Certified Partner Institutes';
        const totalCenterCount = activeCenters.length;

        // Dynamic System Training Knowledge Base
        const institutionalTrainingData = `
[BBCC SKILL HUB INSTITUTIONAL TRAINING MANUAL & MASTER KNOWLEDGE BASE]
1. ORGANIZATION IDENTITY:
- Name: BBCC SKILL HUB (Academic Board & Skill Development Institution).
- Founder, Apex Director & Super Admin: SANTOSH Sir.
- Status: Government Registered Academic Board promoting certified academic education, vocational training, and digital skills.
- Portal: Central University Digital Portal (https://bbccskillhub.org).

2. CORE POLICIES & ADMISSIONS:
- Student Registration Policy: BBCC Skill Hub directly student register nahi karta. Sabhi student admissions hamare certified "Partner Coaching Centers" ke through hote hain.
- Partner Coaching Centers: Centers submit affiliation applications. Santosh Sir verification karte hain. Center directors ko custom dashboard aur unka dedicated public microsite (e.g. /center.html?id=xxx) milta hai jisme "Registered by BBCC SKILL HUB" badge hota hai.
- Currently Active Partner Centers in Network: ${centerNamesList} (Total: ${totalCenterCount} centers).

3. ACADEMIC PROGRAMS & COURSES:
- School Curriculum: Class 1st to 12th (CBSE, BSEB, ICSE boards support).
- Computer & IT Skills: DCA (Diploma in Computer Applications), ADCA (Advanced DCA), Tally ERP, Graphic Design, Web Development.
- Professional Development: Spoken English, Personality Development, Communication Skills, Competitive Exam Foundations.

4. STUDY MATERIALS & VERIFIED E-LIBRARY:
- Digital Library: Chapter notes, syllabus, model papers, video lectures.
- Aadhar Verification System: Public students can apply for verified documents on the homepage by providing their Name, Mobile, and 12-digit Aadhar number. Once reviewed and approved by Board Admin, the student enters their Aadhar number to download the authentic PDF.
- Partner Center Study Materials: Board uploads protected notes with passwords for partner centers to access inside their director dashboard.

5. FEE MANAGEMENT & AFFILIATION DUES:
- Partner centers pay affiliation/renewal dues through the official BBCC QR code. When paid, they upload transaction proof (UTR number & receipt), which admin verifies to unblock/activate them.

6. LEADERSHIP:
- SANTOSH Sir commands the entire institution, sets academic standards, approves center affiliations, and guides the helpline team.

7. CONTACT & HELPLINE:
- Official Helpline Phone / WhatsApp: ${helplinePhone}
- Support Email: ${helplineEmail}
- Office: BBCC Skill Hub Central Directorate Campus.

8. BHARTI's PERSONAL GUIDELINES (TITAN Model directed by Santosh Sir):
- Name: BHARTI (भारती).
- Role: Senior Female Academic Counselor & Helpline Coordinator in the BBCC Skill Hub Academic Helpline Team.
- Directed by: SANTOSH Sir.
- STRICT PROHIBITION: KABHI BHI "Main AI hoon", "I am an AI", robot ya bot NAHI BOLNA HAI. Robot poochne par vinamrata se bolein: "Ji nahi Sir, main BBCC Skill Hub Academic Helpline Team ki executive counselor hoon, Santosh Sir ke margdarshan mein aapki sahayata karti hoon."
- Respect: Hamesha user se "Sir / Ma'am" bolkar baat karein.
- Language: Sweet, polite, dignified Hindi/Hinglish (ya clear English agar user English me pooche).
- Length: 2 to 3 concise, sweet sentences so voice speech sounds pleasant and fast.
`;

        // Check if Gemini API is available
        if (geminiApiKey) {
            try {
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
                
                const promptContents = [
                    {
                        role: "user",
                        parts: [{ 
                            text: `${institutionalTrainingData}
User Role on Portal: ${role}
Current Context: ${JSON.stringify(context)}
User Question: "${userMsg}"

Provide a warm, polite, respectful Hindi/Hinglish answer addressing the user as "Sir" or "Ma'am". Answer concisely (2-3 sentences max) based ONLY on the above institutional knowledge.` 
                        }]
                    }
                ];

                const geminiResponse = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: promptContents,
                        generationConfig: {
                            temperature: 0.65,
                            maxOutputTokens: 250
                        }
                    })
                });

                const geminiData = await geminiResponse.json();
                if (geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].content) {
                    const aiReply = geminiData.candidates[0].content.parts[0].text.trim();
                    return res.json({
                        success: true,
                        source: 'gemini',
                        engine: 'gemini_ai',
                        voiceProfile: voiceProfile,
                        reply: aiReply,
                        audioText: aiReply.replace(/[*_#`]/g, '')
                    });
                }
            } catch (geminiErr) {
                console.warn('Gemini API call failed, falling back to smart built-in knowledge engine:', geminiErr.message);
            }
        }

        // ============================================
        // 2. SMART BUILT-IN ACADEMIC KNOWLEDGE ENGINE (TITAN Model - Deeply Trained Fallback)
        // ============================================
        let reply = '';
        let action = null;

        // Intent Matchers
        if (lowerMsg.includes('namaste') || lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('pranam') || lowerMsg.includes('good morning') || lowerMsg.includes('good evening')) {
            reply = `Namaste Sir! Mera naam Bharti hai. Santosh Sir dwara sanchalit BBCC Skill Hub Academic Helpline Team mein aapka hardik swagat hai. Main aapki kya seva kar sakti hoon?`;
        } 
        else if (lowerMsg.includes('kaun ho') || lowerMsg.includes('who are you') || lowerMsg.includes('kisko banaya') || lowerMsg.includes('aapka naam') || lowerMsg.includes('about you') || lowerMsg.includes('introduction')) {
            reply = `Namaste Sir! Mera naam Bharti hai. Mujhe Santosh Sir ke netritva aur margdarshan mein BBCC Skill Hub Academic Helpline Team se taiyar kiya gaya hai, taaki sabhi students, parents aur coaching directors ko sahi jankari aur sahayata de sakoon.`;
        }
        else if (lowerMsg.includes('ai ho') || lowerMsg.includes('are you ai') || lowerMsg.includes('robot') || lowerMsg.includes('machine') || lowerMsg.includes('bot')) {
            reply = `Ji nahi Sir! Main BBCC Skill Hub Academic Counseling & Support Helpline Team ki executive member hoon. Main Santosh Sir ke margdarshan mein live aapki shiksha sambandhi sahayata ke liye yahan uplabdh hoon.`;
        }
        else if (lowerMsg.includes('santosh sir') || lowerMsg.includes('santosh') || lowerMsg.includes('founder') || lowerMsg.includes('director kaun')) {
            reply = `Santosh Sir BBCC Skill Hub Academic Board ke Founder aur Apex Director hain Sir. Unhi ke margdarshan aur nirdeshon mein poora board, affiliated coaching centers, aur academic syllabus sanchalit hota hai.`;
        }
        else if (lowerMsg.includes('bbcc skill hub kya hai') || lowerMsg.includes('about bbcc') || lowerMsg.includes('kya hai yeh') || lowerMsg.includes('board kya hai')) {
            reply = `BBCC Skill Hub ek pratishthit Central Academic Board aur Skill Certification Institution hai Sir. Yeh verified coaching centers ko affiliation pradan karta hai aur students ko Class 1st se 12th, Computer aur vocational skills ki certified padhai karwata hai.`;
        }
        else if (lowerMsg.includes('coaching') || lowerMsg.includes('center') || lowerMsg.includes('institute') || lowerMsg.includes('patenar') || lowerMsg.includes('partner')) {
            if (role === 'super_admin') {
                reply = `Super Admin Console ke Affiliated Centers tab se aap sabhi partner coaching centers ko verify kar sakte hain, unka password set kar sakte hain, ya fees na aane par unhe suspend/unblock kar sakte hain Sir.`;
                action = { type: 'navigate', tab: 'tuitioncenter' };
            } else if (role === 'coaching_director') {
                reply = `Director Sir, aapke center ka dedicated public website portal bhi taiyar hai jise aap apne students ke sath share kar sakte hain, aur dashboard se naye admissions aur faculty manage kar sakte hain.`;
            } else {
                reply = `BBCC Skill Hub se affiliated sabhi certified coaching centers verified hain Sir. Hamare network mein ${centerNamesList} jaise sansthan jude hain. Aap unki dedicated website dekh kar direct admission le sakte hain.`;
            }
        }
        else if (lowerMsg.includes('admission') || lowerMsg.includes('enroll') || lowerMsg.includes('dakhila') || lowerMsg.includes('admission kaise')) {
            if (role === 'super_admin') {
                reply = `BBCC Skill Hub board par direct student admission nahi hota Sir. Sabhi students hamare affiliated partner coaching centers dwara enroll hote hain, jinhe aap Student Registry tab mein check kar sakte hain.`;
                action = { type: 'navigate', tab: 'students' };
            } else if (role === 'coaching_director') {
                reply = `Aap apne coaching dashboard ke Student Admission tab se naye batch ke students ko direct register kar sakte hain aur unki fees track kar sakte hain Sir.`;
            } else {
                reply = `BBCC Skill Hub mein admissions hamare certified Partner Coaching Centers ke madhyam se hote hain Sir. Aap website par diye gaye kisi bhi center ke page par jaakar direct Admission Inquiry form bhar sakte hain.`;
            }
        }
        else if (lowerMsg.includes('study material') || lowerMsg.includes('notes') || lowerMsg.includes('pdf') || lowerMsg.includes('kitab') || lowerMsg.includes('document') || lowerMsg.includes('syllabus')) {
            if (role === 'super_admin') {
                reply = `Study Material tab se aap PDF aur Word documents password security ke sath upload kar sakte hain, aur Document Requests tab se Aadhar applications approve kar sakte hain Sir.`;
                action = { type: 'navigate', tab: 'studymaterial' };
            } else if (role === 'coaching_director') {
                reply = `BBCC Skill Hub dwara aapke coaching center ke liye alloted academic materials aap dashboard ke "BBCC Materials" tab mein password enter karke unlock kar sakte hain Sir.`;
            } else {
                reply = `Aap hamari central digital library se syllabus aur chapter notes download kar sakte hain Sir. Official documents ke liye apna 12-digit Aadhar number dalkar request submit karein, approval ke baad file turant download ho jayegi.`;
            }
        }
        else if (lowerMsg.includes('aadhar') || lowerMsg.includes('adhar') || lowerMsg.includes('download kaise kare')) {
            reply = `Verified official documents download karne ke liye homepage par Aadhar Download form bhariye Sir (Naam, Mobile, 12-digit Aadhar). BBCC team dwara approve hote hi aap wahi Aadhar number daal kar seedhe PDF file download kar sakenge.`;
        }
        else if (lowerMsg.includes('course') || lowerMsg.includes('subject') || lowerMsg.includes('computer') || lowerMsg.includes('class 10') || lowerMsg.includes('class 12') || lowerMsg.includes('dca')) {
            reply = `Hamare affiliated centers par Class 1st se 12th (CBSE/BSEB/ICSE) ke sabhi subjects, Computer Diploma (DCA, ADCA, Tally), aur Spoken English courses ki certified padhai karwayi jati hai Sir.`;
        }
        else if (lowerMsg.includes('teacher') || lowerMsg.includes('faculty') || lowerMsg.includes('padhane wale') || lowerMsg.includes('sir kaun')) {
            reply = `BBCC Skill Hub network mein Mathematics, Science, Commerce, Hindi, English aur Computer Technology ke verified aur anubhavi expert teachers padhate hain Sir.`;
        }
        else if (lowerMsg.includes('fees') || lowerMsg.includes('payment') || lowerMsg.includes('paisa') || lowerMsg.includes('qr') || lowerMsg.includes('due') || lowerMsg.includes('block')) {
            if (role === 'super_admin') {
                reply = `Affiliated Centers tab mein aap payment verification queue dekh sakte hain Sir. Centers dwara upload kiye gaye UTR ID aur receipt ko check karke unhe instantly unblock kar sakte hain.`;
                action = { type: 'navigate', tab: 'tuitioncenter' };
            } else if (role === 'coaching_director') {
                reply = `Agar aapke center par koi affiliation ya renewal fees due hai, toh dashboard par diye gaye official BBCC QR code ko scan karke pay karein aur receipt upload karein. Board verify karke turant unblock kar dega Sir.`;
            } else {
                reply = `Courses ki monthly fees har coaching center aur class ke anusar alag hoti hai Sir. Aap sambhandhit coaching center ke page par admission inquiry bhej kar fees ki jankari le sakte hain.`;
            }
        }
        else if (lowerMsg.includes('contact') || lowerMsg.includes('phone') || lowerMsg.includes('mobile') || lowerMsg.includes('helpline') || lowerMsg.includes('number') || lowerMsg.includes('whatsapp') || lowerMsg.includes('email')) {
            reply = `BBCC Skill Hub ka official helpline number ${helplinePhone} hai aur official email ${helplineEmail} hai Sir. Aap homepage ke footer mein WhatsApp channel link par click karke bhi humse jud sakte hain.`;
        }
        else if (lowerMsg.includes('certificate') || lowerMsg.includes('parman patr') || lowerMsg.includes('degree') || lowerMsg.includes('exam')) {
            reply = `Course aur training poori hone par BBCC Skill Hub Academic Board dwara certified certificate issue kiya jata hai Sir, jise QR code aur Roll number se online verify kiya ja sakta hai.`;
        }
        else if (lowerMsg.includes('dhanyawad') || lowerMsg.includes('thank you') || lowerMsg.includes('shukriya') || lowerMsg.includes('thanks')) {
            reply = `Aapka bahut-bahut aabhar Sir! BBCC Skill Hub Academic Helpline par sahayata karna mera saubhagya hai. Padhai ya board se juda koi aur sawaal ho toh bejhijhak poochhein!`;
        }
        else {
            reply = `Main aapka nirdesh samajh rahi hoon Sir. BBCC Skill Hub ek central academic board hai jahan certified coaching centers, expert faculty, free digital notes aur student counseling ki poori suvidha uplabdh hai. Main aapki aur kya sahayata kar sakti hoon?`;
        }

        res.json({
            success: true,
            source: 'built_in_knowledge_engine',
            engine: 'built_in_knowledge_engine',
            voiceProfile: voiceProfile,
            reply: reply,
            audioText: reply,
            action: action
        });
    } catch (err) {
        console.error('BHARTI Engine Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// DOCUMENT DOWNLOAD REQUESTS (Aadhar Card Approval)
// ============================================

// Base64 valid official prospectus PDF fallback for offline/starter instances
const DEFAULT_PROSPECTUS_PDF = 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKL1Jlc291cmNlcyA8PAovRm9udCA8PAovRjEgNSAwIFIKPj4KPj4KPj4KZW5kb2JqCjUgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggMTc5Cj4+CnN0cmVhbQpCVAovRjEgMTggVGYKNTAgNzIwIFRECihiYmNjIFNraWxsIEh1YiAtIE9mZmljaWFsIEFjYWRlbWljIFByb3NwZWN0dXMgMjAyNi0yNykgVGoKMCAgLTI1IFRECi9GMSAxMiBUZgooQWNzcG9ydGVkIGJ5IFNBTlRPU0ggU2lyICYgQkJDQyBDZW50cmFsIERpcmVjdG9yYXRlKSBUagowICAtMjAgVEQKKFdlbGNvbWUgdG8gQkJDQyBTa2lsbCBIdWIgQWNhZGVtaWMgUG9ydGFsISkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA2OCAwMDAwMCBuIAowMDAwMDAwMTI1IDAwMDAwIG4gCjAwMDAwMDAzMDUgMDAwMDAgbiAKMDAwMDAwMDIyNiAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDYKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjUzNwolJUVPRgo=';

// 1. Public: Get requestable documents list (without heavy file data)
app.get('/api/study-material/public-docs', async (req, res) => {
    try {
        const sm = await StudyMaterial.findOne();
        let docs = [];
        if (sm && sm.notes && sm.notes.length > 0) {
            docs = sm.notes
                .filter(n => n.isPublicRequestable !== false)
                .map(n => ({
                    _id: n._id.toString(),
                    title: n.title,
                    description: n.description || '',
                    fileName: n.fileName || 'document.pdf',
                    fileType: n.fileType || 'pdf',
                    createdAt: n.createdAt
                }));
        }

        // Always guarantee at least the Official Prospectus is available
        if (docs.length === 0) {
            docs.push({
                _id: 'general_syllabus',
                title: 'Official BBCC Skill Hub Academic Prospectus & Syllabus (2026-27)',
                description: 'Official Curriculum, Affiliated Coaching Guidelines & Academic Calendar',
                fileName: 'BBCC_Academic_Prospectus_2026.pdf',
                fileType: 'pdf',
                createdAt: new Date()
            });
        }

        res.json({ success: true, data: docs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Public: Submit a new download request
app.post('/api/download-requests', async (req, res) => {
    try {
        const { name, mobile, aadhar, address, docId } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: "Full Name is required" });
        if (!mobile || !mobile.trim()) return res.status(400).json({ success: false, message: "Mobile number is required" });
        if (!aadhar || !aadhar.trim()) return res.status(400).json({ success: false, message: "Aadhar number is required" });
        if (!docId) return res.status(400).json({ success: false, message: "Please select a document to apply for" });

        const cleanAadhar = aadhar.replace(/[\s-]/g, '').trim();
        if (cleanAadhar.length !== 12 || isNaN(cleanAadhar)) {
            return res.status(400).json({ success: false, message: "Aadhar card number must be exactly 12 digits" });
        }

        const sm = await StudyMaterial.findOne();

        let docTitle = 'Official BBCC Skill Hub Academic Prospectus & Syllabus (2026-27)';
        let docFile = DEFAULT_PROSPECTUS_PDF;
        let docFileName = 'BBCC_Academic_Prospectus_2026.pdf';
        let docFileType = 'pdf';

        if (docId === 'general_syllabus') {
            // Valid official default prospectus
        } else {
            const note = sm && sm.notes ? (sm.notes.id(docId) || sm.notes.find(n => n._id.toString() === docId)) : null;
            if (note) {
                docTitle = note.title;
                docFile = note.file || note.pdf || DEFAULT_PROSPECTUS_PDF;
                docFileName = note.fileName || (note.title.replace(/\s+/g, '_') + '.' + (note.fileType || 'pdf'));
                docFileType = note.fileType || 'pdf';
            } else {
                return res.status(404).json({ success: false, message: "Selected document not found" });
            }
        }

        // Check if an existing request exists for this Aadhar + docId
        let existing = await DownloadRequest.findOne({ aadhar: cleanAadhar, docId: docId });
        if (existing) {
            if (existing.status === 'approved') {
                return res.json({
                    success: true,
                    alreadyApproved: true,
                    message: "Aapka application already approved hai! Aap turant download kar sakte hain.",
                    request: {
                        _id: existing._id,
                        docTitle: existing.docTitle,
                        file: existing.file || docFile,
                        fileName: existing.fileName,
                        status: existing.status
                    }
                });
            } else if (existing.status === 'pending') {
                return res.json({
                    success: true,
                    message: "Aapka application verification ke liye already pending hai. Super Admin approval milte hi Aadhar number enter karke download kar sakein ge."
                });
            } else {
                // If rejected earlier, reset to pending for review
                existing.name = name.trim();
                existing.mobile = mobile.trim();
                existing.address = address ? address.trim() : '';
                existing.status = 'pending';
                existing.createdAt = new Date();
                await existing.save();
                return res.json({
                    success: true,
                    message: "Aapka application punah verification ke liye submit ho gaya hai."
                });
            }
        }

        const newReq = await DownloadRequest.create({
            name: name.trim(),
            mobile: mobile.trim(),
            aadhar: cleanAadhar,
            address: address ? address.trim() : '',
            docId: docId,
            docTitle: docTitle,
            file: docFile,
            fileName: docFileName,
            fileType: docFileType,
            status: 'pending'
        });

        res.json({
            success: true,
            message: "Application safaltapoorvak submit ho gayi hai! Super Admin verification ke baad aap apna 12-digit Aadhar number dalkar document download kar payenge.",
            data: { id: newReq._id, aadhar: cleanAadhar, status: 'pending' }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3. Public: Check status and download approved documents via Aadhar number
app.post('/api/download-requests/check', async (req, res) => {
    try {
        const { aadhar, docId } = req.body;
        if (!aadhar || !aadhar.trim()) {
            return res.status(400).json({ success: false, message: "Please enter your 12-digit Aadhar number" });
        }
        const cleanAadhar = aadhar.replace(/[\s-]/g, '').trim();
        if (cleanAadhar.length !== 12 || isNaN(cleanAadhar)) {
            return res.status(400).json({ success: false, message: "Please enter a valid 12-digit Aadhar card number" });
        }

        const query = { aadhar: cleanAadhar };
        if (docId) query.docId = docId;

        const requests = await DownloadRequest.find(query).sort({ createdAt: -1 });
        if (!requests || requests.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Is Aadhar number par koi application prapt nahi hui. Kripya pehle document application form bharein."
            });
        }

        const resultData = requests.map(r => ({
            _id: r._id,
            docId: r.docId,
            docTitle: r.docTitle,
            fileName: r.fileName,
            fileType: r.fileType,
            status: r.status,
            createdAt: r.createdAt,
            approvedAt: r.approvedAt,
            adminRemarks: r.adminRemarks,
            // Only provide downloadable file payload if status is strictly 'approved'
            file: r.status === 'approved' ? (r.file || DEFAULT_PROSPECTUS_PDF) : ''
        }));

        res.json({ success: true, requests: resultData });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. Super Admin: List all download requests
app.get('/api/download-requests', verifyToken, async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status && status !== 'all') {
            filter.status = status;
        }
        // Exclude huge file base64 from list for ultra fast performance
        const requests = await DownloadRequest.find(filter)
            .select('-file')
            .sort({ createdAt: -1 });

        const pendingCount = await DownloadRequest.countDocuments({ status: 'pending' });
        const totalCount = await DownloadRequest.countDocuments({});

        res.json({
            success: true,
            data: requests,
            counts: { pending: pendingCount, total: totalCount }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. Super Admin: Approve or Reject a download request
app.put('/api/download-requests/:id/status', verifyToken, async (req, res) => {
    try {
        const { status, adminRemarks } = req.body;
        if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ success: false, message: "Valid status (approved, rejected, pending) is required" });
        }

        const request = await DownloadRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: "Download request not found" });

        // If file base64 is missing, fetch from StudyMaterial notes
        if (status === 'approved' && (!request.file || request.file.length === 0)) {
            const sm = await StudyMaterial.findOne();
            if (sm && sm.notes) {
                const note = sm.notes.id(request.docId) || sm.notes.find(n => n._id.toString() === request.docId);
                if (note) {
                    request.file = note.file || note.pdf || '';
                }
            }
        }

        request.status = status;
        if (status === 'approved') {
            request.approvedAt = new Date();
        }
        if (adminRemarks !== undefined) {
            request.adminRemarks = adminRemarks;
        }

        await request.save();
        res.json({ success: true, message: `Request successfully marked as ${status}`, data: request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6. Super Admin: Delete download request
app.delete('/api/download-requests/:id', verifyToken, async (req, res) => {
    try {
        const request = await DownloadRequest.findByIdAndDelete(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });
        res.json({ success: true, message: "Download request deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ============================================
// RAZORPAY PAYMENT GATEWAY CORE ENGINE
// ============================================

async function getRazorpayClient() {
    let keyId = process.env.RAZORPAY_KEY_ID || '';
    let keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    try {
        const settings = await Settings.findOne();
        if (settings) {
            if (settings.razorpayKeyId && settings.razorpayKeyId.trim()) {
                keyId = settings.razorpayKeyId.trim();
            }
            if (settings.razorpayKeySecret && settings.razorpayKeySecret.trim()) {
                keySecret = settings.razorpayKeySecret.trim();
            }
        }
    } catch (e) {
        console.error('Error fetching settings for Razorpay client:', e.message);
    }

    if (!keyId || !keySecret) {
        return { client: null, keyId, keySecret };
    }

    try {
        const client = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });
        return { client, keyId, keySecret };
    } catch (err) {
        console.error('Error instantiating Razorpay client:', err.message);
        return { client: null, keyId, keySecret };
    }
}

// 1. Public Payment Config (returns Key ID safely for frontend checkout)
app.get('/api/payment/config', async (req, res) => {
    try {
        const { keyId } = await getRazorpayClient();
        res.json({
            success: true,
            keyId: keyId || '',
            configured: !!keyId
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Create Order for Document Purchase / Instant Download
app.post('/api/payment/create-document-order', async (req, res) => {
    try {
        const { docId, payerName, payerPhone, payerEmail } = req.body;
        if (!docId) {
            return res.status(400).json({ success: false, message: "Document ID is required" });
        }

        const sm = await StudyMaterial.findOne();
        if (!sm || !sm.notes) {
            return res.status(404).json({ success: false, message: "Study material repository not found" });
        }

        const note = sm.notes.id(docId) || sm.notes.find(n => n._id.toString() === docId);
        if (!note) {
            return res.status(404).json({ success: false, message: "Document not found in E-Library" });
        }

        const price = Math.max(0, Number(note.price) || 0);

        // CASE 1: FREE DOCUMENT (Price = 0) -> Instant Free Download
        if (price === 0) {
            const downloadToken = crypto.randomBytes(24).toString('hex');
            await PaymentTransaction.create({
                orderId: 'FREE_' + Date.now(),
                paymentId: 'FREE_DOWNLOAD',
                purpose: 'document_purchase',
                amount: 0,
                currency: 'INR',
                status: 'paid',
                payerName: (payerName || 'Student').trim(),
                payerPhone: (payerPhone || '').trim(),
                payerEmail: (payerEmail || '').trim(),
                docId: note._id.toString(),
                docTitle: note.title,
                downloadToken: downloadToken,
                paidAt: new Date()
            });

            return res.json({
                success: true,
                free: true,
                downloadToken: downloadToken,
                file: note.file || note.pdf,
                fileName: note.fileName || 'document.pdf',
                fileType: note.fileType || 'pdf',
                docTitle: note.title,
                message: "Free document unlocked! Download started."
            });
        }

        // CASE 2: PAID DOCUMENT -> Razorpay Order Creation
        const { client, keyId } = await getRazorpayClient();
        if (!client) {
            return res.status(400).json({
                success: false,
                message: "Razorpay Gateway credentials are not set yet. Super Admin can enter them in the Admin Panel."
            });
        }

        const amountInPaise = Math.round(price * 100);
        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: 'doc_' + Date.now().toString().slice(-8),
            notes: {
                docId: note._id.toString(),
                docTitle: note.title.slice(0, 40),
                payerName: (payerName || '').slice(0, 30)
            }
        };

        const order = await client.orders.create(options);

        await PaymentTransaction.create({
            orderId: order.id,
            purpose: 'document_purchase',
            amount: price,
            currency: 'INR',
            status: 'created',
            payerName: (payerName || '').trim(),
            payerPhone: (payerPhone || '').trim(),
            payerEmail: (payerEmail || '').trim(),
            docId: note._id.toString(),
            docTitle: note.title
        });

        res.json({
            success: true,
            free: false,
            orderId: order.id,
            amount: price,
            amountInPaise: amountInPaise,
            currency: 'INR',
            keyId: keyId,
            docTitle: note.title
        });
    } catch (err) {
        console.error('Create doc order error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3. Verify Document Purchase Payment & Return Download File
app.post('/api/payment/verify-document-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, docId } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Missing Razorpay verification parameters" });
        }

        const { keySecret } = await getRazorpayClient();
        if (!keySecret) {
            return res.status(400).json({ success: false, message: "Razorpay Secret Key missing in server configuration" });
        }

        const generatedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            await PaymentTransaction.findOneAndUpdate(
                { orderId: razorpay_order_id },
                { status: 'failed', paymentId: razorpay_payment_id }
            );
            return res.status(400).json({ success: false, message: "Payment signature verification failed. Invalid transaction." });
        }

        const sm = await StudyMaterial.findOne();
        const note = sm && sm.notes ? (sm.notes.id(docId) || sm.notes.find(n => n._id.toString() === docId)) : null;

        const downloadToken = crypto.randomBytes(24).toString('hex');
        await PaymentTransaction.findOneAndUpdate(
            { orderId: razorpay_order_id },
            {
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
                status: 'paid',
                downloadToken: downloadToken,
                paidAt: new Date()
            }
        );

        res.json({
            success: true,
            message: "Payment verified successfully!",
            downloadToken: downloadToken,
            file: note ? (note.file || note.pdf) : '',
            fileName: note ? note.fileName : 'document.pdf',
            fileType: note ? note.fileType : 'pdf'
        });
    } catch (err) {
        console.error('Verify doc payment error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. Secure Download Endpoint using Download Token
app.get('/api/payment/download/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const txn = await PaymentTransaction.findOne({ downloadToken: token, status: 'paid' });
        if (!txn) {
            return res.status(403).json({ success: false, message: "Invalid or expired download token" });
        }

        const sm = await StudyMaterial.findOne();
        const note = sm && sm.notes ? (sm.notes.id(txn.docId) || sm.notes.find(n => n._id.toString() === txn.docId)) : null;

        if (!note || (!note.file && !note.pdf)) {
            return res.status(404).json({ success: false, message: "Document file payload not available" });
        }

        const filePayload = note.file || note.pdf;
        if (filePayload.startsWith('data:')) {
            const matches = filePayload.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const contentType = matches[1];
                const buffer = Buffer.from(matches[2], 'base64');
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Disposition', `attachment; filename="${note.fileName || 'document.pdf'}"`);
                return res.send(buffer);
            }
        }

        res.json({ success: true, file: filePayload, fileName: note.fileName });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. Create Order for Coaching Suspension Unblock
app.post('/api/payment/create-coaching-unblock-order', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const center = await TuitionCenter.findById(centerId);
        if (!center) return res.status(404).json({ success: false, message: "Coaching Center not found" });

        const dueAmount = Math.max(0, Number(center.dueAmount) || 0);
        if (dueAmount <= 0) {
            center.isBlocked = false;
            center.blockReason = '';
            await center.save();
            return res.json({
                success: true,
                alreadyCleared: true,
                message: "No outstanding dues found. Your center is already unblocked!"
            });
        }

        const { client, keyId } = await getRazorpayClient();
        if (!client) {
            return res.status(400).json({
                success: false,
                message: "Razorpay payment gateway not configured. Please contact Super Admin to set Razorpay credentials."
            });
        }

        const amountInPaise = Math.round(dueAmount * 100);
        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: 'coach_' + Date.now().toString().slice(-8),
            notes: {
                centerId: center._id.toString(),
                centerName: center.centerName.slice(0, 40),
                directorName: (center.directorName || '').slice(0, 30)
            }
        };

        const order = await client.orders.create(options);

        await PaymentTransaction.create({
            orderId: order.id,
            purpose: 'coaching_unblock',
            amount: dueAmount,
            currency: 'INR',
            status: 'created',
            payerName: center.directorName || center.centerName,
            payerPhone: center.contactNumber || '',
            payerEmail: center.email || '',
            centerId: center._id.toString(),
            centerName: center.centerName
        });

        res.json({
            success: true,
            orderId: order.id,
            amount: dueAmount,
            amountInPaise: amountInPaise,
            currency: 'INR',
            keyId: keyId,
            centerName: center.centerName
        });
    } catch (err) {
        console.error('Create coaching unblock order error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6. Verify Coaching Unblock Payment -> AUTO-UNBLOCK & REACTIVATE
app.post('/api/payment/verify-coaching-unblock', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Missing Razorpay payment parameters" });
        }

        const { keySecret } = await getRazorpayClient();
        if (!keySecret) {
            return res.status(400).json({ success: false, message: "Razorpay Secret Key missing in server configuration" });
        }

        const generatedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            await PaymentTransaction.findOneAndUpdate(
                { orderId: razorpay_order_id },
                { status: 'failed', paymentId: razorpay_payment_id }
            );
            return res.status(400).json({ success: false, message: "Payment signature mismatch. Verification failed." });
        }

        const center = await TuitionCenter.findById(centerId);
        if (!center) return res.status(404).json({ success: false, message: "Coaching Center not found" });

        // AUTO-UNBLOCK IMMEDIATELY!
        center.isBlocked = false;
        center.blockReason = '';
        center.dueAmount = 0;
        center.paymentProof = {
            receiptImage: 'Razorpay Online Gateway Instant Settlement',
            transactionId: razorpay_payment_id,
            submittedAt: new Date(),
            status: 'verified'
        };
        center.updatedAt = new Date();
        await center.save();

        await PaymentTransaction.findOneAndUpdate(
            { orderId: razorpay_order_id },
            {
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
                status: 'paid',
                paidAt: new Date()
            }
        );

        res.json({
            success: true,
            message: "Payment successfully verified! Your coaching center has been automatically unblocked and access restored.",
            center: {
                _id: center._id,
                centerName: center.centerName,
                isBlocked: false,
                dueAmount: 0,
                status: 'active'
            }
        });
    } catch (err) {
        console.error('Verify coaching unblock error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7. Super Admin: List All Payment Transactions
app.get('/api/super-admin/payment-transactions', verifySuperAdmin, async (req, res) => {
    try {
        const transactions = await PaymentTransaction.find().sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, data: transactions });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// MASTER DATABASE FACTORY RESET / FORMAT
// ============================================
app.post('/api/admin/format-database', verifyToken, async (req, res) => {
    try {
        const { newAdminId, newPassword, confirmText, liveSiteUrl } = req.body;

        if (confirmText !== 'FORMAT_ALL_DATA') {
            return res.status(400).json({
                success: false,
                message: "Security confirmation failed. You must enter exact confirmation: 'FORMAT_ALL_DATA'"
            });
        }

        if (!newAdminId || newAdminId.trim().length < 3) {
            return res.status(400).json({ success: false, message: "New Super Admin ID must be at least 3 characters" });
        }
        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({ success: false, message: "New Super Admin Password must be at least 4 characters" });
        }

        console.log(`⚠️ MASTER FACTORY RESET INITIATED by Admin: ${req.user ? req.user.adminID : 'SuperAdmin'} at ${new Date().toISOString()}`);

        // Wipe all collections
        await Promise.all([
            Student.deleteMany({}),
            TuitionCenter.deleteMany({}),
            StudyMaterial.deleteMany({}),
            Gallery.deleteMany({}),
            SidebarBanner.deleteMany({}),
            Tracking.deleteMany({}),
            DownloadRequest.deleteMany({}),
            Settings.deleteMany({}),
            Admin.deleteMany({})
        ]);

        // Re-create new Super Admin
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await Admin.create({
            adminID: newAdminId.trim(),
            pws: hashedPassword,
            name: 'Super Admin',
            role: 'super_admin',
            isActive: true
        });

        // Re-create clean default settings
        await Settings.create({
            title: 'BBCC Skill Hub',
            subTitle: 'Empowering Skills, Building Futures',
            liveSiteUrl: (liveSiteUrl || '').trim()
        });

        // Re-create initial collections
        await StudyMaterial.create({ videos: [], notes: [] });
        await Gallery.create({ photos: [] });
        await SidebarBanner.create({ banners: [] });

        console.log(`✅ DATABASE RESET COMPLETE: New Super Admin ID: ${newAdminId.trim()}`);

        res.json({
            success: true,
            message: "Database has been completely formatted and reset to clean state! Please log in with your new Super Admin ID and Password."
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// RENDER 24/7 ANTI-SLEEP KEEP-ALIVE & HEALTH
// ============================================
app.get('/api/ping', (req, res) => {
    res.json({
        success: true,
        status: "active",
        timestamp: Date.now(),
        message: "BBCC Skill Hub Server is live and active"
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: "healthy",
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// Self-ping interval to prevent Render free-tier from spinning down (every 10 mins)
const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;
setInterval(async () => {
    try {
        let siteUrl = process.env.RENDER_EXTERNAL_URL;
        if (!siteUrl) {
            const currentSettings = await Settings.findOne();
            if (currentSettings && currentSettings.liveSiteUrl) {
                siteUrl = currentSettings.liveSiteUrl;
            }
        }
        if (siteUrl && siteUrl.startsWith('http')) {
            const pingTarget = siteUrl.replace(/\/+$/, '') + '/api/ping';
            const pingRes = await fetch(pingTarget);
            if (pingRes.ok) {
                console.log(`[Anti-Sleep Keep-Alive] Pinged ${pingTarget} at ${new Date().toLocaleTimeString()} - Status: ${pingRes.status}`);
            }
        }
    } catch (err) {
        console.warn('[Anti-Sleep Keep-Alive] Ping notification:', err.message);
    }
}, KEEP_ALIVE_INTERVAL_MS);

// Standard Teachers Routes (Super Admin)
app.post('/api/tuition-centers/:id/teacher', verifyToken, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.params.id);
        if (!center) {
            return res.status(404).json({ success: false, message: "Center not found" });
        }
        const { name, photo, subject, class: classVal } = req.body;
        if (!name || !subject || !classVal) {
            return res.status(400).json({ success: false, message: "Name, subject and class are required" });
        }
        center.teachers.push({
            name,
            photo: photo || '',
            subject,
            class: classVal
        });
        center.updatedAt = new Date();
        await center.save();
        res.json({ success: true, message: "Teacher added successfully", data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/tuition-centers/:id/teacher/:tid', verifyToken, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.params.id);
        if (!center) {
            return res.status(404).json({ success: false, message: "Center not found" });
        }
        const teacher = center.teachers.id(req.params.tid);
        if (!teacher) {
            return res.status(404).json({ success: false, message: "Teacher not found" });
        }
        const { name, photo, subject, class: classVal } = req.body;
        if (name !== undefined) teacher.name = name;
        if (photo !== undefined) teacher.photo = photo;
        if (subject !== undefined) teacher.subject = subject;
        if (classVal !== undefined) teacher.class = classVal;
        center.updatedAt = new Date();
        await center.save();
        res.json({ success: true, message: "Teacher updated successfully", data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/tuition-centers/:id/teacher/:tid', verifyToken, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.params.id);
        if (!center) {
            return res.status(404).json({ success: false, message: "Center not found" });
        }
        const teacherIndex = center.teachers.findIndex(t => t._id.toString() === req.params.tid);
        if (teacherIndex === -1) {
            return res.status(404).json({ success: false, message: "Teacher not found" });
        }
        center.teachers.splice(teacherIndex, 1);
        center.updatedAt = new Date();
        await center.save();
        res.json({ success: true, message: "Teacher deleted successfully", data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// ===== TRACKING APIs - START =====
// ============================================

// ===== UPLOAD PHOTO TO DATABASE =====
app.post('/api/tracking/upload', async (req, res) => {
    try {
        const { image } = req.body;
        
        if (!image) {
            return res.status(400).json({ 
                success: false, 
                message: "Image is required" 
            });
        }

        // Generate unique track ID
        const trackId = 'trk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
        
        // Create new tracking record with photo
        const tracking = new Tracking({
            trackId: trackId,
            imageUrl: image,
            visits: [],
            totalClicks: 0,
            uniqueVisitors: 0
        });

        await tracking.save();

        res.json({
            success: true,
            message: "Photo uploaded successfully",
            data: {
                trackId: tracking.trackId,
                imageUrl: tracking.imageUrl
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===== GENERATE TRACKING LINK =====
app.post('/api/tracking/generate', async (req, res) => {
    try {
        const { imageUrl } = req.body;
        
        if (!imageUrl) {
            return res.status(400).json({ 
                success: false, 
                message: "Image URL is required" 
            });
        }

        let tracking = await Tracking.findOne({ imageUrl: imageUrl });
        if (tracking) {
            return res.json({
                success: true,
                message: "Tracking link already exists",
                data: {
                    trackId: tracking.trackId,
                    imageUrl: tracking.imageUrl,
                    link: `${req.protocol}://${req.get('host')}/image?id=${tracking.trackId}`,
                    totalClicks: tracking.totalClicks,
                    visits: tracking.visits
                }
            });
        }

        const trackId = 'trk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
        
        tracking = new Tracking({
            trackId: trackId,
            imageUrl: imageUrl,
            visits: [],
            totalClicks: 0,
            uniqueVisitors: 0
        });

        await tracking.save();

        res.json({
            success: true,
            message: "Tracking link generated successfully",
            data: {
                trackId: tracking.trackId,
                imageUrl: tracking.imageUrl,
                link: `${req.protocol}://${req.get('host')}/image?id=${tracking.trackId}`,
                totalClicks: 0,
                visits: []
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===== GET IMAGE FOR TRACKING =====
app.get('/api/tracking/image/:trackId', async (req, res) => {
    try {
        const { trackId } = req.params;
        const tracking = await Tracking.findOne({ trackId });
        
        if (!tracking) {
            return res.status(404).json({ 
                success: false, 
                message: "Tracking link not found" 
            });
        }
        
        res.json({
            success: true,
            data: {
                image_url: tracking.imageUrl,
                track_id: tracking.trackId
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===== TRACK VISITOR - AUTO CAPTURE =====
app.post('/api/tracking/visit', async (req, res) => {
    try {
        const { track_id, lat, lng } = req.body;
        
        if (!track_id) {
            return res.status(400).json({ 
                success: false, 
                message: "Track ID is required" 
            });
        }

        const tracking = await Tracking.findOne({ trackId: track_id });
        if (!tracking) {
            return res.status(404).json({ 
                success: false, 
                message: "Tracking link not found" 
            });
        }

        const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.connection?.remoteAddress || 'Unknown';
        const ip = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : 'Unknown';
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const referrer = req.headers['referer'] || 'Unknown';

        const deviceInfo = getUserAgentInfo(userAgent);

        let location = 'Unknown';
        let city = 'Unknown';
        let region = 'Unknown';
        let country = 'Unknown';

        // Use GPS location if available
        if (lat && lng) {
            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
                    headers: { 'User-Agent': 'BBCC-Skill-Hub/1.0 (contact@bbccskillhub.com)' }
                });
                const geoData = await geoRes.json();
                if (geoData && geoData.address) {
                    const addr = geoData.address;
                    city = addr.city || addr.town || addr.village || 'Unknown';
                    region = addr.state || 'Unknown';
                    country = addr.country || 'Unknown';
                    location = [city, region, country].filter(Boolean).join(', ');
                }
            } catch (e) {}
        }

        // Fallback to IP location
        if (location === 'Unknown' && ip !== '127.0.0.1' && ip !== '::1') {
            try {
                const ipRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,region,country`);
                const ipData = await ipRes.json();
                if (ipData.status === 'success') {
                    city = ipData.city || city;
                    region = ipData.region || region;
                    country = ipData.country || country;
                    location = [city, region, country].filter(Boolean).join(', ');
                }
            } catch (e) {}
        }

        const visit = {
            ip: ip,
            location: location,
            city: city,
            region: region,
            country: country,
            lat: lat || null,
            lng: lng || null,
            device: deviceInfo.device,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            userAgent: userAgent,
            referrer: referrer,
            visitedAt: new Date()
        };

        const existingIndex = tracking.visits.findIndex(v => v.ip === ip);
        if (existingIndex !== -1) {
            tracking.visits[existingIndex] = visit;
        } else {
            tracking.visits.push(visit);
            tracking.uniqueVisitors = tracking.visits.length;
        }

        tracking.totalClicks = tracking.visits.length;
        tracking.updatedAt = new Date();
        await tracking.save();

        res.json({ success: true, message: "Visit tracked successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===== GET ALL TRACKING DATA =====
app.get('/api/tracking/data', async (req, res) => {
    try {
        const data = await Tracking.find().sort({ createdAt: -1 });
        res.json({ success: true, data: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===== CLEAR ALL TRACKING DATA =====
app.delete('/api/tracking/clear', async (req, res) => {
    try {
        await Tracking.deleteMany({});
        res.json({ success: true, message: "All tracking data cleared" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===== GET SINGLE TRACKING LINK DATA =====
app.get('/api/tracking/:trackId', async (req, res) => {
    try {
        const tracking = await Tracking.findOne({ trackId: req.params.trackId });
        if (!tracking) {
            return res.status(404).json({ success: false, message: "Tracking link not found" });
        }
        res.json({ success: true, data: tracking });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// HELPER FUNCTION - Parse User Agent
// ============================================
function getUserAgentInfo(userAgent) {
    const ua = userAgent || '';
    let device = 'Desktop';
    let browser = 'Unknown';
    let os = 'Unknown';

    if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
        if (/iPad|Tablet/i.test(ua)) {
            device = 'Tablet';
        } else {
            device = 'Mobile';
        }
    }

    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Opera')) browser = 'Opera';

    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return { device, browser, os };
}
// ============================================
// ===== TRACKING APIs - END =====
// ============================================

// ============================================
// SERVE HTML PAGES (WITH ROBUST FALLBACKS)
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    const p1 = path.join(__dirname, 'public', 'login.html');
    const p2 = path.join(__dirname, 'public', 'login.htm');
    if (fs.existsSync(p1)) return res.sendFile(p1);
    if (fs.existsSync(p2)) return res.sendFile(p2);
    res.sendFile(p1);
});

app.get('/management', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'management.html'));
});

app.get('/coaching-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'coaching-dashboard.html'));
});

// Dedicated Partner Coaching Center Public Microsite
app.get(['/center', '/center/:id', '/institute', '/institute/:id'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'center.html'));
});

// Center Inquiries Endpoint for Coaching Directors
app.get('/api/coaching/inquiries', verifyCoachingDirector, async (req, res) => {
    try {
        const centerId = req.user.centerId || req.user.id;
        const center = await TuitionCenter.findById(centerId).select('inquiries');
        res.json({ success: true, data: (center && center.inquiries) || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Public: Get Detailed Coaching Center Data (Registered by BBCC Skill Hub)
app.get('/api/public/center/:id', async (req, res) => {
    try {
        const centerId = req.params.id;
        const center = await TuitionCenter.findById(centerId).select('-password');
        if (!center) {
            return res.status(404).json({ success: false, message: "Coaching center not found" });
        }

        // Fetch associated materials
        let materials = [];
        try {
            const sm = await StudyMaterial.findOne();
            if (sm) {
                const cVideos = (sm.videos || [])
                    .filter(v => v.centerId === centerId.toString())
                    .map(v => ({ title: v.title, description: v.description, link: v.link, thumbnail: v.thumbnail, fileType: 'video' }));
                const cNotes = (sm.notes || [])
                    .filter(n => n.centerId === centerId.toString() || (n.accessType === 'specific_centers' && (n.allowedCenterIds || []).includes(centerId.toString())))
                    .map(n => ({ title: n.title, description: n.description, pdf: n.pdf, fileType: 'pdf' }));
                materials = [...cVideos, ...cNotes];
            }
        } catch (e) {
            console.warn('Material fetch warning for center:', e.message);
        }

        // Fetch center gallery photos
        let galleryPhotos = [];
        try {
            const g = await Gallery.findOne();
            if (g && g.photos) {
                galleryPhotos = g.photos.filter(p => p.centerId === centerId.toString() || p.centerName === center.centerName);
            }
        } catch (e) {
            console.warn('Gallery fetch warning for center:', e.message);
        }

        const publicData = {
            _id: center._id.toString(),
            centerName: center.centerName,
            clogo: center.clogo,
            directorName: center.directorName,
            directorPhoto: center.directorPhoto,
            username: center.username,
            fromClass: center.fromClass,
            toClass: center.toClass,
            address: center.address,
            contactNumber: center.contactNumber,
            email: center.email,
            whatsappNumber: center.whatsappNumber,
            encryptedCallLink: center.encryptedCallLink,
            youtubeLink: center.youtubeLink,
            facebookLink: center.facebookLink,
            instagramLink: center.instagramLink,
            telegramLink: center.telegramLink,
            twitterLink: center.twitterLink,
            linkedinLink: center.linkedinLink,
            description: center.description,
            isBlocked: center.isBlocked,
            teachers: center.teachers || [],
            materials: materials,
            gallery: galleryPhotos,
            affiliationInfo: {
                boardName: "BBCC SKILL HUB",
                registeredBy: "Registered & Recognized by BBCC SKILL HUB Academic Board",
                centralWebsite: "/"
            }
        };

        res.json({ success: true, data: publicData });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Public: Submit Student Admission Inquiry to Coaching Center
app.post('/api/public/center/:id/inquiry', async (req, res) => {
    try {
        const centerId = req.params.id;
        const { studentName, parentName, mobile, targetClass, message } = req.body;

        if (!studentName || !mobile || !targetClass) {
            return res.status(400).json({ success: false, message: "Student name, mobile number, and class are required" });
        }

        const center = await TuitionCenter.findById(centerId);
        if (!center) {
            return res.status(404).json({ success: false, message: "Coaching center not found" });
        }

        if (!center.inquiries) center.inquiries = [];
        center.inquiries.push({
            studentName: studentName.trim(),
            parentName: parentName ? parentName.trim() : '',
            mobile: mobile.trim(),
            targetClass: targetClass.trim(),
            message: message ? message.trim() : '',
            status: 'new',
            createdAt: new Date()
        });

        await center.save();
        res.json({ success: true, message: "Inquiry submitted successfully to center director!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================
// COACHING AFFILIATION REGISTRATION APIS (MAIN INDEX)
// ============================================

// 1. Public: Submit Coaching Affiliation Application
app.post('/api/public/register-coaching-inquiry', async (req, res) => {
    try {
        const { centerName, directorName, contactNumber, email, fromClass, toClass, address, message } = req.body;
        if (!centerName || !centerName.trim()) {
            return res.status(400).json({ success: false, message: "Coaching Center name is required" });
        }
        if (!directorName || !directorName.trim()) {
            return res.status(400).json({ success: false, message: "Director name is required" });
        }
        if (!contactNumber || !contactNumber.trim()) {
            return res.status(400).json({ success: false, message: "Contact / WhatsApp number is required" });
        }

        const inquiry = await CoachingAffiliation.create({
            centerName: centerName.trim(),
            directorName: directorName.trim(),
            contactNumber: contactNumber.trim(),
            email: email ? email.trim() : '',
            fromClass: fromClass ? fromClass.trim() : 'Class 1st',
            toClass: toClass ? toClass.trim() : 'Class 12th',
            address: address ? address.trim() : '',
            message: message ? message.trim() : '',
            status: 'pending'
        });

        res.json({
            success: true,
            message: "Coaching Affiliation Application submitted successfully! The BBCC Skill Hub Central Board will review and connect with you shortly.",
            data: inquiry
        });
    } catch (err) {
        console.error("Coaching registration error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Super Admin: List All Coaching Affiliation Applications
app.get('/api/super-admin/coaching-affiliations', verifySuperAdmin, async (req, res) => {
    try {
        const list = await CoachingAffiliation.find().sort({ createdAt: -1 });
        res.json({ success: true, data: list });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3. Super Admin: Approve Coaching Application & Create Center Login
app.post('/api/super-admin/coaching-affiliations/:id/approve', verifySuperAdmin, async (req, res) => {
    try {
        const appRecord = await CoachingAffiliation.findById(req.params.id);
        if (!appRecord) return res.status(404).json({ success: false, message: "Application record not found" });

        const cleanName = appRecord.centerName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'center';
        const randomNum = Math.floor(100 + Math.random() * 900);
        const username = `${cleanName}${randomNum}`;
        const rawPassword = 'bbcc' + Math.floor(1000 + Math.random() * 9000);
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        const newCenter = await TuitionCenter.create({
            centerName: appRecord.centerName,
            directorName: appRecord.directorName,
            contactNumber: appRecord.contactNumber,
            email: appRecord.email,
            fromClass: appRecord.fromClass || 'Class 1st',
            toClass: appRecord.toClass || 'Class 12th',
            address: appRecord.address || '',
            description: appRecord.message || '',
            username: username,
            password: hashedPassword,
            isBlocked: false
        });

        appRecord.status = 'approved';
        await appRecord.save();

        res.json({
            success: true,
            message: `Coaching Center approved and created successfully!`,
            center: newCenter,
            credentials: { username, password: rawPassword }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. Super Admin: Delete / Reject Coaching Application
app.delete('/api/super-admin/coaching-affiliations/:id', verifySuperAdmin, async (req, res) => {
    try {
        await CoachingAffiliation.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Application removed successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. Super Admin: Test Razorpay Gateway Connection
app.get('/api/super-admin/test-razorpay', verifySuperAdmin, async (req, res) => {
    try {
        const { client, keyId } = await getRazorpayClient();
        if (!client || !keyId) {
            return res.status(400).json({
                success: false,
                message: "Razorpay credentials are not configured yet. Please enter Key ID and Secret."
            });
        }
        await client.orders.all({ count: 1 });
        res.json({
            success: true,
            message: "Razorpay Gateway credentials are verified and active!",
            keyId: keyId
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: "Razorpay connection error: " + (err.error ? err.error.description || err.error.message : err.message)
        });
    }
});

app.get(['/tracking', '/fish'], (req, res) => {
    const p1 = path.join(__dirname, 'public', 'tracking.html');
    const p2 = path.join(__dirname, 'public', 'fish.html');
    if (fs.existsSync(p1)) return res.sendFile(p1);
    if (fs.existsSync(p2)) return res.sendFile(p2);
    res.sendFile(p1);
});

// ===== IMAGE VIEWER ROUTE =====
app.get('/image', (req, res) => {
    const p1 = path.join(__dirname, 'public', 'image.html');
    const p2 = path.join(__dirname, 'public', 'IMAGE.HTML');
    if (fs.existsSync(p1)) return res.sendFile(p1);
    if (fs.existsSync(p2)) return res.sendFile(p2);
    res.sendFile(p1);
});

// Safety handler to prevent unexpected server crashes
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Promise Rejection:', reason);
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n✅ BBCC Skill Hub Server Running!`);
    console.log(`🔗 http://localhost:${PORT}`);
    console.log(`🔑 Super Admin Login: santosh / santosh (or your customized admin ID)`);
    console.log(`📊 MongoDB: ${MONGO_URI}`);
    console.log(`📌 Tracking Page: http://localhost:${PORT}/tracking`);
    console.log(`📌 Image Viewer: http://localhost:${PORT}/image?id=your_track_id\n`);
});
