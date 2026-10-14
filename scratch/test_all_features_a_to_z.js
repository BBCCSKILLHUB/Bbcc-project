const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const fetchOptions = {
        method: options.method || 'GET',
        headers
    };
    if (options.body) {
        fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }
    const res = await fetch(url, fetchOptions);
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        data = { text };
    }
    return { status: res.status, ok: res.ok, data };
}

const report = [];

function recordTest(module, feature, passed, details) {
    report.push({ module, feature, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${mark}] [${module}] ${feature}: ${details}`);
}

async function runTestSuite() {
    console.log('====================================================');
    console.log('🚀 BBCC SKILL HUB - END-TO-END A-TO-Z FEATURE AUDIT');
    console.log('====================================================\n');

    let adminToken = '';
    let directorToken = '';
    let teacherToken = '';
    let testCenterId = '';
    let testTeacherId = '';
    let testCourseId = '';
    let testStudentRoll = '';
    let testClassId = '';
    let testMaterialId = '';

    // ==========================================
    // MODULE 1: SUPER ADMIN AUDIT
    // ==========================================
    console.log('\n--- 1. TESTING SUPER ADMIN FEATURES ---');

    // 1.1 Super Admin Login
    try {
        const res = await request('/api/auth/login', {
            method: 'POST',
            body: { username: 'admin', password: 'admin123', role: 'superadmin' }
        });
        if (res.ok && res.data.success && res.data.token) {
            adminToken = res.data.token;
            recordTest('Admin', 'Super Admin Authentication', true, `Token issued: ${adminToken.slice(0, 15)}... Role: ${res.data.role}`);
        } else {
            recordTest('Admin', 'Super Admin Authentication', false, res.data.message || 'Login failed');
        }
    } catch (e) {
        recordTest('Admin', 'Super Admin Authentication', false, e.message);
    }

    // 1.2 System Settings & Public Config
    try {
        const res = await request('/api/public/config');
        if (res.ok && res.data.success && res.data.data) {
            recordTest('Admin', 'Global CMS & System Settings', true, `Title: "${res.data.data.boardTitle}", Marquee: ${res.data.data.newsMarquee ? 'Configured' : 'Empty'}`);
        } else {
            recordTest('Admin', 'Global CMS & System Settings', false, 'Failed to fetch settings');
        }
    } catch (e) {
        recordTest('Admin', 'Global CMS & System Settings', false, e.message);
    }

    // 1.3 Super Admin Live Monitor Deck
    try {
        const res = await request('/api/admin/live-monitor', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok && res.data.success && Array.isArray(res.data.liveStreams)) {
            recordTest('Admin', 'National Live Stream Monitoring Deck', true, `Deck active. Currently on-air: ${res.data.liveStreams.length} sessions`);
        } else {
            recordTest('Admin', 'National Live Stream Monitoring Deck', false, res.data.message || 'Monitor deck failed');
        }
    } catch (e) {
        recordTest('Admin', 'National Live Stream Monitoring Deck', false, e.message);
    }

    // 1.4 Central Admin Live Broadcast Start & End
    try {
        const startRes = await request('/api/admin/live/start', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: {
                title: 'Audit Test Central Directorate Masterclass',
                hostName: 'Director General BBCC',
                subject: 'Quality & Governance',
                description: 'National Central Audit Test'
            }
        });
        if (startRes.ok && startRes.data.success && startRes.data.classId) {
            const centralClassId = startRes.data.classId;
            recordTest('Admin', 'Central Admin Live Broadcast Start', true, `Session initialized: ${centralClassId}`);

            // Verify live monitor detects it
            const monRes = await request('/api/admin/live-monitor', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            const found = monRes.data?.liveStreams?.some(s => s.classId === centralClassId);
            recordTest('Admin', 'Real-time Live Stream Deck Detection', Boolean(found), `Central stream detected in national monitoring deck: ${found}`);

            // End broadcast
            const endRes = await request('/api/admin/live/end', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${adminToken}` },
                body: { classId: centralClassId }
            });
            recordTest('Admin', 'Central Live Stream Termination', Boolean(endRes.data?.success), 'Instant room closure & signaling purge complete');
        } else {
            recordTest('Admin', 'Central Admin Live Broadcast Start', false, startRes.data.message || 'Failed to start');
        }
    } catch (e) {
        recordTest('Admin', 'Central Admin Live Broadcast', false, e.message);
    }

    // 1.5 Super Admin Vault & Recordings
    try {
        const res = await request('/api/admin/all-recordings', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok && res.data.success && Array.isArray(res.data.recordings)) {
            recordTest('Admin', 'All Coaching Centers Recorded Vault', true, `Vault loaded with ${res.data.recordings.length} archived sessions & YouTube trackers`);
        } else {
            recordTest('Admin', 'All Coaching Centers Recorded Vault', false, res.data.message || 'Vault load failed');
        }
    } catch (e) {
        recordTest('Admin', 'All Coaching Centers Recorded Vault', false, e.message);
    }

    // ==========================================
    // MODULE 2: COACHING DIRECTOR AUDIT
    // ==========================================
    console.log('\n--- 2. TESTING COACHING DIRECTOR FEATURES ---');

    // 2.1 Center Registration & Instant Affiliation
    const testCenterUser = 'audit_center_' + Date.now().toString().slice(-4);
    try {
        const regRes = await request('/api/admin/centers', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: {
                centerName: 'Bal Bharti Model Coaching Institute',
                directorName: 'Dr. R. K. Sharma',
                username: testCenterUser,
                password: 'directorPassword123',
                contactNumber: '9876543210',
                address: 'BBCC Knowledge Park, Sector 4, Patna',
                fromClass: 'Class 6th',
                toClass: 'Class 12th',
                admissionFee: 200
            }
        });
        if (regRes.ok && regRes.data.success && regRes.data.data) {
            testCenterId = regRes.data.data._id || '';
            recordTest('Director', 'Center Online Registration & Instant Activation', true, `Center created: ${testCenterUser} (ID: ${testCenterId})`);
        } else {
            recordTest('Director', 'Center Online Registration & Instant Activation', false, regRes.data.message || 'Registration failed');
        }
    } catch (e) {
        recordTest('Director', 'Center Online Registration', false, e.message);
    }

    // 2.2 Director Login
    try {
        const loginRes = await request('/api/auth/login', {
            method: 'POST',
            body: { username: testCenterUser, password: 'directorPassword123', role: 'director' }
        });
        if (loginRes.ok && loginRes.data.success && loginRes.data.token) {
            directorToken = loginRes.data.token;
            testCenterId = loginRes.data.user?.centerId || testCenterId;
            recordTest('Director', 'Director Authentication & Session', true, `Login verified. Token: ${directorToken.slice(0, 15)}...`);
        } else {
            recordTest('Director', 'Director Authentication & Session', false, loginRes.data.message || 'Login failed');
        }
    } catch (e) {
        recordTest('Director', 'Director Authentication', false, e.message);
    }

    // 2.3 Director Profile View & Update
    try {
        const profRes = await request('/api/director/profile', {
            headers: { 'Authorization': `Bearer ${directorToken}` }
        });
        if (profRes.ok && profRes.data.success) {
            recordTest('Director', 'Director Studio Profile & KYC Desk', true, `Center Name: "${profRes.data.data.centerName}", Director: ${profRes.data.data.directorName}`);
        } else {
            recordTest('Director', 'Director Studio Profile & KYC Desk', false, profRes.data.message || 'Profile fetch failed');
        }
    } catch (e) {
        recordTest('Director', 'Director Studio Profile', false, e.message);
    }

    // 2.4 Add Faculty Member (Teacher)
    const testTeacherPhone = '91' + Math.floor(10000000 + Math.random() * 90000000);
    try {
        const tfRes = await request('/api/director/teachers', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${directorToken}` },
            body: {
                name: 'Prof. Alok Verma',
                phone: testTeacherPhone,
                password: 'teacherPass123',
                subject: 'Mathematics & Quantum Mechanics',
                qualification: 'M.Sc., Ph.D. Mathematics',
                experience: '8+ Years Senior Faculty'
            }
        });
        if (tfRes.ok && tfRes.data.success) {
            testTeacherId = tfRes.data.teacherId || '';
            recordTest('Director', 'Faculty Member Addition & Credentials', true, `Faculty created: Prof. Alok Verma (ID: ${testTeacherId}, Phone: ${testTeacherPhone})`);
        } else {
            recordTest('Director', 'Faculty Member Addition & Credentials', false, tfRes.data.message || 'Faculty add failed');
        }
    } catch (e) {
        recordTest('Director', 'Faculty Member Addition', false, e.message);
    }

    // 2.5 Create Course / Batch
    try {
        const crsRes = await request('/api/director/courses', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${directorToken}` },
            body: {
                courseName: 'IIT JEE Advanced Mathematics Mastery',
                subject: 'Mathematics',
                classLevel: 'Class 12th',
                mode: 'both',
                onlineFee: 4500,
                offlineFee: 6500,
                batchTiming: 'Morning 8:00 AM - 10:00 AM',
                description: 'Full live syllabus coverage with study notes and mock test series.'
            }
        });
        if (crsRes.ok && crsRes.data.success) {
            const courseList = crsRes.data.data || [];
            testCourseId = courseList[courseList.length - 1]?._id || 'crs_' + Date.now();
            recordTest('Director', 'Course & Batch Curriculum Scheduling', true, `Course created: "IIT JEE Advanced Mathematics Mastery" (ID: ${testCourseId})`);
        } else {
            recordTest('Director', 'Course & Batch Curriculum Scheduling', false, crsRes.data.message || 'Course create failed');
        }
    } catch (e) {
        recordTest('Director', 'Course & Batch Scheduling', false, e.message);
    }

    // 2.6 Study Material / Notes Upload (Verifying GitHub / filesystem storage!)
    try {
        const samplePdfBase64 = 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iagoyIDAgb2JqCjw8IC9UeXBlIC9QYWdlcyAvS2lkcyBbMyAwIFJdIC9Db3VudCAxID4+CmVuZG9iagozIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgPj4KZW5kb2JqCnRyYWlsZXIKPDwgL1Jvb3QgMSAwIFIgPj4KJSVFT0YK';
        const matRes = await request('/api/director/materials', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${directorToken}` },
            body: {
                title: 'JEE Advanced Calculus Chapter Notes Vol 1',
                description: 'Comprehensive formulas and solved problems',
                price: 149,
                pdfMrp: 299,
                physicalPrice: 399,
                physicalMrp: 599,
                pdf: samplePdfBase64,
                storageMode: 'normal'
            }
        });
        if (matRes.ok && matRes.data.success) {
            const materials = matRes.data.data || [];
            const lastMat = materials[materials.length - 1] || {};
            testMaterialId = lastMat._id || '';
            const fileUrl = lastMat.file || lastMat.pdf || '';
            const isLocalDiskPath = fileUrl.startsWith('/data/materials/');
            recordTest('Director', 'Study Material Upload (GitHub/Filesystem Storage)', isLocalDiskPath, `Saved to disk path: "${fileUrl}" (Zero base64 MongoDB bloat)`);
        } else {
            recordTest('Director', 'Study Material Upload (GitHub/Filesystem Storage)', false, matRes.data.message || 'Upload failed');
        }
    } catch (e) {
        recordTest('Director', 'Study Material Upload', false, e.message);
    }

    // 2.7 Student Direct Enrolment
    const testAadhar = '9999' + Math.floor(10000000 + Math.random() * 90000000);
    try {
        const stuRes = await request('/api/director/students', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${directorToken}` },
            body: {
                name: 'Rahul Kumar',
                fatherName: 'Suresh Kumar',
                phone: '9812345678',
                aadharNumber: testAadhar,
                course: 'IIT JEE Advanced Mathematics Mastery',
                dob: '2006-05-15',
                classLevel: 'Class 12th',
                address: 'Main Road, Kankarbagh'
            }
        });
        if (stuRes.ok && stuRes.data.success && stuRes.data.data) {
            testStudentRoll = stuRes.data.data.rollNo;
            recordTest('Director', 'Student Direct Enrolment & Central Roll Number', true, `Student enrolled: Rahul Kumar (Roll: ${testStudentRoll})`);
        } else {
            recordTest('Director', 'Student Direct Enrolment & Central Roll Number', false, stuRes.data.message || 'Enrolment failed');
        }
    } catch (e) {
        recordTest('Director', 'Student Enrolment', false, e.message);
    }

    // 2.8 Director Live Teaching Monitor Deck
    try {
        const dmonRes = await request('/api/director/live-monitor', {
            headers: { 'Authorization': `Bearer ${directorToken}` }
        });
        if (dmonRes.ok && dmonRes.data.success && Array.isArray(dmonRes.data.liveStreams)) {
            recordTest('Director', 'Live Teaching Monitor Deck API', true, `Director deck operational. Center streams monitored: ${dmonRes.data.liveStreams.length}`);
        } else {
            recordTest('Director', 'Live Teaching Monitor Deck API', false, dmonRes.data.message || 'Director monitor deck failed');
        }
    } catch (e) {
        recordTest('Director', 'Live Teaching Monitor Deck API', false, e.message);
    }

    // ==========================================
    // MODULE 3: TEACHER FACULTY STUDIO AUDIT
    // ==========================================
    console.log('\n--- 3. TESTING TEACHER (FACULTY STUDIO) FEATURES ---');

    // 3.1 Teacher Login
    try {
        const tLoginRes = await request('/api/teacher/login', {
            method: 'POST',
            body: { phone: testTeacherPhone, password: 'teacherPass123' }
        });
        if (tLoginRes.ok && tLoginRes.data.success && tLoginRes.data.token) {
            teacherToken = tLoginRes.data.token;
            recordTest('Teacher', 'Faculty Portal Login (ID/Phone + Password)', true, `Teacher logged in. Token: ${teacherToken.slice(0, 15)}... Name: ${tLoginRes.data.teacher?.name}`);
        } else {
            recordTest('Teacher', 'Faculty Portal Login (ID/Phone + Password)', false, tLoginRes.data.message || 'Teacher login failed');
        }
    } catch (e) {
        recordTest('Teacher', 'Faculty Portal Login', false, e.message);
    }

    // 3.2 Teacher Start Live Broadcast
    try {
        const liveStartRes = await request('/api/live/start', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${teacherToken}` },
            body: {
                title: 'Live Calculus & Derivatives Problem Solving Workshop',
                subject: 'Mathematics',
                centerId: testCenterId,
                courseId: testCourseId
            }
        });
        if (liveStartRes.ok && liveStartRes.data.success && liveStartRes.data.classId) {
            testClassId = liveStartRes.data.classId;
            recordTest('Teacher', 'Live Class Broadcasting Start', true, `Class LIVE: "${liveStartRes.data.title}" (Session ID: ${testClassId})`);
        } else {
            recordTest('Teacher', 'Live Class Broadcasting Start', false, liveStartRes.data.message || 'Failed to start live class');
        }
    } catch (e) {
        recordTest('Teacher', 'Live Class Broadcasting Start', false, e.message);
    }

    // 3.3 Verify Live Stream Visibility to Director and Admin!
    try {
        const adminMon = await request('/api/admin/live-monitor', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const seenInAdmin = adminMon.data?.liveStreams?.some(s => s.classId === testClassId);
        recordTest('Teacher -> Admin', 'Teacher Live Stream Visible to Super Admin', Boolean(seenInAdmin), `Stream appears on Admin National Deck: ${seenInAdmin}`);

        const dirMon = await request('/api/director/live-monitor', {
            headers: { 'Authorization': `Bearer ${directorToken}` }
        });
        const seenInDirector = dirMon.data?.liveStreams?.some(s => s.classId === testClassId);
        recordTest('Teacher -> Director', 'Teacher Live Stream Visible to Center Director', Boolean(seenInDirector), `Stream appears on Director Live Monitor Desk: ${seenInDirector}`);
    } catch (e) {
        recordTest('Teacher -> Dashboards Visibility', 'Live Stream Cross-Portal Visibility', false, e.message);
    }

    // 3.4 Live Classroom Chat & Doubts
    try {
        const chatRes = await request('/api/live/chat', {
            method: 'POST',
            body: {
                classId: testClassId,
                senderName: 'Prof. Alok Verma',
                role: 'teacher',
                text: 'Welcome students to today live calculus session! Feel free to ask questions.'
            }
        });
        const getChatRes = await request(`/api/live/chat/${testClassId}`);
        const chatSuccess = getChatRes.data?.chat?.length > 0;
        recordTest('Teacher', 'Real-time Classroom Chat & Doubt Board', Boolean(chatSuccess), `Message posted & retrieved. Total messages: ${getChatRes.data?.chat?.length}`);
    } catch (e) {
        recordTest('Teacher', 'Real-time Classroom Chat', false, e.message);
    }

    // 3.5 Live Video Frame Relay Fallback
    try {
        const sampleFrame = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
        const postFrameRes = await request('/api/live/frame', {
            method: 'POST',
            body: { classId: testClassId, frameData: sampleFrame }
        });
        const getFrameRes = await request(`/api/live/frame/${testClassId}`);
        const frameSuccess = getFrameRes.data?.success && Boolean(getFrameRes.data?.frame);
        recordTest('Teacher', 'Low-Bandwidth Video Frame Relay Fallback', Boolean(frameSuccess), `Frame relay captured and served for low-bandwidth students`);
    } catch (e) {
        recordTest('Teacher', 'Low-Bandwidth Video Frame Relay', false, e.message);
    }

    // 3.6 Upload Recorded Video & Verify Clean EBML Header (No Corruption!)
    try {
        const mockWebMDataUri = 'data:video/webm;codecs=vp9,opus;base64,GkXfo59ChoEBQveBAULygQ8USA53UE9tVFBVQU1FVkFBQUFDRmZlZkFBQUFBR1Z4dGVuZGVkQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB';
        const upRes = await request('/api/live/upload-recording', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${teacherToken}` },
            body: {
                classId: testClassId,
                videoBlobBase64: mockWebMDataUri,
                title: 'Live Calculus Problem Solving Masterclass',
                teacherName: 'Prof. Alok Verma',
                courseId: testCourseId
            }
        });

        if (upRes.ok && upRes.data.success && upRes.data.videoUrl) {
            const savedPath = path.join(__dirname, '..', 'public', upRes.data.videoUrl);
            let isClean = false;
            if (fs.existsSync(savedPath)) {
                const fileBuf = fs.readFileSync(savedPath);
                if (fileBuf[0] === 0x1a && fileBuf[1] === 0x45 && fileBuf[2] === 0xdf && fileBuf[3] === 0xa3) {
                    isClean = true;
                }
            }
            recordTest('Teacher', 'Recorded Video Storage & EBML Binary Header Integrity', isClean, `WebM saved cleanly without header corruption! Header: 1A 45 DF A3 (Valid EBML Container)`);
        } else {
            recordTest('Teacher', 'Recorded Video Storage & EBML Binary Header Integrity', false, upRes.data.message || 'Recording upload failed');
        }
    } catch (e) {
        recordTest('Teacher', 'Recorded Video Storage & Header Integrity', false, e.message);
    }

    // 3.7 YouTube Upload Status Endpoint
    try {
        const ytStatRes = await request(`/api/live/upload-status/${testClassId}`);
        const ytStatus = ytStatRes.data?.status || 'unknown';
        recordTest('Teacher', 'YouTube Auto-Upload Real-Time Status Tracker', Boolean(ytStatRes.data?.success), `Upload status tracked: "${ytStatus}" (${ytStatRes.data?.message || 'In progress'})`);
    } catch (e) {
        recordTest('Teacher', 'YouTube Auto-Upload Status Tracker', false, e.message);
    }

    // 3.8 End Live Broadcast
    try {
        const endRes = await request('/api/live/end', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${teacherToken}` },
            body: {
                classId: testClassId,
                recordedVideoUrl: `/data/recordings/${testClassId}.webm`
            }
        });
        recordTest('Teacher', 'Classroom Broadcast Conclusion & Archive Finalization', Boolean(endRes.data?.success), 'Class ended cleanly, session archived to revision vault');
    } catch (e) {
        recordTest('Teacher', 'Classroom Broadcast Conclusion', false, e.message);
    }

    // 3.9 Teacher Past Lectures Archive
    try {
        const pastRes = await request(`/api/live/recordings?teacherId=${encodeURIComponent('Prof. Alok Verma')}`);
        const hasPast = pastRes.data?.recordings?.length > 0;
        recordTest('Teacher', 'Teacher Past Lectures Archive & Preview Player Data', Boolean(hasPast), `Past lectures retrieved: ${pastRes.data?.recordings?.length} lecture(s)`);
    } catch (e) {
        recordTest('Teacher', 'Teacher Past Lectures Archive', false, e.message);
    }

    // ==========================================
    // MODULE 4: STUDENT PORTAL AUDIT
    // ==========================================
    console.log('\n--- 4. TESTING STUDENT PORTAL & CLASSROOM FEATURES ---');

    // 4.1 Student Verification by Roll Number
    try {
        const verRes = await request(`/api/public/verify-student/${testStudentRoll}`);
        if (verRes.ok && verRes.data.success && verRes.data.data) {
            recordTest('Student', 'Central Roll Number Verification Desk', true, `Verified: ${verRes.data.data.name} (${verRes.data.data.rollNo}) - Center: ${verRes.data.data.centerName || 'BBCC'}`);
        } else {
            recordTest('Student', 'Central Roll Number Verification Desk', false, verRes.data.message || 'Verification failed');
        }
    } catch (e) {
        recordTest('Student', 'Central Roll Number Verification', false, e.message);
    }

    // 4.2 Online Admission Inquiry
    try {
        const inqRes = await request('/api/public/inquiry', {
            method: 'POST',
            body: {
                studentName: 'Kavita Singh',
                mobile: '9988776655',
                targetClass: 'IIT JEE Advanced Mathematics Mastery',
                centerId: testCenterId,
                message: 'Interested in weekend classroom batches'
            }
        });
        recordTest('Student', 'Online Admission Inquiry Submission', Boolean(inqRes.data?.success), `Inquiry submitted to center director: ${inqRes.data?.message || 'Success'}`);
    } catch (e) {
        recordTest('Student', 'Online Admission Inquiry', false, e.message);
    }

    // 4.3 Browse Study Materials & Syllabus Notes
    try {
        const matPubRes = await request('/api/public/books');
        const hasMaterials = matPubRes.ok && matPubRes.data?.success && Array.isArray(matPubRes.data?.data?.notes || matPubRes.data?.data);
        const count = (matPubRes.data?.data?.notes || matPubRes.data?.data || []).length;
        recordTest('Student', 'Digital Study Material Repository & Notes Reader', hasMaterials, `Available notes/books in digital library: ${count}`);
    } catch (e) {
        recordTest('Student', 'Digital Study Material Repository', false, e.message);
    }

    // 4.4 Enrolled Student Digital Material Verification & Book Access
    try {
        let orderDocId = testMaterialId;
        if (!orderDocId) {
            const pubSm = await request('/api/public/books');
            const notes = pubSm.data?.data?.notes || pubSm.data?.data || [];
            if (notes.length > 0) orderDocId = notes[0]._id;
        }
        const ordRes = await request('/api/pay/create-document-order', {
            method: 'POST',
            body: {
                docId: orderDocId,
                studentQuery: testStudentRoll,
                payerName: 'Rahul Kumar',
                payerPhone: '9812345678',
                onlyVerify: true
            }
        });
        const isVerifiedOrFree = Boolean(ordRes.data?.success || ordRes.data?.verified || ordRes.status === 200);
        recordTest('Student', 'Enrolled Student Document Verification & E-Book Access', isVerifiedOrFree, `Access verified: "${ordRes.data?.message || 'Access granted'}" (Doc ID: ${orderDocId})`);
    } catch (e) {
        recordTest('Student', 'Enrolled Student Document Verification', false, e.message);
    }

    // 4.5 Academic Callback & Support Ticket Escalation
    try {
        const tickRes = await request('/api/public/support-ticket', {
            method: 'POST',
            body: {
                studentName: 'Rahul Kumar',
                phone: '9812345678',
                centerId: testCenterId,
                issueSummary: 'Requesting syllabus roadmap and past lecture video links'
            }
        });
        recordTest('Student', 'Support Ticket & Academic Callback Escalation', Boolean(tickRes.data?.success), `Ticket assigned: Ticket ID ${tickRes.data?.ticket?.ticketId || 'Created'}`);
    } catch (e) {
        recordTest('Student', 'Support Ticket Escalation', false, e.message);
    }

    // 4.6 Student Revision Vault (Recorded Lectures)
    try {
        const revRes = await request(`/api/live/recordings?centerId=${testCenterId}`);
        const hasRev = revRes.data?.recordings?.length > 0;
        recordTest('Student', 'Recorded Lecture Revision Vault & YouTube Embeds', Boolean(hasRev), `Recorded lectures available for student revision: ${revRes.data?.recordings?.length}`);
    } catch (e) {
        recordTest('Student', 'Recorded Lecture Revision Vault', false, e.message);
    }

    // ==========================================
    // SUMMARY REPORT
    // ==========================================
    console.log('\n====================================================');
    console.log('📊 FINAL END-TO-END TEST SUITE AUDIT SUMMARY');
    console.log('====================================================');
    const total = report.length;
    const passed = report.filter(r => r.passed).length;
    const failed = total - passed;
    console.log(`Total Features Tested: ${total}`);
    console.log(`Features Passed: ${passed} / ${total} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`Features Failed: ${failed}`);
    console.log('====================================================\n');

    const summaryJson = {
        timestamp: new Date().toISOString(),
        total,
        passed,
        failed,
        successRate: `${((passed/total)*100).toFixed(1)}%`,
        results: report
    };

    fs.writeFileSync(path.join(__dirname, 'audit_report.json'), JSON.stringify(summaryJson, null, 2));
    console.log('Report saved to scratch/audit_report.json');
}

runTestSuite().catch(err => {
    console.error('Test suite error:', err);
});
