// ============================================
// TUITION CENTER MANAGEMENT - COMPLETE (FIXED)
// ============================================

let centers = [];
let currentCenterId = null;
let editingTeacherId = null;
let editingCenterId = null;

// ============================================
// API CALL - TUITION CENTER SPECIFIC (NO SETTINGS)
// ============================================
async function tuitionApiCall(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    
    const config = {
        method: options.method || 'GET',
        headers: headers
    };
    
    if (options.body) {
        config.body = JSON.stringify(options.body);
    }
    
    const response = await fetch(url, config);
    return await response.json();
}

// ============================================
// INDEPENDENT TOAST - NO SETTINGS AFFECT
// ============================================
function showTuitionToast(message, isError = false) {
    // Remove existing toast
    const existing = document.querySelector('.tuition-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'tuition-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: ${isError ? '#e74c3c' : '#2ecc71'};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        font-weight: 600;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        z-index: 9999;
        animation: slideUp 0.5s ease;
        max-width: 400px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// ============================================
// INIT TUITION CENTER
// ============================================
function initTuitionCenter() {
    const container = document.getElementById('tuitionCenterApp');
    if (!container) return;
    
    container.innerHTML = `
        <div class="sub-tabs">
            <button class="sub-tab-btn active" data-subtab="centers" onclick="switchTuitionTab('centers')">
                🏫 All Centers
            </button>
            <button class="sub-tab-btn" data-subtab="addcenter" onclick="switchTuitionTab('addcenter')">
                ➕ Add Center
            </button>
        </div>

        <!-- ===== TAB 1: ALL CENTERS ===== -->
        <div class="sub-tab-content active" id="subtab-centers">
            <div class="card">
                <div class="card-title">
                    <span class="icon">🏫</span>
                    All Coaching Centers
                    <span id="centerCount" style="font-size:14px;color:#888;font-weight:normal;"></span>
                </div>
                <div id="centersListContainer">
                    <div class="text-center" style="padding:30px;color:#888;">Loading centers...</div>
                </div>
            </div>
        </div>

        <!-- ===== TAB 2: ADD/EDIT CENTER ===== -->
        <div class="sub-tab-content" id="subtab-addcenter">
            <div class="card">
                <div class="card-title">
                    <span class="icon">🏫</span>
                    <span id="centerFormTitle">Add New Coaching Center</span>
                </div>
                <form id="centerForm" onsubmit="saveCenter(event)">
                    <!-- Center Details -->
                    <h3 style="margin:15px 0 10px;color:#667eea;">📝 Center Details</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Center Name *</label>
                            <input type="text" id="centerName" placeholder="Enter center name" required>
                        </div>
                        <div class="form-group">
                            <label>Director Name *</label>
                            <input type="text" id="directorName" placeholder="Enter director name" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>From Class *</label>
                            <input type="text" id="fromClass" placeholder="e.g., Class 1st, Nursery, LKG" required>
                        </div>
                        <div class="form-group">
                            <label>To Class *</label>
                            <input type="text" id="toClass" placeholder="e.g., Class 10th, 12th, Graduation" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Address</label>
                        <textarea id="centerAddress" rows="2" placeholder="Enter center address"></textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Contact Number</label>
                            <input type="text" id="contactNumber" placeholder="9876543210">
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="centerEmail" placeholder="center@email.com">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>WhatsApp Number</label>
                        <input type="text" id="whatsappNumber" placeholder="9876543210">
                    </div>

                    <!-- Social Media Links -->
                    <h3 style="margin:20px 0 10px;color:#667eea;">🌐 Social Media Links</h3>
                    <div class="form-group">
                        <label>YouTube Channel</label>
                        <input type="url" id="youtubeLink" placeholder="https://youtube.com/@channel">
                    </div>
                    <div class="form-group">
                        <label>Facebook Page</label>
                        <input type="url" id="facebookLink" placeholder="https://facebook.com/page">
                    </div>
                    <div class="form-group">
                        <label>Instagram Page</label>
                        <input type="url" id="instagramLink" placeholder="https://instagram.com/handle">
                    </div>
                    <div class="form-group">
                        <label>Telegram Channel</label>
                        <input type="url" id="telegramLink" placeholder="https://t.me/channel">
                    </div>
                    <div class="form-group">
                        <label>Twitter/X Profile</label>
                        <input type="url" id="twitterLink" placeholder="https://twitter.com/handle">
                    </div>
                    <div class="form-group">
                        <label>LinkedIn Page</label>
                        <input type="url" id="linkedinLink" placeholder="https://linkedin.com/company/page">
                    </div>

                    <!-- Images -->
                    <h3 style="margin:20px 0 10px;color:#667eea;">🖼️ Images</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Center Logo</label>
                            <div class="image-upload" onclick="document.getElementById('logoInput').click()">
                                <div class="preview" id="logoPreview">
                                    <img src="" alt="Logo" style="display:none;width:100%;height:100%;object-fit:cover;border-radius:8px;" id="logoPreviewImg">
                                    <span id="logoPlaceholder" style="font-size:40px;">📷</span>
                                </div>
                                <div class="hint">Click to upload logo</div>
                                <input type="file" id="logoInput" accept="image/*" onchange="handleCenterLogo(event)">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Director Photo</label>
                            <div class="image-upload" onclick="document.getElementById('directorPhotoInput').click()">
                                <div class="preview" id="directorPhotoPreview">
                                    <img src="" alt="Photo" style="display:none;width:100%;height:100%;object-fit:cover;border-radius:8px;" id="directorPhotoImg">
                                    <span id="directorPhotoPlaceholder" style="font-size:40px;">📷</span>
                                </div>
                                <div class="hint">Click to upload director photo</div>
                                <input type="file" id="directorPhotoInput" accept="image/*" onchange="handleDirectorPhoto(event)">
                            </div>
                        </div>
                    </div>

                    <!-- Description -->
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="centerDescription" rows="3" placeholder="Enter center description"></textarea>
                    </div>

                    <input type="hidden" id="editCenterId" value="">
                    <button type="submit" class="btn btn-success" style="width:100%;padding:14px;font-size:16px;margin-top:10px;">
                        ✅ Add Center
                    </button>
                </form>
            </div>
        </div>
    `;
    
    loadCenters();
}

// ============================================
// SWITCH TUITION TAB
// ============================================
function switchTuitionTab(tab) {
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-subtab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`subtab-${tab}`).classList.add('active');
    if (tab === 'centers') loadCenters();
}

// ============================================
// HANDLE CENTER LOGO
// ============================================
function handleCenterLogo(event) {
    const file = event.target.files[0];
    if (!file) return;
    compressImage(file, 50, function(compressedBase64) {
        document.getElementById('logoPreviewImg').src = compressedBase64;
        document.getElementById('logoPreviewImg').style.display = 'block';
        document.getElementById('logoPlaceholder').style.display = 'none';
        showTuitionToast('Center logo uploaded successfully!');
    });
}

// ============================================
// HANDLE DIRECTOR PHOTO
// ============================================
function handleDirectorPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    compressImage(file, 50, function(compressedBase64) {
        document.getElementById('directorPhotoImg').src = compressedBase64;
        document.getElementById('directorPhotoImg').style.display = 'block';
        document.getElementById('directorPhotoPlaceholder').style.display = 'none';
        showTuitionToast('Director photo uploaded successfully!');
    });
}

