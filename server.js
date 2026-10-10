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
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'BBCC_AURORA_SECURE_TOKEN_2026_@KEY';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/bbcc_portal';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ extended: true, limit: '80mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
    // Suspension & Dues System
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String, default: '' },
    dueAmount: { type: Number, default: 0 },
    paymentQr: { type: String, default: '' },
    // Dual Promotional Banners
    promotionalBanners: [{
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        image: { type: String, required: true },
        link: { type: String, default: '' },
        active: { type: Boolean, default: true },
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
        fileType: { type: String, default: 'pdf' },
        pdf: { type: String, default: '' },
        file: { type: String, default: '' },
        link: { type: String, default: '' },
        isRawData: { type: Boolean, default: false },
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

// 1.4 Student Records Schema with Roll Number & Marksheet Verification
const StudentSchema = new mongoose.Schema({
    studentId: { type: String, required: true, unique: true },
    rollNo: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    fatherName: { type: String, default: '' },
    motherName: { type: String, default: '' },
    dob: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    course: { type: String, default: 'Academic Excellence' },
    classLevel: { type: String, default: 'Class 10th' },
    marksGrade: { type: String, default: 'A+' },
    certificateId: { type: String, default: '' },
    issueDate: { type: Date, default: Date.now },
    status: { type: String, default: 'Certified & Verified' },
    centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'TuitionCenter' },
    centerName: { type: String, default: 'BBCC Central Board' },
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

// 1.7 Payment Transactions Ledger Schema
const PaymentTransactionSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String, default: '' },
    signature: { type: String, default: '' },
    purpose: { type: String, required: true }, // 'document_purchase', 'coaching_unblock', 'coaching_affiliation'
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
    regData: { type: Object, default: null }, // Stored for affiliation registration verification
    paidAt: { type: Date }
}, { timestamps: true });

