const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

async function runAudit() {
    console.log('================================================================');
    console.log('🚀 BBCC SYSTEM AUDIT: VERIFYING ALL 5 USER-REPORTED ISSUES');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(cond, msg) {
        if (cond) {
            console.log(`  ✅ PASS: ${msg}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${msg}`);
            failed++;
        }
    }

    // 1. Super Admin Authentication
    console.log('--- Step 1: Admin Authentication ---');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123', role: 'superadmin' })
    });
    const loginData = await loginRes.json();
    assert(loginData.success && loginData.token, 'Super Admin login successfully generated token');
    const adminToken = loginData.token;

    // 2. Affiliations & Licenses Endpoint Dual Persistence
    console.log('\n--- Step 2: Affiliations & Licenses Dual Persistence ---');
    const affRes = await fetch(`${BASE_URL}/api/admin/affiliations?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const affData = await affRes.json();
    const affList = Array.isArray(affData) ? affData : (affData.data || []);
    assert(affRes.ok && Array.isArray(affList), `GET /api/admin/affiliations returns valid structure (current records: ${affList.length})`);

    // 3. Transactions Endpoint Dual Persistence
    console.log('\n--- Step 3: Payment Transactions Dual Persistence ---');
    const txRes = await fetch(`${BASE_URL}/api/admin/transactions?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const txData = await txRes.json();
    const txList = Array.isArray(txData) ? txData : (txData.data || []);
    assert(txRes.ok && Array.isArray(txList), `GET /api/admin/transactions returns valid structure (current records: ${txList.length})`);

    // 4. Center Admission Fee & Registration Dual Persistence
    console.log('\n--- Step 4: Center Admission Fee Configuration & Persistence ---');
    const testUsername = 'audit-center-' + Date.now().toString().slice(-4);
    const regRes = await fetch(`${BASE_URL}/api/admin/centers`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            centerName: 'Audit Excellence Academy',
            directorName: 'Er. Rajesh Kumar',
            username: testUsername,
            password: 'directorPassword123',
            contactNumber: '9876543210',
            address: 'Patna, Bihar',
            admissionFee: 500
        })
    });
    const regData = await regRes.json();
    const centerId = regData.data?._id || regData.center?._id || regData._id;
    assert(regRes.ok && regData.success && centerId, `Center created with admissionFee ₹500 (ID: ${centerId})`);

    // Admin updates admission fee to ₹750
    const updateRes = await fetch(`${BASE_URL}/api/admin/centers/${centerId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            centerName: 'Audit Excellence Academy',
            directorName: 'Er. Rajesh Kumar',
            username: testUsername,
            contactNumber: '9876543210',
            address: 'Patna, Bihar',
            admissionFee: 750
        })
    });
    const updateData = await updateRes.json();
    assert(updateRes.ok && updateData.success, 'Admin updated center admissionFee to ₹750');

    // Verify in public centers endpoint
    const centersResAfter = await fetch(`${BASE_URL}/api/public/centers?_t=${Date.now()}`);
    const centersAfterData = await centersResAfter.json();
    const centersList = Array.isArray(centersAfterData) ? centersAfterData : (centersAfterData.data || []);
    const updatedCenter = centersList.find(c => c._id === centerId || c.id === centerId);
    assert(updatedCenter && updatedCenter.admissionFee === 750, 'Public centers endpoint reflects updated admissionFee ₹750');

    // Director login & update admission fee
    console.log('\n--- Step 4b: Director Admission Fee Self-Update ---');
    const dirLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: testUsername, password: 'directorPassword123', role: 'director' })
    });
    const dirLoginData = await dirLoginRes.json();
    assert(dirLoginData.success && dirLoginData.token, 'Center Director logged in successfully');
    const dirToken = dirLoginData.token;

    const dirUpdateRes = await fetch(`${BASE_URL}/api/director/profile`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${dirToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: 'Audit Excellence Academy (Director Updated)',
            directorName: 'Er. Rajesh Kumar',
            phone: '9876543210',
            admissionFee: 850
        })
    });
    const dirUpdateData = await dirUpdateRes.json();
    assert(dirUpdateRes.ok && dirUpdateData.success, 'Director updated profile & admissionFee to ₹850');

    // Verify public centers reflects Director's update
    const centersResDir = await fetch(`${BASE_URL}/api/public/centers?_t=${Date.now()}`);
    const centersDirData = await centersResDir.json();
    const centersDirList = Array.isArray(centersDirData) ? centersDirData : (centersDirData.data || []);
    const centerDirUpdated = centersDirList.find(c => c._id === centerId || c.id === centerId);
    assert(centerDirUpdated && centerDirUpdated.admissionFee === 850, 'Public centers reflects Director updated fee ₹850');

    // Verify affiliation and transaction were populated in admin endpoints
    const affResCheck = await fetch(`${BASE_URL}/api/admin/affiliations?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const affCheckData = await affResCheck.json();
    const affCheckList = Array.isArray(affCheckData) ? affCheckData : (affCheckData.data || []);
    const hasAff = affCheckList.some(a => a.centerName === 'Audit Excellence Academy' || a.username === testUsername);
    assert(hasAff, 'Affiliation application is visible in Admin Console Tab 4');

    const txResCheck = await fetch(`${BASE_URL}/api/admin/transactions?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const txCheckData = await txResCheck.json();
    const txCheckList = Array.isArray(txCheckData) ? txCheckData : (txCheckData.data || []);
    const hasTx = txCheckList.some(t => t.payerName === 'Audit Excellence Academy' || t.centerName === 'Audit Excellence Academy');
    assert(hasTx, 'Transaction record is visible in Admin Console Tab 5');

    // 5. Target Center Scope & Homepage E-Library Isolation
    console.log('\n--- Step 5: Target Center Scope Isolation & Homepage E-Library Sync ---');
    const testUniversalTitle = 'AUDIT_UNIVERSAL_NOTE_' + Date.now();
    const testScopedTitle = 'AUDIT_SCOPED_NOTE_' + Date.now();

    // 5a. Admin uploads Universal Note (targetCenterId = 'all')
    const addUnivRes = await fetch(`${BASE_URL}/api/admin/books`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: testUniversalTitle,
            subject: 'Science',
            targetClass: 'Class 10',
            price: 0,
            file: 'https://example.com/test-universal.pdf',
            description: 'Audit test universal note',
            targetCenterId: 'all'
        })
    });
    const addUnivData = await addUnivRes.json();
    const univId = addUnivData.data?._id || addUnivData.material?.id || addUnivData.book?.id;
    assert(addUnivRes.ok && addUnivData.success && univId, `Universal study material uploaded (ID: ${univId})`);

    // 5b. Admin uploads Center-Scoped Note (targetCenterId = centerId)
    const addScopedRes = await fetch(`${BASE_URL}/api/admin/books`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: testScopedTitle,
            subject: 'Mathematics',
            targetClass: 'Class 12',
            price: 0,
            file: 'https://example.com/test-scoped.pdf',
            description: 'Audit test scoped note',
            targetCenterId: centerId
        })
    });
    const addScopedData = await addScopedRes.json();
    const scopedId = addScopedData.data?._id || addScopedData.material?.id || addScopedData.book?.id;
    assert(addScopedRes.ok && addScopedData.success && scopedId, `Center-scoped study material uploaded (ID: ${scopedId})`);

    // 5c. Check Public Homepage Books endpoint:
    const pubBooksRes = await fetch(`${BASE_URL}/api/public/books?_t=${Date.now()}`);
    const pubBooksData = await pubBooksRes.json();
    const pubNotes = (pubBooksData.data && pubBooksData.data.notes) || (pubBooksData.books) || [];

    const foundUnivOnHome = pubNotes.some(b => b.title === testUniversalTitle);
    const foundScopedOnHome = pubNotes.some(b => b.title === testScopedTitle);

    assert(foundUnivOnHome, 'Universal Note successfully visible in Public Homepage E-Library');
    assert(!foundScopedOnHome, 'Center-Scoped Note STRICTLY EXCLUDED from Public Homepage E-Library');

    // 5d. Check Director Raw-Materials endpoint:
    const dirMatRes = await fetch(`${BASE_URL}/api/director/raw-materials?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${dirToken}` }
    });
    const dirMatData = await dirMatRes.json();
    const dirNotes = Array.isArray(dirMatData.data) ? dirMatData.data : ((dirMatData.materials && dirMatData.materials.notes) || []);

    const foundUnivInDir = dirNotes.some(n => n.title === testUniversalTitle);
    const foundScopedInDir = dirNotes.some(n => n.title === testScopedTitle);

    assert(foundUnivInDir, 'Director dashboard receives Universal Note');
    assert(foundScopedInDir, 'Director dashboard receives their Scoped Note');

    // 5e. Clean up test notes & test center & affiliation/tx records
    console.log('\n--- Step 5e: Clean up audit test data ---');
    if (univId) {
        await fetch(`${BASE_URL}/api/admin/books/${univId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
    }
    if (scopedId) {
        await fetch(`${BASE_URL}/api/admin/books/${scopedId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
    }
    if (centerId) {
        await fetch(`${BASE_URL}/api/admin/centers/${centerId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
    }

    // Double check clean state in portal_db.json
    const dbPath = path.join(__dirname, '../public/data/portal_db.json');
    const pdbClean = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    pdbClean.centers = (pdbClean.centers || []).filter(c => c._id !== centerId && c.id !== centerId && !c.username?.startsWith('audit-center-'));
    pdbClean.affiliationApplications = (pdbClean.affiliationApplications || []).filter(a => !a.username?.startsWith('audit-center-'));
    pdbClean.paymentTransactions = (pdbClean.paymentTransactions || []).filter(t => !t.centerName?.includes('Audit Excellence'));
    if (pdbClean.studyMaterials && pdbClean.studyMaterials.notes) {
        pdbClean.studyMaterials.notes = pdbClean.studyMaterials.notes.filter(n => !n.title?.startsWith('AUDIT_'));
    }
    fs.writeFileSync(dbPath, JSON.stringify(pdbClean, null, 2), 'utf8');
    console.log('     Audit test notes, centers, and test records cleaned up completely.');

    // 6. Zero Dummy Data in Gallery
    console.log('\n--- Step 6: Gallery Dummy Data Eradication Check ---');
    const configRes = await fetch(`${BASE_URL}/api/public/config?_t=${Date.now()}`);
    const config = await configRes.json();
    const gallery = (config.settings && config.settings.gallery) || (config.data && config.data.gallery) || [];
    assert(gallery.length === 0, `Public gallery has 0 dummy photos (Actual count: ${gallery.length})`);

    const dbRaw = fs.readFileSync(dbPath, 'utf8');
    const db = JSON.parse(dbRaw);
    assert(Array.isArray(db.settings.gallery) && db.settings.gallery.length === 0, 'portal_db.json gallery is strictly empty array `[]`');
    assert(Array.isArray(db.centers) && db.centers.length === 0, 'portal_db.json centers is strictly clean (0 dummy centers)');

    console.log(`\n================================================================`);
    console.log(`🏁 AUDIT RESULT: PASSED: ${passed} | FAILED: ${failed}`);
    console.log(`================================================================`);
    if (failed === 0) {
        console.log('🎉 100% SUCCESS: ALL 5 USER-REPORTED ISSUES CONFIRMED RESOLVED & VERIFIED!');
    } else {
        process.exitCode = 1;
    }
}

runAudit().catch(err => {
    console.error('Audit failed with uncaught exception:', err);
    process.exit(1);
});
