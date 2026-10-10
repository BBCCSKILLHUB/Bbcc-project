/**
 * ============================================================
 * BBCC SKILL HUB — CORE BACKEND ENGINE (v3.0 NEXT-GEN)
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
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));
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
        link: { type: String, default: '' },
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

// 1.4 Student Records Schema
const StudentSchema = new mongoose.Schema({
    studentId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    course: { type: String, default: 'Academic' },
    classLevel: { type: String, default: 'Class 10th' },
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
    purpose: { type: String, required: true }, // 'document_purchase', 'coaching_unblock'
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
    paidAt: { type: Date }
}, { timestamps: true });

// 1.8 Global Board Settings & Configuration Schema
const SettingsSchema = new mongoose.Schema({
    boardTitle: { type: String, default: 'BBCC SKILL HUB' },
    tagline: { type: String, default: 'Central Academic Board & Digital Skill Institute Network' },
    phone: { type: String, default: '+91 98765 43210' },
    email: { type: String, default: 'board@bbccskillhub.org' },
    address: { type: String, default: 'BBCC Central Directorate, New Delhi, India' },
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
        const settingsCount = await Settings.countDocuments();
        if (settingsCount === 0) {
            await Settings.create({
                boardTitle: 'BBCC SKILL HUB',
                tagline: 'Empowering Educational Excellence & Certified Digital Learning',
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

// 4.1 Public Board Configuration & Banners
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

// 4.2 Public Registered Coaching Centers List
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

// 4.3 Public Single Coaching Center Microsite by ID
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

// 4.4 Public E-Library Books & Notes (Strictly Thumbnails / Covers, No Direct PDF Payload)
app.get('/api/public/books', async (req, res) => {
    try {
        const sm = await StudyMaterial.findOne();
        if (!sm || !sm.notes) {
            return res.json({ success: true, data: { notes: [], videos: [] } });
        }

        // Sanitize: Hide file payload from public API to protect paid content
        const sanitizedNotes = sm.notes.map(n => ({
            _id: n._id,
            title: n.title,
            subject: n.subject,
            classLevel: n.classLevel,
            description: n.description,
            fileType: n.fileType,
            thumbnail: n.thumbnail,
            price: n.price,
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

// 4.5 Public Student Admission Inquiry Submission
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

// 4.6 Public Coaching Center Affiliation Application
app.post('/api/public/affiliate', async (req, res) => {
    try {
        const { centerName, directorName, contactNumber, email, fromClass, toClass, address, message } = req.body;
        if (!centerName || !directorName || !contactNumber || !address) {
            return res.status(400).json({ success: false, message: 'Please fill all required institute fields' });
        }

        const appRecord = await AffiliationApplication.create({
            centerName: centerName.trim(),
            directorName: directorName.trim(),
            contactNumber: contactNumber.trim(),
            email: (email || '').trim(),
            fromClass: fromClass || 'Class 6th',
            toClass: toClass || 'Class 12th',
            address: address.trim(),
            message: (message || '').trim()
        });

        res.json({
            success: true,
            message: 'Affiliation application submitted to BBCC Academic Board! Our directorate will review your application shortly.',
            applicationId: appRecord._id
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// 5. RAZORPAY PAYMENT GATEWAY APIS
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

        // HMAC-SHA256 Signature Verification
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

        // Fetch document payload to download
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

// 5.3 Create Coaching Unblock Razorpay Order
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

// 5.4 Verify Coaching Unblock Payment & AUTOMATICALLY UNBLOCK INSTANTLY
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

// 7.2 Update Center Profile
app.put('/api/director/profile', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

        const allowed = ['contactNumber', 'whatsappNumber', 'email', 'address', 'description', 'encryptedCallLink', 'clogo', 'directorPhoto', 'fromClass', 'toClass', 'socials'];
        allowed.forEach(k => {
            if (req.body[k] !== undefined) center[k] = req.body[k];
        });

        await center.save();
        res.json({ success: true, message: 'Profile updated successfully!', data: center });
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

// 7.4 Center Study Material Notes
app.post('/api/director/materials', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        const { title, description, fileType, pdf, link } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'Title required' });

        center.materials.push({
            title: title.trim(),
            description: description || '',
            fileType: fileType || 'pdf',
            pdf: pdf || '',
            link: link || ''
        });

        await center.save();
        res.json({ success: true, message: 'Study material uploaded!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.5 Admission Inquiries to this Center
app.get('/api/director/inquiries', verifyDirector, async (req, res) => {
    try {
        const inquiries = await AdmissionInquiry.find({ centerId: req.center.centerId }).sort({ createdAt: -1 });
        res.json({ success: true, data: inquiries });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// 8. SUPER ADMIN CONSOLE APIS
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
        const center = await TuitionCenter.create({
            centerName: centerName.trim(),
            username: cleanUser,
            password: hashedPassword,
            directorName: directorName.trim(),
            address: address || '',
            contactNumber: contactNumber || '',
            fromClass: fromClass || 'Class 6th',
            toClass: toClass || 'Class 12th'
        });

        res.json({ success: true, message: 'New partner center registered successfully!', data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.2 Center Block / Unblock / Set Dues
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

// 8.3 Central E-Library: Upload Document Note
app.post('/api/admin/books', verifySuperAdmin, async (req, res) => {
    try {
        const { title, subject, classLevel, description, fileType, thumbnail, file, fileName, price } = req.body;
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
            price: Math.max(0, Number(price) || 0)
        });

        await sm.save();
        res.json({ success: true, message: 'Document added to Central E-Library!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.4 Delete E-Library Book Note
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

// 8.5 Save Razorpay Gateway Credentials & Settings
app.put('/api/admin/settings', verifySuperAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});

        const { razorpayKeyId, razorpayKeySecret, razorpayEnabled, boardTitle, tagline, phone, email, address } = req.body;

        if (razorpayKeyId !== undefined) settings.razorpayKeyId = razorpayKeyId.trim();
        if (razorpayKeySecret !== undefined) settings.razorpayKeySecret = razorpayKeySecret.trim();
        if (razorpayEnabled !== undefined) settings.razorpayEnabled = Boolean(razorpayEnabled);
        if (boardTitle !== undefined) settings.boardTitle = boardTitle.trim();
        if (tagline !== undefined) settings.tagline = tagline.trim();
        if (phone !== undefined) settings.phone = phone.trim();
        if (email !== undefined) settings.email = email.trim();
        if (address !== undefined) settings.address = address.trim();

        await settings.save();
        res.json({ success: true, message: 'Settings & Razorpay credentials saved successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.6 Test Razorpay Gateway Connection
app.get('/api/admin/test-razorpay', verifySuperAdmin, async (req, res) => {
    try {
        const { client, keyId } = await getRazorpayClient();
        if (!client) {
            return res.status(400).json({ success: false, message: 'Razorpay Key ID & Key Secret are missing' });
        }
        // Test API call to Razorpay
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

// 8.7 Affiliation Applications Desk
app.get('/api/admin/affiliations', verifySuperAdmin, async (req, res) => {
    try {
        const list = await AffiliationApplication.find().sort({ appliedAt: -1 });
        res.json({ success: true, data: list });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.8 Payment Transactions Ledger
app.get('/api/admin/transactions', verifySuperAdmin, async (req, res) => {
    try {
        const txns = await PaymentTransaction.find().sort({ createdAt: -1 });
        res.json({ success: true, data: txns });
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
    // Graceful startup even if MongoDB is momentarily connecting
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`⚠️ Server running in fallback mode on port ${PORT}`);
    });
});