// 1.8 Global Board Settings & Configuration Schema
const SettingsSchema = new mongoose.Schema({
    boardTitle: { type: String, default: 'BBCC SKILL HUB' },
    tagline: { type: String, default: 'Central Academic Board & Digital Skill Institute Network' },
    phone: { type: String, default: '+91 98765 43210' },
    email: { type: String, default: 'board@bbccskillhub.org' },
    address: { type: String, default: 'BBCC Central Directorate, New Delhi, India' },
    boardLogo: { type: String, default: '' },
    newsMarquee: {
        type: String,
        default: '📢 Admissions Open 2026-27 Across All BBCC Certified Centers | Apply for Direct Affiliation Online | 24/7 Digital Helpline & BHARTI AI Live'
    },
    affiliationFee: { type: Number, default: 999 }, // Admin decided affiliation fee
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
                        title: 'BBCC Skill Hub Central Academic Board',
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
                boardTitle: settings.boardTitle,
                tagline: settings.tagline,
                phone: settings.phone,
                email: settings.email,
                address: settings.address,
                boardLogo: settings.boardLogo || '',
                newsMarquee: settings.newsMarquee || '',
                affiliationFee: settings.affiliationFee !== undefined ? settings.affiliationFee : 999,
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

// 4.2 Aggregated Dual Promotional Banners (Centers + Board)
app.get('/api/public/promotional-banners', async (req, res) => {
    try {
        const centers = await TuitionCenter.find(
            { isBlocked: false, 'promotionalBanners.0': { $exists: true } },
            { centerName: 1, username: 1, clogo: 1, promotionalBanners: 1 }
        );

        const activeBanners = [];
        centers.forEach(c => {
            (c.promotionalBanners || []).forEach(b => {
                if (b.active !== false && b.image) {
                    activeBanners.push({
                        _id: b._id,
                        centerId: c._id,
                        centerName: c.centerName,
                        username: c.username,
                        clogo: c.clogo,
                        title: b.title || c.centerName,
                        subtitle: b.subtitle || 'Affiliated Study Partner',
                        image: b.image,
                        link: b.link || `/institute.html?id=${c.username}`
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

        // Sanitize: Filter only Universal notes or public ones, hide raw file payload
        const sanitizedNotes = sm.notes
            .filter(n => !n.targetCenterId || n.targetCenterId === 'all')
            .map(n => ({
                _id: n._id,
                title: n.title,
                subject: n.subject,
                classLevel: n.classLevel,
                description: n.description,
                fileType: n.fileType,
                thumbnail: n.thumbnail,
                price: n.price,
                targetCenterId: n.targetCenterId || 'all',
                targetCenterName: n.targetCenterName || 'All Centers (Universal)',
                isRawData: n.isRawData || false,
                hasFile: !!(n.pdf || n.file),
                downloadCount: n.downloadCount || 0,
                createdAt: n.createdAt
            }));

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
        const student = await Student.findOne({
            $or: [
                { rollNo: regExp },
                { studentId: regExp },
                { certificateId: regExp }
            ]
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                verified: false,
                message: `No digital academic record found for Roll Number / ID: "${query}". Please check the credentials.`
            });
        }

        res.json({
            success: true,
            verified: true,
            data: {
                studentId: student.studentId,
                rollNo: student.rollNo,
                name: student.name,
                fatherName: student.fatherName || 'Registered Candidate',
                motherName: student.motherName || '',
                dob: student.dob || '',
                course: student.course || 'Academic Course',
                classLevel: student.classLevel || 'Class 10th',
                marksGrade: student.marksGrade || 'A+',
                certificateId: student.certificateId || student.rollNo,
                issueDate: student.issueDate || student.createdAt,
                status: student.status || 'Certified & Verified',
                centerName: student.centerName || 'BBCC Central Board'
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.8 BHARTI AI Academic & Center Helpline Assistant Endpoint
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

        let replyText = '';
        let encCall = '';
        let dirPhone = '';
        let dirWa = '';

        if (targetCenter) {
            encCall = targetCenter.encryptedCallLink || `https://meet.bbccskillhub.org/call/${targetCenter.username}`;
            dirPhone = targetCenter.contactNumber || targetCenter.whatsappNumber || '+91 98765 43210';
            const cleanMobile = dirPhone.replace(/[^0-9]/g, '').slice(-10);
            dirWa = `https://wa.me/91${cleanMobile}?text=${encodeURIComponent(`Namaste Director ${targetCenter.directorName}, I am contacting you through BHARTI AI Helpline regarding admission at ${targetCenter.centerName}.`)}`;

            if (q.includes('fee') || q.includes('fees')) {
                replyText = `Namaste! Regarding fee structure at **${targetCenter.centerName}**, batch timings, and scholarship concessions: First, you can connect directly with the academic counselor through their encrypted secure call line. Second, you can call or WhatsApp Director **${targetCenter.directorName}** directly!`;
            } else if (q.includes('admission') || q.includes('enroll') || q.includes('join')) {
                replyText = `Great! Admissions are currently active at **${targetCenter.centerName}** (${targetCenter.fromClass} to ${targetCenter.toClass}) under Director **${targetCenter.directorName}**. First, please connect via their Encrypted Helpline Call Line. Second, feel free to directly call or message the Director!`;
            } else if (q.includes('problem') || q.includes('complaint') || q.includes('issue') || q.includes('help')) {
                replyText = `I understand your concern. We prioritize prompt resolution. For **${targetCenter.centerName}**, I have arranged direct escalated communication: First, please tap the Encrypted Helpline Call Line. Second, here is Director **${targetCenter.directorName}**'s personal contact and WhatsApp line.`;
            } else {
                replyText = `Namaste! I am BHARTI, your BBCC Academic Assistant. For **${targetCenter.centerName}** located at *${targetCenter.address || 'BBCC Affiliated Center'}*: First, you can join their private encrypted voice/video desk. Second, you can contact Director **${targetCenter.directorName}** directly via phone or WhatsApp.`;
            }
        } else {
            // General Board Query
            encCall = 'https://meet.bbccskillhub.org/call/central-helpline';
            dirPhone = '+91 98765 43210';
            dirWa = 'https://wa.me/919876543210?text=Hello%20BBCC%20Central%20Directorate,%20I%20need%20academic%20assistance.';

            if (q.includes('book') || q.includes('note') || q.includes('pdf') || q.includes('library')) {
                replyText = `You can explore our **Central E-Library Vault** on this portal. Notes are verified by BBCC Central Directorate. Free notes download immediately, while premium notes unlock with 1-click Razorpay checkout. First, use our encrypted digital helpline if you have any questions, or second, call the Central Directorate directly!`;
            } else if (q.includes('affiliat') || q.includes('register') || q.includes('open')) {
                replyText = `Any tuition or coaching center can register online instantly from our homepage! Super Admin sets the standard affiliation fee. Once paid, the center goes live immediately with a dedicated website and verified board affiliation certificate!`;
            } else {
                replyText = `Namaste! I am **BHARTI AI**, your 24/7 BBCC Academic & Center Helpline Assistant. I can help you find verified coaching centers, verify student roll numbers, or connect you with center directors. First, you can click our encrypted secure helpline link, or second, reach out directly via phone or WhatsApp!`;
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
        const { docId, payerName, payerPhone, payerEmail } = req.body;
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

        // CASE A: Free Document -> Instant Delivery Directly to Disk
        if (price === 0) {
            note.downloadCount = (note.downloadCount || 0) + 1;
            await sm.save();

            await PaymentTransaction.create({
                orderId: 'FREE_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
                paymentId: 'FREE_ACCESS',
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
                file: note.file || note.pdf,
                fileName: note.fileName || (note.title.replace(/[^a-zA-Z0-9]/g, '_') + '.' + (note.fileType || 'pdf')),
                fileType: note.fileType || 'pdf',
                message: 'Free document ready for download!'
            });
        }

        // CASE B: Paid Document -> Generate Razorpay Order
        const { client, keyId } = await getRazorpayClient();
        if (!client) {
            return res.status(400).json({
                success: false,
                message: 'Razorpay Payment Gateway is currently in setup mode. Super Admin can configure API keys in Admin Console.'
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

// 5.2 Verify Document Payment & Deliver File Payload Directly for Download
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

        await PaymentTransaction.findOneAndUpdate(
            { orderId: razorpay_order_id },
            {
                status: 'paid',
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
                paidAt: new Date()
            }
        );

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
            return res.status(400).json({
                success: false,
                message: 'Razorpay Gateway is in setup mode. Please contact BBCC Super Admin.'
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

// 7.4 Center Promotional Banners Management
app.post('/api/director/banners', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        const { title, subtitle, image, link } = req.body;
        if (!image) return res.status(400).json({ success: false, message: 'Banner image is required' });

        center.promotionalBanners.push({
            title: (title || '').trim(),
            subtitle: (subtitle || '').trim(),
            image: image,
            link: (link || '').trim(),
            active: true
        });

        await center.save();
        res.json({ success: true, message: 'Promotional banner uploaded!', data: center.promotionalBanners });
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

// 7.6 Center Study Notes & Raw Curriculum Materials
app.post('/api/director/materials', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        const { title, description, fileType, pdf, file, link, isRawData } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'Title required' });

        center.materials.push({
            title: title.trim(),
            description: description || '',
            fileType: fileType || 'pdf',
            pdf: pdf || file || '',
            file: file || pdf || '',
            link: link || '',
            isRawData: Boolean(isRawData)
        });

        await center.save();
        res.json({ success: true, message: 'Study material uploaded!' });
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
                boardTitle: 'BBCC SKILL HUB ACADEMIC BOARD',
                status: center.isBlocked ? 'Suspended' : 'Officially Affiliated & Certified'
            }
        });
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

// 8.9 Save Razorpay Gateway Credentials & Board Settings
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
            phone,
            email,
            address,
            boardLogo,
            newsMarquee,
            affiliationFee
        } = req.body;

        if (razorpayKeyId !== undefined) settings.razorpayKeyId = razorpayKeyId.trim();
        if (razorpayKeySecret !== undefined) settings.razorpayKeySecret = razorpayKeySecret.trim();
        if (razorpayEnabled !== undefined) settings.razorpayEnabled = Boolean(razorpayEnabled);
        if (boardTitle !== undefined) settings.boardTitle = boardTitle.trim();
        if (tagline !== undefined) settings.tagline = tagline.trim();
        if (phone !== undefined) settings.phone = phone.trim();
        if (email !== undefined) settings.email = email.trim();
        if (address !== undefined) settings.address = address.trim();
        if (boardLogo !== undefined) settings.boardLogo = boardLogo;
        if (newsMarquee !== undefined) settings.newsMarquee = newsMarquee;
        if (affiliationFee !== undefined) settings.affiliationFee = Math.max(0, Number(affiliationFee));

        await settings.save();
        res.json({ success: true, message: 'Settings & Razorpay credentials saved successfully!' });
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
