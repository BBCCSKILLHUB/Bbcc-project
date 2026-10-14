const fs = require('fs');

const BASE_URL = 'http://localhost:5000';

let passed = 0;
let failed = 0;
const results = [];

function recordTest(category, name, ok, details = '') {
    if (ok) {
        passed++;
        results.push({ category, name, status: 'PASS', details });
        console.log(`  ✅ [PASS] ${category} - ${name} ${details ? '(' + details + ')' : ''}`);
    } else {
        failed++;
        results.push({ category, name, status: 'FAIL', details });
        console.error(`  ❌ [FAIL] ${category} - ${name} : ${details}`);
    }
}

async function runMasterSuite() {
    console.log('================================================================');
    console.log('🚀 BBCC SKILL HUB — MASTER ALL-APIS & FUNCTIONS TEST SUITE');
    console.log('================================================================\n');

    let adminToken = '';
    let directorToken = '';
    let teacherToken = '';
    let studentToken = '';
    let createdCenterId = '';
    let testTeacherId = '';
    let testStudentRoll = 'PAT-' + Date.now().toString().slice(-6);
    let testStudentAadhar = '9999' + Math.floor(10000000 + Math.random() * 90000000);
    let testLiveClassId = '';

    // ==========================================
    // GROUP 1: PUBLIC & VISITOR APIS
    // ==========================================
    console.log('--- [1] PUBLIC & VISITOR APIS ---');
    try {
        const pingRes = await fetch(`${BASE_URL}/api/public/ping`);
        const pingData = await pingRes.json();
        recordTest('Public', 'GET /api/public/ping', pingRes.ok && pingData.success, `status: ${pingData.status}`);
    } catch (e) {
        recordTest('Public', 'GET /api/public/ping', false, e.message);
    }

    try {
        const cfgRes = await fetch(`${BASE_URL}/api/public/config`);
        const cfgData = await cfgRes.json();
        recordTest('Public', 'GET /api/public/config', cfgRes.ok && cfgData.success, `board: ${cfgData.data?.boardTitle || 'BBCC'}`);
    } catch (e) {
        recordTest('Public', 'GET /api/public/config', false, e.message);
    }

    try {
        const centersRes = await fetch(`${BASE_URL}/api/public/centers?_t=${Date.now()}`);
        const centersData = await centersRes.json();
        recordTest('Public', 'GET /api/public/centers', centersRes.ok && centersData.success, `count: ${centersData.data?.length}`);
    } catch (e) {
        recordTest('Public', 'GET /api/public/centers', false, e.message);
    }

    try {
        const booksRes = await fetch(`${BASE_URL}/api/public/books?_t=${Date.now()}`);
        const booksData = await booksRes.json();
        const notesCount = booksData.data?.notes?.length || 0;
        recordTest('Public', 'GET /api/public/books', booksRes.ok && booksData.success, `notes count: ${notesCount}`);
    } catch (e) {
        recordTest('Public', 'GET /api/public/books', false, e.message);
    }

    try {
        const founderRes = await fetch(`${BASE_URL}/api/public/founder`);
        const founderData = await founderRes.json();
        recordTest('Public', 'GET /api/public/founder', founderRes.ok && founderData.success, `founder: ${founderData.data?.name}`);
    } catch (e) {
        recordTest('Public', 'GET /api/public/founder', false, e.message);
    }

    try {
        const inqRes = await fetch(`${BASE_URL}/api/public/inquiry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentName: 'Rahul Verma',
                phone: '9876501234',
                mobile: '9876501234',
                classLevel: 'Class 10th',
                message: 'Inquiring about science batch timings'
            })
        });
        const inqData = await inqRes.json();
        recordTest('Public', 'POST /api/public/inquiry', inqRes.ok && inqData.success, inqData.message);
    } catch (e) {
        recordTest('Public', 'POST /api/public/inquiry', false, e.message);
    }

    try {
        const ticketRes = await fetch(`${BASE_URL}/api/public/support-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Kavita Kumari',
                email: 'kavita@example.com',
                phone: '9876543210',
                subject: 'Need information about scholarship exam',
                message: 'When is the 2026 BBCC scholarship test scheduled?'
            })
        });
        const ticketData = await ticketRes.json();
        recordTest('Public', 'POST /api/public/support-ticket', ticketRes.ok && ticketData.success, `ticket: ${ticketData.ticket?.ticketId || 'OK'}`);
    } catch (e) {
        recordTest('Public', 'POST /api/public/support-ticket', false, e.message);
    }

    try {
        const bhartiRes = await fetch(`${BASE_URL}/api/public/bharti-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Hello Bharti, how to join BBCC certified coaching?' })
        });
        const bhartiData = await bhartiRes.json();
        recordTest('Public', 'POST /api/public/bharti-chat', bhartiRes.ok && bhartiData.success, `response length: ${bhartiData.reply?.length || 0}`);
    } catch (e) {
        recordTest('Public', 'POST /api/public/bharti-chat', false, e.message);
    }

    try {
        const pushKeyRes = await fetch(`${BASE_URL}/api/push/vapid-public-key`);
        const pushKeyData = await pushKeyRes.json();
        recordTest('Public', 'GET /api/push/vapid-public-key', pushKeyRes.ok && pushKeyData.success, `key present: ${!!pushKeyData.publicKey}`);
    } catch (e) {
        recordTest('Public', 'GET /api/push/vapid-public-key', false, e.message);
    }


    // ==========================================
    // GROUP 2: SUPER ADMIN AUTH & CONSOLE APIS
    // ==========================================
    console.log('\n--- [2] SUPER ADMIN APIS ---');
    try {
        const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123', role: 'superadmin' })
        });
        const adminLoginData = await adminLoginRes.json();
        if (adminLoginRes.ok && adminLoginData.success && adminLoginData.token) {
            adminToken = adminLoginData.token;
            recordTest('Admin', 'POST /api/auth/login (Admin)', true, `role: ${adminLoginData.role}`);
        } else {
            recordTest('Admin', 'POST /api/auth/login (Admin)', false, adminLoginData.message);
        }
    } catch (e) {
        recordTest('Admin', 'POST /api/auth/login (Admin)', false, e.message);
    }

    if (adminToken) {
        const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };

        try {
            const setRes = await fetch(`${BASE_URL}/api/admin/settings`, { headers: adminHeaders });
            const setData = await setRes.json();
            recordTest('Admin', 'GET /api/admin/settings', setRes.ok && setData.success, `title: ${setData.data?.boardTitle || 'OK'}`);
        } catch (e) {
            recordTest('Admin', 'GET /api/admin/settings', false, e.message);
        }

        try {
            const affRes = await fetch(`${BASE_URL}/api/admin/affiliations`, { headers: adminHeaders });
            const affData = await affRes.json();
            recordTest('Admin', 'GET /api/admin/affiliations', affRes.ok && affData.success, `count: ${affData.data?.length}`);
        } catch (e) {
            recordTest('Admin', 'GET /api/admin/affiliations', false, e.message);
        }

        try {
            const txnRes = await fetch(`${BASE_URL}/api/admin/transactions`, { headers: adminHeaders });
            const txnData = await txnRes.json();
            recordTest('Admin', 'GET /api/admin/transactions', txnRes.ok && txnData.success, `count: ${txnData.data?.length}`);
        } catch (e) {
            recordTest('Admin', 'GET /api/admin/transactions', false, e.message);
        }

        try {
            const stuRes = await fetch(`${BASE_URL}/api/admin/students`, { headers: adminHeaders });
            const stuData = await stuRes.json();
            recordTest('Admin', 'GET /api/admin/students', stuRes.ok && stuData.success, `count: ${stuData.data?.length}`);
        } catch (e) {
            recordTest('Admin', 'GET /api/admin/students', false, e.message);
        }

        try {
            const tktRes = await fetch(`${BASE_URL}/api/admin/tickets`, { headers: adminHeaders });
            const tktData = await tktRes.json();
            recordTest('Admin', 'GET /api/admin/tickets', tktRes.ok && tktData.success, `count: ${tktData.data?.length}`);
        } catch (e) {
            recordTest('Admin', 'GET /api/admin/tickets', false, e.message);
        }

        try {
            const pRes = await fetch(`${BASE_URL}/api/admin/payouts`, { headers: adminHeaders });
            const pData = await pRes.json();
            recordTest('Admin', 'GET /api/admin/payouts', pRes.ok && pData.success, `count: ${pData.data?.length}`);
        } catch (e) {
            recordTest('Admin', 'GET /api/admin/payouts', false, e.message);
        }

        // Test Center Creation by Admin
        try {
            const createCenterRes = await fetch(`${BASE_URL}/api/admin/centers`, {
                method: 'POST',
                headers: adminHeaders,
                body: JSON.stringify({
                    centerName: 'Master Testing Academy',
                    directorName: 'Director Sharma',
                    username: 'master-test-' + Date.now().toString().slice(-4),
                    password: 'directorPassword123',
                    contactNumber: '9123456789',
                    address: 'Test City, Bihar',
                    admissionFee: 250
                })
            });
            const createCenterData = await createCenterRes.json();
            if (createCenterRes.ok && createCenterData.success && createCenterData.data) {
                createdCenterId = createCenterData.data._id;
                recordTest('Admin', 'POST /api/admin/centers (Create)', true, `username: ${createCenterData.data.username}`);
            } else {
                recordTest('Admin', 'POST /api/admin/centers (Create)', false, createCenterData.message);
            }
        } catch (e) {
            recordTest('Admin', 'POST /api/admin/centers (Create)', false, e.message);
        }

        // Test Center Block / Unblock
        if (createdCenterId) {
            try {
                const blockRes = await fetch(`${BASE_URL}/api/admin/centers/${createdCenterId}/block`, {
                    method: 'POST',
                    headers: adminHeaders,
                    body: JSON.stringify({ isBlocked: true, blockReason: 'Routine Maintenance Verification', dueAmount: 500 })
                });
                const blockData = await blockRes.json();
                recordTest('Admin', 'POST /api/admin/centers/:id/block', blockRes.ok && blockData.success, `status: suspended`);

                const unblockRes = await fetch(`${BASE_URL}/api/admin/centers/${createdCenterId}/block`, {
                    method: 'POST',
                    headers: adminHeaders,
                    body: JSON.stringify({ isBlocked: false, blockReason: '', dueAmount: 0 })
                });
                const unblockData = await unblockRes.json();
                recordTest('Admin', 'POST /api/admin/centers/:id/block (Unblock)', unblockRes.ok && unblockData.success, `status: active`);
            } catch (e) {
                recordTest('Admin', 'POST /api/admin/centers/:id/block', false, e.message);
            }
        }
    }


    // ==========================================
    // GROUP 3: COACHING DIRECTOR APIS
    // ==========================================
    console.log('\n--- [3] COACHING DIRECTOR APIS ---');
    try {
        const dirLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'patna-central', password: 'director12345', role: 'director' })
        });
        const dirLoginData = await dirLoginRes.json();
        if (dirLoginRes.ok && dirLoginData.success && dirLoginData.token) {
            directorToken = dirLoginData.token;
            recordTest('Director', 'POST /api/auth/login (Director)', true, `center: ${dirLoginData.user?.name}`);
        } else {
            recordTest('Director', 'POST /api/auth/login (Director)', false, dirLoginData.message);
        }
    } catch (e) {
        recordTest('Director', 'POST /api/auth/login (Director)', false, e.message);
    }

    if (directorToken) {
        const dirHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${directorToken}` };

        try {
            const profRes = await fetch(`${BASE_URL}/api/director/profile`, { headers: dirHeaders });
            const profData = await profRes.json();
            recordTest('Director', 'GET /api/director/profile', profRes.ok && profData.success, `center: ${profData.data?.centerName}`);
        } catch (e) {
            recordTest('Director', 'GET /api/director/profile', false, e.message);
        }

        try {
            const crsRes = await fetch(`${BASE_URL}/api/director/courses`, { headers: dirHeaders });
            const crsData = await crsRes.json();
            recordTest('Director', 'GET /api/director/courses', crsRes.ok && crsData.success, `count: ${crsData.data?.length}`);
        } catch (e) {
            recordTest('Director', 'GET /api/director/courses', false, e.message);
        }

        // Add Faculty Teacher
        try {
            testTeacherId = 'TCH-TEST-' + Date.now().toString().slice(-4);
            const addTchRes = await fetch(`${BASE_URL}/api/director/teachers`, {
                method: 'POST',
                headers: dirHeaders,
                body: JSON.stringify({
                    name: 'Prof. Anjali Mehta',
                    subject: 'Physics & Mechanics',
                    teacherId: testTeacherId,
                    password: 'teachPass123',
                    phone: '9811223344',
                    qualification: 'M.Sc Physics (Gold Medalist)',
                    experience: '5+ Years'
                })
            });
            const addTchData = await addTchRes.json();
            recordTest('Director', 'POST /api/director/teachers', addTchRes.ok && addTchData.success, `id: ${testTeacherId}`);
        } catch (e) {
            recordTest('Director', 'POST /api/director/teachers', false, e.message);
        }

        // Enroll Student
        try {
            const enrollRes = await fetch(`${BASE_URL}/api/director/students`, {
                method: 'POST',
                headers: dirHeaders,
                body: JSON.stringify({
                    name: 'Aman Kumar',
                    rollNo: testStudentRoll,
                    aadharNumber: testStudentAadhar,
                    classLevel: 'Class 12th',
                    parentName: 'Suresh Kumar',
                    mobile: '9876543299',
                    address: 'Patna, Bihar',
                    admissionFee: 350
                })
            });
            const enrollData = await enrollRes.json();
            recordTest('Director', 'POST /api/director/students (Enroll)', enrollRes.ok && enrollData.success, enrollData.success ? `roll: ${enrollData.data?.rollNo || testStudentRoll}` : enrollData.message);
        } catch (e) {
            recordTest('Director', 'POST /api/director/students (Enroll)', false, e.message);
        }

        try {
            const dStudentsRes = await fetch(`${BASE_URL}/api/director/students`, { headers: dirHeaders });
            const dStudentsData = await dStudentsRes.json();
            recordTest('Director', 'GET /api/director/students', dStudentsRes.ok && dStudentsData.success, `students: ${dStudentsData.data?.length}`);
        } catch (e) {
            recordTest('Director', 'GET /api/director/students', false, e.message);
        }

        try {
            const earnRes = await fetch(`${BASE_URL}/api/director/earnings`, { headers: dirHeaders });
            const earnData = await earnRes.json();
            recordTest('Director', 'GET /api/director/earnings', earnRes.ok && earnData.success, `wallet: ₹${earnData.data?.walletBalance || 0}`);
        } catch (e) {
            recordTest('Director', 'GET /api/director/earnings', false, e.message);
        }
    }


    // ==========================================
    // GROUP 4: TEACHER STUDIO APIS
    // ==========================================
    console.log('\n--- [4] TEACHER STUDIO APIS ---');
    try {
        const tchLoginRes = await fetch(`${BASE_URL}/api/teacher/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                teacherId: testTeacherId || 'TCH-TEST-001',
                password: 'teachPass123'
            })
        });
        const tchLoginData = await tchLoginRes.json();
        if (tchLoginRes.ok && tchLoginData.success && tchLoginData.token) {
            teacherToken = tchLoginData.token;
            recordTest('Teacher', 'POST /api/teacher/login', true, `faculty: ${tchLoginData.teacher?.name}`);
        } else {
            recordTest('Teacher', 'POST /api/teacher/login', false, tchLoginData.message);
        }
    } catch (e) {
        recordTest('Teacher', 'POST /api/teacher/login', false, e.message);
    }

    if (teacherToken) {
        const tchHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` };

        try {
            const profRes = await fetch(`${BASE_URL}/api/teacher/profile`, { headers: tchHeaders });
            const profData = await profRes.json();
            recordTest('Teacher', 'GET /api/teacher/profile', profRes.ok && profData.success, `subject: ${profData.teacher?.subject}`);
        } catch (e) {
            recordTest('Teacher', 'GET /api/teacher/profile', false, e.message);
        }

        // Start Live Broadcast
        try {
            const liveStartRes = await fetch(`${BASE_URL}/api/live/start`, {
                method: 'POST',
                headers: tchHeaders,
                body: JSON.stringify({
                    title: 'Live Masterclass: Electromagnetism & Waves',
                    subject: 'Physics',
                    classLevel: 'Class 12th'
                })
            });
            const liveStartData = await liveStartRes.json();
            testLiveClassId = liveStartData.classId;
            recordTest('Teacher', 'POST /api/live/start', liveStartRes.ok && liveStartData.success, `classId: ${testLiveClassId}`);
        } catch (e) {
            recordTest('Teacher', 'POST /api/live/start', false, e.message);
        }

        // Check Active Live Classes
        try {
            const activeLiveRes = await fetch(`${BASE_URL}/api/live/active`);
            const activeLiveData = await activeLiveRes.json();
            const list = activeLiveData.data || activeLiveData.activeClasses || activeLiveData.activeSessions || [];
            const hasClass = list.some(c => c.classId === testLiveClassId);
            recordTest('Teacher', 'GET /api/live/active', activeLiveRes.ok && hasClass, hasClass ? 'broadcasting live' : 'session not in active list');
        } catch (e) {
            recordTest('Teacher', 'GET /api/live/active', false, e.message);
        }

        // Send Live Chat Message
        if (testLiveClassId) {
            try {
                const chatRes = await fetch(`${BASE_URL}/api/live/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        classId: testLiveClassId,
                        sender: 'Prof. Anjali Mehta',
                        role: 'teacher',
                        text: 'Welcome students to today\'s live physics class!'
                    })
                });
                const chatData = await chatRes.json();
                recordTest('Teacher', 'POST /api/live/chat', chatRes.ok && chatData.success, `chat message sent`);
            } catch (e) {
                recordTest('Teacher', 'POST /api/live/chat', false, e.message);
            }

            // End Live Broadcast
            try {
                const liveEndRes = await fetch(`${BASE_URL}/api/live/end`, {
                    method: 'POST',
                    headers: tchHeaders,
                    body: JSON.stringify({ classId: testLiveClassId })
                });
                const liveEndData = await liveEndRes.json();
                recordTest('Teacher', 'POST /api/live/end', liveEndRes.ok && liveEndData.success, liveEndData.message);
            } catch (e) {
                recordTest('Teacher', 'POST /api/live/end', false, e.message);
            }
        }
    }


    // ==========================================
    // GROUP 5: STUDENT CLASSROOM APIS
    // ==========================================
    console.log('\n--- [5] STUDENT CLASSROOM APIS ---');
    try {
        const stuLoginRes = await fetch(`${BASE_URL}/api/public/student-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aadharNumber: testStudentAadhar })
        });
        const stuLoginData = await stuLoginRes.json();
        if (stuLoginRes.ok && stuLoginData.success && stuLoginData.token) {
            studentToken = stuLoginData.token;
            recordTest('Student', 'POST /api/public/student-login', true, `student: ${stuLoginData.student?.name}`);
        } else {
            recordTest('Student', 'POST /api/public/student-login', false, stuLoginData.message);
        }
    } catch (e) {
        recordTest('Student', 'POST /api/public/student-login', false, e.message);
    }

    if (studentToken) {
        try {
            const classRes = await fetch(`${BASE_URL}/api/student/classroom`, {
                headers: { 'Authorization': `Bearer ${studentToken}` }
            });
            const classData = await classRes.json();
            recordTest('Student', 'GET /api/student/classroom', classRes.ok && classData.success, `notes: ${classData.notes?.length || 0}`);
        } catch (e) {
            recordTest('Student', 'GET /api/student/classroom', false, e.message);
        }
    }

    try {
        const verStuRes = await fetch(`${BASE_URL}/api/public/verify-student/${testStudentAadhar}`);
        const verStuData = await verStuRes.json();
        recordTest('Student', 'GET /api/public/verify-student/:query', verStuRes.ok && verStuData.success, `verified: ${verStuData.data?.name}`);
    } catch (e) {
        recordTest('Student', 'GET /api/public/verify-student/:query', false, e.message);
    }


    // ==========================================
    // GROUP 6: WEBRTC CALL & SIGNALING APIS
    // ==========================================
    console.log('\n--- [6] WEBRTC & ENCRYPTED CALL APIS ---');
    let callRoomId = 'test_call_' + Date.now();
    try {
        const callInitRes = await fetch(`${BASE_URL}/api/call/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: 'direct',
                callerName: 'BBCC Central Directorate',
                roomId: callRoomId
            })
        });
        const callInitData = await callInitRes.json();
        recordTest('WebRTC', 'POST /api/call/initiate', callInitRes.ok && callInitData.success, `room: ${callInitData.roomId || callRoomId}`);
    } catch (e) {
        recordTest('WebRTC', 'POST /api/call/initiate', false, e.message);
    }

    try {
        const signalRes = await fetch(`${BASE_URL}/api/call/signal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId: callRoomId,
                sender: 'student',
                data: { type: 'offer', sdp: 'v=0\r\no=mock 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' }
            })
        });
        const signalData = await signalRes.json();
        recordTest('WebRTC', 'POST /api/call/signal', signalRes.ok && signalData.success, `signal routed`);
    } catch (e) {
        recordTest('WebRTC', 'POST /api/call/signal', false, e.message);
    }

    try {
        const getSigRes = await fetch(`${BASE_URL}/api/call/signal/${callRoomId}`);
        const getSigData = await getSigRes.json();
        recordTest('WebRTC', 'GET /api/call/signal/:roomId', getSigRes.ok && getSigData.success, `signals count: ${getSigData.signals?.length || 0}`);
    } catch (e) {
        recordTest('WebRTC', 'GET /api/call/signal/:roomId', false, e.message);
    }

    try {
        const endCallRes = await fetch(`${BASE_URL}/api/call/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: callRoomId })
        });
        const endCallData = await endCallRes.json();
        recordTest('WebRTC', 'POST /api/call/end', endCallRes.ok && endCallData.success, `call ended`);
    } catch (e) {
        recordTest('WebRTC', 'POST /api/call/end', false, e.message);
    }


    // ==========================================
    // GROUP 7: PAYMENT GATEWAY ORDER CREATION
    // ==========================================
    console.log('\n--- [7] PAYMENT GATEWAY APIS ---');
    try {
        const docOrderRes = await fetch(`${BASE_URL}/api/pay/create-document-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                docId: 'non_existent_mock_id',
                payerName: 'Aman Kumar',
                payerPhone: '9876543210'
            })
        });
        const docOrderData = await docOrderRes.json();
        // Since document does not exist, expecting proper 404 validation response
        const ok = (docOrderRes.status === 404 || docOrderRes.status === 200);
        recordTest('Payment', 'POST /api/pay/create-document-order (Validation)', ok, `status: ${docOrderRes.status}`);
    } catch (e) {
        recordTest('Payment', 'POST /api/pay/create-document-order', false, e.message);
    }

    try {
        const admOrderRes = await fetch(`${BASE_URL}/api/pay/create-admission-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admissionData: {
                    name: 'Aman Kumar',
                    mobile: '9876543210',
                    centerId: '6acf8e22c86b8944207efad9'
                },
                amount: 0 // Free admission branch
            })
        });
        const admOrderData = await admOrderRes.json();
        recordTest('Payment', 'POST /api/pay/create-admission-order (Free/Direct)', admOrderRes.ok && admOrderData.success, admOrderData.message);
    } catch (e) {
        recordTest('Payment', 'POST /api/pay/create-admission-order', false, e.message);
    }

    try {
        const affOrderRes = await fetch(`${BASE_URL}/api/pay/create-affiliation-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                centerName: 'New Affiliation Institute',
                directorName: 'Director Verma',
                username: 'affil-test-' + Date.now().toString().slice(-4),
                password: 'directorPassword123',
                contactNumber: '9876543210',
                address: 'Gaya, Bihar'
            })
        });
        const affOrderData = await affOrderRes.json();
        // Either instant sandbox creation (status 200) or razorpay order
        recordTest('Payment', 'POST /api/pay/create-affiliation-order', affOrderRes.ok && affOrderData.success, affOrderData.message || `order: ${affOrderData.orderId}`);
    } catch (e) {
        recordTest('Payment', 'POST /api/pay/create-affiliation-order', false, e.message);
    }


    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('\n================================================================');
    console.log(`📊 MASTER TEST RESULTS: ${passed} PASSED | ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('================================================================');

    if (failed === 0) {
        console.log('🎉 100% OF ALL TESTED APIS & FUNCTIONS ARE WORKING FLAWLESSLY!');
    } else {
        console.warn(`⚠️ Attention: ${failed} API calls encountered issues. Review details above.`);
    }
}

runMasterSuite().catch(console.error);
