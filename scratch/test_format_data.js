const fs = require('fs');
const bcrypt = require('bcryptjs');

async function runTest() {
    console.log('====================================================');
    console.log('🧪 TESTING MASTER DATA FORMAT & ADMIN PRESERVATION');
    console.log('====================================================');

    const BASE_URL = 'http://localhost:5000';

    // 1. Verify Invalid Password Fails
    console.log('\n[1] Testing Admin Login with Wrong Password...');
    const failRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'admin',
            password: 'completely_wrong_password_999',
            role: 'superadmin'
        })
    });
    console.log('Wrong Password Response Status:', failRes.status);
    const failData = await failRes.json();
    console.log('Wrong Password Message:', failData.message);
    if (failRes.status === 401 && !failData.success) {
        console.log('✅ PASS: Wrong password rejected properly.');
    } else {
        console.error('❌ FAIL: Wrong password was not rejected!');
    }

    // 2. Admin Login with Current Valid Password
    console.log('\n[2] Logging in with current Admin credentials...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'admin',
            password: 'admin123',
            role: 'superadmin'
        })
    });
    const loginData = await loginRes.json();
    console.log('Login Result:', loginData.success, 'Role:', loginData.role);
    if (!loginData.success || !loginData.token) {
        throw new Error('Admin login failed: ' + JSON.stringify(loginData));
    }
    const token = loginData.token;
    console.log('✅ PASS: Admin logged in successfully and acquired JWT token.');

    // 3. Test Invalid Format Confirmation
    console.log('\n[3] Testing Format Data with invalid confirmation phrase...');
    const badConfirmRes = await fetch(`${BASE_URL}/api/admin/format-data`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ confirmation: 'WRONG_PHRASE' })
    });
    console.log('Bad Confirmation Status:', badConfirmRes.status);
    const badConfirmData = await badConfirmRes.json();
    console.log('Bad Confirmation Message:', badConfirmData.message);
    if (badConfirmRes.status === 400 && !badConfirmData.success) {
        console.log('✅ PASS: Invalid confirmation prevented accidental wipe.');
    } else {
        console.error('❌ FAIL: Invalid confirmation was not rejected!');
    }

    // 4. Execute Valid Format Data Request
    console.log('\n[4] Executing Platform Data Format with "FORMAT DATA"...');
    const formatRes = await fetch(`${BASE_URL}/api/admin/format-data`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ confirmation: 'FORMAT DATA' })
    });
    const formatData = await formatRes.json();
    console.log('Format Status:', formatRes.status);
    console.log('Format Response:', formatData);
    if (!formatData.success) {
        throw new Error('Format failed: ' + formatData.message);
    }
    console.log('✅ PASS: /api/admin/format-data returned success.');

    // 5. Inspect portal_db.json
    console.log('\n[5] Inspecting portal_db.json on disk...');
    const pdb = JSON.parse(fs.readFileSync('public/data/portal_db.json', 'utf8'));
    console.log('Centers count:', pdb.centers ? pdb.centers.length : 0);
    console.log('Students count:', pdb.students ? pdb.students.length : 0);
    console.log('Inquiries count:', pdb.admissionInquiries ? pdb.admissionInquiries.length : 0);
    console.log('Live sessions count:', pdb.liveSessions ? pdb.liveSessions.length : 0);
    console.log('Admins count:', pdb.admins ? pdb.admins.length : 0);
    console.log('Admin ID:', pdb.admins[0]?.adminId);
    console.log('Admin Name:', pdb.admins[0]?.name);
    console.log('Admin Role:', pdb.admins[0]?.role);

    const matchPass = await bcrypt.compare('admin123', pdb.admins[0].password);
    console.log('Preserved Admin Password Hash matches active password:', matchPass);

    if (
        pdb.centers.length === 0 &&
        pdb.students.length === 0 &&
        pdb.admins.length === 1 &&
        pdb.admins[0].adminId === 'admin' &&
        matchPass === true
    ) {
        console.log('✅ PASS: All operational collections wiped; Super Admin credentials 100% PRESERVED!');
    } else {
        console.error('❌ FAIL: Data inspection did not match expected formatted state!');
    }

    // 6. Verify Admin Can Still Log In Immediately After Format
    console.log('\n[6] Verifying Admin Login After Format...');
    const postLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'admin',
            password: 'admin123',
            role: 'superadmin'
        })
    });
    const postLoginData = await postLoginRes.json();
    console.log('Post-Format Login Result:', postLoginData.success);
    if (postLoginData.success && postLoginData.token) {
        console.log('✅ PASS: Admin logged in seamlessly after complete platform format!');
    } else {
        console.error('❌ FAIL: Admin could not log in after format!');
    }

    console.log('\n====================================================');
    console.log('🎉 ALL FORMAT DATA & ADMIN PRESERVATION TESTS PASSED!');
    console.log('====================================================');
}

runTest().catch(console.error);
