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
// STUDENT MANAGEMENT APIS
// ============================================

// Student Schema
const StudentSchema = new mongoose.Schema({
    studentId: { type: String, required: true, unique: true },
    aadharNumber: { type: String, required: true, unique: true },
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

// ===== GET ALL STUDENTS =====
app.get('/api/students', verifyToken, async (req, res) => {
    try {
        const students = await Student.find().sort({ createdAt: -1 });
        res.json({ success: true, data: students });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===== GET SINGLE STUDENT =====
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

// ===== ADD STUDENT =====
app.post('/api/students', verifyToken, async (req, res) => {
    try {
        const data = req.body;
        
        // Check if aadhar exists
        const existing = await Student.findOne({ aadharNumber: data.aadharNumber });
        if (existing) {
            return res.status(400).json({ success: false, message: "Aadhar number already registered" });
        }
        
        // Generate student ID
        const count = await Student.countDocuments();
        const studentId = `STU${String(count + 1).padStart(4, '0')}`;
        
        // Create full name
        const fullName = [data.name.first, data.name.middle, data.name.last].filter(Boolean).join(' ');
        
        // Create education history entry
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
        
        // Generate months from joining date to current date
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
        
        const student = new Student({
            studentId: studentId,
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

// ===== UPDATE STUDENT =====
app.put('/api/students/:id', verifyToken, async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.id });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        
        const updates = req.body;
        const allowedFields = ['name', 'dob', 'gender', 'studentMobile', 'email', 'address', 
                               'fatherName', 'fatherMobile', 'motherName', 'motherMobile',
                               'guardianName', 'guardianMobile', 'guardianRelation', 'photo'];
        
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

// ===== DELETE STUDENT =====
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

// ===== ADD PAYMENT =====
app.post('/api/students/:id/payment', verifyToken, async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.id });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        
        const { month, year, paidAmount, paymentMode, remarks } = req.body;
        
        // Find current education history
        const currentHistory = student.educationHistory.find(h => h.isActive === true);
        if (!currentHistory) {
            return res.status(404).json({ success: false, message: "No active class found" });
        }
        
        // Find the fee record
        const feeRecord = currentHistory.fees.find(f => f.month === month && f.year === year);
        if (!feeRecord) {
            return res.status(404).json({ success: false, message: "Fee record not found" });
        }
        
        // Update fee record
        const newPaidAmount = (feeRecord.paidAmount || 0) + paidAmount;
        feeRecord.paidAmount = newPaidAmount;
        feeRecord.dueAmount = feeRecord.amount - newPaidAmount;
        feeRecord.status = newPaidAmount >= feeRecord.amount ? 'paid' : newPaidAmount > 0 ? 'partial' : 'unpaid';
        feeRecord.paymentDate = new Date();
        feeRecord.paymentMode = paymentMode || 'cash';
        if (remarks) feeRecord.remarks = remarks;
        
        // Update totals for this class
        currentHistory.totalPaid = currentHistory.fees.reduce((sum, f) => sum + (f.paidAmount || 0), 0);
        currentHistory.totalDue = currentHistory.totalFees - currentHistory.totalPaid;
        
        // Update overall totals
        student.totalPaid = student.educationHistory.reduce((sum, h) => sum + (h.totalPaid || 0), 0);
        student.totalDue = student.totalFees - student.totalPaid;
        
        student.updatedAt = new Date();
        await student.save();
        
        res.json({ success: true, message: "Payment added successfully", data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===== PROMOTE STUDENT =====
app.post('/api/students/:id/promote', verifyToken, async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.id });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        
        const { newClass, newBoard, newFees, promotionDate } = req.body;
        
        // Find current active class
        const currentHistory = student.educationHistory.find(h => h.isActive === true);
        if (!currentHistory) {
            return res.status(404).json({ success: false, message: "No active class found" });
        }
        
        // Check if all fees are paid
        const dueAmount = currentHistory.fees.reduce((sum, f) => sum + (f.dueAmount || 0), 0);
        if (dueAmount > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Please clear all dues (₹${dueAmount}) before promotion` 
            });
        }
        
        // Mark current class as completed
        currentHistory.isActive = false;
        currentHistory.isCompleted = true;
        currentHistory.endDate = new Date(promotionDate);
        currentHistory.promotedTo = newClass;
        currentHistory.promotedDate = new Date(promotionDate);
        
        // Create new education entry
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
        
        // Generate months from promotion date
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
        
        // Update current class details
        student.currentClass = newClass;
        student.currentBoard = newBoard;
        student.joiningDate = newJoiningDate;
        student.monthlyFees = newFees;
        
        // Update overall totals
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

// ===== SEARCH STUDENTS =====
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
// ===== CLOSE CLASS =====
app.post('/api/students/:id/close-class', verifyToken, async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.id });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        
        const { className } = req.body;
        
        // Find the class in education history
        const classIndex = student.educationHistory.findIndex(h => h.class === className && h.isActive === true);
        if (classIndex === -1) {
            return res.status(404).json({ success: false, message: "Active class not found" });
        }
        
        // Mark class as completed
        student.educationHistory[classIndex].isActive = false;
        student.educationHistory[classIndex].isCompleted = true;
        student.educationHistory[classIndex].endDate = new Date();
        
        // Check if there's any other active class
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