// ============================================
// COMPRESS IMAGE
// ============================================
function compressImage(file, maxSizeKB, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            let quality = 0.9;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let width = img.width;
            let height = img.height;
            
            const maxDimension = 300;
            if (width > maxDimension || height > maxDimension) {
                const ratio = Math.min(maxDimension / width, maxDimension / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            let base64 = canvas.toDataURL('image/jpeg', quality);
            
            while (base64.length / 1024 > maxSizeKB && quality > 0.1) {
                quality -= 0.1;
                base64 = canvas.toDataURL('image/jpeg', quality);
            }
            
            callback(base64);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ============================================
// LOAD ALL CENTERS
// ============================================
async function loadCenters() {
    try {
        const data = await tuitionApiCall('/api/tuition-centers');
        if (data.success) {
            centers = data.data || [];
            renderCenters(centers);
            updateCenterCount(centers.length);
        }
    } catch (error) {
        showTuitionToast('Error loading centers', true);
    }
}

// ============================================
// RENDER CENTERS
// ============================================
function renderCenters(centerList) {
    const container = document.getElementById('centersListContainer');
    if (!container) return;
    
    if (!centerList || centerList.length === 0) {
        container.innerHTML = '<div class="text-center" style="padding:40px;color:#888;">🏫 No coaching centers added yet</div>';
        return;
    }
    
    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;">';
    
    for (let i = 0; i < centerList.length; i++) {
        const c = centerList[i];
        const initials = c.centerName.split(' ').filter(w => w.length > 0).map(w => w[0]).join('').slice(0, 4).toUpperCase();
        const teacherCount = c.teachers ? c.teachers.length : 0;
        
        html += `
            <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 15px rgba(0,0,0,0.06);border:1px solid #f0f0f0;transition:all 0.3s ease;"
                onmouseover="this.style.transform='translateY(-5px)';this.style.boxShadow='0 10px 40px rgba(0,0,0,0.1)';"
                onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 15px rgba(0,0,0,0.06)';">
                
                <!-- Header with Logo -->
                <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:20px;display:flex;align-items:center;gap:15px;">
                    <div style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:white;overflow:hidden;flex-shrink:0;">
                        ${c.logo && c.logo.length > 50 ? `<img src="${c.logo}" style="width:100%;height:100%;object-fit:cover;">` : initials}
                    </div>
                    <div style="flex:1;color:white;">
                        <h3 style="font-size:18px;font-weight:700;">${c.centerName}</h3>
                        <div style="font-size:12px;opacity:0.8;">👨‍🏫 ${c.directorName || 'No Director'}</div>
                    </div>
                </div>
                
                <!-- Body -->
                <div style="padding:15px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;color:#555;margin-bottom:10px;">
                        <div>📚 <strong>Classes:</strong> ${c.fromClass || 'N/A'} - ${c.toClass || 'N/A'}</div>
                        <div>👨‍🏫 <strong>Teachers:</strong> ${teacherCount}</div>
                        ${c.contactNumber ? `<div>📞 ${c.contactNumber}</div>` : ''}
                        ${c.email ? `<div>📧 ${c.email}</div>` : ''}
                    </div>
                    
                    ${c.address ? `<div style="font-size:12px;color:#888;margin-bottom:10px;">📍 ${c.address}</div>` : ''}
                    
                    <!-- Social Icons -->
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
                        ${c.youtubeLink ? `<a href="${c.youtubeLink}" target="_blank" style="color:#FF0000;font-size:16px;"><i class="fab fa-youtube"></i></a>` : ''}
                        ${c.facebookLink ? `<a href="${c.facebookLink}" target="_blank" style="color:#1877F2;font-size:16px;"><i class="fab fa-facebook"></i></a>` : ''}
                        ${c.instagramLink ? `<a href="${c.instagramLink}" target="_blank" style="color:#E4405F;font-size:16px;"><i class="fab fa-instagram"></i></a>` : ''}
                        ${c.telegramLink ? `<a href="${c.telegramLink}" target="_blank" style="color:#0088cc;font-size:16px;"><i class="fab fa-telegram"></i></a>` : ''}
                        ${c.twitterLink ? `<a href="${c.twitterLink}" target="_blank" style="color:#1DA1F2;font-size:16px;"><i class="fab fa-twitter"></i></a>` : ''}
                        ${c.linkedinLink ? `<a href="${c.linkedinLink}" target="_blank" style="color:#0A66C2;font-size:16px;"><i class="fab fa-linkedin"></i></a>` : ''}
                        ${c.whatsappNumber ? `<a href="https://wa.me/${c.whatsappNumber.replace(/\D/g,'')}" target="_blank" style="color:#25D366;font-size:16px;"><i class="fab fa-whatsapp"></i></a>` : ''}
                    </div>
                    
                    <!-- Actions -->
                    <div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid #f0f0f0;padding-top:10px;">
                        <button class="btn-sm btn-info" onclick="viewCenter('${c._id}')">👁️ View</button>
                        <button class="btn-sm btn-warning" onclick="editCenter('${c._id}')">✏️ Edit</button>
                        <button class="btn-sm btn-success" onclick="manageTeachers('${c._id}')">👨‍🏫 Teachers</button>
                        <button class="btn-sm btn-danger" onclick="deleteCenter('${c._id}')">🗑️ Delete</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// ============================================
// UPDATE CENTER COUNT
// ============================================
function updateCenterCount(count) {
    const countEl = document.getElementById('centerCount');
    if (countEl) {
        countEl.textContent = `(${count} centers)`;
    }
    const badge = document.getElementById('tuitionCenterBadge');
    if (badge) {
        badge.textContent = count;
    }
}

// ============================================
// SAVE CENTER (Add/Edit)
// ============================================
async function saveCenter(event) {
    event.preventDefault();
    
    const editId = document.getElementById('editCenterId').value;
    const data = {
        centerName: document.getElementById('centerName').value.trim(),
        directorName: document.getElementById('directorName').value.trim(),
        fromClass: document.getElementById('fromClass').value.trim(),
        toClass: document.getElementById('toClass').value.trim(),
        address: document.getElementById('centerAddress').value.trim(),
        contactNumber: document.getElementById('contactNumber').value.trim(),
        email: document.getElementById('centerEmail').value.trim(),
        whatsappNumber: document.getElementById('whatsappNumber').value.trim(),
        youtubeLink: document.getElementById('youtubeLink').value.trim(),
        facebookLink: document.getElementById('facebookLink').value.trim(),
        instagramLink: document.getElementById('instagramLink').value.trim(),
        telegramLink: document.getElementById('telegramLink').value.trim(),
        twitterLink: document.getElementById('twitterLink').value.trim(),
        linkedinLink: document.getElementById('linkedinLink').value.trim(),
        logo: document.getElementById('logoPreviewImg').src || '',
        directorPhoto: document.getElementById('directorPhotoImg').src || '',
        description: document.getElementById('centerDescription').value.trim()
    };
    
    // Validation
    if (!data.centerName) { showTuitionToast('Please enter center name', true); return; }
    if (!data.directorName) { showTuitionToast('Please enter director name', true); return; }
    if (!data.fromClass) { showTuitionToast('Please enter from class', true); return; }
    if (!data.toClass) { showTuitionToast('Please enter to class', true); return; }
    
    try {
        let response;
        if (editId) {
            response = await tuitionApiCall('/api/tuition-centers/' + editId, {
                method: 'PUT',
                body: data
            });
        } else {
            response = await tuitionApiCall('/api/tuition-centers', {
                method: 'POST',
                body: data
            });
        }
        
        if (response.success) {
            showTuitionToast(editId ? 'Center updated successfully!' : 'Center added successfully!');
            resetCenterForm();
            switchTuitionTab('centers');
            loadCenters();
        } else {
            showTuitionToast(response.message || 'Failed to save center', true);
        }
    } catch (error) {
        showTuitionToast('Error saving center', true);
    }
}

// ============================================
// EDIT CENTER
// ============================================
async function editCenter(centerId) {
    try {
        const data = await tuitionApiCall('/api/tuition-centers/' + centerId);
        if (!data.success) {
            showTuitionToast('Center not found', true);
            return;
        }
        
        const c = data.data;
        document.getElementById('editCenterId').value = c._id;
        document.getElementById('centerName').value = c.centerName || '';
        document.getElementById('directorName').value = c.directorName || '';
        document.getElementById('fromClass').value = c.fromClass || '';
        document.getElementById('toClass').value = c.toClass || '';
        document.getElementById('centerAddress').value = c.address || '';
        document.getElementById('contactNumber').value = c.contactNumber || '';
        document.getElementById('centerEmail').value = c.email || '';
        document.getElementById('whatsappNumber').value = c.whatsappNumber || '';
        document.getElementById('youtubeLink').value = c.youtubeLink || '';
        document.getElementById('facebookLink').value = c.facebookLink || '';
        document.getElementById('instagramLink').value = c.instagramLink || '';
        document.getElementById('telegramLink').value = c.telegramLink || '';
        document.getElementById('twitterLink').value = c.twitterLink || '';
        document.getElementById('linkedinLink').value = c.linkedinLink || '';
        document.getElementById('centerDescription').value = c.description || '';
        
        if (c.logo) {
            document.getElementById('logoPreviewImg').src = c.logo;
            document.getElementById('logoPreviewImg').style.display = 'block';
            document.getElementById('logoPlaceholder').style.display = 'none';
        }
        if (c.directorPhoto) {
            document.getElementById('directorPhotoImg').src = c.directorPhoto;
            document.getElementById('directorPhotoImg').style.display = 'block';
            document.getElementById('directorPhotoPlaceholder').style.display = 'none';
        }
        
        document.getElementById('centerFormTitle').textContent = '✏️ Edit Coaching Center';
        document.querySelector('#centerForm button[type="submit"]').textContent = '✏️ Update Center';
        document.querySelector('#centerForm button[type="submit"]').style.background = '#f39c12';
        
        switchTuitionTab('addcenter');
        showTuitionToast('Edit mode - Update center details');
    } catch (error) {
        showTuitionToast('Error loading center', true);
    }
}

// ============================================
// VIEW CENTER
// ============================================
async function viewCenter(centerId) {
    try {
        const data = await tuitionApiCall('/api/tuition-centers/' + centerId);
        if (!data.success) {
            showTuitionToast('Center not found', true);
            return;
        }
        
        const c = data.data;
        const teacherList = c.teachers || [];
        let teacherHtml = '';
        
        if (teacherList.length === 0) {
            teacherHtml = '<p style="color:#888;font-size:13px;">No teachers added yet</p>';
        } else {
            teacherHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">';
            for (let i = 0; i < teacherList.length; i++) {
                const t = teacherList[i];
                teacherHtml += `
                    <div style="background:#f8f9fa;border-radius:10px;padding:12px;text-align:center;border:1px solid #f0f0f0;">
                        ${t.photo ? `<img src="${t.photo}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;margin-bottom:5px;">` : 
                        `<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;margin:0 auto 5px;font-size:20px;color:white;">${t.name.charAt(0).toUpperCase()}</div>`}
                        <div style="font-weight:600;font-size:14px;">${t.name}</div>
                        <div style="font-size:12px;color:#667eea;">📚 ${t.subject}</div>
                        <div style="font-size:11px;color:#888;">🎯 ${t.class}</div>
                    </div>
                `;
            }
            teacherHtml += '</div>';
        }
        
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;';
        modal.onclick = function(e) { if (e.target === this) this.remove(); };
        
        modal.innerHTML = `
            <div style="background:white;border-radius:20px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;padding:0;" onclick="event.stopPropagation()">
                <div style="position:sticky;top:0;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:20px 25px;border-radius:20px 20px 0 0;display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:15px;color:white;">
                        <div style="width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;overflow:hidden;">
                            ${c.logo ? `<img src="${c.logo}" style="width:100%;height:100%;object-fit:cover;">` : c.centerName.split(' ').map(w=>w[0]).join('').slice(0,4).toUpperCase()}
                        </div>
                        <div>
                            <h2 style="font-size:20px;">${c.centerName}</h2>
                            <div style="font-size:13px;opacity:0.8;">👨‍🏫 ${c.directorName}</div>
                        </div>
                    </div>
                    <button onclick="this.closest('div[style]').remove()" style="width:35px;height:35px;border:none;background:rgba(255,255,255,0.15);color:white;border-radius:50%;font-size:20px;cursor:pointer;">✕</button>
                </div>
                
                <div style="padding:25px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#f8f9fa;padding:15px;border-radius:10px;margin-bottom:15px;">
                        <div><strong>📚 Classes:</strong> ${c.fromClass || 'N/A'} - ${c.toClass || 'N/A'}</div>
                        <div><strong>👨‍🏫 Teachers:</strong> ${teacherList.length}</div>
                        ${c.contactNumber ? `<div><strong>📞 Contact:</strong> ${c.contactNumber}</div>` : ''}
                        ${c.email ? `<div><strong>📧 Email:</strong> ${c.email}</div>` : ''}
                        ${c.whatsappNumber ? `<div><strong>💬 WhatsApp:</strong> ${c.whatsappNumber}</div>` : ''}
                        ${c.address ? `<div style="grid-column:1/-1;"><strong>📍 Address:</strong> ${c.address}</div>` : ''}
                    </div>
                    
                    ${c.description ? `<div style="background:#f8f9fa;padding:15px;border-radius:10px;margin-bottom:15px;"><strong>📄 Description:</strong><br>${c.description}</div>` : ''}
                    
                    ${c.youtubeLink || c.facebookLink || c.instagramLink || c.telegramLink || c.twitterLink || c.linkedinLink ? `
                        <div style="display:flex;gap:12px;flex-wrap:wrap;padding:10px;background:#f8f9fa;border-radius:10px;margin-bottom:15px;">
                            ${c.youtubeLink ? `<a href="${c.youtubeLink}" target="_blank" style="color:#FF0000;font-size:20px;"><i class="fab fa-youtube"></i></a>` : ''}
                            ${c.facebookLink ? `<a href="${c.facebookLink}" target="_blank" style="color:#1877F2;font-size:20px;"><i class="fab fa-facebook"></i></a>` : ''}
                            ${c.instagramLink ? `<a href="${c.instagramLink}" target="_blank" style="color:#E4405F;font-size:20px;"><i class="fab fa-instagram"></i></a>` : ''}
                            ${c.telegramLink ? `<a href="${c.telegramLink}" target="_blank" style="color:#0088cc;font-size:20px;"><i class="fab fa-telegram"></i></a>` : ''}
                            ${c.twitterLink ? `<a href="${c.twitterLink}" target="_blank" style="color:#1DA1F2;font-size:20px;"><i class="fab fa-twitter"></i></a>` : ''}
                            ${c.linkedinLink ? `<a href="${c.linkedinLink}" target="_blank" style="color:#0A66C2;font-size:20px;"><i class="fab fa-linkedin"></i></a>` : ''}
                        </div>
                    ` : ''}
                    
                    <h3 style="margin-bottom:10px;color:#333;">👨‍🏫 Teachers (${teacherList.length})</h3>
                    ${teacherHtml}
                    
                    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;padding-top:15px;border-top:2px solid #f0f0f0;">
                        <button class="btn btn-warning" onclick="editCenter('${c._id}')">✏️ Edit Center</button>
                        <button class="btn btn-success" onclick="manageTeachers('${c._id}')">👨‍🏫 Manage Teachers</button>
                        <button onclick="this.closest('div[style]').remove()" class="btn" style="background:#e0e0e0;">❌ Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        showTuitionToast('Error loading center details', true);
    }
}

// ============================================
// DELETE CENTER
// ============================================
async function deleteCenter(centerId) {
    if (!confirm('Are you sure you want to delete this center? All teachers will also be deleted.')) return;
    
    try {
        const response = await tuitionApiCall('/api/tuition-centers/' + centerId, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showTuitionToast('Center deleted successfully!');
            loadCenters();
        } else {
            showTuitionToast('Failed to delete center', true);
        }
    } catch (error) {
        showTuitionToast('Error deleting center', true);
    }
}

// ============================================
// MANAGE TEACHERS
// ============================================
function manageTeachers(centerId) {
    currentCenterId = centerId;
    editingTeacherId = null;
    
    fetchCenterData(centerId);
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;';
    modal.onclick = function(e) { if (e.target === this) this.remove(); };
    
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;padding:0;" onclick="event.stopPropagation()">
            <div style="position:sticky;top:0;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:20px 25px;border-radius:20px 20px 0 0;display:flex;justify-content:space-between;align-items:center;">
                <h2 style="color:white;font-size:20px;">👨‍🏫 Manage Teachers</h2>
                <button onclick="this.closest('div[style]').remove()" style="width:35px;height:35px;border:none;background:rgba(255,255,255,0.15);color:white;border-radius:50%;font-size:20px;cursor:pointer;">✕</button>
            </div>
            
            <div style="padding:25px;">
                <!-- Add Teacher Form -->
                <form id="teacherForm" onsubmit="saveTeacher(event, '${centerId}')">
                    <h3 style="margin-bottom:15px;color:#667eea;">➕ Add Teacher</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Teacher Name *</label>
                            <input type="text" id="teacherName" placeholder="Enter teacher name" required>
                        </div>
                        <div class="form-group">
                            <label>Subject *</label>
                            <input type="text" id="teacherSubject" placeholder="e.g., Mathematics" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Class *</label>
                            <input type="text" id="teacherClass" placeholder="e.g., Class 10th, B.Com" list="classOptions" required>
                            <datalist id="classOptions">
                                <!-- Will be filled dynamically -->
                            </datalist>
                            <small style="color:#888;font-size:11px;">Type to search or add new class</small>
                        </div>
                        <div class="form-group">
                            <label>Teacher Photo</label>
                            <div class="image-upload" onclick="document.getElementById('teacherPhotoInput').click()">
                                <div class="preview" id="teacherPhotoPreview">
                                    <img src="" alt="Photo" style="display:none;width:100%;height:100%;object-fit:cover;border-radius:8px;" id="teacherPhotoImg">
                                    <span id="teacherPhotoPlaceholder" style="font-size:40px;">📷</span>
                                </div>
                                <div class="hint">Click to upload photo</div>
                                <input type="file" id="teacherPhotoInput" accept="image/*" onchange="handleTeacherPhoto(event)">
                            </div>
                        </div>
                    </div>
                    <input type="hidden" id="editTeacherId" value="">
                    <button type="submit" class="btn btn-success" style="width:100%;padding:12px;margin-top:5px;">
                        ✅ Add Teacher
                    </button>
                </form>
                
                <!-- Teachers List -->
                <div style="margin-top:25px;border-top:2px solid #f0f0f0;padding-top:20px;">
                    <h3 style="margin-bottom:15px;color:#333;">📋 Teachers List <span id="teacherCountModal" style="font-size:14px;color:#888;font-weight:normal;"></span></h3>
                    <div id="teacherListModal">
                        <div class="text-center" style="padding:20px;color:#888;">Loading teachers...</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    loadTeachersForCenter(centerId);
}

// ============================================
// FETCH CENTER DATA FOR CLASS OPTIONS
// ============================================
async function fetchCenterData(centerId) {
    try {
        const data = await tuitionApiCall('/api/tuition-centers/' + centerId);
        if (data.success) {
            const center = data.data;
            const fromClass = center.fromClass || '';
            const toClass = center.toClass || '';
            
            const classOptions = generateClassOptions(fromClass, toClass);
            
            const datalist = document.getElementById('classOptions');
            if (datalist) {
                datalist.innerHTML = classOptions.map(c => `<option value="${c}">`).join('');
            }
        }
    } catch (error) {
        console.error('Error fetching center data:', error);
    }
}

// ============================================
// GENERATE CLASS OPTIONS
// ============================================
function generateClassOptions(fromClass, toClass) {
    const allClasses = [
        'Nursery', 'LKG', 'UKG',
        'Class 1st', 'Class 2nd', 'Class 3rd', 'Class 4th', 'Class 5th',
        'Class 6th', 'Class 7th', 'Class 8th', 'Class 9th', 'Class 10th',
        'Class 11th', 'Class 12th',
        'B.Com', 'B.Sc', 'B.A', 'BBA', 'BCA',
        'M.Com', 'M.Sc', 'M.A', 'MBA', 'MCA',
        'Diploma', 'ITI', 'Polytechnic',
        'Other'
    ];
    
    if (fromClass && toClass) {
        const fromIndex = allClasses.indexOf(fromClass);
        const toIndex = allClasses.indexOf(toClass);
        
        if (fromIndex !== -1 && toIndex !== -1 && fromIndex <= toIndex) {
            return allClasses.slice(fromIndex, toIndex + 1);
        }
    }
    
    if (fromClass) {
        const fromIndex = allClasses.indexOf(fromClass);
        if (fromIndex !== -1) {
            return allClasses.slice(fromIndex);
        }
    }
    
    if (toClass) {
        const toIndex = allClasses.indexOf(toClass);
        if (toIndex !== -1) {
            return allClasses.slice(0, toIndex + 1);
        }
    }
    
    return allClasses;
}

// ============================================
// LOAD TEACHERS FOR CENTER
// ============================================
async function loadTeachersForCenter(centerId) {
    try {
        const data = await tuitionApiCall('/api/tuition-centers/' + centerId);
        if (data.success) {
            const teachers = data.data.teachers || [];
            renderTeachersModal(teachers);
            document.getElementById('teacherCountModal').textContent = `(${teachers.length} teachers)`;
        }
    } catch (error) {
        showTuitionToast('Error loading teachers', true);
    }
}

// ============================================
// RENDER TEACHERS MODAL
// ============================================
function renderTeachersModal(teacherList) {
    const container = document.getElementById('teacherListModal');
    if (!container) return;
    
    if (!teacherList || teacherList.length === 0) {
        container.innerHTML = '<div class="text-center" style="padding:20px;color:#888;">👨‍🏫 No teachers added yet</div>';
        return;
    }
    
    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:15px;">';
    
    for (let i = 0; i < teacherList.length; i++) {
        const t = teacherList[i];
        html += `
            <div style="background:#f8f9fa;border-radius:12px;padding:15px;border:1px solid #f0f0f0;text-align:center;">
                ${t.photo ? `<img src="${t.photo}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;margin:0 auto 8px;display:block;border:3px solid #667eea;">` : 
                `<div style="width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;margin:0 auto 8px;font-size:28px;color:white;">${t.name.charAt(0).toUpperCase()}</div>`}
                <div style="font-weight:600;font-size:15px;">${t.name}</div>
                <div style="font-size:13px;color:#667eea;">📚 ${t.subject}</div>
                <div style="font-size:12px;color:#888;">🎯 ${t.class}</div>
                <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;">
                    <button class="btn-sm btn-warning" onclick="editTeacherModal('${t._id || t.id}')">✏️</button>
                    <button class="btn-sm btn-danger" onclick="deleteTeacherModal('${t._id || t.id}')">🗑️</button>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// ============================================
// HANDLE TEACHER PHOTO
// ============================================
function handleTeacherPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    compressImage(file, 50, function(compressedBase64) {
        document.getElementById('teacherPhotoImg').src = compressedBase64;
        document.getElementById('teacherPhotoImg').style.display = 'block';
        document.getElementById('teacherPhotoPlaceholder').style.display = 'none';
        showTuitionToast('Teacher photo uploaded successfully!');
    });
}

// ============================================
// SAVE TEACHER
// ============================================
async function saveTeacher(event, centerId) {
    event.preventDefault();
    
    const editId = document.getElementById('editTeacherId').value;
    const name = document.getElementById('teacherName').value.trim();
    const subject = document.getElementById('teacherSubject').value.trim();
    const classVal = document.getElementById('teacherClass').value.trim();
    const photo = document.getElementById('teacherPhotoImg').src || '';
    
    if (!name || !subject || !classVal) {
        showTuitionToast('Please fill all required fields', true);
        return;
    }
    
    const data = { name, subject, class: classVal, photo };
    
    try {
        let response;
        if (editId) {
            response = await tuitionApiCall('/api/tuition-centers/' + centerId + '/teacher/' + editId, {
                method: 'PUT',
                body: data
            });
        } else {
            response = await tuitionApiCall('/api/tuition-centers/' + centerId + '/teacher', {
                method: 'POST',
                body: data
            });
        }
        
        if (response.success) {
            showTuitionToast(editId ? 'Teacher updated!' : 'Teacher added!');
            document.getElementById('teacherForm').reset();
            document.getElementById('editTeacherId').value = '';
            document.getElementById('teacherPhotoImg').src = '';
            document.getElementById('teacherPhotoImg').style.display = 'none';
            document.getElementById('teacherPhotoPlaceholder').style.display = 'block';
            document.querySelector('#teacherForm button[type="submit"]').textContent = '✅ Add Teacher';
            loadTeachersForCenter(centerId);
            loadCenters();
        } else {
            showTuitionToast(response.message || 'Failed to save teacher', true);
        }
    } catch (error) {
        showTuitionToast('Error saving teacher', true);
    }
}

// ============================================
// EDIT TEACHER MODAL
// ============================================
async function editTeacherModal(teacherId) {
    try {
        const data = await tuitionApiCall('/api/tuition-centers/' + currentCenterId);
        if (!data.success) return;
        
        const teacher = data.data.teachers.find(t => (t._id || t.id) == teacherId);
        if (!teacher) {
            showTuitionToast('Teacher not found', true);
            return;
        }
        
        document.getElementById('editTeacherId').value = teacher._id || teacher.id;
        document.getElementById('teacherName').value = teacher.name;
        document.getElementById('teacherSubject').value = teacher.subject;
        document.getElementById('teacherClass').value = teacher.class;
        
        if (teacher.photo) {
            document.getElementById('teacherPhotoImg').src = teacher.photo;
            document.getElementById('teacherPhotoImg').style.display = 'block';
            document.getElementById('teacherPhotoPlaceholder').style.display = 'none';
        }
        
        document.querySelector('#teacherForm button[type="submit"]').textContent = '✏️ Update Teacher';
        document.querySelector('#teacherForm button[type="submit"]').style.background = '#f39c12';
        
        document.getElementById('teacherForm').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        showTuitionToast('Error loading teacher', true);
    }
}

// ============================================
// DELETE TEACHER MODAL
// ============================================
async function deleteTeacherModal(teacherId) {
    if (!confirm('Are you sure you want to delete this teacher?')) return;
    
    try {
        const response = await tuitionApiCall('/api/tuition-centers/' + currentCenterId + '/teacher/' + teacherId, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showTuitionToast('Teacher deleted successfully!');
            loadTeachersForCenter(currentCenterId);
            loadCenters();
        } else {
            showTuitionToast('Failed to delete teacher', true);
        }
    } catch (error) {
        showTuitionToast('Error deleting teacher', true);
    }
}

// ============================================
// RESET CENTER FORM
// ============================================
function resetCenterForm() {
    document.getElementById('centerForm').reset();
    document.getElementById('editCenterId').value = '';
    document.getElementById('logoPreviewImg').src = '';
    document.getElementById('logoPreviewImg').style.display = 'none';
    document.getElementById('logoPlaceholder').style.display = 'block';
    document.getElementById('directorPhotoImg').src = '';
    document.getElementById('directorPhotoImg').style.display = 'none';
    document.getElementById('directorPhotoPlaceholder').style.display = 'block';
    document.getElementById('centerFormTitle').textContent = 'Add New Coaching Center';
    document.querySelector('#centerForm button[type="submit"]').textContent = '✅ Add Center';
    document.querySelector('#centerForm button[type="submit"]').style.background = '';
}

// Add slideUp animation style if not exists
if (!document.querySelector('#tuitionToastStyle')) {
    const style = document.createElement('style');
    style.id = 'tuitionToastStyle';
    style.textContent = `
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
}
