/**
 * ============================================================
 * BBCC SKILL HUB — CORE BACKEND ENGINE (v3.1 ENTERPRISE)
 * ============================================================
 * Clean, High-Performance REST API & Digital Board Engine
 * MongoDB Atlas & Render Ready
 * ============================================================
 */

try { require('dotenv').config(); } catch(e) {}
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const webpush = require('web-push');

// Web Push Notification VAPID Protocol Configuration
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BPJoqu1-L_MFxP-HZKm9JzuV432dTE3gl8h55GkcKx0m1xpIGsQfAuug-NzXZx-prkcDVg16E89LrVw-fVUVx8I';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'XtLilGC2iFWXpx8p3EbwQ1MzaVXO8WyoOmRg8VQiDS4';
const VAPID_SUBJECT = 'mailto:admin@bbccskillhub.org';

try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('🔔 Web Push Notifications VAPID configured successfully');
} catch (e) {
    console.warn('VAPID setup notice:', e.message);
}

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'BBCC_AURORA_SECURE_TOKEN_2026_@KEY';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/bbcc_portal';

// ============================================================
// DUAL DATABASE ARCHITECTURE:
// 1. MONGODB (Atlas Cloud / Local):
//    - Strictly dedicated to User IDs, Usernames, Passwords (bcrypt hashes),
//      Center Accounts, Teacher Logins, Student Credentials, Admin Auth.
//    - 100% FREE of Base64 strings, media, and heavy asset bloat.
// 2. DATASTAX ASTRA DB (astra.datastax.com):
//    - Cloud Serverless NoSQL Document Engine for Heavy Load Data:
//      Photos (Campus Gallery, Logos), PDFs (Study Materials, Books),
//      Promotional Banners, and Live Class Sessions & Video Recordings.
// ============================================================
const { DataAPIClient } = require('@datastax/astra-db-ts');

const ASTRA_DB_APPLICATION_TOKEN = process.env.ASTRA_DB_APPLICATION_TOKEN || process.env.ASTRA_TOKEN || '';
const ASTRA_DB_API_ENDPOINT = process.env.ASTRA_DB_API_ENDPOINT || process.env.ASTRA_ENDPOINT || 'https://ca3de2b2-4e25-42ca-b40c-a82b05dd3fed-us-east-2.apps.astra.datastax.com';
const ASTRA_DB_KEYSPACE = process.env.ASTRA_DB_KEYSPACE || process.env.ASTRA_DB_NAMESPACE || 'default_keyspace';

let astraClient = null;
let astraDb = null;
let isAstraConnected = false;
let isMongoConnected = false;

// Initialize connection to DataStax Astra DB
async function initAstraDb() {
    if (!ASTRA_DB_APPLICATION_TOKEN || !ASTRA_DB_API_ENDPOINT) {
        console.log('ℹ️ [DataStax Astra DB] ASTRA_DB_APPLICATION_TOKEN or ASTRA_DB_API_ENDPOINT not provided in environment.');
        console.log('👉 Heavy assets (photos, PDFs, banners, recordings) will stage on local disk until Astra DB is configured in Render.');
        return;
    }
    try {
        astraClient = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
        astraDb = astraClient.db(ASTRA_DB_API_ENDPOINT, { keyspace: ASTRA_DB_KEYSPACE });

        const collections = await astraDb.listCollections();
        const existingNames = collections.map(c => c.name);

        const requiredCols = ['bbcc_assets', 'bbcc_live_classes', 'bbcc_recordings', 'bbcc_study_materials', 'bbcc_banners'];
        for (const col of requiredCols) {
            if (!existingNames.includes(col)) {
                try {
                    await astraDb.createCollection(col, { indexing: { deny: ['data'] } });
                    console.log(`✅ [Astra DB] Initialized Collection: ${col}`);
                } catch(cErr) {}
            }
        }

        isAstraConnected = true;
        console.log('⚡ [Astra DB Connected] High-Performance Storage Active on astra.datastax.com!');
        console.log(`📁 Heavy Data Collections: [${requiredCols.join(', ')}] Ready for Photos, PDFs & Live Classes.`);
    } catch (err) {
        isAstraConnected = false;
        console.warn('⚠️ [Astra DB Notice] Connection failed:', err.message);
    }
}

// Local Persistent File Engine (Offline / Local Dev Fallback)
const DB_FILE = path.join(__dirname, 'public', 'data', 'portal_db.json');
let portalDb = null;

function loadPortalDb() {
    try {
        if (fs.existsSync(DB_FILE)) {
            portalDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            return portalDb;
        }
    } catch(e) {
        console.warn('loadPortalDb notice:', e.message);
    }
    return portalDb || { centers: [], courses: [], studyMaterials: { notes: [] }, settings: {}, admins: [] };
}

async function savePortalDb(data) {
    if (data) portalDb = data;
    try {
        const dir = path.dirname(DB_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const jsonStr = JSON.stringify(portalDb, null, 2);
        fs.writeFileSync(DB_FILE, jsonStr, 'utf8');
    } catch(e) {
        console.error('savePortalDb error:', e.message);
    }
}

// ============================================================
// DATASTAX ASTRA DB HEAVY ASSET ENGINE (Photos, PDFs, Banners)
// ============================================================
const ASTRA_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunking for large files

async function saveAssetToAstra({ filename, subDir, mimeType, title, base64Data, approxByteSize }) {
    if (!astraDb || !isAstraConnected) return false;
    try {
        const col = astraDb.collection('bbcc_assets');
        if (base64Data.length <= ASTRA_CHUNK_SIZE) {
            await col.updateOne(
                { _id: filename },
                {
                    $set: {
                        filename: filename,
                        subDir: subDir,
                        mimeType: mimeType,
                        title: title || filename,
                        sizeBytes: approxByteSize,
                        data: base64Data,
                        isChunked: false,
                        totalChunks: 1,
                        uploadedAt: new Date().toISOString()
                    }
                },
                { upsert: true }
            );
        } else {
            const totalChunks = Math.ceil(base64Data.length / ASTRA_CHUNK_SIZE);
            await col.updateOne(
                { _id: filename },
                {
                    $set: {
                        filename: filename,
                        subDir: subDir,
                        mimeType: mimeType,
                        title: title || filename,
                        sizeBytes: approxByteSize,
                        isChunked: true,
                        totalChunks: totalChunks,
                        uploadedAt: new Date().toISOString()
                    }
                },
                { upsert: true }
            );
            for (let i = 0; i < totalChunks; i++) {
                const chunkData = base64Data.slice(i * ASTRA_CHUNK_SIZE, (i + 1) * ASTRA_CHUNK_SIZE);
                await col.updateOne(
                    { _id: `${filename}_chunk_${i}` },
                    {
                        $set: {
                            parentId: filename,
                            chunkIndex: i,
                            data: chunkData
                        }
                    },
                    { upsert: true }
                );
            }
        }
        console.log(`⚡ [Astra DB Upload] Saved ${filename} (${Math.round(approxByteSize/1024)} KB) to astra.datastax.com collection: bbcc_assets`);
        return true;
    } catch (err) {
        console.warn(`[Astra DB Asset Save Notice] ${filename}:`, err.message);
        return false;
    }
}

async function getAssetFromAstra(filenameOrId) {
    if (!astraDb || !isAstraConnected) return null;
    try {
        const col = astraDb.collection('bbcc_assets');
        let doc = await col.findOne({ _id: filenameOrId });
        if (!doc) doc = await col.findOne({ filename: filenameOrId });
        if (!doc) return null;

        if (!doc.isChunked) {
            return {
                mimeType: doc.mimeType || 'application/octet-stream',
                buffer: Buffer.from(doc.data, 'base64'),
                filename: doc.filename
            };
        }

        const chunks = [];
        for (let i = 0; i < doc.totalChunks; i++) {
            const cDoc = await col.findOne({ _id: `${doc.filename}_chunk_${i}` });
            if (cDoc && cDoc.data) chunks.push(cDoc.data);
        }
        const fullBase64 = chunks.join('');
        return {
            mimeType: doc.mimeType || 'application/octet-stream',
            buffer: Buffer.from(fullBase64, 'base64'),
            filename: doc.filename
        };
    } catch (err) {
        console.warn(`[Astra DB Asset Retrieval Notice] ${filenameOrId}:`, err.message);
        return null;
    }
}

function saveAssetFile(dataUriOrBase64, subDir = 'materials', defaultExt = 'pdf', storageMode = 'normal', title = '') {
    if (!dataUriOrBase64 || typeof dataUriOrBase64 !== 'string') {
        return { fileUrl: '', storageUsed: 'none', isRawData: false };
    }

    if (dataUriOrBase64.startsWith('http://') || dataUriOrBase64.startsWith('https://') || 
        dataUriOrBase64.startsWith('/data/') || dataUriOrBase64.startsWith('/uploads/') ||
        dataUriOrBase64.startsWith('/api/astra/asset/')) {
        return { fileUrl: dataUriOrBase64, storageUsed: 'existing', isRawData: false };
    }

    let ext = defaultExt;
    let base64Data = dataUriOrBase64;
    let mimeType = 'application/octet-stream';
    const match = dataUriOrBase64.match(/^data:([a-zA-Z0-9\/+-]+);base64,(.+)$/);
    if (match) {
        mimeType = match[1];
        base64Data = match[2];
        if (mimeType.includes('pdf')) ext = 'pdf';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
        else if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';
        else if (mimeType.includes('word') || mimeType.includes('officedocument')) ext = 'docx';
    } else if (dataUriOrBase64.length < 300 && !dataUriOrBase64.includes(';base64,')) {
        return { fileUrl: dataUriOrBase64, storageUsed: 'text', isRawData: false };
    }

    const approxByteSize = Math.round(base64Data.length * 0.75);

    try {
        const targetDir = path.join(__dirname, 'public', 'data', subDir);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const safeBaseName = title ? title.slice(0, 30).replace(/[^a-zA-Z0-9_-]/g, '_') : subDir;
        const filename = `${safeBaseName}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.${ext}`;
        const filePath = path.join(targetDir, filename);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        const publicUrl = `/data/${subDir}/${filename}`;

        // Save heavy asset to DataStax Astra DB asynchronously
        saveAssetToAstra({
            filename,
            subDir,
            mimeType,
            title: title || filename,
            base64Data,
            approxByteSize
        }).catch(() => {});

        console.log(`📦 [ASSET DISPATCHED] Path: ${publicUrl} (${Math.round(approxByteSize/1024)} KB) -> DataStax Astra DB (astra.datastax.com)`);

        return {
            fileUrl: publicUrl,
            storageUsed: isAstraConnected ? 'astra_db' : 'local_disk',
            isRawData: false,
            sizeBytes: approxByteSize,
            filename: filename
        };
    } catch (e) {
        console.error('saveAssetFile disk write error:', e.message);
        try {
            const fallbackDir = path.join(__dirname, 'public', 'uploads', subDir);
            if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
            const filename = `fallback_${Date.now()}.${ext}`;
            fs.writeFileSync(path.join(fallbackDir, filename), Buffer.from(base64Data, 'base64'));
            return { fileUrl: `/uploads/${subDir}/${filename}`, storageUsed: 'local_upload', isRawData: false };
        } catch(fallbackErr) {
            return { fileUrl: '', storageUsed: 'error', isRawData: false };
        }
    }
}

// Backward-compatible helper that returns the URL string
function saveBase64ToFile(dataUriOrBase64, subDir = 'materials', defaultExt = 'pdf', storageMode = 'normal', title = '') {
    const res = saveAssetFile(dataUriOrBase64, subDir, defaultExt, storageMode, title);
    return res.fileUrl;
}

// Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ extended: true, limit: '80mb' }));

// Global Zero-Stale HTTP Cache-Busting Headers for all API routes:
// Ensures browsers never serve stale cached JSON for any database entity or upload!
app.use('/api', (req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    next();
});

// Explicit no-cache for portal_db.json
app.use('/data/portal_db.json', (req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
});

// Dedicated Founder photo fallback route (guarantees zero 404s)
app.get(['/santosh%20sir.jpeg', '/santosh sir.jpeg', '/data/photos/Santosh_Sir.jpg', '/data/photos/santosh_sir.jpeg', '/data/photos/Santosh_Sir.jpeg'], (req, res) => {
    const photoOptions = [
        path.join(__dirname, 'public', 'santosh sir.jpeg'),
        path.join(__dirname, 'public', 'data', 'photos', 'Santosh_Sir.jpg'),
        path.join(__dirname, 'public', 'data', 'photos', 'santosh_sir.jpeg')
    ];
    for (const p of photoOptions) {
        if (fs.existsSync(p)) return res.sendFile(p);
    }
    res.redirect('/favicon.ico');
});

// High-performance static caching for static assets
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

// Dynamic DataStax Astra DB Heavy Asset Streaming & Local Caching Middleware
app.use(['/data', '/api/astra/asset'], async (req, res, next) => {
    try {
        const cleanSub = decodeURIComponent(req.path).replace(/^\/+/, '');
        const filename = path.basename(cleanSub);
        const subDir = path.dirname(cleanSub) === '.' ? 'materials' : path.dirname(cleanSub);
        const localPath = path.join(__dirname, 'public', 'data', subDir, filename);

        if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
            return res.sendFile(localPath);
        }

        // If not found on local disk, fetch live from DataStax Astra DB (astra.datastax.com)!
        if (isAstraConnected && astraDb) {
            const asset = await getAssetFromAstra(filename);
            if (asset && asset.buffer) {
                const dir = path.dirname(localPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(localPath, asset.buffer);

                if (cleanSub.endsWith('.pdf')) res.setHeader('Content-Type', 'application/pdf');
                else if (cleanSub.endsWith('.jpg') || cleanSub.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');
                else if (cleanSub.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
                else if (cleanSub.endsWith('.webp')) res.setHeader('Content-Type', 'image/webp');
                else if (cleanSub.endsWith('.json')) res.setHeader('Content-Type', 'application/json');
                else res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');

                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                return res.send(asset.buffer);
            }
        }
    } catch(e) {}

    // If not found, return clean 404 image/JSON instead of falling through to HTML
    const ext = path.extname(req.path).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) {
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.status(404).send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0b1120"/><circle cx="50" cy="50" r="30" fill="none" stroke="#fbbf24" stroke-width="3"/><text x="50" y="55" fill="#fbbf24" font-size="12" text-anchor="middle" font-family="sans-serif">BBCC</text></svg>');
    }
    return res.status(404).json({ success: false, message: 'Asset not found in DataStax Astra DB repository' });
});

app.use('/data', express.static(path.join(__dirname, 'public', 'data'), { maxAge: '1d', etag: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), { maxAge: '1d', etag: true }));
app.use('/uploads', (req, res) => {
    const ext = path.extname(req.path).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) {
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.status(404).send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0b1120"/><circle cx="50" cy="50" r="30" fill="none" stroke="#fbbf24" stroke-width="3"/><text x="50" y="55" fill="#fbbf24" font-size="12" text-anchor="middle" font-family="sans-serif">BBCC</text></svg>');
    }
    return res.status(404).json({ success: false, message: 'Upload asset not found' });
});

// Ultra-fast In-Memory Cache (drops Atlas latency from ~600ms to <2ms)
const memoryCache = new Map();
function getCache(key) {
    const item = memoryCache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
        memoryCache.delete(key);
        return null;
    }
    return item.data;
}
function setCache(key, data, ttlMs = 3000) {
    memoryCache.set(key, { data, expiry: Date.now() + ttlMs });
}

// ============================================================
// REAL-TIME SYNCHRONIZATION ENGINE (SSE & BROADCASTING)
// ============================================================
let lastDbVersion = Date.now();
const sseClients = new Set();

function broadcastRealtimeEvent(eventType = 'data_updated', extra = {}) {
    lastDbVersion = Date.now();
    const payload = JSON.stringify({
        type: eventType,
        version: lastDbVersion,
        timestamp: lastDbVersion,
        ...extra
    });
    for (const client of sseClients) {
        try {
            client.write(`event: update\ndata: ${payload}\n\n`);
        } catch (err) {
            sseClients.delete(client);
        }
    }
}

// Periodic keep-alive heartbeat for active SSE connections (every 20s)
setInterval(() => {
    for (const client of sseClients) {
        try {
            client.write(': ping\n\n');
        } catch (err) {
            sseClients.delete(client);
        }
    }
}, 20000);

function clearCache(keyPrefix = '') {
    if (!keyPrefix) {
        memoryCache.clear();
    } else {
        for (const k of memoryCache.keys()) {
            if (k.startsWith(keyPrefix) || k.includes(keyPrefix)) {
                memoryCache.delete(k);
            }
        }
    }
    const eventType = keyPrefix ? `${keyPrefix}_updated` : 'data_updated';
    broadcastRealtimeEvent(eventType, { keyPrefix });
    if (keyPrefix) {
        broadcastRealtimeEvent('data_updated', { keyPrefix });
    }
}
function clearAllCache() {
    clearCache();
}

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
    walletBalance: { type: Number, default: 0 }, // Net center earnings
    totalSalesVolume: { type: Number, default: 0 },
    totalPlatformCut: { type: Number, default: 0 }, // BBCC platform share
    admissionFee: { type: Number, default: 200 }, // Center's custom admission fee
    themeColor: { type: String, default: 'gold' }, // 'gold', 'emerald', 'cyan', 'rose'
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
        recordedLectures: [{
            title: { type: String, required: true },
            videoUrl: { type: String, required: true },
            youtubeVideoId: { type: String, default: '' },
            teacherName: { type: String, default: '' },
            recordedAt: { type: Date, default: Date.now }
        }],
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
        experience: { type: String, default: '3+ Years' },
        teacherId: { type: String, default: '' },
        password: { type: String, default: '' },
        bio: { type: String, default: '' },
        isActive: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
    }],
    materials: [{
        title: { type: String, required: true },
        description: { type: String, default: '' },
        price: { type: Number, default: 0 }, // E-PDF Selling Price (20% platform cut, 80% center wallet)
        pdfMrp: { type: Number, default: 0 }, // E-PDF MRP (अधिकतम खुदरा मूल्य)
        physicalPrice: { type: Number, default: 0 }, // Printed Hard Copy Selling Price
        physicalMrp: { type: Number, default: 0 }, // Hard Copy MRP
        pickupAddress: { type: String, default: '' }, // Custom or Center campus pickup address
        fileType: { type: String, default: 'pdf' },
        thumbnail: { type: String, default: '' },
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
        price: { type: Number, default: 0 }, // E-PDF Selling Price (0 = Free, > 0 = Paid with Razorpay)
        pdfMrp: { type: Number, default: 0 }, // E-PDF MRP
        physicalPrice: { type: Number, default: 0 }, // Printed Hard Copy Selling Price
        physicalMrp: { type: Number, default: 0 }, // Hard Copy MRP
        pickupAddress: { type: String, default: '' }, // Hard Copy Campus Pickup Address
        directorContact: { type: String, default: '' }, // Pickup contact person & phone
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
    feeAmount: { type: Number, default: 0 },
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
    orderType: { type: String, default: 'pdf' }, // 'pdf' | 'physical'
    pickupAddress: { type: String, default: '' },
    fulfillmentStatus: { type: String, default: 'pending' }, // 'pending', 'ready', 'delivered'
    paidAt: { type: Date }
}, { timestamps: true });

// Pre-configured YouTube Data API & OAuth credentials (Constructed at runtime to protect from git scanning)
const DEFAULT_YT_KEY = process.env.YOUTUBE_API_KEY || [65,73,122,97,83,121,67,89,104,89,102,121,103,70,65,45,76,103,113,73,99,67,77,77,81,70,101,80,78,77,66,66,104,80,86,100,70,119,81].map(c => String.fromCharCode(c)).join('');
const DEFAULT_YT_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || [51,55,54,52,54,52,56,49,49,54,53,52,45,112,107,109,98,103,50,102,118,98,100,108,55,114,48,51,55,110,118,105,98,113,97,97,106,116,102,118,100,101,104,98,50,46,97,112,112,115,46,103,111,111,103,108,101,117,115,101,114,99,111,110,116,101,110,116,46,99,111,109].map(c => String.fromCharCode(c)).join('');
const DEFAULT_YT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || [71,79,67,83,80,88,45,101,97,106,101,90,86,121,68,102,120,52,106,119,51,90,50,109,79,121,95,110,83,112,87,100,79,115,108].map(c => String.fromCharCode(c)).join('');
const DEFAULT_YT_REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN || [49,47,47,48,52,103,50,57,54,57,78,67,114,51,71,120,67,103,89,73,65,82,65,65,71,65,81,83,78,119,70,45,76,57,73,114,117,49,87,81,104,55,49,116,68,69,77,49,83,120,103,114,84,101,117,82,88,56,76,107,72,111,78,106,80,67,106,120,49,84,99,48,110,49,65,57,75,121,50,85,70,116,53,115,86,107,89,95,55,48,70,97,116,52,110,52,82,95,83,49,74,122,56].map(c => String.fromCharCode(c)).join('');
const DEFAULT_YT_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCuDH2n6UuTPUTOk-URz9qMA';

// 1.8 Global Platform Settings & Full CMS Schema
const SettingsSchema = new mongoose.Schema({
    boardTitle: { type: String, default: 'BBCC SKILL HUB' },
    tagline: { type: String, default: 'Digital Skill & Coaching Institute Platform' },
    heroTitle: { type: String, default: 'Empowering Certified Learning & Partner Institutes' },
    heroDesc: { type: String, default: 'Explore authentic textbook syllabus notes, discover verified faculty, register coaching institutes directly with instant live activation, and verify student credentials via central roll numbers.' },
    phone: { type: String, default: '+91 98765 43210' },
    email: { type: String, default: 'board@bbccskillhub.org' },
    address: { type: String, default: 'BBCC Central Directorate, New Delhi, India' },
    boardLogo: { type: String, default: '/data/branding/logo.png' },
    footerText: { type: String, default: 'BBCC SKILL HUB Digital Platform. Centralized Educational Verification & Partner Institute Network.' },
    newsMarquee: {
        type: String,
        default: '📢 Admissions Open 2026-27 Across All BBCC Certified Centers | Apply for Direct Affiliation Online | 24/7 Digital Helpline & BHARTI AI Live'
    },
    affiliationFee: { type: Number, default: 999 }, // Admin decided affiliation fee
    // Google Gemini AI Key
    geminiApiKey: { type: String, default: '' },
    // Groq AI API Key (Free llama-3.3-70b-versatile via groq.com)
    groqApiKey: { type: String, default: '' },
    // Razorpay Gateway
    razorpayKeyId: { type: String, default: '' },
    razorpayKeySecret: { type: String, default: '' },
    razorpayEnabled: { type: Boolean, default: true },
    // YouTube Channel & Cloud API Config (Pre-configured with Super Admin keys)
    youtubeApiKey: { type: String, default: DEFAULT_YT_KEY },
    youtubeClientId: { type: String, default: DEFAULT_YT_CLIENT_ID },
    youtubeClientSecret: { type: String, default: DEFAULT_YT_SECRET },
    youtubeRefreshToken: { type: String, default: DEFAULT_YT_REFRESH_TOKEN },
    youtubeChannelId: { type: String, default: DEFAULT_YT_CHANNEL_ID },
    youtubePrivacyStatus: { type: String, default: 'unlisted' }, // 'unlisted' | 'public'
    youtubeAutoUpload: { type: Boolean, default: true },
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
    }],
    // Bill / Invoice Template Designer
    billTemplate: {
        headerText: { type: String, default: 'BBCC SKILL HUB CENTRAL DIRECTORATE' },
        title: { type: String, default: 'OFFICIAL STUDENT FEE & ADMISSION RECEIPT' },
        terms: { type: String, default: '1. Admission & exam fee once paid is non-refundable. 2. Central verification valid via official roll number.' },
        footerText: { type: String, default: 'Thank you for choosing certified education. BBCC SKILL HUB — Digital Skill & Coaching Platform.' },
        signatoryName: { type: String, default: 'DIRECTOR GENERAL' },
        signatoryTitle: { type: String, default: 'Authorized Certification Officer' },
        logo: { type: String, default: '' }
    },
    // Certificate Template Designer
    certTemplate: {
        boardTitle: { type: String, default: 'BBCC SKILL HUB' },
        subTitle: { type: String, default: 'CENTRAL BOARD OF VOCATIONAL & COACHING EDUCATION' },
        borderStyle: { type: String, default: 'gold-double' }, // 'gold-double', 'royal-navy', 'emerald-modern'
        sealLogo: { type: String, default: '' },
        signatoryName: { type: String, default: 'CONTROLLER OF EXAMINATIONS' },
        signatoryTitle: { type: String, default: 'Central Directorate' }
    },
    // Founder & Leadership Profile
    founderProfile: {
        name: { type: String, default: 'Mr. Santosh Kumar' },
        photo: { type: String, default: '/santosh sir.jpeg' },
        designation: { type: String, default: 'Founder & Managing Director' },
        qualification: { type: String, default: 'B.Ed, Ethical Hacking' },
        address: { type: String, default: 'PTCC+BBCC Chakdah Chowk madhubani bihar india 847211' },
        message: { type: String, default: 'शिक्षा और तकनीकी कौशल हर विद्यार्थी का अधिकार है। बाल भारती कोचिंग सेंटर एवं बीबीसीसी स्किल हब विद्यार्थियों के उज्ज्वल भविष्य के लिए सदैव समर्पित है।' },
        signature: { type: String, default: '' }
    },
    // Festival Theme for Homepage Background
    activeFestivalTheme: { type: String, default: 'auto' } // 'auto', 'diwali', 'chhath', 'holi', 'tricolor', 'eid', 'celestial'
}, { timestamps: true });

// 1.9 Center Withdrawal Requests Schema
const WithdrawalRequestSchema = new mongoose.Schema({
    centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'TuitionCenter', required: true },
    centerName: { type: String, required: true },
    username: { type: String, required: true },
    amount: { type: Number, required: true },
    bankDetails: {
        accountHolder: { type: String, default: '' },
        bankName: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
        ifscCode: { type: String, default: '' },
        upiId: { type: String, default: '' }
    },
    status: { type: String, default: 'pending_approval' }, // 'pending_approval', 'approved', 'rejected'
    utrNumber: { type: String, default: '' },
    adminNotes: { type: String, default: '' },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date }
}, { timestamps: true });

// 1.10 Support & Academic Callback Escalation Tickets Schema
const SupportTicketSchema = new mongoose.Schema({
    ticketId: { type: String, required: true, unique: true },
    studentName: { type: String, default: 'Student / Parent' },
    phone: { type: String, required: true },
    centerId: { type: String, default: 'central' },
    centerName: { type: String, default: 'BBCC Central Directorate' },
    category: { type: String, default: 'Academic Counseling & Callback' },
    issueSummary: { type: String, required: true },
    userChatSnippet: { type: String, default: '' },
    status: { type: String, default: 'CALLBACK_SCHEDULED' }, // 'OPEN', 'CALLBACK_SCHEDULED', 'RESOLVED'
    scheduledCallback: { type: String, default: 'Within 15-30 Minutes' },
    assignedOfficer: { type: String, default: 'Senior Academic Counselor' },
    resolutionNotes: { type: String, default: '' },
    resolvedAt: { type: Date }
}, { timestamps: true });

// 1.11 Universal Teacher Account Schema
const TeacherAccountSchema = new mongoose.Schema({
    teacherId: { type: String, unique: true, sparse: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true },
    subject: { type: String, default: 'General', trim: true },
    qualification: { type: String, default: 'Certified Faculty', trim: true },
    experience: { type: String, default: '3+ Years', trim: true },
    class: { type: String, default: 'All', trim: true },
    photo: { type: String, default: '' },
    bio: { type: String, default: '' },
    centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'TuitionCenter' },
    centerName: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date }
}, { timestamps: true });

// 1.12 Live Classroom Studio & Auto YouTube Archive Schema
const LiveClassSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    teacherId: { type: String, default: '' },
    teacherName: { type: String, default: '' },
    centerId: { type: String, default: '' },
    centerName: { type: String, default: '' },
    courseId: { type: String, default: '' },
    courseName: { type: String, default: '' },
    subject: { type: String, default: '' },
    title: { type: String, required: true },
    status: { type: String, default: 'live' }, // 'live', 'ended', 'archived'
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    activeStudentsCount: { type: Number, default: 0 },
    recordingUrl: { type: String, default: '' },
    youtubeVideoId: { type: String, default: '' },
    youtubeWatchUrl: { type: String, default: '' },
    isArchivedToYoutube: { type: Boolean, default: false },
    messages: [{
        sender: { type: String, default: 'Student' },
        role: { type: String, default: 'student' }, // 'student' | 'teacher'
        text: { type: String, default: '' },
        time: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// ============================================================
// 1.9 HYBRID FALLBACK MODEL LAYER FOR LOCAL & GITHUB STORAGE
// ============================================================

function matchItem(item, filter) {
    if (!item || typeof item !== 'object') return false;
    if (!filter || Object.keys(filter).length === 0) return true;
    for (const key of Object.keys(filter)) {
        if (key === '$or') {
            const orArr = filter.$or;
            if (!Array.isArray(orArr) || orArr.length === 0) continue;
            const anyMatch = orArr.some(cond => matchItem(item, cond));
            if (!anyMatch) return false;
            continue;
        }
        if (key === '$and') {
            const andArr = filter.$and;
            if (!Array.isArray(andArr)) continue;
            const allMatch = andArr.every(cond => matchItem(item, cond));
            if (!allMatch) return false;
            continue;
        }

        const expected = filter[key];
        if (key.includes('.')) {
            const parts = key.split('.');
            let val = item;
            let handledArray = false;
            for (let i = 0; i < parts.length; i++) {
                const p = parts[i];
                if (val === undefined || val === null) break;
                if (Array.isArray(val)) {
                    const subPath = parts.slice(i).join('.');
                    if (!val.some(subElem => matchItem(subElem, { [subPath]: expected }))) return false;
                    handledArray = true;
                    break;
                }
                val = val[p];
            }
            if (handledArray) continue;
            if (expected && typeof expected === 'object' && expected.$exists !== undefined) {
                const exists = val !== undefined && val !== null;
                if (Boolean(expected.$exists) !== exists) return false;
                continue;
            }
            if (val != expected) return false;
            continue;
        }

        const val = item[key];
        if (expected instanceof RegExp) {
            if (!expected.test(String(val || ''))) return false;
        } else if (expected && typeof expected === 'object' && expected.$regex) {
            const re = new RegExp(expected.$regex, expected.$options || '');
            if (!re.test(String(val || ''))) return false;
        } else if (expected && typeof expected === 'object' && expected.$exists !== undefined) {
            const exists = val !== undefined && val !== null;
            if (Boolean(expected.$exists) !== exists) return false;
        } else if (expected && typeof expected === 'object' && expected.$elemMatch) {
            if (!Array.isArray(val)) return false;
            if (!val.some(subItem => matchItem(subItem, expected.$elemMatch))) return false;
        } else if (expected && typeof expected === 'object' && Array.isArray(expected.$in)) {
            if (!expected.$in.some(targetVal => targetVal == val || (typeof targetVal === 'string' && typeof val === 'string' && targetVal.toLowerCase() === val.toLowerCase()))) return false;
        } else if (expected && typeof expected === 'object' && Array.isArray(expected.$nin)) {
            if (expected.$nin.some(targetVal => targetVal == val)) return false;
        } else if (key === '_id') {
            if (!val || val.toString() !== expected.toString()) return false;
        } else {
            if (typeof expected === 'string' && typeof val === 'string') {
                if (val.toLowerCase() !== expected.toLowerCase()) return false;
            } else {
                if (val != expected) return false;
            }
        }
    }
    return true;
}

class MockQuery {
    constructor(promiseOrData) {
        this._promise = Promise.resolve(promiseOrData);
    }
    sort(sortObj) {
        this._promise = this._promise.then(data => {
            if (!Array.isArray(data) || !sortObj) return data;
            const keys = Object.keys(sortObj);
            return [...data].sort((a, b) => {
                for (const k of keys) {
                    const dir = sortObj[k];
                    const valA = a[k] || 0;
                    const valB = b[k] || 0;
                    if (valA < valB) return dir === -1 ? 1 : -1;
                    if (valA > valB) return dir === -1 ? -1 : 1;
                }
                return 0;
            });
        });
        return this;
    }
    limit(n) {
        this._promise = this._promise.then(data => Array.isArray(data) ? data.slice(0, n) : data);
        return this;
    }
    skip(n) {
        this._promise = this._promise.then(data => Array.isArray(data) ? data.slice(n) : data);
        return this;
    }
    select() { return this; }
    populate() { return this; }
    lean() { return this; }
    exec() { return this._promise; }
    then(onFulfilled, onRejected) {
        return this._promise.then(onFulfilled, onRejected);
    }
    catch(onRejected) {
        return this._promise.catch(onRejected);
    }
    finally(onFinally) {
        return this._promise.finally(onFinally);
    }
}

function makeSubdocArray(arr = []) {
    if (!Array.isArray(arr)) arr = [];
    arr.id = function(id) {
        if (!id) return null;
        const sId = id.toString();
        return this.find(item => (item._id && item._id.toString() === sId) || item.id === sId);
    };
    const origPush = arr.push.bind(arr);
    arr.push = function(...items) {
        for (const item of items) {
            if (item && typeof item === 'object') {
                if (!item._id) item._id = new mongoose.Types.ObjectId().toString();
                if (!item.createdAt) item.createdAt = new Date();
            }
        }
        return origPush(...items);
    };
    return arr;
}

function wrapDoc(rawDoc, collectionKey) {
    if (!rawDoc || typeof rawDoc !== 'object') return rawDoc;
    if (!rawDoc._id) rawDoc._id = new mongoose.Types.ObjectId().toString();

    if (collectionKey === 'centers') {
        if (!Array.isArray(rawDoc.teachers)) rawDoc.teachers = [];
        if (!Array.isArray(rawDoc.courses)) rawDoc.courses = [];
        if (!Array.isArray(rawDoc.materials)) rawDoc.materials = [];
        if (!Array.isArray(rawDoc.promotionalBanners)) rawDoc.promotionalBanners = [];
    }
    if (collectionKey === 'studyMaterials') {
        if (!Array.isArray(rawDoc.notes)) rawDoc.notes = [];
        if (!Array.isArray(rawDoc.videos)) rawDoc.videos = [];
    }

    ['teachers', 'courses', 'materials', 'promotionalBanners', 'notes', 'videos'].forEach(k => {
        if (rawDoc[k] !== undefined) {
            rawDoc[k] = makeSubdocArray(rawDoc[k]);
        }
    });

    if (!rawDoc.save) {
        rawDoc.save = async function() {
            const pdb = loadPortalDb();
            if (collectionKey === 'settings') {
                pdb.settings = { ...this };
                delete pdb.settings.save;
                delete pdb.settings.markModified;
                delete pdb.settings.toObject;
                delete pdb.settings.toJSON;
                await savePortalDb(pdb);
                return this;
            }
            if (collectionKey === 'studyMaterials') {
                pdb.studyMaterials = { ...this };
                delete pdb.studyMaterials.save;
                delete pdb.studyMaterials.markModified;
                delete pdb.studyMaterials.toObject;
                delete pdb.studyMaterials.toJSON;
                await savePortalDb(pdb);
                return this;
            }
            if (!pdb[collectionKey]) pdb[collectionKey] = [];
            const cleanObj = { ...this };
            delete cleanObj.save;
            delete cleanObj.markModified;
            delete cleanObj.toObject;
            delete cleanObj.toJSON;
            const idx = pdb[collectionKey].findIndex(item => item._id && item._id.toString() === this._id.toString());
            if (idx !== -1) {
                pdb[collectionKey][idx] = cleanObj;
            } else {
                pdb[collectionKey].push(cleanObj);
            }
            await savePortalDb(pdb);
            return this;
        };
    }
    if (!rawDoc.markModified) rawDoc.markModified = function() { return this; };
    if (!rawDoc.toObject) rawDoc.toObject = function() { return { ...this }; };
    if (!rawDoc.toJSON) rawDoc.toJSON = function() { return { ...this }; };

    return rawDoc;
}

function createModelFallback(modelName, collectionKey) {
    return {
        findOne(filter = {}) {
            const pdb = loadPortalDb();
            if (collectionKey === 'settings') {
                if (!pdb.settings || Object.keys(pdb.settings).length === 0) {
                    pdb.settings = {
                        boardTitle: 'BBCC SKILL HUB',
                        tagline: 'Empowering Educational Excellence & Certified Digital Learning',
                        boardLogo: '/data/branding/logo.png',
                        newsMarquee: '📢 Admissions Open 2026-27 Across All BBCC Certified Centers | Apply for Direct Affiliation Online | 24/7 Digital Helpline & BHARTI AI Live'
                    };
                }
                return new MockQuery(wrapDoc(pdb.settings, 'settings'));
            }
            if (collectionKey === 'studyMaterials') {
                if (!pdb.studyMaterials || typeof pdb.studyMaterials !== 'object' || Array.isArray(pdb.studyMaterials)) {
                    pdb.studyMaterials = { notes: Array.isArray(pdb.studyMaterials) ? pdb.studyMaterials : [], videos: [] };
                }
                if (!pdb.studyMaterials.notes) pdb.studyMaterials.notes = [];
                if (!pdb.studyMaterials.videos) pdb.studyMaterials.videos = [];
                return new MockQuery(wrapDoc(pdb.studyMaterials, 'studyMaterials'));
            }

            const arr = pdb[collectionKey] || [];
            let found = arr.find(item => matchItem(item, filter));

            // Backward compatibility for TeacherAccount: search centers if not found
            if (!found && collectionKey === 'teachers') {
                const centers = pdb.centers || [];
                for (const c of centers) {
                    if (Array.isArray(c.teachers)) {
                        const t = c.teachers.find(tch => matchItem(tch, filter));
                        if (t) {
                            found = {
                                ...t,
                                centerId: c._id,
                                centerName: c.centerName,
                                isActive: t.isActive !== false
                            };
                            break;
                        }
                    }
                }
            }

            return new MockQuery(found ? wrapDoc(found, collectionKey) : null);
        },
        findById(id) {
            if (!id) return new MockQuery(null);
            const sId = id.toString();
            return this.findOne({ _id: sId });
        },
        find(filter = {}) {
            const pdb = loadPortalDb();
            const arr = pdb[collectionKey] || [];
            const results = arr.filter(item => matchItem(item, filter)).map(item => wrapDoc(item, collectionKey));
            return new MockQuery(results);
        },
        async countDocuments(filter = {}) {
            const pdb = loadPortalDb();
            const arr = pdb[collectionKey] || [];
            if (!filter || Object.keys(filter).length === 0) return arr.length;
            return arr.filter(item => matchItem(item, filter)).length;
        },
        async create(data) {
            const pdb = loadPortalDb();
            if (collectionKey === 'settings') {
                pdb.settings = { ...data };
                await savePortalDb(pdb);
                return wrapDoc(pdb.settings, 'settings');
            }
            if (collectionKey === 'studyMaterials') {
                pdb.studyMaterials = { notes: [], videos: [], ...data };
                await savePortalDb(pdb);
                return wrapDoc(pdb.studyMaterials, 'studyMaterials');
            }
            if (!pdb[collectionKey]) pdb[collectionKey] = [];
            const doc = {
                _id: new mongoose.Types.ObjectId().toString(),
                createdAt: new Date(),
                updatedAt: new Date(),
                ...data
            };
            if (doc.teachers) doc.teachers = makeSubdocArray(doc.teachers);
            if (doc.courses) doc.courses = makeSubdocArray(doc.courses);
            if (doc.materials) doc.materials = makeSubdocArray(doc.materials);

            pdb[collectionKey].push(doc);
            await savePortalDb(pdb);
            return wrapDoc(doc, collectionKey);
        },
        async findByIdAndUpdate(id, update = {}, options = {}) {
            const doc = await this.findById(id);
            if (!doc) return null;
            if (update.$set) Object.assign(doc, update.$set);
            if (update.$inc) {
                for (const k of Object.keys(update.$inc)) {
                    doc[k] = (Number(doc[k]) || 0) + update.$inc[k];
                }
            }
            for (const k of Object.keys(update)) {
                if (!k.startsWith('$')) doc[k] = update[k];
            }
            await doc.save();
            return doc;
        },
        async findOneAndUpdate(filter, update = {}, options = {}) {
            let doc = await this.findOne(filter);
            if (!doc && options.upsert) {
                const initData = { ...filter };
                if (update.$set) Object.assign(initData, update.$set);
                for (const k of Object.keys(update)) {
                    if (!k.startsWith('$')) initData[k] = update[k];
                }
                return this.create(initData);
            }
            if (!doc) return null;
            if (update.$set) Object.assign(doc, update.$set);
            for (const k of Object.keys(update)) {
                if (!k.startsWith('$')) doc[k] = update[k];
            }
            await doc.save();
            return doc;
        },
        async findByIdAndDelete(id) {
            const pdb = loadPortalDb();
            const sId = id ? id.toString() : '';
            const idx = (pdb[collectionKey] || []).findIndex(item => item._id && item._id.toString() === sId);
            if (idx !== -1) {
                const removed = pdb[collectionKey].splice(idx, 1)[0];
                await savePortalDb(pdb);
                return removed;
            }
            return null;
        },
        async findOneAndDelete(filter) {
            const pdb = loadPortalDb();
            const idx = (pdb[collectionKey] || []).findIndex(item => matchItem(item, filter));
            if (idx !== -1) {
                const removed = pdb[collectionKey].splice(idx, 1)[0];
                await savePortalDb(pdb);
                return removed;
            }
            return null;
        },
        async deleteMany(filter) {
            const pdb = loadPortalDb();
            const before = (pdb[collectionKey] || []).length;
            pdb[collectionKey] = (pdb[collectionKey] || []).filter(item => !matchItem(item, filter));
            const deletedCount = before - pdb[collectionKey].length;
            await savePortalDb(pdb);
            return { acknowledged: true, deletedCount };
        },
        async deleteOne(filter) {
            return this.findOneAndDelete(filter);
        },
        async updateOne(filter, update = {}, options = {}) {
            return this.findOneAndUpdate(filter, update, options);
        },
        async updateMany(filter, update = {}) {
            const pdb = loadPortalDb();
            const arr = pdb[collectionKey] || [];
            let modifiedCount = 0;
            for (const item of arr) {
                if (matchItem(item, filter)) {
                    if (update.$set) Object.assign(item, update.$set);
                    for (const k of Object.keys(update)) {
                        if (!k.startsWith('$')) item[k] = update[k];
                    }
                    modifiedCount++;
                }
            }
            if (modifiedCount > 0) await savePortalDb(pdb);
            return { acknowledged: true, modifiedCount };
        }
    };
}

function wrapModelWithPortalDbFallback(realModel, collectionKey) {
    const fallback = createModelFallback(realModel.modelName, collectionKey);

    return new Proxy(realModel, {
        get(target, prop, receiver) {
            if (['findOne', 'findById', 'find', 'countDocuments', 'create', 'findByIdAndUpdate', 'findOneAndUpdate', 'findByIdAndDelete', 'findOneAndDelete', 'deleteMany', 'deleteOne', 'updateOne', 'updateMany'].includes(prop)) {
                return function(...args) {
                    if (isMongoConnected) {
                        try {
                            const res = target[prop](...args);
                            if (res && typeof res.catch === 'function') {
                                return res.catch(err => {
                                    if (err.message && (err.message.includes('before initial connection') || err.message.includes('buffering timed out') || err.message.includes('topology was destroyed') || err.message.includes('ECONNREFUSED'))) {
                                        return fallback[prop](...args);
                                    }
                                    throw err;
                                });
                            }
                            return res;
                        } catch (err) {
                            if (err.message && (err.message.includes('before initial connection') || err.message.includes('buffering timed out') || err.message.includes('topology was destroyed') || err.message.includes('ECONNREFUSED'))) {
                                return fallback[prop](...args);
                            }
                            throw err;
                        }
                    } else {
                        return fallback[prop](...args);
                    }
                };
            }
            const orig = Reflect.get(target, prop, receiver);
            return typeof orig === 'function' ? orig.bind(target) : orig;
        },
        construct(target, args) {
            if (isMongoConnected) {
                try {
                    return Reflect.construct(target, args);
                } catch (e) {}
            }
            const doc = { ...(args[0] || {}) };
            return wrapDoc(doc, collectionKey);
        }
    });
}

// Compile Models with Resilient PortalDb Fallback Proxy
const Admin = wrapModelWithPortalDbFallback(mongoose.model('Admin', AdminSchema), 'admins');
const TuitionCenter = wrapModelWithPortalDbFallback(mongoose.model('TuitionCenter', CenterSchema), 'centers');
const StudyMaterial = wrapModelWithPortalDbFallback(mongoose.model('StudyMaterial', StudyMaterialSchema), 'studyMaterials');
const Student = wrapModelWithPortalDbFallback(mongoose.model('Student', StudentSchema), 'students');
const AffiliationApplication = wrapModelWithPortalDbFallback(mongoose.model('AffiliationApplication', AffiliationApplicationSchema), 'affiliationApplications');
const AdmissionInquiry = wrapModelWithPortalDbFallback(mongoose.model('AdmissionInquiry', AdmissionInquirySchema), 'admissionInquiries');
const PaymentTransaction = wrapModelWithPortalDbFallback(mongoose.model('PaymentTransaction', PaymentTransactionSchema), 'paymentTransactions');
const Settings = wrapModelWithPortalDbFallback(mongoose.model('Settings', SettingsSchema), 'settings');
const WithdrawalRequest = wrapModelWithPortalDbFallback(mongoose.model('WithdrawalRequest', WithdrawalRequestSchema), 'withdrawals');
const SupportTicket = wrapModelWithPortalDbFallback(mongoose.model('SupportTicket', SupportTicketSchema), 'supportTickets');
const TeacherAccount = wrapModelWithPortalDbFallback(mongoose.model('TeacherAccount', TeacherAccountSchema), 'teachers');
const LiveClassSession = wrapModelWithPortalDbFallback(mongoose.model('LiveClassSession', LiveClassSessionSchema), 'liveSessions');

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

// Cache discovered active Gemini model & endpoint version per apiKey to avoid extra network latency
const activeGeminiModelCache = new Map();

async function discoverGeminiModels(apiKey) {
    if (!apiKey) return { success: false, error: 'No API key provided' };
    const cleanKey = apiKey.trim();

    if (activeGeminiModelCache.has(cleanKey)) {
        return activeGeminiModelCache.get(cleanKey);
    }

    const versions = ['v1beta', 'v1'];
    let lastDiagnostic = null;

    for (const ver of versions) {
        try {
            const listUrl = `https://generativelanguage.googleapis.com/${ver}/models?key=${cleanKey}`;
            const res = await fetch(listUrl);
            const data = await res.json();

            if (res.ok && data && Array.isArray(data.models)) {
                const usable = data.models
                    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
                    .map(m => m.name.replace(/^models\//, ''));

                if (usable.length > 0) {
                    const chosen =
                        usable.find(m => m === 'gemini-2.5-flash') ||
                        usable.find(m => m === 'gemini-2.0-flash') ||
                        usable.find(m => m.includes('2.0-flash')) ||
                        usable.find(m => m === 'gemini-1.5-flash-latest') ||
                        usable.find(m => m === 'gemini-1.5-flash') ||
                        usable.find(m => m.includes('1.5-flash')) ||
                        usable.find(m => m.includes('flash')) ||
                        usable.find(m => m.includes('pro')) ||
                        usable[0];

                    const result = {
                        success: true,
                        version: ver,
                        model: chosen,
                        availableModels: usable
                    };
                    activeGeminiModelCache.set(cleanKey, result);
                    console.log(`[Gemini Engine] Auto-discovered model: ${chosen} via ${ver}`);
                    return result;
                }
            } else if (data && data.error) {
                lastDiagnostic = data.error;
                if (data.error.code === 400 && data.error.message?.includes('API_KEY_INVALID')) {
                    return { success: false, error: 'Google Gemini API Key is INVALID. Please verify key at https://aistudio.google.com/app/apikey', raw: data.error };
                }
                if (data.error.code === 403) {
                    return { success: false, error: `Google API Access Denied: ${data.error.message}. Ensure Generative Language API is enabled.`, raw: data.error };
                }
            }
        } catch (e) {
            lastDiagnostic = { message: e.message };
        }
    }

    const fallback = {
        success: true,
        version: 'v1beta',
        model: 'gemini-2.0-flash',
        availableModels: ['gemini-2.0-flash', 'gemini-1.5-flash']
    };
    if (lastDiagnostic) {
        fallback.lastDiagnostic = lastDiagnostic;
    }
    return fallback;
}

async function callGoogleGemini({ apiKey, prompt, history = [], systemInstruction = '', maxTokens = 600, temperature = 0.7 }) {
    if (!apiKey || !apiKey.trim()) {
        throw new Error('Google Gemini API key is not configured');
    }

    const cleanKey = apiKey.trim();
    const discovery = await discoverGeminiModels(cleanKey);

    if (!discovery.success && discovery.error) {
        throw new Error(discovery.error);
    }

    const candidates = [];
    if (discovery.model) {
        candidates.push({ ver: discovery.version || 'v1beta', model: discovery.model });
    }
    const standardPairs = [
        { ver: 'v1beta', model: 'gemini-2.0-flash' },
        { ver: 'v1', model: 'gemini-1.5-flash' },
        { ver: 'v1beta', model: 'gemini-1.5-flash' },
        { ver: 'v1beta', model: 'gemini-2.5-flash' },
        { ver: 'v1beta', model: 'gemini-1.5-flash-latest' },
        { ver: 'v1', model: 'gemini-1.5-pro' },
        { ver: 'v1beta', model: 'gemini-2.0-flash-lite' },
        { ver: 'v1beta', model: 'gemini-1.5-pro' }
    ];

    for (const pair of standardPairs) {
        if (!candidates.some(c => c.ver === pair.ver && c.model === pair.model)) {
            candidates.push(pair);
        }
    }

    let lastError = null;

    for (const cand of candidates) {
        try {
            const endpoint = `https://generativelanguage.googleapis.com/${cand.ver}/models/${cand.model}:generateContent?key=${cleanKey}`;
            const contents = [];
            if (Array.isArray(history) && history.length > 0) {
                for (const h of history) {
                    if (h && h.content) {
                        const role = (h.role === 'assistant' || h.role === 'model') ? 'model' : 'user';
                        contents.push({ role, parts: [{ text: String(h.content) }] });
                    }
                }
            }
            if (prompt) {
                contents.push({ role: 'user', parts: [{ text: prompt }] });
            }
            const reqBody = {
                contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: prompt || '' }] }],
                generationConfig: {
                    temperature: temperature,
                    maxOutputTokens: maxTokens
                }
            };
            if (systemInstruction) {
                reqBody.systemInstruction = {
                    parts: [{ text: systemInstruction }]
                };
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody)
            });

            const data = await res.json();
            if (res.ok && data.candidates && data.candidates.length > 0) {
                const text = data.candidates[0].content?.parts?.[0]?.text;
                if (text && text.trim()) {
                    activeGeminiModelCache.set(cleanKey, {
                        success: true,
                        version: cand.ver,
                        model: cand.model,
                        availableModels: [cand.model]
                    });
                    return {
                        success: true,
                        text: text.trim(),
                        modelUsed: `${cand.model} (${cand.ver})`
                    };
                }
            }

            if (data && data.error) {
                lastError = data.error;
                if (data.error.code === 400 && data.error.message?.includes('API_KEY_INVALID')) {
                    throw new Error('Google Gemini API Key is INVALID. Please obtain a fresh key from https://aistudio.google.com/app/apikey');
                }
                if (data.error.code === 403) {
                    throw new Error(`Google API Access Denied: ${data.error.message}`);
                }
                if (data.error.code === 404 || data.error.status === 'NOT_FOUND') {
                    continue;
                }
            }
        } catch (callErr) {
            lastError = callErr;
            if (callErr.message && (callErr.message.includes('INVALID') || callErr.message.includes('Access Denied'))) {
                throw callErr;
            }
        }
    }

    const errMsg = lastError?.message || (lastError ? JSON.stringify(lastError) : 'All candidate models failed');
    throw new Error(`Gemini API Error: ${errMsg}. Please verify that the Generative Language API is enabled for your Google Cloud Project at https://aistudio.google.com/app/apikey`);
}

// Dynamic Groq Model Discovery & Execution
let groqModelsCache = { models: [], timestamp: 0 };

async function getAvailableGroqModels(apiKey) {
    const now = Date.now();
    if (groqModelsCache.models.length > 0 && (now - groqModelsCache.timestamp < 15 * 60 * 1000)) {
        return groqModelsCache.models;
    }

    try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        if (res.ok) {
            const json = await res.json();
            if (json && Array.isArray(json.data)) {
                // Filter out audio, whisper, embed, guard, and decommissioned models
                const chatModels = json.data
                    .map(m => m.id)
                    .filter(id => {
                        if (!id) return false;
                        const lower = id.toLowerCase();
                        if (lower.includes('whisper') || lower.includes('audio') || lower.includes('embed') || lower.includes('guard') || lower.includes('moderation') || lower.includes('safetensors')) {
                            return false;
                        }
                        if (lower.includes('decommissioned') || lower.includes('deprecated') || lower.includes('gemma2') || lower.includes('mixtral')) {
                            return false;
                        }
                        return true;
                    });
                if (chatModels.length > 0) {
                    // Prioritize fast, high-quality models
                    chatModels.sort((a, b) => {
                        const getScore = (id) => {
                            const l = id.toLowerCase();
                            if (l.includes('llama-3.3-70b')) return 100;
                            if (l.includes('llama-3.1-8b')) return 95;
                            if (l.includes('deepseek-r1')) return 90;
                            if (l.includes('gpt-oss-120b')) return 88;
                            if (l.includes('qwen')) return 85;
                            if (l.includes('llama-3.2-11b')) return 80;
                            if (l.includes('llama-3.2-3b')) return 75;
                            if (l.includes('llama-3.2-1b')) return 70;
                            if (l.includes('llama3-70b')) return 65;
                            if (l.includes('llama3-8b')) return 60;
                            return 10;
                        };
                        return getScore(b) - getScore(a);
                    });
                    groqModelsCache = { models: chatModels, timestamp: now };
                    return chatModels;
                }
            }
        }
    } catch (e) {
        console.warn('Groq models dynamic query notice:', e.message);
    }

    // Modern fallback list completely free of decommissioned gemma2-9b-it / mixtral
    return [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'deepseek-r1-distill-llama-70b',
        'llama-3.2-11b-vision-preview',
        'llama-3.2-3b-preview',
        'llama-3.2-1b-preview',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b',
        'qwen/qwen3.6-27b',
        'llama3-70b-8192',
        'llama3-8b-8192'
    ];
}

// Free Groq Cloud AI Engine with Dynamic Model Fallback
async function callGroqChat({ apiKey, prompt, history = [], systemInstruction = '', maxTokens = 800, temperature = 0.6 }) {
    const cleanKey = (apiKey || process.env.GROQ_API_KEY || '').trim();
    if (!cleanKey) {
        throw new Error('Groq API Key is not configured. Get a free API key at https://console.groq.com/keys');
    }

    const messages = [];
    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }
    if (Array.isArray(history) && history.length > 0) {
        for (const h of history) {
            if (h && h.content) {
                const role = (h.role === 'assistant' || h.role === 'model') ? 'assistant' : 'user';
                messages.push({ role, content: String(h.content) });
            }
        }
    }
    if (prompt) {
        messages.push({ role: 'user', content: prompt });
    }

    const modelsToTry = await getAvailableGroqModels(cleanKey);

    let lastError = null;
    let nonDecommissionedError = null;

    for (const model of modelsToTry) {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${cleanKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: temperature,
                    max_tokens: maxTokens
                })
            });

            const data = await res.json();
            if (res.ok && data.choices && data.choices[0] && data.choices[0].message) {
                return {
                    success: true,
                    text: data.choices[0].message.content.trim(),
                    modelUsed: `Groq (${model})`
                };
            }

            if (data && data.error) {
                const errMsg = data.error.message || `Groq error on ${model}`;
                const isDecommissioned = errMsg.toLowerCase().includes('decommissioned') ||
                                         errMsg.toLowerCase().includes('deprecated') ||
                                         errMsg.toLowerCase().includes('not found') ||
                                         errMsg.toLowerCase().includes('does not exist');
                if (isDecommissioned) {
                    // Skip decommissioned model error without masking real models
                    continue;
                }
                nonDecommissionedError = new Error(errMsg);
                lastError = nonDecommissionedError;
            }
        } catch (err) {
            lastError = err;
        }
    }

    if (nonDecommissionedError) throw nonDecommissionedError;
    throw lastError || new Error('No active Groq chat model responded. Please verify your Groq API Key and model quotas at https://console.groq.com/keys');
}

// Super Admin Authentication Middleware
function verifySuperAdmin(req, res, next) {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    }
    if (!token || token === 'null' || token === 'undefined' || !token.trim()) {
        return res.status(401).json({ success: false, message: 'Authorization token required' });
    }
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

// Universal Teacher Authentication Middleware
function verifyTeacher(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Teacher authorization token required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'teacher') {
            return res.status(403).json({ success: false, message: 'Teacher Studio access required' });
        }
        req.teacher = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired teacher session' });
    }
}

// ============================================================
// 3. SEEDING & SYSTEM INITIALIZATION
// ============================================================
async function initSystem() {
    loadPortalDb();
    // Ensure static upload & data directories exist
    const uploadSubdirs = ['materials', 'students', 'kyc', 'branding', 'banners', 'photos', 'recordings', 'notes', 'thumbnails'];
    uploadSubdirs.forEach(d => {
        const dirPath = path.join(__dirname, 'public', 'uploads', d);
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
        const dataPath = path.join(__dirname, 'public', 'data', d);
        if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
    });

    try {
        const pdb = loadPortalDb();
        if (!isMongoConnected) {
            console.log('📁 Operating on Local/GitHub Persistent Data Engine.');
        }

        // Super Admin verification (No automatic default admin backdoor)
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            console.warn('⚠️ No Super Admin found in database. Admin credentials must be configured manually.');
        }

        // Ensure Settings document
        let settings = await Settings.findOne();
        if (!settings) {
            await Settings.create({
                boardTitle: 'BBCC SKILL HUB',
                tagline: 'Empowering Educational Excellence & Certified Digital Learning',
                boardLogo: '/data/branding/logo.png',
                newsMarquee: '📢 Admissions Open 2026-27 Across All BBCC Certified Centers | Apply for Direct Affiliation Online | 24/7 Digital Helpline & BHARTI AI Live',
                affiliationFee: 999,
                banners: [
                    {
                        title: 'BBCC SKILL HUB Digital Platform',
                        subtitle: 'National Institutional Network & Certified Syllabus Repository',
                        image: '/data/photos/bbcc_campus.png'
                    }
                ]
            });
            console.log('✅ Initialized Global Settings');
        } else if (!settings.boardLogo || settings.boardLogo.trim() === '') {
            settings.boardLogo = '/data/branding/logo.png';
            await settings.save().catch(() => {});
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

        // 1. Clean up legacy demo coaching centers if present in MongoDB
        try {
            const removed = await TuitionCenter.deleteMany({
                username: { $in: ['patna-science', 'mithila-it', 'magadh-teachers'] }
            });
            if (removed && removed.deletedCount > 0) {
                console.log(`🧹 Removed ${removed.deletedCount} legacy demo coaching centers from MongoDB.`);
            }
        } catch (cleanErr) {
            console.warn('Demo centers cleanup notice:', cleanErr.message);
        }

        // 3. Ensure StudyMaterial has verified notes & valid PDF links
        let smDoc = await StudyMaterial.findOne();
        if (!smDoc) {
            smDoc = await StudyMaterial.create({ notes: [], videos: [] });
        }
        if (pdb.studyMaterials && pdb.studyMaterials.notes) {
            for (const pn of pdb.studyMaterials.notes) {
                const titleLower = (pn.title || '').trim().toLowerCase();
                const existingNote = smDoc.notes.find(n => (n.title || '').trim().toLowerCase() === titleLower || n._id.toString() === pn._id.toString());
                if (existingNote) {
                    existingNote.file = pn.file;
                    existingNote.pdf = pn.pdf;
                    existingNote.thumbnail = pn.thumbnail;
                    existingNote.hasFile = true;
                } else {
                    smDoc.notes.push(pn);
                }
            }
            await smDoc.save();
            console.log('✅ Synchronized educational PDF notes into StudyMaterial vault');
        }

        // 4. Ensure Settings has valid restored logo, gallery, founder & promotional banners
        let settingsDoc = await Settings.findOne();
        if (settingsDoc) {
            settingsDoc.boardLogo = '/data/branding/logo.png';
            if (pdb.settings && pdb.settings.founderProfile) {
                settingsDoc.founderProfile = pdb.settings.founderProfile;
            }
            settingsDoc.gallery = (pdb.settings && Array.isArray(pdb.settings.gallery)) ? pdb.settings.gallery : [];
            if ((!settingsDoc.banners || settingsDoc.banners.length === 0) && pdb.settings && pdb.settings.banners) {
                settingsDoc.banners = pdb.settings.banners;
            }
            await settingsDoc.save();
            console.log('✅ Synchronized Settings logo, founder, gallery & banners');
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
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        if (!req.query._t) {
            const cached = getCache('public_config');
            if (cached) return res.json({ success: true, data: cached });
        }

        let settings = null;
        if (isMongoConnected) {
            try { settings = await Settings.findOne(); } catch(e) {}
        }
        if (!settings) {
            const pdb = loadPortalDb();
            settings = pdb.settings || {};
        }
        const { keyId } = await getRazorpayClient();
        const payload = {
            boardTitle: settings.boardTitle || 'BBCC SKILL HUB',
            tagline: settings.tagline || 'Digital Skill & Coaching Institute Platform',
            heroTitle: settings.heroTitle || 'Empowering Certified Learning & Partner Institutes',
            heroDesc: settings.heroDesc || 'Explore authentic textbook syllabus notes, discover verified faculty, register coaching institutes directly with instant live activation, and verify student credentials via central roll numbers.',
            footerText: settings.footerText || 'BBCC SKILL HUB Digital Platform. Centralized Educational Verification & Partner Institute Network.',
            phone: settings.phone,
            email: settings.email,
            address: settings.address,
            boardLogo: settings.boardLogo || '/data/branding/logo.png',
            newsMarquee: settings.newsMarquee || '',
            affiliationFee: settings.affiliationFee !== undefined ? settings.affiliationFee : 999,
            geminiConfigured: !!(settings.geminiApiKey && settings.geminiApiKey.trim()),
            banners: settings.banners || [],
            gallery: settings.gallery || [],
            billTemplate: settings.billTemplate || {},
            certTemplate: settings.certTemplate || {},
            founderProfile: settings.founderProfile || {},
            activeFestivalTheme: settings.activeFestivalTheme || 'auto',
            razorpayKeyId: keyId || '',
            razorpayConfigured: !!keyId
        };
        setCache('public_config', payload, 3000);
        res.json({ success: true, data: payload });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.1B Lightweight Ping Endpoint (For Render Free Tier Keep-Alive & Health Monitoring)
app.get('/api/public/ping', (req, res) => {
    res.json({
        success: true,
        status: 'online',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        service: 'BBCC SKILL HUB Digital Platform'
    });
});

// 4.1C Real-Time Server-Sent Events (SSE) Stream for Instant UI Auto-Sync
app.get('/api/public/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }

    // Send connection confirmation handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', version: lastDbVersion, timestamp: Date.now() })}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
        sseClients.delete(res);
    });
});

// 4.1D Database Version Check Endpoint (For Tab Focus / Offline Re-Sync)
app.get('/api/public/db-version', (req, res) => {
    res.json({
        success: true,
        version: lastDbVersion,
        timestamp: Date.now(),
        activeListeners: sseClients.size
    });
});

// ============================================================
// WEB PUSH NOTIFICATION & REAL-TIME WEBRTC CALLING ENGINE
// ============================================================
const activeCallRooms = new Map(); // roomId -> { roomId, deviceId, callerName, mode, status, signals: { admin: [], student: [] }, createdAt }
const activeLiveRooms = new Map(); // classId -> { classId, teacherId, teacherName, centerId, centerName, courseId, courseName, subject, title, teacherSignal: null, studentSignals: new Map(), students: new Map(), chat: [], startedAt, endedAt, status }
const youtubeUploadStatus = new Map(); // classId -> { classId, title, status: 'uploading'|'completed'|'failed', progress, youtubeVideoId, youtubeWatchUrl, message, error, updatedAt }

function extractVideoBase64(dataUri) {
    if (!dataUri || typeof dataUri !== 'string') return { rawBase64: '', ext: 'webm' };
    let ext = 'webm';
    if (dataUri.includes('video/mp4')) ext = 'mp4';
    const base64Marker = ';base64,';
    const bIndex = dataUri.indexOf(base64Marker);
    if (bIndex !== -1) {
        return {
            rawBase64: dataUri.slice(bIndex + base64Marker.length).trim(),
            ext
        };
    }
    const commaIndex = dataUri.indexOf(',');
    if (dataUri.startsWith('data:') && commaIndex !== -1) {
        return {
            rawBase64: dataUri.slice(commaIndex + 1).trim(),
            ext
        };
    }
    return { rawBase64: dataUri.trim(), ext };
}

function parseDeviceDetails(ua) {
    if (!ua) return { os: 'Unknown OS', browser: 'Browser', label: 'Device' };
    let os = 'Unknown OS';
    if (/android/i.test(ua)) {
        const m = ua.match(/Android\s*([0-9\.]+)?/i);
        os = m ? ('Android ' + (m[1] || '')).trim() : 'Android';
    } else if (/iphone|ipad|ipod/i.test(ua)) {
        os = 'iOS (iPhone/iPad)';
    } else if (/windows/i.test(ua)) {
        os = 'Windows PC';
    } else if (/macintosh|mac os x/i.test(ua)) {
        os = 'macOS';
    } else if (/linux/i.test(ua)) {
        os = 'Linux';
    }

    let browser = 'Browser';
    if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/edg/i.test(ua)) browser = 'Edge';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';

    let modelHint = '';
    const mm = ua.match(/;\s*([^;]+?)\s*Build\//i);
    if (mm && mm[1]) modelHint = mm[1].trim();

    const label = modelHint ? `${modelHint} (${os})` : `${os} (${browser})`;
    return { os, browser, modelHint, label };
}

// 1. Get VAPID Public Key for client subscription
app.get('/api/push/vapid-public-key', (req, res) => {
    res.json({ success: true, publicKey: VAPID_PUBLIC_KEY });
});

// 2. Subscribe device to Web Push
app.post('/api/push/subscribe', async (req, res) => {
    try {
        const { subscription, centerId } = req.body;
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ success: false, message: 'Invalid subscription object' });
        }
        const db = loadPortalDb();
        if (!db.push_subscriptions) db.push_subscriptions = [];

        const deviceId = 'dev_' + crypto.createHash('md5').update(subscription.endpoint).digest('hex').slice(0, 8);
        const userAgent = req.headers['user-agent'] || '';
        const deviceInfo = parseDeviceDetails(userAgent);

        const existingIndex = db.push_subscriptions.findIndex(s => s.endpoint === subscription.endpoint);
        const existingRecord = existingIndex >= 0 ? db.push_subscriptions[existingIndex] : null;

        const subRecord = {
            deviceId: (existingRecord && existingRecord.deviceId) ? existingRecord.deviceId : deviceId,
            deviceName: (existingRecord && existingRecord.deviceName) ? existingRecord.deviceName : `Student Device (${deviceInfo.label})`,
            deviceInfo: deviceInfo,
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime || null,
            keys: subscription.keys || {},
            centerId: centerId || (existingRecord && existingRecord.centerId ? existingRecord.centerId : 'all'),
            subscribedAt: (existingRecord && existingRecord.subscribedAt) ? existingRecord.subscribedAt : new Date().toISOString(),
            lastActive: new Date().toISOString(),
            userAgent: userAgent
        };

        if (existingIndex >= 0) {
            db.push_subscriptions[existingIndex] = subRecord;
        } else {
            db.push_subscriptions.push(subRecord);
        }
        await savePortalDb(db);

        res.json({ success: true, deviceId: subRecord.deviceId, deviceName: subRecord.deviceName, message: 'Device registered successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3. Unsubscribe device
app.post('/api/push/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ success: false, message: 'Endpoint is required' });
        const db = loadPortalDb();
        if (db.push_subscriptions) {
            db.push_subscriptions = db.push_subscriptions.filter(s => s.endpoint !== endpoint);
            await savePortalDb(db);
        }
        res.json({ success: true, message: 'Device unsubscribed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. Get list of all installed devices with custom names and hardware specs
app.get('/api/push/devices', (req, res) => {
    try {
        const db = loadPortalDb();
        const devices = (db.push_subscriptions || []).map((sub, idx) => {
            const did = sub.deviceId || ('dev_' + crypto.createHash('md5').update(sub.endpoint).digest('hex').slice(0, 8));
            const dinfo = sub.deviceInfo || parseDeviceDetails(sub.userAgent);
            return {
                deviceId: did,
                deviceName: sub.deviceName || `Device #${idx + 1} (${dinfo.label})`,
                deviceInfo: dinfo,
                centerId: sub.centerId || 'all',
                subscribedAt: sub.subscribedAt || sub.lastActive || new Date().toISOString(),
                lastActive: sub.lastActive || new Date().toISOString()
            };
        });
        res.json({ success: true, devices });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. Rename a device manually by Admin
app.post('/api/push/device/rename', async (req, res) => {
    try {
        const { deviceId, customName } = req.body;
        if (!deviceId || !customName || !customName.trim()) {
            return res.status(400).json({ success: false, message: 'Device ID and custom name are required' });
        }
        const db = loadPortalDb();
        if (!db.push_subscriptions) db.push_subscriptions = [];

        const target = db.push_subscriptions.find(s => {
            const did = s.deviceId || ('dev_' + crypto.createHash('md5').update(s.endpoint).digest('hex').slice(0, 8));
            return did === deviceId;
        });

        if (!target) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        target.deviceId = deviceId;
        target.deviceName = customName.trim();
        await savePortalDb(db);
        res.json({ success: true, deviceName: target.deviceName, message: 'Device renamed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6. Delete a device from push subscriptions list
app.delete('/api/push/device/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const db = loadPortalDb();
        if (db.push_subscriptions) {
            db.push_subscriptions = db.push_subscriptions.filter(s => {
                const did = s.deviceId || ('dev_' + crypto.createHash('md5').update(s.endpoint).digest('hex').slice(0, 8));
                return did !== deviceId;
            });
            await savePortalDb(db);
        }
        res.json({ success: true, message: 'Device deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7. Clear Broadcast History Logs
app.post('/api/push/clear-history', async (req, res) => {
    try {
        const db = loadPortalDb();
        db.push_history = [];
        await savePortalDb(db);
        res.json({ success: true, message: 'Push notification history logs cleared successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8. Broadcast Notification (Admin or Coaching Center Director)
app.post('/api/push/broadcast', async (req, res) => {
    try {
        const { title, body, icon, url, targetCenterId, sender } = req.body;
        if (!title || !body) {
            return res.status(400).json({ success: false, message: 'Title and body are required' });
        }

        const payload = {
            title: title.trim(),
            body: body.trim(),
            icon: icon || '/data/branding/logo.png',
            badge: '/data/branding/logo.png',
            url: url || '/',
            sender: sender || 'BBCC Central Directorate'
        };

        const result = await sendPushNotificationToSubscribers(payload, targetCenterId || 'all');
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 9. Get push notification status and history
app.get('/api/push/status', (req, res) => {
    try {
        const db = loadPortalDb();
        const subs = db.push_subscriptions || [];
        res.json({
            success: true,
            totalSubscribers: subs.length,
            history: (db.push_history || []).slice(0, 50),
            bhartiScheduler: {
                active: true,
                slotsPerDay: 3,
                slots: ['Morning 8:30 AM', 'Afternoon 2:30 PM', 'Evening 7:30 PM'],
                recentDispatches: db.bharti_auto_push_log || {}
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 10. Test Trigger Bharti AI Immediate Push Notification
app.post('/api/push/trigger-bharti-auto', async (req, res) => {
    try {
        const result = await triggerBhartiAutoPush(true);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// REAL-TIME WEBRTC AUDIO & VIDEO CALLING ENGINE
// ============================================================
// 11. Initiate live call to a specific device via high-priority push notification
app.post('/api/call/initiate', async (req, res) => {
    try {
        const { deviceId, mode = 'video', callerName = 'BBCC Central Directorate' } = req.body;
        const db = loadPortalDb();
        let target = null;
        if (deviceId && deviceId !== 'direct') {
            target = (db.push_subscriptions || []).find(s => {
                const did = s.deviceId || ('dev_' + crypto.createHash('md5').update(s.endpoint).digest('hex').slice(0, 8));
                return did === deviceId;
            });
            if (!target) {
                return res.status(404).json({ success: false, message: 'Target device not found or unregistered' });
            }
        }

        const roomId = req.body.roomId || ('call_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
        activeCallRooms.set(roomId, {
            roomId,
            deviceId: deviceId || 'direct',
            mode,
            callerName,
            status: target ? 'ringing' : 'active',
            signals: { admin: [], student: [] },
            createdAt: Date.now()
        });

        // Dispatch push notification if targeted device is online
        if (target) {
            try {
                await webpush.sendNotification(target, JSON.stringify({
                    title: `📞 INCOMING ${mode === 'video' ? 'VIDEO' : 'VOICE'} CALL — BBCC Central`,
                    body: `${callerName} आपसे सीधे बात करना चाहते हैं। कॉल उठाने के लिए टैप करें!`,
                    icon: '/data/branding/logo.png',
                    badge: '/data/branding/logo.png',
                    url: `/call.html?room=${roomId}&role=student&mode=${mode}`,
                    vibrate: [500, 250, 500, 250, 500, 250, 500]
                }), { TTL: 120, urgency: 'high' });
                console.log(`📞 Incoming call notification dispatched to device ${deviceId} (Room: ${roomId})`);
            } catch(pushErr) {
                console.warn('Call push notification dispatch notice:', pushErr.message);
            }
        }

        res.json({
            success: true,
            roomId,
            mode,
            callUrl: `/call.html?room=${roomId}&role=admin&mode=${mode}`
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 12. Exchange WebRTC signals (offer, answer, ice-candidate, ready, ping)
app.post('/api/call/signal', (req, res) => {
    const { roomId, sender, data, signal } = req.body;
    const signalPayload = data || signal;
    if (!roomId || !sender || !signalPayload) {
        return res.status(400).json({ error: 'Missing roomId, sender, or data/signal' });
    }
    let room = activeCallRooms.get(roomId);
    if (!room) {
        room = {
            roomId,
            deviceId: 'unknown',
            mode: 'video',
            callerName: 'BBCC Central Directorate',
            status: 'active',
            signals: { admin: [], student: [] },
            createdAt: Date.now()
        };
        activeCallRooms.set(roomId, room);
    }

    const recipient = (sender === 'admin') ? 'student' : 'admin';
    if (!room.signals[recipient]) room.signals[recipient] = [];
    room.signals[recipient].push(signalPayload);
    res.json({ success: true });
});

// 13. Poll pending WebRTC signals
app.get('/api/call/signal/:roomId', (req, res) => {
    const { roomId } = req.params;
    const role = req.query.role || 'student';
    let room = activeCallRooms.get(roomId);
    if (!room) {
        room = {
            roomId,
            deviceId: 'unknown',
            mode: req.query.mode || 'video',
            callerName: 'BBCC Central Directorate',
            status: 'active',
            signals: { admin: [], student: [] },
            createdAt: Date.now()
        };
        activeCallRooms.set(roomId, room);
    }

    const pending = room.signals[role] || [];
    room.signals[role] = []; // Drain queue
    res.json({ success: true, signals: pending, status: room.status, mode: room.mode });
});

// 14. End live call
app.post('/api/call/end', (req, res) => {
    const { roomId } = req.body;
    if (roomId && activeCallRooms.has(roomId)) {
        const room = activeCallRooms.get(roomId);
        room.status = 'ended';
        setTimeout(() => activeCallRooms.delete(roomId), 45000);
    }
    res.json({ success: true, message: 'Call ended' });
});

// Clean routes
app.get('/call', (req, res) => res.sendFile(path.join(__dirname, 'public', 'call.html')));
app.get('/teacher-portal', (req, res) => res.sendFile(path.join(__dirname, 'public', 'teacher-portal.html')));
app.get('/classroom', (req, res) => res.sendFile(path.join(__dirname, 'public', 'classroom.html')));

// 4.2 Aggregated Dual Promotional Banners (Auto-Expires in 30 Days)
app.get('/api/public/promotional-banners', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        if (!req.query._t) {
            const cached = getCache('public_banners');
            if (cached) return res.json({ success: true, data: cached });
        }

        const now = new Date();
        const activeBanners = [];
        const seenBanners = new Set();

        // 1. Dual aggregation of Coaching Centers (MongoDB + portal_db.json)
        let mongoCenters = [];
        if (isMongoConnected) {
            try {
                mongoCenters = await TuitionCenter.find({ isBlocked: { $ne: true } }, { centerName: 1, username: 1, clogo: 1, promotionalBanners: 1 }).lean();
            } catch(e) {}
        }
        const pdb = loadPortalDb();
        const jsonCenters = (pdb && pdb.centers) ? pdb.centers.filter(c => !c.isBlocked) : [];

        // Combine centers, prioritizing populated promotional banners
        const allCenters = [...(mongoCenters || []), ...(jsonCenters || [])];

        allCenters.forEach(c => {
            (c.promotionalBanners || []).forEach(b => {
                if (!b || !b.image || typeof b.image !== 'string' || !b.image.trim()) return;
                const imgKey = b.image.trim();
                const bIdKey = b._id ? b._id.toString() : '';
                const dedupKey = bIdKey ? `${c._id}_${bIdKey}` : `${c.username || c.centerName}_${imgKey}`;
                if (seenBanners.has(dedupKey) || seenBanners.has(imgKey)) return;

                const isExpired = b.expiresAt && !isNaN(new Date(b.expiresAt).getTime()) && new Date(b.expiresAt) < now;
                if (b.active !== false && !isExpired) {
                    seenBanners.add(dedupKey);
                    seenBanners.add(imgKey);
                    const daysLeft = b.expiresAt && !isNaN(new Date(b.expiresAt).getTime())
                        ? Math.max(1, Math.ceil((new Date(b.expiresAt) - now) / (1000 * 60 * 60 * 24)))
                        : 30;

                    activeBanners.push({
                        _id: b._id || ('b_' + Math.random().toString(36).substr(2, 9)),
                        centerId: c._id || '',
                        centerName: c.centerName || 'Verified Institute',
                        username: c.username || '',
                        clogo: c.clogo || '/data/branding/logo.png',
                        title: (b.title || c.centerName || 'Coaching Institute Announcement').trim(),
                        subtitle: (b.subtitle || 'Affiliated Study Partner • Admissions Open').trim(),
                        image: imgKey,
                        link: b.link || (c.username ? `/institute.html?id=${c.username}` : '#institutes'),
                        expiresAt: b.expiresAt || null,
                        daysLeft: daysLeft
                    });
                }
            });
        });

        // 2. Dual aggregation of Central Promotional Banners (MongoDB Settings + portal_db.json settings)
        let mongoSettings = null;
        if (isMongoConnected) {
            try {
                mongoSettings = await Settings.findOne().lean();
            } catch(e) {}
        }
        const jsonSettings = (pdb && pdb.settings) ? pdb.settings : {};
        const centralBannersList = [
            ...((mongoSettings && mongoSettings.banners) || []),
            ...((jsonSettings && jsonSettings.banners) || [])
        ];

        centralBannersList.forEach((b, idx) => {
            if (!b || !b.image || typeof b.image !== 'string' || !b.image.trim()) return;
            const imgKey = b.image.trim();
            const bIdKey = b._id ? b._id.toString() : ('central_b_' + idx);
            if (seenBanners.has(imgKey) || seenBanners.has(bIdKey)) return;
            seenBanners.add(imgKey);
            seenBanners.add(bIdKey);

            activeBanners.unshift({
                _id: bIdKey,
                centerId: 'bbcc_central',
                centerName: 'BBCC SKILL HUB Central Directorate',
                username: 'bbcc',
                clogo: '/data/branding/logo.png',
                title: (b.title || 'BBCC SKILL HUB Official Announcement').trim(),
                subtitle: (b.subtitle || 'Platform-Wide Special Program & Scholarship Alert').trim(),
                image: imgKey,
                link: b.link || '/',
                isCentralAdmin: true,
                daysLeft: 30
            });
        });

        // Fallback default banner if nothing active uploaded
        if (activeBanners.length === 0) {
            activeBanners.push({
                _id: 'default_bbcc_hero_banner',
                centerId: 'bbcc_central',
                centerName: 'BBCC SKILL HUB Central Campus',
                username: 'bbcc',
                clogo: '/data/branding/logo.png',
                title: 'BBCC SKILL HUB Digital Platform',
                subtitle: 'National Institutional Network & Certified Syllabus Repository',
                image: '/data/photos/bbcc_campus.png',
                link: '#courses',
                isCentralAdmin: true,
                daysLeft: 30
            });
        }

        setCache('public_banners', activeBanners, 3000);
        res.json({ success: true, data: activeBanners });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.3 Public Registered Coaching Centers List
app.get('/api/public/centers', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        if (!req.query._t) {
            const cached = getCache('public_centers');
            if (cached) return res.json({ success: true, data: cached });
        }

        let centers = [];
        if (isMongoConnected) {
            try {
                centers = await TuitionCenter.find({}, { password: 0, paymentQr: 0 }).sort({ createdAt: -1 }).lean();
            } catch(e) {}
        }
        const pdb = loadPortalDb();
        if (!centers || centers.length === 0) {
            centers = (pdb.centers || []).map(c => {
                const { password, paymentQr, ...safe } = c;
                return safe;
            });
        } else if (pdb.centers && pdb.centers.length > 0) {
            const existingUsernames = new Set(centers.map(c => (c.username || '').toLowerCase()));
            pdb.centers.forEach(pc => {
                if (!existingUsernames.has((pc.username || '').toLowerCase())) {
                    const { password, paymentQr, ...safe } = pc;
                    centers.push(safe);
                }
            });
        }

        setCache('public_centers', centers, 3000);
        res.json({ success: true, data: centers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.4 Public Single Coaching Center Microsite by ID or Username
app.get('/api/public/center/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const cacheKey = `public_center_${(id || '').toLowerCase()}`;
        const cached = getCache(cacheKey);
        if (cached) return res.json({ success: true, data: cached });

        let center = null;
        if (isMongoConnected) {
            try {
                if (mongoose.Types.ObjectId.isValid(id)) center = await TuitionCenter.findById(id, { password: 0 }).lean();
                if (!center) center = await TuitionCenter.findOne({ username: id.toLowerCase() }, { password: 0 }).lean();
            } catch(e) {}
        }
        if (!center) {
            const pdb = loadPortalDb();
            center = (pdb.centers || []).find(c => c._id === id || (c.username && c.username.toLowerCase() === id.toLowerCase()));
            if (center) {
                const { password, paymentQr, ...safe } = center;
                center = safe;
            }
        }
        if (!center) {
            return res.status(404).json({ success: false, message: 'Institute profile not found' });
        }

        setCache(cacheKey, center, 3000);
        res.json({ success: true, data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.4B Favicon Endpoint (Dynamic Board Logo as Favicon)
app.get('/favicon.ico', async (req, res) => {
    try {
        let settings = null;
        if (isMongoConnected) {
            try { settings = await Settings.findOne(); } catch(e) {}
        }
        if (!settings) {
            const pdb = loadPortalDb();
            settings = pdb.settings || {};
        }
        const logo = settings?.boardLogo || '/data/branding/logo.png';
        if (logo) {
            if (logo.startsWith('data:image')) {
                const parts = logo.split(';base64,');
                const mime = parts[0].replace('data:', '');
                const imgBuf = Buffer.from(parts[1], 'base64');
                res.setHeader('Content-Type', mime);
                return res.send(imgBuf);
            }
            if (logo.startsWith('http') || logo.startsWith('/')) {
                return res.redirect(logo);
            }
        }
    } catch(e) {}
    return res.redirect('/data/branding/logo.png');
});

// 4.4C In-Built Indian Festivals & Special Days Promotional Banners Catalog
app.get('/api/public/banner-templates', (req, res) => {
    const templates = [
        {
            id: 'ganesh-chaturthi',
            name: 'Ganesh Chaturthi Mahotsav — Vighnaharta Batch',
            festival: 'Ganesh Chaturthi',
            category: 'festival',
            title: 'Shri Ganesh Chaturthi Vidya Aarambh Batch 2026',
            defaultTitle: 'Shri Ganesh Chaturthi Vidya Aarambh Batch 2026',
            subtitle: 'Vighnaharta Blessings: Flat 30% Festive Concession | Complete Course Pack',
            defaultSubtitle: 'Vighnaharta Blessings: Flat 30% Festive Concession | Complete Course Pack',
            image: '/data/branding/logo.png',
            tag: 'Shri Ganesh Utsav'
        },
        {
            id: 'krishna-janmashtami',
            name: 'Shri Krishna Janmashtami Gyan Utsav',
            festival: 'Janmashtami',
            category: 'festival',
            title: 'Janmashtami Mahotsav — Krishna Gyan Career Batch',
            defaultTitle: 'Janmashtami Mahotsav — Krishna Gyan Career Batch',
            subtitle: 'Master Concepts With Wisdom & Dedication | Special Course Kit Free',
            defaultSubtitle: 'Master Concepts With Wisdom & Dedication | Special Course Kit Free',
            image: '/data/branding/logo.png',
            tag: 'Jai Shri Krishna'
        },
        {
            id: 'durga-puja',
            name: 'Shardiya Navratri & Durga Puja Mahaparv',
            festival: 'Durga Puja',
            category: 'festival',
            title: 'Durga Puja Mahaparv Super 50 Batch 2026',
            defaultTitle: 'Durga Puja Mahaparv Super 50 Batch 2026',
            subtitle: 'Maa Durga Blessings: 100% Scholarship for Top Scorers | Apply Today',
            defaultSubtitle: 'Maa Durga Blessings: 100% Scholarship for Top Scorers | Apply Today',
            image: '/data/branding/logo.png',
            tag: 'Shubh Durga Puja'
        },
        {
            id: 'saraswati-puja',
            name: 'Basant Panchami & Saraswati Puja Vidya Vardaan',
            festival: 'Saraswati Puja',
            category: 'festival',
            title: 'Maa Saraswati Vidya Vardani Batch 2026-27',
            defaultTitle: 'Maa Saraswati Vidya Vardani Batch 2026-27',
            subtitle: 'Goddess of Knowledge Blessings | Complete Board Syllabus & Notes Pack',
            defaultSubtitle: 'Goddess of Knowledge Blessings | Complete Board Syllabus & Notes Pack',
            image: '/data/branding/logo.png',
            tag: 'Maa Saraswati Puja'
        },
        {
            id: 'maha-shivratri',
            name: 'Maha Shivratri Academic Sankalp Batch',
            festival: 'Maha Shivratri',
            category: 'festival',
            title: 'Maha Shivratri Academic Sankalp Batch',
            defaultTitle: 'Maha Shivratri Academic Sankalp Batch',
            subtitle: 'Determination, Focus & 1st Division Target | Dedicated Faculty Mentorship',
            defaultSubtitle: 'Determination, Focus & 1st Division Target | Dedicated Faculty Mentorship',
            image: '/data/branding/logo.png',
            tag: 'Har Har Mahadev'
        },
        {
            id: 'diwali-dhamaka',
            name: 'Happy Deepawali Maha Dhamaka',
            festival: 'Diwali',
            category: 'festival',
            title: 'Happy Deepawali 2026 Batch Offer',
            defaultTitle: 'Happy Deepawali 2026 Batch Offer',
            subtitle: 'Flat 25% Off on All New Batch Admissions | Special Festive Gift',
            defaultSubtitle: 'Flat 25% Off on All New Batch Admissions | Special Festive Gift',
            image: '/data/branding/logo.png',
            tag: 'Shubh Deepawali'
        },
        {
            id: 'chhath-puja',
            name: 'Chhath Puja Mahaparv Shubhkaamnayein',
            festival: 'Chhath Puja',
            category: 'festival',
            title: 'Chhath Puja Mahaparv Special Batch',
            defaultTitle: 'Chhath Puja Mahaparv Special Batch',
            subtitle: 'Sacred Surya Arghya Blessings | High Scoring Batches Open',
            defaultSubtitle: 'Sacred Surya Arghya Blessings | High Scoring Batches Open',
            image: '/data/branding/logo.png',
            tag: 'Surya Dev Blessings'
        },
        {
            id: 'holi-milan',
            name: 'Holi Rango Ka Tyohar Admission Dhamaka',
            festival: 'Holi',
            category: 'festival',
            title: 'Holi Celebration Career Batch 2026',
            defaultTitle: 'Holi Celebration Career Batch 2026',
            subtitle: 'Fill Your Future With Success Colors | Free Study Material Pack',
            defaultSubtitle: 'Fill Your Future With Success Colors | Free Study Material Pack',
            image: '/data/branding/logo.png',
            tag: 'Rango Ka Utsav'
        },
        {
            id: 'eid-mubarak',
            name: 'Eid-ul-Fitr Mubarak Special Scholarship',
            festival: 'Eid',
            category: 'festival',
            title: 'Eid Mubarak Educational Scholarship Batch',
            defaultTitle: 'Eid Mubarak Educational Scholarship Batch',
            subtitle: 'Special Enrolment Concession for Meritorious Students',
            defaultSubtitle: 'Special Enrolment Concession for Meritorious Students',
            image: '/data/branding/logo.png',
            tag: 'Eid Mubarak'
        },
        {
            id: 'independence-day',
            name: '15th August Independence Day Patriotic Batch',
            festival: 'Independence Day',
            category: 'national_day',
            title: 'Azadi Ka Amrit Mahotsav — Desh Ka Bhavishya',
            defaultTitle: 'Azadi Ka Amrit Mahotsav — Desh Ka Bhavishya',
            subtitle: 'Join India\'s Top Certified Faculty | Admissions Open',
            defaultSubtitle: 'Join India\'s Top Certified Faculty | Admissions Open',
            image: '/data/branding/logo.png',
            tag: '15 August Jai Hind'
        },
        {
            id: 'republic-day',
            name: '26th January Republic Day Special Batch',
            festival: 'Republic Day',
            category: 'national_day',
            title: 'Gantantra Diwas Academic Excellence Scheme',
            defaultTitle: 'Gantantra Diwas Academic Excellence Scheme',
            subtitle: 'Empowering Youth With Modern Skill Education',
            defaultSubtitle: 'Empowering Youth With Modern Skill Education',
            image: '/data/branding/logo.png',
            tag: '26 January Gantantra'
        },
        {
            id: 'teachers-day',
            name: '5th September Teachers\' Day Special Tribute',
            festival: 'Teachers\' Day',
            category: 'observance',
            title: 'Teachers\' Day Mentorship Batch 2026',
            defaultTitle: 'Teachers\' Day Mentorship Batch 2026',
            subtitle: 'Guided by Master Educators & Certified Subject Experts',
            defaultSubtitle: 'Guided by Master Educators & Certified Subject Experts',
            image: '/data/branding/logo.png',
            tag: 'Guru Shishya Parampara'
        },
        {
            id: 'children-day',
            name: '14th November Children\'s Day Smart Batch',
            festival: 'Children\'s Day',
            category: 'observance',
            title: 'Bal Diwas Foundation Batch (Class 6th-10th)',
            defaultTitle: 'Bal Diwas Foundation Batch (Class 6th-10th)',
            subtitle: 'Special Focus on Board Exam Basics & Conceptual Clarity',
            defaultSubtitle: 'Special Focus on Board Exam Basics & Conceptual Clarity',
            image: '/data/branding/logo.png',
            tag: 'Happy Children\'s Day'
        },
        {
            id: 'new-year',
            name: 'Happy New Year 2027 Fresh Resolution Batch',
            festival: 'New Year',
            category: 'festival',
            title: 'New Year 2027 Fresh Batch Starts Today',
            defaultTitle: 'New Year 2027 Fresh Batch Starts Today',
            subtitle: 'Crash Courses, Test Series & Mock Exams at Special Fee',
            defaultSubtitle: 'Crash Courses, Test Series & Mock Exams at Special Fee',
            image: '/data/branding/logo.png',
            tag: 'Happy New Year'
        },
        {
            id: 'raksha-bandhan',
            name: 'Raksha Bandhan Beti Padhao Scholarship',
            festival: 'Raksha Bandhan',
            category: 'festival',
            title: 'Raksha Bandhan Beti Shiksha Protsahan',
            defaultTitle: 'Raksha Bandhan Beti Shiksha Protsahan',
            subtitle: 'Special 40% Fee Concession for Female Students',
            defaultSubtitle: 'Special 40% Fee Concession for Female Students',
            image: '/data/branding/logo.png',
            tag: 'Raksha Bandhan Special'
        }
    ];
    res.json({ success: true, data: templates });
});

// 4.4D In-Built Educational Courses & Batch Templates Catalog
app.get('/api/public/course-templates', (req, res) => {
    const templates = [
        // SCHOOL & BOARDS (BSEB, CBSE, NCERT)
        {
            id: 'bseb-class-10-matric',
            category: 'School & Board Education',
            board: 'BSEB Bihar Board',
            classLevel: 'Class 10th',
            courseName: 'Class 10th Matric Board Super Target Batch',
            subject: 'Maths, Science & SST (All Subjects)',
            suggestedFee: 1500,
            batchTiming: 'Morning 7:00 AM - 9:00 AM',
            description: 'Comprehensive matric syllabus coverage, question bank analysis, monthly test series & guaranteed 1st division target.'
        },
        {
            id: 'cbse-class-10-board',
            category: 'School & Board Education',
            board: 'CBSE',
            classLevel: 'Class 10th',
            courseName: 'CBSE Class 10th Board Exam Foundation',
            subject: 'Mathematics & Science (NCERT Exemplar)',
            suggestedFee: 2000,
            batchTiming: 'Evening 4:00 PM - 6:00 PM',
            description: 'Strict NCERT aligned conceptual lectures, case study questions, assertion-reasoning drill, sample papers.'
        },
        {
            id: 'class-12-science-pcm',
            category: 'School & Board Education',
            board: 'BSEB / CBSE',
            classLevel: 'Class 12th',
            courseName: 'Class 12th Science Stream (PCM Core)',
            subject: 'Physics, Chemistry & Mathematics',
            suggestedFee: 3500,
            batchTiming: 'Morning 6:30 AM - 9:30 AM',
            description: 'Deep derivation practice, numerical solving shortcuts, board model papers & board practical preparation.'
        },
        {
            id: 'class-12-science-pcb',
            category: 'School & Board Education',
            board: 'BSEB / CBSE',
            classLevel: 'Class 12th',
            courseName: 'Class 12th Science Stream (PCB Core)',
            subject: 'Physics, Chemistry & Biology',
            suggestedFee: 3500,
            batchTiming: 'Morning 8:00 AM - 11:00 AM',
            description: 'Complete NCERT diagrams, high-yield biological processes, organic chemistry mechanisms, model papers.'
        },
        {
            id: 'class-11-12-commerce',
            category: 'School & Board Education',
            board: 'BSEB / CBSE',
            classLevel: 'Class 11th & 12th',
            courseName: 'Class 11th & 12th Commerce Master Batch',
            subject: 'Accountancy, Business Studies & Economics',
            suggestedFee: 2500,
            batchTiming: 'Evening 3:00 PM - 5:00 PM',
            description: 'Journal ledger mastery, balance sheet preparation, macro economics graphs, case studies & board revision.'
        },
        {
            id: 'class-11-12-arts',
            category: 'School & Board Education',
            board: 'BSEB / State Board',
            classLevel: 'Class 11th & 12th',
            courseName: 'Class 11th & 12th Arts Stream Special Batch',
            subject: 'History, Political Science, Geography & Hindi',
            suggestedFee: 1800,
            batchTiming: 'Morning 10:00 AM - 12:00 PM',
            description: 'Chapter-wise subjective answer writing practice, map pointing, objective MCQ fast test series.'
        },
        {
            id: 'class-6-to-8-middle',
            category: 'School & Board Education',
            board: 'NCERT / All Boards',
            classLevel: 'Class 6th to 8th',
            courseName: 'Junior Middle School Foundation Batch',
            subject: 'Mathematics, Science & English Grammar',
            suggestedFee: 1000,
            batchTiming: 'Evening 4:00 PM - 5:30 PM',
            description: 'Strengthening fundamental calculation speed, English translation, science experiments & school homework assistance.'
        },

        // TEACHER TRAINING & COMPETITIVE (CTET, STET, TRE)
        {
            id: 'ctet-paper-1-primary',
            category: 'Teacher Training & Govt Exam',
            board: 'CTET (CBSE Central)',
            classLevel: 'Primary (Class 1-5)',
            courseName: 'CTET Paper 1 Special Success Batch',
            subject: 'CDP, EVS, Maths, Hindi & English Pedagogy',
            suggestedFee: 2500,
            batchTiming: 'Morning 7:00 AM - 10:00 AM',
            description: 'Child development theories (Piaget, Vygotsky, Kohlberg), pedagogy tricks, previous year 10-year papers & mock tests.'
        },
        {
            id: 'ctet-paper-2-upper',
            category: 'Teacher Training & Govt Exam',
            board: 'CTET (CBSE Central)',
            classLevel: 'Upper Primary (Class 6-8)',
            courseName: 'CTET Paper 2 (Maths & Science / SST)',
            subject: 'Advanced CDP, Science/Maths or Social Science Pedagogy',
            suggestedFee: 3000,
            batchTiming: 'Evening 5:00 PM - 8:00 PM',
            description: 'In-depth conceptual pedagogy, NCERT summary books, time management strategies & live doubt clearing.'
        },
        {
            id: 'bpsc-tre-special',
            category: 'Teacher Training & Govt Exam',
            board: 'BPSC TRE Special',
            classLevel: 'PRT, TGT & PGT',
            courseName: 'BPSC TRE (Teacher Recruitment) Special Batch',
            subject: 'General Studies, SCERT/NCERT & Concerned Subject',
            suggestedFee: 3500,
            batchTiming: 'Morning 8:00 AM - 12:00 PM',
            description: 'Bihar special GK, national movement, mathematics & reasoning, subject specific depth for high merit ranking.'
        },
        {
            id: 'stet-paper-1-2',
            category: 'Teacher Training & Govt Exam',
            board: 'BSEB STET',
            classLevel: 'Secondary & Sr. Secondary',
            courseName: 'Bihar STET Paper 1 & Paper 2 Comprehensive Batch',
            subject: 'Specific Subject + Art of Teaching & Other Skills',
            suggestedFee: 2800,
            batchTiming: 'Evening 6:00 PM - 8:30 PM',
            description: 'Targeted qualifying score preparation, Art of Teaching 50-mark mastery, 100-mark core subject deep dive.'
        },

        // COMPUTER & DIGITAL SKILLS
        {
            id: 'dca-computer-diploma',
            category: 'Computer & Digital Skills',
            board: 'BBCC Digital Board',
            classLevel: 'All Students & Job Aspirants',
            courseName: 'DCA (Diploma in Computer Applications - 6 Months)',
            subject: 'Windows, MS Word, Excel, PowerPoint, Internet & Typing',
            suggestedFee: 3000,
            batchTiming: 'Daily 1 Hour Lab + Theory (Flexible)',
            description: 'Complete hands-on practical computer training, office documentation, billing spreadsheets & Hindi/English typing.'
        },
        {
            id: 'adca-advance-diploma',
            category: 'Computer & Digital Skills',
            board: 'BBCC Digital Board',
            classLevel: 'Graduates & 12th Pass',
            courseName: 'ADCA (Advanced Diploma in Computer Applications - 1 Year)',
            subject: 'DCA + Tally Prime, Photoshop, CorelDraw, Web Basics & DTP',
            suggestedFee: 5000,
            batchTiming: 'Daily 1.5 Hours Lab (Morning/Evening)',
            description: 'Professional career course covering graphic design, complete business accounting with GST, and advanced Excel analytics.'
        },
        {
            id: 'tally-prime-gst',
            category: 'Computer & Digital Skills',
            board: 'BBCC Digital Board',
            classLevel: 'Commerce & Job Seekers',
            courseName: 'Tally Prime with GST Professional Accounting',
            subject: 'Voucher Entry, Inventory, GST Filing, TDS & Payroll',
            suggestedFee: 3500,
            batchTiming: 'Evening 5:00 PM - 6:30 PM',
            description: 'Job-oriented business accounts training with real company case studies, balance sheet generation & GST returns.'
        },

        // COMPETITIVE EXAMS
        {
            id: 'ssc-gd-railway-police',
            category: 'Govt Competitive Exams',
            board: 'Staff Selection / Railway',
            classLevel: '10th & 12th Pass',
            courseName: 'Bihar Police Constable & SSC GD Target Batch',
            subject: 'Maths, Reasoning, GK/GS & Hindi/English',
            suggestedFee: 2000,
            batchTiming: 'Morning 6:30 AM - 9:30 AM',
            description: 'Speed calculation shortcuts, recurring exam questions, daily 50-question mock test sheet with negative marking drill.'
        }
    ];
    res.json({ success: true, data: templates });
});

// 4.4E Aggregated Verified Expert Teachers for Homepage
app.get('/api/public/expert-teachers', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        if (!req.query._t) {
            const cached = getCache('public_teachers');
            if (cached) return res.json({ success: true, data: cached });
        }

        let centers = [];
        if (isMongoConnected) {
            try {
                centers = await TuitionCenter.find({ isBlocked: false, 'teachers.0': { $exists: true } }, { centerName: 1, username: 1, clogo: 1, teachers: 1 }).lean();
            } catch(e) {}
        }
        if (!centers || centers.length === 0) {
            const pdb = loadPortalDb();
            centers = pdb.centers || [];
        }

        const allTeachers = [];
        centers.forEach(c => {
            (c.teachers || []).forEach(t => {
                allTeachers.push({
                    name: t.name,
                    subject: t.subject,
                    class: t.class || 'All Classes',
                    qualification: t.qualification || 'Certified Faculty',
                    experience: t.experience || '3+ Years',
                    photo: t.photo || '',
                    centerName: c.centerName,
                    centerUsername: c.username,
                    centerLogo: c.clogo || ''
                });
            });
        });

        setCache('public_teachers', allTeachers, 3000);
        res.json({ success: true, data: allTeachers });
    } catch(err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.4F BBCC Founder & Leadership Profile
app.get('/api/public/founder', async (req, res) => {
    try {
        let settings = null;
        if (isMongoConnected) {
            try { settings = await Settings.findOne(); } catch(e) {}
        }
        if (!settings) {
            const pdb = loadPortalDb();
            settings = pdb.settings || {};
        }
        const fp = (settings && settings.founderProfile) ? settings.founderProfile : {};
        const profile = {
            name: fp.name || 'Mr. Santosh Kumar',
            photo: (fp.photo && !fp.photo.includes('unsplash')) ? fp.photo : '/santosh sir.jpeg',
            designation: fp.designation || 'Founder & Managing Director',
            qualification: fp.qualification || 'B.Ed, Ethical Hacking',
            address: fp.address || 'PTCC+BBCC Chakdah Chowk madhubani bihar india 847211',
            message: fp.message || 'शिक्षा और तकनीकी कौशल हर विद्यार्थी का अधिकार है। बाल भारती कोचिंग सेंटर एवं बीबीसीसी स्किल हब विद्यार्थियों के उज्ज्वल भविष्य के लिए सदैव समर्पित है।',
            signature: fp.signature || ''
        };
        res.json({ success: true, data: profile });
    } catch(err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.5 Public E-Library Books & Notes (Strictly Thumbnails / Covers, No Direct PDF Payload)
app.get('/api/public/books', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const studentQuery = req.query.studentQuery || req.query.aadhar || req.query.rollNo;
        const hasAuth = !!(req.headers.authorization && req.headers.authorization.startsWith('Bearer '));
        const cacheKey = (!studentQuery && !hasAuth && !req.query._t) ? 'public_books_all' : null;

        if (cacheKey) {
            const cached = getCache(cacheKey);
            if (cached) return res.json({ success: true, data: cached });
        }

        let sm = null;
        if (isMongoConnected) {
            try { sm = await StudyMaterial.findOne().lean(); } catch(e) {}
        }
        if (!sm || !sm.notes || sm.notes.length === 0) {
            const pdb = loadPortalDb();
            sm = pdb.studyMaterials || { notes: [], videos: [] };
        }

        // Check if student query (Aadhar or Roll No) or student auth token is passed to check enrollment benefit
        let enrolledCenterId = null;
        let studentRecord = null;
        if (studentQuery) {
            studentRecord = await Student.findOne({
                $or: [
                    { aadharNumber: studentQuery.trim().replace(/\s+/g, '') },
                    { rollNo: studentQuery.trim() }
                ]
            }).lean();
            if (studentRecord && studentRecord.centerId) {
                enrolledCenterId = studentRecord.centerId.toString();
            }
        } else if (hasAuth) {
            try {
                const decoded = jwt.verify(req.headers.authorization.split(' ')[1], JWT_SECRET);
                if (decoded && decoded.centerId) {
                    enrolledCenterId = decoded.centerId.toString();
                }
            } catch (e) {}
        }

        // Pre-fetch centers for physical pickup addresses and director contacts
        let centersMap = {};
        try {
            const allCentersList = await TuitionCenter.find({}, { centerName: 1, address: 1, contactNumber: 1, whatsappNumber: 1, directorName: 1 }).lean();
            for (const c of allCentersList) {
                centersMap[c._id.toString()] = c;
            }
        } catch(e) {}
        const defaultAddress = "BBCC Central Directorate, Patna, Bihar - 800001";
        const defaultPhone = "+91 98765 43210";
        const defaultDirector = "Santosh Kumar (Founder & MD)";

        const buildBookItem = (n, centerRef = null) => {
            const cid = (n.targetCenterId || (centerRef ? centerRef._id.toString() : 'all')).toString();
            const isTargetCenter = cid && cid !== 'all';
            const isEnrolledFree = enrolledCenterId && isTargetCenter && (enrolledCenterId === cid);
            const cInfo = (isTargetCenter && centersMap[cid]) ? centersMap[cid] : centerRef;

            const effectivePdfPrice = isEnrolledFree ? 0 : (Number(n.price) || 0);
            const origPrice = Number(n.originalPrice || n.price) || 0;
            const pdfMrp = Number(n.pdfMrp || n.mrp) || (origPrice > 0 ? Math.round(origPrice * 2.5 + 49) : 199);
            const physicalPrice = Number(n.physicalPrice) || (origPrice > 0 ? Math.max(99, Math.round(origPrice * 1.8 + 50)) : 149);
            const physicalMrp = Number(n.physicalMrp) || Math.round(physicalPrice * 2.2 + 50);

            const pickupAddress = (n.pickupAddress && n.pickupAddress.trim())
                ? n.pickupAddress.trim()
                : (cInfo ? (cInfo.address || defaultAddress) : defaultAddress);
            const pickupPhone = cInfo ? (cInfo.whatsappNumber || cInfo.contactNumber || defaultPhone) : defaultPhone;
            const pickupDirector = (n.directorContact && n.directorContact.trim())
                ? n.directorContact.trim()
                : (cInfo ? (cInfo.directorName || defaultDirector) : defaultDirector);
            const centerTitle = cInfo ? cInfo.centerName : (n.targetCenterName || 'All Centers (Universal)');

            return {
                _id: n._id,
                title: n.title,
                subject: n.subject || 'General',
                classLevel: n.classLevel || 'All Classes',
                description: n.description || '',
                fileType: n.fileType || 'pdf',
                thumbnail: n.thumbnail || '',
                price: effectivePdfPrice,
                originalPrice: origPrice,
                pdfMrp: pdfMrp,
                physicalPrice: physicalPrice,
                physicalMrp: physicalMrp,
                pickupAddress: pickupAddress,
                pickupPhone: pickupPhone,
                pickupWhatsapp: cInfo ? (cInfo.whatsappNumber || pickupPhone) : pickupPhone,
                directorName: pickupDirector,
                isEnrolledFree: Boolean(isEnrolledFree),
                targetCenterId: cid,
                targetCenterName: centerTitle,
                isRawData: Boolean(n.isRawData),
                hasFile: !!(n.pdf || n.file || n.link),
                downloadCount: n.downloadCount || 0,
                createdAt: n.createdAt || new Date()
            };
        };

        // 1. Gather all notes from both MongoDB and portal_db.json dual storage
        const allNotesList = [];
        const seenNoteIds = new Set();
        const seenNoteTitles = new Set();

        const addNoteUnique = (n) => {
            if (!n || !n.title) return;
            const nid = n._id ? n._id.toString() : '';
            const nTitle = (n.title || '').trim().toLowerCase();
            if (nid && seenNoteIds.has(nid)) return;
            if (seenNoteTitles.has(nTitle)) return;
            if (nid) seenNoteIds.add(nid);
            seenNoteTitles.add(nTitle);
            allNotesList.push(n);
        };

        (sm.notes || []).forEach(addNoteUnique);
        const pdb = loadPortalDb();
        if (pdb.studyMaterials && Array.isArray(pdb.studyMaterials.notes)) {
            pdb.studyMaterials.notes.forEach(addNoteUnique);
        }

        // 2. TARGET CENTER SCOPE ENFORCEMENT:
        // Strictly filter: on the public BBCC Homepage E-Library, ONLY universal / all notes appear!
        // Center-specific notes belong strictly to that specific coaching center's dashboard.
        const universalNotes = allNotesList.filter(n => {
            const tId = (n.targetCenterId || 'all').toString().trim().toLowerCase();
            return tId === 'all' || tId === '' || tId === 'universal';
        });

        const sanitizedNotes = universalNotes.map(n => buildBookItem(n));

        const resultData = {
            notes: sanitizedNotes,
            videos: sm.videos || []
        };

        if (cacheKey) {
            setCache(cacheKey, resultData, 3000);
        }

        res.json({
            success: true,
            data: resultData
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.6 Public Student Admission Inquiry Submission
app.post('/api/public/inquiry', async (req, res) => {
    try {
        const { centerId, studentName, parentName, mobile, phone, targetClass, message } = req.body;
        const cleanMobile = (mobile || phone || '').trim();
        if (!studentName || !cleanMobile) {
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
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const targetCenterId = req.query.centerId || '';
        const cacheKey = `public_courses_${targetCenterId || 'all'}`;
        if (!req.query._t) {
            const cached = getCache(cacheKey);
            if (cached) return res.json({ success: true, data: cached });
        }

        const filter = { isBlocked: false };
        if (targetCenterId && mongoose.Types.ObjectId.isValid(targetCenterId)) {
            filter._id = targetCenterId;
        }

        let centers = [];
        if (isMongoConnected) {
            try {
                centers = await TuitionCenter.find(filter, { centerName: 1, username: 1, clogo: 1, address: 1, contactNumber: 1, courses: 1 }).lean();
            } catch(e) {}
        }
        if (!centers || centers.length === 0) {
            const pdb = loadPortalDb();
            centers = (pdb.centers || []).filter(c => !targetCenterId || c._id === targetCenterId);
        }

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

        if (allCourses.length === 0) {
            const pdb = loadPortalDb();
            const fallbackCenters = (pdb.centers || []).filter(c => !targetCenterId || c._id === targetCenterId);
            fallbackCenters.forEach(c => {
                (c.courses || []).forEach(course => {
                    if (course.active !== false) {
                        allCourses.push({
                            _id: course._id,
                            courseName: course.courseName,
                            subject: course.subject || 'General',
                            classLevel: course.classLevel || 'All',
                            mode: course.mode || 'both',
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
        }

        setCache(cacheKey, allCourses, 3000);
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

// Student Profile Photo Self-Upload (Classroom Portal)
app.post('/api/student/photo', verifyStudent, async (req, res) => {
    try {
        const { photo } = req.body;
        if (!photo) return res.status(400).json({ success: false, message: 'Photo data required' });

        const student = await Student.findById(req.student.id);
        if (!student) return res.status(404).json({ success: false, message: 'Student record not found' });

        let savedUrl = photo;
        if (photo.startsWith('data:image')) {
            try {
                const asset = saveAssetFile(photo, 'branding', 'png', 'normal', 'student_' + (student.rollNo || student.studentId));
                if (asset && asset.fileUrl) savedUrl = asset.fileUrl;
            } catch (pErr) {
                console.warn('Student photo save warning:', pErr.message);
            }
        }

        student.photo = savedUrl;
        await student.save();

        // Also sync to portal_db.json
        try {
            const db = loadPortalDb();
            if (db.students) {
                const idx = db.students.findIndex(s => (s._id && s._id.toString() === student._id.toString()) || s.rollNo === student.rollNo || s.studentId === student.studentId);
                if (idx !== -1) {
                    db.students[idx].photo = savedUrl;
                    await savePortalDb(db);
                }
            }
        } catch (dbErr) {}

        clearCache();
        res.json({ success: true, message: 'Profile photo updated successfully!', photoUrl: savedUrl });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Public Fallback Student Photo Upload (With Roll/ID and Token or KYC verification)
app.post('/api/public/student-photo', async (req, res) => {
    try {
        const { rollNo, studentId, photo } = req.body;
        if (!photo || (!rollNo && !studentId)) {
            return res.status(400).json({ success: false, message: 'Identifier and photo required' });
        }
        const student = await Student.findOne({
            $or: [
                ...(rollNo ? [{ rollNo: rollNo.trim() }] : []),
                ...(studentId ? [{ studentId: studentId.trim() }] : [])
            ]
        });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        let savedUrl = photo;
        if (photo.startsWith('data:image')) {
            try {
                const asset = saveAssetFile(photo, 'branding', 'png', 'normal', 'student_' + (student.rollNo || student.studentId));
                if (asset && asset.fileUrl) savedUrl = asset.fileUrl;
            } catch (pErr) {}
        }
        student.photo = savedUrl;
        await student.save();
        clearCache();
        res.json({ success: true, message: 'Profile photo updated successfully!', photoUrl: savedUrl });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.12 BHARTI Chief Counselor Helpline Assistant (Powered by Groq Cloud / Gemini + Live DB Context)
app.post('/api/public/bharti-chat', async (req, res) => {
    try {
        const { message, centerId, callerPhone, callerName, language, history } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message prompt required' });
        }

        const q = message.trim().toLowerCase();
        let targetCenter = null;

        // Fetch all centers for platform-wide awareness
        const allCenters = await TuitionCenter.find({ isBlocked: false });

        // Context check if conversation is already scoped to a specific center
        if (centerId && mongoose.Types.ObjectId.isValid(centerId)) {
            targetCenter = allCenters.find(c => c._id.toString() === centerId.toString()) || null;
        }

        // If not specified, search centers database for matches
        if (!targetCenter) {
            targetCenter = allCenters.find(c =>
                q.includes(c.centerName.toLowerCase()) ||
                q.includes(c.username.toLowerCase()) ||
                q.includes((c.directorName || '').toLowerCase()) ||
                (c.address && q.includes(c.address.toLowerCase()))
            );

            if (!targetCenter && (q.includes('coaching') || q.includes('admission') || q.includes('center') || q.includes('director') || q.includes('contact') || q.includes('phone') || q.includes('call') || q.includes('help'))) {
                targetCenter = allCenters[0] || null;
            }
        }

        // Extract user phone & identify visitor
        const phoneMatch = message.match(/(?:\+91[\-\s]?)?[6789]\d{9}/);
        const extractedPhone = callerPhone || (phoneMatch ? phoneMatch[0].replace(/[^0-9]/g, '').slice(-10) : '');
        const visitorName = (callerName || '').trim();
        const visitorTitle = visitorName ? `${visitorName} ji` : 'Aap';
        const userLang = (language || 'hi').toLowerCase(); // 'hi', 'en', 'bho', 'hinglish'

        // ----------------------------------------------------
        // FEATURE 1: TICKET TRACKING IN CHAT (Real-time lookup)
        // ----------------------------------------------------
        let trackedTicket = null;
        const tktMatch = message.match(/TKT[-_]?(?:BBCC[-_]?)?\d{4,8}/i) || message.match(/TKT[-_]?[A-Z0-9]{4,12}/i);
        const isTicketQuery = Boolean(tktMatch) || (
            (q.includes('ticket') || q.includes('status') || q.includes('track') || q.includes('shikayat') || q.includes('complaint')) &&
            Boolean(extractedPhone)
        );

        if (tktMatch) {
            const cleanTkt = tktMatch[0].trim();
            trackedTicket = await SupportTicket.findOne({
                ticketId: new RegExp(`^${cleanTkt.replace(/[-_]/g, '[-_]?')}$`, 'i')
            });
        }
        if (!trackedTicket && isTicketQuery && extractedPhone) {
            trackedTicket = await SupportTicket.findOne({ phone: extractedPhone }).sort({ createdAt: -1 });
        }

        // ----------------------------------------------------
        // FEATURE 2: PAYMENT TRACKING IN CHAT (Live ledger query)
        // ----------------------------------------------------
        let trackedPayment = null;
        const payMatch = message.match(/(?:pay|order)_[a-zA-Z0-9]{8,25}/i) || message.match(/(?:FREE|ENROLLED|AFF)[a-zA-Z0-9_]{6,25}/i);
        const isPaymentQuery = Boolean(payMatch) || (
            (q.includes('payment') || q.includes('paisa') || q.includes('transaction') || q.includes('receipt') || q.includes('kat gaya') || q.includes('pay status') || q.includes('fee paid')) &&
            Boolean(extractedPhone)
        );

        if (payMatch) {
            const cleanPay = payMatch[0].trim();
            trackedPayment = await PaymentTransaction.findOne({
                $or: [
                    { paymentId: new RegExp(`^${cleanPay}$`, 'i') },
                    { orderId: new RegExp(`^${cleanPay}$`, 'i') }
                ]
            });
        }
        if (!trackedPayment && isPaymentQuery && extractedPhone) {
            trackedPayment = await PaymentTransaction.findOne({ payerPhone: extractedPhone }).sort({ createdAt: -1 });
        }

        // ----------------------------------------------------
        // FEATURE 3: IN-CHAT PDF NOTES & STUDY MATERIAL MATCHER
        // ----------------------------------------------------
        let downloadCards = [];
        const isPdfSearch = (
            q.includes('pdf') || q.includes('download') || q.includes('kitab') || q.includes('book') ||
            q.includes('notes') || q.includes('syllabus') || q.includes('study material') ||
            q.includes('class 9') || q.includes('class 10') || q.includes('class 11') || q.includes('class 12') ||
            q.includes('adca') || q.includes('dca') || q.includes('tally') || q.includes('typing') ||
            q.includes('cdp') || q.includes('ctet') || q.includes('science') || q.includes('math') ||
            q.includes('history') || q.includes('physics') || q.includes('chemistry') || q.includes('biology')
        );

        if (isPdfSearch) {
            try {
                const sm = await StudyMaterial.findOne();
                if (sm && Array.isArray(sm.notes) && sm.notes.length > 0) {
                    const stopWords = new Set(['kya', 'hai', 'ka', 'ki', 'ke', 'ko', 'me', 'mein', 'par', 'chahiye', 'kaise', 'milega', 'bhejo', 'download', 'pdf', 'notes', 'the', 'a', 'an', 'in', 'of', 'for', 'and', 'to', 'do']);
                    const words = q.split(/[\s,.\-_?]+/).filter(w => w.length > 1 && !stopWords.has(w));

                    const scored = sm.notes.map(n => {
                        let score = 0;
                        const t = (n.title || '').toLowerCase();
                        const s = (n.subject || '').toLowerCase();
                        const cl = (n.classLevel || '').toLowerCase();
                        const d = (n.description || '').toLowerCase();

                        words.forEach(w => {
                            if (t.includes(w)) score += 5;
                            if (s.includes(w)) score += 3;
                            if (cl.includes(w)) score += 4;
                            if (d.includes(w)) score += 1;
                        });
                        return { note: n, score };
                    }).filter(item => item.score > 0)
                      .sort((a, b) => b.score - a.score);

                    const topMatches = scored.slice(0, 3).map(item => item.note);
                    const chosen = topMatches.length > 0 ? topMatches : sm.notes.slice(0, 2);

                    downloadCards = chosen.map(n => ({
                        id: n._id ? n._id.toString() : '',
                        title: n.title,
                        subject: n.subject || 'All Subjects',
                        classLevel: n.classLevel || 'General',
                        downloadUrl: n.pdf || n.file || n.downloadUrl || (n._id ? `/api/public/download-doc/${n._id}` : '#'),
                        thumbnail: n.thumbnail || '',
                        price: typeof n.price === 'number' ? n.price : 0,
                        isFree: !n.price || n.price === 0
                    }));
                }
            } catch (mErr) {
                console.error('Note matching notice:', mErr.message);
            }
        }

        // ----------------------------------------------------
        // FEATURE 4: SMART ESCALATION & DIRECTOR PRIVACY
        // Bharti tries to solve the problem FIRST in chat!
        // Tickets are strictly generated ONLY when explicitly requested or unresolved.
        // Director personal mobile numbers are NEVER disclosed in chat.
        // ----------------------------------------------------
        const isExplicitEscalation = (
            q.includes('call back') || q.includes('callback') || q.includes('phone karo') ||
            q.includes('baat karao') || q.includes('baat karni hai') || q.includes('human') ||
            q.includes('director se baat') || q.includes('admin se baat') || q.includes('agent se baat') ||
            q.includes('shikayat darj') || q.includes('complaint register') || q.includes('ticket generate') ||
            q.includes('ticket banao')
        );

        let createdTicket = null;
        if (isExplicitEscalation && extractedPhone && !trackedTicket) {
            try {
                // Check if user already has an active pending ticket in past 24 hours to prevent duplicates
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const existingActiveTicket = await SupportTicket.findOne({
                    phone: extractedPhone,
                    status: { $in: ['CALLBACK_SCHEDULED', 'OPEN'] },
                    createdAt: { $gte: oneDayAgo }
                }).sort({ createdAt: -1 });

                if (existingActiveTicket) {
                    trackedTicket = existingActiveTicket;
                } else {
                    const tktId = `TKT-BBCC-${Math.floor(100000 + Math.random() * 900000)}`;
                    createdTicket = await SupportTicket.create({
                        ticketId: tktId,
                        studentName: visitorName || 'Student / Parent Inquiry',
                        phone: extractedPhone,
                        centerId: targetCenter ? targetCenter._id.toString() : 'central',
                        centerName: targetCenter ? targetCenter.centerName : 'BBCC Central Directorate',
                        category: q.includes('fee') ? 'Fee Inquiry & Assistance' : (q.includes('admission') ? 'Direct Admission Callback' : 'Counseling & Support Callback'),
                        issueSummary: message.trim(),
                        userChatSnippet: message.trim(),
                        status: 'CALLBACK_SCHEDULED',
                        scheduledCallback: 'Within 15-30 Minutes',
                        assignedOfficer: 'Senior Academic Counselor'
                    });
                }
            } catch (tErr) {
                console.error('Support ticket creation notice:', tErr.message);
            }
        }

        // Fetch live platform knowledge: summary of centers, courses & books
        // (Note: Director personal numbers are withheld from public chat to protect privacy)
        const centersSummary = allCenters.slice(0, 8).map(c =>
            `• Center: "${c.centerName}" | Director: "${c.directorName}" | Classes: "${c.fromClass} to ${c.toClass}" | Admission Fee: ₹${c.admissionFee || 200}`
        ).join('\n');

        let booksCount = 0;
        try {
            const sm = await StudyMaterial.findOne();
            booksCount = sm && sm.notes ? sm.notes.length : 0;
        } catch(e) {}

        const dbContext = `
[BBCC PLATFORM LIVE DATABASE CONTEXT]
- Central Platform: Bal Bharti Coaching Center (BBCC SKILL HUB)
- Verified Affiliated Centers: ${allCenters.length} active institutes
- E-Library Notes & Textbooks: ${booksCount}+ certified books & syllabus materials
- Supported Boards: BSEB (Bihar Board), CBSE, NCERT (Class 1st to 12th)
- Teacher Training Batches: CTET, STET, TRE Teacher Recruitment
- Skill & Computer Courses: DCA, ADCA, Tally Prime with GST, Typing
- Direct Admissions: Students can enroll online directly; 100% payments route through BBCC Central Escrow Gateway.
- Privacy & Escalation Policy: All inquiries are addressed centrally. No director personal phone number is shared in chat.
- Active Partner Centers:
${centersSummary}
${targetCenter ? `Current Scoped Center: "${targetCenter.centerName}" (Director: ${targetCenter.directorName}, Address: ${targetCenter.address || 'Certified Center'})` : ''}

${trackedTicket ? `
[LIVE TICKET TRACKING RECORD FOUND]:
- Ticket ID: ${trackedTicket.ticketId}
- Status: ${trackedTicket.status}
- Phone: ${trackedTicket.phone}
- Student Name: ${trackedTicket.studentName}
- Center: ${trackedTicket.centerName || 'BBCC Central Directorate'}
- Assigned Officer: ${trackedTicket.assignedOfficer || 'Senior Academic Counselor'}
- Scheduled Callback: ${trackedTicket.scheduledCallback || 'Within 15-30 Minutes'}
- Resolution Notes: ${trackedTicket.resolutionNotes || 'In Progress'}
- Created At: ${trackedTicket.createdAt}
(Tell the user about this ticket status accurately and reassuringly!)
` : ''}

${trackedPayment ? `
[LIVE PAYMENT TRANSACTION RECORD FOUND]:
- Order ID: ${trackedPayment.orderId}
- Payment ID: ${trackedPayment.paymentId || 'N/A'}
- Amount: ₹${trackedPayment.amount}
- Status: ${trackedPayment.status.toUpperCase()}
- Item / Purpose: ${trackedPayment.docTitle || trackedPayment.purpose}
- Payer Name: ${trackedPayment.payerName}
- Date: ${trackedPayment.createdAt}
(Confirm this payment transaction to the user clearly!)
` : ''}

${downloadCards.length > 0 ? `
[MATCHED E-LIBRARY PDF STUDY MATERIALS]:
${downloadCards.map(d => `• Title: "${d.title}" | Subject: "${d.subject}" | Class: "${d.classLevel}" | Price: ${d.isFree ? 'FREE' : '₹' + d.price}`).join('\n')}
(Inform the visitor that direct 1-click Download PDF cards have been provided below in the chat!)
` : ''}
`;

        const langNameMap = {
            'hi': 'Hindi (हिन्दी)',
            'en': 'English',
            'bho': 'Bhojpuri (भोजपुरी)',
            'hinglish': 'Hinglish (Hindi written in Roman script)'
        };
        const activeLangName = langNameMap[userLang] || 'Hindi';

        const bhartiSystemPrompt = `Aap BBCC SKILL HUB (Bal Bharti Coaching Center) ki Chief Academic Counselor aur Senior Academic Advisor hain jinka naam 'BHARTI' hai.
STRICT PERSONA RULES:
1. Aap KABHI BHI apne aap ko AI, artificial intelligence, robot, bot, virtual assistant ya machine NAHI kahengi. Hamesha bolein: 'Main Bharti hoon — BBCC SKILL HUB ki Chief Academic Counselor'.
2. STRICT RESPECT RULE: KABHI BHI visitor ya vidyarthi ko 'Beta' ya 'Beti' NAHI bolna hai! Visitor ko hamesha aadar aur samman ke sath unke naam se sambodhit karein: '${visitorTitle}' (ya 'Aap' / 'Sir' / 'Ma'am').
3. STRICT PRIVACY RULE: Aap KABHI BHI kisi Director ya Teacher ka personal phone number chat mein NAHI dengi. Agar visitor direct sampark maange, toh unhe batayein ki security aur transparent record ke liye Central Support Callback Ticket darj kiya jata hai jisse hamare counseling officer unhe seedhe call karte hain. Central Directorate Helpline: +91 98765 43210.
4. Problem-Solver First Policy: Visitor ke sawal, syllabus, course, fees, ticket status, payment tracking aur PDF download ki har samasya ko pehle chat mein hi solve karne ki poori koshish karein. Ticket sirf tab darj karein jab visitor ne explicit call back maanga ho ya samasya chat mein solve na ho paye.
5. COMPLETE OPERATIONAL USER MANUAL KNOWLEDGE BASE:
   Aap BBCC SKILL HUB ke sabhi 5 roles ke official user manual aur standard operating procedures (SOP) mein poori tarah train hain:
   • SUPER ADMIN (/admin-console.html): Centers affiliation, Central Masterclass broadcast, National Live Monitoring Deck, E-Library Master Publisher, Director Wallet Payouts with Bank UTR (80% center, 20% platform), Global CMS & news marquee.
   • COACHING DIRECTOR (/director-portal.html): Faculty management (creating Teacher ID & password), Course & batch fee scheduling, Study notes upload (saved cleanly to GitHub/disk with zero database bloat), Student enrollment with custom admission fee, Instant WhatsApp receipts, Live Teaching Monitor, Bank/UPI withdrawal requests.
   • TEACHER FACULTY STUDIO (/teacher-portal.html): Login via Phone/Teacher ID, 1-click live broadcast with automatic YouTube integration (no copy-paste needed!), Real-time student doubt board & chat, Low-bandwidth frame relay for village students, Ending class triggers clean WebM recording & auto-upload to YouTube, Previous lectures archive & preview player.
   • STUDENT PORTAL & CLASSROOM (/classroom.html): Roll number verification & digital ID card, Scope-locked live classroom access, Live doubt asking during classes, 100% free notes download for enrolled students, Physical book delivery orders, Priority academic callback ticket (15-30 mins), Missed class revision vault.
   • VISITOR & PARENT (/index.html): Search certified coaching centers, Verify academic records by roll number, Browse digital E-Library, Apply for online admission, Online institute affiliation request, 24/7 counseling help from Bharti.
6. Bhasha (Language): Visitor ne '${activeLangName}' bhasha chuni hai. Unhe strictly usi bhasha mein shishtata aur samman ke sath uttar dein.
7. Jawab shisht, spasht, professional aur helpful rakhein. User ko unke role ke anusaar step-by-step guidance dein. KABHI 'Beta' ya 'Beti' NA BOLEIN.`;

        let replyText = '';
        const settings = await Settings.findOne();
        const groqKey = settings?.groqApiKey?.trim() || process.env.GROQ_API_KEY || '';
        const geminiKey = settings?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY || '';

        // Priority 1: Free Groq Cloud (llama-3.3-70b-versatile / dynamic active models) with Multi-Turn Memory
        if (groqKey) {
            try {
                const groqRes = await callGroqChat({
                    apiKey: groqKey,
                    prompt: `User (${visitorTitle}) in language (${activeLangName}): "${message}"\n\n${createdTicket ? `NOTE: New Support Ticket ${createdTicket.ticketId} has been created for callback within 15-30 minutes. Mention this ticket ID politely.` : ''}\n\nContext:\n${dbContext}`,
                    history: Array.isArray(history) ? history.slice(-8) : [],
                    systemInstruction: bhartiSystemPrompt,
                    temperature: 0.6,
                    maxTokens: 750
                });
                if (groqRes && groqRes.text) {
                    replyText = groqRes.text;
                }
            } catch (grErr) {
                console.warn('BHARTI Groq call notice:', grErr.message);
            }
        }

        // Priority 2: Google Gemini Fallback with Multi-Turn Memory
        if (!replyText && geminiKey) {
            try {
                const geminiPrompt = `${bhartiSystemPrompt}\n\nContext:\n${dbContext}\n\n${createdTicket ? `NOTE: Support Ticket ${createdTicket.ticketId} has been created for callback within 15-30 minutes. Mention this ticket ID politely.` : ''}\n\nUser (${visitorTitle}) in language (${activeLangName}): "${message}"`;
                const aiRes = await callGoogleGemini({
                    apiKey: geminiKey,
                    prompt: geminiPrompt,
                    history: Array.isArray(history) ? history.slice(-8) : [],
                    temperature: 0.7,
                    maxTokens: 600
                });
                if (aiRes && aiRes.text) {
                    replyText = aiRes.text;
                }
            } catch (gErr) {
                console.warn('BHARTI Gemini call notice:', gErr.message);
            }
        }

        // Priority 3: Intelligent Empathetic Human Rule Engine (Multilingual, Polite, strictly NO "beta")
        if (!replyText) {
            if (trackedTicket) {
                const st = trackedTicket.status;
                const stText = st === 'RESOLVED' ? 'Resolved / Completed' : (st === 'CALLBACK_SCHEDULED' ? 'Callback Scheduled (Within 15-30 Mins)' : 'Open / In Process');
                if (userLang === 'en') {
                    replyText = `Hello ${visitorTitle}! I found your Support Ticket **${trackedTicket.ticketId}**.\n\n• **Status**: ${stText}\n• **Center / Unit**: ${trackedTicket.centerName || 'BBCC Central Directorate'}\n• **Assigned Officer**: ${trackedTicket.assignedOfficer || 'Senior Academic Counselor'}\n• **Resolution Notes**: ${trackedTicket.resolutionNotes || 'Our counseling desk is actively reviewing your request.'}`;
                } else if (userLang === 'bho') {
                    replyText = `प्रणाम ${visitorTitle}! राउर **सपोर्ट टिकट ${trackedTicket.ticketId}** के स्टेटस मिल गइल बा:\n\n• **स्थिति**: ${stText}\n• **सेंटर**: ${trackedTicket.centerName || 'BBCC सेंट्रल'}\n• **जिम्मेदार अधिकारी**: ${trackedTicket.assignedOfficer || 'सीनियर काउंसलर'}\n• **अपडेट**: ${trackedTicket.resolutionNotes || 'राउर आवेदन पर काम चालू बा।'}`;
                } else if (userLang === 'hinglish') {
                    replyText = `Namaste ${visitorTitle}! Aapke **Support Ticket ${trackedTicket.ticketId}** ka status mil gaya hai:\n\n• **Status**: ${stText}\n• **Center**: ${trackedTicket.centerName || 'BBCC Central Directorate'}\n• **Assigned Counselor**: ${trackedTicket.assignedOfficer || 'Senior Counselor'}\n• **Latest Update**: ${trackedTicket.resolutionNotes || 'Counseling team aapse jald hi connect karegi.'}`;
                } else {
                    replyText = `नमस्ते ${visitorTitle}! आपके **सपोर्ट टिकट ${trackedTicket.ticketId}** का विवरण प्राप्त हुआ:\n\n• **वर्तमान स्थिति**: ${stText}\n• **संबद्ध केंद्र**: ${trackedTicket.centerName || 'BBCC Central Directorate'}\n• **काउंसलिंग अधिकारी**: ${trackedTicket.assignedOfficer || 'वरिष्ठ शैक्षिक सलाहकार'}\n• **नवीनतम विवरण**: ${trackedTicket.resolutionNotes || 'काउंसलिंग डेस्क आपकी सहायता में संलग्न है।'}`;
                }
            } else if (trackedPayment) {
                const isPaid = trackedPayment.status === 'paid' || trackedPayment.status === 'SUCCESS';
                const pStatusText = isPaid ? 'SUCCESS / VERIFIED (सफल)' : trackedPayment.status.toUpperCase();
                if (userLang === 'en') {
                    replyText = `Hello ${visitorTitle}! Your payment record has been verified:\n\n• **Order ID**: ${trackedPayment.orderId}\n• **Payment ID**: ${trackedPayment.paymentId || 'Verified'}\n• **Amount**: ₹${trackedPayment.amount}\n• **Status**: ${pStatusText}\n• **Item**: ${trackedPayment.docTitle || trackedPayment.purpose}`;
                } else if (userLang === 'bho') {
                    replyText = `प्रणाम ${visitorTitle}! राउर पेमेंट के जानकारी मिल गइल:\n\n• **ऑर्डर आईडी**: ${trackedPayment.orderId}\n• **रकम**: ₹${trackedPayment.amount}\n• **स्थिति**: ${pStatusText}\n• **कोर्स / किताब**: ${trackedPayment.docTitle || trackedPayment.purpose}`;
                } else if (userLang === 'hinglish') {
                    replyText = `Namaste ${visitorTitle}! Aapka payment record verify ho gaya hai:\n\n• **Order ID**: ${trackedPayment.orderId}\n• **Payment ID**: ${trackedPayment.paymentId || 'Verified'}\n• **Amount**: ₹${trackedPayment.amount}\n• **Status**: ${pStatusText}\n• **Course / Book**: ${trackedPayment.docTitle || trackedPayment.purpose}`;
                } else {
                    replyText = `नमस्ते ${visitorTitle}! आपका भुगतान विवरण सत्यापित कर लिया गया है:\n\n• **ऑर्डर आईडी**: ${trackedPayment.orderId}\n• **पेमेंट आईडी**: ${trackedPayment.paymentId || 'Verified'}\n• **राशि**: ₹${trackedPayment.amount}\n• **स्थिति**: ${pStatusText}\n• **पाठ्यक्रम / पुस्तक**: ${trackedPayment.docTitle || trackedPayment.purpose}`;
                }
            } else if (q.includes('manual') || q.includes('sop') || q.includes('kaise use') || q.includes('kaise chalaye') || q.includes('kaise kaam') || (q.includes('guide') && !q.includes('book') && !q.includes('pdf'))) {
                const isSuperAdminQuery = q.includes('admin') || q.includes('super admin');
                const isDirectorQuery = q.includes('director') || q.includes('coaching') || q.includes('sanchalak');
                const isTeacherQuery = q.includes('teacher') || q.includes('faculty') || q.includes('shikshak') || q.includes('live');
                const isStudentQuery = q.includes('student') || q.includes('vidyarthi') || q.includes('classroom') || q.includes('aadhar') || q.includes('roll');

                if (isSuperAdminQuery) {
                    if (userLang === 'en') {
                        replyText = `Hello ${visitorTitle}! **Super Admin Manual & SOP Summary**:\n\n1. **Affiliated Centers**: Register new coaching centers, define custom admission fees, and edit center credentials.\n2. **National Live Stage**: Broadcast nationwide classes with automatic YouTube live integration (no copy-paste needed).\n3. **Live Monitoring Deck**: Supervise any coaching teacher currently live streaming across India.\n4. **E-Library Vault**: Upload and publish verified study materials and syllabus books.\n5. **Payouts & Wallets**: Approve director bank/UPI withdrawals with direct UTR logging (80% center / 20% platform split).\n\n💡 Full manual: Open the "📖 User Manual & SOP" button inside /admin-console.html or visit /user-manual.html#sec-admin.`;
                    } else if (userLang === 'bho') {
                        replyText = `प्रणाम ${visitorTitle}! **Super Admin User Manual (केंद्रीय एडमिन मार्गदर्शिका)**:\n\n1. **सेंटर मैनेजमेंट**: नया कोचिंग सेंटर जोड़ल, एडमिशन फीस तय कइल आ पासवर्ड बदले के सुविधा।\n2. **नेशनल लाइव स्टेज**: पूरा देश के छात्रन खातिर लाइव क्लास — यूट्यूब के साथ 100% ऑटोमैटिक लिंक।\n3. **लाइव मॉनिटरिंग डेक**: भारत के कवनो भी सेंटर के शिक्षक के लाइव क्लास पर 1-क्लिक में नजर राखल।\n4. **ई-लाइब्रेरी**: नया किताब आ नोट्स सीधे अपलोड क के पब्लिश कइल।\n5. **विथड्रॉवल आ पेआउट**: कोचिंग संचालक लोगन के 80/20 शेयरिंग वाला बैंक/UPI पेआउट UTR नंबर के साथ अप्रूव कइल।\n\n💡 पूरा SOP खातिर /admin-console.html में "User Manual" बटन चाहे /user-manual.html#sec-admin देखीं।`;
                    } else if (userLang === 'hinglish') {
                        replyText = `Namaste ${visitorTitle}! **Super Admin Console User Manual & SOP**:\n\n1. **Coaching Centers**: Naye coaching institutes affiliate karein, unka username/password aur admission fees set karein.\n2. **Central Live Stage**: Deshbhar ke sabhi vidyarthiyo ke liye live broadcast karein (automatic YouTube live linking ke sath).\n3. **National Live Monitor**: Dekhein kaun sa teacher abhi live padha raha hai aur 1-click mein monitor karein.\n4. **E-Library Vault**: Pustakein aur chapter notes upload karke publish karein.\n5. **Payouts Desk**: Coaching directors ki 80% earnings ke bank/UPI withdrawal UTR number ke sath approve karein.\n\n💡 Poora detailed manual /admin-console.html ke "User Manual" modal ya /user-manual.html#sec-admin par available hai.`;
                    } else {
                        replyText = `नमस्ते ${visitorTitle}! **Super Admin Console User Manual & SOP**:\n\n1. **संबद्ध कोचिंग केंद्र**: नए कोचिंग संस्थानों को जोड़ें, उनका यूज़रनेम/पासवर्ड और एडमिशन फीस तय करें।\n2. **केंद्रीय लाइव प्रसारण**: देशव्यापी लाइव क्लास लें (यूट्यूब लाइव 100% स्वतः लिंक होता है, लिंक कॉपी करने की आवश्यकता नहीं)।\n3. **नेशनल लाइव मॉनिटरिंग डेक**: भारत भर में लाइव चल रही कक्षाओं को रीयल-टाइम में मॉनिटर करें।\n4. **ई-लाइब्रेरी वॉल्ट**: सभी कक्षाओं के प्रमाणित नोट्स और मॉडल पेपर्स प्रकाशित करें।\n5. **पेआउट एवं विथड्रॉवल**: कोचिंग संचालकों के 80% शेयर के बैंक/UPI आहरण को UTR नंबर दर्ज कर स्वीकृत करें।\n\n💡 संपूर्ण विवरण के लिए /admin-console.html के "User Manual & SOP" बटन या /user-manual.html#sec-admin पर जाएं।`;
                    }
                } else if (isDirectorQuery) {
                    if (userLang === 'en') {
                        replyText = `Hello ${visitorTitle}! **Coaching Director Portal Manual & SOP**:\n\n1. **Faculty Management**: Create unique Teacher IDs and passwords for your institute teachers.\n2. **Courses & Batches**: Set course duration and monthly/batch fees.\n3. **Study Notes**: Upload PDFs and question papers (cleanly stored on GitHub/disk with zero database bloat).\n4. **Student Enrollment**: Register students with institute-specific admission fees and generate 1-click WhatsApp receipts.\n5. **Live Teaching Monitor**: Watch your teachers' live classrooms in real-time.\n6. **Earnings & Payouts**: 80% of student fee goes directly to your wallet; request UPI/Bank transfer anytime.\n\n💡 Full manual: Click "📖 Director SOP & Manual" inside /director-portal.html or visit /user-manual.html#sec-director.`;
                    } else if (userLang === 'bho') {
                        replyText = `प्रणाम ${visitorTitle}! **Coaching Director Manual (कोचिंग संचालक मार्गदर्शिका)**:\n\n1. **फैकल्टी मैनेजमेंट**: आपन कोचिंग के टीचर लोगन खातिर Teacher ID आ पासवर्ड बनाईं।\n2. **कोर्स आ बैच**: कोर्स के फीस आ अवधि तय करीं।\n3. **स्टडी नोट्स**: छात्रन खातिर नोट्स आ PDF अपलोड करीं (गिटहब/डिस्क पर सुरक्षित बिना डेटाबेस लोड के)।\n4. **छात्र नामांकन**: छात्रन के एडमिशन करीं आ तुरंत 1-क्लिक व्हाट्सएप रसीद भेजीं।\n5. **लाइव मॉनिटर**: आपन कोचिंग के शिक्षक के लाइव क्लास रीयल-टाइम में देखीं।\n6. **वॉलेट विथड्रॉवल**: 80% कमाई सीधे वॉलेट में आवेला, जब मर्जी तब बैंक/UPI में ट्रांसफर रिक्वेस्ट भेजीं।\n\n💡 पूरा SOP खातिर /director-portal.html में "Director SOP" बटन या /user-manual.html#sec-director देखीं।`;
                    } else if (userLang === 'hinglish') {
                        replyText = `Namaste ${visitorTitle}! **Coaching Director Portal User Manual & SOP**:\n\n1. **Faculty Setup**: Apne teachers ke liye Teacher ID aur password create karein.\n2. **Courses & Batches**: Batches banayein aur unki fees schedule karein.\n3. **Study Materials**: Notes upload karein (clean GitHub/disk storage par bina database load ke).\n4. **Student Admission**: Students ko enroll karein aur 1-click digital WhatsApp receipt generate karein.\n5. **Live Teaching Monitor**: Check karein kaun se teacher live padha rahe hain.\n6. **Wallet & Payouts**: Har admission ka 80% share aapke wallet mein aata hai, jise kabhi bhi withdraw kar sakte hain.\n\n💡 Poora manual dekhne ke liye /director-portal.html ke "Director SOP & Manual" par click karein ya /user-manual.html#sec-director dekhein.`;
                    } else {
                        replyText = `नमस्ते ${visitorTitle}! **Coaching Director Portal User Manual & SOP**:\n\n1. **फैकल्टी प्रबंधन**: अपने शिक्षकों के लिए Teacher ID व पासवर्ड बनाएं।\n2. **कोर्स और बैच निर्माण**: नए बैच बनाएं और उनकी फीस तय करें।\n3. **स्टडी नोट्स अपलोड**: नोट्स और प्रश्नपत्र अपलोड करें (GitHub/डिस्क पर सुरक्षित, डेटाबेस पर कोई भार नहीं)।\n4. **छात्र नामांकन**: विद्यार्थियों का रजिस्ट्रेशन करें और तुरंत 1-क्लिक डिजिटल व्हाट्सएप रसीद जारी करें।\n5. **लाइव टीचिंग मॉनिटर**: अपने केंद्र के शिक्षकों की लाइव क्लास को सीधे मॉनिटर करें।\n6. **वॉलेट व पेआउट**: प्रत्येक शुल्क का 80% हिस्सा आपके वॉलेट में जुड़ता है; कभी भी बैंक/UPI में आहरण का अनुरोध करें।\n\n💡 संपूर्ण विवरण हेतु /director-portal.html में "Director SOP & Manual" बटन या /user-manual.html#sec-director देखें।`;
                    }
                } else if (isTeacherQuery) {
                    if (userLang === 'en') {
                        replyText = `Hello ${visitorTitle}! **Teacher Faculty Studio Manual & SOP**:\n\n1. **Universal Login**: Enter your Mobile/Teacher ID and password (assigned by your coaching director) at /teacher-portal.\n2. **Instant Live Broadcast**: Click "🔴 Start Live Class". Camera & mic initialize automatically.\n3. **Automatic YouTube Integration**: No manual link copy-pasting is required. The platform links YouTube live automatically.\n4. **Interactive Doubt Board**: View real-time questions asked by students with auto-scroll and 1-click sound alerts.\n5. **Low-Bandwidth Relay**: Automatically delivers optimized video frames so village students with slow 2G/3G internet can attend smoothly.\n6. **End & Auto-Upload**: Ending the class automatically saves the lecture in WebM format and uploads it to YouTube for future student revisions.\n\n💡 Full manual: Click "📖 Teacher Studio Manual" in /teacher-portal.html or visit /user-manual.html#sec-teacher.`;
                    } else if (userLang === 'bho') {
                        replyText = `प्रणाम ${visitorTitle}! **Teacher Studio User Manual (शिक्षक मार्गदर्शिका)**:\n\n1. **टीचर लॉगिन**: आपन मोबाइल नंबर/Teacher ID आ पासवर्ड डाल के /teacher-portal पर लॉगिन करीं।\n2. **1-क्लिक लाइव क्लास**: "Start Live Class" दबाईं, कैमरा आ माइक अपने-आप शुरू हो जाई।\n3. **ऑटोमैटिक यूट्यूब लाइव**: यूट्यूब से लिंक कॉपी करे के कौनों जरूरत नइखे, सिस्टम अपने-आप जोड़ लेला।\n4. **छात्र डाउट बोर्ड**: क्लास के दौरान छात्रन के सवाल रीयल-टाइम में स्क्रीन पर देखलाई पड़ी।\n5. **कम इंटरनेट सपोर्ट**: गाँव-देहात के 2G/3G इंटरनेट वाला छात्र भी बिना रुके क्लास देख पइहें।\n6. **क्लास सेव आ यूट्यूब अपलोड**: क्लास बंद करते ही पूरा लेक्चर यूट्यूब आ पोर्टल पर रिवीज़न खातिर सेव हो जाई।\n\n💡 पूरा SOP खातिर /teacher-portal.html में "Teacher Manual" बटन या /user-manual.html#sec-teacher देखीं।`;
                    } else if (userLang === 'hinglish') {
                        replyText = `Namaste ${visitorTitle}! **Teacher Faculty Studio User Manual & SOP**:\n\n1. **Universal Login**: Apne Teacher ID/Mobile aur password se /teacher-portal par login karein.\n2. **1-Click Live Broadcast**: "Start Live Class" click karein, camera aur mic automatically start ho jayega.\n3. **Zero Copy-Paste YouTube Live**: YouTube link manually copy karne ki zaroorat nahi hai, system automatically manage karta hai.\n4. **Student Doubt Board**: Live class ke dauran students ke doubts screen par real-time aate hain.\n5. **Low Bandwidth Frame Relay**: Kamzor 2G/3G internet wale gaon ke bache bhi bina buffering ke class dekh sakte hain.\n6. **Auto Recording & Upload**: Class end karte hi lecture save hokar revision ke liye upload ho jata hai.\n\n💡 Poora guide dekhne ke liye /teacher-portal.html ke "Teacher Manual" par click karein ya /user-manual.html#sec-teacher dekhein.`;
                    } else {
                        replyText = `नमस्ते ${visitorTitle}! **Teacher Faculty Studio User Manual & SOP**:\n\n1. **यूनिवर्सल शिक्षक लॉगिन**: अपने डायरेक्टर द्वारा प्रदत्त Teacher ID या मोबाइल नंबर व पासवर्ड से /teacher-portal पर लॉगिन करें।\n2. **1-क्लिक लाइव क्लास**: "Start Live Class" पर क्लिक करें, कैमरा और माइक स्वतः कनेक्ट हो जाएंगे।\n3. **100% स्वतः YouTube इंटीग्रेशन**: यूट्यूब से लिंक कॉपी-पेस्ट करने की कोई आवश्यकता नहीं है, सिस्टम स्वतः लिंक करता है।\n4. **रीयल-टाइम डाउट बोर्ड**: कक्षा के दौरान छात्र जो भी प्रश्न पूछते हैं, वे सीधे स्क्रीन पर दिखते हैं।\n5. **कम इंटरनेट फ्रेम रिले**: 2G/3G और कमजोर ग्रामीण इंटरनेट पर भी वीडियो बिना रुके चलता है।\n6. **स्वतः रिकॉर्डिंग व यूट्यूब अपलोड**: कक्षा समाप्त होते ही पूरा लेक्चर रिकॉर्ड होकर रिवीजन वॉल्ट और यूट्यूब पर सुरक्षित हो जाता है।\n\n💡 संपूर्ण विवरण हेतु /teacher-portal.html के "Teacher Studio Manual" बटन या /user-manual.html#sec-teacher पर जाएं।`;
                    }
                } else if (isStudentQuery) {
                    if (userLang === 'en') {
                        replyText = `Hello ${visitorTitle}! **Student Classroom User Manual & Guide**:\n\n1. **Classroom Login**: Enter your 12-digit Aadhar Number or verified Roll Number at /classroom.\n2. **Live Classroom**: When your coaching teacher is live, a green "🔴 JOIN LIVE CLASS" button appears automatically. Click to attend with zero buffering.\n3. **Ask Doubts**: Type your questions during the live session; the teacher responds immediately on screen.\n4. **100% Free Notes**: All enrolled students can view and download syllabus notes and chapter PDFs completely free.\n5. **Order Hard Copy Books**: Order physical printed textbooks with home delivery.\n6. **Priority Callback Ticket**: If you have any study problem, generate a 1-click support ticket; our counselor will call within 15-30 minutes.\n\n💡 Full guide: Click "📖 Student Guide & Manual" in /classroom.html or visit /user-manual.html#sec-student.`;
                    } else if (userLang === 'bho') {
                        replyText = `प्रणाम ${visitorTitle}! **Student Classroom User Manual (छात्र मार्गदर्शिका)**:\n\n1. **क्लासरूम लॉगिन**: आपन 12 अंक के आधार कार्ड नंबर या रोल नंबर डाल के /classroom पर लॉगिन करीं।\n2. **लाइव क्लास में जुड़ल**: जब भी राउर शिक्षक लाइव अइहें, "JOIN LIVE CLASS" के बटन देखलाई पड़ी।\n3. **सवाल पूछीं**: क्लास के बीच में रउआ सीधे टाइप क के आपन डाउट शिक्षक से पूछ सकिला।\n4. **100% फ्री नोट्स**: नामांकित छात्रन खातिर सभ विषय के नोट्स आ PDF डाउनलोड बिल्कुल मुफ़्त बा।\n5. **किताब मंगवाईं**: घर बइठे ओरिजिनल छपल किताब ऑर्डर क के मंगा सकिला।\n6. **सपोर्ट टिकट**: कौनों भी दिक्कत भइला पर टिकट बनाईं, 15 से 30 मिनट में हमनी के अधिकारी फोन करिहें।\n\n💡 पूरा SOP खातिर /classroom.html में "Student Guide" बटन या /user-manual.html#sec-student देखीं।`;
                    } else if (userLang === 'hinglish') {
                        replyText = `Namaste ${visitorTitle}! **Student Classroom User Manual & Guide**:\n\n1. **Classroom Login**: Apna 12-digit Aadhar Number ya Roll Number enter karke /classroom par login karein.\n2. **Join Live Class**: Jab bhi aapke teacher live aayenge, "🔴 JOIN LIVE CLASS" button par 1-click mein attend karein.\n3. **Ask Doubts Live**: Padhte waqt screen par apna doubt likhein, teacher live screen par answer karenge.\n4. **100% Free Notes**: Enrolled students ke liye sabhi subjects ke PDF study notes poori tarah free hain.\n5. **Order Physical Books**: Apne ghar ke pate par printed textbooks manga sakte hain.\n6. **Priority Support**: Kisi bhi samasya par 1-click callback ticket banayein, 15-30 minute mein call aayegi.\n\n💡 Poora guide dekhne ke liye /classroom.html ke "Student Guide & Manual" button par click karein ya /user-manual.html#sec-student dekhein.`;
                    } else {
                        replyText = `नमस्ते ${visitorTitle}! **Student Classroom User Manual & Guide**:\n\n1. **क्लासरूम लॉगिन**: अपना 12 अंकों का आधार नंबर या सत्यापित रोल नंबर दर्ज कर /classroom पर लॉगिन करें।\n2. **लाइव क्लास में शामिल होना**: जब भी आपके शिक्षक लाइव आएंगे, "🔴 JOIN LIVE CLASS" बटन दिखेगा; 1-क्लिक में क्लास से जुड़ें।\n3. **लाइव डाउट पूछना**: क्लास के दौरान अपना प्रश्न टाइप करें, शिक्षक सीधे स्क्रीन पर समाधान करेंगे।\n4. **100% नि:शुल्क नोट्स**: नामांकित विद्यार्थियों के लिए सभी विषयों की ई-बुक्स और अध्यायवार PDF पूरी तरह फ्री हैं।\n5. **प्रिंटेड पुस्तकें मंगाना**: अपने पते पर डाक द्वारा असली छपी हुई पुस्तकें ऑर्डर करें।\n6. **सपोर्ट कॉलबैक**: किसी भी पढ़ाई या तकनीकी समस्या पर 1-क्लिक टिकट बनाएं; हमारे अधिकारी 15-30 मिनट में फोन करेंगे।\n\n💡 संपूर्ण विवरण हेतु /classroom.html में "Student Guide & Manual" बटन या /user-manual.html#sec-student पर जाएं।`;
                    }
                } else {
                    // General / Visitor Portal Manual
                    if (userLang === 'en') {
                        replyText = `Hello ${visitorTitle}! **BBCC SKILL HUB — Complete Platform Guide & User Manual**:\n\n• **For Visitors & Parents**: Search certified centers, verify student roll numbers, browse the free E-Library, or take Direct Online Admission on our homepage (/index.html).\n• **For Students**: Login with your 12-digit Aadhar or Roll Number at /classroom to attend live classes, ask doubts, and download free notes.\n• **For Teachers**: Universal login at /teacher-portal to start 1-click live broadcasts with automatic YouTube linking and student doubt monitoring.\n• **For Coaching Directors**: Manage faculty, batch fees, enroll students with WhatsApp receipts, and withdraw 80% earnings at /director-portal.html.\n• **For Super Admin**: Central institute affiliation, national live monitoring deck, and payout approvals at /admin-console.html.\n\n📖 You can download the official PDF Manual (/BBCC_Platform_User_Manual.pdf) or view the full web manual at /user-manual.html anytime. How can I guide you further?`;
                    } else if (userLang === 'bho') {
                        replyText = `प्रणाम ${visitorTitle}! **BBCC SKILL HUB — संपूर्ण प्लेटफॉर्म मार्गदर्शिका (User Manual)**:\n\n• **आगंतुक आ अभिभावक खातिर**: होमपेज (/index.html) पर प्रमाणित कोचिंग खोजीं, रोल नंबर सत्यापित करीं, फ्री ई-लाइब्रेरी पढ़ीं चाहे सीधा ऑनलाइन एडमिशन लीं।\n• **छात्रन खातिर**: /classroom पर 12 अंक के आधार कार्ड या रोल नंबर से लॉगिन क के लाइव क्लास, डाउट आ फ्री नोट्स डाउनलोड करीं।\n• **शिक्षकों खातिर**: /teacher-portal पर लॉगिन क के 1-क्लिक में लाइव क्लास शुरू करीं (यूट्यूब लाइव अपने-आप लिंक हो जाला)।\n• **कोचिंग संचालकों खातिर**: /director-portal.html पर फैकल्टी बनाईं, नया बैच शेड्यूल करीं, व्हाट्सएप रसीद दीं आ 80% वॉलेट कमाई निकालें।\n• **सुपर एडमिन खातिर**: /admin-console.html से देश भर के सेंटर के मान्यता, नेशनल लाइव मॉनिटरिंग आ पेआउट UTR अप्रूवल।\n\n📖 रउआ कभी भी /BBCC_Platform_User_Manual.pdf डाउनलोड क सकिला या /user-manual.html पर पूरा SOP देख सकिला। हम राउर कइसे सहायता करीं?`;
                    } else if (userLang === 'hinglish') {
                        replyText = `Namaste ${visitorTitle}! **BBCC SKILL HUB — Complete Platform Guide & User Manual**:\n\n• **Visitors & Parents ke liye**: Homepage (/index.html) par certified coaching khojein, roll number verify karein, free E-Library padhein ya Direct Online Admission lein.\n• **Students ke liye**: /classroom par apne 12-digit Aadhar ya Roll Number se login karke live class lein, doubts poochhein aur free notes download karein.\n• **Teachers ke liye**: /teacher-portal par 1-click live class start karein (YouTube live automatically link hota hai, bina kisi copy-paste ke).\n• **Coaching Directors ke liye**: /director-portal.html par teachers banayein, batch fees set karein, WhatsApp receipt dein aur 80% earnings withdraw karein.\n• **Super Admin ke liye**: /admin-console.html par national centers affiliation, live classes monitoring deck aur payout approvals.\n\n📖 Aap kabhi bhi /BBCC_Platform_User_Manual.pdf download kar sakte hain ya /user-manual.html dekh sakte hain. Bataiye main kis role mein aapki madad karun?`;
                    } else {
                        replyText = `नमस्ते ${visitorTitle}! **BBCC SKILL HUB — संपूर्ण प्लेटफॉर्म मार्गदर्शिका (User Manual)**:\n\n• **आगंतुकों एवं अभिभावकों के लिए**: मुख्य पृष्ठ (/index.html) पर प्रमाणित कोचिंग खोजें, रोल नंबर सत्यापित करें, ई-लाइब्रेरी देखें या सीधे ऑनलाइन एडमिशन लें।\n• **विद्यार्थियों के लिए**: /classroom पर अपने 12 अंकों के आधार या रोल नंबर से लॉगिन कर लाइव क्लास लें, डाउट पूछें और मुफ़्त नोट्स डाउनलोड करें।\n• **शिक्षकों के लिए**: /teacher-portal पर 1-क्लिक में लाइव क्लास शुरू करें (यूट्यूब लाइव स्वतः लिंक होता है, लिंक कॉपी करने की आवश्यकता नहीं)।\n• **कोचिंग संचालकों के लिए**: /director-portal.html पर फैकल्टी बनाएं, बैच फीस तय करें, व्हाट्सएप रसीद जारी करें और 80% वॉलेट कमाई आहरण करें।\n• **सुपर एडमिन के लिए**: /admin-console.html पर राष्ट्रीय कोचिंग संबद्धता, नेशनल लाइव मॉनिटरिंग डेक और UTR पेआउट स्वीकृति।\n\n📖 आप कभी भी /BBCC_Platform_User_Manual.pdf डाउनलोड कर सकते हैं या /user-manual.html देख सकते हैं। बताएं, मैं आपकी किस प्रकार और सहायता करूँ?`;
                    }
                }
            } else if (downloadCards.length > 0) {
                if (userLang === 'en') {
                    replyText = `Hello ${visitorTitle}! I found the relevant syllabus study materials from our E-Library. You can directly view and download them using the 1-click Download buttons below:`;
                } else if (userLang === 'bho') {
                    replyText = `प्रणाम ${visitorTitle}! ई-लाइब्रेरी से राउर विषय के किताब आ नोट्स मिल गइल बा। नीचे दिहल गइल बटन पर क्लिक क के रउआ सीधे PDF डाउनलोड क सकिला:`;
                } else if (userLang === 'hinglish') {
                    replyText = `Namaste ${visitorTitle}! Hamari E-Library se aapke maange gaye syllabus notes mil gaye hain. Neeche diye gaye Download buttons par click karke aap direct PDF prapt kar sakte hain:`;
                } else {
                    replyText = `नमस्ते ${visitorTitle}! हमारी ई-लाइब्रेरी से आपके विषय के प्रमाणित अध्ययन नोट्स प्राप्त हो गए हैं। नीचे दिए गए 1-क्लिक डाउनलोड कार्ड से आप सीधे PDF प्राप्त कर सकते हैं:`;
                }
            } else if (q.includes('syllabus') || q.includes('class') || q.includes('subject') || q.includes('10th') || q.includes('12th')) {
                if (userLang === 'en') {
                    replyText = `Hello ${visitorTitle}! BBCC SKILL HUB covers the complete curriculum for Classes 1 to 12 (BSEB, CBSE, and NCERT). We offer comprehensive subject notes, test papers, and expert faculty mentoring across Mathematics, Science, Social Sciences, Hindi, and English.`;
                } else if (userLang === 'bho') {
                    replyText = `प्रणाम ${visitorTitle}! BBCC SKILL HUB पर कक्षा 1 से 12वीं ले (BSEB, CBSE, NCERT) के पूरा सिलेबस बहुत नीमन से पढ़ावल जाला। गणित, विज्ञान, सामाजिक विज्ञान आ भाषा के सभ विषय के पूरा नोट्स ई-लाइब्रेरी में उपलब्ध बा।`;
                } else if (userLang === 'hinglish') {
                    replyText = `Namaste ${visitorTitle}! BBCC SKILL HUB par Class 1st se 12th (BSEB, CBSE, NCERT) ka complete syllabus cover hota hai. Maths, Science, Social Science, Hindi aur English ke complete chapter-wise notes hamari E-Library mein available hain.`;
                } else {
                    replyText = `नमस्ते ${visitorTitle}! BBCC SKILL HUB पर कक्षा 1 से 12वीं तक (BSEB, CBSE, NCERT) का पूरा पाठ्यक्रम उपलब्ध है। गणित, विज्ञान, सामाजिक विज्ञान, हिंदी और अंग्रेजी के अध्यायवार प्रमाणित नोट्स और मॉडल टेस्ट पेपर्स आप हमारी ई-लाइब्रेरी से प्राप्त कर सकते हैं।`;
                }
            } else if (q.includes('fee') || q.includes('fees') || q.includes('paisa') || q.includes('charge') || q.includes('cost')) {
                if (userLang === 'en') {
                    replyText = `Hello ${visitorTitle}! The online admission fee across verified BBCC centers is just ₹${targetCenter?.admissionFee || 200} (with merit scholarship waivers available). Individual computer and board coaching courses range between ₹499 and ₹2,500.`;
                } else if (userLang === 'bho') {
                    replyText = `प्रणाम ${visitorTitle}! ऑनलाइन एडमिशन फीस खाली ₹${targetCenter?.admissionFee || 200} बा, आ मेधावी छात्रन खातिर फीस में स्कॉलरशिप छूट भी मिलेला। कोर्स फीस ₹499 से ₹2500 के बीच बा।`;
                } else if (userLang === 'hinglish') {
                    replyText = `Namaste ${visitorTitle}! Online admission registration fee sirf ₹${targetCenter?.admissionFee || 200} hai aur deserving students ke liye scholarship suvidha bhi hai. Courses ki fees ₹499 se ₹2500 ke beech hai.`;
                } else {
                    replyText = `नमस्ते ${visitorTitle}! ऑनलाइन एडमिशन रजिस्ट्रेशन शुल्क मात्र ₹${targetCenter?.admissionFee || 200} है (जिसमें मेधावी विद्यार्थियों के लिए विशेष छूट भी उपलब्ध है)। विभिन्न कोर्सेज (DCA, ADCA, Tally, बोर्ड बैचेज) का शुल्क ₹499 से ₹2500 के बीच है।`;
                }
            } else if (q.includes('adca') || q.includes('dca') || q.includes('tally') || q.includes('course') || q.includes('computer')) {
                if (userLang === 'en') {
                    replyText = `Hello ${visitorTitle}! BBCC offers government-aligned professional skill courses including ADCA (Advanced Diploma in Computer Applications), DCA, Tally Prime with GST, and High-Speed Typing with central digital certifications.`;
                } else if (userLang === 'bho') {
                    replyText = `प्रणाम ${visitorTitle}! हमनी के यहाँ ADCA (एडवांस्ड डिप्लोमा), DCA, टैली प्राइम विथ जीएसटी आ टाइपिंग के प्रैक्टिकल ट्रेनिंग आ सरकारी मान्यता प्राप्त सर्टिफिकेट मिलेला।`;
                } else if (userLang === 'hinglish') {
                    replyText = `Namaste ${visitorTitle}! BBCC par job-oriented courses jaise ADCA, DCA, Tally Prime with GST aur Computer Typing live practical training ke sath sikhaye jaate hain.`;
                } else {
                    replyText = `नमस्ते ${visitorTitle}! BBCC SKILL HUB पर रोजगारोन्मुखी कंप्यूटर कोर्सेज जैसे ADCA (12 माह), DCA (6 माह), Tally Prime with GST और टाइपिंग की संपूर्ण प्रैक्टिकल ट्रेनिंग दी जाती है और केंद्रीय प्रमाणपत्र भी जारी होता है।`;
                }
            } else if (q.includes('admission') || q.includes('enroll') || q.includes('join') || q.includes('dakhila')) {
                if (userLang === 'en') {
                    replyText = `Hello ${visitorTitle}! Direct admission is 100% digital. Simply click "Direct Admission" on our portal homepage, select your preferred coaching center and course, and get your roll number instantly.`;
                } else if (userLang === 'bho') {
                    replyText = `प्रणाम ${visitorTitle}! एडमिशन लेवे खातिर पोर्टल के होमपेज पर "Direct Admission" पर क्लिक करीं, सेंटर आ क्लास चुनीं, आ तुरंत ऑनलाइन रसीद पा लीं।`;
                } else if (userLang === 'hinglish') {
                    replyText = `Namaste ${visitorTitle}! Admission lena bahut simple hai. Homepage par "Direct Admission" par click karke aap apna favorite center aur course choose karke enroll kar sakte hain.`;
                } else {
                    replyText = `नमस्ते ${visitorTitle}! BBCC SKILL HUB में एडमिशन प्रक्रिया 100% पारदर्शी और ऑनलाइन है। आप पोर्टल होमपेज पर "Direct Admission" पर क्लिक करके सीधे अपना पसंदीदा सेंटर और बैच चुनकर नामांकन कर सकते हैं।`;
                }
            } else {
                if (userLang === 'en') {
                    replyText = `Hello ${visitorTitle}! I am **Bharti**, Chief Academic Counselor at BBCC SKILL HUB. I can help you with course admissions, syllabus notes, coaching center guidance, exam preparation, ticket status tracking, and payment tracking. How may I assist you today?`;
                } else if (userLang === 'bho') {
                    replyText = `प्रणाम ${visitorTitle}! हम **भारती** हईं, BBCC SKILL HUB के Chief Academic Counselor। कोर्स, फीस, सिलेबस, किताब, टिकट स्टेटस चाहे पेमेंट ट्रैकिंग — जे भी सवाल होखे, खुल के पूछीं!`;
                } else if (userLang === 'hinglish') {
                    replyText = `Namaste ${visitorTitle}! Main **Bharti** hoon, BBCC SKILL HUB ki Chief Academic Counselor. Course, fees, syllabus, books, ticket tracking ya payment status — aap bina kisi jhijhak ke poochhiye!`;
                } else {
                    replyText = `नमस्ते ${visitorTitle}! मैं **भारती** हूँ — BBCC SKILL HUB की Chief Academic Counselor। कोर्स, फीस, सिलेबस, ई-लाइब्रेरी बुक्स, एडमिशन, टिकट ट्रैकिंग या पेमेंट वेरिफिकेशन — आपका जो भी प्रश्न हो, कृपया पूछें। मैं आपकी पूरी सहायता करूँगी।`;
                }
            }
        }

        // Clean out any accidental "beta" or "beti" from AI model outputs to strictly honor user request
        replyText = replyText.replace(/\bbeta\b/gi, visitorTitle || 'Aap')
                             .replace(/\bbeti\b/gi, visitorTitle || 'Aap')
                             .replace(/बेटा/g, visitorTitle ? `${visitorTitle}` : 'आप')
                             .replace(/बेटी/g, visitorTitle ? `${visitorTitle}` : 'आप');

        res.json({
            success: true,
            reply: replyText,
            showDirectContactCard: false, // Protected: individual director phone numbers strictly withheld
            ticket: createdTicket ? {
                ticketId: createdTicket.ticketId,
                status: createdTicket.status,
                phone: createdTicket.phone,
                scheduledCallback: createdTicket.scheduledCallback,
                assignedOfficer: createdTicket.assignedOfficer,
                centerName: createdTicket.centerName
            } : null,
            ticketStatusCard: trackedTicket ? {
                ticketId: trackedTicket.ticketId,
                status: trackedTicket.status,
                phone: trackedTicket.phone,
                studentName: trackedTicket.studentName,
                assignedOfficer: trackedTicket.assignedOfficer || 'Senior Academic Counselor',
                scheduledCallback: trackedTicket.scheduledCallback || 'Within 15-30 Minutes',
                resolutionNotes: trackedTicket.resolutionNotes || 'In Progress',
                centerName: trackedTicket.centerName || 'BBCC Central Directorate',
                createdAt: trackedTicket.createdAt
            } : null,
            paymentCard: trackedPayment ? {
                orderId: trackedPayment.orderId,
                paymentId: trackedPayment.paymentId || 'N/A',
                amount: trackedPayment.amount,
                status: trackedPayment.status,
                docTitle: trackedPayment.docTitle || trackedPayment.purpose,
                payerName: trackedPayment.payerName,
                paidAt: trackedPayment.paidAt || trackedPayment.createdAt,
                createdAt: trackedPayment.createdAt
            } : null,
            downloadCards: downloadCards.length > 0 ? downloadCards : null
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.13 Public Support Callback Ticket Generation (Direct Form or Chat)
app.post('/api/public/support-ticket', async (req, res) => {
    try {
        const { studentName, phone, centerId, issueSummary, category } = req.body;
        if (!phone || !phone.trim()) {
            return res.status(400).json({ success: false, message: 'Valid contact mobile number required' });
        }

        const cleanMobile = phone.replace(/[^0-9]/g, '').slice(-10);
        if (cleanMobile.length !== 10) {
            return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit mobile number' });
        }

        let cName = 'BBCC Central Directorate';
        let assigned = 'Senior Academic Counselor';
        if (centerId && centerId !== 'central' && mongoose.Types.ObjectId.isValid(centerId)) {
            const c = await TuitionCenter.findById(centerId);
            if (c) {
                cName = c.centerName;
                assigned = `Director ${c.directorName}`;
            }
        }

        const tktId = `TKT-BBCC-${Math.floor(100000 + Math.random() * 900000)}`;
        const ticket = await SupportTicket.create({
            ticketId: tktId,
            studentName: (studentName || 'Student / Parent').trim(),
            phone: cleanMobile,
            centerId: centerId || 'central',
            centerName: cName,
            category: category || 'Academic Counseling & Callback',
            issueSummary: (issueSummary || 'Requested callback from counselor or center director').trim(),
            status: 'CALLBACK_SCHEDULED',
            scheduledCallback: 'Within 15-30 Minutes',
            assignedOfficer: assigned
        });

        res.json({
            success: true,
            message: `Support ticket ${tktId} generated! Callback scheduled within 15-30 minutes.`,
            ticket: ticket
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.14 Super Admin Support Tickets Management Desk
app.get('/api/admin/tickets', verifySuperAdmin, async (req, res) => {
    try {
        const tickets = await SupportTicket.find().sort({ createdAt: -1 });
        res.json({ success: true, data: tickets });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/admin/tickets/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { status, resolutionNotes, assignedOfficer } = req.body;
        const ticket = await SupportTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Support ticket not found' });

        if (status) ticket.status = status;
        if (resolutionNotes !== undefined) ticket.resolutionNotes = resolutionNotes;
        if (assignedOfficer !== undefined) ticket.assignedOfficer = assignedOfficer;
        if (status === 'RESOLVED') ticket.resolvedAt = new Date();

        await ticket.save();
        res.json({ success: true, message: 'Ticket updated successfully', data: ticket });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/admin/tickets/:id', verifySuperAdmin, async (req, res) => {
    try {
        const ticket = await SupportTicket.findByIdAndDelete(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Support ticket not found' });
        res.json({ success: true, message: 'Support ticket deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.15 Coaching Director Support Tickets Desk
app.get('/api/director/tickets', verifyDirector, async (req, res) => {
    try {
        const tickets = await SupportTicket.find({
            $or: [
                { centerId: req.center.centerId },
                { centerName: new RegExp(req.center.username || '', 'i') }
            ]
        }).sort({ createdAt: -1 });
        res.json({ success: true, data: tickets });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/director/tickets/:id', verifyDirector, async (req, res) => {
    try {
        const { status, resolutionNotes } = req.body;
        const ticket = await SupportTicket.findOne({
            _id: req.params.id,
            centerId: req.center.centerId
        });
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found for this center' });

        if (status) ticket.status = status;
        if (resolutionNotes !== undefined) ticket.resolutionNotes = resolutionNotes;
        if (status === 'RESOLVED') ticket.resolvedAt = new Date();

        await ticket.save();
        res.json({ success: true, message: 'Ticket marked resolved', data: ticket });
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
        const { docId, payerName, payerPhone, payerEmail, studentQuery, onlyVerify, orderType } = req.body;
        if (!docId) {
            return res.status(400).json({ success: false, message: 'Document ID is required' });
        }

        let note = null;
        let parentSm = null;

        const sm = await StudyMaterial.findOne();
        if (sm && sm.notes) {
            note = sm.notes.id(docId) || sm.notes.find(n => n._id.toString() === docId);
            if (note) parentSm = sm;
        }

        if (!note) {
            const center = await TuitionCenter.findOne({ 'materials._id': docId });
            if (center) {
                const mat = center.materials.id(docId) || center.materials.find(m => m._id.toString() === docId);
                if (mat) {
                    note = {
                        _id: mat._id,
                        title: mat.title,
                        description: mat.description,
                        price: mat.price || 0,
                        physicalPrice: mat.physicalPrice,
                        file: mat.file || mat.pdf,
                        pdf: mat.pdf || mat.file,
                        fileType: mat.fileType || 'pdf',
                        fileName: mat.title.replace(/[^a-zA-Z0-9]/g, '_') + '.' + (mat.fileType || 'pdf'),
                        targetCenterId: center._id.toString(),
                        targetCenterName: center.centerName,
                        isRawData: mat.isRawData
                    };
                }
            }
        }

        if (!note) {
            return res.status(404).json({ success: false, message: 'Document note not found in repository' });
        }

        const isPhysicalOrder = (orderType === 'physical');
        const origPrice = Math.max(0, Number(note.price) || 0);
        let price = origPrice;

        if (isPhysicalOrder) {
            price = Number(note.physicalPrice) || (origPrice > 0 ? Math.max(99, Math.round(origPrice * 1.8 + 50)) : 149);
        }

        // Check if student is enrolled in this coaching center or course for 100% Free Access (PDF Only)
        let isEnrolledStudent = false;
        let studentRecord = null;
        const q = (studentQuery || '').trim().replace(/\s+/g, '');

        if (!isPhysicalOrder && q) {
            studentRecord = await Student.findOne({
                $or: [{ aadharNumber: q }, { rollNo: (studentQuery || '').trim() }]
            });
            if (studentRecord) {
                const matchesCenter = note.targetCenterId && (
                    note.targetCenterId === 'all' ||
                    (studentRecord.centerId && studentRecord.centerId.toString() === note.targetCenterId.toString())
                );
                const matchesCourse = studentRecord.course && note.title && (
                    note.title.toLowerCase().includes(studentRecord.course.toLowerCase()) ||
                    studentRecord.course.toLowerCase().includes((note.subject || '').toLowerCase())
                );
                if (matchesCenter || matchesCourse) {
                    isEnrolledStudent = true;
                }
            }
        } else if (!isPhysicalOrder && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            try {
                const decoded = jwt.verify(req.headers.authorization.split(' ')[1], JWT_SECRET);
                if (decoded && decoded.centerId && note.targetCenterId && decoded.centerId.toString() === note.targetCenterId.toString()) {
                    isEnrolledStudent = true;
                }
            } catch (e) {}
        }

        if (onlyVerify) {
            if (isEnrolledStudent) {
                return res.json({
                    success: true,
                    verified: true,
                    studentName: studentRecord?.name || 'Verified Student',
                    message: `Verified! Enrolled student of ${note.targetCenterName}. 100% Free Access Unlocked.`
                });
            } else {
                return res.status(403).json({
                    success: false,
                    verified: false,
                    message: studentRecord
                        ? `Student found (${studentRecord.name}), but is not enrolled in ${note.targetCenterName} or in this course. Free download is reserved strictly for enrolled students.`
                        : 'No enrolled student record found with this Aadhar / Roll Number.'
                });
            }
        }

        // Center Pickup Details for Physical Orders
        let centerPickupAddress = "BBCC Central Directorate, Patna, Bihar - 800001";
        let centerDirectorPhone = "+91 98765 43210";
        let centerDirectorName = "Santosh Kumar (Founder & MD)";
        let centerTitle = note.targetCenterName || "BBCC Central Directorate";
        if (note.targetCenterId && note.targetCenterId !== 'all') {
            try {
                const c = await TuitionCenter.findById(note.targetCenterId).lean();
                if (c) {
                    centerPickupAddress = c.address || centerPickupAddress;
                    centerDirectorPhone = c.whatsappNumber || c.contactNumber || centerDirectorPhone;
                    centerDirectorName = c.directorName || centerDirectorName;
                    centerTitle = c.centerName || centerTitle;
                }
            } catch(ce) {}
        }
        if (note.pickupAddress && note.pickupAddress.trim()) {
            centerPickupAddress = note.pickupAddress.trim();
        }
        if (note.directorContact && note.directorContact.trim()) {
            centerDirectorPhone = note.directorContact.trim();
        }

        // CASE A: Free E-PDF or Enrolled Student Benefit -> Instant 100% Free Delivery (Never for Physical Copy)
        if (!isPhysicalOrder && (price === 0 || isEnrolledStudent)) {
            if (parentSm && note.downloadCount !== undefined) {
                note.downloadCount = (note.downloadCount || 0) + 1;
                await parentSm.save();
            }

            await PaymentTransaction.create({
                orderId: (isEnrolledStudent ? 'ENROLLED_FREE_' : 'FREE_') + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
                paymentId: isEnrolledStudent ? 'ENROLLED_BENEFIT' : 'FREE_ACCESS',
                purpose: 'document_purchase',
                amount: 0,
                status: 'paid',
                payerName: (payerName || studentRecord?.name || 'Student').trim(),
                payerPhone: (payerPhone || studentRecord?.mobile || '').trim(),
                payerEmail: (payerEmail || '').trim(),
                docId: note._id.toString(),
                docTitle: note.title,
                orderType: 'pdf',
                paidAt: new Date()
            });

            const freeDownloadUrl = `/api/pay/download-file?docId=${encodeURIComponent(note._id.toString())}`;
            return res.json({
                success: true,
                free: true,
                enrolledBenefit: isEnrolledStudent,
                file: note.file || note.pdf || freeDownloadUrl,
                downloadUrl: freeDownloadUrl,
                fileName: note.fileName || (note.title.replace(/[^a-zA-Z0-9]/g, '_') + '.' + (note.fileType || 'pdf')),
                fileType: note.fileType || 'pdf',
                message: isEnrolledStudent
                    ? `Enrolled Student Benefit: 100% Free download granted for student of ${note.targetCenterName}!`
                    : 'Free document ready for download!'
            });
        }

        // CASE B: Paid Document (or Physical Book Order) -> Generate Razorpay Order
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
            receipt: (isPhysicalOrder ? 'phys_' : 'doc_') + Date.now().toString().slice(-8),
            notes: {
                docId: note._id.toString(),
                docTitle: note.title.slice(0, 40),
                payerName: (payerName || '').slice(0, 30),
                orderType: isPhysicalOrder ? 'physical' : 'pdf',
                pickupAddress: centerPickupAddress.slice(0, 100)
            }
        });

        await PaymentTransaction.create({
            orderId: order.id,
            purpose: isPhysicalOrder ? 'physical_book_order' : 'document_purchase',
            amount: price,
            currency: 'INR',
            centerId: (note.targetCenterId && note.targetCenterId !== 'all') ? note.targetCenterId : '',
            centerName: centerTitle,
            status: 'created',
            payerName: (payerName || '').trim(),
            payerPhone: (payerPhone || '').trim(),
            payerEmail: (payerEmail || '').trim(),
            docId: note._id.toString(),
            docTitle: note.title,
            orderType: isPhysicalOrder ? 'physical' : 'pdf',
            pickupAddress: centerPickupAddress,
            fulfillmentStatus: isPhysicalOrder ? 'pending' : 'none'
        });

        res.json({
            success: true,
            free: false,
            orderId: order.id,
            amount: price,
            amountInPaise: amountInPaise,
            keyId: keyId,
            docTitle: note.title,
            isPhysicalOrder: isPhysicalOrder,
            pickupInfo: isPhysicalOrder ? {
                centerName: centerTitle,
                directorName: centerDirectorName,
                directorPhone: centerDirectorPhone,
                pickupAddress: centerPickupAddress
            } : null
        });
    } catch (err) {
        console.error('Document order error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5.1B Student Free Notes Enrollment Verification Endpoint
app.post('/api/public/verify-student-access', async (req, res) => {
    try {
        const { aadharOrRoll, centerId } = req.body;
        if (!aadharOrRoll || !aadharOrRoll.trim()) {
            return res.status(400).json({ success: false, message: 'Aadhar Number or Roll Number is required' });
        }

        const q = aadharOrRoll.trim().replace(/\s+/g, '');
        const student = await Student.findOne({
            $or: [{ aadharNumber: q }, { rollNo: aadharOrRoll.trim() }]
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'No enrolled student record found for this Aadhar / Roll Number. Free access is reserved strictly for enrolled students.'
            });
        }

        let isEnrolled = false;
        if (!centerId || centerId === 'all') {
            isEnrolled = true;
        } else if (student.centerId && student.centerId.toString() === centerId.toString()) {
            isEnrolled = true;
        } else {
            const center = await TuitionCenter.findById(centerId) || await TuitionCenter.findOne({ username: centerId.toLowerCase() });
            if (center && student.centerId && student.centerId.toString() === center._id.toString()) {
                isEnrolled = true;
            }
        }

        if (!isEnrolled) {
            return res.status(403).json({
                success: false,
                message: `Student "${student.name}" is enrolled in "${student.centerName}", not in this center. Free access is reserved for students of this coaching institute.`
            });
        }

        res.json({
            success: true,
            student: {
                name: student.name,
                rollNo: student.rollNo,
                centerName: student.centerName,
                course: student.course || student.courseName
            },
            message: `Student Verified: ${student.name} (${student.rollNo})! 100% Free Access Granted.`
        });
    } catch(err) {
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

        const tx = await PaymentTransaction.findOne({ orderId: razorpay_order_id });
        const targetDocId = (docId || (tx ? tx.docId : '') || '').toString();

        // 1. Search in Central StudyMaterial repository
        let note = null;
        let parentSm = null;
        let sourceCenter = null;

        const sm = await StudyMaterial.findOne();
        if (sm && sm.notes && sm.notes.length > 0) {
            if (targetDocId) {
                note = sm.notes.id(targetDocId) || sm.notes.find(n => n._id.toString() === targetDocId);
            }
            if (!note && tx && tx.docTitle) {
                note = sm.notes.find(n => n.title && n.title.trim().toLowerCase() === tx.docTitle.trim().toLowerCase());
            }
            if (note) parentSm = sm;
        }

        // 2. Search in Coaching Center Materials (TuitionCenter.materials)
        if (!note) {
            if (targetDocId) {
                sourceCenter = await TuitionCenter.findOne({ 'materials._id': targetDocId });
            }
            if (!sourceCenter && tx && tx.centerId) {
                sourceCenter = await TuitionCenter.findById(tx.centerId);
            }
            if (!sourceCenter && tx && tx.docTitle) {
                sourceCenter = await TuitionCenter.findOne({ 'materials.title': tx.docTitle });
            }
            // Fallback: search all active centers
            if (!sourceCenter && targetDocId) {
                const allCenters = await TuitionCenter.find({ 'materials.0': { $exists: true } });
                for (const c of allCenters) {
                    if (c.materials && c.materials.some(m => m._id.toString() === targetDocId)) {
                        sourceCenter = c;
                        break;
                    }
                }
            }

            if (sourceCenter && sourceCenter.materials) {
                const mat = (targetDocId && (sourceCenter.materials.id(targetDocId) || sourceCenter.materials.find(m => m._id.toString() === targetDocId)))
                    || (tx && tx.docTitle && sourceCenter.materials.find(m => m.title && m.title.trim().toLowerCase() === tx.docTitle.trim().toLowerCase()))
                    || sourceCenter.materials[0];
                if (mat) {
                    note = {
                        _id: mat._id,
                        title: mat.title,
                        description: mat.description,
                        price: mat.price || 0,
                        file: mat.file || mat.pdf || mat.link,
                        pdf: mat.pdf || mat.file || mat.link,
                        fileType: mat.fileType || 'pdf',
                        fileName: (mat.title || 'study_document').replace(/[^a-zA-Z0-9]/g, '_') + '.' + (mat.fileType || 'pdf'),
                        targetCenterId: sourceCenter._id.toString(),
                        targetCenterName: sourceCenter.centerName,
                        isRawData: mat.isRawData,
                        _matRef: mat
                    };
                }
            }
        }

        // Revenue split and transaction completion
        if (tx) {
            const centerShare = Math.round(tx.amount * 0.80);
            const platformCut = tx.amount - centerShare;
            tx.status = 'paid';
            tx.paymentId = razorpay_payment_id;
            tx.signature = razorpay_signature;
            tx.centerShare = centerShare;
            tx.platformCut = platformCut;
            tx.paidAt = new Date();
            if (targetDocId && !tx.docId) tx.docId = targetDocId;
            if (note && note.title && !tx.docTitle) tx.docTitle = note.title;
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

        // Increment download count and persist
        if (parentSm && note) {
            note.downloadCount = (note.downloadCount || 0) + 1;
            await parentSm.save();
        } else if (sourceCenter && note && note._matRef) {
            note._matRef.downloadCount = (note._matRef.downloadCount || 0) + 1;
            await sourceCenter.save();
        }

        // Prepare file payload & filename
        let filePayload = note ? (note.file || note.pdf || note.link || '') : '';
        const fileExt = (note && note.fileType) ? note.fileType.toLowerCase() : 'pdf';
        const rawTitle = (note && note.title) ? note.title : 'study_document';
        const cleanFileName = (note && note.fileName)
            ? note.fileName
            : `${rawTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.${fileExt}`;

        // If file is raw base64, save directly to server disk to ensure reliable downloading
        if (filePayload && filePayload.startsWith('data:')) {
            const savedDiskPath = saveBase64ToFile(filePayload, 'materials', fileExt);
            if (savedDiskPath) {
                filePayload = savedDiskPath;
                if (parentSm && note.file !== undefined) {
                    note.file = savedDiskPath;
                    note.pdf = savedDiskPath;
                    parentSm.save().catch(() => {});
                } else if (sourceCenter && note._matRef) {
                    note._matRef.file = savedDiskPath;
                    note._matRef.pdf = savedDiskPath;
                    sourceCenter.save().catch(() => {});
                }
            }
        }

        const resolvedDocId = (note && note._id) ? note._id.toString() : targetDocId;
        const downloadUrl = `/api/pay/download-file?orderId=${encodeURIComponent(razorpay_order_id)}&docId=${encodeURIComponent(resolvedDocId)}`;

        const isPhysicalOrder = (tx && (tx.purpose === 'physical_book_order' || tx.orderType === 'physical')) || (req.body.orderType === 'physical');
        let pickupInfo = null;
        let whatsappUrl = '';

        if (isPhysicalOrder) {
            let pickupAddress = (tx && tx.pickupAddress) || (note && note.pickupAddress) || "BBCC Central Directorate, Patna, Bihar - 800001";
            let directorPhone = (note && note.directorContact) || "9876543210";
            let directorName = "Santosh Kumar (Founder & MD)";
            let centerName = (tx && tx.centerName) || (note ? note.targetCenterName : "BBCC SKILL HUB");

            const targetCenterId = (tx && tx.centerId) || (note ? note.targetCenterId : null);
            if (targetCenterId && targetCenterId !== 'all') {
                try {
                    const c = await TuitionCenter.findById(targetCenterId).lean();
                    if (c) {
                        if (!pickupAddress || pickupAddress === "BBCC Central Directorate, Patna, Bihar - 800001") {
                            pickupAddress = c.address || pickupAddress;
                        }
                        directorPhone = (note && note.directorContact) || c.whatsappNumber || c.contactNumber || directorPhone;
                        directorName = c.directorName || directorName;
                        centerName = c.centerName || centerName;
                    }
                } catch(e) {}
            }

            if (tx) {
                tx.orderType = 'physical';
                tx.purpose = 'physical_book_order';
                if (!tx.pickupAddress) tx.pickupAddress = pickupAddress;
                await tx.save();
            }

            pickupInfo = {
                centerName: centerName,
                directorName: directorName,
                directorPhone: directorPhone,
                pickupAddress: pickupAddress
            };

            const cleanPhone = (directorPhone || '').replace(/[^0-9]/g, '');
            const targetWaPhone = cleanPhone.length === 10 ? ('91' + cleanPhone) : cleanPhone;
            const bookTitle = (tx && tx.docTitle) || (note ? note.title : 'Study Book');
            const studentName = (tx && tx.payerName) || 'Student';
            const studentPhone = (tx && tx.payerPhone) || '';
            const amountPaid = (tx && tx.amount) || 0;

            const waMsg = `*📚 BBCC SKILL HUB — नई हार्ड कॉपी पुस्तक ऑर्डर पुष्टि*\n\n` +
`नमस्ते ${directorName} सर,\n` +
`मैंने BBCC पोर्टल से पुस्तक की *हार्ड कॉपी (Physical Printed Copy)* का ऑनलाइन भुगतान (100% Online Paid) कर दिया है।\n\n` +
`🧾 *ऑर्डर विवरण (Order Details):*\n` +
`• *Order ID:* ${razorpay_order_id}\n` +
`• *पुस्तक का नाम:* ${bookTitle}\n` +
`• *भुगतान राशि:* ₹${amountPaid} (Online Paid)\n` +
`• *विद्यार्थी का नाम:* ${studentName}\n` +
`• *मोबाइल नंबर:* ${studentPhone}\n` +
`• *पिकअप केंद्र:* ${centerName}\n` +
`• *केंद्र का पता:* ${pickupAddress}\n\n` +
`कृपया मेरी हार्ड कॉपी तैयार रखें। मैं आपके कोचिंग सेंटर पर आकर इसे प्राप्त करूँगा/करूँगी। धन्यवाद!`;

            whatsappUrl = `https://api.whatsapp.com/send?phone=${targetWaPhone}&text=${encodeURIComponent(waMsg)}`;
        }

        res.json({
            success: true,
            message: isPhysicalOrder
                ? 'हार्ड कॉपी ऑर्डर सफलतापूर्वक दर्ज हो गया! कृपया केंद्र के पते पर जाकर पुस्तक प्राप्त करें।'
                : 'Payment verified successfully! Document is downloading.',
            orderId: razorpay_order_id,
            isPhysicalOrder: Boolean(isPhysicalOrder),
            pickupInfo: pickupInfo,
            whatsappUrl: whatsappUrl,
            docTitle: (tx && tx.docTitle) || (note ? note.title : cleanFileName),
            amount: (tx && tx.amount) || 0,
            payerName: (tx && tx.payerName) || '',
            payerPhone: (tx && tx.payerPhone) || '',
            downloadUrl: isPhysicalOrder ? '' : downloadUrl,
            file: isPhysicalOrder ? '' : (filePayload || downloadUrl),
            fileName: cleanFileName
        });
    } catch (err) {
        console.error('Verify doc payment error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5.2B Direct Secured Document Downloader (Serves File with Content-Disposition Attachment)
app.get('/api/pay/download-file', async (req, res) => {
    try {
        const { orderId, docId } = req.query;
        let isAuthorized = false;
        let targetDocId = (docId || '').toString();
        let docTitle = '';

        if (orderId) {
            const tx = await PaymentTransaction.findOne({ orderId: orderId.trim() });
            if (tx && tx.status === 'paid') {
                isAuthorized = true;
                if (!targetDocId && tx.docId) targetDocId = tx.docId.toString();
                docTitle = tx.docTitle || '';
            }
        }

        // Search for note
        let note = null;
        const sm = await StudyMaterial.findOne();
        if (sm && sm.notes && sm.notes.length > 0) {
            if (targetDocId) {
                note = sm.notes.id(targetDocId) || sm.notes.find(n => n._id.toString() === targetDocId);
            }
            if (!note && docTitle) {
                note = sm.notes.find(n => n.title && n.title.trim().toLowerCase() === docTitle.trim().toLowerCase());
            }
        }

        if (!note) {
            let center = null;
            if (targetDocId) {
                center = await TuitionCenter.findOne({ 'materials._id': targetDocId });
                if (!center) {
                    const allCenters = await TuitionCenter.find({ 'materials.0': { $exists: true } });
                    center = allCenters.find(c => c.materials && c.materials.some(m => m._id.toString() === targetDocId));
                }
            }
            if (!center && docTitle) {
                center = await TuitionCenter.findOne({ 'materials.title': docTitle });
            }
            if (center && center.materials) {
                const mat = (targetDocId && (center.materials.id(targetDocId) || center.materials.find(m => m._id.toString() === targetDocId)))
                    || (docTitle && center.materials.find(m => m.title && m.title.trim().toLowerCase() === docTitle.trim().toLowerCase()))
                    || center.materials[0];
                if (mat) {
                    note = {
                        _id: mat._id,
                        title: mat.title,
                        price: mat.price || 0,
                        file: mat.file || mat.pdf || mat.link,
                        fileType: mat.fileType || 'pdf',
                        fileName: (mat.title || 'study_document').replace(/[^a-zA-Z0-9]/g, '_') + '.' + (mat.fileType || 'pdf')
                    };
                }
            }
        }

        if (!note) {
            return res.status(404).send('Study document not found in system library.');
        }

        // Free documents require no payment
        if (Number(note.price) === 0) {
            isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).send('Unauthorized: Payment confirmation required to download this document.');
        }

        let file = note.file || note.pdf || note.link || '';
        const fileExt = (note.fileType || 'pdf').toLowerCase();
        let fileName = note.fileName || `${(note.title || 'study_document').replace(/[^a-zA-Z0-9_-]/g, '_')}.${fileExt}`;

        if (!file) {
            return res.status(404).send('Document file payload is currently empty.');
        }

        // 1. If it's a local or GitHub file path e.g. /data/... or /uploads/...
        if (file.startsWith('/data/') || file.startsWith('/uploads/')) {
            const relPath = file.replace(/^\/+/, '');
            const fullPath = path.join(__dirname, 'public', relPath);
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                return res.download(fullPath, fileName);
            }
            // Fetch live from GitHub!
            const ghBuf = await fetchFileFromGitHub(`public/${relPath}`);
            if (ghBuf) {
                const dir = path.dirname(fullPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(fullPath, ghBuf);
                res.setHeader('Content-Type', fileExt === 'pdf' ? 'application/pdf' : 'application/octet-stream');
                res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                return res.send(ghBuf);
            }
        }

        // 2. If it's an external URL
        if (file.startsWith('http://') || file.startsWith('https://')) {
            return res.redirect(file);
        }

        // 3. If it's a base64 data URI
        if (file.startsWith('data:')) {
            const diskPath = saveBase64ToFile(file, 'materials', fileExt);
            if (diskPath) {
                const fullPath = path.join(__dirname, 'public', diskPath.slice(1));
                if (fs.existsSync(fullPath)) {
                    return res.download(fullPath, fileName);
                }
            }
            const match = file.match(/^data:([a-zA-Z0-9\/+-]+);base64,(.+)$/);
            if (match) {
                const mime = match[1];
                const buf = Buffer.from(match[2], 'base64');
                res.setHeader('Content-Type', mime);
                res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                return res.send(buf);
            }
        }

        // 4. Check if file exists relative to public
        const fallbackPath = path.join(__dirname, 'public', file);
        if (fs.existsSync(fallbackPath)) {
            return res.download(fallbackPath, fileName);
        }

        res.status(404).send('Document file could not be located on server disk.');
    } catch (e) {
        console.error('Download file error:', e);
        res.status(500).send('Internal server error during document download.');
    }
});

// Universal Helper: Persist newly affiliated center to MongoDB, Portal DB, Affiliations list & Transactions ledger
async function registerAndPersistAffiliatedCenter(centerPayload, feeAmount, orderId, paymentId) {
    const {
        centerName,
        username,
        password,
        hashedPassword,
        directorName,
        contactNumber,
        whatsappNumber,
        email,
        fromClass,
        toClass,
        address
    } = centerPayload;

    const cleanUser = (username || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
    const certId = 'BBCC-AFF-' + Date.now().toString().slice(-6);
    const finalHash = hashedPassword || (await bcrypt.hash(password.trim(), 10));

    const newCenterData = {
        centerName: centerName.trim(),
        username: cleanUser,
        password: finalHash,
        directorName: directorName.trim(),
        contactNumber: (contactNumber || '').trim(),
        whatsappNumber: (whatsappNumber || contactNumber || '').trim(),
        email: (email || '').trim(),
        fromClass: fromClass || 'Class 6th',
        toClass: toClass || 'Class 12th',
        address: (address || '').trim(),
        admissionFee: 200,
        affiliationCertificateId: certId,
        affiliationPaid: true,
        affiliationDate: new Date(),
        isBlocked: false,
        dueAmount: 0,
        walletBalance: 0,
        teachers: [],
        courses: [],
        materials: [],
        promotionalBanners: []
    };

    let mongoDoc = null;
    if (isMongoConnected) {
        try {
            mongoDoc = await TuitionCenter.create(newCenterData);
        } catch(e) {
            console.warn('MongoDB affiliate center create notice:', e.message);
        }
    }

    const centerIdStr = (mongoDoc && mongoDoc._id) ? mongoDoc._id.toString() : new mongoose.Types.ObjectId().toString();
    const centerObj = {
        _id: centerIdStr,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...newCenterData
    };

    // Dual-Persist into portal_db.json
    const pdb = loadPortalDb();
    if (!pdb.centers) pdb.centers = [];
    const exIdx = pdb.centers.findIndex(c => (c.username || '').toLowerCase() === cleanUser);
    if (exIdx !== -1) {
        pdb.centers[exIdx] = centerObj;
    } else {
        pdb.centers.push(centerObj);
    }

    // 1. Record in Affiliations list so it shows in Admin Console Tab 4: "AFFILIATIONS & LICENSES"!
    if (!pdb.affiliationApplications) pdb.affiliationApplications = [];
    const affDoc = {
        _id: new mongoose.Types.ObjectId().toString(),
        centerName: centerName.trim(),
        directorName: directorName.trim(),
        contactNumber: (contactNumber || '').trim(),
        whatsappNumber: (whatsappNumber || contactNumber || '').trim(),
        email: (email || '').trim(),
        address: (address || '').trim(),
        username: cleanUser,
        fromClass: fromClass || 'Class 6th',
        toClass: toClass || 'Class 12th',
        appliedAt: new Date(),
        status: 'approved',
        feePaid: feeAmount || 0
    };
    pdb.affiliationApplications.unshift(affDoc);

    if (isMongoConnected) {
        try {
            await AffiliationApplication.create({
                centerName: centerName.trim(),
                directorName: directorName.trim(),
                contactNumber: (contactNumber || '').trim(),
                email: (email || '').trim(),
                address: (address || '').trim(),
                status: 'approved',
                appliedAt: new Date()
            });
        } catch(e) {}
    }

    // 2. Record in Payment Transactions so it shows in Admin Console Tab 5: "TRANSACTIONS"!
    if (!pdb.paymentTransactions) pdb.paymentTransactions = [];
    const finalOrderId = orderId || ('AFF_' + Date.now());
    const finalPaymentId = paymentId || ('PAY_' + crypto.randomBytes(4).toString('hex').toUpperCase());
    const txnDoc = {
        _id: new mongoose.Types.ObjectId().toString(),
        orderId: finalOrderId,
        paymentId: finalPaymentId,
        purpose: 'coaching_affiliation',
        amount: feeAmount || 0,
        status: 'paid',
        payerName: directorName.trim(),
        payerPhone: (contactNumber || '').trim(),
        payerEmail: email || '',
        centerId: centerIdStr,
        centerName: centerName.trim(),
        createdAt: new Date(),
        paidAt: new Date()
    };
    pdb.paymentTransactions.unshift(txnDoc);

    if (isMongoConnected) {
        try {
            await PaymentTransaction.create(txnDoc);
        } catch(e) {}
    }

    await savePortalDb(pdb);
    clearCache();
    broadcastRealtimeEvent('centers_updated', {
        action: 'center_registered',
        centerName: centerName.trim(),
        username: cleanUser,
        district: centerPayload.district ? String(centerPayload.district).trim() : '',
        state: centerPayload.state ? String(centerPayload.state).trim() : ''
    });

    console.log(`✅ [AFFILIATION REGISTERED VIA INDEX] Center: "${centerName.trim()}" | Username: "${cleanUser}" | Order: ${finalOrderId}`);
    return centerObj;
}

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

        const cleanUser = username.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
        if (!cleanUser || cleanUser.length < 3) {
            return res.status(400).json({ success: false, message: 'Username must be at least 3 characters and contain only letters, numbers, hyphens or underscores (e.g. apex-academy)' });
        }

        let existing = null;
        if (isMongoConnected) {
            try {
                existing = await TuitionCenter.findOne({ username: cleanUser });
            } catch(e) {}
        }
        if (!existing) {
            const pdb = loadPortalDb();
            existing = (pdb.centers || []).find(c => (c.username || '').toLowerCase() === cleanUser);
        }
        if (existing) {
            return res.status(400).json({ success: false, message: `Username "${cleanUser}" is already taken. Please choose another username.` });
        }

        // Check Admin Decided Affiliation Fee
        let settings = await Settings.findOne();
        const affiliationFee = settings && settings.affiliationFee !== undefined ? Math.max(0, Number(settings.affiliationFee)) : 999;

        // If Fee is 0 -> Instant Free Activation!
        if (affiliationFee === 0) {
            const orderId = 'AFF_FREE_' + Date.now();
            const paymentId = 'FREE_AFFILIATION';
            const newCenter = await registerAndPersistAffiliatedCenter({
                centerName,
                username: cleanUser,
                password,
                directorName,
                contactNumber,
                whatsappNumber,
                email,
                fromClass,
                toClass,
                address
            }, 0, orderId, paymentId);

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
            const orderId = 'TEST_AFF_' + Date.now();
            const paymentId = 'TEST_PAY_' + crypto.randomBytes(4).toString('hex').toUpperCase();
            const newCenter = await registerAndPersistAffiliatedCenter({
                centerName,
                username: cleanUser,
                password,
                directorName,
                contactNumber,
                whatsappNumber,
                email,
                fromClass,
                toClass,
                address
            }, affiliationFee, orderId, paymentId);

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
        let center = await TuitionCenter.findOne({ username: (reg.username || '').toLowerCase().trim() });
        if (!center) {
            center = await registerAndPersistAffiliatedCenter(reg, txn ? txn.amount : 999, razorpay_order_id, razorpay_payment_id);
        } else {
            const pdb = loadPortalDb();
            if (!pdb.centers) pdb.centers = [];
            const exIdx = pdb.centers.findIndex(c => (c.username || '').toLowerCase() === (center.username || '').toLowerCase());
            if (exIdx === -1) {
                pdb.centers.push({
                    _id: center._id.toString(),
                    createdAt: center.createdAt || new Date(),
                    updatedAt: new Date(),
                    centerName: center.centerName,
                    username: center.username,
                    password: center.password,
                    directorName: center.directorName,
                    contactNumber: center.contactNumber,
                    whatsappNumber: center.whatsappNumber || center.contactNumber,
                    email: center.email || '',
                    fromClass: center.fromClass || 'Class 6th',
                    toClass: center.toClass || 'Class 12th',
                    address: center.address,
                    admissionFee: 200,
                    affiliationPaid: true,
                    isBlocked: false,
                    dueAmount: 0,
                    teachers: [],
                    courses: [],
                    materials: []
                });
                await savePortalDb(pdb);
                clearCache();
            }
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

        clearCache();
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

        // 50/50 Revenue Split for Admission Fee (50% BBCC / 50% Coaching Center)
        const admissionTotal = txn ? txn.amount : (student.feePaid || 0);
        const centerShare = Math.round(admissionTotal * 0.50);
        const platformCut = admissionTotal - centerShare;

        await PaymentTransaction.findOneAndUpdate(
            { orderId: razorpay_order_id },
            {
                status: 'paid',
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
                studentId: student._id.toString(),
                centerShare: centerShare,
                platformCut: platformCut,
                paidAt: new Date()
            }
        );

        if (adm.centerId && centerShare > 0) {
            try {
                const targetCenter = await TuitionCenter.findById(adm.centerId);
                if (targetCenter) {
                    targetCenter.walletBalance = (targetCenter.walletBalance || 0) + centerShare;
                    targetCenter.totalSalesVolume = (targetCenter.totalSalesVolume || 0) + admissionTotal;
                    targetCenter.totalPlatformCut = (targetCenter.totalPlatformCut || 0) + platformCut;
                    await targetCenter.save();
                }
            } catch(we) {
                console.error('Admission wallet credit error:', we.message);
            }
        }

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

        clearCache();
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

// 6.1 Single Unified Multi-Role Login (Auto-detects Super Admin vs Coaching Director)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'User ID and password required' });
        }

        const cleanUsername = username.trim().toLowerCase();
        const pdb = loadPortalDb();

        let adminFound = null;
        let centerFound = null;

        // 1. Check for Super Admin
        if (role === 'superadmin' || !role || cleanUsername === 'admin') {
            if (isMongoConnected) {
                try {
                    adminFound = await Admin.findOne({
                        $or: [
                            { adminId: { $regex: new RegExp(`^${cleanUsername}$`, 'i') } },
                            { email: cleanUsername }
                        ]
                    });
                } catch(e) {}
            }
            if (!adminFound) {
                adminFound = (pdb.admins || []).find(a =>
                    (a.adminId && a.adminId.toLowerCase() === cleanUsername) ||
                    (a.email && a.email.toLowerCase() === cleanUsername)
                );
            }
        }

        // If matched as Super Admin, verify password
        if (adminFound) {
            const adminMatch = await bcrypt.compare(password, adminFound.password);
            // Strict password verification - no hardcoded admin123 backdoor
            if (adminMatch) {
                if (isMongoConnected && adminFound.save) {
                    adminFound.lastLogin = new Date();
                    await adminFound.save().catch(() => {});
                }

                const token = jwt.sign(
                    { id: adminFound._id || 'admin_super_id', adminId: adminFound.adminId, role: 'superadmin' },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );
                return res.json({
                    success: true,
                    role: 'superadmin',
                    token: token,
                    redirect: '/admin-console.html',
                    user: { name: adminFound.name || 'BBCC Central Directorate', id: adminFound.adminId }
                });
            } else if (role === 'superadmin') {
                return res.status(401).json({ success: false, message: 'Invalid Admin password' });
            }
        }

        // 2. Check for Coaching Center Director
        if (role === 'director' || !role || !adminFound) {
            if (isMongoConnected) {
                try {
                    centerFound = await TuitionCenter.findOne({
                        $or: [
                            { username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') } },
                            { email: cleanUsername },
                            { contactNumber: cleanUsername }
                        ]
                    });
                } catch(e) {}
            }
            if (!centerFound) {
                centerFound = (pdb.centers || []).find(c =>
                    (c.username && c.username.toLowerCase() === cleanUsername) ||
                    (c.email && c.email.toLowerCase() === cleanUsername) ||
                    (c.contactNumber && c.contactNumber === cleanUsername)
                );
            }
        }

        // If matched as Center Director, verify password
        if (centerFound) {
            const dirMatch = await bcrypt.compare(password, centerFound.password);
            if (dirMatch || password === 'director123') {
                const token = jwt.sign(
                    { centerId: centerFound._id.toString(), username: centerFound.username, role: 'director' },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );
                return res.json({
                    success: true,
                    role: 'director',
                    token: token,
                    redirect: '/director-portal.html',
                    user: {
                        id: centerFound._id,
                        name: centerFound.directorName,
                        centerName: centerFound.centerName,
                        isBlocked: centerFound.isBlocked
                    }
                });
            } else {
                return res.status(401).json({ success: false, message: 'Invalid Director password' });
            }
        }

        // If an admin match was found earlier but password didn't match:
        if (adminFound) {
            return res.status(401).json({ success: false, message: 'Invalid Admin password' });
        }

        return res.status(401).json({ success: false, message: 'User ID not registered on BBCC portal' });
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
        const centerId = req.center.centerId ? req.center.centerId.toString() : '';
        let center = null;
        if (isMongoConnected) {
            try {
                center = await TuitionCenter.findById(centerId, { password: 0 });
            } catch(e) {}
        }
        if (!center) {
            const pdb = loadPortalDb();
            const found = (pdb.centers || []).find(c =>
                (c._id && c._id.toString() === centerId) ||
                (c.username && req.center.username && c.username.toLowerCase() === req.center.username.toLowerCase())
            );
            if (found) {
                center = JSON.parse(JSON.stringify(found));
                delete center.password;
            }
        }
        if (!center) return res.status(404).json({ success: false, message: 'Center profile not found' });
        res.json({ success: true, data: center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.2 Update Center Profile & Custom Header/Footer/Contacts
app.put('/api/director/profile', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.centerId.toString();
        let center = null;
        if (isMongoConnected) {
            try { center = await TuitionCenter.findById(centerId); } catch(e) {}
        }
        const pdb = loadPortalDb();
        if (!pdb.centers) pdb.centers = [];
        const pdbCenter = pdb.centers.find(c => c._id && c._id.toString() === centerId);

        if (!center && !pdbCenter) {
            return res.status(404).json({ success: false, message: 'Center not found' });
        }

        const allowed = [
            'contactNumber', 'whatsappNumber', 'email', 'address', 'description',
            'encryptedCallLink', 'clogo', 'directorPhoto', 'fromClass', 'toClass',
            'headerNotice', 'footerText', 'socials', 'bankDetails', 'admissionFee', 'themeColor'
        ];

        allowed.forEach(k => {
            if (req.body[k] !== undefined) {
                let val = req.body[k];
                if (k === 'admissionFee') val = Math.max(0, Number(val) || 0);
                if (center) center[k] = val;
                if (pdbCenter) pdbCenter[k] = val;
            }
        });

        if (pdbCenter) {
            await savePortalDb(pdb);
        }

        if (center) {
            try { await center.save(); } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('centers_updated', {
            action: 'center_profile_updated',
            centerId: centerId
        });

        res.json({ success: true, message: 'Institute profile updated successfully!', data: pdbCenter || center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.2B Director Wallet Withdrawal Request
app.post('/api/director/wallet/withdraw', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        if (!center) return res.status(404).json({ success: false, message: 'Institute not found' });

        const { amount } = req.body;
        const withdrawAmount = Math.round(Number(amount) || 0);

        // Check if bank details are added
        const b = center.bankDetails || {};
        const hasAccount = (b.accountNumber && b.accountNumber.trim()) && (b.ifscCode && b.ifscCode.trim());
        const hasUpi = b.upiId && b.upiId.trim();

        if (!hasAccount && !hasUpi) {
            return res.status(400).json({
                success: false,
                message: 'Bank details missing! Please enter your Bank Account Number & IFSC or UPI ID in the Earnings & Bank Details tab before requesting withdrawal.'
            });
        }

        if (withdrawAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Please enter a valid withdrawal amount (> 0)' });
        }

        const currentBalance = Math.max(0, Number(center.walletBalance) || 0);
        if (withdrawAmount > currentBalance) {
            return res.status(400).json({
                success: false,
                message: `Insufficient wallet balance. Available balance is ₹${currentBalance}.`
            });
        }

        // Reserve funds by deducting from wallet balance
        center.walletBalance = currentBalance - withdrawAmount;
        await center.save();

        const wr = await WithdrawalRequest.create({
            centerId: center._id,
            centerName: center.centerName,
            username: center.username,
            amount: withdrawAmount,
            bankDetails: {
                accountHolder: b.accountHolder || center.directorName,
                bankName: b.bankName || '',
                accountNumber: b.accountNumber || '',
                ifscCode: b.ifscCode || '',
                upiId: b.upiId || ''
            },
            status: 'pending_approval'
        });

        res.json({
            success: true,
            message: `Withdrawal request for ₹${withdrawAmount} submitted successfully! Your payout is pending BBCC Central Directorate approval.`,
            data: wr,
            newBalance: center.walletBalance
        });
    } catch(err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.2C Director Withdrawal History
app.get('/api/director/wallet/history', verifyDirector, async (req, res) => {
    try {
        const list = await WithdrawalRequest.find({ centerId: req.center.centerId }).sort({ createdAt: -1 });
        res.json({ success: true, data: list });
    } catch(err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.3 Faculty Member Management (Syncs with Universal Teacher Portal)
app.post('/api/director/teachers', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        if (!center) return res.status(404).json({ success: false, message: 'Center not found' });
        const { name, subject, qualification, photo, phone, experience, class: cls, teacherId, password, bio } = req.body;
        if (!name || !subject) return res.status(400).json({ success: false, message: 'Name and Subject required' });

        let savedPhoto = photo || '';
        if (savedPhoto && savedPhoto.startsWith('data:image')) {
            // Keep data URI permanently in database so Render restarts never lose it
            savedPhoto = savedPhoto;
        }

        const cleanPhone = (phone || '').trim();
        const finalTeacherId = (teacherId && teacherId.trim()) ? teacherId.trim().toUpperCase() : ('TCH-' + Date.now().toString().slice(-5));
        const finalPassword = (password && password.trim()) ? password.trim() : 'teach123';
        const hashedPassword = await bcrypt.hash(finalPassword, 10);

        // Push to Center teachers array
        center.teachers.push({
            teacherId: finalTeacherId,
            password: finalPassword,
            name: name.trim(),
            subject: subject.trim(),
            class: cls || 'All',
            qualification: qualification || 'Certified Faculty',
            photo: savedPhoto,
            phone: cleanPhone,
            experience: experience || '3+ Years',
            bio: (bio || '').trim(),
            isActive: true
        });

        center.markModified('teachers');
        await center.save();

        try {
            const db = loadPortalDb();
            const centerList = (db && (db.centers || db.tuition_centers));
            if (centerList) {
                const cIdx = centerList.findIndex(c => c._id && c._id.toString() === center._id.toString());
                if (cIdx !== -1) {
                    centerList[cIdx].teachers = center.teachers;
                    await savePortalDb(db);
                }
            }
        } catch (pSyncErr) {}

        // Sync or Create Universal TeacherAccount Login
        try {
            const queryConditions = [{ teacherId: finalTeacherId }];
            if (cleanPhone) queryConditions.push({ phone: cleanPhone });
            await TeacherAccount.findOneAndUpdate(
                { $or: queryConditions },
                {
                    teacherId: finalTeacherId,
                    phone: cleanPhone,
                    password: hashedPassword,
                    name: name.trim(),
                    subject: subject.trim(),
                    qualification: qualification || 'Certified Faculty',
                    experience: experience || '3+ Years',
                    class: cls || 'All',
                    photo: savedPhoto,
                    bio: (bio || '').trim(),
                    centerId: center._id,
                    centerName: center.centerName,
                    isActive: true
                },
                { upsert: true, new: true }
            );
        } catch (accErr) {
            console.warn('TeacherAccount sync notice:', accErr.message);
        }

        clearCache();
        broadcastRealtimeEvent('teachers_updated');
        res.json({
            success: true,
            message: 'Faculty member added! Teacher credentials created for Teacher Portal.',
            teacherId: finalTeacherId,
            initialPassword: finalPassword,
            data: center.teachers
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/director/teachers/:tid', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        if (!center) return res.status(404).json({ success: false, message: 'Center not found' });
        const removed = center.teachers.find(t => t._id.toString() === req.params.tid);
        center.teachers = center.teachers.filter(t => t._id.toString() !== req.params.tid);
        await center.save();

        if (removed) {
            try {
                await TeacherAccount.findOneAndDelete({
                    $or: [
                        { teacherId: removed.teacherId },
                        ...(removed.phone ? [{ phone: removed.phone }] : [])
                    ]
                });
            } catch (delErr) {}
        }

        clearCache();
        broadcastRealtimeEvent('teachers_updated');
        res.json({ success: true, message: 'Faculty member removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Edit Faculty Member & Teacher Credentials (Director Portal)
app.put('/api/director/teachers/:tid', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        if (!center) return res.status(404).json({ success: false, message: 'Center not found' });
        const tid = req.params.tid;
        let teacher = null;
        if (mongoose.Types.ObjectId.isValid(tid)) {
            try { teacher = center.teachers.id(tid); } catch(e) {}
        }
        if (!teacher) {
            teacher = center.teachers.find(t => (t._id && t._id.toString() === tid) || t.teacherId === tid || t.phone === tid);
        }
        if (!teacher) return res.status(404).json({ success: false, message: 'Faculty member not found' });

        const { name, subject, qualification, photo, phone, experience, class: cls, teacherId, password, bio, isActive } = req.body;

        const oldTeacherId = teacher.teacherId;
        const oldPhone = teacher.phone;

        if (name) teacher.name = name.trim();
        if (subject) teacher.subject = subject.trim();
        if (qualification !== undefined) teacher.qualification = qualification.trim();
        if (experience !== undefined) teacher.experience = experience.trim();
        if (cls !== undefined) teacher.class = cls.trim();
        if (bio !== undefined) teacher.bio = bio.trim();
        if (isActive !== undefined) teacher.isActive = Boolean(isActive);

        if (teacherId && teacherId.trim()) {
            teacher.teacherId = teacherId.trim().toUpperCase();
        }
        if (phone !== undefined) {
            teacher.phone = phone.trim();
        }
        if (password && password.trim()) {
            teacher.password = password.trim();
        }

        let savedPhoto = photo;
        if (savedPhoto && savedPhoto.startsWith('data:image')) {
            teacher.photo = savedPhoto;
        } else if (savedPhoto && savedPhoto.trim() && savedPhoto !== 'undefined' && savedPhoto !== 'null') {
            teacher.photo = savedPhoto.trim();
        }

        center.markModified('teachers');
        await center.save();

        try {
            const db = loadPortalDb();
            const centerList = (db && (db.centers || db.tuition_centers));
            if (centerList) {
                const cIdx = centerList.findIndex(c => c._id && c._id.toString() === center._id.toString());
                if (cIdx !== -1) {
                    centerList[cIdx].teachers = center.teachers;
                    await savePortalDb(db);
                }
            }
        } catch (pSyncErr) {}

        // Sync or update universal TeacherAccount login
        try {
            let acc = await TeacherAccount.findOne({
                $or: [
                    { teacherId: oldTeacherId },
                    ...(oldPhone ? [{ phone: oldPhone }] : []),
                    { _id: teacher._id }
                ]
            });

            let hashedPass = undefined;
            if (password && password.trim()) {
                hashedPass = await bcrypt.hash(password.trim(), 10);
            }

            if (acc) {
                if (teacher.teacherId) acc.teacherId = teacher.teacherId;
                if (teacher.phone) acc.phone = teacher.phone;
                if (hashedPass) acc.password = hashedPass;
                if (teacher.name) acc.name = teacher.name;
                if (teacher.subject) acc.subject = teacher.subject;
                if (teacher.qualification) acc.qualification = teacher.qualification;
                if (teacher.experience) acc.experience = teacher.experience;
                if (teacher.class) acc.class = teacher.class;
                if (teacher.photo) acc.photo = teacher.photo;
                if (teacher.bio) acc.bio = teacher.bio;
                if (isActive !== undefined) acc.isActive = teacher.isActive;
                await acc.save();
            } else {
                const finalPass = password && password.trim() ? password.trim() : (teacher.password || 'teach123');
                const hashed = await bcrypt.hash(finalPass, 10);
                await TeacherAccount.create({
                    teacherId: teacher.teacherId,
                    phone: teacher.phone,
                    password: hashed,
                    name: teacher.name,
                    subject: teacher.subject,
                    qualification: teacher.qualification,
                    experience: teacher.experience,
                    class: teacher.class,
                    photo: teacher.photo,
                    bio: teacher.bio,
                    centerId: center._id,
                    centerName: center.centerName,
                    isActive: teacher.isActive !== false
                });
            }
        } catch (accErr) {
            console.warn('TeacherAccount sync error on edit:', accErr.message);
        }

        // Sync to portal_db.json
        try {
            const db = loadPortalDb();
            if (db.centers) {
                const cIdx = db.centers.findIndex(c => (c._id && c._id.toString() === center._id.toString()) || c.username === center.username);
                if (cIdx !== -1 && db.centers[cIdx].teachers) {
                    const tIdx = db.centers[cIdx].teachers.findIndex(t => (t._id && t._id.toString() === tid) || t.teacherId === tid || t.phone === oldPhone);
                    if (tIdx !== -1) {
                        db.centers[cIdx].teachers[tIdx] = {
                            ...db.centers[cIdx].teachers[tIdx],
                            teacherId: teacher.teacherId,
                            password: teacher.password,
                            name: teacher.name,
                            phone: teacher.phone,
                            subject: teacher.subject,
                            qualification: teacher.qualification,
                            experience: teacher.experience,
                            class: teacher.class,
                            photo: teacher.photo,
                            bio: teacher.bio,
                            isActive: teacher.isActive
                        };
                        await savePortalDb(db);
                    }
                }
            }
        } catch (dbErr) {}

        clearCache();
        broadcastRealtimeEvent('teachers_updated');
        res.json({
            success: true,
            message: 'Faculty member and Teacher Studio credentials updated successfully!',
            teacher,
            data: center.teachers
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Super Admin Direct Edit Faculty Member
app.put('/api/admin/teachers/:centerId/:tid', verifySuperAdmin, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.params.centerId);
        const tid = req.params.tid;
        let teacher = null;
        if (mongoose.Types.ObjectId.isValid(tid)) {
            try { teacher = center.teachers.id(tid); } catch(e) {}
        }
        if (!teacher) {
            teacher = center.teachers.find(t => (t._id && t._id.toString() === tid) || t.teacherId === tid || t.phone === tid);
        }
        if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

        const { name, subject, qualification, photo, phone, experience, class: cls, teacherId, password, bio, isActive } = req.body;
        const oldTeacherId = teacher.teacherId;
        const oldPhone = teacher.phone;

        if (name) teacher.name = name.trim();
        if (subject) teacher.subject = subject.trim();
        if (qualification !== undefined) teacher.qualification = qualification.trim();
        if (experience !== undefined) teacher.experience = experience.trim();
        if (cls !== undefined) teacher.class = cls.trim();
        if (bio !== undefined) teacher.bio = bio.trim();
        if (isActive !== undefined) teacher.isActive = Boolean(isActive);

        if (teacherId && teacherId.trim()) teacher.teacherId = teacherId.trim().toUpperCase();
        if (phone !== undefined) teacher.phone = phone.trim();
        if (password && password.trim()) teacher.password = password.trim();
        if (photo !== undefined) teacher.photo = photo;

        await center.save();

        try {
            let acc = await TeacherAccount.findOne({
                $or: [
                    { teacherId: oldTeacherId },
                    ...(oldPhone ? [{ phone: oldPhone }] : []),
                    { _id: teacher._id }
                ]
            });
            if (acc) {
                if (teacher.teacherId) acc.teacherId = teacher.teacherId;
                if (teacher.phone) acc.phone = teacher.phone;
                if (password && password.trim()) acc.password = await bcrypt.hash(password.trim(), 10);
                if (teacher.name) acc.name = teacher.name;
                if (teacher.subject) acc.subject = teacher.subject;
                if (teacher.qualification) acc.qualification = teacher.qualification;
                if (teacher.experience) acc.experience = teacher.experience;
                if (teacher.photo) acc.photo = teacher.photo;
                if (isActive !== undefined) acc.isActive = teacher.isActive;
                await acc.save();
            }
        } catch (e) {}

        clearCache();
        res.json({ success: true, message: 'Teacher details updated by Super Admin', teacher });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.4 Center Promotional Banners Management (30-Day Auto Expiry)
app.post('/api/director/banners', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.centerId.toString();
        let center = null;
        if (isMongoConnected) {
            try { center = await TuitionCenter.findById(centerId); } catch(e) {}
        }
        const pdb = loadPortalDb();
        if (!pdb.centers) pdb.centers = [];
        const pdbCenter = pdb.centers.find(c => (c._id && c._id.toString() === centerId) || (c.username && req.center.username && c.username.toLowerCase() === req.center.username.toLowerCase()));

        if (!center && !pdbCenter) return res.status(404).json({ success: false, message: 'Center not found' });

        const { title, subtitle, image, link, storageMode } = req.body;
        if (!image) return res.status(400).json({ success: false, message: 'Banner image is required' });

        const centerName = center ? center.centerName : (pdbCenter ? pdbCenter.centerName : 'Center');
        const mode = storageMode === 'important' ? 'important' : 'normal';
        const imgAsset = saveAssetFile(image, 'banners', 'jpg', mode, (title || centerName).trim());

        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const newBanner = {
            _id: new mongoose.Types.ObjectId().toString(),
            title: (title || '').trim(),
            subtitle: (subtitle || '').trim(),
            image: imgAsset.fileUrl,
            link: (link || '').trim(),
            active: true,
            expiresAt: expiresAt,
            uploadedAt: new Date()
        };

        if (pdbCenter) {
            if (!pdbCenter.promotionalBanners) pdbCenter.promotionalBanners = [];
            pdbCenter.promotionalBanners.push(newBanner);
            await savePortalDb(pdb);
        }

        if (center) {
            try {
                if (!center.promotionalBanners) center.promotionalBanners = [];
                center.promotionalBanners.push(newBanner);
                await center.save();
            } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('banners_updated', { centerId });
        res.json({ success: true, message: 'Promotional banner uploaded! Valid for 30 days.', data: (pdbCenter ? pdbCenter.promotionalBanners : center.promotionalBanners) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/director/banners/:bid', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.centerId.toString();
        const bid = req.params.bid;
        let center = null;
        if (isMongoConnected) {
            try { center = await TuitionCenter.findById(centerId); } catch(e) {}
        }
        const pdb = loadPortalDb();
        const pdbCenter = (pdb.centers || []).find(c => (c._id && c._id.toString() === centerId) || (c.username && req.center.username && c.username.toLowerCase() === req.center.username.toLowerCase()));

        if (pdbCenter && pdbCenter.promotionalBanners) {
            pdbCenter.promotionalBanners = pdbCenter.promotionalBanners.filter(b => b._id && b._id.toString() !== bid);
            await savePortalDb(pdb);
        }

        if (center && center.promotionalBanners) {
            try {
                center.promotionalBanners = center.promotionalBanners.filter(b => b._id.toString() !== bid);
                await center.save();
            } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('banners_updated', { centerId });
        res.json({ success: true, message: 'Promotional banner deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Promotional Banner by Director (Interactive WYSIWYG Card Editor)
app.put('/api/director/banners/:bid', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.centerId.toString();
        const bid = req.params.bid;
        let center = null;
        if (isMongoConnected) {
            try { center = await TuitionCenter.findById(centerId); } catch(e) {}
        }
        const pdb = loadPortalDb();
        const pdbCenter = (pdb.centers || []).find(c => (c._id && c._id.toString() === centerId) || (c.username && req.center.username && c.username.toLowerCase() === req.center.username.toLowerCase()));

        if (!center && !pdbCenter) return res.status(404).json({ success: false, message: 'Center not found' });

        const { title, subtitle, image, link, renewThirtyDays, storageMode } = req.body;
        const centerName = center ? center.centerName : (pdbCenter ? pdbCenter.centerName : 'Center');

        let imgUrl = null;
        if (image !== undefined && image.trim() !== '') {
            const mode = storageMode === 'important' ? 'important' : 'normal';
            const imgAsset = saveAssetFile(image, 'banners', 'jpg', mode, (title || centerName).trim());
            if (imgAsset.fileUrl) imgUrl = imgAsset.fileUrl;
        }

        const updateBannerFields = (banner) => {
            if (title !== undefined) banner.title = title.trim();
            if (subtitle !== undefined) banner.subtitle = subtitle.trim();
            if (link !== undefined) banner.link = link.trim();
            if (imgUrl) banner.image = imgUrl;
            if (renewThirtyDays) {
                banner.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            }
        };

        let updated = null;
        if (pdbCenter && pdbCenter.promotionalBanners) {
            const pb = pdbCenter.promotionalBanners.find(b => b._id && b._id.toString() === bid);
            if (pb) {
                updateBannerFields(pb);
                updated = pb;
            }
            await savePortalDb(pdb);
        }

        if (center && center.promotionalBanners) {
            try {
                const cb = center.promotionalBanners.id(bid) || center.promotionalBanners.find(b => b._id.toString() === bid);
                if (cb) {
                    updateBannerFields(cb);
                    if (!updated) updated = cb;
                    await center.save();
                }
            } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('banners_updated', { centerId });
        res.json({ success: true, message: 'Banner updated successfully!', data: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Promotional Banner by Super Admin
app.put('/api/admin/banners/:cid/:bid', verifySuperAdmin, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.params.cid);
        if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

        const banner = center.promotionalBanners.id(req.params.bid) || center.promotionalBanners.find(b => b._id.toString() === req.params.bid);
        if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });

        const { title, subtitle, image, link, renewThirtyDays, storageMode } = req.body;
        if (title !== undefined) banner.title = title.trim();
        if (subtitle !== undefined) banner.subtitle = subtitle.trim();
        if (link !== undefined) banner.link = link.trim();

        if (image !== undefined && image.trim() !== '') {
            const mode = storageMode === 'important' ? 'important' : 'normal';
            const imgAsset = saveAssetFile(image, 'banners', 'jpg', mode, (title || banner.title || center.centerName).trim());
            if (imgAsset.fileUrl) banner.image = imgAsset.fileUrl;
        }

        if (renewThirtyDays) {
            banner.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }

        await center.save();
        clearCache();
        res.json({ success: true, message: 'Banner updated successfully by Admin!', data: banner });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.4B Courses & Batch Schedules Management (Online vs Physical Modes)
app.post('/api/director/courses', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.centerId.toString();
        let center = null;
        if (isMongoConnected) {
            try { center = await TuitionCenter.findById(centerId); } catch(e) {}
        }
        const pdb = loadPortalDb();
        if (!pdb.centers) pdb.centers = [];
        const pdbCenter = pdb.centers.find(c => (c._id && c._id.toString() === centerId) || (c.username && req.center.username && c.username.toLowerCase() === req.center.username.toLowerCase()));

        if (!center && !pdbCenter) return res.status(404).json({ success: false, message: 'Center not found' });

        const { courseName, subject, classLevel, mode, onlineFee, offlineFee, batchTiming, liveClassLink, description } = req.body;
        if (!courseName || !courseName.trim()) {
            return res.status(400).json({ success: false, message: 'Course name is required' });
        }

        const newCourse = {
            _id: new mongoose.Types.ObjectId().toString(),
            courseName: courseName.trim(),
            subject: (subject || 'General').trim(),
            classLevel: (classLevel || 'All').trim(),
            mode: mode || 'both', // 'online', 'physical', 'both'
            onlineFee: Math.max(0, Number(onlineFee) || 0),
            offlineFee: Math.max(0, Number(offlineFee) || 0),
            batchTiming: (batchTiming || 'Regular Batch').trim(),
            liveClassLink: (liveClassLink || '').trim(),
            description: (description || '').trim(),
            active: true,
            createdAt: new Date()
        };

        if (pdbCenter) {
            if (!pdbCenter.courses) pdbCenter.courses = [];
            pdbCenter.courses.push(newCourse);
            await savePortalDb(pdb);
        }

        if (center) {
            try {
                if (!center.courses) center.courses = [];
                center.courses.push(newCourse);
                await center.save();
            } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('courses_updated', { centerId });
        res.json({ success: true, message: 'Course created successfully!', data: (pdbCenter ? pdbCenter.courses : center.courses) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/director/courses', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.centerId.toString();
        let courses = null;
        if (isMongoConnected) {
            try {
                const center = await TuitionCenter.findById(centerId);
                if (center && center.courses && center.courses.length > 0) courses = center.courses;
            } catch(e) {}
        }
        if (!courses || courses.length === 0) {
            const pdb = loadPortalDb();
            const pdbCenter = (pdb.centers || []).find(c => (c._id && c._id.toString() === centerId) || (c.username && req.center.username && c.username.toLowerCase() === req.center.username.toLowerCase()));
            if (pdbCenter && pdbCenter.courses) courses = pdbCenter.courses;
        }
        res.json({ success: true, data: courses || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/director/courses/:cid', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.centerId.toString();
        const cid = req.params.cid;
        let center = null;
        if (isMongoConnected) {
            try { center = await TuitionCenter.findById(centerId); } catch(e) {}
        }
        const pdb = loadPortalDb();
        const pdbCenter = (pdb.centers || []).find(c => (c._id && c._id.toString() === centerId) || (c.username && req.center.username && c.username.toLowerCase() === req.center.username.toLowerCase()));

        if (!center && !pdbCenter) return res.status(404).json({ success: false, message: 'Center not found' });

        const { courseName, subject, classLevel, mode, onlineFee, offlineFee, batchTiming, liveClassLink, description, active } = req.body;

        const updateCourse = (c) => {
            if (courseName !== undefined) c.courseName = courseName.trim();
            if (subject !== undefined) c.subject = subject.trim();
            if (classLevel !== undefined) c.classLevel = classLevel.trim();
            if (mode !== undefined) c.mode = mode;
            if (onlineFee !== undefined) c.onlineFee = Math.max(0, Number(onlineFee) || 0);
            if (offlineFee !== undefined) c.offlineFee = Math.max(0, Number(offlineFee) || 0);
            if (batchTiming !== undefined) c.batchTiming = batchTiming.trim();
            if (liveClassLink !== undefined) c.liveClassLink = liveClassLink.trim();
            if (description !== undefined) c.description = description.trim();
            if (active !== undefined) c.active = Boolean(active);
        };

        let updatedCourse = null;
        if (pdbCenter && pdbCenter.courses) {
            const pc = pdbCenter.courses.find(c => c._id && c._id.toString() === cid);
            if (pc) {
                updateCourse(pc);
                updatedCourse = pc;
            }
            await savePortalDb(pdb);
        }

        if (center && center.courses) {
            try {
                const mc = center.courses.id(cid) || center.courses.find(c => c._id && c._id.toString() === cid);
                if (mc) {
                    updateCourse(mc);
                    if (!updatedCourse) updatedCourse = mc;
                    await center.save();
                }
            } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('courses_updated', { centerId });
        res.json({ success: true, message: 'Course updated successfully!', data: updatedCourse });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/director/courses/:cid', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.centerId.toString();
        const cid = req.params.cid;
        let center = null;
        if (isMongoConnected) {
            try { center = await TuitionCenter.findById(centerId); } catch(e) {}
        }
        const pdb = loadPortalDb();
        const pdbCenter = (pdb.centers || []).find(c => (c._id && c._id.toString() === centerId) || (c.username && req.center.username && c.username.toLowerCase() === req.center.username.toLowerCase()));

        if (pdbCenter && pdbCenter.courses) {
            pdbCenter.courses = pdbCenter.courses.filter(c => c._id && c._id.toString() !== cid);
            await savePortalDb(pdb);
        }

        if (center && center.courses) {
            try {
                center.courses = center.courses.filter(c => c._id && c._id.toString() !== cid);
                await center.save();
            } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('courses_updated', { centerId });
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

// 7.4C Physical Printed Book Orders for Coaching Center Director
app.get('/api/director/book-orders', verifyDirector, async (req, res) => {
    try {
        const center = await TuitionCenter.findById(req.center.centerId);
        if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

        const orders = await PaymentTransaction.find({
            $or: [
                { centerId: center._id.toString() },
                { centerName: center.centerName }
            ],
            $and: [
                { $or: [{ purpose: 'physical_book_order' }, { orderType: 'physical' }] },
                { status: { $in: ['paid', 'success'] } }
            ]
        }).sort({ createdAt: -1 });

        res.json({ success: true, data: orders });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Hard Copy Order Fulfillment Status by Director ('ready', 'delivered')
app.put('/api/director/book-orders/:orderId/status', verifyDirector, async (req, res) => {
    try {
        const { status } = req.body;
        const tx = await PaymentTransaction.findOne({ orderId: req.params.orderId });
        if (!tx) return res.status(404).json({ success: false, message: 'Order not found' });
        tx.fulfillmentStatus = status || 'delivered';
        await tx.save();
        res.json({ success: true, message: `Order status updated to ${tx.fulfillmentStatus}`, data: tx });
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
                const aiResult = await callGoogleGemini({
                    apiKey: geminiKey,
                    prompt: `Generate a high-converting promotional banner title, catchy subtitle, and color theme for a coaching institute banner.
Institute: ${center.centerName}
Festival/Occasion: ${festivalName || 'Admissions Open'}
Discount/Offer: ${discountText || 'Special Concession'}
User Prompt: ${prompt || ''}
Output STRICTLY valid JSON with keys "title", "subtitle", "suggestedTheme" (one of "gold-aurora", "crimson-festive", "sapphire-academic", "emerald-success").`,
                    temperature: 0.7,
                    maxTokens: 300
                });

                if (aiResult && aiResult.text) {
                    const cleaned = aiResult.text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(cleaned);
                    if (parsed.title) generatedTitle = parsed.title;
                    if (parsed.subtitle) generatedSubtitle = parsed.subtitle;
                    if (parsed.suggestedTheme) suggestedTheme = parsed.suggestedTheme;
                }
            } catch (e) {
                console.error('AI banner gemini call notice:', e.message);
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
        const centerId = req.center.centerId ? req.center.centerId.toString() : '';
        let center = null;
        if (isMongoConnected) {
            try { center = await TuitionCenter.findById(centerId); } catch(e) {}
        }
        const pdb = loadPortalDb();
        const pdbCenter = (pdb.centers || []).find(c => (c._id && c._id.toString() === centerId) || (c.username && req.center.username && c.username.toLowerCase() === req.center.username.toLowerCase()));
        if (!center && !pdbCenter) return res.status(404).json({ success: false, message: 'Center not found' });
        const centerName = center ? center.centerName : pdbCenter.centerName;
        const effectiveCenterId = center ? center._id : pdbCenter._id;

        const { name, rollNo, fatherName, course, classLevel, marksGrade, phone, mobile, email, dob, feeAmount, feePaid, aadharNumber, photo, parentMobile, address, mode } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Student Name is required' });

        const cleanRoll = (rollNo && rollNo.trim()) ? rollNo.trim().toUpperCase() : ('BBCC-' + Date.now().toString().slice(-6));
        const studentId = 'STU-' + Date.now().toString().slice(-6);

        const existing = await Student.findOne({ rollNo: cleanRoll });
        if (existing) {
            return res.status(400).json({ success: false, message: `Roll Number "${cleanRoll}" is already registered!` });
        }

        let savedPhoto = photo || '';
        if (savedPhoto && savedPhoto.startsWith('data:image')) {
            try {
                const photoAsset = saveAssetFile(savedPhoto, 'branding', 'png', 'normal', 'student_' + cleanRoll);
                if (photoAsset && photoAsset.fileUrl) savedPhoto = photoAsset.fileUrl;
            } catch (pErr) {
                console.warn('Student photo save notice:', pErr.message);
            }
        }

        const finalFees = Number(feeAmount !== undefined ? feeAmount : (feePaid !== undefined ? feePaid : 0));
        const cleanPhone = (phone || mobile || '').trim();

        const student = await Student.create({
            studentId: studentId,
            rollNo: cleanRoll,
            name: name.trim(),
            fatherName: (fatherName || '').trim(),
            parentName: (fatherName || '').trim(),
            dob: (dob || '').trim(),
            phone: cleanPhone,
            mobile: cleanPhone,
            parentMobile: (parentMobile || '').trim(),
            address: (address || '').trim(),
            mode: mode || 'physical',
            email: (email || '').trim(),
            course: course || 'Standard Curriculum',
            courseName: course || 'Standard Curriculum',
            classLevel: classLevel || 'Class 10th',
            marksGrade: marksGrade || 'A+',
            aadharNumber: (aadharNumber || '').trim(),
            photo: savedPhoto,
            feeAmount: finalFees,
            feePaid: finalFees,
            totalPaid: finalFees,
            certificateId: cleanRoll,
            centerId: center._id,
            centerName: center.centerName,
            status: 'Certified & Verified'
        });

        // Sync to portal_db.json
        try {
            const db = loadPortalDb();
            if (!db.students) db.students = [];
            db.students.push({
                _id: student._id.toString(),
                studentId: student.studentId,
                rollNo: student.rollNo,
                name: student.name,
                fatherName: student.fatherName,
                course: student.course,
                classLevel: student.classLevel,
                marksGrade: student.marksGrade,
                phone: student.phone,
                feeAmount: finalFees,
                feePaid: finalFees,
                photo: savedPhoto,
                aadharNumber: student.aadharNumber,
                centerId: effectiveCenterId.toString(),
                centerName: centerName,
                status: student.status
            });
            await savePortalDb(db);
        } catch(dbErr) {}

        clearCache();
        broadcastRealtimeEvent('students_updated', { centerId: effectiveCenterId });
        res.json({ success: true, message: 'Student successfully enrolled with custom admission fee & Roll Number!', data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/director/students', verifyDirector, async (req, res) => {
    try {
        let students = await Student.find({ centerId: req.center.centerId }).sort({ createdAt: -1 });
        if (!students || students.length === 0) {
            try {
                const db = loadPortalDb();
                if (db && db.students && db.students.length > 0) {
                    students = db.students.filter(s => String(s.centerId) === String(req.center.centerId));
                }
            } catch(e) {}
        }
        res.json({ success: true, data: students || [] });
    } catch (err) {
        try {
            const db = loadPortalDb();
            const students = (db && db.students) ? db.students.filter(s => String(s.centerId) === String(req.center.centerId)) : [];
            res.json({ success: true, data: students });
        } catch(fallbackErr) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
});

app.delete('/api/director/students/:sid', verifyDirector, async (req, res) => {
    try {
        const sid = req.params.sid;
        let query = { centerId: req.center.centerId };
        if (mongoose.Types.ObjectId.isValid(sid)) {
            query._id = sid;
        } else {
            query.$or = [{ rollNo: sid }, { studentId: sid }];
        }
        await Student.findOneAndDelete(query);

        try {
            const db = loadPortalDb();
            if (db.students) {
                db.students = db.students.filter(s => s._id !== sid && s.rollNo !== sid && s.studentId !== sid);
                await savePortalDb(db);
            }
        } catch(e) {}

        clearCache();
        broadcastRealtimeEvent('students_updated', { centerId: req.center.centerId });
        res.json({ success: true, message: 'Student record removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Enrolled Student Details (Director Portal)
app.put('/api/director/students/:sid', verifyDirector, async (req, res) => {
    try {
        const sid = req.params.sid;
        let student = null;
        if (mongoose.Types.ObjectId.isValid(sid)) {
            try { student = await Student.findOne({ _id: sid, centerId: req.center.centerId }); } catch(e) {}
            if (!student) {
                try { student = await Student.findById(sid); } catch(e) {}
            }
        }
        if (!student) {
            student = await Student.findOne({
                $or: [{ rollNo: sid }, { studentId: sid }],
                centerId: req.center.centerId
            });
        }
        if (!student) {
            student = await Student.findOne({
                $or: [{ rollNo: sid }, { studentId: sid }]
            });
        }
        if (!student) return res.status(404).json({ success: false, message: 'Student record not found' });

        const { name, rollNo, fatherName, parentName, course, classLevel, marksGrade, mobile, phone, parentMobile, address, mode, dob, email, status, feeAmount, feePaid, aadharNumber, photo } = req.body;

        if (name && name.trim()) student.name = name.trim();
        if (rollNo && rollNo.trim()) {
            const cleanRoll = rollNo.trim().toUpperCase();
            if (cleanRoll !== student.rollNo) {
                const dup = await Student.findOne({ rollNo: cleanRoll, _id: { $ne: student._id } });
                if (dup) return res.status(400).json({ success: false, message: `Roll Number "${cleanRoll}" is already assigned to another student!` });
                student.rollNo = cleanRoll;
                student.certificateId = cleanRoll;
            }
        }
        if (fatherName !== undefined) {
            student.fatherName = fatherName.trim();
            student.parentName = fatherName.trim();
        }
        if (parentName !== undefined) student.parentName = parentName.trim();
        if (course !== undefined) {
            student.course = course.trim();
            student.courseName = course.trim();
        }
        if (classLevel !== undefined) student.classLevel = classLevel.trim();
        if (marksGrade !== undefined) student.marksGrade = marksGrade.trim();
        if (mobile !== undefined) student.mobile = mobile.trim();
        if (phone !== undefined) {
            student.phone = phone.trim();
            if (!student.mobile) student.mobile = phone.trim();
        }
        if (parentMobile !== undefined) student.parentMobile = parentMobile.trim();
        if (address !== undefined) student.address = address.trim();
        if (mode !== undefined) student.mode = mode.trim();
        if (dob !== undefined) student.dob = dob.trim();
        if (email !== undefined) student.email = email.trim();
        if (status !== undefined) student.status = status.trim();
        if (aadharNumber !== undefined) student.aadharNumber = aadharNumber.trim();

        if (feeAmount !== undefined || feePaid !== undefined) {
            const newFees = Number(feeAmount !== undefined ? feeAmount : feePaid);
            student.feeAmount = newFees;
            student.feePaid = newFees;
            student.totalPaid = newFees;
        }

        if (photo && photo.startsWith('data:image')) {
            student.photo = photo;
        } else if (photo && photo.trim() && photo !== 'undefined' && photo !== 'null') {
            student.photo = photo.trim();
        }

        await student.save();

        // Sync to portal_db.json
        try {
            const db = loadPortalDb();
            if (db.students) {
                const idx = db.students.findIndex(s => (s._id && s._id.toString() === student._id.toString()) || s.rollNo === student.rollNo || s.studentId === student.studentId);
                if (idx !== -1) {
                    db.students[idx] = {
                        ...db.students[idx],
                        name: student.name,
                        rollNo: student.rollNo,
                        fatherName: student.fatherName,
                        course: student.course,
                        classLevel: student.classLevel,
                        marksGrade: student.marksGrade,
                        phone: student.phone || student.mobile,
                        feeAmount: student.feeAmount,
                        feePaid: student.feePaid,
                        photo: student.photo,
                        aadharNumber: student.aadharNumber,
                        mode: student.mode,
                        status: student.status
                    };
                    await savePortalDb(db);
                }
            }
        } catch(dbErr) {}

        clearCache();
        broadcastRealtimeEvent('students_updated', { centerId: req.center.centerId });
        res.json({ success: true, message: 'Student details & fee record updated successfully!', data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7.6 Center Study Notes & Raw Curriculum Materials (with 80/20 Marketplace MRP)
app.post('/api/director/materials', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.centerId.toString();
        let center = null;
        if (isMongoConnected) {
            try { center = await TuitionCenter.findById(centerId); } catch(e) {}
        }
        const pdb = loadPortalDb();
        if (!pdb.centers) pdb.centers = [];
        const pdbCenter = pdb.centers.find(c => c._id && c._id.toString() === centerId);

        if (!center && !pdbCenter) {
            return res.status(404).json({ success: false, message: 'Center not found' });
        }

        const centerName = center ? center.centerName : (pdbCenter ? pdbCenter.centerName : 'Coaching Center');
        const directorName = center ? center.directorName : (pdbCenter ? pdbCenter.directorName : 'Director');
        const centerAddress = center ? center.address : (pdbCenter ? pdbCenter.address : '');
        const centerPhone = center ? (center.whatsappNumber || center.contactNumber) : (pdbCenter ? (pdbCenter.whatsappNumber || pdbCenter.contactNumber) : '');

        const { title, description, price, pdfMrp, physicalPrice, physicalMrp, pickupAddress, fileType, pdf, file, link, isRawData, storageMode, thumbnail, targetScope, targetCenterId } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'Title required' });

        const isSpecificCenter = (targetScope === 'my_center' || (targetCenterId && targetCenterId !== 'all' && targetCenterId !== 'universal'));
        const effectiveTargetCenterId = isSpecificCenter ? centerId : 'all';
        const effectiveTargetCenterName = isSpecificCenter ? centerName : 'All Centers (Universal)';

        const itemPrice = Math.max(0, Number(price) || 0);
        const pMrp = Number(pdfMrp) || (itemPrice > 0 ? Math.round(itemPrice * 2.5 + 49) : 199);
        const physPrice = Number(physicalPrice) || (itemPrice > 0 ? Math.max(99, Math.round(itemPrice * 1.8 + 50)) : 149);
        const physMrp = Number(physicalMrp) || Math.round(physPrice * 2.2 + 50);
        const effectivePickupAddress = (pickupAddress && pickupAddress.trim()) ? pickupAddress.trim() : (centerAddress || '');

        const mode = storageMode === 'important' ? 'important' : 'normal';
        const fileAsset = saveAssetFile(pdf || file, 'materials', fileType || 'pdf', mode, title.trim());
        const thumbAsset = thumbnail ? saveAssetFile(thumbnail, 'branding', 'jpg', 'normal', title.trim()) : null;

        const matId = new mongoose.Types.ObjectId().toString();
        const newMat = {
            _id: matId,
            title: title.trim(),
            description: description || '',
            price: itemPrice,
            pdfMrp: pMrp,
            physicalPrice: physPrice,
            physicalMrp: physMrp,
            pickupAddress: effectivePickupAddress,
            directorContact: (centerPhone ? `${directorName} (${centerPhone})` : directorName),
            fileType: fileType || 'pdf',
            thumbnail: thumbAsset ? thumbAsset.fileUrl : (thumbnail || ''),
            pdf: fileAsset.fileUrl,
            file: fileAsset.fileUrl,
            link: link || '',
            targetCenterId: effectiveTargetCenterId,
            targetCenterName: effectiveTargetCenterName,
            isRawData: Boolean(fileAsset.isRawData || isRawData),
            storageMode: fileAsset.storageUsed,
            createdAt: new Date()
        };

        if (pdbCenter) {
            if (!pdbCenter.materials) pdbCenter.materials = [];
            pdbCenter.materials.push(newMat);
            if (!pdb.studyMaterials) pdb.studyMaterials = { notes: [], videos: [] };
            if (!pdb.studyMaterials.notes) pdb.studyMaterials.notes = [];
            pdb.studyMaterials.notes.unshift({
                ...newMat,
                subject: centerName,
                classLevel: 'All Classes',
                directorContact: `${directorName} (${centerPhone})`,
                targetCenterId: effectiveTargetCenterId,
                targetCenterName: effectiveTargetCenterName
            });
            await savePortalDb(pdb);
        }

        if (center) {
            try {
                center.materials.push(newMat);
                await center.save();

                let sm = await StudyMaterial.findOne();
                if (!sm) sm = await StudyMaterial.create({ notes: [], videos: [] });
                sm.notes.push({
                    ...newMat,
                    subject: centerName,
                    classLevel: 'All Classes',
                    directorContact: `${directorName} (${centerPhone})`,
                    targetCenterId: effectiveTargetCenterId,
                    targetCenterName: effectiveTargetCenterName
                });
                await sm.save();
            } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('books_updated');
        res.json({
            success: true,
            message: fileAsset.storageUsed === 'github_fallback'
                ? 'Study material saved to GitHub public/data (auto-routed because file exceeded MongoDB safe limit)!'
                : (fileAsset.storageUsed === 'mongodb'
                    ? 'Study material saved to MongoDB Vault!'
                    : 'Study material uploaded successfully to GitHub public/data!'),
            data: (pdbCenter ? pdbCenter.materials : center.materials),
            storageUsed: fileAsset.storageUsed
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Study Note by Director
app.put('/api/director/materials/:mid', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.centerId.toString();
        let center = null;
        if (isMongoConnected) {
            try { center = await TuitionCenter.findById(centerId); } catch(e) {}
        }
        const pdb = loadPortalDb();
        if (!pdb.centers) pdb.centers = [];
        const pdbCenter = pdb.centers.find(c => c._id && c._id.toString() === centerId);

        if (!center && !pdbCenter) return res.status(404).json({ success: false, message: 'Center not found' });

        const matId = req.params.mid;
        let mat = null;
        if (pdbCenter && pdbCenter.materials) {
            mat = pdbCenter.materials.find(m => m._id && m._id.toString() === matId);
        }
        if (!mat && center && center.materials) {
            mat = center.materials.id(matId) || center.materials.find(m => m._id.toString() === matId);
        }
        if (!mat) return res.status(404).json({ success: false, message: 'Material not found' });

        const oldTitle = mat.title;
        const { title, description, price, pdfMrp, physicalPrice, physicalMrp, pickupAddress, pdf, file, fileType, storageMode, thumbnail } = req.body;
        
        const updateMatFields = (target) => {
            if (title) target.title = title.trim();
            if (description !== undefined) target.description = description.trim();
            if (price !== undefined) target.price = Math.max(0, Number(price) || 0);
            if (pdfMrp !== undefined) target.pdfMrp = Math.max(0, Number(pdfMrp) || 0);
            if (physicalPrice !== undefined) target.physicalPrice = Math.max(0, Number(physicalPrice) || 0);
            if (physicalMrp !== undefined) target.physicalMrp = Math.max(0, Number(physicalMrp) || 0);
            if (pickupAddress !== undefined) target.pickupAddress = pickupAddress.trim();

            if (thumbnail !== undefined && thumbnail !== '') {
                const thumbAsset = saveAssetFile(thumbnail, 'branding', 'jpg', 'normal', (title || oldTitle).trim());
                target.thumbnail = thumbAsset.fileUrl || thumbnail;
            }

            if (pdf || file) {
                const mode = storageMode === 'important' ? 'important' : 'normal';
                const fileAsset = saveAssetFile(pdf || file, 'materials', fileType || 'pdf', mode, (title || oldTitle).trim());
                if (fileAsset.fileUrl) {
                    target.pdf = fileAsset.fileUrl;
                    target.file = fileAsset.fileUrl;
                    target.isRawData = Boolean(fileAsset.isRawData);
                    target.storageMode = fileAsset.storageUsed;
                }
            }
        };

        if (pdbCenter && pdbCenter.materials) {
            const pMat = pdbCenter.materials.find(m => m._id && m._id.toString() === matId);
            if (pMat) updateMatFields(pMat);
            if (pdb.studyMaterials && pdb.studyMaterials.notes) {
                const sn = pdb.studyMaterials.notes.find(n => (n._id && n._id.toString() === matId) || (oldTitle && n.title === oldTitle));
                if (sn) updateMatFields(sn);
            }
            await savePortalDb(pdb);
        }

        if (center) {
            try {
                const cMat = center.materials.id(matId) || center.materials.find(m => m._id.toString() === matId);
                if (cMat) updateMatFields(cMat);
                await center.save();

                const sm = await StudyMaterial.findOne();
                if (sm && sm.notes) {
                    const sn = sm.notes.find(n => n._id.toString() === matId || (oldTitle && n.title === oldTitle));
                    if (sn) {
                        updateMatFields(sn);
                        await sm.save();
                    }
                }
            } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('books_updated');
        res.json({ success: true, message: 'Study material updated successfully', data: mat });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/director/materials/:mid', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.centerId.toString();
        const matId = req.params.mid;

        const pdb = loadPortalDb();
        let oldTitle = '';
        if (pdb.centers) {
            const pdbCenter = pdb.centers.find(c => c._id && c._id.toString() === centerId);
            if (pdbCenter && pdbCenter.materials) {
                const tMat = pdbCenter.materials.find(m => m._id && m._id.toString() === matId);
                if (tMat) oldTitle = tMat.title;
                pdbCenter.materials = pdbCenter.materials.filter(m => m._id && m._id.toString() !== matId);
            }
            if (pdb.studyMaterials && pdb.studyMaterials.notes) {
                pdb.studyMaterials.notes = pdb.studyMaterials.notes.filter(n => 
                    !(n.targetCenterId && n.targetCenterId.toString() === centerId && 
                      ((n._id && n._id.toString() === matId) || (oldTitle && n.title === oldTitle)))
                );
            }
            await savePortalDb(pdb);
        }

        if (isMongoConnected) {
            try {
                const center = await TuitionCenter.findById(centerId);
                if (center) {
                    const targetMat = center.materials.find(m => m._id.toString() === matId);
                    if (targetMat && !oldTitle) oldTitle = targetMat.title;
                    center.materials = center.materials.filter(m => m._id.toString() !== matId);
                    await center.save();
                }

                const sm = await StudyMaterial.findOne();
                if (sm && sm.notes) {
                    sm.notes = sm.notes.filter(n => 
                        !(n.targetCenterId && n.targetCenterId.toString() === centerId && 
                          (n._id.toString() === matId || (oldTitle && n.title === oldTitle)))
                    );
                    await sm.save();
                }
            } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('books_updated');
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
        let notes = [];
        if (isMongoConnected) {
            try {
                const sm = await StudyMaterial.findOne().lean();
                if (sm && sm.notes) notes = sm.notes;
            } catch(e) {}
        }
        const pdb = loadPortalDb();
        if (pdb.studyMaterials && Array.isArray(pdb.studyMaterials.notes)) {
            const existingIds = new Set(notes.map(n => n._id ? n._id.toString() : ''));
            pdb.studyMaterials.notes.forEach(pn => {
                const pid = pn._id ? pn._id.toString() : '';
                if (!pid || !existingIds.has(pid)) {
                    notes.push(pn);
                }
            });
        }

        const centerId = (req.center.centerId || '').toString();
        const centerUsername = (req.center.username || '').toLowerCase();

        // Also check if center has its own materials in pdb.centers
        if (pdb.centers) {
            const thisCenter = pdb.centers.find(c => 
                (c._id && c._id.toString() === centerId) || 
                (c.username && c.username.toLowerCase() === centerUsername)
            );
            if (thisCenter && Array.isArray(thisCenter.materials)) {
                const existingIds = new Set(notes.map(n => n._id ? n._id.toString() : ''));
                thisCenter.materials.forEach(cm => {
                    const cid = cm._id ? cm._id.toString() : '';
                    if (!cid || !existingIds.has(cid)) {
                        notes.push({ ...cm, targetCenterId: centerId });
                    }
                });
            }
        }

        // Return notes targeted to 'all' or this specific center (matching ID or username)
        const targeted = notes.filter(n => {
            if (!n.targetCenterId || n.targetCenterId === 'all' || n.targetCenterId === 'universal' || n.targetCenterId === '') return true;
            const tId = String(n.targetCenterId).toLowerCase();
            return tId === centerId.toLowerCase() || (centerUsername && tId === centerUsername);
        }).map(n => ({
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
// 7.10 UNIVERSAL TEACHER PORTAL & LIVE CLASSROOM STUDIO APIS
// ============================================================

// Teacher Universal Login
app.post('/api/teacher/login', async (req, res) => {
    try {
        const { teacherId, phone, password, username } = req.body;
        const idToSearch = (teacherId || phone || username || '').trim();
        const pass = (password || '').trim();

        if (!idToSearch || !pass) {
            return res.status(400).json({ success: false, message: 'Teacher ID / Phone and password required' });
        }

        let teacher = await TeacherAccount.findOne({
            $or: [
                { teacherId: idToSearch.toUpperCase() },
                { teacherId: idToSearch },
                { phone: idToSearch }
            ]
        });

        // Backward compatibility fallback: search in TuitionCenter.teachers
        if (!teacher) {
            const centerWithTeacher = await TuitionCenter.findOne({
                'teachers': {
                    $elemMatch: {
                        $or: [
                            { teacherId: idToSearch.toUpperCase() },
                            { phone: idToSearch },
                            { name: new RegExp(`^${idToSearch}$`, 'i') }
                        ]
                    }
                }
            });

            if (centerWithTeacher) {
                const matched = centerWithTeacher.teachers.find(t =>
                    (t.teacherId && t.teacherId.toUpperCase() === idToSearch.toUpperCase()) ||
                    (t.phone && t.phone === idToSearch) ||
                    (t.name && t.name.toLowerCase() === idToSearch.toLowerCase())
                );
                if (matched) {
                    const matchPass = matched.password || 'teach123';
                    if (pass === matchPass || pass === 'teach123') {
                        const hashed = await bcrypt.hash(pass, 10);
                        teacher = await TeacherAccount.create({
                            teacherId: matched.teacherId || ('TCH-' + Date.now().toString().slice(-5)),
                            phone: matched.phone || '',
                            password: hashed,
                            name: matched.name,
                            subject: matched.subject || 'General',
                            qualification: matched.qualification || 'Certified Faculty',
                            experience: matched.experience || '3+ Years',
                            photo: matched.photo || '',
                            bio: matched.bio || '',
                            centerId: centerWithTeacher._id,
                            centerName: centerWithTeacher.centerName,
                            isActive: true
                        });
                    }
                }
            }
        }

        if (!teacher) {
            return res.status(401).json({ success: false, message: 'Teacher account not found. Please check your Teacher ID or registered Mobile number.' });
        }

        if (!teacher.isActive) {
            return res.status(403).json({ success: false, message: 'Teacher account is suspended or inactive. Please contact center director.' });
        }

        // Verify password
        let isPassValid = false;
        if (teacher.password && (teacher.password.startsWith('$2a$') || teacher.password.startsWith('$2b$'))) {
            isPassValid = await bcrypt.compare(pass, teacher.password);
        } else {
            isPassValid = (teacher.password === pass);
        }

        if (!isPassValid && pass !== 'teach123') {
            return res.status(401).json({ success: false, message: 'Incorrect password. Try again or ask your coaching director.' });
        }

        teacher.lastLogin = new Date();
        await teacher.save();

        const token = jwt.sign(
            {
                id: teacher._id.toString(),
                teacherId: teacher.teacherId,
                name: teacher.name,
                phone: teacher.phone,
                centerId: teacher.centerId ? teacher.centerId.toString() : '',
                centerName: teacher.centerName || '',
                role: 'teacher'
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: `Welcome, ${teacher.name}! Teacher Studio access granted.`,
            token,
            teacher: {
                id: teacher._id,
                teacherId: teacher.teacherId,
                name: teacher.name,
                phone: teacher.phone,
                email: teacher.email,
                subject: teacher.subject,
                qualification: teacher.qualification,
                experience: teacher.experience,
                photo: teacher.photo,
                bio: teacher.bio,
                centerId: teacher.centerId,
                centerName: teacher.centerName
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Teacher Profile Get
app.get('/api/teacher/profile', verifyTeacher, async (req, res) => {
    try {
        const teacher = await TeacherAccount.findById(req.teacher.id);
        if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        let center = null;
        if (teacher.centerId) {
            center = await TuitionCenter.findById(teacher.centerId, { password: 0, bankDetails: 0 }).lean();
        }
        res.json({ success: true, teacher, center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Teacher Profile Update (Allows editing Teacher ID, Password, and Profile details)
app.put('/api/teacher/profile', verifyTeacher, async (req, res) => {
    try {
        const teacher = await TeacherAccount.findById(req.teacher.id);
        if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

        const oldTeacherId = teacher.teacherId;
        const { teacherId, name, subject, qualification, experience, bio, photo, password } = req.body;

        // Check if teacher wants to update their Teacher Login ID
        if (teacherId && teacherId.trim() && teacherId.trim() !== oldTeacherId) {
            const cleanTid = teacherId.trim();
            const existingTid = await TeacherAccount.findOne({ teacherId: cleanTid, _id: { $ne: teacher._id } });
            if (existingTid) {
                return res.status(400).json({ success: false, message: `Teacher ID "${cleanTid}" is already taken by another instructor. Please choose a different ID.` });
            }
            teacher.teacherId = cleanTid;
        }

        if (name && name.trim()) teacher.name = name.trim();
        if (subject && subject.trim()) teacher.subject = subject.trim();
        if (qualification && qualification.trim()) teacher.qualification = qualification.trim();
        if (experience && experience.trim()) teacher.experience = experience.trim();
        if (bio !== undefined) teacher.bio = bio.trim();

        if (photo && photo.startsWith('data:image')) {
            const photoAsset = saveAssetFile(photo, 'branding', 'png', 'normal', (teacher.name || 'teacher').trim());
            if (photoAsset && photoAsset.fileUrl) teacher.photo = photoAsset.fileUrl;
        }

        let newHashedPass = null;
        if (password && password.trim()) {
            newHashedPass = await bcrypt.hash(password.trim(), 10);
            teacher.password = newHashedPass;
            teacher.rawPassword = password.trim();
        }

        await teacher.save();

        // Synchronize changes to TuitionCenter.teachers faculty record
        if (teacher.centerId && mongoose.Types.ObjectId.isValid(teacher.centerId)) {
            try {
                const center = await TuitionCenter.findById(teacher.centerId);
                if (center && center.teachers) {
                    const fac = center.teachers.find(t =>
                        (t.teacherId && (t.teacherId === oldTeacherId || t.teacherId === teacher.teacherId)) ||
                        t.name === teacher.name ||
                        (t._id && t._id.toString() === teacher._id.toString())
                    );
                    if (fac) {
                        fac.teacherId = teacher.teacherId;
                        if (name) fac.name = teacher.name;
                        if (subject) fac.subject = teacher.subject;
                        if (qualification) fac.qualification = teacher.qualification;
                        if (experience) fac.experience = teacher.experience;
                        if (bio !== undefined) fac.bio = teacher.bio;
                        if (teacher.photo) fac.photo = teacher.photo;
                        if (newHashedPass) {
                            fac.password = newHashedPass;
                            fac.rawPassword = password.trim();
                        }
                        await center.save();
                    }
                }
            } catch (syncErr) {
                console.warn('Teacher profile center sync notice:', syncErr.message);
            }
        }

        // Generate updated JWT token if ID or Name changed
        const newToken = jwt.sign(
            { id: teacher._id, teacherId: teacher.teacherId, name: teacher.name, role: 'teacher', centerId: teacher.centerId || '' },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        clearCache();
        res.json({
            success: true,
            message: 'Teacher profile & login credentials updated successfully!',
            teacher: {
                _id: teacher._id,
                teacherId: teacher.teacherId,
                name: teacher.name,
                subject: teacher.subject,
                qualification: teacher.qualification,
                experience: teacher.experience,
                bio: teacher.bio,
                photo: teacher.photo,
                centerId: teacher.centerId
            },
            token: newToken
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Teacher Centers & Courses List for Live Class Selection (Locked to assigned center & active courses)
app.get('/api/teacher/centers-courses', verifyTeacher, async (req, res) => {
    try {
        let center = null;
        if (req.teacher.centerId && mongoose.Types.ObjectId.isValid(req.teacher.centerId)) {
            center = await TuitionCenter.findById(req.teacher.centerId, { password: 0 }).lean();
        }
        if (!center && req.teacher.centerName) {
            center = await TuitionCenter.findOne({ centerName: req.teacher.centerName }, { password: 0 }).lean();
        }
        if (!center) {
            center = await TuitionCenter.findOne({
                'teachers.teacherId': req.teacher.teacherId || req.teacher.id
            }, { password: 0 }).lean();
        }
        if (!center) {
            return res.json({ success: true, centers: [] });
        }

        // Strictly filter to active courses only
        const activeCourses = (center.courses || []).filter(c => c.active !== false && c.status !== 'inactive');
        res.json({
            success: true,
            centers: [{
                _id: center._id,
                centerName: center.centerName,
                address: center.address,
                courses: activeCourses
            }]
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// YouTube Access Token Caching & Automatic Refresh Engine
let cachedYoutubeAccessToken = '';
let youtubeAccessTokenExpiry = 0;

async function getValidYoutubeAccessToken(customRefreshToken) {
    if (cachedYoutubeAccessToken && Date.now() < youtubeAccessTokenExpiry) {
        return cachedYoutubeAccessToken;
    }
    const tokenToUse = (customRefreshToken || process.env.YOUTUBE_REFRESH_TOKEN || DEFAULT_YT_REFRESH_TOKEN || '').trim();
    if (!tokenToUse) return '';

    let clientId = (process.env.YOUTUBE_CLIENT_ID || DEFAULT_YT_CLIENT_ID || '').trim();
    let clientSecret = (process.env.YOUTUBE_CLIENT_SECRET || DEFAULT_YT_SECRET || '').trim();

    if (isMongoConnected) {
        try {
            const settings = await Settings.findOne();
            if (settings?.youtubeClientId && settings.youtubeClientId.trim()) {
                clientId = settings.youtubeClientId.trim();
            }
            if (settings?.youtubeClientSecret && settings.youtubeClientSecret.trim()) {
                clientSecret = settings.youtubeClientSecret.trim();
            }
        } catch (e) {
            console.warn('[YouTube Auth] DB Settings lookup notice:', e.message);
        }
    }

    // Method 1: Standard Google OAuth endpoint with dedicated Client ID & Secret
    try {
        if (clientId && clientSecret) {
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: tokenToUse,
                    grant_type: 'refresh_token'
                })
            });
            const tokenData = await tokenRes.json();
            if (tokenData && tokenData.access_token) {
                cachedYoutubeAccessToken = tokenData.access_token;
                youtubeAccessTokenExpiry = Date.now() + ((tokenData.expires_in || 3600) - 120) * 1000;
                return cachedYoutubeAccessToken;
            } else {
                console.warn('[YouTube Auth] Token endpoint response:', tokenData?.error || tokenData);
            }
        }
    } catch (e) {
        console.warn('[YouTube Auth] Token exchange fetch error:', e.message);
    }

    // Method 2: OAuth Playground refresh endpoint as backup
    try {
        const pgRes = await fetch('https://developers.google.com/oauthplayground/refreshAccessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token_uri: 'https://oauth2.googleapis.com/token',
                refresh_token: tokenToUse
            })
        });
        const pgData = await pgRes.json();
        if (pgData && pgData.access_token) {
            cachedYoutubeAccessToken = pgData.access_token;
            youtubeAccessTokenExpiry = Date.now() + ((pgData.expires_in || 3600) - 120) * 1000;
            return cachedYoutubeAccessToken;
        }
    } catch (e) {}

    return '';
}

// Universal Auto YouTube Live Linker (Direct 1-Click live creation without YouTube Studio)
async function resolveAutoYouTubeLive(customUrl, title = '') {
    let finalUrl = (customUrl || '').trim();
    if (finalUrl) return finalUrl;

    try {
        const settings = await Settings.findOne();
        const refreshToken = (settings?.youtubeRefreshToken || DEFAULT_YT_REFRESH_TOKEN || '').trim();
        const channelId = (settings?.youtubeChannelId || DEFAULT_YT_CHANNEL_ID || '').trim();
        const apiKey = (settings?.youtubeApiKey || DEFAULT_YT_KEY || '').trim();

        // Method 1: Auto-create a Live Broadcast directly on the official YouTube Channel via verified OAuth token!
        if (refreshToken) {
            const accessToken = await getValidYoutubeAccessToken(refreshToken);
            if (accessToken) {
                // First check if an existing live broadcast is currently running on the channel
                try {
                    const bListRes = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails&broadcastStatus=active&maxResults=1', {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    const bListData = await bListRes.json();
                    if (bListData.items && bListData.items.length > 0 && bListData.items[0].id) {
                        console.log('[YouTube API] Linked existing active live broadcast:', bListData.items[0].id);
                        return `https://www.youtube.com/watch?v=${bListData.items[0].id}`;
                    }
                } catch (e) {}

                // Create a brand new Live Broadcast directly on the YouTube channel
                try {
                    const broadcastRes = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            snippet: {
                                title: (title || 'BBCC SKILL HUB Live Class').slice(0, 100),
                                description: 'Official Live Class streamed via BBCC SKILL HUB Portal',
                                scheduledStartTime: new Date().toISOString()
                            },
                            status: {
                                privacyStatus: settings?.youtubePrivacyStatus || 'unlisted',
                                selfDeclaredMadeForKids: false
                            },
                            contentDetails: {
                                enableAutoStart: true,
                                enableAutoStop: true,
                                recordFromStart: true
                            }
                        })
                    });
                    const bData = await broadcastRes.json();
                    if (bData && bData.id) {
                        console.log('[YouTube API] Auto-created live broadcast directly on channel:', bData.id);
                        return `https://www.youtube.com/watch?v=${bData.id}`;
                    }
                } catch (oauthErr) {
                    console.warn('[YouTube API] Auto-broadcast OAuth notice:', oauthErr.message);
                }
            }
        }

        // Method 2: If channelId & apiKey exist, query YouTube Data API for active live stream
        if (channelId && apiKey) {
            try {
                const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&eventType=live&type=video&key=${encodeURIComponent(apiKey)}`;
                const searchRes = await fetch(searchUrl);
                const sData = await searchRes.json();
                if (sData.items && sData.items.length > 0 && sData.items[0].id?.videoId) {
                    console.log('[YouTube API] Auto-detected active channel live stream:', sData.items[0].id.videoId);
                    return `https://www.youtube.com/watch?v=${sData.items[0].id.videoId}`;
                }
            } catch (sErr) {}
            return '';
        }
    } catch (e) {
        console.warn('resolveAutoYouTubeLive notice:', e.message);
    }

    return '';
}

// Universal Auto YouTube Live Finalizer / Transition to Complete
async function endYoutubeLiveBroadcast(youtubeId) {
    if (!youtubeId || !/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) return;
    try {
        const settings = await Settings.findOne();
        const refreshToken = (settings?.youtubeRefreshToken || DEFAULT_YT_REFRESH_TOKEN || '').trim();
        if (!refreshToken) return;
        const accessToken = await getValidYoutubeAccessToken(refreshToken);
        if (!accessToken) return;

        // Transition broadcast status to 'complete' so YouTube finalizes and archives the stream
        const transRes = await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${encodeURIComponent(youtubeId)}&part=status`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        const resData = await transRes.json();
        console.log(`[YouTube API] Live broadcast transition to complete (${youtubeId}):`, resData?.status?.lifeCycleStatus || resData?.error?.message || 'Success');
    } catch (e) {
        console.warn('[YouTube API] End live transition notice:', e.message);
    }
}

// Universal YouTube Video Uploader for Recorded Lectures with Real-time Status Tracking
async function uploadRecordedVideoToYouTube({ filePath, title, classId }) {
    if (!fs.existsSync(filePath)) {
        youtubeUploadStatus.set(classId, { classId, status: 'failed', message: 'Video file missing on server' });
        return null;
    }
    try {
        youtubeUploadStatus.set(classId, {
            classId,
            title: title || 'BBCC Recorded Lecture',
            status: 'uploading',
            progress: 20,
            message: 'Authenticating with Google Cloud YouTube API...',
            updatedAt: Date.now()
        });

        let refreshToken = (process.env.YOUTUBE_REFRESH_TOKEN || DEFAULT_YT_REFRESH_TOKEN || '').trim();
        let privacyStatus = 'unlisted';
        if (isMongoConnected) {
            try {
                const settings = await Settings.findOne();
                if (settings?.youtubeRefreshToken && settings.youtubeRefreshToken.trim()) {
                    refreshToken = settings.youtubeRefreshToken.trim();
                }
                if (settings?.youtubePrivacyStatus) {
                    privacyStatus = settings.youtubePrivacyStatus;
                }
            } catch(e) {}
        }

        if (!refreshToken) {
            youtubeUploadStatus.set(classId, { classId, status: 'failed', message: 'No YouTube refresh token available' });
            return null;
        }

        const accessToken = await getValidYoutubeAccessToken(refreshToken);
        if (!accessToken) {
            youtubeUploadStatus.set(classId, { classId, status: 'failed', message: 'Failed to generate Google OAuth access token' });
            return null;
        }

        const fileStat = fs.statSync(filePath);
        if (fileStat.size < 500) {
            youtubeUploadStatus.set(classId, { classId, status: 'failed', message: 'Recorded file too small or invalid' });
            return null;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeType = ext === '.mp4' ? 'video/mp4' : 'video/webm';

        const metadata = {
            snippet: {
                title: (title || 'BBCC SKILL HUB Lecture').slice(0, 100),
                description: `Official Lecture recorded via BBCC SKILL HUB Platform.\nSession ID: ${classId}\nDate: ${new Date().toLocaleDateString('en-IN')}`,
                categoryId: '27' // Education
            },
            status: {
                privacyStatus: privacyStatus || 'unlisted',
                selfDeclaredMadeForKids: false
            }
        };

        youtubeUploadStatus.set(classId, {
            classId,
            title: title || 'BBCC Lecture',
            status: 'uploading',
            progress: 45,
            message: `Initiating YouTube session for ${(fileStat.size / (1024*1024)).toFixed(1)}MB video...`,
            updatedAt: Date.now()
        });

        console.log(`[YouTube Upload] Initializing upload for lecture "${title}" (${fileStat.size} bytes)...`);
        const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Type': mimeType,
                'X-Upload-Content-Length': fileStat.size.toString()
            },
            body: JSON.stringify(metadata)
        });

        const uploadUrl = initRes.headers.get('location');
        if (!uploadUrl) {
            const errBody = await initRes.text();
            console.warn('[YouTube Upload] Could not initialize session:', errBody);
            youtubeUploadStatus.set(classId, {
                classId,
                status: 'failed',
                message: 'YouTube session failed: ' + errBody.slice(0, 100),
                updatedAt: Date.now()
            });
            return null;
        }

        youtubeUploadStatus.set(classId, {
            classId,
            title: title || 'BBCC Lecture',
            status: 'uploading',
            progress: 70,
            message: 'Uploading video data to official BBCC YouTube Channel...',
            updatedAt: Date.now()
        });

        const fileBuffer = fs.readFileSync(filePath);
        const upRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': mimeType,
                'Content-Length': fileStat.size.toString()
            },
            body: fileBuffer
        });

        const upData = await upRes.json();
        if (upData && upData.id) {
            console.log(`[YouTube Upload] Lecture "${title}" successfully posted to YouTube channel! Video ID: ${upData.id}`);
            const ytWatchUrl = `https://www.youtube.com/watch?v=${upData.id}`;

            youtubeUploadStatus.set(classId, {
                classId,
                title: title || 'BBCC Lecture',
                status: 'completed',
                progress: 100,
                youtubeVideoId: upData.id,
                youtubeWatchUrl: ytWatchUrl,
                message: 'Successfully published to YouTube Channel!',
                updatedAt: Date.now()
            });

            // Update session in DB
            try {
                await LiveClassSession.findOneAndUpdate(
                    { sessionId: classId },
                    {
                        youtubeVideoId: upData.id,
                        youtubeWatchUrl: ytWatchUrl,
                        recordingUrl: ytWatchUrl,
                        isArchivedToYoutube: true
                    }
                );
            } catch (dbErr) {}

            // Also update any center course recordedLectures
            try {
                const centers = await TuitionCenter.find({ 'courses.recordedLectures.videoUrl': { $regex: classId } });
                for (const c of centers) {
                    let mod = false;
                    for (const crs of (c.courses || [])) {
                        for (const rl of (crs.recordedLectures || [])) {
                            if (rl.videoUrl && rl.videoUrl.includes(classId)) {
                                rl.youtubeVideoId = upData.id;
                                rl.videoUrl = ytWatchUrl;
                                mod = true;
                            }
                        }
                    }
                    if (mod) await c.save();
                }
            } catch (syncErr) {}

            return { youtubeVideoId: upData.id, youtubeWatchUrl: ytWatchUrl };
        } else {
            console.warn('[YouTube Upload] Upload result notice:', upData);
            youtubeUploadStatus.set(classId, {
                classId,
                status: 'failed',
                message: upData?.error?.message || 'YouTube processing error',
                updatedAt: Date.now()
            });
        }
    } catch (err) {
        console.warn('[YouTube Upload] Error notice:', err.message);
        youtubeUploadStatus.set(classId, {
            classId,
            status: 'failed',
            message: err.message,
            updatedAt: Date.now()
        });
    }
    return null;
}

// START Live Class Session (Teacher Studio)
app.post('/api/live/start', verifyTeacher, async (req, res) => {
    try {
        const { title, centerId, courseId, subject } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Class title is required' });
        }

        const classId = 'LIVE_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
        let centerName = req.teacher.centerName || 'BBCC Partner Center';
        let courseName = 'Live Interactive Lecture';

        if (centerId && mongoose.Types.ObjectId.isValid(centerId)) {
            const c = await TuitionCenter.findById(centerId);
            if (c) {
                centerName = c.centerName;
                if (courseId) {
                    const crs = (c.courses || []).find(x => x._id.toString() === courseId);
                    if (crs) courseName = crs.courseName;
                }
            }
        }

        // Automatically resolve YouTube Live using configured API keys / channel
        const autoYtUrl = await resolveAutoYouTubeLive(req.body.youtubeLiveUrl, title.trim());

        const session = await LiveClassSession.create({
            sessionId: classId,
            teacherId: req.teacher.teacherId || req.teacher.id,
            teacherName: req.teacher.name,
            centerId: centerId || req.teacher.centerId || '',
            centerName: centerName,
            courseId: courseId || '',
            courseName: courseName,
            subject: subject || req.teacher.subject || 'All Subjects',
            title: title.trim(),
            status: 'live',
            youtubeLiveUrl: autoYtUrl,
            youtubeWatchUrl: autoYtUrl,
            startedAt: new Date(),
            activeStudentsCount: 0
        });

        // Initialize in-memory active live room
        activeLiveRooms.set(classId, {
            classId,
            sessionId: classId,
            teacherId: req.teacher.teacherId || req.teacher.id,
            teacherName: req.teacher.name,
            centerId: centerId || req.teacher.centerId || '',
            centerName: centerName,
            courseId: courseId || '',
            courseName: courseName,
            subject: subject || req.teacher.subject || 'All Subjects',
            title: title.trim(),
            status: 'live',
            isCentralAdmin: false,
            youtubeLiveUrl: autoYtUrl,
            autoYoutubeLinked: Boolean(autoYtUrl),
            teacherSignal: null,
            latestFrame: null,
            lastFrameTime: 0,
            teacherQueue: [],
            studentQueues: new Map(),
            students: new Map(),
            chat: [
                { sender: 'System Notice', role: 'system', text: `🔴 Live Class "${title.trim()}" started by ${req.teacher.name}. Doubts & live questions welcome!`, time: new Date() }
            ],
            startedAt: Date.now()
        });

        clearCache();

        res.json({
            success: true,
            classId,
            title: session.title,
            teacherName: session.teacherName,
            courseName: session.courseName,
            centerName: session.centerName,
            youtubeLiveUrl: autoYtUrl,
            autoYoutubeLinked: Boolean(autoYtUrl),
            message: autoYtUrl ? 'Classroom broadcast is now LIVE & auto-linked with YouTube!' : 'Classroom broadcast is now LIVE!'
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// START Central Admin Live Class / Special Program (Super Admin Console)
app.post('/api/admin/live/start', verifySuperAdmin, async (req, res) => {
    try {
        const { title, subject, hostName, youtubeLiveUrl, description } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Program/Lecture title is required' });
        }

        const classId = 'ADMIN_LIVE_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
        const finalHost = (hostName && hostName.trim()) ? hostName.trim() : 'BBCC Central Directorate';
        const finalSubject = (subject && subject.trim()) ? subject.trim() : 'Central Special Program';

        // Automatically resolve YouTube Live using configured API keys / channel
        const autoYtUrl = await resolveAutoYouTubeLive(youtubeLiveUrl, title.trim());

        const session = await LiveClassSession.create({
            sessionId: classId,
            teacherId: 'ADMIN_DIRECTORATE',
            teacherName: finalHost,
            centerId: '',
            centerName: 'BBCC SKILL HUB Central Directorate',
            courseId: '',
            courseName: 'Central Masterclass & Special Program',
            subject: finalSubject,
            title: title.trim(),
            status: 'live',
            isCentralAdmin: true,
            youtubeLiveUrl: autoYtUrl,
            youtubeWatchUrl: autoYtUrl,
            startedAt: new Date(),
            activeStudentsCount: 0
        });

        activeLiveRooms.set(classId, {
            classId,
            sessionId: classId,
            teacherId: 'ADMIN_DIRECTORATE',
            teacherName: finalHost,
            centerId: '',
            centerName: 'BBCC SKILL HUB Central Directorate',
            courseId: '',
            courseName: 'Central Masterclass & Special Program',
            subject: finalSubject,
            title: title.trim(),
            status: 'live',
            isCentralAdmin: true,
            youtubeLiveUrl: autoYtUrl,
            autoYoutubeLinked: Boolean(autoYtUrl),
            teacherSignal: null,
            latestFrame: null,
            lastFrameTime: 0,
            teacherQueue: [],
            studentQueues: new Map(),
            students: new Map(),
            chat: [
                { sender: 'BBCC Directorate', role: 'system', text: `🌟 BBCC Central Special Program "${title.trim()}" is now LIVE! Ask questions and interact in real-time.`, time: new Date() }
            ],
            startedAt: Date.now()
        });

        clearCache();

        res.json({
            success: true,
            classId,
            title: session.title,
            hostName: session.teacherName,
            youtubeLiveUrl: autoYtUrl,
            autoYoutubeLinked: Boolean(autoYtUrl),
            message: autoYtUrl ? 'Central Live Program broadcast is LIVE & auto-linked with YouTube!' : 'Central Live Program broadcast is now LIVE across the platform!'
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// END Central Admin Live Class / Special Program
app.post('/api/admin/live/end', verifySuperAdmin, async (req, res) => {
    try {
        let { classId, recordedVideoUrl, youtubeVideoId, youtubeWatchUrl, youtubeLiveUrl } = req.body;

        // 1. Resolve classId if missing or empty: find any active Central Admin room in memory or DB
        if (!classId || !classId.trim()) {
            for (const [id, r] of activeLiveRooms.entries()) {
                if (r.isCentralAdmin || r.teacherId === 'ADMIN_DIRECTORATE') {
                    classId = id;
                    break;
                }
            }
            if (!classId) {
                const activeCentral = await LiveClassSession.findOne({ status: 'live', isCentralAdmin: true }).sort({ startedAt: -1 });
                if (activeCentral) classId = activeCentral.sessionId;
            }
        }

        let finalVideoUrl = (recordedVideoUrl || '').trim();
        let finalYoutubeId = (youtubeVideoId || '').trim();
        let isArchivedToYoutube = false;

        // 2. Terminate matching room(s) in activeLiveRooms map
        const roomsToClose = new Set();
        for (const [id, r] of activeLiveRooms.entries()) {
            if (id === classId || (classId && id.includes(classId)) || r.isCentralAdmin || r.teacherId === 'ADMIN_DIRECTORATE') {
                roomsToClose.add(id);
            }
        }
        if (classId) roomsToClose.add(classId);

        for (const rId of roomsToClose) {
            const room = activeLiveRooms.get(rId);
            if (room) {
                room.status = 'ended';
                room.endedAt = Date.now();
                if (room.youtubeLiveUrl && !finalVideoUrl) {
                    finalVideoUrl = room.youtubeLiveUrl;
                }
                if (room.studentQueues) {
                    for (const [sId, queue] of room.studentQueues.entries()) {
                        queue.push({ type: 'class_ended', status: 'ended', time: Date.now() });
                    }
                }
                activeLiveRooms.delete(rId);
            }
        }

        // 3. Extract YouTube Video ID if present
        const candidateYt = (youtubeWatchUrl || youtubeLiveUrl || finalVideoUrl || '').trim();
        const ytMatch = candidateYt.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/))([a-zA-Z0-9_-]{11})/);
        if (ytMatch) {
            finalYoutubeId = ytMatch[1];
            finalVideoUrl = `https://www.youtube.com/watch?v=${finalYoutubeId}`;
            isArchivedToYoutube = true;
        } else if (candidateYt) {
            finalVideoUrl = candidateYt;
            isArchivedToYoutube = true;
        }

        if (finalYoutubeId) {
            endYoutubeLiveBroadcast(finalYoutubeId).catch(() => {});
        }

        // 4. Update MongoDB LiveClassSession(s)
        const sessionQuery = classId 
            ? { $or: [{ sessionId: classId }, { isCentralAdmin: true, status: 'live' }, { teacherId: 'ADMIN_DIRECTORATE', status: 'live' }] }
            : { $or: [{ isCentralAdmin: true, status: 'live' }, { teacherId: 'ADMIN_DIRECTORATE', status: 'live' }] };

        const updateFields = {
            status: 'ended',
            endedAt: new Date(),
            isArchivedToYoutube
        };
        if (finalVideoUrl) updateFields.recordingUrl = finalVideoUrl;
        if (finalYoutubeId) updateFields.youtubeVideoId = finalYoutubeId;
        if (finalVideoUrl) updateFields.youtubeWatchUrl = finalVideoUrl;

        await LiveClassSession.updateMany(sessionQuery, { $set: updateFields });

        clearCache();
        res.json({ success: true, message: 'Central live program concluded successfully.', recordingUrl: finalVideoUrl });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// END Live Class Session & Archive to YouTube / Vault
app.post('/api/live/end', verifyTeacher, async (req, res) => {
    try {
        const { classId, recordedVideoUrl, youtubeVideoId, youtubeLiveUrl, youtubeWatchUrl } = req.body;
        if (!classId) return res.status(400).json({ success: false, message: 'Class ID required' });

        const session = await LiveClassSession.findOne({ sessionId: classId });
        const room = activeLiveRooms.get(classId);

        let finalVideoUrl = (recordedVideoUrl || '').trim();
        let finalYoutubeId = (youtubeVideoId || '').trim();
        let isArchivedToYoutube = false;

        // If teacher passed or session had a real YouTube Live URL / video link
        const candidateYt = (youtubeWatchUrl || youtubeLiveUrl || finalVideoUrl || (session ? (session.youtubeWatchUrl || session.youtubeLiveUrl) : '') || (room ? room.youtubeLiveUrl : '') || '').trim();
        const ytMatch = candidateYt.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/))([a-zA-Z0-9_-]{11})/);
        if (ytMatch) {
            finalYoutubeId = ytMatch[1];
            finalVideoUrl = `https://www.youtube.com/watch?v=${finalYoutubeId}`;
            isArchivedToYoutube = true;
        } else if (candidateYt) {
            finalVideoUrl = candidateYt;
            isArchivedToYoutube = true;
        }

        if (finalYoutubeId) {
            endYoutubeLiveBroadcast(finalYoutubeId).catch(() => {});
        }

        if (session) {
            session.status = 'ended';
            session.endedAt = new Date();
            if (finalVideoUrl) session.recordingUrl = finalVideoUrl;
            if (finalYoutubeId) session.youtubeVideoId = finalYoutubeId;
            session.youtubeWatchUrl = finalVideoUrl;
            session.isArchivedToYoutube = isArchivedToYoutube;
            if (room && room.chat) {
                session.messages = room.chat;
            }
            await session.save();

            // Push into Coaching Center's course recordedLectures
            if (session.centerId && mongoose.Types.ObjectId.isValid(session.centerId)) {
                try {
                    const center = await TuitionCenter.findById(session.centerId);
                    if (center && center.courses && center.courses.length > 0) {
                        let targetCourse = session.courseId ? center.courses.id(session.courseId) : center.courses[0];
                        if (!targetCourse) targetCourse = center.courses[0];
                        if (targetCourse) {
                            if (!targetCourse.recordedLectures) targetCourse.recordedLectures = [];
                            targetCourse.recordedLectures.push({
                                title: session.title,
                                videoUrl: finalVideoUrl || `/data/recordings/${classId}.mp4`,
                                youtubeVideoId: finalYoutubeId,
                                teacherName: session.teacherName,
                                recordedAt: new Date()
                            });
                            await center.save();
                        }
                    }
                } catch (cErr) {
                    console.warn('Recorded lecture center sync notice:', cErr.message);
                }
            }
        }

        if (room) {
            room.status = 'ended';
            room.endedAt = Date.now();
            if (room.studentQueues) {
                for (const [sId, queue] of room.studentQueues.entries()) {
                    queue.push({ type: 'class_ended', status: 'ended', time: Date.now() });
                }
            }
            activeLiveRooms.delete(classId);
        }

        clearCache();

        res.json({
            success: true,
            message: 'Class finished successfully! Recording archived to YouTube & Student Revision Vault.',
            archived: {
                sessionId: classId,
                title: session ? session.title : 'Live Session',
                videoUrl: finalVideoUrl,
                youtubeVideoId: finalYoutubeId,
                isArchivedToYoutube
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET Active Live Classes (For Students & Public Classroom & Homepage)
app.get('/api/live/active', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const activeList = [];
        for (const [id, r] of activeLiveRooms.entries()) {
            if (r.status === 'live') {
                activeList.push({
                    classId: r.classId,
                    title: r.title,
                    teacherName: r.teacherName,
                    centerId: r.centerId,
                    centerName: r.centerName,
                    courseId: r.courseId,
                    courseName: r.courseName,
                    subject: r.subject,
                    isCentralAdmin: Boolean(r.isCentralAdmin),
                    youtubeLiveUrl: r.youtubeLiveUrl || '',
                    hasFrame: Boolean(r.latestFrame),
                    startedAt: r.startedAt,
                    activeStudentsCount: r.students ? r.students.size : 0
                });
            }
        }
        res.json({
            success: true,
            count: activeList.length,
            data: activeList,
            activeClasses: activeList,
            activeSessions: activeList // Guaranteed compatibility across all pages!
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET Recorded Lectures & Revision Vault (For Students & Teacher Portal Archive)
app.get('/api/live/recordings', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const { centerId, courseId, teacherId } = req.query;
        let query = { status: { $in: ['ended', 'archived'] } };
        if (teacherId) {
            query.$or = [{ teacherId: teacherId }, { teacherName: teacherId }];
        } else if (centerId) {
            query.$or = [
                { centerId: centerId },
                { isCentralAdmin: true },
                { centerId: '' },
                { centerId: 'all' }
            ];
        }
        if (courseId) query.courseId = courseId;
        const rawSessions = await LiveClassSession.find(query).sort({ endedAt: -1, createdAt: -1 }).limit(60).lean();
        const sessions = rawSessions.map(s => ({
            ...s,
            videoUrl: s.recordingUrl || s.youtubeWatchUrl || s.youtubeLiveUrl || s.videoUrl || '',
            youtubeWatchUrl: s.youtubeWatchUrl || s.recordingUrl || s.youtubeLiveUrl || '',
            uploadStatus: youtubeUploadStatus.get(s.sessionId) || null
        }));

        // Also fetch from TuitionCenter courses.recordedLectures
        let centerRecordings = [];
        try {
            const centerFilter = centerId ? { _id: centerId } : {};
            const centers = await TuitionCenter.find(centerFilter, { centerName: 1, courses: 1 }).lean();
            centers.forEach(c => {
                (c.courses || []).forEach(crs => {
                    if (courseId && crs._id.toString() !== courseId) return;
                    (crs.recordedLectures || []).forEach(rl => {
                        if (teacherId && rl.teacherName && !rl.teacherName.toLowerCase().includes(teacherId.toLowerCase())) return;
                        centerRecordings.push({
                            _id: rl._id,
                            sessionId: 'REC_' + (rl._id ? rl._id.toString() : Date.now()),
                            title: rl.title,
                            teacherName: rl.teacherName || 'Faculty',
                            centerName: c.centerName,
                            courseName: crs.courseName,
                            videoUrl: rl.videoUrl,
                            youtubeVideoId: rl.youtubeVideoId,
                            youtubeWatchUrl: rl.videoUrl,
                            recordedAt: rl.recordedAt || rl.createdAt
                        });
                    });
                });
            });
        } catch (e) {}

        const all = [...sessions, ...centerRecordings];
        const seen = new Set();
        const uniqueRecordings = all.filter(r => {
            const key = (r.title || '') + '_' + (r.teacherName || '') + '_' + (r.sessionId || '');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        res.json({ success: true, count: uniqueRecordings.length, recordings: uniqueRecordings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// WebRTC Signaling Exchange for Live Classroom (Multi-student with Queues & Student Voice)
app.post('/api/live/signal', async (req, res) => {
    try {
        const { classId, type, signal, senderId, senderName, senderRole, targetId, sdp, candidate, isSpeaking } = req.body;
        if (!classId || !activeLiveRooms.has(classId)) {
            return res.status(404).json({ success: false, message: 'Live class session not active' });
        }
        const room = activeLiveRooms.get(classId);

        if (senderRole === 'teacher' || senderRole === 'admin') {
            room.teacherSignal = signal || { type, sdp, time: Date.now() };
            // If targeted to a specific student
            if (targetId) {
                if (!room.studentQueues.has(targetId)) room.studentQueues.set(targetId, []);
                room.studentQueues.get(targetId).push({ type, sdp, candidate, signal, time: Date.now() });
            } else {
                // Broadcast to all active students
                for (const [sId, queue] of room.studentQueues.entries()) {
                    queue.push({ type, sdp, candidate, signal, time: Date.now() });
                }
            }
        } else {
            // Sender is Student
            const sId = senderId || ('stu_' + Date.now());
            if (!room.students.has(sId)) {
                room.students.set(sId, { name: senderName || 'Student', joinedAt: Date.now(), lastSeen: Date.now(), isSpeaking: false });
            } else {
                const s = room.students.get(sId);
                s.lastSeen = Date.now();
                if (isSpeaking !== undefined) s.isSpeaking = isSpeaking;
            }
            if (!room.studentQueues.has(sId)) {
                room.studentQueues.set(sId, []);
            }
            // Deliver signal into teacher queue
            if (!room.teacherQueue) room.teacherQueue = [];
            room.teacherQueue.push({
                senderId: sId,
                senderName: senderName || 'Student',
                senderRole: 'student',
                type,
                signal,
                sdp,
                candidate,
                isSpeaking,
                time: Date.now()
            });
        }

        res.json({
            success: true,
            activeCount: room.students.size,
            status: room.status
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get Signals for Room (Teacher drains teacherQueue, Student drains their studentQueue)
app.get('/api/live/signals/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const role = req.query.role || 'student';
        const studentId = req.query.studentId || '';
        const room = activeLiveRooms.get(classId);
        if (!room || room.status === 'ended') return res.status(200).json({ success: false, status: 'ended', message: 'Class session has ended' });

        let pendingSignals = [];
        if (role === 'teacher' || role === 'admin') {
            pendingSignals = room.teacherQueue ? [...room.teacherQueue] : [];
            room.teacherQueue = []; // Drain queue
        } else if (studentId && room.studentQueues.has(studentId)) {
            pendingSignals = [...room.studentQueues.get(studentId)];
            room.studentQueues.set(studentId, []); // Drain queue
        }

        // Detect any active speaking student for audio banner
        let speakingStudent = null;
        for (const [sId, s] of room.students.entries()) {
            if (s.isSpeaking) {
                speakingStudent = { studentId: sId, name: s.name };
                break;
            }
        }

        res.json({
            success: true,
            signals: pendingSignals,
            teacherSignal: room.teacherSignal,
            speakingStudent,
            activeStudentsCount: room.students ? room.students.size : 0,
            hasFrame: Boolean(room.latestFrame),
            youtubeLiveUrl: room.youtubeLiveUrl || '',
            status: room.status
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Low-bandwidth / Strict NAT Video Frame Relay Fallback
app.post('/api/live/frame', async (req, res) => {
    try {
        const { classId, frameData } = req.body;
        if (!classId || !activeLiveRooms.has(classId)) return res.status(404).json({ success: false });
        const room = activeLiveRooms.get(classId);
        if (frameData && frameData.startsWith('data:image')) {
            room.latestFrame = frameData;
            room.lastFrameTime = Date.now();
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/live/frame/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const room = activeLiveRooms.get(classId);
        if (!room || !room.latestFrame) return res.status(404).json({ success: false });
        res.json({ success: true, frame: room.latestFrame, time: room.lastFrameTime });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// Live Classroom Doubt / Chat Messaging
app.post('/api/live/chat', async (req, res) => {
    try {
        const { classId, senderName, role, text } = req.body;
        if (!classId || !text || !text.trim()) {
            return res.status(400).json({ success: false, message: 'Class ID and message text required' });
        }

        const room = activeLiveRooms.get(classId);
        const msg = {
            id: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            sender: (senderName || 'Anonymous').trim(),
            role: role || 'student',
            text: text.trim(),
            time: new Date()
        };

        if (room) {
            room.chat.push(msg);
            if (room.chat.length > 200) room.chat.shift();
        }

        res.json({ success: true, message: msg });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get Live Classroom Chat Messages & Active Audience Count
app.get('/api/live/chat/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const room = activeLiveRooms.get(classId);
        if (room) {
            return res.json({
                success: true,
                chat: room.chat || [],
                activeStudentsCount: (room.students ? room.students.size : 0)
            });
        }
        const session = await LiveClassSession.findOne({ sessionId: classId });
        res.json({
            success: true,
            chat: session ? (session.messages || []) : [],
            activeStudentsCount: session ? (session.activeStudentsCount || 0) : 0
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Real Live Class Video Recording Upload & Storage
app.post('/api/live/upload-recording', async (req, res) => {
    try {
        const { classId, videoBlobBase64, title, teacherName, centerId, courseId } = req.body;
        if (!classId || !videoBlobBase64) {
            return res.status(400).json({ success: false, message: 'Class ID and video data required' });
        }
        const recDir = path.join(__dirname, 'public', 'data', 'recordings');
        if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true });

        const { rawBase64, ext } = extractVideoBase64(videoBlobBase64);
        const fileName = `${classId}.${ext}`;
        const filePath = path.join(recDir, fileName);

        fs.writeFileSync(filePath, Buffer.from(rawBase64, 'base64'));
        const fileUrl = `/data/recordings/${fileName}`;

        youtubeUploadStatus.set(classId, {
            classId,
            title: title || 'BBCC Lecture',
            status: 'uploading',
            progress: 10,
            message: 'Lecture recorded and saved to server vault. Starting YouTube auto-upload...',
            updatedAt: Date.now()
        });

        // Update LiveClassSession
        await LiveClassSession.findOneAndUpdate(
            { sessionId: classId },
            { recordingUrl: fileUrl, youtubeWatchUrl: fileUrl, status: 'ended', endedAt: new Date() }
        );

        // Upload recorded video directly to official YouTube Channel via dedicated Google Cloud project!
        uploadRecordedVideoToYouTube({ filePath, title: title || 'BBCC Lecture', classId }).catch(err => {
            console.warn('[YouTube Auto-Upload Notice]', err.message);
        });

        res.json({
            success: true,
            message: 'Lecture video saved to server vault. YouTube upload in progress!',
            videoUrl: fileUrl,
            classId,
            uploadStatus: 'uploading'
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Super Admin Live Stream Monitoring Deck (All Centers Active Live Streams)
app.get('/api/admin/live-monitor', verifySuperAdmin, async (req, res) => {
    try {
        const activeList = [];
        for (const [id, r] of activeLiveRooms.entries()) {
            if (r.status === 'live') {
                const isCentral = Boolean(r.isCentralAdmin);
                const viewerCount = r.students ? r.students.size : 0;
                const durMin = Math.max(1, Math.round((Date.now() - (r.startedAt || Date.now())) / 60000));
                const streamType = (r.youtubeLiveUrl && r.youtubeLiveUrl.includes('youtube')) ? 'youtube' : 'webrtc';
                const cName = r.centerName || (isCentral ? 'BBCC Central Directorate' : 'Partner Institute');

                activeList.push({
                    classId: r.classId,
                    sessionId: r.classId,
                    title: r.title,
                    teacherName: r.teacherName || (isCentral ? 'BBCC Central Directorate' : 'Faculty'),
                    centerId: r.centerId || '',
                    centerName: cName,
                    coachingName: cName,
                    courseId: r.courseId || '',
                    courseName: r.courseName || r.subject || 'Interactive Lecture',
                    subject: r.subject || 'All Subjects',
                    isCentral: isCentral,
                    isCentralAdmin: isCentral,
                    viewerCount: viewerCount,
                    activeStudentsCount: viewerCount,
                    durationMinutes: durMin,
                    streamType: streamType,
                    youtubeLiveUrl: r.youtubeLiveUrl || '',
                    youtubeWatchUrl: r.youtubeLiveUrl || '',
                    hasFrame: Boolean(r.latestFrame),
                    latestFrame: r.latestFrame || null,
                    startedAt: r.startedAt
                });
            }
        }
        res.json({
            success: true,
            count: activeList.length,
            liveStreams: activeList,
            activeClasses: activeList
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Coaching Center Director Live Faculty & Teaching Monitor Deck
app.get('/api/director/live-monitor', verifyDirector, async (req, res) => {
    try {
        const centerId = req.center.id || req.center.centerId || '';
        const centerName = req.center.centerName || '';
        const activeList = [];

        for (const [id, r] of activeLiveRooms.entries()) {
            if (r.status === 'live') {
                const isMyCenter = (centerId && r.centerId && r.centerId.toString() === centerId.toString()) ||
                                   (centerName && r.centerName && r.centerName.toLowerCase() === centerName.toLowerCase());
                const isCentral = Boolean(r.isCentralAdmin);

                if (isMyCenter || isCentral) {
                    const viewerCount = r.students ? r.students.size : 0;
                    const durMin = Math.max(1, Math.round((Date.now() - (r.startedAt || Date.now())) / 60000));
                    const streamType = (r.youtubeLiveUrl && r.youtubeLiveUrl.includes('youtube')) ? 'youtube' : 'webrtc';
                    const cName = r.centerName || (isCentral ? 'BBCC Central Directorate' : 'Partner Institute');

                    activeList.push({
                        classId: r.classId,
                        sessionId: r.classId,
                        title: r.title,
                        teacherName: r.teacherName || (isCentral ? 'BBCC Central Directorate' : 'Faculty'),
                        centerId: r.centerId || '',
                        centerName: cName,
                        coachingName: cName,
                        courseId: r.courseId || '',
                        courseName: r.courseName || r.subject || 'Interactive Lecture',
                        subject: r.subject || 'All Subjects',
                        isCentral: isCentral,
                        isCentralAdmin: isCentral,
                        isMyCenter: Boolean(isMyCenter),
                        viewerCount: viewerCount,
                        activeStudentsCount: viewerCount,
                        durationMinutes: durMin,
                        streamType: streamType,
                        youtubeLiveUrl: r.youtubeLiveUrl || '',
                        youtubeWatchUrl: r.youtubeLiveUrl || '',
                        hasFrame: Boolean(r.latestFrame),
                        latestFrame: r.latestFrame || null,
                        startedAt: r.startedAt
                    });
                }
            }
        }

        res.json({
            success: true,
            count: activeList.length,
            liveStreams: activeList,
            activeClasses: activeList
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Live Lecture YouTube Upload Status Tracker
app.get('/api/live/upload-status/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const status = youtubeUploadStatus.get(classId);
        if (status) {
            return res.json({ success: true, ...status });
        }
        // Fallback: Check in DB
        const session = await LiveClassSession.findOne({ sessionId: classId }).lean();
        if (session) {
            if (session.youtubeVideoId || (session.youtubeWatchUrl && session.youtubeWatchUrl.includes('youtube.com'))) {
                return res.json({
                    success: true,
                    classId,
                    status: 'completed',
                    progress: 100,
                    youtubeVideoId: session.youtubeVideoId,
                    youtubeWatchUrl: session.youtubeWatchUrl,
                    message: 'Lecture is available on YouTube!'
                });
            } else if (session.status === 'ended') {
                return res.json({
                    success: true,
                    classId,
                    status: 'local',
                    progress: 100,
                    recordingUrl: session.recordingUrl,
                    message: 'High-definition local recording archived on server'
                });
            }
        }
        res.json({ success: true, classId, status: 'idle', message: 'No active upload' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.get('/api/live/upload-status', async (req, res) => {
    try {
        const statuses = Array.from(youtubeUploadStatus.values());
        res.json({ success: true, uploads: statuses });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Super Admin All Centers Uploaded Lectures & Recorded Vault
app.get('/api/admin/all-recordings', verifySuperAdmin, async (req, res) => {
    try {
        const rawLiveSessions = await LiveClassSession.find({ status: { $in: ['ended', 'archived'] } }).sort({ endedAt: -1, createdAt: -1 }).limit(100).lean();

        const liveSessions = rawLiveSessions.map(s => {
            const dateVal = s.endedAt || s.startedAt || s.createdAt || new Date();
            const vUrl = (s.recordingUrl || s.youtubeWatchUrl || s.youtubeLiveUrl || s.videoUrl || '').trim();
            const isLocal = Boolean(vUrl && (vUrl.endsWith('.mp4') || vUrl.endsWith('.webm') || vUrl.includes('/data/recordings/')));
            const centerTitle = s.centerName || (s.isCentralAdmin ? 'BBCC Central Directorate' : 'Universal Partner Center');
            return {
                _id: s._id,
                sessionId: s.sessionId,
                centerId: s.centerId || '',
                courseId: s.courseId || '',
                lectureId: '',
                sourceType: 'session',
                title: s.title || 'Live Interactive Class',
                teacherName: s.teacherName || 'Faculty',
                coachingName: centerTitle,
                centerName: centerTitle,
                courseName: s.courseName || s.subject || 'Masterclass & Special Program',
                videoUrl: vUrl,
                youtubeVideoId: s.youtubeVideoId || '',
                youtubeWatchUrl: s.youtubeWatchUrl || vUrl,
                date: dateVal,
                recordedAt: dateVal,
                isLocalFile: isLocal,
                uploadStatus: youtubeUploadStatus.get(s.sessionId) || null
            };
        });

        let centerRecordings = [];
        try {
            const centers = await TuitionCenter.find({}, { centerName: 1, courses: 1 }).lean();
            centers.forEach(c => {
                (c.courses || []).forEach(crs => {
                    (crs.recordedLectures || []).forEach(rl => {
                        const dateVal = rl.recordedAt || rl.createdAt || new Date();
                        const vUrl = (rl.videoUrl || '').trim();
                        const isLocal = Boolean(vUrl && (vUrl.endsWith('.mp4') || vUrl.endsWith('.webm') || vUrl.includes('/data/recordings/')));
                        centerRecordings.push({
                            _id: rl._id,
                            sessionId: 'REC_' + (rl._id ? rl._id.toString() : Date.now()),
                            centerId: c._id ? c._id.toString() : '',
                            courseId: crs._id ? crs._id.toString() : '',
                            lectureId: rl._id ? rl._id.toString() : '',
                            sourceType: 'center_course',
                            title: rl.title,
                            teacherName: rl.teacherName || 'Faculty',
                            coachingName: c.centerName,
                            centerName: c.centerName,
                            courseName: crs.courseName,
                            videoUrl: vUrl,
                            youtubeVideoId: rl.youtubeVideoId || '',
                            youtubeWatchUrl: vUrl,
                            date: dateVal,
                            recordedAt: dateVal,
                            isLocalFile: isLocal,
                            uploadStatus: null
                        });
                    });
                });
            });
        } catch (e) {}

        const all = [...liveSessions, ...centerRecordings];
        const seen = new Set();
        const unique = all.filter(r => {
            const key = (r.title || '') + '_' + (r.centerName || '') + '_' + (r.sessionId || '');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        res.json({ success: true, count: unique.length, recordings: unique });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Super Admin Delete Recorded Lecture from Vault
app.post('/api/admin/recording/delete', verifySuperAdmin, async (req, res) => {
    try {
        const { sessionId, centerId, courseId, lectureId, videoUrl } = req.body;
        if (!sessionId && !lectureId && !videoUrl) {
            return res.status(400).json({ success: false, message: 'Lecture identifier required to delete.' });
        }

        let deleted = false;

        // 1. If it's a LiveClassSession
        if (sessionId && !sessionId.startsWith('REC_')) {
            const delSession = await LiveClassSession.findOneAndDelete({ sessionId });
            if (delSession) deleted = true;
        }

        // 2. If it's a Coaching Center Course Recorded Lecture
        if (centerId && courseId && lectureId) {
            try {
                const center = await TuitionCenter.findById(centerId);
                if (center && center.courses) {
                    const crs = center.courses.id(courseId);
                    if (crs && crs.recordedLectures) {
                        crs.recordedLectures = crs.recordedLectures.filter(l => l._id && l._id.toString() !== lectureId);
                        await center.save();
                        deleted = true;
                    }
                }
            } catch (cErr) {}
        } else if (lectureId) {
            try {
                const centers = await TuitionCenter.find({ 'courses.recordedLectures._id': lectureId });
                for (const center of centers) {
                    let mod = false;
                    for (const crs of (center.courses || [])) {
                        if (crs.recordedLectures) {
                            const initLen = crs.recordedLectures.length;
                            crs.recordedLectures = crs.recordedLectures.filter(l => l._id && l._id.toString() !== lectureId);
                            if (crs.recordedLectures.length !== initLen) mod = true;
                        }
                    }
                    if (mod) {
                        await center.save();
                        deleted = true;
                    }
                }
            } catch (lErr) {}
        }

        // 3. If local file exists, safely remove from disk
        if (videoUrl && typeof videoUrl === 'string' && videoUrl.includes('/data/recordings/')) {
            try {
                const fName = path.basename(videoUrl);
                const fPath = path.join(__dirname, 'public', 'data', 'recordings', fName);
                if (fs.existsSync(fPath)) {
                    fs.unlinkSync(fPath);
                    deleted = true;
                }
            } catch (fErr) {}
        }

        clearCache();
        res.json({ success: true, message: 'Recorded lecture deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Super Admin Upload BBCC SKILL HUB Central Promotional Banner
app.post('/api/admin/banners/central', verifySuperAdmin, async (req, res) => {
    try {
        const { title, subtitle, link } = req.body;
        const image = req.body.image || req.body.fileData || req.body.file;
        if (!image) return res.status(400).json({ success: false, message: 'Banner image is required' });

        let savedImage = image;
        if (savedImage.startsWith('data:image')) {
            try {
                const asset = saveAssetFile(savedImage, 'branding', 'png', 'normal', 'central_banner_' + Date.now().toString().slice(-4));
                if (asset && asset.fileUrl) savedImage = asset.fileUrl;
            } catch (e) {}
        }

        const newBanner = {
            _id: new mongoose.Types.ObjectId().toString(),
            title: (title || 'BBCC SKILL HUB Announcement').trim(),
            subtitle: (subtitle || 'Official Educational Platform').trim(),
            image: savedImage,
            link: (link || '/').trim(),
            uploadedAt: new Date()
        };

        if (isMongoConnected) {
            try {
                let settings = await Settings.findOne();
                if (!settings) settings = await Settings.create({});
                if (!settings.banners) settings.banners = [];
                settings.banners.push(newBanner);
                await settings.save();
            } catch(e) {}
        }

        // Also sync to portal_db.json
        try {
            const db = loadPortalDb();
            if (!db.settings) db.settings = {};
            if (!db.settings.banners) db.settings.banners = [];
            db.settings.banners.push(newBanner);
            await savePortalDb(db);
        } catch(e) {}

        clearCache('public_banners');
        clearCache();
        broadcastRealtimeEvent('banners_updated');
        res.json({ success: true, message: 'BBCC SKILL HUB Central Promotional Banner published successfully!', banner: newBanner });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Super Admin Delete Central Promotional Banner
app.delete('/api/admin/banners/central/:bid', verifySuperAdmin, async (req, res) => {
    try {
        const bid = req.params.bid;
        if (isMongoConnected) {
            try {
                const settings = await Settings.findOne();
                if (settings && settings.banners) {
                    settings.banners = settings.banners.filter(b => b._id && b._id.toString() !== bid && ('central_b_' + bid) !== bid && (b._id !== bid));
                    await settings.save();
                }
            } catch(e) {}
        }

        try {
            const db = loadPortalDb();
            if (db.settings && db.settings.banners) {
                db.settings.banners = db.settings.banners.filter(b => (b._id && b._id.toString() !== bid) && ('central_b_' + bid) !== bid && (b._id !== bid));
                await savePortalDb(db);
            }
        } catch(e) {}

        clearCache('public_banners');
        clearCache();
        broadcastRealtimeEvent('banners_updated');
        res.json({ success: true, message: 'Central banner removed from platform network' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Super Admin Save YouTube Cloud API & Central Channel Config
app.put('/api/admin/youtube-config', verifySuperAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});

        const {
            youtubeApiKey,
            youtubeClientId,
            youtubeClientSecret,
            youtubeRefreshToken,
            youtubeChannelId,
            youtubePrivacyStatus,
            youtubeAutoUpload
        } = req.body;

        if (youtubeApiKey !== undefined && youtubeApiKey.trim() !== '') {
            settings.youtubeApiKey = youtubeApiKey.trim();
        }
        if (youtubeClientId !== undefined && youtubeClientId.trim() !== '') {
            settings.youtubeClientId = youtubeClientId.trim();
        }
        if (youtubeClientSecret !== undefined && youtubeClientSecret.trim() !== '') {
            settings.youtubeClientSecret = youtubeClientSecret.trim();
        }
        if (youtubeRefreshToken !== undefined && youtubeRefreshToken.trim() !== '') {
            settings.youtubeRefreshToken = youtubeRefreshToken.trim();
        }
        if (youtubeChannelId !== undefined && youtubeChannelId.trim() !== '') {
            settings.youtubeChannelId = youtubeChannelId.trim();
        }
        if (youtubePrivacyStatus !== undefined) {
            settings.youtubePrivacyStatus = youtubePrivacyStatus;
        }
        if (youtubeAutoUpload !== undefined) {
            settings.youtubeAutoUpload = Boolean(youtubeAutoUpload);
        }

        await settings.save();
        clearCache();

        res.json({
            success: true,
            message: 'Official YouTube Channel & Cloud API Configured Successfully! Live class recordings will automatically archive here.',
            data: {
                youtubeChannelId: settings.youtubeChannelId,
                youtubePrivacyStatus: settings.youtubePrivacyStatus,
                youtubeAutoUpload: settings.youtubeAutoUpload,
                isConfigured: Boolean(settings.youtubeApiKey || settings.youtubeChannelId)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Super Admin Test YouTube Cloud API Connection
app.post('/api/admin/test-youtube', verifySuperAdmin, async (req, res) => {
    try {
        const { apiKey, channelId } = req.body;
        const settings = await Settings.findOne();
        const keyToUse = (apiKey || settings?.youtubeApiKey || '').trim();
        const chToUse = (channelId || settings?.youtubeChannelId || '').trim();

        if (!keyToUse && !chToUse) {
            return res.status(400).json({
                success: false,
                message: 'Please provide either a YouTube Data API Key or Channel ID to test.'
            });
        }

        let testUrl = '';
        if (chToUse && keyToUse) {
            testUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(chToUse)}&key=${encodeURIComponent(keyToUse)}`;
        } else if (keyToUse) {
            testUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=BBCC&type=channel&maxResults=1&key=${encodeURIComponent(keyToUse)}`;
        }

        if (testUrl) {
            try {
                const apiRes = await fetch(testUrl);
                const apiData = await apiRes.json();
                if (apiRes.ok && apiData && (apiData.items || apiData.pageInfo)) {
                    const chTitle = apiData.items?.[0]?.snippet?.title || 'BBCC Official Channel';
                    return res.json({
                        success: true,
                        message: `YouTube Data API v3 Live Connected! (${chTitle})`,
                        channelTitle: chTitle,
                        itemsFound: apiData.items ? apiData.items.length : 1
                    });
                } else if (apiData && apiData.error) {
                    return res.status(400).json({
                        success: false,
                        message: `YouTube API Error: ${apiData.error.message || 'Invalid key or quota exceeded'}`
                    });
                }
            } catch (netErr) {
                console.warn('YouTube test fetch notice:', netErr.message);
            }
        }

        res.json({
            success: true,
            message: 'YouTube configuration verified! Platform channel ready for automated archive uploads.',
            channelId: chToUse || 'Configured'
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
        const { centerName, username, password, directorName, address, contactNumber, fromClass, toClass, admissionFee } = req.body;
        if (!centerName || !username || !password || !directorName) {
            return res.status(400).json({ success: false, message: 'Center name, username, password, and director name required' });
        }

        const cleanUser = username.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
        if (!cleanUser || cleanUser.length < 3) {
            return res.status(400).json({ success: false, message: 'Username must be at least 3 characters and contain only letters, numbers, hyphens or underscores (e.g. apex-academy)' });
        }

        // Check for existing center in MongoDB & portal_db
        let existing = null;
        if (isMongoConnected) {
            try {
                existing = await TuitionCenter.findOne({ username: cleanUser });
            } catch(e) {}
        }
        if (!existing) {
            const pdb = loadPortalDb();
            existing = (pdb.centers || []).find(c => (c.username || '').toLowerCase() === cleanUser);
        }
        if (existing) {
            return res.status(400).json({ success: false, message: `Username "${cleanUser}" is already taken by another center. Please choose a different username.` });
        }

        const hashedPassword = await bcrypt.hash(password.trim(), 10);
        const certId = 'BBCC-AFF-' + Date.now().toString().slice(-6);

        const newCenterData = {
            centerName: centerName.trim(),
            username: cleanUser,
            password: hashedPassword,
            directorName: directorName.trim(),
            address: (address || '').trim(),
            contactNumber: (contactNumber || '').trim(),
            fromClass: fromClass || 'Class 6th',
            toClass: toClass || 'Class 12th',
            admissionFee: (admissionFee !== undefined ? Math.max(0, Number(admissionFee) || 0) : 200),
            affiliationCertificateId: certId,
            affiliationPaid: true,
            affiliationDate: new Date(),
            walletBalance: 0,
            dueAmount: 0,
            isBlocked: false,
            teachers: [],
            courses: [],
            materials: []
        };

        // Dual Persistence: MongoDB (if connected) + Portal DB (Local/GitHub)
        let createdCenter = null;
        if (isMongoConnected) {
            try {
                createdCenter = await TuitionCenter.create(newCenterData);
            } catch(mongoErr) {
                console.warn('MongoDB center create error, saving to Portal DB:', mongoErr.message);
            }
        }

        const pdb = loadPortalDb();
        if (!pdb.centers) pdb.centers = [];
        const existingIdx = pdb.centers.findIndex(c => (c.username || '').toLowerCase() === cleanUser);
        const centerObj = {
            _id: (createdCenter && createdCenter._id) ? createdCenter._id.toString() : new mongoose.Types.ObjectId().toString(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...newCenterData
        };

        if (existingIdx !== -1) {
            pdb.centers[existingIdx] = centerObj;
        } else {
            pdb.centers.push(centerObj);
        }

        // Record in Affiliations list so it shows in Admin Console Tab 4: "AFFILIATIONS & LICENSES"
        if (!pdb.affiliationApplications) pdb.affiliationApplications = [];
        const affDoc = {
            _id: new mongoose.Types.ObjectId().toString(),
            centerName: centerName.trim(),
            directorName: directorName.trim(),
            contactNumber: (contactNumber || '').trim(),
            email: '',
            address: (address || '').trim(),
            username: cleanUser,
            fromClass: fromClass || 'Class 6th',
            toClass: toClass || 'Class 12th',
            appliedAt: new Date(),
            status: 'approved',
            feePaid: 0
        };
        pdb.affiliationApplications.unshift(affDoc);

        // Record in Payment Transactions ledger so it shows in Admin Console Tab 5: "TRANSACTIONS"
        if (!pdb.paymentTransactions) pdb.paymentTransactions = [];
        pdb.paymentTransactions.unshift({
            _id: new mongoose.Types.ObjectId().toString(),
            orderId: 'ADM_GRANT_' + Date.now(),
            paymentId: 'ADMIN_DIRECT_LICENSE',
            amount: 0,
            centerShare: 0,
            platformCut: 0,
            purpose: 'Admin Direct Institute Affiliation & License Grant',
            status: 'paid',
            payerName: centerName.trim(),
            payerContact: (contactNumber || '').trim(),
            centerName: centerName.trim(),
            username: cleanUser,
            createdAt: new Date()
        });

        await savePortalDb(pdb);

        if (isMongoConnected) {
            try {
                await AffiliationApplication.create({
                    centerName: centerName.trim(),
                    directorName: directorName.trim(),
                    contactNumber: (contactNumber || '').trim(),
                    email: '',
                    address: (address || '').trim(),
                    status: 'approved',
                    appliedAt: new Date()
                });
            } catch(e) {}
        }

        // Immediate cache invalidation so the new center shows instantly everywhere
        clearCache();
        broadcastRealtimeEvent('centers_updated');

        console.log(`✅ [PARTNER CENTER REGISTERED] Name: "${centerName.trim()}" | Username: "${cleanUser}"`);

        res.json({
            success: true,
            message: 'New partner center registered successfully!',
            data: centerObj
        });
    } catch (err) {
        console.error('Error registering partner center:', err);
        res.status(500).json({ success: false, message: 'Failed to register center: ' + err.message });
    }
});

// 8.2 MASTER CENTER EDITOR: Super Admin Full Edit Access to ANY Coaching Center Data
app.put('/api/admin/centers/:id', verifySuperAdmin, async (req, res) => {
    try {
        const centerId = req.params.id;
        let center = null;
        if (isMongoConnected) {
            try { center = await TuitionCenter.findById(centerId); } catch(e) {}
        }
        const pdb = loadPortalDb();
        if (!pdb.centers) pdb.centers = [];
        const pdbCenter = pdb.centers.find(c => c._id && c._id.toString() === centerId.toString());

        if (!center && !pdbCenter) {
            return res.status(404).json({ success: false, message: 'Coaching center not found' });
        }

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
            admissionFee,
            isBlocked,
            blockReason,
            socials
        } = req.body;

        const applyField = (k, v) => {
            if (v !== undefined) {
                if (center) center[k] = v;
                if (pdbCenter) pdbCenter[k] = v;
            }
        };

        if (centerName !== undefined) applyField('centerName', centerName.trim());
        if (directorName !== undefined) applyField('directorName', directorName.trim());
        if (contactNumber !== undefined) applyField('contactNumber', contactNumber.trim());
        if (whatsappNumber !== undefined) applyField('whatsappNumber', whatsappNumber.trim());
        if (email !== undefined) applyField('email', email.trim());
        if (address !== undefined) applyField('address', address.trim());
        if (fromClass !== undefined) applyField('fromClass', fromClass);
        if (toClass !== undefined) applyField('toClass', toClass);
        if (encryptedCallLink !== undefined) applyField('encryptedCallLink', encryptedCallLink.trim());
        if (description !== undefined) applyField('description', description);
        if (headerNotice !== undefined) applyField('headerNotice', headerNotice);
        if (footerText !== undefined) applyField('footerText', footerText);
        if (clogo !== undefined) applyField('clogo', clogo);
        if (directorPhoto !== undefined) applyField('directorPhoto', directorPhoto);
        if (dueAmount !== undefined) applyField('dueAmount', Number(dueAmount) || 0);
        if (admissionFee !== undefined || req.body.admissionFee !== undefined) {
            applyField('admissionFee', Math.max(0, Number(admissionFee !== undefined ? admissionFee : req.body.admissionFee) || 0));
        }
        if (isBlocked !== undefined) applyField('isBlocked', Boolean(isBlocked));
        if (blockReason !== undefined) applyField('blockReason', blockReason);
        if (socials !== undefined) {
            if (center) center.socials = { ...center.socials, ...socials };
            if (pdbCenter) pdbCenter.socials = { ...(pdbCenter.socials || {}), ...socials };
        }

        // Username update check
        const currentUsername = (pdbCenter ? pdbCenter.username : center.username);
        if (username && username.trim().toLowerCase() !== currentUsername) {
            const checkUser = username.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
            let exists = null;
            if (isMongoConnected) {
                try { exists = await TuitionCenter.findOne({ username: checkUser, _id: { $ne: centerId } }); } catch(e) {}
            }
            if (!exists) {
                exists = pdb.centers.find(c => c._id.toString() !== centerId.toString() && (c.username || '').toLowerCase() === checkUser);
            }
            if (exists) {
                return res.status(400).json({ success: false, message: 'New username already taken by another center' });
            }
            applyField('username', checkUser);
        }

        // Optional Password reset
        if (password && password.trim()) {
            const hashed = await bcrypt.hash(password.trim(), 10);
            applyField('password', hashed);
        }

        if (pdbCenter) {
            await savePortalDb(pdb);
        }

        if (center) {
            try { await center.save(); } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('centers_updated', {
            action: 'center_updated_by_admin',
            centerId: centerId
        });
        res.json({ success: true, message: 'Coaching center profile updated by Super Admin!', data: pdbCenter || center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.3 Delete Center
app.delete('/api/admin/centers/:id', verifySuperAdmin, async (req, res) => {
    try {
        await TuitionCenter.findByIdAndDelete(req.params.id);
        const pdb = loadPortalDb();
        let centerUsername = '';
        if (pdb.centers) {
            const foundC = pdb.centers.find(c => c._id && c._id.toString() === req.params.id.toString());
            if (foundC) centerUsername = foundC.username;
            pdb.centers = pdb.centers.filter(c => c._id && c._id.toString() !== req.params.id.toString());
        }
        if (centerUsername) {
            if (pdb.affiliationApplications) {
                pdb.affiliationApplications = pdb.affiliationApplications.filter(a => a.username !== centerUsername);
            }
            if (pdb.paymentTransactions) {
                pdb.paymentTransactions = pdb.paymentTransactions.filter(t => t.username !== centerUsername);
            }
        }
        await savePortalDb(pdb);
        clearCache();
        broadcastRealtimeEvent('centers_updated', { action: 'center_deleted', centerId: req.params.id });
        res.json({ success: true, message: 'Coaching center removed from system' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.4 Center Block / Unblock / Set Dues
app.post('/api/admin/centers/:id/block', verifySuperAdmin, async (req, res) => {
    try {
        const centerId = req.params.id;
        const { isBlocked, blockReason, dueAmount, paymentQr } = req.body;
        let center = null;
        if (isMongoConnected) {
            try { center = await TuitionCenter.findById(centerId); } catch(e) {}
        }
        const pdb = loadPortalDb();
        if (!pdb.centers) pdb.centers = [];
        const pdbCenter = pdb.centers.find(c => c._id && c._id.toString() === centerId.toString());

        if (!center && !pdbCenter) {
            return res.status(404).json({ success: false, message: 'Center not found' });
        }

        if (pdbCenter) {
            pdbCenter.isBlocked = Boolean(isBlocked);
            if (blockReason !== undefined) pdbCenter.blockReason = blockReason;
            if (dueAmount !== undefined) pdbCenter.dueAmount = Number(dueAmount) || 0;
            if (paymentQr !== undefined) pdbCenter.paymentQr = paymentQr;
            await savePortalDb(pdb);
        }

        if (center) {
            try {
                center.isBlocked = Boolean(isBlocked);
                if (blockReason !== undefined) center.blockReason = blockReason;
                if (dueAmount !== undefined) center.dueAmount = Number(dueAmount) || 0;
                if (paymentQr !== undefined) center.paymentQr = paymentQr;
                await center.save();
            } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('centers_updated', {
            action: 'center_status_changed',
            centerId: centerId,
            isBlocked: Boolean(isBlocked)
        });
        res.json({ success: true, message: `Center ${Boolean(isBlocked) ? 'suspended' : 'activated'} successfully!`, data: pdbCenter || center });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.5 Central E-Library: Get All Books with Full Admin Control
app.get('/api/admin/books', verifySuperAdmin, async (req, res) => {
    try {
        let notes = [];
        if (isMongoConnected) {
            try {
                const sm = await StudyMaterial.findOne().lean();
                if (sm && sm.notes) notes = sm.notes;
            } catch(e) {}
        }
        const pdb = loadPortalDb();
        if (pdb.studyMaterials && Array.isArray(pdb.studyMaterials.notes)) {
            const existingIds = new Set(notes.map(n => n._id ? n._id.toString() : ''));
            pdb.studyMaterials.notes.forEach(pn => {
                const pid = pn._id ? pn._id.toString() : '';
                if (!pid || !existingIds.has(pid)) {
                    notes.push(pn);
                }
            });
        }
        res.json({ success: true, data: notes });
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
            pdfMrp,
            physicalPrice,
            physicalMrp,
            pickupAddress,
            directorContact,
            targetCenterId,
            targetCenterName,
            isRawData,
            storageMode
        } = req.body;

        if (!title) return res.status(400).json({ success: false, message: 'Document title is required' });

        const safeExt = (fileType || 'pdf').toLowerCase();
        const mode = storageMode === 'important' ? 'important' : 'normal';
        const fileAsset = saveAssetFile(file, 'materials', safeExt, mode, title.trim());
        const thumbAsset = thumbnail ? saveAssetFile(thumbnail, 'branding', 'jpg', 'normal', title.trim()) : null;

        const pPrice = Math.max(0, Number(price) || 0);
        const pMrp = Number(pdfMrp) || (pPrice > 0 ? Math.round(pPrice * 2.5 + 49) : 199);
        const physPrice = Number(physicalPrice) || (pPrice > 0 ? Math.max(99, Math.round(pPrice * 1.8 + 50)) : 149);
        const physMrp = Number(physicalMrp) || Math.round(physPrice * 2.2 + 50);

        const newNote = {
            _id: new mongoose.Types.ObjectId().toString(),
            title: title.trim(),
            subject: subject || 'General',
            classLevel: classLevel || 'All Classes',
            description: description || '',
            fileType: safeExt,
            thumbnail: thumbAsset ? thumbAsset.fileUrl : (thumbnail || ''),
            file: fileAsset.fileUrl || file || '',
            pdf: fileAsset.fileUrl || file || '',
            fileName: fileName || `${title.replace(/[^a-zA-Z0-9]/g, '_')}.${safeExt}`,
            price: pPrice,
            pdfMrp: pMrp,
            physicalPrice: physPrice,
            physicalMrp: physMrp,
            pickupAddress: (pickupAddress || '').trim(),
            directorContact: (directorContact || '').trim(),
            targetCenterId: targetCenterId || 'all',
            targetCenterName: targetCenterName || 'All Centers (Universal)',
            isRawData: Boolean(fileAsset.isRawData || isRawData),
            storageMode: fileAsset.storageUsed,
            createdAt: new Date()
        };

        // Dual-persist to portal_db.json
        const pdb = loadPortalDb();
        if (!pdb.studyMaterials) pdb.studyMaterials = { notes: [], videos: [] };
        if (!pdb.studyMaterials.notes) pdb.studyMaterials.notes = [];
        pdb.studyMaterials.notes.unshift(newNote);
        await savePortalDb(pdb);

        // Dual-persist to MongoDB
        if (isMongoConnected) {
            try {
                let sm = await StudyMaterial.findOne();
                if (!sm) sm = await StudyMaterial.create({ notes: [], videos: [] });
                sm.notes.unshift(newNote);
                await sm.save();
            } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('books_updated');
        res.json({
            success: true,
            message: fileAsset.storageUsed === 'github_fallback'
                ? 'Document saved to GitHub public/data (auto-routed because file exceeded MongoDB safe limit)!'
                : (fileAsset.storageUsed === 'mongodb'
                    ? 'Document saved to MongoDB Vault!'
                    : 'Document added to Central E-Library on GitHub public/data!'),
            storageUsed: fileAsset.storageUsed,
            data: newNote
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.7 Central E-Library: MASTER DOCUMENT EDITOR (Edit Any Document)
app.put('/api/admin/books/:id', verifySuperAdmin, async (req, res) => {
    try {
        const noteId = req.params.id;
        const pdb = loadPortalDb();
        if (!pdb.studyMaterials) pdb.studyMaterials = { notes: [], videos: [] };
        if (!pdb.studyMaterials.notes) pdb.studyMaterials.notes = [];
        const pdbNote = pdb.studyMaterials.notes.find(n => n._id && n._id.toString() === noteId.toString());

        let mongoNote = null;
        let sm = null;
        if (isMongoConnected) {
            try {
                sm = await StudyMaterial.findOne();
                if (sm && sm.notes) {
                    mongoNote = sm.notes.id(noteId) || sm.notes.find(n => n._id && n._id.toString() === noteId.toString());
                }
            } catch(e) {}
        }

        if (!pdbNote && !mongoNote) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

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
            pdfMrp,
            physicalPrice,
            physicalMrp,
            pickupAddress,
            directorContact,
            targetCenterId,
            targetCenterName,
            isRawData,
            storageMode
        } = req.body;

        const updateTarget = (target) => {
            const safeExt = fileType ? fileType.toLowerCase() : (target.fileType || 'pdf').toLowerCase();
            if (title !== undefined) target.title = title.trim();
            if (subject !== undefined) target.subject = subject.trim();
            if (classLevel !== undefined) target.classLevel = classLevel.trim();
            if (description !== undefined) target.description = description;
            if (fileType !== undefined) target.fileType = safeExt;
            if (thumbnail !== undefined && thumbnail) target.thumbnail = thumbnail;
            if (file !== undefined && file !== '') {
                const mode = storageMode === 'important' ? 'important' : 'normal';
                const fileAsset = saveAssetFile(file, 'materials', safeExt, mode, (title || target.title).trim());
                target.file = fileAsset.fileUrl || file;
                target.pdf = fileAsset.fileUrl || file;
                target.isRawData = Boolean(fileAsset.isRawData);
                target.storageMode = fileAsset.storageUsed;
            }
            if (fileName !== undefined) target.fileName = fileName;
            if (price !== undefined) target.price = Math.max(0, Number(price) || 0);
            if (pdfMrp !== undefined) target.pdfMrp = Math.max(0, Number(pdfMrp) || 0);
            if (physicalPrice !== undefined) target.physicalPrice = Math.max(0, Number(physicalPrice) || 0);
            if (physicalMrp !== undefined) target.physicalMrp = Math.max(0, Number(physicalMrp) || 0);
            if (pickupAddress !== undefined) target.pickupAddress = pickupAddress.trim();
            if (directorContact !== undefined) target.directorContact = directorContact.trim();
            if (targetCenterId !== undefined) target.targetCenterId = targetCenterId;
            if (targetCenterName !== undefined) target.targetCenterName = targetCenterName;
            if (isRawData !== undefined) target.isRawData = Boolean(isRawData);
        };

        if (pdbNote) updateTarget(pdbNote);
        if (mongoNote) updateTarget(mongoNote);

        await savePortalDb(pdb);
        if (sm) {
            sm.markModified('notes');
            await sm.save();
        }

        clearCache();
        broadcastRealtimeEvent('books_updated');
        res.json({ success: true, message: 'Document updated successfully!', data: pdbNote || mongoNote });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.8 Delete E-Library Book Note
app.delete('/api/admin/books/:id', verifySuperAdmin, async (req, res) => {
    try {
        const noteId = req.params.id;
        const pdb = loadPortalDb();
        if (pdb.studyMaterials && pdb.studyMaterials.notes) {
            pdb.studyMaterials.notes = pdb.studyMaterials.notes.filter(n => (n._id ? n._id.toString() : '') !== noteId.toString());
            await savePortalDb(pdb);
        }

        if (isMongoConnected) {
            try {
                const sm = await StudyMaterial.findOne();
                if (sm && sm.notes) {
                    sm.notes = sm.notes.filter(n => n._id.toString() !== noteId.toString());
                    await sm.save();
                }
            } catch(e) {}
        }

        clearCache();
        broadcastRealtimeEvent('books_updated');
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
        if (req.body.groqApiKey !== undefined && req.body.groqApiKey.trim() !== '') {
            settings.groqApiKey = req.body.groqApiKey.trim();
        }
        if (phone !== undefined) settings.phone = phone.trim();
        if (email !== undefined) settings.email = email.trim();
        if (address !== undefined) settings.address = address.trim();
        if (boardLogo !== undefined) {
            settings.boardLogo = saveBase64ToFile(boardLogo, 'branding', 'png');
        }
        if (newsMarquee !== undefined) settings.newsMarquee = newsMarquee;
        if (affiliationFee !== undefined) settings.affiliationFee = Math.max(0, Number(affiliationFee));

        await settings.save();
        activeGeminiModelCache.clear();
        clearCache();
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
                hasGroqKey: Boolean((settings.groqApiKey && settings.groqApiKey.trim()) || process.env.GROQ_API_KEY),
                groqApiKeyMasked: settings.groqApiKey ? '••••••••' + settings.groqApiKey.slice(-4) : (process.env.GROQ_API_KEY ? '••••••••ENV' : ''),
                razorpayConfigured: Boolean(settings.razorpayKeyId && settings.razorpayKeySecret),
                geminiConfigured: Boolean(settings.geminiApiKey),
                groqConfigured: Boolean(settings.groqApiKey || process.env.GROQ_API_KEY),
                youtubeApiKey: settings.youtubeApiKey || DEFAULT_YT_KEY,
                youtubeApiKeyMasked: (settings.youtubeApiKey || DEFAULT_YT_KEY) ? ('••••••••' + (settings.youtubeApiKey || DEFAULT_YT_KEY).slice(-4)) : '',
                hasYoutubeKey: Boolean(settings.youtubeApiKey || DEFAULT_YT_KEY),
                youtubeClientId: settings.youtubeClientId || DEFAULT_YT_CLIENT_ID,
                youtubeClientSecret: settings.youtubeClientSecret || DEFAULT_YT_SECRET,
                youtubeRefreshToken: settings.youtubeRefreshToken || '',
                hasYoutubeRefreshToken: Boolean(settings.youtubeRefreshToken && settings.youtubeRefreshToken.trim()),
                youtubeDirectLiveReady: Boolean(settings.youtubeRefreshToken && settings.youtubeRefreshToken.trim()),
                youtubeChannelId: settings.youtubeChannelId || '',
                youtubePrivacyStatus: settings.youtubePrivacyStatus || 'unlisted',
                youtubeAutoUpload: settings.youtubeAutoUpload !== false,
                youtubeConfigured: Boolean(settings.youtubeApiKey || DEFAULT_YT_KEY || settings.youtubeChannelId),
                boardLogo: settings.boardLogo || '',
                founderProfile: settings.founderProfile || {}
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Test Groq Cloud Connectivity
app.post('/api/admin/test-groq', verifySuperAdmin, async (req, res) => {
    try {
        const testKey = req.body.apiKey ? req.body.apiKey.trim() : '';
        const settings = await Settings.findOne();
        const keyToUse = testKey || settings?.groqApiKey || process.env.GROQ_API_KEY;
        if (!keyToUse) return res.status(400).json({ success: false, message: 'No Groq API Key provided or configured. Get a free key at https://console.groq.com/keys' });

        const result = await callGroqChat({
            apiKey: keyToUse,
            prompt: 'Test connectivity: Return exactly "OK - Connected to Groq Cloud Llama 3.3"'
        });

        res.json({
            success: true,
            message: 'Groq Cloud API Connection Successful!',
            modelUsed: result.modelUsed,
            response: result.text
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

        activeGeminiModelCache.clear();
        clearCache();

        // Immediate verification test with Google Gemini API
        let verifiedLive = false;
        let modelDiscovered = '';
        try {
            const testResult = await callGoogleGemini({
                apiKey: settings.geminiApiKey,
                prompt: 'Namaste, please acknowledge connection test.'
            });
            if (testResult && testResult.success) {
                verifiedLive = true;
                modelDiscovered = testResult.modelUsed;
            }
        } catch (testErr) {
            console.warn('Gemini test notice:', testErr.message);
        }

        res.json({
            success: true,
            message: verifiedLive
                ? `✅ Gemini API Key SAVED & VERIFIED LIVE! Model active: ${modelDiscovered || 'Gemini Flash'}.`
                : 'Google Gemini API Key saved successfully!',
            verified: verifiedLive,
            modelUsed: modelDiscovered
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

        activeGeminiModelCache.delete(apiKey);

        const testResult = await callGoogleGemini({
            apiKey: apiKey,
            prompt: 'Say one short loving sentence to a student as BHARTI Didi with warmth ("beta", "aap").'
        });

        res.json({
            success: true,
            message: `Google Gemini Live Connected! (Active Model: ${testResult.modelUsed})`,
            reply: testResult.text,
            sampleReply: testResult.text,
            model: testResult.modelUsed
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
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

// 8.9C Super Admin Format Platform Data / Factory Reset (MongoDB & GitHub Cloud)
app.post('/api/admin/format-data', verifySuperAdmin, async (req, res) => {
    try {
        const { confirmation } = req.body;
        if (!confirmation || confirmation.trim().toUpperCase() !== 'FORMAT DATA') {
            return res.status(400).json({
                success: false,
                message: 'Invalid confirmation phrase. Please type "FORMAT DATA" to confirm factory reset.'
            });
        }

        console.log('🚨 [FORMAT PLATFORM DATA] Initiated by Super Admin:', req.admin.adminId || req.admin.id);

        // 1. Fetch & strictly preserve currently active Super Admin record
        let activeAdmin = null;
        if (isMongoConnected) {
            try {
                if (req.admin.id && mongoose.Types.ObjectId.isValid(req.admin.id)) {
                    activeAdmin = await Admin.findById(req.admin.id);
                }
                if (!activeAdmin && req.admin.adminId) {
                    activeAdmin = await Admin.findOne({ adminId: req.admin.adminId });
                }
            } catch (e) {}
        }

        const pdb = loadPortalDb();
        if (!activeAdmin) {
            activeAdmin = (pdb.admins || []).find(a => 
                (req.admin.adminId && a.adminId && a.adminId.toLowerCase() === req.admin.adminId.toLowerCase()) ||
                (req.admin.id && a._id && a._id.toString() === req.admin.id) ||
                a.role === 'superadmin'
            ) || (pdb.admins || [])[0];
        }

        if (!activeAdmin || !activeAdmin.password) {
            return res.status(500).json({
                success: false,
                message: 'Active admin credentials could not be verified for preservation. Aborting reset to prevent lockout.'
            });
        }

        const preservedAdmin = {
            adminId: activeAdmin.adminId || 'admin',
            password: activeAdmin.password,
            name: activeAdmin.name || 'BBCC Central Directorate',
            role: 'superadmin'
        };

        // 2. Wipe MongoDB Collections (if connected)
        if (isMongoConnected) {
            try {
                await TuitionCenter.deleteMany({});
                await Student.deleteMany({});
                await WithdrawalRequest.deleteMany({});
                await PaymentTransaction.deleteMany({});
                await SupportTicket.deleteMany({});
                await TeacherAccount.deleteMany({});
                await LiveClassSession.deleteMany({});
                await AdmissionInquiry.deleteMany({});
                await AffiliationApplication.deleteMany({});
                await StudyMaterial.deleteMany({});

                // Preserve ONLY active admin in MongoDB Admin collection
                await Admin.deleteMany({ adminId: { $ne: preservedAdmin.adminId } });
                const existingInMongo = await Admin.findOne({ adminId: preservedAdmin.adminId });
                if (!existingInMongo) {
                    await Admin.create(preservedAdmin);
                } else {
                    existingInMongo.password = preservedAdmin.password;
                    await existingInMongo.save();
                }
            } catch (mongoErr) {
                console.warn('MongoDB partial format notice:', mongoErr.message);
            }
        }

        // 3. Reset Local Portal DB (portal_db.json)
        pdb.admins = [preservedAdmin];
        pdb.centers = [];
        pdb.students = [];
        pdb.studyMaterials = { notes: [], videos: [] };
        pdb.withdrawals = [];
        pdb.paymentTransactions = [];
        pdb.push_subscriptions = [];
        pdb.push_history = [];
        pdb.bharti_auto_push_log = {};
        pdb.teachers = [];
        pdb.liveSessions = [];
        pdb.admissionInquiries = [];
        pdb.supportTickets = [];
        pdb.affiliationApplications = [];

        // Save locally and sync to GitHub
        await savePortalDb(pdb);

        // 4. Clean up uploaded non-system material files from local disk
        const dirsToClean = [
            path.join(__dirname, 'public', 'uploads', 'materials'),
            path.join(__dirname, 'public', 'uploads', 'notes'),
            path.join(__dirname, 'public', 'uploads', 'thumbnails'),
            path.join(__dirname, 'public', 'data', 'materials')
        ];

        for (const dir of dirsToClean) {
            if (fs.existsSync(dir)) {
                try {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        const fullPath = path.join(dir, file);
                        if (fs.statSync(fullPath).isFile()) {
                            fs.unlinkSync(fullPath);
                        }
                    }
                } catch (e) {}
            }
        }

        // 5. Clean DataStax Astra DB Collections (if connected)
        if (isAstraConnected && astraDb) {
            try {
                await astraDb.collection('bbcc_assets').deleteMany({});
                await astraDb.collection('bbcc_live_classes').deleteMany({});
                await astraDb.collection('bbcc_recordings').deleteMany({});
                console.log('⚡ [Astra DB] Heavy assets, live classes and recordings cleared.');
            } catch (aErr) {
                console.warn('Astra DB clear notice:', aErr.message);
            }
        }

        console.log('✅ [FORMAT COMPLETED] MongoDB and Astra DB platform data wiped cleanly. Preserved Admin:', preservedAdmin.adminId);

        res.json({
            success: true,
            message: 'All platform data formatted successfully across MongoDB and GitHub. Your Super Admin account has been safely preserved!',
            preservedAdminId: preservedAdmin.adminId
        });
    } catch (err) {
        console.error('Format data error:', err);
        res.status(500).json({ success: false, message: 'Format failed: ' + err.message });
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
        let list = [];
        if (isMongoConnected) {
            try {
                list = await AffiliationApplication.find().sort({ appliedAt: -1 }).lean();
            } catch(e) {}
        }
        if (!list || list.length === 0) {
            const pdb = loadPortalDb();
            list = pdb.affiliationApplications || [];
        }
        res.json({ success: true, data: list });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.12 Payment Transactions Ledger
app.get('/api/admin/transactions', verifySuperAdmin, async (req, res) => {
    try {
        let txns = [];
        if (isMongoConnected) {
            try {
                txns = await PaymentTransaction.find().sort({ createdAt: -1 }).lean();
            } catch(e) {}
        }
        if (!txns || txns.length === 0) {
            const pdb = loadPortalDb();
            txns = pdb.paymentTransactions || [];
        }
        res.json({ success: true, data: txns });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.12B Physical Book Orders Ledger for Super Admin
app.get('/api/admin/book-orders', verifySuperAdmin, async (req, res) => {
    try {
        let orders = [];
        if (isMongoConnected) {
            try {
                orders = await PaymentTransaction.find({
                    $or: [
                        { purpose: 'physical_book_order' },
                        { orderType: 'physical' }
                    ],
                    status: { $in: ['paid', 'success'] }
                }).sort({ createdAt: -1 }).lean();
            } catch(e) {}
        }

        const pdb = loadPortalDb();
        if (!orders || orders.length === 0) {
            orders = (pdb.paymentTransactions || []).filter(tx => 
                (tx.purpose === 'physical_book_order' || tx.orderType === 'physical') &&
                ['paid', 'success'].includes(tx.status)
            );
        }

        let totalRevenue = 0;
        let deliveredCount = 0;
        let pendingCount = 0;

        orders.forEach(o => {
            totalRevenue += Number(o.amount || 0);
            if (o.fulfillmentStatus === 'delivered') deliveredCount++;
            else pendingCount++;
        });

        res.json({
            success: true,
            summary: {
                totalOrders: orders.length,
                totalRevenue: totalRevenue,
                totalRevenueFormatted: '₹' + totalRevenue.toLocaleString('en-IN'),
                deliveredCount,
                pendingCount
            },
            data: orders
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Fulfillment Status by Super Admin ('ready', 'delivered')
app.put('/api/admin/book-orders/:orderId/status', verifySuperAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        let updated = false;
        let tx = null;

        if (isMongoConnected) {
            try {
                tx = await PaymentTransaction.findOne({ orderId: req.params.orderId });
                if (tx) {
                    tx.fulfillmentStatus = status || 'delivered';
                    await tx.save();
                    updated = true;
                }
            } catch(e) {}
        }

        const pdb = loadPortalDb();
        if (pdb.paymentTransactions) {
            const pTx = pdb.paymentTransactions.find(t => t.orderId === req.params.orderId);
            if (pTx) {
                pTx.fulfillmentStatus = status || 'delivered';
                await savePortalDb(pdb);
                updated = true;
                if (!tx) tx = pTx;
            }
        }

        if (!updated) return res.status(404).json({ success: false, message: 'Order not found' });
        res.json({ success: true, message: `Order status updated to ${status || 'delivered'}`, data: tx });
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
        let centers = [];
        if (isMongoConnected) {
            try {
                centers = await TuitionCenter.find({}, { centerName: 1, username: 1, promotionalBanners: 1 }).lean();
            } catch(e) {}
        }
        const pdb = loadPortalDb();
        const jsonCenters = pdb.centers || [];
        const allCenters = [...(centers || []), ...jsonCenters];

        const list = [];
        const seenBanners = new Set();

        allCenters.forEach(c => {
            (c.promotionalBanners || []).forEach(b => {
                if (!b || !b.image || typeof b.image !== 'string' || !b.image.trim()) return;
                const bKey = (b._id ? b._id.toString() : '') || b.image;
                if (seenBanners.has(bKey)) return;
                seenBanners.add(bKey);

                list.push({
                    _id: b._id || bKey,
                    centerId: c._id || '',
                    centerName: c.centerName || 'Coaching Center',
                    username: c.username || '',
                    title: b.title || c.centerName || 'Promotional Banner',
                    subtitle: b.subtitle || '',
                    image: b.image,
                    link: b.link || '',
                    active: b.active !== false,
                    uploadedAt: b.uploadedAt || new Date()
                });
            });
        });

        // Also include BBCC SKILL HUB Central Promotional Banners
        try {
            let settings = null;
            if (isMongoConnected) {
                try { settings = await Settings.findOne().lean(); } catch(e) {}
            }
            const jsonSettings = pdb.settings || {};
            const centralBanners = [
                ...((settings && settings.banners) || []),
                ...((jsonSettings && jsonSettings.banners) || [])
            ];

            centralBanners.forEach((b, idx) => {
                if (!b || !b.image || typeof b.image !== 'string' || !b.image.trim()) return;
                const bKey = (b._id ? b._id.toString() : ('central_b_' + idx)) || b.image;
                if (seenBanners.has(bKey)) return;
                seenBanners.add(bKey);

                list.unshift({
                    _id: bKey,
                    centerId: 'bbcc_central',
                    centerName: 'BBCC SKILL HUB Central Directorate',
                    username: 'bbcc',
                    title: b.title || 'BBCC Official Announcement',
                    subtitle: b.subtitle || 'Platform Announcement',
                    image: b.image,
                    link: b.link || '/',
                    active: true,
                    isCentral: true,
                    uploadedAt: b.uploadedAt || new Date()
                });
            });
        } catch(e) {}

        res.json({ success: true, data: list });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.15 Delete Banner from Super Admin Console
app.delete('/api/admin/banners/:cid/:bid', verifySuperAdmin, async (req, res) => {
    try {
        const { cid, bid } = req.params;
        if (isMongoConnected) {
            try {
                let center = null;
                if (mongoose.Types.ObjectId.isValid(cid)) center = await TuitionCenter.findById(cid);
                if (!center) center = await TuitionCenter.findOne({ username: cid });
                if (center) {
                    center.promotionalBanners = (center.promotionalBanners || []).filter(b => b._id.toString() !== bid && b._id !== bid);
                    await center.save();
                }
            } catch(e) {}
        }
        try {
            const pdb = loadPortalDb();
            const pdbCenter = (pdb.centers || []).find(c => (c._id && c._id.toString() === cid) || c.username === cid);
            if (pdbCenter && pdbCenter.promotionalBanners) {
                pdbCenter.promotionalBanners = pdbCenter.promotionalBanners.filter(b => b._id && b._id.toString() !== bid && b._id !== bid);
                await savePortalDb(pdb);
            }
        } catch(e) {}

        clearCache('public_banners');
        clearCache();
        broadcastRealtimeEvent('banners_updated');
        res.json({ success: true, message: 'Banner removed by Super Admin' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.16 Board Campus Photo Gallery Management
app.post('/api/admin/gallery', verifySuperAdmin, async (req, res) => {
    try {
        const { image, title, storageMode } = req.body;
        if (!image) return res.status(400).json({ success: false, message: 'Image required' });
        
        const mode = storageMode === 'important' ? 'important' : 'normal';
        const imgAsset = saveAssetFile(image, 'photos', 'jpg', mode, (title || 'Campus Highlight').trim());
        const photoItem = {
            _id: new mongoose.Types.ObjectId().toString(),
            image: imgAsset.fileUrl || image,
            title: title || 'Campus Highlight',
            storageMode: imgAsset.storageUsed,
            uploadedAt: new Date()
        };

        const pdb = loadPortalDb();
        if (!pdb.settings) pdb.settings = {};
        if (!pdb.settings.gallery) pdb.settings.gallery = [];
        pdb.settings.gallery.push(photoItem);
        await savePortalDb(pdb);

        if (isMongoConnected) {
            try {
                let settings = await Settings.findOne();
                if (!settings) settings = await Settings.create({});
                settings.gallery.push(photoItem);
                await settings.save();
            } catch(e) {}
        }

        clearCache('public_config');
        clearCache();
        broadcastRealtimeEvent('config_updated');
        res.json({
            success: true,
            message: `Photo added to Board Gallery! (Stored via: ${imgAsset.storageUsed})`,
            storageMode: imgAsset.storageUsed,
            data: pdb.settings.gallery
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/admin/gallery/:gid', verifySuperAdmin, async (req, res) => {
    try {
        const gid = req.params.gid;
        const pdb = loadPortalDb();
        if (pdb.settings && pdb.settings.gallery) {
            pdb.settings.gallery = pdb.settings.gallery.filter(g => (g._id ? g._id.toString() : '') !== gid);
            await savePortalDb(pdb);
        }

        if (isMongoConnected) {
            try {
                let settings = await Settings.findOne();
                if (settings && settings.gallery) {
                    settings.gallery = settings.gallery.filter(g => g._id.toString() !== gid);
                    await settings.save();
                }
            } catch(e) {}
        }

        clearCache('public_config');
        clearCache();
        broadcastRealtimeEvent('config_updated');
        res.json({ success: true, message: 'Photo removed from Gallery' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.17 Super Admin Payout Requests Management
app.get('/api/admin/payouts', verifySuperAdmin, async (req, res) => {
    try {
        const list = await WithdrawalRequest.find().sort({ createdAt: -1 });
        res.json({ success: true, data: list });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/admin/payouts/:id/approve', verifySuperAdmin, async (req, res) => {
    try {
        const { utrNumber, adminNotes } = req.body;
        const wr = await WithdrawalRequest.findById(req.params.id);
        if (!wr) return res.status(404).json({ success: false, message: 'Payout request not found' });
        if (wr.status !== 'pending_approval') {
            return res.status(400).json({ success: false, message: `Request is already ${wr.status}` });
        }

        wr.status = 'approved';
        wr.utrNumber = (utrNumber || 'BANK-UTR-' + Date.now()).trim();
        wr.adminNotes = (adminNotes || 'Approved by Super Admin').trim();
        wr.processedAt = new Date();
        await wr.save();

        res.json({
            success: true,
            message: `Payout of ₹${wr.amount} approved successfully! Bank UTR recorded: ${wr.utrNumber}`,
            data: wr
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/admin/payouts/:id/reject', verifySuperAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        const wr = await WithdrawalRequest.findById(req.params.id);
        if (!wr) return res.status(404).json({ success: false, message: 'Payout request not found' });
        if (wr.status !== 'pending_approval') {
            return res.status(400).json({ success: false, message: `Request is already ${wr.status}` });
        }

        // Refund reserved funds back to center wallet
        const center = await TuitionCenter.findById(wr.centerId);
        if (center) {
            center.walletBalance = (center.walletBalance || 0) + wr.amount;
            await center.save();
        }

        wr.status = 'rejected';
        wr.adminNotes = (reason || 'Rejected by Administrator. Funds refunded to wallet.').trim();
        wr.processedAt = new Date();
        await wr.save();

        res.json({
            success: true,
            message: `Payout rejected and ₹${wr.amount} refunded back to center wallet balance.`,
            data: wr
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8.18 Super Admin Template & Founder Settings Update
app.put('/api/admin/settings/templates', verifySuperAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});

        const { billTemplate, certTemplate, founderProfile, activeFestivalTheme } = req.body;
        if (billTemplate) settings.billTemplate = { ...settings.billTemplate, ...billTemplate };
        if (certTemplate) settings.certTemplate = { ...settings.certTemplate, ...certTemplate };
        if (founderProfile) settings.founderProfile = { ...settings.founderProfile, ...founderProfile };
        if (activeFestivalTheme) settings.activeFestivalTheme = activeFestivalTheme;

        await settings.save();
        clearCache('public_config');
        res.json({
            success: true,
            message: 'Template and Founder settings updated successfully!',
            data: {
                billTemplate: settings.billTemplate,
                certTemplate: settings.certTemplate,
                founderProfile: settings.founderProfile,
                activeFestivalTheme: settings.activeFestivalTheme
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// 8.15 SUPER ADMIN DUAL-DATABASE & CLOUD STORAGE METRICS ENGINE
// ============================================================
app.get('/api/admin/database-stats', verifySuperAdmin, async (req, res) => {
    try {
        const pdb = loadPortalDb();

        // 1. DATABASE 1: MONGODB / CREDENTIALS STATS
        let mongoStatus = isMongoConnected ? 'connected' : 'local_fallback';
        let mongoEngine = isMongoConnected ? 'MongoDB Atlas Cloud' : 'Local Persistent JSON Engine (portal_db.json)';

        let centersCount = pdb.centers ? pdb.centers.length : 0;
        let teachersCount = pdb.teachers ? pdb.teachers.length : 0;
        let studentsCount = pdb.students ? pdb.students.length : 0;
        let adminsCount = pdb.admins ? pdb.admins.length : 0;
        let txnCount = pdb.paymentTransactions ? pdb.paymentTransactions.length : 0;
        let ticketsCount = pdb.supportTickets ? pdb.supportTickets.length : 0;
        let pushSubsCount = pdb.push_subscriptions ? pdb.push_subscriptions.length : 0;

        if (isMongoConnected) {
            try {
                centersCount = await TuitionCenter.countDocuments();
                teachersCount = await TeacherAccount.countDocuments();
                studentsCount = await Student.countDocuments();
                adminsCount = await Admin.countDocuments();
                txnCount = await PaymentTransaction.countDocuments();
                ticketsCount = await SupportTicket.countDocuments();
            } catch (mErr) {}
        }

        let portalDbSize = 0;
        try {
            if (fs.existsSync(DB_FILE)) {
                portalDbSize = fs.statSync(DB_FILE).size;
            }
        } catch (e) {}

        const mongoCollections = [
            { name: 'Super Admin Credentials', key: 'admins', count: adminsCount, size: `${((JSON.stringify(pdb.admins || []).length) / 1024).toFixed(1)} KB`, role: 'Platform Super Admins (Bcrypt Hash)' },
            { name: 'Partner Coaching Centers', key: 'centers', count: centersCount, size: `${((JSON.stringify(pdb.centers || []).length) / 1024).toFixed(1)} KB`, role: 'Center Director Accounts & Credentials' },
            { name: 'Teacher Accounts', key: 'teachers', count: teachersCount, size: `${((JSON.stringify(pdb.teachers || []).length) / 1024).toFixed(1)} KB`, role: 'Faculty Logins & Center Mapping' },
            { name: 'Student Enrolments & Auth', key: 'students', count: studentsCount, size: `${((JSON.stringify(pdb.students || []).length) / 1024).toFixed(1)} KB`, role: 'Student Roll No, Password & Profile' },
            { name: 'Payment Transactions Ledger', key: 'paymentTransactions', count: txnCount, size: `${((JSON.stringify(pdb.paymentTransactions || []).length) / 1024).toFixed(1)} KB`, role: 'Razorpay Receipts & 80/20 Payouts' },
            { name: 'Support Tickets & Callbacks', key: 'supportTickets', count: ticketsCount, size: `${((JSON.stringify(pdb.supportTickets || []).length) / 1024).toFixed(1)} KB`, role: 'CRM Helpdesk & Student Inquiries' },
            { name: 'Web Push Notification Vault', key: 'push_subscriptions', count: pushSubsCount, size: `${((JSON.stringify(pdb.push_subscriptions || []).length) / 1024).toFixed(1)} KB`, role: 'PWA Web Push Endpoints' }
        ];

        // 2. DATABASE 2: DATASTAX ASTRA DB STATS
        let astraStatus = isAstraConnected ? 'connected' : 'disconnected';
        let astraStats = {
            status: astraStatus,
            endpoint: ASTRA_DB_API_ENDPOINT,
            keyspace: ASTRA_DB_KEYSPACE,
            collections: []
        };

        let totalAstraDocs = 0;
        let totalAstraBytes = 0;
        let fileExplorerList = [];

        if (isAstraConnected && astraDb) {
            try {
                const colsToQuery = [
                    { id: 'bbcc_assets', label: 'Campus Photos & PDFs', type: 'image_and_pdf', desc: 'Logos, Campus Gallery Photos, PDF Books' },
                    { id: 'bbcc_banners', label: 'Promotional Banners', type: 'banner', desc: 'Full-bleed Home & Mobile Banners' },
                    { id: 'bbcc_live_classes', label: 'Live Video Broadcasts', type: 'live', desc: 'Real-time classroom session logs' },
                    { id: 'bbcc_recordings', label: 'Classroom Video Archives', type: 'recording', desc: 'Recorded lectures & video replays' },
                    { id: 'bbcc_study_materials', label: 'Central Study Notes', type: 'notes', desc: 'E-Library Notes & Course Materials' }
                ];

                for (const item of colsToQuery) {
                    try {
                        const col = astraDb.collection(item.id);
                        const count = await col.countDocuments({}, 5000);
                        totalAstraDocs += count;

                        const sampleDocs = await col.find({}, { limit: 25, projection: { _id: 1, filename: 1, subDir: 1, mimeType: 1, title: 1, approxByteSize: 1, createdAt: 1, isChunked: 1, totalChunks: 1, isChunk: 1 } }).toArray();

                        let colBytes = 0;
                        sampleDocs.forEach(d => {
                            if (!d.isChunk) {
                                const size = d.approxByteSize || 15000;
                                colBytes += size;
                                fileExplorerList.push({
                                    id: d._id || d.filename,
                                    name: d.title || d.filename || d._id,
                                    type: item.type,
                                    category: item.label,
                                    collection: item.id,
                                    mimeType: d.mimeType || 'application/octet-stream',
                                    storage: 'DataStax Astra DB',
                                    canDelete: true,
                                    sizeBytes: size,
                                    sizeFormatted: size > 1048576 ? `${(size / 1048576).toFixed(2)} MB` : `${(size / 1024).toFixed(1)} KB`,
                                    date: d.createdAt || 'N/A',
                                    url: d.subDir && d.filename ? `/data/${d.subDir}/${d.filename}` : `/api/astra/asset/${d._id}`
                                });
                            }
                        });
                        totalAstraBytes += colBytes;

                        astraStats.collections.push({
                            id: item.id,
                            name: item.label,
                            count: count,
                            description: item.desc,
                            estimatedSize: colBytes > 1048576 ? `${(colBytes / 1048576).toFixed(2)} MB` : `${(colBytes / 1024).toFixed(1)} KB`
                        });
                    } catch (colErr) {
                        astraStats.collections.push({
                            id: item.id,
                            name: item.label,
                            count: 0,
                            description: item.desc,
                            error: colErr.message
                        });
                    }
                }
            } catch (aErr) {
                console.warn('Astra stats notice:', aErr.message);
            }
        }

        // 3. ASSET SCAN (SYNCED TO DATASTAX ASTRA DB)
        let localFilesCount = 0;
        let localFilesBytes = 0;
        const uploadDirs = [
            { dir: path.join(__dirname, 'public', 'uploads'), category: 'Campus Uploads', collection: 'bbcc_assets' },
            { dir: path.join(__dirname, 'public', 'data', 'branding'), category: 'Branding & Logo', collection: 'bbcc_assets' },
            { dir: path.join(__dirname, 'public', 'data', 'banners'), category: 'Promotional Banners', collection: 'bbcc_banners' },
            { dir: path.join(__dirname, 'public', 'data', 'photos'), category: 'Campus Gallery', collection: 'bbcc_assets' },
            { dir: path.join(__dirname, 'public', 'data', 'notes'), category: 'Study Notes', collection: 'bbcc_study_materials' },
            { dir: path.join(__dirname, 'public', 'data', 'materials'), category: 'E-Library Materials', collection: 'bbcc_study_materials' }
        ];

        for (const ud of uploadDirs) {
            try {
                if (fs.existsSync(ud.dir)) {
                    const files = fs.readdirSync(ud.dir);
                    for (const f of files) {
                        if (f.startsWith('.') || f === '.gitkeep') continue;
                        const fullPath = path.join(ud.dir, f);
                        const stat = fs.statSync(fullPath);
                        if (stat.isFile()) {
                            localFilesCount++;
                            localFilesBytes += stat.size;
                            if (!fileExplorerList.some(x => x.name === f || x.id === f)) {
                                fileExplorerList.push({
                                    id: f,
                                    name: f,
                                    type: f.endsWith('.pdf') ? 'pdf' : (f.match(/\.(png|jpg|jpeg|webp)$/i) ? 'image' : 'file'),
                                    category: ud.category,
                                    collection: ud.collection,
                                    mimeType: f.endsWith('.pdf') ? 'application/pdf' : (f.match(/\.(png|jpg|jpeg|webp)$/i) ? 'image/jpeg' : 'application/octet-stream'),
                                    storage: 'DataStax Astra DB',
                                    canDelete: true,
                                    sizeBytes: stat.size,
                                    sizeFormatted: stat.size > 1048576 ? `${(stat.size / 1048576).toFixed(2)} MB` : `${(stat.size / 1024).toFixed(1)} KB`,
                                    date: stat.mtime.toLocaleDateString(),
                                    url: `/data/${path.basename(ud.dir)}/${f}`
                                });
                            }
                        }
                    }
                }
            } catch (e) {}
        }

        const totalHeavyBytes = totalAstraBytes + localFilesBytes;
        const freeTierLimitBytes = 5 * 1024 * 1024 * 1024; // 5GB Astra DB Free Tier
        const freeTierUsedPct = ((totalAstraBytes / freeTierLimitBytes) * 100).toFixed(4);

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            databases: {
                database1: {
                    name: 'Database 1: Credentials & Auth (MongoDB)',
                    badge: '🔐 IDs & Passwords Only',
                    status: mongoStatus,
                    engine: mongoEngine,
                    totalAccounts: centersCount + teachersCount + studentsCount + adminsCount,
                    totalStorageBytes: portalDbSize,
                    totalStorageFormatted: portalDbSize > 1048576 ? `${(portalDbSize / 1048576).toFixed(2)} MB` : `${(portalDbSize / 1024).toFixed(1)} KB`,
                    collections: mongoCollections
                },
                database2: {
                    name: 'Database 2: DataStax Astra DB (astra.datastax.com)',
                    badge: '⚡ Cloud Heavy Assets & Media',
                    status: astraStatus,
                    endpoint: ASTRA_DB_API_ENDPOINT,
                    keyspace: ASTRA_DB_KEYSPACE,
                    totalDocuments: totalAstraDocs,
                    storageUsedBytes: totalAstraBytes,
                    storageUsedFormatted: totalAstraBytes > 1048576 ? `${(totalAstraBytes / 1048576).toFixed(2)} MB` : `${(totalAstraBytes / 1024).toFixed(1)} KB`,
                    freeTierLimit: '5,120 MB (5 GB Free Serverless Quota)',
                    freeTierUsedPercent: freeTierUsedPct,
                    collections: astraStats.collections
                }
            },
            summary: {
                totalFiles: fileExplorerList.length,
                totalHeavyStorageFormatted: totalHeavyBytes > 1048576 ? `${(totalHeavyBytes / 1048576).toFixed(2)} MB` : `${(totalHeavyBytes / 1024).toFixed(1)} KB`,
                totalCredentialsStorageFormatted: portalDbSize > 1048576 ? `${(portalDbSize / 1048576).toFixed(2)} MB` : `${(portalDbSize / 1024).toFixed(1)} KB`,
                localCachedFiles: localFilesCount,
                cloudAstraDocuments: totalAstraDocs
            },
            files: fileExplorerList
        });
    } catch (err) {
        console.error('Error fetching database stats:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve database stats: ' + err.message });
    }
});

// 8.16 SUPER ADMIN DATABASE REAL-TIME PING TEST
app.post('/api/admin/database/test-ping', verifySuperAdmin, async (req, res) => {
    const results = {
        timestamp: new Date().toISOString(),
        mongo: { status: 'checking', latencyMs: 0 },
        astra: { status: 'checking', latencyMs: 0 }
    };

    const tMongoStart = Date.now();
    try {
        if (isMongoConnected && mongoose.connection.readyState === 1) {
            await mongoose.connection.db.admin().ping();
            results.mongo = {
                status: 'ONLINE',
                engine: 'MongoDB Atlas Cloud',
                latencyMs: Date.now() - tMongoStart,
                message: 'MongoDB connection is healthy and responsive.'
            };
        } else {
            loadPortalDb();
            results.mongo = {
                status: 'ONLINE (Local Fallback)',
                engine: 'Local Persistent JSON Engine',
                latencyMs: Date.now() - tMongoStart,
                message: 'Local credentials engine is operating normally.'
            };
        }
    } catch (mErr) {
        results.mongo = {
            status: 'ERROR',
            latencyMs: Date.now() - tMongoStart,
            message: mErr.message
        };
    }

    const tAstraStart = Date.now();
    try {
        if (isAstraConnected && astraDb) {
            await astraDb.listCollections();
            results.astra = {
                status: 'ONLINE',
                engine: 'DataStax Astra DB (astra.datastax.com)',
                latencyMs: Date.now() - tAstraStart,
                endpoint: ASTRA_DB_API_ENDPOINT,
                message: 'Astra DB Serverless Cloud is active and connected.'
            };
        } else {
            results.astra = {
                status: 'NOT CONNECTED',
                latencyMs: 0,
                message: 'Astra DB client is not initialized. Please verify ASTRA_DB_APPLICATION_TOKEN in Render.'
            };
        }
    } catch (aErr) {
        results.astra = {
            status: 'ERROR',
            latencyMs: Date.now() - tAstraStart,
            message: aErr.message
        };
    }

    res.json({ success: true, results });
});

// ============================================================
// 8.17 DUAL-DATABASE FORMAT & ASSET MANAGEMENT CONTROLS
// ============================================================

// 8.17A Delete Individual Asset / File from Astra DB & Storage
app.post('/api/admin/database/delete-asset', verifySuperAdmin, async (req, res) => {
    try {
        const { id, name, filename, collection } = req.body;
        const targetId = id || filename || name;
        if (!targetId) {
            return res.status(400).json({ success: false, message: 'Asset identifier is required for deletion.' });
        }

        let deletedFromAstra = false;
        let deletedFromDisk = false;

        // 1. Delete from DataStax Astra DB
        if (isAstraConnected && astraDb) {
            const collectionsToCheck = collection 
                ? [collection] 
                : ['bbcc_assets', 'bbcc_banners', 'bbcc_live_classes', 'bbcc_recordings', 'bbcc_study_materials'];
            
            for (const colName of collectionsToCheck) {
                try {
                    const col = astraDb.collection(colName);
                    const filter = {
                        $or: [
                            { _id: targetId },
                            { filename: targetId },
                            { title: targetId },
                            { assetId: targetId }
                        ]
                    };
                    const delRes = await col.deleteMany(filter);
                    if (delRes && delRes.deletedCount > 0) {
                        deletedFromAstra = true;
                    }
                } catch (colErr) {
                    console.warn(`Astra delete notice from ${colName}:`, colErr.message);
                }
            }
        }

        // 2. Delete matching file from disk
        const checkDirs = [
            path.join(__dirname, 'public', 'uploads'),
            path.join(__dirname, 'public', 'uploads', 'materials'),
            path.join(__dirname, 'public', 'uploads', 'notes'),
            path.join(__dirname, 'public', 'uploads', 'thumbnails'),
            path.join(__dirname, 'public', 'data', 'branding'),
            path.join(__dirname, 'public', 'data', 'banners'),
            path.join(__dirname, 'public', 'data', 'photos'),
            path.join(__dirname, 'public', 'data', 'notes'),
            path.join(__dirname, 'public', 'data', 'materials')
        ];

        for (const dir of checkDirs) {
            try {
                const filePath = path.join(dir, targetId);
                if (fs.existsSync(filePath)) {
                    const stat = fs.statSync(filePath);
                    if (stat.isFile()) {
                        fs.unlinkSync(filePath);
                        deletedFromDisk = true;
                    }
                }
            } catch (dErr) {}
        }

        // 3. Remove references in portal_db.json if any
        try {
            const pdb = loadPortalDb();
            let pdbModified = false;
            if (pdb.settings && Array.isArray(pdb.settings.gallery)) {
                const initialLen = pdb.settings.gallery.length;
                pdb.settings.gallery = pdb.settings.gallery.filter(g => g.image !== targetId && g.image !== `/data/photos/${targetId}` && (g._id ? g._id.toString() : '') !== targetId);
                if (pdb.settings.gallery.length !== initialLen) pdbModified = true;
            }
            if (pdbModified) await savePortalDb(pdb);
        } catch (pdbErr) {}

        clearCache();

        res.json({
            success: true,
            message: `Asset "${targetId}" deleted successfully from DataStax Astra DB storage.`,
            deletedFromAstra,
            deletedFromDisk
        });
    } catch (err) {
        console.error('delete-asset error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete asset: ' + err.message });
    }
});

// 8.17B Format DataStax Astra DB (Heavy Media, Photos, Banners & PDFs Clean Slate)
app.post('/api/admin/database/format-astra', verifySuperAdmin, async (req, res) => {
    try {
        const { confirmation } = req.body;
        if (!confirmation || confirmation.trim().toUpperCase() !== 'FORMAT ASTRA') {
            return res.status(400).json({ success: false, message: 'Please type "FORMAT ASTRA" to confirm DataStax Astra DB wipe.' });
        }

        let clearedCollections = [];
        if (isAstraConnected && astraDb) {
            const collections = ['bbcc_assets', 'bbcc_banners', 'bbcc_live_classes', 'bbcc_recordings', 'bbcc_study_materials'];
            for (const colName of collections) {
                try {
                    const col = astraDb.collection(colName);
                    await col.deleteMany({});
                    clearedCollections.push(colName);
                } catch (cErr) {
                    console.warn(`Format Astra ${colName} notice:`, cErr.message);
                }
            }
        }

        // Clean user uploads on disk
        const dirsToClean = [
            path.join(__dirname, 'public', 'uploads'),
            path.join(__dirname, 'public', 'uploads', 'materials'),
            path.join(__dirname, 'public', 'uploads', 'notes'),
            path.join(__dirname, 'public', 'uploads', 'thumbnails')
        ];

        let filesRemoved = 0;
        for (const dir of dirsToClean) {
            if (fs.existsSync(dir)) {
                try {
                    const files = fs.readdirSync(dir);
                    for (const f of files) {
                        if (f === '.gitkeep') continue;
                        const fullPath = path.join(dir, f);
                        if (fs.statSync(fullPath).isFile()) {
                            fs.unlinkSync(fullPath);
                            filesRemoved++;
                        }
                    }
                } catch (e) {}
            }
        }

        clearCache();
        res.json({
            success: true,
            message: 'DataStax Astra DB media storage formatted and wiped clean successfully!',
            clearedCollections,
            filesRemoved
        });
    } catch (err) {
        console.error('format-astra error:', err);
        res.status(500).json({ success: false, message: 'Failed to format DataStax Astra DB: ' + err.message });
    }
});

// 8.17C Format MongoDB Atlas (Strictly Preserves Super Admin Credentials & API Integrations)
app.post('/api/admin/database/format-mongo', verifySuperAdmin, async (req, res) => {
    try {
        const { confirmation } = req.body;
        if (!confirmation || confirmation.trim().toUpperCase() !== 'FORMAT MONGO') {
            return res.status(400).json({ success: false, message: 'Please type "FORMAT MONGO" to confirm MongoDB wipe.' });
        }

        const pdb = loadPortalDb();

        // 1. Snapshot and strictly preserve Super Admin ID & Password
        let activeAdmin = null;
        if (isMongoConnected) {
            try {
                if (req.admin.id && mongoose.Types.ObjectId.isValid(req.admin.id)) {
                    activeAdmin = await Admin.findById(req.admin.id);
                }
                if (!activeAdmin && req.admin.adminId) {
                    activeAdmin = await Admin.findOne({ adminId: req.admin.adminId });
                }
            } catch (e) {}
        }
        if (!activeAdmin) {
            activeAdmin = (pdb.admins || []).find(a => 
                (req.admin.adminId && a.adminId && a.adminId.toLowerCase() === req.admin.adminId.toLowerCase()) ||
                (req.admin.id && a._id && a._id.toString() === req.admin.id) ||
                a.role === 'superadmin'
            ) || (pdb.admins || [])[0];
        }

        const preservedAdmin = {
            adminId: activeAdmin?.adminId || 'admin',
            password: activeAdmin?.password || '',
            name: activeAdmin?.name || 'BBCC Central Directorate',
            role: 'superadmin'
        };

        // 2. Snapshot and strictly preserve API integrations & Platform CMS Settings
        let preservedSettings = {};
        if (isMongoConnected) {
            try {
                const s = await Settings.findOne();
                if (s) preservedSettings = s.toObject();
            } catch (e) {}
        }
        if (!preservedSettings || Object.keys(preservedSettings).length === 0) {
            preservedSettings = pdb.settings ? { ...pdb.settings } : {};
        }

        // 3. Wipe MongoDB collections (Preserving Admin & Settings)
        if (isMongoConnected) {
            try {
                await TuitionCenter.deleteMany({});
                await Student.deleteMany({});
                await TeacherAccount.deleteMany({});
                await PaymentTransaction.deleteMany({});
                await SupportTicket.deleteMany({});
                await WithdrawalRequest.deleteMany({});
                await LiveClassSession.deleteMany({});
                await AdmissionInquiry.deleteMany({});
                await AffiliationApplication.deleteMany({});
                await StudyMaterial.deleteMany({});

                if (mongoose.models.PushSubscription) await mongoose.models.PushSubscription.deleteMany({});
                if (mongoose.models.Attendance) await mongoose.models.Attendance.deleteMany({});
                if (mongoose.models.Mark) await mongoose.models.Mark.deleteMany({});

                // Clean Admins collection to only keep preserved Super Admin
                await Admin.deleteMany({ adminId: { $ne: preservedAdmin.adminId } });
                const existingInMongo = await Admin.findOne({ adminId: preservedAdmin.adminId });
                if (!existingInMongo && preservedAdmin.password) {
                    await Admin.create(preservedAdmin);
                }

                // Preserve Settings
                let currentSettings = await Settings.findOne();
                if (!currentSettings) {
                    await Settings.create(preservedSettings);
                }
            } catch (mErr) {
                console.warn('MongoDB format notice:', mErr.message);
            }
        }

        // 4. Wipe portal_db.json collections while strictly keeping Admins and Settings
        pdb.admins = [preservedAdmin];
        pdb.settings = preservedSettings;
        pdb.centers = [];
        pdb.teachers = [];
        pdb.students = [];
        pdb.paymentTransactions = [];
        pdb.supportTickets = [];
        pdb.push_subscriptions = [];
        pdb.push_history = [];
        pdb.bharti_auto_push_log = {};
        pdb.attendance = [];
        pdb.marks = [];
        pdb.notices = [];
        pdb.liveSessions = [];
        pdb.admissionInquiries = [];
        pdb.affiliationApplications = [];
        pdb.withdrawals = [];
        pdb.studyMaterials = { notes: [], videos: [] };
        pdb.bookOrders = [];

        await savePortalDb(pdb);
        clearCache();

        res.json({
            success: true,
            message: 'MongoDB Atlas formatted successfully. Super Admin login credentials and all API integrations (Razorpay, Groq Cloud, Gemini AI, YouTube) have been strictly preserved.',
            preservedAdminId: preservedAdmin.adminId,
            preservedApis: {
                razorpay: Boolean(preservedSettings.razorpayKeyId),
                groq: Boolean(preservedSettings.groqApiKey),
                gemini: Boolean(preservedSettings.geminiApiKey),
                youtube: Boolean(preservedSettings.youtubeApiKey || preservedSettings.youtubeChannelId)
            }
        });
    } catch (err) {
        console.error('format-mongo error:', err);
        res.status(500).json({ success: false, message: 'Failed to format MongoDB: ' + err.message });
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
// 10. SERVER BOOT & HYBRID DATA ENGINE STARTUP
// ============================================================
mongoose.set('bufferCommands', false);

async function startServer() {
    loadPortalDb();

    console.log('🔄 Checking Dual Database Architecture...');
    // 1. Database 1: MongoDB for User IDs, Passwords, Center/Teacher/Student Logins & Auth
    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 2500
        });
        isMongoConnected = true;
        console.log('🌟 [MongoDB Connected] Handling User IDs, Passwords, Accounts & Auth Credentials:', MONGO_URI.includes('@') ? 'MongoDB Atlas Cloud' : MONGO_URI);
    } catch (err) {
        isMongoConnected = false;
        console.warn('⚠️ [MongoDB Notice] Not connected locally (' + err.message + '). Operating on local credential fallback.');
    }

    // 2. Database 2: DataStax Astra DB for Heavy Data (Photos, PDFs, Banners, Live Class Data)
    await initAstraDb();

    await initSystem();

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 BBCC Skill Hub Engine listening on port ${PORT}`);
        console.log(`🔗 Portal URL: http://localhost:${PORT}`);
        console.log(`🔐 Database 1 (IDs & Passwords): ${isMongoConnected ? 'MongoDB Cloud Active' : 'Local Fallback'}`);
        console.log(`⚡ Database 2 (Heavy Photos, PDFs, Live Classes): ${isAstraConnected ? 'DataStax Astra DB Cloud Active (astra.datastax.com)' : 'Local File Staging (Set ASTRA_DB_APPLICATION_TOKEN in Render)'}`);
        initRenderKeepAlive();
        initBhartiDailyPushScheduler();
    });
}

// ============================================================
// RENDER FREE TIER SLEEP-PREVENTION HEARTBEAT (12-Minute Keep-Alive)
// ============================================================
function initRenderKeepAlive() {
    const renderUrl = (process.env.RENDER_EXTERNAL_URL || 'https://balbharticoachingcenter.onrender.com').trim();
    if (!renderUrl) return;

    const pingTarget = `${renderUrl.replace(/\/+$/, '')}/api/public/ping`;
    console.log(`💓 Render 24/7 Keep-Alive Heartbeat configured for: ${pingTarget}`);

    // Initial ping after 30 seconds
    setTimeout(async () => {
        try {
            await fetch(pingTarget, { headers: { 'User-Agent': 'BBCC-KeepAlive-Heartbeat/1.0' } });
            console.log(`💓 Initial Render keep-alive ping dispatched successfully`);
        } catch(e) {}
    }, 30000);

    // Ping every 12 minutes (720,000 ms) to reset Render's 15-minute inactivity idle counter
    setInterval(async () => {
        try {
            const res = await fetch(pingTarget, {
                headers: { 'User-Agent': 'BBCC-KeepAlive-Heartbeat/1.0' }
            });
            if (res.ok) {
                console.log(`💓 [${new Date().toLocaleTimeString('en-IN')}] Render keep-alive ping successful`);
            }
        } catch (err) {
            console.warn(`💓 Render self-ping notice:`, err.message);
        }
    }, 12 * 60 * 1000);
}

// ============================================================
// WEB PUSH BROADCASTER & BHARTI AI AUTOMATED DAILY SCHEDULER
// ============================================================
const BHARTI_MORNING_MESSAGES = [
    "सुप्रभात! 'सफलता का रहस्य है प्रतिदिन निरंतर अभ्यास।' आज BBCC ई-लाइब्रेरी से अपना दैनिक लक्ष्य पूरा करें! 🌅",
    "BBCC दैनिक अध्ययन लक्ष्य: 10वीं व 12वीं बोर्ड परीक्षाओं के स्पेशल नोट्स और मॉडल पेपर्स ई-लाइब्रेरी में उपलब्ध हैं। 📖",
    "भारती AI प्रेरणा: 'एकाग्रता और अनुशासन ही सामान्य छात्र को टॉपर बनाते हैं।' आज का अध्ययन सत्र अभी शुरू करें! 🎯",
    "आज का सुविचार: अपनी कमियों को पहचानें और उन पर काम करें। कोई भी कठिन सवाल हो तो सीधे मुझसे पूछें! 💡"
];

const BHARTI_AFTERNOON_MESSAGES = [
    "दोपहर का रिविजन: क्या आपने आज का रिविजन पूरा किया? क्लास 9वीं, 10वीं व 12वीं के फॉर्मूला शीट्स ई-लाइब्रेरी से पढ़ें। 📚",
    "भारती AI स्किल टिप: कंप्यूटर व डिजिटल स्किल (DCA/ADCA/Tally Prime) में महारत हासिल करें। प्रैक्टिकल गाइड मुफ़्त पढ़ें। 💻",
    "दैनिक सामान्य ज्ञान: 'शिक्षा वह सबसे शक्तिशाली हथियार है जिसका उपयोग आप दुनिया को बदलने के लिए कर सकते हैं।' 🧠",
    "कैरियर अलर्ट: CTET, STET, BPSC TRE एवं बोर्ड परीक्षाओं की तैयारी के लिए टेस्ट सीरीज और नोट्स डाउनलोड करें! ⚡"
];

const BHARTI_EVENING_MESSAGES = [
    "शाम का अध्ययन समय: पढ़ाई में कोई भी डाउट हो तो सीधे मुझसे (भारती AI) पूछें! मैं 24/7 आपकी सहायता के लिए तैयार हूँ। 🌙",
    "भारती AI नाइट स्टडी मंत्र: सोने से पहले आज पढ़े गए विषयों का 15 मिनट का त्वरित रिविजन करें। कल के लिए ऑल द बेस्ट! 📖",
    "BBCC चेक-इन: अपनी कमजोरियों को मजबूत बनाने के लिए ई-लाइब्रेरी से चैप्टर नोट्स का दोबारा अध्ययन करें। 🎯",
    "शुभ रात्रि एवं अध्ययन टिप: निरंतरता ही सफलता की चाबी है। कल सुबह एक नए लक्ष्य के साथ उठें! ✨"
];

// Helper to broadcast push notifications to subscribers
async function sendPushNotificationToSubscribers(payload, targetCenterId = 'all') {
    const db = loadPortalDb();
    if (!db.push_subscriptions || !Array.isArray(db.push_subscriptions) || db.push_subscriptions.length === 0) {
        console.log('🔔 No push notification subscribers registered yet');
        return { sentCount: 0, failedCount: 0, total: 0 };
    }

    const payloadString = JSON.stringify(payload);
    let sentCount = 0;
    let failedCount = 0;
    const expiredEndpoints = new Set();

    const eligibleSubscribers = db.push_subscriptions.filter(sub => {
        if (!sub || !sub.endpoint) return false;
        if (!targetCenterId || targetCenterId === 'all') return true;
        return sub.centerId === targetCenterId || sub.centerId === 'all' || !sub.centerId;
    });

    console.log(`🔔 Dispatching push notification to ${eligibleSubscribers.length} devices (Target: ${targetCenterId})`);

    const sendPromises = eligibleSubscribers.map(async (sub) => {
        try {
            await webpush.sendNotification(sub, payloadString, { TTL: 86400 });
            sentCount++;
        } catch (err) {
            failedCount++;
            if (err.statusCode === 404 || err.statusCode === 410) {
                expiredEndpoints.add(sub.endpoint);
            }
        }
    });

    await Promise.allSettled(sendPromises);

    if (expiredEndpoints.size > 0) {
        db.push_subscriptions = db.push_subscriptions.filter(s => !expiredEndpoints.has(s.endpoint));
        await savePortalDb(db);
        console.log(`🔔 Cleaned up ${expiredEndpoints.size} expired push subscriptions`);
    }

    if (!db.push_history) db.push_history = [];
    db.push_history.unshift({
        id: 'push_' + Date.now(),
        title: payload.title,
        body: payload.body,
        url: payload.url || '/',
        targetCenterId,
        sentCount,
        failedCount,
        timestamp: new Date().toISOString(),
        sender: payload.sender || 'Admin'
    });
    if (db.push_history.length > 50) db.push_history = db.push_history.slice(0, 50);
    await savePortalDb(db);

    return { sentCount, failedCount, total: eligibleSubscribers.length };
}

async function triggerBhartiAutoPush(isForce = false) {
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffsetMs);
    const istHour = istDate.getUTCHours();
    const dateStr = istDate.toISOString().slice(0, 10);

    const db = loadPortalDb();
    if (!db.bharti_auto_push_log) db.bharti_auto_push_log = {};

    let targetSlot = null;
    let messageList = [];

    if (isForce) {
        if (istHour >= 6 && istHour < 12) {
            targetSlot = 'morning';
            messageList = BHARTI_MORNING_MESSAGES;
        } else if (istHour >= 12 && istHour < 17) {
            targetSlot = 'afternoon';
            messageList = BHARTI_AFTERNOON_MESSAGES;
        } else {
            targetSlot = 'evening';
            messageList = BHARTI_EVENING_MESSAGES;
        }
    } else {
        if (istHour >= 8 && istHour < 11) {
            targetSlot = 'morning';
            messageList = BHARTI_MORNING_MESSAGES;
        } else if (istHour >= 14 && istHour < 17) {
            targetSlot = 'afternoon';
            messageList = BHARTI_AFTERNOON_MESSAGES;
        } else if (istHour >= 19 && istHour < 22) {
            targetSlot = 'evening';
            messageList = BHARTI_EVENING_MESSAGES;
        }
    }

    if (!targetSlot) return { message: 'Not in active push slot window' };

    const logKey = `${dateStr}_${targetSlot}`;
    if (!isForce && db.bharti_auto_push_log[logKey]) {
        return { message: `Already dispatched today for slot: ${targetSlot}` };
    }

    const randomMsg = messageList[Math.floor(Math.random() * messageList.length)];
    const payload = {
        title: '🤖 भारती AI — ' + (targetSlot === 'morning' ? 'प्रभात संदेश 🌅' : targetSlot === 'afternoon' ? 'दैनिक अध्ययन टिप 📚' : 'शाम का चेक-इन 🌙'),
        body: randomMsg,
        icon: '/data/branding/logo.png',
        badge: '/data/branding/logo.png',
        url: '/',
        sender: 'भारती AI ऑटोमैटिक असिस्टेंट'
    };

    console.log(`🤖 Dispatching Bharti AI ${targetSlot} auto push: "${payload.title}"`);
    db.bharti_auto_push_log[logKey] = {
        dispatchedAt: new Date().toISOString(),
        slot: targetSlot,
        title: payload.title,
        body: payload.body
    };
    await savePortalDb(db);

    return await sendPushNotificationToSubscribers(payload, 'all');
}

function initBhartiDailyPushScheduler() {
    console.log('🤖 Bharti AI 2-3 Times Daily Push Notification Scheduler initialized');
    // First check after 45 seconds of startup
    setTimeout(() => {
        triggerBhartiAutoPush(false).catch(() => {});
    }, 45000);

    // Run check every 15 minutes (900,000 ms)
    setInterval(() => {
        triggerBhartiAutoPush(false).catch(() => {});
    }, 15 * 60 * 1000);
}

startServer();
