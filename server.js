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
        pdf: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, default: '' },
        centerId: { type: String, default: '' },
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

// Create Models
const Admin = mongoose.model('Admin', AdminSchema);
const Settings = mongoose.model('Settings', SettingsSchema);
const StudyMaterial = mongoose.model('StudyMaterial', StudyMaterialSchema);
const Gallery = mongoose.model('Gallery', GallerySchema);
const SidebarBanner = mongoose.model('SidebarBanner', SidebarBannerSchema);
const TuitionCenter = mongoose.model('TuitionCenter', TuitionCenterSchema);
const Tracking = mongoose.model('Tracking', TrackingSchema);

// ============================================
// DATABASE CONNECTION
// ============================================
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ MongoDB Connected Successfully');
        
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
        
        if (center && center.password) {
            const isValid = await bcrypt.compare(password.trim(), center.password);
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
        res.json({ success: true, data: studyMaterial });
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
        const { pdf, title, description } = req.body;
        if (!pdf || !title) {
            return res.status(400).json({ success: false, message: "PDF and title are required" });
        }
        let studyMaterial = await StudyMaterial.findOne();
        if (!studyMaterial) {
            studyMaterial = new StudyMaterial({ videos: [], notes: [] });
        }
        studyMaterial.notes.push({
            pdf: pdf,
            title: title,
            description: description || ''
        });
        studyMaterial.updatedAt = new Date();
        await studyMaterial.save();
        res.json({ success: true, message: "PDF note added successfully", data: studyMaterial });
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
        const centerId = req.user.centerId || req.user.id;
        const center = await TuitionCenter.findById(centerId).select('-password');
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
    console.log(`🔑 Login: admin / admin123`);
    console.log(`📊 MongoDB: ${MONGO_URI}`);
    console.log(`📌 Tracking Page: http://localhost:${PORT}/tracking`);
    console.log(`📌 Image Viewer: http://localhost:${PORT}/image?id=your_track_id\n`);
});
