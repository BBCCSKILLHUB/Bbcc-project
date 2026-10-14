const http = require('http');

async function runRealtimeTest() {
    console.log('🧪 Starting Real-time SSE Live Auto-Sync Test...');

    // 1. Verify DB version endpoint
    const versionRes = await fetch('http://localhost:5000/api/public/db-version');
    const versionData = await versionRes.json();
    console.log('1. DB Version check:', versionData);
    if (!versionData.success || !versionData.version) {
        throw new Error('Failed to retrieve db version');
    }

    // 2. Open SSE stream connection to /api/public/events
    console.log('2. Opening SSE client connection to /api/public/events...');
    let connectedReceived = false;
    let updateReceived = false;
    let receivedPayload = null;

    const req = http.request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/public/events',
        method: 'GET',
        headers: {
            'Accept': 'text/event-stream'
        }
    }, (res) => {
        console.log('SSE Stream status:', res.statusCode, res.headers['content-type']);
        if (res.statusCode !== 200 || !res.headers['content-type'].includes('text/event-stream')) {
            console.error('SSE Stream failed to connect with text/event-stream');
            process.exit(1);
        }

        let buffer = '';
        res.on('data', (chunk) => {
            buffer += chunk.toString();
            console.log('--- Incoming SSE chunk ---\n' + chunk.toString().trim());

            if (buffer.includes('event: connected')) {
                connectedReceived = true;
            }
            if (buffer.includes('event: update')) {
                updateReceived = true;
                const match = buffer.match(/data:\s*(\{.*\})/);
                if (match) {
                    try {
                        receivedPayload = JSON.parse(match[1]);
                    } catch(e) {}
                }
            }
        });
    });

    req.on('error', (err) => {
        console.error('SSE request error:', err);
    });

    req.end();

    // Wait 500ms for connection handshake
    await new Promise(r => setTimeout(r, 600));

    if (!connectedReceived) {
        throw new Error('Did not receive connected handshake from SSE stream!');
    }
    console.log('✅ SSE Handshake confirmed received!');

    // Check active listeners count
    const v2Res = await fetch('http://localhost:5000/api/public/db-version');
    const v2Data = await v2Res.json();
    console.log('3. Active listeners count:', v2Data.activeListeners);
    if (v2Data.activeListeners < 1) {
        throw new Error('activeListeners count should be at least 1');
    }

    // 4. Trigger database mutation (create a temporary test center)
    const testUsername = 'realtime_sync_test_' + Date.now();
    console.log(`4. Triggering database mutation with test affiliation registration (${testUsername})...`);
    
    const regRes = await fetch('http://localhost:5000/api/pay/create-affiliation-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            centerName: 'Realtime Live Test Academy',
            username: testUsername,
            password: 'TestPassword123@',
            directorName: 'Director Realtime',
            contactNumber: '9876543210',
            whatsappNumber: '9876543210',
            email: 'realtime@bbccskillhub.org',
            state: 'Bihar',
            district: 'Patna',
            address: 'Patna Test Hub',
            fromClass: 'Class 6th',
            toClass: 'Class 12th',
            termsAccepted: true
        })
    });
    const regData = await regRes.json();
    console.log('Affiliation order creation response:', regData.success, regData.isFreeAffiliation);

    // Wait up to 1500ms to verify SSE event received
    let waited = 0;
    while (!updateReceived && waited < 2000) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
    }

    if (!updateReceived) {
        throw new Error('Failed: Real-time update event was NOT broadcast to SSE client within 2s!');
    }
    console.log('✅ Real-time update event received by client in ' + waited + 'ms!');
    console.log('Received Event Payload:', receivedPayload);

    // 5. Verify /api/public/centers returns the updated list
    const centersRes = await fetch('http://localhost:5000/api/public/centers?_t=' + Date.now());
    const centersData = await centersRes.json();
    const found = centersData.data.find(c => c.username === testUsername);
    console.log('5. Centers list updated dynamically:', !!found);
    if (!found) {
        throw new Error('New center not found in public centers API!');
    }
    console.log('✅ Public centers API instantly reflects the new center!');

    // 6. Clean up test center so zero dummy data remains
    console.log('6. Cleaning up test data to maintain zero dummy data rule...');
    const fs = require('fs');
    const dbPath = './public/data/portal_db.json';
    const pdb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    pdb.centers = pdb.centers.filter(c => c.username !== testUsername);
    if (pdb.affiliationApplications) {
        pdb.affiliationApplications = pdb.affiliationApplications.filter(a => a.contactNumber !== '9876543210');
    }
    if (pdb.paymentTransactions) {
        pdb.paymentTransactions = pdb.paymentTransactions.filter(p => p.payerPhone !== '9876543210');
    }
    fs.writeFileSync(dbPath, JSON.stringify(pdb, null, 2), 'utf8');

    // Also trigger clearCache on server
    const cleanupRes = await fetch('http://localhost:5000/api/admin/clean-orphaned-data', {
        headers: { 'Authorization': 'Bearer test' }
    }).catch(() => null);

    req.destroy();
    console.log('🎉 100% REAL-TIME LIVE AUTO-SYNC TEST PASSED SUCCESSFULLY!');
}

runRealtimeTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
