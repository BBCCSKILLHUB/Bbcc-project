// ============================================
// MINIMAL SERVER - ONLY START & DB CONNECTION
// ============================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bbcc_portal';

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB Connected Successfully');
        console.log('📦 Database:', MONGO_URI);
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    });

// Test Route
app.get('/', (req, res) => {
    res.json({ 
        message: 'Server is running!', 
        status: 'OK',
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`🔗 Test: http://localhost:${PORT}/`);
    console.log(`📊 Database: ${MONGO_URI}`);
    console.log('\n✨ Server is ready! No schemas, no models, just pure connection.\n');
});
