/**
 * ============================================================
 * BBCC SKILL HUB — CORE BACKEND ENGINE (v3.1 ENTERPRISE)
 * ============================================================
 * Clean, High-Performance REST API & Digital Board Engine
 * MongoDB Atlas & Render Ready
 * ============================================================
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'BBCC_AURORA_SECURE_TOKEN_2026_@KEY';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/bbcc_portal';

// Helper: Safely convert large base64 data to lightweight server disk files
// Prevents MongoDB from hitting the strict 16MB BSON document size limit
function saveBase64ToFile(dataUriOrBase64, subDir = 'materials', defaultExt = 'pdf') {
    if (!dataUriOrBase64 || typeof dataUriOrBase64 !== 'string') return '';
    // If it's already a URL or server path, return as is
    if (dataUriOrBase64.startsWith('http://') || dataUriOrBase64.startsWith('https://') || dataUriOrBase64.startsWith('/uploads/')) {
        return dataUriOrBase64;
    }
    let ext = defaultExt;
    let base64Data = dataUriOrBase64;
    const match = dataUriOrBase64.match(/^data:([a-zA-Z0-9\/+-]+);base64,(.+)$/);
    if (match) {
        const mime = match[1];
        base64Data = match[2];
        if (mime.includes('pdf')) ext = 'pdf';
        else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
        else if (mime.includes('png')) ext = 'png';
        else if (mime.includes('webp')) ext = 'webp';
        else if (mime.includes('word') || mime.includes('officedocument')) ext = 'docx';
    } else if (dataUriOrBase64.length < 300) {
        // Just a short string, not a base64 file payload
        return dataUriOrBase64;
    }

    try {
        const targetDir = path.join(__dirname, 'public', 'uploads', subDir);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const filename = `${subDir}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        const filePath = path.join(targetDir, filename);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        return `/uploads/${subDir}/${filename}`;
    } catch (e) {
        console.error('saveBase64ToFile error:', e.message);
        return dataUriOrBase64;
    }
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ extended: true, limit: '80mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ============================================================
// 1. MONGODB SCHEMAS & MODELS
// ============================================================

// 1.1 Super Admin Schema
const AdminSchema = new mongoose.Schema({
    adminId: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, default: 'Super Administrator' },
    role: { type: String, default: 'superadmin' },
    lastLogin: { type: Date }
}, { timestamps: true });

// 1.2 Partner Coaching Center / Tuition Center Schema
const CenterSchema = new mongoose.Schema({
    centerName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    directorName: { type: String, required: true, trim: true },
    directorPhoto: { type: String, default: '' },
    clogo: { type: String, default: '' },
    fromClass: { type: String, default: 'Class 6th' },
    toClass: { type: String, default: 'Class 12th' },
    address: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    whatsappNumber: { type: String, default: '' },
    email: { type: String, default: '' },
    encryptedCallLink: { type: String, default: '' },
    description: { type: String, default: '' },
    headerNotice: { type: String, default: '' },
    footerText: { type: String, default: '' },
    affiliationCertificateId: { type: String, default: '' },
    affiliationDate: { type: Date, default: Date.now },
    affiliationPaid: { type: Boolean, default: true },
    socials: {
        youtube: { type: String, default: '' },
        facebook: { type: String, default: '' },
        instagram: { type: String, default: '' },
        telegram: { type: String, default: '' },
        twitter: { type: String, default: '' },
        linkedin: { type: String, default: '' }
    },
    // Bank Account Details for 80/20 Payouts
    bankDetails: {
        accountHolder: { type: String, default: '' },
        bankName: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
        ifscCode: { type: String, default: '' },
        upiId: { type: String, default: '' }
    },
    walletBalance: { type: Number, default: 0 }, // 80% net center earnings
    totalSalesVolume: { type: Number, default: 0 },
    totalPlatformCut: { type: Number, default: 0 }, // 20% BBCC platform share
    // Courses & Batch Schedules (Online vs Physical Classroom)
    courses: [{
        courseName: { type: String, required: true },
        subject: { type: String, default: 'General' },
        classLevel: { type: String, default: 'All' },
        mode: { type: String, default: 'both' }, // 'online', 'physical', 'both'
        onlineFee: { type: Number, default: 0 },
        offlineFee: { type: Number, default: 0 },
        batchTiming: { type: String, default: 'Regular' },
        liveClassLink: { type: String, default: '' }, // Google Meet or Zoom URL
        description: { type: String, default: '' },
        active: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
    }],
    // Suspension & Dues System
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String, default: '' },
    dueAmount: { type: Number, default: 0 },
    paymentQr: { type: String, default: '' },
    // Dual Promotional Banners (Auto-Expires in 30 Days)
    promotionalBanners: [{
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        image: { type: String, required: true },
        link: { type: String, default: '' },
        active: { type: Boolean, default: true },
        expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        uploadedAt: { type: Date, default: Date.now }
    }],
    teachers: [{
        name: { type: String, required: true },
        subject: { type: String, required: true },
        class: { type: String, default: 'All' },
        qualification: { type: String, default: 'Certified Faculty' },
        photo: { type: String, default: '' },
        phone: { type: String, default: '' },
        experience: { type: String, default: '3+ Years' }
    }],
    materials: [{
        title: { type: String, required: true },
        description: { type: String, default: '' },
        price: { type: Number, default: 0 }, // MRP in INR (20% platform cut, 80% center wallet)
        fileType: { type: String, default: 'pdf' },
        pdf: { type: String, default: '' },
        file: { type: String, default: '' },
        link: { type: String, default: '' },
        isRawData: { type: Boolean, default: false },
        downloadCount: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now }
    }],
    gallery: [{
        image: { type: String, required: true },
        title: { type: String, default: '' },
        uploadedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// 1.3 Central E-Library Books & Notes Schema
const StudyMaterialSchema = new mongoose.Schema({
    notes: [{
        title: { type: String, required: true, trim: true },
        subject: { type: String, default: 'General' },
        classLevel: { type: String, default: 'All Classes' },
        description: { type: String, default: '' },
        fileType: { type: String, default: 'pdf' },
        thumbnail: { type: String, default: '' },
        pdf: { type: String, default: '' },
        file: { type: String, default: '' },
        fileName: { type: String, default: 'study_document.pdf' },
        price: { type: Number, default: 0 }, // 0 = Free, > 0 = Paid with Razorpay
        targetCenterId: { type: String, default: 'all' }, // 'all' or specific TuitionCenter ID
        targetCenterName: { type: String, default: 'All Centers (Universal)' },
        isRawData: { type: Boolean, default: false }, // Educational raw curriculum/data
        downloadCount: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now }
    }],
    videos: [{
        title: { type: String, required: true },
        subject: { type: String, default: 'General' },
        classLevel: { type: String, default: 'All Classes' },
        videoUrl: { type: String, required: true },
        duration: { type: String, default: '15 mins' },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// 1.4 Student Records Schema with Aadhar KYC & Roll Number Verification
const StudentSchema = new mongoose.Schema({
    studentId: { type: String, required: true, unique: true },
    rollNo: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    fatherName: { type: String, default: '' },
    motherName: { type: String, default: '' },
    parentName: { type: String, default: '' },
    dob: { type: String, default: '' },
    phone: { type: String, default: '' },
    mobile: { type: String, default: '' },
    parentMobile: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    photo: { type: String, default: '' },
    aadharNumber: { type: String, default: '', index: true },
    aadharDoc: { type: String, default: '' },
    course: { type: String, default: 'Academic Excellence' },
    courseId: { type: String, default: '' },
    courseName: { type: String, default: '' },
    mode: { type: String, default: 'physical' }, // 'online' or 'physical'
    feePaid: { type: Number, default: 0 },
    classLevel: { type: String, default: 'Class 10th' },
    marksGrade: { type: String, default: 'A+' },
    certificateId: { type: String, default: '' },
    issueDate: { type: Date, default: Date.now },
    status: { type: String, default: 'Certified & Verified' },
    admissionStatus: { type: String, default: 'Active' },
    centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'TuitionCenter' },
    centerName: { type: String, default: 'BBCC SKILL HUB Partner' },
    totalPaid: { type: Number, default: 0 },
    feeStatus: { type: String, default: 'active' }
}, { timestamps: true });

// 1.5 Center Affiliation Application Schema
const AffiliationApplicationSchema = new mongoose.Schema({
    centerName: { type: String, required: true },
    directorName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: { type: String, default: '' },
    fromClass: { type: String, default: 'Class 6th' },
    toClass: { type: String, default: 'Class 12th' },
    address: { type: String, required: true },
    message: { type: String, default: '' },
    status: { type: String, default: 'pending' }, // pending, approved, rejected
    appliedAt: { type: Date, default: Date.now }
});

// 1.6 Student Admission Inquiries Schema
const AdmissionInquirySchema = new mongoose.Schema({
    centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'TuitionCenter' },
    centerName: { type: String, default: '' },
    studentName: { type: String, required: true },
    parentName: { type: String, default: '' },
    mobile: { type: String, required: true },
    targetClass: { type: String, default: '' },
    message: { type: String, default: '' },
    status: { type: String, default: 'new' }, // new, contacted, enrolled
    createdAt: { type: Date, default: Date.now }
});

// 1.7 Payment Transactions Ledger Schema (with 80/20 Split Breakdown)
const PaymentTransactionSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String, default: '' },
    signature: { type: String, default: '' },
    purpose: { type: String, required: true }, // 'document_purchase', 'coaching_unblock', 'coaching_affiliation', 'course_admission'
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: { type: String, default: 'created' }, // 'created', 'paid', 'failed'
    payerName: { type: String, default: 'Student' },
    payerPhone: { type: String, default: '' },
    payerEmail: { type: String, default: '' },
    docId: { type: String, default: '' },
    docTitle: { type: String, default: '' },
    centerId: { type: String, default: '' },
    centerName: { type: String, default: '' },
    centerShare: { type: Number, default: 0 }, // 80% for coaching center
    platformCut: { type: Number, default: 0 }, // 20% for BBCC platform
    regData: { type: Object, default: null }, // Stored for affiliation registration verification
    paidAt: { type: Date }
}, { timestamps: true });

// 1.8 Global Platform Settings & Full CMS Schema
const SettingsSchema = new mongoose.Schema({
    boardTitle: { type: String, default: 'BBCC SKILL HUB' },
    tagline: { type: String, default: 'Digital Skill & Coaching Institute Platform' },
    heroTitle: { type: String, default: 'Empowering Certified Learning & Partner Institutes' },
    heroDesc: { type: String, default: 'Explore authentic textbook syllabus notes, discover verified faculty, register coaching institutes directly with instant live activation, and verify student credentials via central roll numbers.' },
    phone: { type: String, default: '+91 98765 43210' },
    email: { type: String, default: 'board@bbccskillhub.org' },
    address: { type: String, default: 'BBCC Central Directorate, New Delhi, India' },
    boardLogo: { type: String, default: '' },
    footerText: { type: String, default: 'BBCC SKILL HUB Digital Platform. Centralized Educational Verification & Partner Institute Network.' },
    newsMarquee: {
        type: String,
        default: '📢 Admissions Open 2026-27 Across All BBCC Certified Centers | Apply for Direct Affiliation Online | 24/7 Digital Helpline & BHARTI AI Live'
    },
    affiliationFee: { type: Number, default: 999 }, // Admin decided affiliation fee
    // Google Gemini AI Key
    geminiApiKey: { type: String, default: '' },
    // Razorpay Gateway
    razorpayKeyId: { type: String, default: '' },
    razorpayKeySecret: { type: String, default: '' },
    razorpayEnabled: { type: Boolean, default: true },
    // Banners & Gallery
    banners: [{
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        image: { type: String, default: '' },
        link: { type: String, default: '' }
    }],
    gallery: [{
        title: { type: String, default: '' },
        image: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Compile Models
const Admin = mongoose.model('Admin', AdminSchema);
const TuitionCenter = mongoose.model('TuitionCenter', CenterSchema);
const StudyMaterial = mongoose.model('StudyMaterial', StudyMaterialSchema);
const Student = mongoose.model('Student', StudentSchema);
const AffiliationApplication = mongoose.model('AffiliationApplication', AffiliationApplicationSchema);
const AdmissionInquiry = mongoose.model('AdmissionInquiry', AdmissionInquirySchema);
const PaymentTransaction = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
const Settings = mongoose.model('Settings', SettingsSchema);

// ============================================================
// 2. HELPER UTILITIES & AUTH MIDDLEWARES
// ============================================================

// Fetch active Razorpay client from database or environment
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
        console.error('Settings fetch error for Razorpay:', e.message);
    }

    if (!keyId || !keySecret) {
        return { client: null, keyId, keySecret };
    }

    try {
        const client = new Razorpay({ key_id: keyId, key_secret: keySecret });
        return { client, keyId, keySecret };
    } catch (err) {
        console.error('Razorpay init error:', err.message);
        return { client: null, keyId, keySecret };
    }
}

// Super Admin Authentication Middleware
function verifySuperAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authorization token required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'Super Admin access required' });
        }
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired session token' });
    }
}

// Coaching Director Authentication Middleware
function verifyDirector(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Director authorization token required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'director') {
            return res.status(403).json({ success: false, message: 'Center Director access required' });
        }
        req.center = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired director session' });
    }
}

// Student Authentication Middleware (Aadhar/Roll JWT)
function verifyStudent(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Student authorization token required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Student access required' });
        }
        req.student = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired student session' });
    }
}

// ============================================================
// 3. SEEDING & SYSTEM INITIALIZATION
// ============================================================
async function initSystem() {
    try {
        // Ensure Default Admin
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await Admin.create({
                adminId: 'admin',
                password: hashedPassword,
                name: 'BBCC Central Directorate'
            });
            console.log('✅ Initialized Default Super Admin: admin / admin123');
        }

        // Ensure Settings document
        let settings = await Settings.findOne();
        if (!settings) {
            await Settings.create({
                boardTitle: 'BBCC SKILL HUB',
                tagline: 'Empowering Educational Excellence & Certified Digital Learning',
                newsMarquee: '📢 Admissions Open 2026-27 Across All BBCC Certified Centers | Apply for Direct Affiliation Online | 24/7 Digital Helpline & BHARTI AI Live',
                affiliationFee: 999,
                banners: [
                    {
                        title: 'BBCC SKILL HUB Digital Platform',
                        subtitle: 'National Institutional Network & Certified Syllabus Repository',
                        image: ''
                    }
                ]
            });
            console.log('✅ Initialized Global Settings');
        }

        // Ensure Study Material repository
        const smCount = await StudyMaterial.countDocuments();
        if (smCount === 0) {
            await StudyMaterial.create({ notes: [], videos: [] });
            console.log('✅ Initialized Study Material Vault');
        }

        // Ensure static upload directories exist
        const uploadSubdirs = ['materials', 'students', 'kyc', 'branding', 'banners'];
        uploadSubdirs.forEach(d => {
            const dirPath = path.join(__dirname, 'public', 'uploads', d);
            if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
        });

        // Safe database repair for any oversized legacy base64 documents (BSON 16MB limit guard)
        try {
            const db = mongoose.connection.db;
            if (db) {
                const corruptedCenterId = new mongoose.Types.ObjectId('6aca0553e4a970eefd9c2efe');
                await db.collection('tuitioncenters').updateOne(
                    { _id: corruptedCenterId },
                    { $set: { "materials.$[elem].pdf": "", "materials.$[elem].file": "" } },
                    { arrayFilters: [{ "elem.pdf": { $exists: true } }] }
                ).catch(() => {});
            }
        } catch (dbSanErr) {
            console.warn('DB Sanitizer notice:', dbSanErr.message);
        }
    } catch (e) {
        console.error('System init notice:', e.message);
    }
}

// ============================================================
// 4. PUBLIC PORTAL APIS
// ============================================================

// 4.1 Public Board Configuration, Marquee & Banners
app.get('/api/public/config', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }
        const { keyId } = await getRazorpayClient();
        res.json({
            success: true,
            data: {
                boardTitle: settings.boardTitle || 'BBCC SKILL HUB',
                tagline: settings.tagline || 'Digital Skill & Coaching Institute Platform',
                heroTitle: settings.heroTitle || 'Empowering Certified Learning & Partner Institutes',
                heroDesc: settings.heroDesc || 'Explore authentic textbook syllabus notes, discover verified faculty, register coaching institutes directly with instant live activation, and verify student credentials via central roll numbers.',
                footerText: settings.footerText || 'BBCC SKILL HUB Digital Platform. Centralized Educational Verification & Partner Institute Network.',
                phone: settings.phone,
                email: settings.email,
                address: settings.address,
                boardLogo: settings.boardLogo || '',
                newsMarquee: settings.newsMarquee || '',
                affiliationFee: settings.affiliationFee !== undefined ? settings.affiliationFee : 999,
                geminiConfigured: !!(settings.geminiApiKey && settings.geminiApiKey.trim()),
                banners: settings.banners || [],
                gallery: settings.gallery || [],
                razorpayKeyId: keyId || '',
                razorpayConfigured: !!keyId
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.2 Aggregated Dual Promotional Banners (Auto-Expires in 30 Days)
app.get('/api/public/promotional-banners', async (req, res) => {
    try {
        const centers = await TuitionCenter.find(
            { isBlocked: false, 'promotionalBanners.0': { $exists: true } },
            { centerName: 1, username: 1, clogo: 1, promotionalBanners: 1 }
        );

        const now = new Date();
        const activeBanners = [];
        centers.forEach(c => {
            (c.promotionalBanners || []).forEach(b => {
                // Check if active and not expired (30-day lifespan)
                const isExpired = b.expiresAt && new Date(b.expiresAt) < now;
                if (b.active !== false && b.image && !isExpired) {
                    const daysLeft = b.expiresAt ? Math.max(1, Math.ceil((new Date(b.expiresAt) - now) / (1000 * 60 * 60 * 24))) : 30;
                    activeBanners.push({
                        _id: b._id,
                        centerId: c._id,
                        centerName: c.centerName,
                        username: c.username,
                        clogo: c.clogo,
                        title: b.title || c.centerName,
                        subtitle: b.subtitle || 'Affiliated Study Partner',
                        image: b.image,
                        link: b.link || `/institute.html?id=${c.username}`,
                        expiresAt: b.expiresAt,
                        daysLeft: daysLeft
                    });
                }
            });
        });

        res.json({ success: true, data: activeBanners });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.3 Public Registered Coaching Centers List
app.get('/api/public/centers', async (req, res) => {
    try {
        const centers = await TuitionCenter.find({}, {
            password: 0,
            paymentQr: 0
        }).sort({ createdAt: -1 });

        res.json({ success: true, data: centers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.4 Public Single Coaching Center Microsite by ID or Username
app.get('/api/public/center/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let center = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            center = await TuitionCenter.findById(id, { password: 0 });
        }
        if (!center) {
            center = await TuitionCenter.findOne({ username: id.toLowerCase() }, { password: 0 });
        }
        if (!center) {
            return res.status(404).json({ success: false, message: 'Institute profile not found' });
        }

        res.json({ success: true, data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.5 Public E-Library Books & Notes (Strictly Thumbnails / Covers, No Direct PDF Payload)
app.get('/api/public/books', async (req, res) => {
    try {
        const sm = await StudyMaterial.findOne();
        if (!sm || !sm.notes) {
            return res.json({ success: true, data: { notes: [], videos: [] } });
        }

        // Check if student query (Aadhar or Roll No) or student auth token is passed to check enrollment benefit
        let enrolledCenterId = null;
        let studentRecord = null;
        const studentQuery = req.query.studentQuery || req.query.aadhar || req.query.rollNo;
        if (studentQuery) {
            studentRecord = await Student.findOne({
                $or: [
                    { aadharNumber: studentQuery.trim().replace(/\s+/g, '') },
                    { rollNo: studentQuery.trim() }
                ]
            });
            if (studentRecord && studentRecord.centerId) {
                enrolledCenterId = studentRecord.centerId.toString();
            }
        } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            try {
                const decoded = jwt.verify(req.headers.authorization.split(' ')[1], JWT_SECRET);
                if (decoded && decoded.centerId) {
                    enrolledCenterId = decoded.centerId.toString();
                }
            } catch (e) {}
        }

        // Include ALL notes (Universal + Coaching Center uploaded notes) on BBCC SKILL HUB homepage
        const sanitizedNotes = sm.notes.map(n => {
            const isTargetCenter = n.targetCenterId && n.targetCenterId !== 'all';
            const isEnrolledFree = enrolledCenterId && isTargetCenter && (enrolledCenterId === n.targetCenterId.toString());
            return {
                _id: n._id,
                title: n.title,
                subject: n.subject,
                classLevel: n.classLevel,
                description: n.description,
                fileType: n.fileType,
                thumbnail: n.thumbnail,
                price: isEnrolledFree ? 0 : n.price,
                originalPrice: n.price,
                isEnrolledFree: Boolean(isEnrolledFree),
                targetCenterId: n.targetCenterId || 'all',
                targetCenterName: n.targetCenterName || 'All Centers (Universal)',
                isRawData: n.isRawData || false,
                hasFile: !!(n.pdf || n.file),
                downloadCount: n.downloadCount || 0,
                createdAt: n.createdAt
            };
        });

        res.json({
            success: true,
            data: {
                notes: sanitizedNotes,
                videos: sm.videos || []
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.6 Public Student Admission Inquiry Submission
app.post('/api/public/inquiry', async (req, res) => {
    try {
        const { centerId, studentName, parentName, mobile, targetClass, message } = req.body;
        if (!studentName || !mobile) {
            return res.status(400).json({ success: false, message: 'Student Name and Mobile Number are required' });
        }

        let cName = 'BBCC Central Board';
        if (centerId && mongoose.Types.ObjectId.isValid(centerId)) {
            const center = await TuitionCenter.findById(centerId);
            if (center) cName = center.centerName;
        }

        const inquiry = await AdmissionInquiry.create({
            centerId: centerId || null,
            centerName: cName,
            studentName: studentName.trim(),
            parentName: (parentName || '').trim(),
            mobile: mobile.trim(),
            targetClass: (targetClass || '').trim(),
            message: (message || '').trim()
        });

        res.json({ success: true, message: 'Admission inquiry submitted successfully!', id: inquiry._id });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.7 Public Student Roll Number & Digital Certificate Verification Desk
app.get('/api/public/verify-student/:query', async (req, res) => {
    try {
        const query = req.params.query.trim();
        if (!query) {
            return res.status(400).json({ success: false, message: 'Please enter Roll Number or Student ID' });
        }

        const regExp = new RegExp(`^${query}$`, 'i');
        const cleanQ = query.replace(/\s+/g, '');
        const student = await Student.findOne({
            $or: [
                { rollNo: regExp },
                { studentId: regExp },
                { certificateId: regExp },
                { aadharNumber: cleanQ },
                { aadharNumber: query }
            ]
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                verified: false,
                message: `No digital academic record found for Roll Number / Aadhar / ID: "${query}". Please check the credentials.`
            });
        }

        res.json({
            success: true,
            verified: true,
            data: {
                studentId: student.studentId,
                rollNo: student.rollNo,
                name: student.name,
                fatherName: student.fatherName || student.parentName || 'Registered Candidate',
                motherName: student.motherName || '',
                dob: student.dob || '',
                course: student.course || student.courseName || 'Academic Course',
                mode: student.mode || 'physical',
                classLevel: student.classLevel || 'Class 10th',
                marksGrade: student.marksGrade || 'A+',
                certificateId: student.certificateId || student.rollNo,
                issueDate: student.issueDate || student.createdAt,
                status: student.status || 'Certified & Verified',
                centerName: student.centerName || 'BBCC SKILL HUB Partner'
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.8 Public Course Explorer & Best Choice Comparison Desk
app.get('/api/public/courses', async (req, res) => {
    try {
        const centers = await TuitionCenter.find({ isBlocked: false }, {
            centerName: 1,
            username: 1,
            clogo: 1,
            address: 1,
            contactNumber: 1,
            courses: 1
        });
        const allCourses = [];
        centers.forEach(c => {
            (c.courses || []).forEach(course => {
                if (course.active !== false) {
                    allCourses.push({
                        _id: course._id,
                        courseName: course.courseName,
                        subject: course.subject || 'General',
                        classLevel: course.classLevel || 'All',
                        mode: course.mode || 'both', // 'online', 'physical', 'both'
                        onlineFee: course.onlineFee || 0,
                        offlineFee: course.offlineFee || 0,
                        batchTiming: course.batchTiming || 'Regular',
                        liveClassLink: course.liveClassLink || '',
                        description: course.description || '',
                        centerId: c._id,
                        centerName: c.centerName,
                        username: c.username,
                        clogo: c.clogo,
                        address: c.address,
                        contactNumber: c.contactNumber
                    });
                }
            });
        });
        res.json({ success: true, data: allCourses });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.9 Public Direct Student Self-Admission Desk (Full KYC with Aadhar)
app.post('/api/public/student-admission', async (req, res) => {
    try {
        const {
            centerId,
            courseId,
            courseName,
            mode,
            name,
            parentName,
            fatherName,
            mobile,
            parentMobile,
            email,
            address,
            aadharNumber,
            aadharDoc,
            photo,
            feePaid
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Student Name is required' });
        }
        if (!mobile || !mobile.trim()) {
            return res.status(400).json({ success: false, message: 'Student Contact Mobile is required' });
        }
        if (!aadharNumber || !aadharNumber.trim()) {
            return res.status(400).json({ success: false, message: 'Student Aadhar Card Number is required' });
        }
        if (!centerId) {
            return res.status(400).json({ success: false, message: 'Please select a Coaching Institute' });
        }

        const center = await TuitionCenter.findById(centerId);
        if (!center) {
            return res.status(404).json({ success: false, message: 'Selected Coaching Institute not found' });
        }

        const cleanAadhar = aadharNumber.trim().replace(/\s+/g, '');
        const rollNo = 'BBCC-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);
        const studentId = 'STU-' + Date.now().toString().slice(-6);

        const savedPhoto = saveBase64ToFile(photo, 'students', 'jpg');
        const savedAadharDoc = saveBase64ToFile(aadharDoc, 'kyc', 'pdf');

        // Check if student already registered with this Aadhar
        let existingStudent = await Student.findOne({ aadharNumber: cleanAadhar });
        if (existingStudent) {
            existingStudent.name = name.trim();
            existingStudent.parentName = (parentName || fatherName || existingStudent.parentName || '').trim();
            existingStudent.fatherName = (fatherName || parentName || existingStudent.fatherName || '').trim();
            existingStudent.mobile = mobile.trim();
            existingStudent.parentMobile = (parentMobile || '').trim();
            existingStudent.address = (address || existingStudent.address || '').trim();
            existingStudent.course = (courseName || existingStudent.course || 'Enrolled Course').trim();
            existingStudent.courseId = courseId || existingStudent.courseId || '';
            existingStudent.courseName = (courseName || existingStudent.courseName || '').trim();
            existingStudent.mode = mode || existingStudent.mode || 'physical';
            existingStudent.centerId = center._id;
            existingStudent.centerName = center.centerName;
            if (savedPhoto) existingStudent.photo = savedPhoto;
            if (savedAadharDoc) existingStudent.aadharDoc = savedAadharDoc;
            if (feePaid) existingStudent.feePaid = Number(feePaid) || 0;
            existingStudent.admissionStatus = 'Active';
            await existingStudent.save();

            return res.json({
                success: true,
                message: 'Admission details updated! You can now log into your Student Classroom.',
                data: {
                    rollNo: existingStudent.rollNo,
                    studentId: existingStudent.studentId,
                    name: existingStudent.name,
                    centerName: center.centerName,
                    courseName: existingStudent.courseName || existingStudent.course,
                    mode: existingStudent.mode,
                    aadharNumber: cleanAadhar
                }
            });
        }

        const newStudent = await Student.create({
            studentId,
            rollNo,
            name: name.trim(),
            parentName: (parentName || fatherName || '').trim(),
            fatherName: (fatherName || parentName || '').trim(),
            mobile: mobile.trim(),
            phone: mobile.trim(),
            parentMobile: (parentMobile || '').trim(),
            email: (email || '').trim(),
            address: (address || '').trim(),
            aadharNumber: cleanAadhar,
            aadharDoc: savedAadharDoc || '',
            photo: savedPhoto || '',
            course: (courseName || 'Certified Course').trim(),
            courseId: courseId || '',
            courseName: (courseName || '').trim(),
            mode: mode || 'physical', // 'online' or 'physical'
            centerId: center._id,
            centerName: center.centerName,
            feePaid: Number(feePaid) || 0,
            admissionStatus: 'Active',
            status: 'Certified & Enrolled',
            certificateId: rollNo,
            issueDate: new Date()
        });

        // Also record an AdmissionInquiry for Center's records
        try {
            await AdmissionInquiry.create({
                centerId: center._id,
                centerName: center.centerName,
                studentName: name.trim(),
                parentName: (parentName || fatherName || '').trim(),
                mobile: mobile.trim(),
                targetClass: (courseName || mode || '').trim(),
                message: `Direct Self-Admission (${mode ? mode.toUpperCase() : 'PHYSICAL'} MODE) via BBCC Skill Hub with Aadhar KYC: ${cleanAadhar.slice(-4)}`,
                status: 'enrolled'
            });
        } catch (e) {
            console.error('Admission inquiry record notice:', e.message);
        }

        res.json({
            success: true,
            message: 'Direct Admission Successful! Your Roll Number and Student Classroom are ready.',
            data: {
                rollNo: newStudent.rollNo,
                studentId: newStudent.studentId,
                name: newStudent.name,
                centerName: center.centerName,
                courseName: newStudent.courseName,
                mode: newStudent.mode,
                aadharNumber: cleanAadhar
            }
        });
    } catch (err) {
        console.error('Admission error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.10 Public Student Classroom Login (Aadhar Card Number / Roll Number)
app.post('/api/public/student-login', async (req, res) => {
    try {
        const { aadharNumber, query } = req.body;
        const searchVal = (aadharNumber || query || '').trim();
        if (!searchVal) {
            return res.status(400).json({ success: false, message: 'Please enter your Aadhar Card Number or Roll Number' });
        }

        const cleanAadhar = searchVal.replace(/\s+/g, '');
        const reg = new RegExp(`^${searchVal}$`, 'i');

        const student = await Student.findOne({
            $or: [
                { aadharNumber: cleanAadhar },
                { aadharNumber: searchVal },
                { rollNo: reg },
                { studentId: reg },
                { mobile: searchVal }
            ]
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'No student admission record found with this Aadhar / Roll Number. Please verify or complete Direct Admission.'
            });
        }

        const token = jwt.sign(
            {
                role: 'student',
                id: student._id,
                studentId: student.studentId,
                rollNo: student.rollNo,
                aadharNumber: student.aadharNumber
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            message: `Welcome back, ${student.name}!`,
            token,
            student: {
                _id: student._id,
                name: student.name,
                rollNo: student.rollNo,
                studentId: student.studentId,
                aadharNumber: student.aadharNumber,
                course: student.course || student.courseName,
                mode: student.mode || 'physical',
                centerName: student.centerName,
                photo: student.photo
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.11 Student Classroom Dashboard Data Fetch
app.get('/api/student/classroom', verifyStudent, async (req, res) => {
    try {
        const student = await Student.findById(req.student.id);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student record not found' });
        }

        let center = null;
        if (student.centerId) {
            center = await TuitionCenter.findById(student.centerId, { password: 0, paymentQr: 0 });
        }
        if (!center && student.centerName) {
            center = await TuitionCenter.findOne({ centerName: student.centerName }, { password: 0, paymentQr: 0 });
        }

        let matchedCourse = null;
        if (center && center.courses) {
            if (student.courseId) {
                matchedCourse = center.courses.id(student.courseId) || center.courses.find(c => c._id.toString() === student.courseId);
            }
            if (!matchedCourse && student.courseName) {
                matchedCourse = center.courses.find(c => c.courseName.toLowerCase() === student.courseName.toLowerCase());
            }
            if (!matchedCourse && center.courses.length > 0) {
                matchedCourse = center.courses[0];
            }
        }

        const liveLink = (matchedCourse && matchedCourse.liveClassLink) ? matchedCourse.liveClassLink : (center ? center.encryptedCallLink : '');

        let notes = [];
        if (center && center.materials) {
            notes = center.materials.map(m => ({
                _id: m._id,
                title: m.title,
                description: m.description,
                fileType: m.fileType,
                file: m.file || m.pdf,
                price: m.price || 0,
                isRawData: m.isRawData || false,
                downloadCount: m.downloadCount || 0
            }));
        }

        // Also include notes uploaded to StudyMaterial repository for this center or universal
        try {
            const sm = await StudyMaterial.findOne();
            if (sm && sm.notes) {
                const centerNotes = sm.notes.filter(n =>
                    (center && n.targetCenterId && n.targetCenterId.toString() === center._id.toString()) ||
                    n.targetCenterId === 'all'
                ).map(n => ({
                    _id: n._id,
                    title: n.title,
                    description: n.description,
                    fileType: n.fileType,
                    file: n.file || n.pdf,
                    price: 0,
                    isRawData: n.isRawData || false,
                    downloadCount: n.downloadCount || 0
                }));
                const existingTitles = new Set(notes.map(n => (n.title || '').toLowerCase()));
                for (const cn of centerNotes) {
                    if (!existingTitles.has((cn.title || '').toLowerCase())) {
                        notes.push(cn);
                    }
                }
            }
        } catch(e) {}

        res.json({
            success: true,
            data: {
                student: {
                    _id: student._id,
                    name: student.name,
                    rollNo: student.rollNo,
                    studentId: student.studentId,
                    parentName: student.parentName || student.fatherName || 'Not Provided',
                    mobile: student.mobile || student.phone || '',
                    parentMobile: student.parentMobile || '',
                    address: student.address || '',
                    photo: student.photo || '',
                    aadharNumber: student.aadharNumber || '',
                    course: student.course || student.courseName,
                    courseName: student.courseName || student.course,
                    mode: student.mode || 'physical', // 'online' or 'physical'
                    feePaid: student.feePaid || 0,
                    admissionStatus: student.admissionStatus || 'Active',
                    marksGrade: student.marksGrade || 'A+',
                    issueDate: student.issueDate || student.createdAt
                },
                center: center ? {
                    _id: center._id,
                    centerName: center.centerName,
                    directorName: center.directorName,
                    directorPhoto: center.directorPhoto,
                    clogo: center.clogo,
                    address: center.address,
                    contactNumber: center.contactNumber,
                    whatsappNumber: center.whatsappNumber,
                    headerNotice: center.headerNotice,
                    encryptedCallLink: center.encryptedCallLink
                } : null,
                course: matchedCourse ? {
                    _id: matchedCourse._id,
                    courseName: matchedCourse.courseName,
                    subject: matchedCourse.subject,
                    classLevel: matchedCourse.classLevel,
                    mode: matchedCourse.mode,
                    onlineFee: matchedCourse.onlineFee,
                    offlineFee: matchedCourse.offlineFee,
                    batchTiming: matchedCourse.batchTiming,
                    liveClassLink: matchedCourse.liveClassLink,
                    description: matchedCourse.description
                } : null,
                liveClassLink: liveLink,
                materials: notes
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.12 BHARTI AI Academic & Center Helpline Assistant (Powered by Google Gemini + Warm Human Emotion)
app.post('/api/public/bharti-chat', async (req, res) => {
    try {
        const { message, centerId } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message prompt required' });
        }

        const q = message.trim().toLowerCase();
        let targetCenter = null;

        // Context check if conversation is already scoped to a specific center
        if (centerId && mongoose.Types.ObjectId.isValid(centerId)) {
            targetCenter = await TuitionCenter.findById(centerId);
        }

        // If not specified, search centers database for matches
        if (!targetCenter) {
            const allCenters = await TuitionCenter.find({ isBlocked: false });
            targetCenter = allCenters.find(c =>
                q.includes(c.centerName.toLowerCase()) ||
                q.includes(c.username.toLowerCase()) ||
                q.includes((c.directorName || '').toLowerCase()) ||
                (c.address && q.includes(c.address.toLowerCase()))
            );

            // If still no direct match, check if student asks for top/any center
            if (!targetCenter && (q.includes('coaching') || q.includes('admission') || q.includes('center') || q.includes('director') || q.includes('contact') || q.includes('phone') || q.includes('call') || q.includes('help'))) {
                targetCenter = allCenters[0] || null;
            }
        }

        let encCall = '';
        let dirPhone = '';
        let dirWa = '';

        if (targetCenter) {
            encCall = targetCenter.encryptedCallLink || `https://meet.bbccskillhub.org/call/${targetCenter.username}`;
            dirPhone = targetCenter.contactNumber || targetCenter.whatsappNumber || '+91 98765 43210';
            const cleanMobile = dirPhone.replace(/[^0-9]/g, '').slice(-10);
            dirWa = `https://wa.me/91${cleanMobile}?text=${encodeURIComponent(`Namaste Director ${targetCenter.directorName}, I am contacting you through BHARTI AI Helpline regarding admission at ${targetCenter.centerName}.`)}`;
        } else {
            encCall = 'https://meet.bbccskillhub.org/call/central-helpline';
            dirPhone = '+91 98765 43210';
            dirWa = 'https://wa.me/919876543210?text=Hello%20BBCC%20Platform,%20I%20need%20academic%20assistance.';
        }

        let replyText = '';

        // Check if Super Admin configured Google Gemini API key
        const settings = await Settings.findOne();
        const geminiKey = settings?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY || '';

        if (geminiKey) {
            try {
                const centerContext = targetCenter
                    ? `Coaching Center: "${targetCenter.centerName}", Director: "${targetCenter.directorName}", Phone: "${dirPhone}", Address: "${targetCenter.address || 'Certified Center'}", Classes: "${targetCenter.fromClass} to ${targetCenter.toClass}", Encrypted Call Link: "${encCall}".`
                    : `BBCC SKILL HUB Central Platform, Helpline Phone: "${dirPhone}", Encrypted Call Link: "${encCall}".`;

                const geminiPrompt = `Aap BBCC SKILL HUB ki pyari, sneh-mayi aur emotional AI academic counselor & helpline guide ho jiska naam 'BHARTI AI' hai.
Aap ek dil se chahne wali baddi behen ya maa ki tarah behad prem, samman, dharas aur apnapan ke sath vidyarthiyon aur unke mata-pita se baat karti hain.
Hamesha 'Beta', 'Meri pyari beti / mere pyare bete', 'Aap', 'Aap bilkul chinta mat kijiye, main aapke sath hoon' jaise prem-bhare shabdon ka prayog kijiye.
Unki padhai, admission, batch ya samasya ko dhyan se suniye.
Agar koi problem ya complaint hai:
1. Sabse pehle unhe pyar se samjhaiye aur dharas bandhaiye.
2. Unhe bataiye ki unki private aur safe baat-cheet ke liye humne sabse pehle Encrypted Helpline Call Link di hai (jahan bina personal number reveal kiye encrypted call se guidance le sakte hain).
3. Uske baad Center Director ka call aur WhatsApp number bhi lovingly dijiye taaki unki har pareshani turant hal ho sake.
Context Information: ${centerContext}
User ka sandesh: "${message}"
Jawab sundar, madhur, emotional, Hindi/Hinglish mein aur helpful rakhein (maximum 2-3 short paragraphs).`;

                const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: geminiPrompt }] }],
                        generationConfig: { temperature: 0.7, maxOutputTokens: 600 }
                    })
                });

                if (aiRes.ok) {
                    const aiData = await aiRes.json();
                    const genText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (genText && genText.trim()) {
                        replyText = genText.trim();
                    }
                }
            } catch (gErr) {
                console.error('BHARTI Gemini call error:', gErr.message);
            }
        }

        if (!replyText) {
            // Warm, emotional fallbacks if Gemini key not set or during network failure
            if (targetCenter) {
                if (q.includes('fee') || q.includes('fees') || q.includes('paisa')) {
                    replyText = `Namaste mere pyare beta! Aap fees ya batch timing ko lekar bilkul tension mat lijiye. **${targetCenter.centerName}** mein Director **${targetCenter.directorName}** ji bahut sahyog karte hain aur deserving students ke liye scholarship suvidha bhi hai. Sabse pehle aap bina kisi jhijhak ke hamari **Encrypted Helpline Call Link** par connect kijiye jahan hamare counselors aapko pura support denge. Sath hi aap Director sir ko seedhe call ya WhatsApp bhi kar sakte hain, wo aapse bahut prem se baat karenge!`;
                } else if (q.includes('admission') || q.includes('enroll') || q.includes('join') || q.includes('dakhila')) {
                    replyText = `Namaste beta! Yeh sunkar bahut khushi hui ki aap **${targetCenter.centerName}** (${targetCenter.fromClass} se ${targetCenter.toClass}) mein padhai shuru karna chahte hain! Director **${targetCenter.directorName}** ji ke margdarshan mein yahan shandar taiyari hoti hai. Admission aur batch schedule ke liye: Pehle aap hamari **Encrypted Helpline Call Link** par judein, aur doosra aap Director sir ke personal number ya WhatsApp par sidhe baat kar sakte hain. Padhai mein khoob aage badhiye!`;
                } else if (q.includes('problem') || q.includes('complaint') || q.includes('issue') || q.includes('help') || q.includes('pareshani')) {
                    replyText = `Beta, aap bilkul ghabraiye mat, main aur poori BBCC team aapke sath hain. **${targetCenter.centerName}** se judi har pareshani ko hum prathmikta se hal karenge. Sabse pehle, aap hamari secure **Encrypted Helpline Call Link** par tap kijiye taaki confidential baat ho sake. Aur doosra, maine seedhe Director **${targetCenter.directorName}** ji ka direct phone aur WhatsApp number bhi provide kiya hai. Chinta chodiye aur relax kijiye!`;
                } else {
                    replyText = `Namaste mere pyare beta! Main BHARTI hoon, aapki apni BBCC Academic Didi. **${targetCenter.centerName}** (*${targetCenter.address || 'BBCC Affiliated Center'}*) ke baare mein aap jo bhi janna chahte hain, main madad karungi. Pehle aap hamari **Encrypted Voice/Video Helpline** par connect ho sakte hain, aur doosra aap Director **${targetCenter.directorName}** ji se direct phone ya WhatsApp par baat kar sakte hain. Khush rahiye aur man lagakar padhiye!`;
                }
            } else {
                if (q.includes('book') || q.includes('note') || q.includes('pdf') || q.includes('library')) {
                    replyText = `Namaste beta! Hamare **Central E-Library Vault** mein aapko syllabus aur standard textbook notes milenge. Jo free notes hain wo aap turant download kar sakte hain, aur premium notes 1-click Razorpay checkout se direct milte hain. Agar koi bhi sawal ho toh pehle hamari **Encrypted Digital Helpline** par connect kijiye ya seedhe Central Platform helpline par call kijiye!`;
                } else if (q.includes('affiliat') || q.includes('register') || q.includes('open') || q.includes('coaching')) {
                    replyText = `Namaste Sir/Madam! Koi bhi coaching ya tuition center hamare homepage se direct online affiliation le sakta hai. Registration ke baad instantly verified affiliation certificate milta hai aur center live show hone lagta hai! Agar registration mein koi bhi help chahiye toh pehle hamari **Encrypted Helpline Call Line** use karein ya humse seedhe call par judein!`;
                } else {
                    replyText = `Namaste mere pyare beta/beti! Main **BHARTI AI** hoon, aapki apni 24/7 BBCC Academic Mentor. Chahe coaching chuni ho, roll number verify karna ho ya padhai mein koi guidance chahiye ho, main dil se aapke sath hoon. Sabse pehle aap hamari **Encrypted Secure Helpline** par connect kar sakte hain, ya niche diye gaye phone aur WhatsApp par humse baat kar sakte hain!`;
                }
            }
        }

        res.json({
            success: true,
            reply: replyText,
            centerName: targetCenter ? targetCenter.centerName : 'BBCC Central Directorate',
            directorName: targetCenter ? targetCenter.directorName : 'Director General',
            encryptedCallLink: encCall,
            directorPhone: dirPhone,
            whatsappLink: dirWa
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// 5. RAZORPAY PAYMENT GATEWAY APIS & SELF-SERVICE REGISTRATION
// ============================================================

// 5.1 Create Order for E-Library Document (Free Instant Unlock or Paid Razorpay Order)
app.post('/api/pay/create-document-order', async (req, res) => {
    try {
        const { docId, payerName, payerPhone, payerEmail, studentQuery } = req.body;
        if (!docId) {
            return res.status(400).json({ success: false, message: 'Document ID is required' });
        }

        const sm = await StudyMaterial.findOne();
        if (!sm || !sm.notes) {
            return res.status(404).json({ success: false, message: 'E-Library repository unavailable' });
        }

        const note = sm.notes.id(docId) || sm.notes.find(n => n._id.toString() === docId);
        if (!note) {
            return res.status(404).json({ success: false, message: 'Document note not found in repository' });
        }

        const price = Math.max(0, Number(note.price) || 0);

        // Check if student is enrolled in this coaching center for 100% Free Access
        let isEnrolledStudent = false;
        const q = (studentQuery || '').trim().replace(/\s+/g, '');
        if (q && note.targetCenterId && note.targetCenterId !== 'all') {
            const student = await Student.findOne({
                $or: [{ aadharNumber: q }, { rollNo: (studentQuery || '').trim() }]
            });
            if (student && student.centerId && student.centerId.toString() === note.targetCenterId.toString()) {
                isEnrolledStudent = true;
            }
        } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            try {
                const decoded = jwt.verify(req.headers.authorization.split(' ')[1], JWT_SECRET);
                if (decoded && decoded.centerId && note.targetCenterId && decoded.centerId.toString() === note.targetCenterId.toString()) {
                    isEnrolledStudent = true;
                }
            } catch (e) {}
        }

        // CASE A: Free Document or Enrolled Student Benefit -> Instant 100% Free Delivery
        if (price === 0 || isEnrolledStudent) {
            note.downloadCount = (note.downloadCount || 0) + 1;
            await sm.save();

            await PaymentTransaction.create({
                orderId: (isEnrolledStudent ? 'ENROLLED_FREE_' : 'FREE_') + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
                paymentId: isEnrolledStudent ? 'ENROLLED_BENEFIT' : 'FREE_ACCESS',
                purpose: 'document_purchase',
                amount: 0,
                status: 'paid',
                payerName: (payerName || 'Student').trim(),
                payerPhone: (payerPhone || '').trim(),
                payerEmail: (payerEmail || '').trim(),
                docId: note._id.toString(),
                docTitle: note.title,
                paidAt: new Date()
            });

            return res.json({
                success: true,
                free: true,
                enrolledBenefit: isEnrolledStudent,
                file: note.file || note.pdf,
                fileName: note.fileName || (note.title.replace(/[^a-zA-Z0-9]/g, '_') + '.' + (note.fileType || 'pdf')),
                fileType: note.fileType || 'pdf',
                message: isEnrolledStudent 
                    ? `Enrolled Student Benefit: 100% Free download granted for student of ${note.targetCenterName}!`
                    : 'Free document ready for download!'
            });
        }

        // CASE B: Paid Document -> Generate Razorpay Order
        const { client, keyId } = await getRazorpayClient();
        if (!client) {
            return res.status(400).json({
                success: false,
                message: 'Payment Gateway is not configured. Please enter Razorpay Key ID and Secret in Admin Console to enable live payments.'
            });
        }

        const amountInPaise = Math.round(price * 100);
        const order = await client.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: 'doc_' + Date.now().toString().slice(-8),
            notes: {
                docId: note._id.toString(),
                docTitle: note.title.slice(0, 40),
                payerName: (payerName || '').slice(0, 30)
            }
        });

        await PaymentTransaction.create({
            orderId: order.id,
            purpose: 'document_purchase',
            amount: price,
            currency: 'INR',
            centerId: (note.targetCenterId && note.targetCenterId !== 'all') ? note.targetCenterId : '',
            centerName: note.targetCenterName || '',
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
            keyId: keyId,
            docTitle: note.title
        });
    } catch (err) {
        console.error('Document order error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5.2 Verify Document Payment & Deliver File Payload Directly for Download (80/20 Revenue Split)
app.post('/api/pay/verify-document-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, docId } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Missing transaction verification parameters' });
        }

        const { keySecret } = await getRazorpayClient();
        if (!keySecret) {
            return res.status(400).json({ success: false, message: 'Gateway secret key missing on server' });
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
            return res.status(400).json({ success: false, message: 'Payment verification failed: Signature mismatch' });
        }

        const sm = await StudyMaterial.findOne();
        const note = sm && sm.notes ? (sm.notes.id(docId) || sm.notes.find(n => n._id.toString() === docId)) : null;

        const tx = await PaymentTransaction.findOne({ orderId: razorpay_order_id });
        if (tx) {
            const centerShare = Math.round(tx.amount * 0.80);
            const platformCut = tx.amount - centerShare;
            tx.status = 'paid';
            tx.paymentId = razorpay_payment_id;
            tx.signature = razorpay_signature;
            tx.centerShare = centerShare;
            tx.platformCut = platformCut;
            tx.paidAt = new Date();
            await tx.save();

            // Credit Center Wallet
            let centerIdToCredit = tx.centerId;
            if (!centerIdToCredit && note && note.targetCenterId && note.targetCenterId !== 'all') {
                centerIdToCredit = note.targetCenterId;
            }
            if (centerIdToCredit) {
                try {
                    const center = await TuitionCenter.findById(centerIdToCredit);
                    if (center) {
                        center.walletBalance = (center.walletBalance || 0) + centerShare;
                        center.totalSalesVolume = (center.totalSalesVolume || 0) + tx.amount;
                        center.totalPlatformCut = (center.totalPlatformCut || 0) + platformCut;
                        await center.save();
                    }
                } catch (ce) {
                    console.error('Wallet credit error on verify:', ce.message);
                }
            }
        }

        if (note) {
            note.downloadCount = (note.downloadCount || 0) + 1;
            await sm.save();
        }

        res.json({
            success: true,
            message: 'Payment verified successfully! Document is downloading.',
            file: note ? (note.file || note.pdf) : null,
            fileName: note ? (note.fileName || (note.title.replace(/[^a-zA-Z0-9]/g, '_') + '.' + (note.fileType || 'pdf'))) : 'study_document.pdf'
        });
    } catch (err) {
        console.error('Verify doc payment error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5.3 Self-Service Coaching Center Registration: Create Affiliation Order
app.post('/api/pay/create-affiliation-order', async (req, res) => {
    try {
        const {
            centerName,
            username,
            password,
            directorName,
            contactNumber,
            whatsappNumber,
            email,
            fromClass,
            toClass,
            address
        } = req.body;

        if (!centerName || !username || !password || !directorName || !contactNumber || !address) {
            return res.status(400).json({ success: false, message: 'All required institute fields must be provided' });
        }

        const cleanUser = username.trim().toLowerCase();
        const existing = await TuitionCenter.findOne({ username: cleanUser });
        if (existing) {
            return res.status(400).json({ success: false, message: `Username "${cleanUser}" is already taken. Please choose another username.` });
        }

        // Check Admin Decided Affiliation Fee
        let settings = await Settings.findOne();
        const affiliationFee = settings && settings.affiliationFee !== undefined ? Math.max(0, Number(settings.affiliationFee)) : 999;

        // If Fee is 0 -> Instant Free Activation!
        if (affiliationFee === 0) {
            const hashedPassword = await bcrypt.hash(password, 10);
            const certId = 'BBCC-AFF-' + Date.now().toString().slice(-6);

            const newCenter = await TuitionCenter.create({
                centerName: centerName.trim(),
                username: cleanUser,
                password: hashedPassword,
                directorName: directorName.trim(),
                contactNumber: contactNumber.trim(),
                whatsappNumber: (whatsappNumber || contactNumber).trim(),
                email: (email || '').trim(),
                fromClass: fromClass || 'Class 6th',
                toClass: toClass || 'Class 12th',
                address: address.trim(),
                affiliationCertificateId: certId,
                affiliationPaid: true,
                isBlocked: false,
                dueAmount: 0
            });

            await PaymentTransaction.create({
                orderId: 'AFF_FREE_' + Date.now(),
                paymentId: 'FREE_AFFILIATION',
                purpose: 'coaching_affiliation',
                amount: 0,
                status: 'paid',
                payerName: directorName,
                payerPhone: contactNumber,
                payerEmail: email || '',
                centerId: newCenter._id.toString(),
                centerName: newCenter.centerName,
                paidAt: new Date()
            });

            return res.json({
                success: true,
                direct: true,
                message: 'Coaching center registered and activated instantly!',
                centerName: newCenter.centerName,
                username: newCenter.username
            });
        }

        // Paid Affiliation -> Razorpay Order
        const { client, keyId } = await getRazorpayClient();
        if (!client) {
            // Test Sandbox Instant Activation
            const hashedPassword = await bcrypt.hash(password, 10);
            const certId = 'BBCC-AFF-' + Date.now().toString().slice(-6);

            const newCenter = await TuitionCenter.create({
                centerName: centerName.trim(),
                username: cleanUser,
                password: hashedPassword,
                directorName: directorName.trim(),
                contactNumber: contactNumber.trim(),
                whatsappNumber: (whatsappNumber || contactNumber).trim(),
                email: (email || '').trim(),
                fromClass: fromClass || 'Class 6th',
                toClass: toClass || 'Class 12th',
                address: address.trim(),
                affiliationCertificateId: certId,
                affiliationPaid: true,
                isBlocked: false,
                dueAmount: 0
            });

            const orderId = 'TEST_AFF_' + Date.now();
            const paymentId = 'TEST_PAY_' + crypto.randomBytes(4).toString('hex').toUpperCase();

            await PaymentTransaction.create({
                orderId: orderId,
                paymentId: paymentId,
                purpose: 'coaching_affiliation',
                amount: affiliationFee,
                status: 'paid',
                payerName: directorName,
                payerPhone: contactNumber,
                payerEmail: email || '',
                centerId: newCenter._id.toString(),
                centerName: newCenter.centerName,
                paidAt: new Date()
            });

            return res.json({
                success: true,
                direct: true,
                isTestSandbox: true,
                orderId: orderId,
                paymentId: paymentId,
                amount: affiliationFee,
                message: 'Institute registered and activated instantly via test sandbox mode!',
                centerName: newCenter.centerName,
                username: newCenter.username
            });
        }

        const amountInPaise = Math.round(affiliationFee * 100);
        const order = await client.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: 'aff_' + Date.now().toString().slice(-8),
            notes: {
                centerName: centerName.slice(0, 35),
                username: cleanUser,
                directorName: directorName.slice(0, 35)
            }
        });

        const regData = {
            centerName: centerName.trim(),
            username: cleanUser,
            password: password,
            directorName: directorName.trim(),
            contactNumber: contactNumber.trim(),
            whatsappNumber: (whatsappNumber || contactNumber).trim(),
            email: (email || '').trim(),
            fromClass: fromClass || 'Class 6th',
            toClass: toClass || 'Class 12th',
            address: address.trim()
        };

        await PaymentTransaction.create({
            orderId: order.id,
            purpose: 'coaching_affiliation',
            amount: affiliationFee,
            currency: 'INR',
            status: 'created',
            payerName: directorName,
            payerPhone: contactNumber,
            payerEmail: email || '',
            centerName: centerName,
            regData: regData
        });

        res.json({
            success: true,
            direct: false,
            orderId: order.id,
            amount: affiliationFee,
            amountInPaise: amountInPaise,
            keyId: keyId,
            centerName: centerName,
            username: cleanUser
        });
    } catch (err) {
        console.error('Affiliation order creation error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5.4 Verify Affiliation Payment & INSTANTLY CREATE & ACTIVATE TUITION CENTER
app.post('/api/pay/verify-affiliation-order', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, regData: incomingRegData } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Missing transaction parameters' });
        }

        const { keySecret } = await getRazorpayClient();
        if (!keySecret) {
            return res.status(400).json({ success: false, message: 'Gateway secret missing' });
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
            return res.status(400).json({ success: false, message: 'Signature verification mismatch' });
        }

        // Retrieve stored regData from Transaction or fallback to incoming
        const txn = await PaymentTransaction.findOne({ orderId: razorpay_order_id });
        const reg = (txn && txn.regData) ? txn.regData : incomingRegData;

        if (!reg || !reg.username || !reg.password || !reg.centerName) {
            return res.status(400).json({ success: false, message: 'Registration payload missing' });
        }

        // Check if center was already created by duplicate hook
        let center = await TuitionCenter.findOne({ username: reg.username.toLowerCase() });
        if (!center) {
            const hashedPassword = await bcrypt.hash(reg.password, 10);
            const certId = 'BBCC-AFF-' + Date.now().toString().slice(-6);

            center = await TuitionCenter.create({
                centerName: reg.centerName.trim(),
                username: reg.username.toLowerCase().trim(),
                password: hashedPassword,
                directorName: reg.directorName.trim(),
                contactNumber: reg.contactNumber.trim(),
                whatsappNumber: (reg.whatsappNumber || reg.contactNumber).trim(),
                email: (reg.email || '').trim(),
                fromClass: reg.fromClass || 'Class 6th',
                toClass: reg.toClass || 'Class 12th',
                address: reg.address.trim(),
                affiliationCertificateId: certId,
                affiliationPaid: true,
                isBlocked: false,
                dueAmount: 0
            });
        }

        await PaymentTransaction.findOneAndUpdate(
            { orderId: razorpay_order_id },
            {
                status: 'paid',
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
                centerId: center._id.toString(),
                centerName: center.centerName,
                paidAt: new Date()
            }
        );

        res.json({
            success: true,
            message: 'Affiliation fee verified! Your coaching center is now officially registered, activated, and live on the BBCC homepage!',
            center: {
                id: center._id,
                centerName: center.centerName,
                username: center.username,
                directorName: center.directorName
            }
        });
    } catch (err) {
        console.error('Verify affiliation payment error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5.4B Create Student Admission Razorpay Order
app.post('/api/pay/create-admission-order', async (req, res) => {
    try {
        const { admissionData, amount } = req.body;
        if (!admissionData || !admissionData.name || !admissionData.mobile || !admissionData.centerId) {
            return res.status(400).json({ success: false, message: 'Student admission details are required' });
        }

        const fee = Math.max(0, Number(amount) || 0);
        if (fee === 0) {
            return res.json({ success: true, direct: true, message: 'Free Admission' });
        }

        const { client, keyId } = await getRazorpayClient();
        if (!client) {
            return res.status(400).json({
                success: false,
                message: 'Payment Gateway is not configured. Please enter Razorpay credentials in Admin Console or proceed with Direct Admission.'
            });
        }

        const amountInPaise = Math.round(fee * 100);
        const order = await client.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: 'adm_' + Date.now().toString().slice(-8),
            notes: {
                studentName: (admissionData.name || '').slice(0, 30),
                mobile: (admissionData.mobile || '').slice(0, 15),
                course: (admissionData.course || '').slice(0, 30)
            }
        });

        await PaymentTransaction.create({
            orderId: order.id,
            purpose: 'student_admission',
            amount: fee,
            currency: 'INR',
            status: 'created',
            payerName: admissionData.name,
            payerPhone: admissionData.mobile,
            centerId: admissionData.centerId,
            centerName: admissionData.centerName || '',
            regData: admissionData
        });

        res.json({
            success: true,
            direct: false,
            orderId: order.id,
            amount: fee,
            amountInPaise: amountInPaise,
            keyId: keyId,
            studentName: admissionData.name,
            courseName: admissionData.course
        });
    } catch (err) {
        console.error('Create admission order error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5.4C Verify Student Admission Payment
app.post('/api/pay/verify-admission-order', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, admissionData: incomingData } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Missing transaction parameters' });
        }

        const { keySecret } = await getRazorpayClient();
        if (!keySecret) {
            return res.status(400).json({ success: false, message: 'Gateway secret missing' });
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
            return res.status(400).json({ success: false, message: 'Payment signature mismatch' });
        }

        const txn = await PaymentTransaction.findOne({ orderId: razorpay_order_id });
        const adm = (txn && txn.regData) ? txn.regData : incomingData;

        if (!adm || !adm.name || !adm.centerId) {
            return res.status(400).json({ success: false, message: 'Admission payload missing' });
        }

        const cleanAadhar = (adm.aadharNumber || '').trim().replace(/\s+/g, '');
        const savedPhoto = saveBase64ToFile(adm.photo, 'students', 'jpg');
        const savedAadharDoc = saveBase64ToFile(adm.aadharDoc, 'kyc', 'pdf');
        const rollNo = 'BBCC-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);
        const studentId = 'STU-' + Date.now().toString().slice(-6);

        let student = cleanAadhar ? await Student.findOne({ aadharNumber: cleanAadhar }) : null;
        if (student) {
            student.name = adm.name.trim();
            student.parentName = (adm.parentName || adm.fatherName || student.parentName || '').trim();
            student.fatherName = (adm.fatherName || adm.parentName || student.fatherName || '').trim();
            student.mobile = (adm.mobile || student.mobile).trim();
            student.parentMobile = (adm.parentMobile || student.parentMobile || '').trim();
            student.address = (adm.address || student.address || '').trim();
            student.course = (adm.course || student.course || '').trim();
            student.courseId = adm.courseId || student.courseId || '';
            student.courseName = (adm.course || student.courseName || '').trim();
            student.mode = adm.learningMode || adm.mode || student.mode || 'physical';
            student.feePaid = (student.feePaid || 0) + (txn ? txn.amount : 0);
            student.admissionStatus = 'Active';
            if (savedPhoto) student.photo = savedPhoto;
            if (savedAadharDoc) student.aadharDoc = savedAadharDoc;
            await student.save();
        } else {
            student = await Student.create({
                studentId,
                rollNo,
                name: adm.name.trim(),
                parentName: (adm.parentName || adm.fatherName || '').trim(),
                fatherName: (adm.fatherName || adm.parentName || '').trim(),
                mobile: (adm.mobile || '').trim(),
                phone: (adm.mobile || '').trim(),
                parentMobile: (adm.parentMobile || '').trim(),
                email: (adm.email || '').trim(),
                address: (adm.address || '').trim(),
                aadharNumber: cleanAadhar,
                aadharDoc: savedAadharDoc || '',
                photo: savedPhoto || '',
                course: (adm.course || 'Enrolled Course').trim(),
                courseId: adm.courseId || '',
                courseName: (adm.course || 'Enrolled Course').trim(),
                centerId: adm.centerId,
                centerName: adm.centerName || 'BBCC Center',
                mode: adm.learningMode || adm.mode || 'physical',
                feePaid: txn ? txn.amount : 0,
                admissionStatus: 'Active',
                status: 'Certified & Enrolled',
                certificateId: rollNo,
                issueDate: new Date()
            });
        }

        await PaymentTransaction.findOneAndUpdate(
            { orderId: razorpay_order_id },
            {
                status: 'paid',
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
                studentId: student._id.toString(),
                paidAt: new Date()
            }
        );

        try {
            await AdmissionInquiry.create({
                centerId: adm.centerId,
                centerName: adm.centerName || '',
                studentName: adm.name.trim(),
                parentName: (adm.parentName || adm.fatherName || '').trim(),
                mobile: (adm.mobile || '').trim(),
                message: `Paid Admission (${adm.learningMode || adm.mode || 'Physical'}) via Razorpay (Txn: ${razorpay_payment_id})`,
                status: 'enrolled'
            });
        } catch(e) {}

        res.json({
            success: true,
            message: 'Admission payment verified! Student enrollment confirmed.',
            data: {
                rollNo: student.rollNo,
                studentId: student.studentId,
                name: student.name,
                centerName: student.centerName,
                courseName: student.courseName || student.course,
                learningMode: student.mode,
                aadharNumber: student.aadharNumber
            }
        });
    } catch(err) {
        console.error('Verify admission payment error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5.5 Create Coaching Unblock Razorpay Order
app.post('/api/pay/create-coaching-unblock-order', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.centerId;
        const center = await TuitionCenter.findById(centerId);
        if (!center) {
            return res.status(404).json({ success: false, message: 'Institute not found' });
        }

        const dueAmount = Math.max(0, Number(center.dueAmount) || 0);
        if (dueAmount <= 0) {
            return res.status(400).json({ success: false, message: 'No outstanding dues for this center account' });
        }

        const { client, keyId } = await getRazorpayClient();
        if (!client) {
            return res.status(400).json({
                success: false,
                message: 'Razorpay Gateway is not configured. Please contact BBCC Super Admin.'
            });
        }

        const amountInPaise = Math.round(dueAmount * 100);
        const order = await client.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: 'unb_' + Date.now().toString().slice(-8),
            notes: {
                centerId: center._id.toString(),
                centerName: center.centerName.slice(0, 40)
            }
        });

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
            keyId: keyId,
            centerName: center.centerName
        });
    } catch (err) {
        console.error('Create unblock order error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5.6 Verify Coaching Unblock Payment & AUTOMATICALLY UNBLOCK INSTANTLY
app.post('/api/pay/verify-coaching-unblock', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.centerId;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Missing payment parameters' });
        }

        const { keySecret } = await getRazorpayClient();
        if (!keySecret) {
            return res.status(400).json({ success: false, message: 'Gateway secret missing' });
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
            return res.status(400).json({ success: false, message: 'Signature verification mismatch' });
        }

        const center = await TuitionCenter.findById(centerId);
        if (!center) {
            return res.status(404).json({ success: false, message: 'Center not found' });
        }

        // 100% AUTOMATED UNBLOCK & REACTIVATION
        center.isBlocked = false;
        center.blockReason = '';
        center.dueAmount = 0;
        await center.save();

        await PaymentTransaction.findOneAndUpdate(
            { orderId: razorpay_order_id },
            {
                status: 'paid',
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
                paidAt: new Date()
            }
        );

        res.json({
            success: true,
            message: 'Payment verified! Your coaching center portal is now 100% unblocked and reactivated.'
        });
    } catch (err) {
        console.error('Verify unblock error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// 6. AUTHENTICATION & LOGIN APIS
// ============================================================

// 6.1 Multi-Role Login (Super Admin or Coaching Director)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password required' });
        }

        const cleanUsername = username.trim().toLowerCase();

        // 1. Super Admin Authentication
        if (role === 'superadmin' || cleanUsername === 'admin') {
            const admin = await Admin.findOne({ adminId: cleanUsername });
            if (!admin) {
                return res.status(401).json({ success: false, message: 'Invalid Admin credentials' });
            }
            const match = await bcrypt.compare(password, admin.password);
            if (!match) {
                return res.status(401).json({ success: false, message: 'Invalid Admin password' });
            }
            admin.lastLogin = new Date();
            await admin.save();

            const token = jwt.sign({ id: admin._id, adminId: admin.adminId, role: 'superadmin' }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({
                success: true,
                role: 'superadmin',
                token: token,
                redirect: '/admin-console.html',
                user: { name: admin.name, id: admin.adminId }
            });
        }

        // 2. Coaching Center Director Authentication
        const center = await TuitionCenter.findOne({ username: cleanUsername });
        if (!center) {
            return res.status(401).json({ success: false, message: 'No registered coaching center with this username' });
        }

        const match = await bcrypt.compare(password, center.password);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid Director password' });
        }

        const token = jwt.sign({ centerId: center._id.toString(), username: center.username, role: 'director' }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({
            success: true,
            role: 'director',
            token: token,
            redirect: '/director-portal.html',
            user: {
                id: center._id,
                name: center.directorName,
                centerName: center.centerName,
                isBlocked: center.isBlocked
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// 7. COACHING DIRECTOR PORTAL APIS
// ============================================================

// 7.1 Get My Center Profile & Dues Status
app.get('/api/director/profile', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId, { password: 0 });
        if (!center) return res.status(404).json({ success: false, message: 'Center profile not found' });
        res.json({ success: true, data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.2 Update Center Profile & Custom Header/Footer/Contacts
app.put('/api/director/profile', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

        const allowed = [
            'contactNumber', 'whatsappNumber', 'email', 'address', 'description',
            'encryptedCallLink', 'clogo', 'directorPhoto', 'fromClass', 'toClass',
            'headerNotice', 'footerText', 'socials'
        ];
        allowed.forEach(k => {
            if (req.body[k] !== undefined) center[k] = req.body[k];
        });

        await center.save();
        res.json({ success: true, message: 'Institute profile updated successfully!', data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.3 Faculty Member Management
app.post('/api/director/teachers', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        const { name, subject, qualification, photo, phone, experience, class: cls } = req.body;
        if (!name || !subject) return res.status(400).json({ success: false, message: 'Name and Subject required' });

        center.teachers.push({
            name: name.trim(),
            subject: subject.trim(),
            class: cls || 'All',
            qualification: qualification || 'Certified Faculty',
            photo: photo || '',
            phone: phone || '',
            experience: experience || '3+ Years'
        });

        await center.save();
        res.json({ success: true, message: 'Faculty member added!', data: center.teachers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/director/teachers/:tid', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        center.teachers = center.teachers.filter(t => t._id.toString() !== req.params.tid);
        await center.save();
        res.json({ success: true, message: 'Faculty member removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.4 Center Promotional Banners Management (30-Day Auto Expiry)
app.post('/api/director/banners', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        const { title, subtitle, image, link } = req.body;
        if (!image) return res.status(400).json({ success: false, message: 'Banner image is required' });

        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        center.promotionalBanners.push({
            title: (title || '').trim(),
            subtitle: (subtitle || '').trim(),
            image: image,
            link: (link || '').trim(),
            active: true,
            expiresAt: expiresAt,
            uploadedAt: new Date()
        });

        await center.save();
        res.json({ success: true, message: 'Promotional banner uploaded! Valid for 30 days.', data: center.promotionalBanners });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/director/banners/:bid', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        center.promotionalBanners = center.promotionalBanners.filter(b => b._id.toString() !== req.params.bid);
        await center.save();
        res.json({ success: true, message: 'Promotional banner deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.4B Courses & Batch Schedules Management (Online vs Physical Modes)
app.post('/api/director/courses', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        if (!center) return res.status(404).json({ success: false, message: 'Center not found' });
        const { courseName, subject, classLevel, mode, onlineFee, offlineFee, batchTiming, liveClassLink, description } = req.body;
        if (!courseName || !courseName.trim()) {
            return res.status(400).json({ success: false, message: 'Course name is required' });
        }
        center.courses.push({
            courseName: courseName.trim(),
            subject: (subject || 'General').trim(),
            classLevel: (classLevel || 'All').trim(),
            mode: mode || 'both', // 'online', 'physical', 'both'
            onlineFee: Math.max(0, Number(onlineFee) || 0),
            offlineFee: Math.max(0, Number(offlineFee) || 0),
            batchTiming: (batchTiming || 'Regular Batch').trim(),
            liveClassLink: (liveClassLink || '').trim(),
            description: (description || '').trim(),
            active: true
        });
        await center.save();
        res.json({ success: true, message: 'Course created successfully!', data: center.courses });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/director/courses', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        res.json({ success: true, data: center ? center.courses : [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/director/courses/:cid', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        const course = center.courses.id(req.params.cid);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
        const { courseName, subject, classLevel, mode, onlineFee, offlineFee, batchTiming, liveClassLink, description, active } = req.body;
        if (courseName !== undefined) course.courseName = courseName.trim();
        if (subject !== undefined) course.subject = subject.trim();
        if (classLevel !== undefined) course.classLevel = classLevel.trim();
        if (mode !== undefined) course.mode = mode;
        if (onlineFee !== undefined) course.onlineFee = Math.max(0, Number(onlineFee) || 0);
        if (offlineFee !== undefined) course.offlineFee = Math.max(0, Number(offlineFee) || 0);
        if (batchTiming !== undefined) course.batchTiming = batchTiming.trim();
        if (liveClassLink !== undefined) course.liveClassLink = liveClassLink.trim();
        if (description !== undefined) course.description = description.trim();
        if (active !== undefined) course.active = Boolean(active);
        await center.save();
        res.json({ success: true, message: 'Course updated successfully!', data: course });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/director/courses/:cid', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        center.courses = center.courses.filter(c => c._id.toString() !== req.params.cid);
        await center.save();
        res.json({ success: true, message: 'Course deleted successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.4C Center Bank Details & Earnings Ledger (80/20 Revenue Split)
app.put('/api/director/bank-details', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        if (!center) return res.status(404).json({ success: false, message: 'Center not found' });
        const { accountHolder, bankName, accountNumber, ifscCode, upiId } = req.body;
        if (!center.bankDetails) center.bankDetails = {};
        if (accountHolder !== undefined) center.bankDetails.accountHolder = accountHolder.trim();
        if (bankName !== undefined) center.bankDetails.bankName = bankName.trim();
        if (accountNumber !== undefined) center.bankDetails.accountNumber = accountNumber.trim();
        if (ifscCode !== undefined) center.bankDetails.ifscCode = ifscCode.trim();
        if (upiId !== undefined) center.bankDetails.upiId = upiId.trim();
        await center.save();
        res.json({ success: true, message: 'Bank details saved successfully!', data: center.bankDetails });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/director/earnings', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        if (!center) return res.status(404).json({ success: false, message: 'Center not found' });
        const transactions = await PaymentTransaction.find({
            $or: [
                { centerId: center._id.toString() },
                { centerName: center.centerName }
            ],
            status: 'paid'
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            data: {
                walletBalance: center.walletBalance || 0,
                totalSalesVolume: center.totalSalesVolume || 0,
                totalPlatformCut: center.totalPlatformCut || 0,
                bankDetails: center.bankDetails || {},
                transactions: transactions
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.4D AI & Festive Promotional Banner Copy Generator
app.post('/api/director/ai-banner-generator', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        const { prompt, festivalName, discountText } = req.body;
        const settings = await Settings.findOne();
        const geminiKey = settings?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY || '';

        let generatedTitle = `${festivalName || 'New Session'} Mega Admission Fest`;
        let generatedSubtitle = `${discountText || 'Special Scholarship & Free Kit'} | Enroll at ${center.centerName}`;
        let suggestedTheme = 'gold-aurora';

        if (geminiKey) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            role: 'user',
                            parts: [{
                                text: `Generate a high-converting promotional banner title, catchy subtitle, and color theme for a coaching institute banner.
Institute: ${center.centerName}
Festival/Occasion: ${festivalName || 'Admissions Open'}
Discount/Offer: ${discountText || 'Special Concession'}
User Prompt: ${prompt || ''}
Output STRICTLY valid JSON with keys "title", "subtitle", "suggestedTheme" (one of "gold-aurora", "crimson-festive", "sapphire-academic", "emerald-success").`
                            }]
                        }]
                    })
                });
                if (response.ok) {
                    const data = await response.json();
                    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(cleaned);
                    if (parsed.title) generatedTitle = parsed.title;
                    if (parsed.subtitle) generatedSubtitle = parsed.subtitle;
                    if (parsed.suggestedTheme) suggestedTheme = parsed.suggestedTheme;
                }
            } catch (e) {
                console.error('AI banner gemini call error:', e.message);
            }
        }

        res.json({
            success: true,
            data: {
                title: generatedTitle,
                subtitle: generatedSubtitle,
                suggestedTheme: suggestedTheme
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.5 Student Enrolment & Roll Number Roster Management
app.post('/api/director/students', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        const { name, rollNo, fatherName, course, classLevel, marksGrade, phone, email, dob } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Student Name is required' });

        const cleanRoll = (rollNo && rollNo.trim()) ? rollNo.trim() : ('BBCC-' + Date.now().toString().slice(-6));
        const studentId = 'STU-' + Date.now().toString().slice(-6);

        const existing = await Student.findOne({ rollNo: cleanRoll });
        if (existing) {
            return res.status(400).json({ success: false, message: `Roll Number "${cleanRoll}" is already registered!` });
        }

        const student = await Student.create({
            studentId: studentId,
            rollNo: cleanRoll,
            name: name.trim(),
            fatherName: (fatherName || '').trim(),
            dob: (dob || '').trim(),
            phone: (phone || '').trim(),
            email: (email || '').trim(),
            course: course || 'Standard Curriculum',
            classLevel: classLevel || 'Class 10th',
            marksGrade: marksGrade || 'A+',
            certificateId: cleanRoll,
            centerId: center._id,
            centerName: center.centerName,
            status: 'Certified & Verified'
        });

        res.json({ success: true, message: 'Student successfully registered with verified Roll Number!', data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/director/students', verifyDirector, async (req, res) => {
    try {
        const students = await Student.find({ centerId: req.center.centerId }).sort({ createdAt: -1 });
        res.json({ success: true, data: students });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/director/students/:sid', verifyDirector, async (req, res) => {
    try {
        await Student.findOneAndDelete({ _id: req.params.sid, centerId: req.center.centerId });
        res.json({ success: true, message: 'Student record removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.6 Center Study Notes & Raw Curriculum Materials (with 80/20 Marketplace MRP)
app.post('/api/director/materials', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        const { title, description, price, fileType, pdf, file, link, isRawData } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'Title required' });

        const itemPrice = Math.max(0, Number(price) || 0);
        const savedFilePath = saveBase64ToFile(pdf || file, 'materials', fileType || 'pdf');

        center.materials.push({
            title: title.trim(),
            description: description || '',
            price: itemPrice,
            fileType: fileType || 'pdf',
            pdf: savedFilePath,
            file: savedFilePath,
            link: link || '',
            isRawData: Boolean(isRawData)
        });

        await center.save();

        // Sync with Central Study Material Vault for student discovery
        try {
            let sm = await StudyMaterial.findOne();
            if (!sm) sm = await StudyMaterial.create({ notes: [], videos: [] });
            sm.notes.push({
                title: title.trim(),
                subject: center.centerName,
                classLevel: 'All Classes',
                description: description || '',
                fileType: fileType || 'pdf',
                pdf: savedFilePath,
                file: savedFilePath,
                price: itemPrice,
                targetCenterId: center._id.toString(),
                targetCenterName: center.centerName,
                isRawData: Boolean(isRawData),
                createdAt: new Date()
            });
            await sm.save();
        } catch (smErr) {
            console.error('Study material sync notice:', smErr.message);
        }

        res.json({ success: true, message: 'Study material uploaded successfully!', data: center.materials });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/director/materials/:mid', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        center.materials = center.materials.filter(m => m._id.toString() !== req.params.mid);
        await center.save();
        res.json({ success: true, message: 'Study material deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.7 Admission Inquiries to this Center
app.get('/api/director/inquiries', verifyDirector, async (req, res) => {
    try {
        const inquiries = await AdmissionInquiry.find({ centerId: req.center.centerId }).sort({ createdAt: -1 });
        res.json({ success: true, data: inquiries });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.8 Get Printable Wall Affiliation Certificate Data
app.get('/api/director/affiliation-certificate', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

        res.json({
            success: true,
            data: {
                centerName: center.centerName,
                directorName: center.directorName,
                affiliationId: center.affiliationCertificateId || ('BBCC-AFF-' + center._id.toString().slice(-6).toUpperCase()),
                affiliationDate: center.affiliationDate || center.createdAt,
                address: center.address,
                fromClass: center.fromClass,
                toClass: center.toClass,
                boardTitle: 'BBCC SKILL HUB — Digital Skill & Coaching Institute Platform',
                status: center.isBlocked ? 'Suspended' : 'Officially Affiliated & Certified'
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.9 Get Official Central Board Raw Data & Syllabus Assigned to this Center
app.get('/api/director/raw-materials', verifyDirector, async (req, res) => {
    try {
        const sm = await StudyMaterial.findOne();
        if (!sm || !sm.notes) return res.json({ success: true, data: [] });

        const centerId = req.center.centerId.toString();
        // Return notes targeted to 'all' or this specific center
        const targeted = sm.notes.filter(n => 
            !n.targetCenterId || 
            n.targetCenterId === 'all' || 
            n.targetCenterId === centerId
        ).map(n => ({
            _id: n._id,
            title: n.title,
            subject: n.subject,
            classLevel: n.classLevel,
            description: n.description,
            fileType: n.fileType,
            fileName: n.fileName,
            file: n.file || n.pdf,
            isRawData: n.isRawData || false,
            targetCenterName: n.targetCenterName,
            createdAt: n.createdAt
        }));

        res.json({ success: true, data: targeted });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// 8. SUPER ADMIN CONSOLE APIS (FULL MASTER CENTER & DOC EDITORS)
// ============================================================

// 8.1 Center Management: Create Partner Center
app.post('/api/admin/centers', verifySuperAdmin, async (req, res) => {
    try {
        const { centerName, username, password, directorName, address, contactNumber, fromClass, toClass } = req.body;
        if (!centerName || !username || !password || !directorName) {
            return res.status(400).json({ success: false, message: 'Center name, username, password, and director name required' });
        }

        const cleanUser = username.trim().toLowerCase();
        const existing = await TuitionCenter.findOne({ username: cleanUser });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Username is already taken by another center' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const certId = 'BBCC-AFF-' + Date.now().toString().slice(-6);

        const center = await TuitionCenter.create({
            centerName: centerName.trim(),
            username: cleanUser,
            password: hashedPassword,
            directorName: directorName.trim(),
            address: address || '',
            contactNumber: contactNumber || '',
            fromClass: fromClass || 'Class 6th',
            toClass: toClass || 'Class 12th',
            affiliationCertificateId: certId,
            affiliationPaid: true
        });

        res.json({ success: true, message: 'New partner center registered successfully!', data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.2 MASTER CENTER EDITOR: Super Admin Full Edit Access to ANY Coaching Center Data
app.put('/api/admin/centers/:id', verifySuperAdmin, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.params.id);
        if (!center) return res.status(404).json({ success: false, message: 'Coaching center not found' });

        const {
            centerName,
            username,
            password,
            directorName,
            contactNumber,
            whatsappNumber,
            email,
            address,
            fromClass,
            toClass,
            encryptedCallLink,
            description,
            headerNotice,
            footerText,
            clogo,
            directorPhoto,
            dueAmount,
            isBlocked,
            blockReason,
            socials
        } = req.body;

        if (centerName !== undefined) center.centerName = centerName.trim();
        if (directorName !== undefined) center.directorName = directorName.trim();
        if (contactNumber !== undefined) center.contactNumber = contactNumber.trim();
        if (whatsappNumber !== undefined) center.whatsappNumber = whatsappNumber.trim();
        if (email !== undefined) center.email = email.trim();
        if (address !== undefined) center.address = address.trim();
        if (fromClass !== undefined) center.fromClass = fromClass;
        if (toClass !== undefined) center.toClass = toClass;
        if (encryptedCallLink !== undefined) center.encryptedCallLink = encryptedCallLink.trim();
        if (description !== undefined) center.description = description;
        if (headerNotice !== undefined) center.headerNotice = headerNotice;
        if (footerText !== undefined) center.footerText = footerText;
        if (clogo !== undefined) center.clogo = clogo;
        if (directorPhoto !== undefined) center.directorPhoto = directorPhoto;
        if (dueAmount !== undefined) center.dueAmount = Number(dueAmount) || 0;
        if (isBlocked !== undefined) center.isBlocked = Boolean(isBlocked);
        if (blockReason !== undefined) center.blockReason = blockReason;
        if (socials !== undefined) center.socials = { ...center.socials, ...socials };

        // Username update check
        if (username && username.trim().toLowerCase() !== center.username) {
            const checkUser = username.trim().toLowerCase();
            const exists = await TuitionCenter.findOne({ username: checkUser });
            if (exists) {
                return res.status(400).json({ success: false, message: 'New username already taken by another center' });
            }
            center.username = checkUser;
        }

        // Optional Password reset
        if (password && password.trim()) {
            center.password = await bcrypt.hash(password.trim(), 10);
        }

        await center.save();
        res.json({ success: true, message: 'Coaching center profile updated by Super Admin!', data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.3 Delete Center
app.delete('/api/admin/centers/:id', verifySuperAdmin, async (req, res) => {
    try {
        await TuitionCenter.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Coaching center removed from system' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.4 Center Block / Unblock / Set Dues
app.post('/api/admin/centers/:id/block', verifySuperAdmin, async (req, res) => {
    try {
        const { isBlocked, blockReason, dueAmount, paymentQr } = req.body;
        const center = await TuitionCenter.findById(req.params.id);
        if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

        center.isBlocked = Boolean(isBlocked);
        if (blockReason !== undefined) center.blockReason = blockReason;
        if (dueAmount !== undefined) center.dueAmount = Number(dueAmount) || 0;
        if (paymentQr !== undefined) center.paymentQr = paymentQr;

        await center.save();
        res.json({ success: true, message: `Center ${center.isBlocked ? 'suspended' : 'activated'} successfully!`, data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.5 Central E-Library: Get All Books with Full Admin Control
app.get('/api/admin/books', verifySuperAdmin, async (req, res) => {
    try {
        const sm = await StudyMaterial.findOne();
        res.json({ success: true, data: sm ? sm.notes : [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.6 Central E-Library: Upload Document Note / Raw Data
app.post('/api/admin/books', verifySuperAdmin, async (req, res) => {
    try {
        const {
            title,
            subject,
            classLevel,
            description,
            fileType,
            thumbnail,
            file,
            fileName,
            price,
            targetCenterId,
            targetCenterName,
            isRawData
        } = req.body;

        if (!title) return res.status(400).json({ success: false, message: 'Document title is required' });

        let sm = await StudyMaterial.findOne();
        if (!sm) sm = await StudyMaterial.create({ notes: [], videos: [] });

        sm.notes.push({
            title: title.trim(),
            subject: subject || 'General',
            classLevel: classLevel || 'All Classes',
            description: description || '',
            fileType: (fileType || 'pdf').toLowerCase(),
            thumbnail: thumbnail || '',
            file: file || '',
            pdf: file || '',
            fileName: fileName || `${title.replace(/[^a-zA-Z0-9]/g, '_')}.${fileType || 'pdf'}`,
            price: Math.max(0, Number(price) || 0),
            targetCenterId: targetCenterId || 'all',
            targetCenterName: targetCenterName || 'All Centers (Universal)',
            isRawData: Boolean(isRawData)
        });

        await sm.save();
        res.json({ success: true, message: 'Document added to Central E-Library!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.7 Central E-Library: MASTER DOCUMENT EDITOR (Edit Any Document)
app.put('/api/admin/books/:id', verifySuperAdmin, async (req, res) => {
    try {
        const sm = await StudyMaterial.findOne();
        if (!sm || !sm.notes) return res.status(404).json({ success: false, message: 'Repository empty' });

        const note = sm.notes.id(req.params.id) || sm.notes.find(n => n._id.toString() === req.params.id);
        if (!note) return res.status(404).json({ success: false, message: 'Document not found' });

        const {
            title,
            subject,
            classLevel,
            description,
            fileType,
            thumbnail,
            file,
            fileName,
            price,
            targetCenterId,
            targetCenterName,
            isRawData
        } = req.body;

        if (title !== undefined) note.title = title.trim();
        if (subject !== undefined) note.subject = subject.trim();
        if (classLevel !== undefined) note.classLevel = classLevel.trim();
        if (description !== undefined) note.description = description;
        if (fileType !== undefined) note.fileType = fileType.toLowerCase();
        if (thumbnail !== undefined && thumbnail !== '') note.thumbnail = thumbnail;
        if (file !== undefined && file !== '') {
            note.file = file;
            note.pdf = file;
        }
        if (fileName !== undefined) note.fileName = fileName;
        if (price !== undefined) note.price = Math.max(0, Number(price) || 0);
        if (targetCenterId !== undefined) note.targetCenterId = targetCenterId;
        if (targetCenterName !== undefined) note.targetCenterName = targetCenterName;
        if (isRawData !== undefined) note.isRawData = Boolean(isRawData);

        await sm.save();
        res.json({ success: true, message: 'Document updated successfully!', data: note });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.8 Delete E-Library Book Note
app.delete('/api/admin/books/:id', verifySuperAdmin, async (req, res) => {
    try {
        const sm = await StudyMaterial.findOne();
        if (!sm) return res.status(404).json({ success: false, message: 'Vault empty' });
        sm.notes = sm.notes.filter(n => n._id.toString() !== req.params.id);
        await sm.save();
        res.json({ success: true, message: 'Document removed from E-Library' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.9 Save Razorpay Gateway Credentials & Full Platform CMS Settings
app.put('/api/admin/settings', verifySuperAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});

        const {
            razorpayKeyId,
            razorpayKeySecret,
            razorpayEnabled,
            boardTitle,
            tagline,
            heroTitle,
            heroDesc,
            footerText,
            geminiApiKey,
            phone,
            email,
            address,
            boardLogo,
            newsMarquee,
            affiliationFee
        } = req.body;

        // ONLY overwrite Razorpay Keys & Gemini Key if a non-empty string was explicitly provided!
        if (razorpayKeyId !== undefined && razorpayKeyId.trim() !== '') {
            settings.razorpayKeyId = razorpayKeyId.trim();
        }
        if (razorpayKeySecret !== undefined && razorpayKeySecret.trim() !== '') {
            settings.razorpayKeySecret = razorpayKeySecret.trim();
        }
        if (razorpayEnabled !== undefined) settings.razorpayEnabled = Boolean(razorpayEnabled);
        if (boardTitle !== undefined) settings.boardTitle = boardTitle.trim();
        if (tagline !== undefined) settings.tagline = tagline.trim();
        if (heroTitle !== undefined) settings.heroTitle = heroTitle.trim();
        if (heroDesc !== undefined) settings.heroDesc = heroDesc.trim();
        if (footerText !== undefined) settings.footerText = footerText.trim();
        if (geminiApiKey !== undefined && geminiApiKey.trim() !== '') {
            settings.geminiApiKey = geminiApiKey.trim();
        }
        if (phone !== undefined) settings.phone = phone.trim();
        if (email !== undefined) settings.email = email.trim();
        if (address !== undefined) settings.address = address.trim();
        if (boardLogo !== undefined) settings.boardLogo = boardLogo;
        if (newsMarquee !== undefined) settings.newsMarquee = newsMarquee;
        if (affiliationFee !== undefined) settings.affiliationFee = Math.max(0, Number(affiliationFee));

        await settings.save();
        res.json({ success: true, message: 'Settings & Platform CMS updated successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.9A Super Admin Authorized Settings Overview
app.get('/api/admin/settings', verifySuperAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});

        res.json({
            success: true,
            data: {
                boardTitle: settings.boardTitle || 'BBCC SKILL HUB',
                tagline: settings.tagline || 'Digital Skill & Coaching Institute Platform',
                heroTitle: settings.heroTitle || 'Empowering Certified Learning & Partner Institutes',
                heroDesc: settings.heroDesc || '',
                footerText: settings.footerText || '',
                phone: settings.phone || '',
                email: settings.email || '',
                address: settings.address || '',
                boardLogo: settings.boardLogo || '',
                newsMarquee: settings.newsMarquee || '',
                affiliationFee: settings.affiliationFee !== undefined ? settings.affiliationFee : 999,
                razorpayKeyId: settings.razorpayKeyId || '',
                hasRazorpaySecret: Boolean(settings.razorpayKeySecret && settings.razorpayKeySecret.trim()),
                razorpayKeySecretMasked: settings.razorpayKeySecret ? '••••••••' + settings.razorpayKeySecret.slice(-4) : '',
                hasGeminiKey: Boolean(settings.geminiApiKey && settings.geminiApiKey.trim()),
                geminiApiKeyMasked: settings.geminiApiKey ? '••••••••' + settings.geminiApiKey.slice(-4) : '',
                razorpayConfigured: Boolean(settings.razorpayKeyId && settings.razorpayKeySecret),
                geminiConfigured: Boolean(settings.geminiApiKey)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.9B Dedicated Update for Razorpay Gateway Keys
app.put('/api/admin/gateway-keys', verifySuperAdmin, async (req, res) => {
    try {
        const rawKeyId = req.body.keyId || req.body.razorpayKeyId;
        const rawKeySecret = req.body.keySecret || req.body.razorpayKeySecret;
        if (!rawKeyId || !rawKeyId.trim()) {
            return res.status(400).json({ success: false, message: 'Razorpay Key ID is required' });
        }
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});

        settings.razorpayKeyId = rawKeyId.trim();
        if (rawKeySecret && rawKeySecret.trim()) {
            settings.razorpayKeySecret = rawKeySecret.trim();
        }
        settings.razorpayEnabled = true;
        await settings.save();

        // Immediate verification test with Razorpay API
        let verifiedLive = false;
        try {
            const client = new Razorpay({ key_id: settings.razorpayKeyId, key_secret: settings.razorpayKeySecret });
            await client.orders.all({ count: 1 });
            verifiedLive = true;
        } catch (testErr) {
            console.warn('Gateway test warning:', testErr.message);
        }

        res.json({
            success: true,
            message: verifiedLive
                ? '✅ Razorpay Gateway Keys SAVED & VERIFIED LIVE! Payment gateway is now active.'
                : 'Razorpay Gateway Keys saved successfully!',
            keyId: settings.razorpayKeyId,
            verified: verifiedLive
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.9C Dedicated Update for Google Gemini AI Key
app.put('/api/admin/gemini-key', verifySuperAdmin, async (req, res) => {
    try {
        const rawApiKey = req.body.apiKey || req.body.geminiApiKey;
        if (!rawApiKey || !rawApiKey.trim()) {
            return res.status(400).json({ success: false, message: 'Google Gemini API Key is required' });
        }
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});

        settings.geminiApiKey = rawApiKey.trim();
        await settings.save();

        // Immediate verification test with Google Gemini API
        let verifiedLive = false;
        try {
            const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.geminiApiKey}`;
            const testRes = await fetch(testUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Namaste, acknowledge test' }] }]
                })
            });
            const testData = await testRes.json();
            if (testData.candidates && testData.candidates.length > 0) {
                verifiedLive = true;
            }
        } catch (testErr) {
            console.warn('Gemini test notice:', testErr.message);
        }

        res.json({
            success: true,
            message: verifiedLive
                ? '✅ Gemini API Key SAVED & VERIFIED LIVE! BHARTI AI is now active with loving persona.'
                : 'Google Gemini API Key saved successfully!',
            verified: verifiedLive
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.9D Live Test Google Gemini API
app.post('/api/admin/test-gemini', verifySuperAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        const apiKey = (req.body.apiKey && req.body.apiKey.trim()) ? req.body.apiKey.trim() : (settings ? settings.geminiApiKey : '');
        if (!apiKey) {
            return res.status(400).json({ success: false, message: 'Gemini API Key is not configured' });
        }

        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const testRes = await fetch(testUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'Say one short loving sentence to a student as BHARTI Didi' }] }]
            })
        });
        const testData = await testRes.json();
        if (testData.candidates && testData.candidates.length > 0) {
            const reply = testData.candidates[0].content.parts[0].text;
            return res.json({ success: true, message: 'Gemini 1.5 Flash Connected!', sampleReply: reply });
        } else {
            return res.status(400).json({ success: false, message: 'Gemini API Error: ' + JSON.stringify(testData.error || testData) });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Connection error: ' + err.message });
    }
});

// 8.9B Super Admin Change Credentials Desk (Admin ID & Password)
app.put('/api/admin/credentials', verifySuperAdmin, async (req, res) => {
    try {
        const { currentPassword, newAdminId, newPassword } = req.body;
        if (!currentPassword) {
            return res.status(400).json({ success: false, message: 'Current password is required to authorize credential update' });
        }
        const admin = await Admin.findById(req.admin.id);
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin record not found' });
        }
        const isMatch = await bcrypt.compare(currentPassword, admin.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }
        if (newAdminId && newAdminId.trim()) {
            admin.adminId = newAdminId.trim();
        }
        if (newPassword && newPassword.trim()) {
            if (newPassword.trim().length < 6) {
                return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
            }
            admin.password = await bcrypt.hash(newPassword.trim(), 10);
        }
        await admin.save();
        res.json({ success: true, message: 'Super Admin credentials changed successfully! Please log in with new credentials.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.10 Test Razorpay Gateway Connection
app.get('/api/admin/test-razorpay', verifySuperAdmin, async (req, res) => {
    try {
        const { client, keyId } = await getRazorpayClient();
        if (!client) {
            return res.status(400).json({ success: false, message: 'Razorpay Key ID & Key Secret are missing' });
        }
        const orders = await client.orders.all({ count: 1 });
        res.json({
            success: true,
            message: 'Razorpay Gateway is ACTIVE & CONNECTED!',
            keyId: keyId,
            testData: { orderCount: orders.items.length }
        });
    } catch (err) {
        res.status(400).json({ success: false, message: 'Razorpay Gateway Error: ' + err.message });
    }
});

// 8.11 Affiliation Applications Desk
app.get('/api/admin/affiliations', verifySuperAdmin, async (req, res) => {
    try {
        const list = await AffiliationApplication.find().sort({ appliedAt: -1 });
        res.json({ success: true, data: list });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.12 Payment Transactions Ledger
app.get('/api/admin/transactions', verifySuperAdmin, async (req, res) => {
    try {
        const txns = await PaymentTransaction.find().sort({ createdAt: -1 });
        res.json({ success: true, data: txns });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.13 All Students View for Super Admin
app.get('/api/admin/students', verifySuperAdmin, async (req, res) => {
    try {
        const students = await Student.find().sort({ createdAt: -1 });
        res.json({ success: true, data: students });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.14 Get All Promotional Banners from All Centers for Super Admin Review
app.get('/api/admin/banners', verifySuperAdmin, async (req, res) => {
    try {
        const centers = await TuitionCenter.find({}, { centerName: 1, username: 1, promotionalBanners: 1 });
        const list = [];
        centers.forEach(c => {
            (c.promotionalBanners || []).forEach(b => {
                list.push({
                    _id: b._id,
                    centerId: c._id,
                    centerName: c.centerName,
                    username: c.username,
                    title: b.title,
                    subtitle: b.subtitle,
                    image: b.image,
                    link: b.link,
                    active: b.active !== false,
                    uploadedAt: b.uploadedAt
                });
            });
        });
        res.json({ success: true, data: list });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.15 Delete Banner from Super Admin Console
app.delete('/api/admin/banners/:cid/:bid', verifySuperAdmin, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.params.cid);
        if (!center) return res.status(404).json({ success: false, message: 'Center not found' });
        center.promotionalBanners = (center.promotionalBanners || []).filter(b => b._id.toString() !== req.params.bid);
        await center.save();
        res.json({ success: true, message: 'Banner removed by Super Admin' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.16 Board Campus Photo Gallery Management
app.post('/api/admin/gallery', verifySuperAdmin, async (req, res) => {
    try {
        const { image, title } = req.body;
        if (!image) return res.status(400).json({ success: false, message: 'Image required' });
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});
        settings.gallery.push({ image, title: title || 'Campus Highlight' });
        await settings.save();
        res.json({ success: true, message: 'Photo added to Board Gallery!', data: settings.gallery });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/admin/gallery/:gid', verifySuperAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) return res.status(404).json({ success: false, message: 'Settings not found' });
        settings.gallery = settings.gallery.filter(g => g._id.toString() !== req.params.gid);
        await settings.save();
        res.json({ success: true, message: 'Photo removed from Gallery' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// 9. CLEAN SINGLE-PAGE APPS & URL ROUTING
// ============================================================
app.get('/institute', (req, res) => res.sendFile(path.join(__dirname, 'public', 'institute.html')));
app.get('/institute/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'institute.html')));
app.get('/center', (req, res) => res.sendFile(path.join(__dirname, 'public', 'institute.html')));
app.get('/center/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'institute.html')));
app.get('/director', (req, res) => res.sendFile(path.join(__dirname, 'public', 'director-portal.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-console.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'auth.html')));
app.get('/classroom', (req, res) => res.sendFile(path.join(__dirname, 'public', 'classroom.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'public', 'about.html')));

// Catch-all route to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// 10. MONGODB CONNECT & SERVER START
// ============================================================
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('🌟 MongoDB Connected Successfully to:', MONGO_URI.includes('@') ? 'MongoDB Atlas Cloud' : MONGO_URI);
    await initSystem();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 BBCC Skill Hub Engine listening on port ${PORT}`);
        console.log(`🔗 Portal URL: http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`⚠️ Server running in fallback mode on port ${PORT}`);
    });
});
