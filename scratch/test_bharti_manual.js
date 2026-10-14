// Test Bharti AI Manual responses across roles and languages
const http = require('http');

async function askBharti(message, language = 'hi', name = 'Rohit Kumar') {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            message,
            language,
            visitorProfile: { name, mobile: '9876543210', language },
            history: []
        });

        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/public/bharti-chat',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    resolve({ raw: data });
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function runTests() {
    console.log('Testing Bharti AI User Manual Knowledge Base...');

    const tests = [
        { query: 'admin user manual bataiye', lang: 'hi', desc: 'Admin Manual (Hindi)' },
        { query: 'director portal kaise use kare', lang: 'hinglish', desc: 'Director SOP (Hinglish)' },
        { query: 'teacher studio live broadcast guide', lang: 'en', desc: 'Teacher Manual (English)' },
        { query: 'student classroom kaise chalaye', lang: 'bho', desc: 'Student SOP (Bhojpuri)' },
        { query: 'user manual guide dikhao', lang: 'hi', desc: 'General Platform Manual (Hindi)' }
    ];

    let passed = 0;
    for (const t of tests) {
        console.log(`\n--- Test: ${t.desc} ---`);
        const res = await askBharti(t.query, t.lang);
        if (res.success && res.reply) {
            console.log('REPLY:\n' + res.reply.substring(0, 220) + '...\n');
            const hasBeta = /\bbeta\b/i.test(res.reply) || /\bbeti\b/i.test(res.reply) || /बेटा/.test(res.reply) || /बेटी/.test(res.reply);
            if (hasBeta) {
                console.error('FAILED: Reply contained beta/beti!');
            } else {
                console.log('PASSED: Respectful, no beta/beti.');
                passed++;
            }
        } else {
            console.error('FAILED:', res);
        }
    }

    console.log(`\nResult: ${passed}/${tests.length} tests passed.`);
}

runTests();
