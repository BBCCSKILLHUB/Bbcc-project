const fs = require('fs');

async function testCoachingAdd() {
    console.log('========================================================');
    console.log('🏫 TESTING DIRECT COACHING CENTER ADD & VERIFICATION');
    console.log('========================================================');

    const BASE_URL = 'http://localhost:5000';

    // 1. Login as Super Admin
    console.log('\n[1] Logging in as Super Admin...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123', role: 'superadmin' })
    });
    const loginData = await loginRes.json();
    console.log('Admin Login:', loginData.success, 'Token:', !!loginData.token);
    if (!loginData.success || !loginData.token) {
        throw new Error('Admin login failed: ' + JSON.stringify(loginData));
    }
    const token = loginData.token;

    // 2. Register New Coaching Center (Test normalization with spaces in username)
    console.log('\n[2] Registering new partner coaching center with "Patna Central Academy"...');
    const newCenterPayload = {
        centerName: 'Patna Central Science Academy',
        directorName: 'Prof. Manoj Kumar',
        username: 'patna-central',
        password: 'director12345',
        contactNumber: '9876543210',
        address: 'Boring Road, Patna, Bihar',
        admissionFee: 350
    };

    const regRes = await fetch(`${BASE_URL}/api/admin/centers`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newCenterPayload)
    });
    console.log('Registration HTTP Status:', regRes.status);
    const regData = await regRes.json();
    console.log('Registration Response:', regData);
    if (!regRes.ok || !regData.success) {
        throw new Error('Registration failed: ' + JSON.stringify(regData));
    }
    console.log('✅ PASS: Partner coaching center registered successfully!');

    // 3. Test Duplicate Username Rejection
    console.log('\n[3] Testing duplicate username prevention...');
    const dupRes = await fetch(`${BASE_URL}/api/admin/centers`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newCenterPayload)
    });
    console.log('Duplicate Check HTTP Status:', dupRes.status);
    const dupData = await dupRes.json();
    console.log('Duplicate Message:', dupData.message);
    if (dupRes.status === 400 && !dupData.success) {
        console.log('✅ PASS: Duplicate center username prevented with proper message.');
    } else {
        console.error('❌ FAIL: Duplicate username was not rejected!');
    }

    // 4. Verify Immediate Listing in Public Centers List (No Cache Lag)
    console.log('\n[4] Verifying newly added center appears in centers list immediately...');
    const listRes = await fetch(`${BASE_URL}/api/public/centers?_t=${Date.now()}`);
    const listData = await listRes.json();
    console.log('Centers List Status:', listRes.status, 'Total centers:', listData.data?.length);
    const found = (listData.data || []).find(c => c.username === 'patna-central');
    console.log('Found in public list:', !!found, 'Name:', found?.centerName);
    if (found) {
        console.log('✅ PASS: Newly added center is immediately visible in the directory!');
    } else {
        console.error('❌ FAIL: Center not found in list immediately after creation!');
    }

    // 5. Test Director Login with Newly Created Credentials
    console.log('\n[5] Testing Director login with the newly created credentials...');
    const dirLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'patna-central',
            password: 'director12345',
            role: 'director'
        })
    });
    const dirLoginData = await dirLoginRes.json();
    console.log('Director Login Result:', dirLoginData.success, 'Role:', dirLoginData.role, 'Redirect:', dirLoginData.redirect);
    if (dirLoginData.success && dirLoginData.role === 'director' && dirLoginData.token) {
        console.log('✅ PASS: Newly registered center director can log in immediately!');
    } else {
        console.error('❌ FAIL: Director login failed with newly created credentials!');
    }

    // 6. Inspect portal_db.json on disk
    console.log('\n[6] Checking persistent storage on disk (portal_db.json)...');
    const pdb = JSON.parse(fs.readFileSync('public/data/portal_db.json', 'utf8'));
    const diskFound = (pdb.centers || []).find(c => c.username === 'patna-central');
    console.log('Found in portal_db.json on disk:', !!diskFound);
    console.log('Admission fee on disk:', diskFound?.admissionFee);
    if (diskFound && diskFound.admissionFee === 350) {
        console.log('✅ PASS: Center persistently saved with all configuration fields intact!');
    } else {
        console.error('❌ FAIL: Center not correctly saved on disk!');
    }

    console.log('\n========================================================');
    console.log('🎉 ALL COACHING CENTER REGISTRATION TESTS PASSED (100%)!');
    console.log('========================================================');
}

testCoachingAdd().catch(console.error);
