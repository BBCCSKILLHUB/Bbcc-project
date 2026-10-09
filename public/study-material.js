// ============================================
// STUDY MATERIAL MANAGEMENT - COMPLETE
// ============================================

// ===== STATE =====
let videos = [];
let notes = [];
let editingVideoId = null;
let editingNoteId = null;

// ============================================
// INIT STUDY MATERIAL
// ============================================
function initStudyMaterial() {
    const container = document.getElementById('studyMaterialApp');
    if (!container) return;
    
    container.innerHTML = `
        <div class="sub-tabs">
            <button class="sub-tab-btn active" data-subtab="videos" onclick="switchStudyTab('videos')">
                🎬 Videos
            </button>
            <button class="sub-tab-btn" data-subtab="notes" onclick="switchStudyTab('notes')">
                📄 PDF Notes
            </button>
        </div>

        <!-- ===== VIDEOS TAB ===== -->
        <div class="sub-tab-content active" id="subtab-videos">
            <!-- Add Video Form -->
            <div class="card">
                <div class="card-title">
                    <span class="icon">🎬</span>
                    <span id="videoFormTitle">Add New Video</span>
                </div>
                <form id="videoForm" onsubmit="saveVideo(event)">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Video Thumbnail</label>
                            <div class="image-upload" onclick="document.getElementById('videoThumbInput').click()">
                                <div class="preview" id="videoThumbPreview">
                                    <img src="" alt="Thumbnail" style="display:none;width:100%;height:100%;object-fit:cover;border-radius:8px;" id="videoThumbImg">
                                    <span id="videoThumbPlaceholder" style="font-size:40px;">🖼️</span>
                                </div>
                                <div class="hint">Click to upload thumbnail (Optional - Auto-fetch from link)</div>
                                <input type="file" id="videoThumbInput" accept="image/*" onchange="handleVideoThumb(event)">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Video Title *</label>
                            <input type="text" id="videoTitle" placeholder="Enter video title" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Video Link *</label>
                        <input type="url" id="videoLink" placeholder="https://youtube.com/watch?v=..." required onchange="fetchVideoThumbnail()">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="videoDescription" rows="2" placeholder="Enter video description"></textarea>
                    </div>
                    <input type="hidden" id="editVideoId" value="">
                    
                    <!-- Upload Progress -->
                    <div id="videoUploadProgress" style="display:none;margin:10px 0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                            <span style="font-size:14px;color:#667eea;font-weight:600;">📤 Uploading Video...</span>
                            <span id="videoProgressText" style="font-size:14px;color:#667eea;font-weight:700;">0%</span>
                        </div>
                        <div style="width:100%;height:8px;background:#e9ecef;border-radius:10px;overflow:hidden;">
                            <div id="videoProgressBar" style="width:0%;height:100%;background:linear-gradient(90deg,#667eea,#764ba2);border-radius:10px;transition:width 0.3s ease;"></div>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary" style="width:100%;padding:12px;" id="videoSubmitBtn">
                        ✅ Add Video
                    </button>
                </form>
            </div>

            <!-- Video List -->
            <div class="card">
                <div class="card-title">
                    <span class="icon">📹</span>
                    Video List
                    <span id="videoCount" style="font-size:14px;color:#888;font-weight:normal;"></span>
                </div>
                <div id="videoListContainer">
                    <div class="text-center" style="padding:30px;color:#888;">No videos added yet</div>
                </div>
            </div>
        </div>

        <!-- ===== NOTES TAB ===== -->
        <div class="sub-tab-content" id="subtab-notes">
            <!-- Add PDF / Word Note Form -->
            <div class="card">
                <div class="card-title">
                    <span class="icon">📚</span>
                    <span id="noteFormTitle">Add New Study Document (PDF / Word)</span>
                </div>
                <form id="noteForm" onsubmit="saveNote(event)">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Document File (PDF / Word .doc/.docx) *</label>
                            <div class="image-upload" onclick="document.getElementById('noteFileInput').click()">
                                <div class="preview" id="noteFilePreview">
                                    <span id="noteFilePlaceholder" style="font-size:40px;">📄</span>
                                    <span id="noteFileName" style="display:none;font-size:14px;color:#667eea;font-weight:600;word-break:break-all;"></span>
                                </div>
                                <div class="hint">Click to upload PDF or Word document (Max 25MB)</div>
                                <input type="file" id="noteFileInput" accept=".pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onchange="handleNoteFile(event)">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Document Title *</label>
                            <input type="text" id="noteTitle" placeholder="e.g. Class 10 Mathematics Chapter 1 Notes" required>
                            
                            <label style="margin-top:12px;">Document Access Permission *</label>
                            <select id="noteAccessType" onchange="toggleNoteCenterSelection()" style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:8px;font-size:14px;">
                                <option value="all_centers">🌐 All Partner Coaching Centers (सभी कोचिंग सेंटर्स)</option>
                                <option value="specific_centers">🏫 Specific Partner Centers (चुनिंदा कोचिंग सेंटर्स)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Partner Coaching Centers Checklist (Visible if specific_centers) -->
                    <div id="noteCentersSelectionWrapper" style="display:none;margin-bottom:18px;background:#f8f9ff;border:1px solid #d0d7ff;padding:15px;border-radius:10px;">
                        <label style="font-weight:700;color:#333;margin-bottom:8px;display:block;">Select Allowed Partner Coaching Centers:</label>
                        <div id="noteCentersCheckboxes" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;max-height:160px;overflow-y:auto;padding:5px;">
                            <span style="font-size:12px;color:#888;">Loading centers...</span>
                        </div>
                    </div>

                    <!-- Password Protection & Description -->
                    <div class="form-row">
                        <div class="form-group">
                            <label>🔒 Document Access Password (Optional)</label>
                            <input type="text" id="notePassword" placeholder="Set password (leave blank for open access)">
                            <small style="color:#888;font-size:11px;">If set, partner coaching directors will need this password to unlock & view/download this file.</small>
                        </div>
                        <div class="form-group">
                            <label>Description / Instructions</label>
                            <textarea id="noteDescription" rows="2" placeholder="Brief details about chapter, board, or syllabus"></textarea>
                        </div>
                    </div>

                    <input type="hidden" id="editNoteId" value="">
                    
                    <!-- Upload Progress -->
                    <div id="noteUploadProgress" style="display:none;margin:10px 0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                            <span style="font-size:14px;color:#28a745;font-weight:600;">📤 Uploading Document...</span>
                            <span id="noteProgressText" style="font-size:14px;color:#28a745;font-weight:700;">0%</span>
                        </div>
                        <div style="width:100%;height:8px;background:#e9ecef;border-radius:10px;overflow:hidden;">
                            <div id="noteProgressBar" style="width:0%;height:100%;background:linear-gradient(90deg,#28a745,#20c997);border-radius:10px;transition:width 0.3s ease;"></div>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-success" style="width:100%;padding:12px;" id="noteSubmitBtn">
                        📚 Upload Study Material Document
                    </button>
                </form>
            </div>

            <!-- Notes List -->
            <div class="card">
                <div class="card-title">
                    <span class="icon">📚</span>
                    Study Material Documents
                    <span id="noteCount" style="font-size:14px;color:#888;font-weight:normal;"></span>
                </div>
                <div id="noteListContainer">
                    <div class="text-center" style="padding:30px;color:#888;">No documents added yet</div>
                </div>
            </div>
        </div>
    `;
    
    loadStudyMaterial();
    loadPartnerCentersForStudyMaterial();
}

// ============================================
// FETCH VIDEO THUMBNAIL FROM LINK
// ============================================
function fetchVideoThumbnail() {
    const link = document.getElementById('videoLink').value.trim();
    if (!link) return;
    
    // YouTube Thumbnail
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const youtubeMatch = link.match(youtubeRegex);
    
    if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        
        // Check if thumbnail exists
        const img = new Image();
        img.onload = function() {
            document.getElementById('videoThumbImg').src = thumbnailUrl;
            document.getElementById('videoThumbImg').style.display = 'block';
            document.getElementById('videoThumbPlaceholder').style.display = 'none';
        };
        img.onerror = function() {
            // Fallback to medium quality
            const fallbackUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
            document.getElementById('videoThumbImg').src = fallbackUrl;
            document.getElementById('videoThumbImg').style.display = 'block';
            document.getElementById('videoThumbPlaceholder').style.display = 'none';
        };
        img.src = thumbnailUrl;
        return;
    }
    
    // Vimeo Thumbnail
    const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
    const vimeoMatch = link.match(vimeoRegex);
    
    if (vimeoMatch) {
        const videoId = vimeoMatch[1];
        fetch(`https://vimeo.com/api/v2/video/${videoId}.json`)
            .then(response => response.json())
            .then(data => {
                if (data && data[0] && data[0].thumbnail_large) {
                    document.getElementById('videoThumbImg').src = data[0].thumbnail_large;
                    document.getElementById('videoThumbImg').style.display = 'block';
                    document.getElementById('videoThumbPlaceholder').style.display = 'none';
                }
            })
            .catch(() => {
                // Silent fail, user can upload manually
            });
        return;
    }
    
    // Dailymotion Thumbnail
    const dailymotionRegex = /(?:dailymotion\.com\/video\/)([a-zA-Z0-9]+)/;
    const dailymotionMatch = link.match(dailymotionRegex);
    
    if (dailymotionMatch) {
        const videoId = dailymotionMatch[1];
        const thumbnailUrl = `https://www.dailymotion.com/thumbnail/video/${videoId}`;
        document.getElementById('videoThumbImg').src = thumbnailUrl;
        document.getElementById('videoThumbImg').style.display = 'block';
        document.getElementById('videoThumbPlaceholder').style.display = 'none';
        return;
    }
    
    // Generic - try to get favicon or page preview
    try {
        const url = new URL(link);
        const domain = url.hostname;
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        document.getElementById('videoThumbImg').src = faviconUrl;
        document.getElementById('videoThumbImg').style.display = 'block';
        document.getElementById('videoThumbPlaceholder').style.display = 'none';
    } catch (e) {
        // Silent fail
    }
}

// ============================================
// SWITCH STUDY TAB
// ============================================
function switchStudyTab(tab) {
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-subtab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`subtab-${tab}`).classList.add('active');
}

// ============================================
// VIDEO THUMBNAIL HANDLER
// ============================================
function handleVideoThumb(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Show progress for thumbnail compression
    showVideoProgress(10, 'Compressing thumbnail...');
    
    compressImage(file, 50, function(compressedBase64) {
        document.getElementById('videoThumbImg').src = compressedBase64;
        document.getElementById('videoThumbImg').style.display = 'block';
        document.getElementById('videoThumbPlaceholder').style.display = 'none';
        hideVideoProgress();
        showToast('Thumbnail uploaded successfully!');
    }, function(progress) {
        // Update compression progress
        showVideoProgress(10 + (progress * 0.8), 'Compressing...');
    });
}

// ============================================
// DOCUMENT FILE HANDLER (PDF & WORD)
// ============================================
let currentUploadedFileMeta = { name: '', type: 'pdf', base64: '' };
let partnerCoachingCentersList = [];

async function loadPartnerCentersForStudyMaterial() {
    try {
        const res = await apiCall('/api/tuition-centers');
        if (res.success && Array.isArray(res.data)) {
            partnerCoachingCentersList = res.data;
            renderCenterCheckboxes();
        }
    } catch (e) {
        console.error('Failed to load partner centers for study materials:', e);
    }
}

function renderCenterCheckboxes() {
    const box = document.getElementById('noteCentersCheckboxes');
    if (!box) return;
    if (!partnerCoachingCentersList.length) {
        box.innerHTML = '<span style="font-size:12px;color:#888;">No partner coaching centers registered yet.</span>';
        return;
    }
    let html = '';
    partnerCoachingCentersList.forEach(c => {
        html += `
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;background:white;padding:6px 10px;border-radius:6px;border:1px solid #e2e8f0;">
                <input type="checkbox" class="study-center-chk" value="${c._id}">
                <span style="font-weight:600;color:#2d3748;">${c.centerName}</span>
            </label>
        `;
    });
    box.innerHTML = html;
}

function toggleNoteCenterSelection() {
    const type = document.getElementById('noteAccessType').value;
    const wrapper = document.getElementById('noteCentersSelectionWrapper');
    if (wrapper) {
        wrapper.style.display = (type === 'specific_centers') ? 'block' : 'none';
    }
}

function handleNoteFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    let detectedType = 'pdf';
    if (fileName.endsWith('.doc')) detectedType = 'doc';
    else if (fileName.endsWith('.docx')) detectedType = 'docx';
    else if (!fileName.endsWith('.pdf')) {
        showToast('Only PDF (.pdf) and Word (.doc, .docx) files are supported', true);
        return;
    }

    if (file.size > 25 * 1024 * 1024) { // 25MB limit
        showToast('Document file must be less than 25MB', true);
        return;
    }

    const typeLabel = (detectedType === 'pdf') ? 'PDF' : 'Word';
    const typeIcon = (detectedType === 'pdf') ? '📕' : '📘';

    showNoteProgress(10, `Reading ${typeLabel} file...`);

    const reader = new FileReader();
    reader.onprogress = function(e) {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            const progress = 10 + (percent * 0.8);
            showNoteProgress(Math.min(progress, 90), 'Uploading...');
        }
    };

    reader.onload = function(e) {
        const base64 = e.target.result;
        currentUploadedFileMeta = {
            name: file.name,
            type: detectedType,
            base64: base64
        };

        const previewEl = document.getElementById('noteFilePreview');
        const nameEl = document.getElementById('noteFileName');
        const placeholder = document.getElementById('noteFilePlaceholder');

        if (nameEl) {
            nameEl.textContent = `${typeIcon} ${file.name}`;
            nameEl.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
        if (previewEl) previewEl.dataset.fileBase64 = base64;

        hideNoteProgress();
        showToast(`${typeLabel} document uploaded successfully!`);
    };

    reader.onerror = function() {
        hideNoteProgress();
        showToast('Error reading document file', true);
    };

    reader.readAsDataURL(file);
}

// Backwards compatibility alias
function handleNotePdf(event) {
    handleNoteFile(event);
}

// ============================================
// COMPRESS IMAGE WITH PROGRESS
// ============================================
function compressImage(file, maxSizeKB, callback, progressCallback) {
    const reader = new FileReader();
    reader.onprogress = function(e) {
        if (e.lengthComputable && progressCallback) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressCallback(percent * 0.3);
        }
    };
    
    reader.onload = function(e) {
        if (progressCallback) progressCallback(30);
        
        const img = new Image();
        img.onload = function() {
            if (progressCallback) progressCallback(40);
            
            let quality = 0.9;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let width = img.width;
            let height = img.height;
            
            // Max dimensions for thumbnail
            const maxDimension = 320;
            if (width > maxDimension || height > maxDimension) {
                const ratio = Math.min(maxDimension / width, maxDimension / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            let base64 = canvas.toDataURL('image/jpeg', quality);
            let attempts = 0;
            
            if (progressCallback) progressCallback(60);
            
            while (base64.length / 1024 > maxSizeKB && quality > 0.1 && attempts < 10) {
                quality -= 0.1;
                base64 = canvas.toDataURL('image/jpeg', quality);
                attempts++;
                if (progressCallback) progressCallback(60 + (attempts * 3));
            }
            
            if (progressCallback) progressCallback(95);
            callback(base64);
            if (progressCallback) progressCallback(100);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ============================================
// PROGRESS BAR FUNCTIONS - VIDEO
// ============================================
function showVideoProgress(percent, message = 'Uploading...') {
    const progressDiv = document.getElementById('videoUploadProgress');
    const progressBar = document.getElementById('videoProgressBar');
    const progressText = document.getElementById('videoProgressText');
    const submitBtn = document.getElementById('videoSubmitBtn');
    
    if (progressDiv) {
        progressDiv.style.display = 'block';
        const p = Math.min(Math.max(percent, 0), 100);
        if (progressBar) progressBar.style.width = p + '%';
        if (progressText) progressText.textContent = Math.round(p) + '%';
        if (submitBtn) submitBtn.disabled = true;
    }
}

function hideVideoProgress() {
    const progressDiv = document.getElementById('videoUploadProgress');
    const submitBtn = document.getElementById('videoSubmitBtn');
    if (progressDiv) {
        setTimeout(() => {
            progressDiv.style.display = 'none';
            const progressBar = document.getElementById('videoProgressBar');
            const progressText = document.getElementById('videoProgressText');
            if (progressBar) progressBar.style.width = '0%';
            if (progressText) progressText.textContent = '0%';
        }, 500);
    }
    if (submitBtn) submitBtn.disabled = false;
}

// ============================================
// PROGRESS BAR FUNCTIONS - NOTE
// ============================================
function showNoteProgress(percent, message = 'Uploading...') {
    const progressDiv = document.getElementById('noteUploadProgress');
    const progressBar = document.getElementById('noteProgressBar');
    const progressText = document.getElementById('noteProgressText');
    const submitBtn = document.getElementById('noteSubmitBtn');
    
    if (progressDiv) {
        progressDiv.style.display = 'block';
        const p = Math.min(Math.max(percent, 0), 100);
        if (progressBar) progressBar.style.width = p + '%';
        if (progressText) progressText.textContent = Math.round(p) + '%';
        if (submitBtn) submitBtn.disabled = true;
    }
}

function hideNoteProgress() {
    const progressDiv = document.getElementById('noteUploadProgress');
    const submitBtn = document.getElementById('noteSubmitBtn');
    if (progressDiv) {
        setTimeout(() => {
            progressDiv.style.display = 'none';
            const progressBar = document.getElementById('noteProgressBar');
            const progressText = document.getElementById('noteProgressText');
            if (progressBar) progressBar.style.width = '0%';
            if (progressText) progressText.textContent = '0%';
        }, 500);
    }
    if (submitBtn) submitBtn.disabled = false;
}

// ============================================
// LOAD STUDY MATERIAL
// ============================================
async function loadStudyMaterial() {
    try {
        const data = await apiCall('/api/study-material');
        if (data.success) {
            videos = data.data.videos || [];
            notes = data.data.notes || [];
            renderVideos(videos);
            renderNotes(notes);
            updateCounts();
        }
    } catch (error) {
        showToast('Error loading study material', true);
    }
}

// ============================================
// RENDER VIDEOS
// ============================================
function renderVideos(videoList) {
    const container = document.getElementById('videoListContainer');
    if (!container) return;
    
    if (!videoList || videoList.length === 0) {
        container.innerHTML = '<div class="text-center" style="padding:30px;color:#888;">📹 No videos added yet</div>';
        return;
    }
    
    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">';
    
    for (let i = 0; i < videoList.length; i++) {
        const v = videoList[i];
        
        // Generate thumbnail from link if not available
        let thumbnailHtml = '';
        if (v.thumbnail) {
            thumbnailHtml = `<img src="${v.thumbnail}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;">`;
        } else if (v.link) {
            // Try to generate thumbnail from link
            const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
            const youtubeMatch = v.link.match(youtubeRegex);
            if (youtubeMatch) {
                const videoId = youtubeMatch[1];
                thumbnailHtml = `<img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`;
            } else {
                thumbnailHtml = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:48px;">🎬</div>`;
            }
        } else {
            thumbnailHtml = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:48px;">🎬</div>`;
        }
        
        html += `
            <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);transition:all 0.3s ease;border:1px solid #f0f0f0;">
                <div style="position:relative;padding-top:56.25%;background:#0b0e1a;">
                    ${thumbnailHtml}
                    <a href="${v.link}" target="_blank" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;background:rgba(255,0,0,0.8);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:24px;text-decoration:none;transition:all 0.3s ease;border:3px solid white;box-shadow:0 0 30px rgba(0,0,0,0.3);"
                        onmouseover="this.style.transform='translate(-50%,-50%) scale(1.1)'" 
                        onmouseout="this.style.transform='translate(-50%,-50%) scale(1)'">
                        ▶
                    </a>
                </div>
                <div style="padding:15px;">
                    <h4 style="font-size:16px;color:#333;margin-bottom:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${v.title || 'Untitled'}</h4>
                    ${v.description ? `<p style="font-size:13px;color:#888;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:10px;">${v.description}</p>` : ''}
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:11px;color:#aaa;">${v.createdAt ? new Date(v.createdAt).toLocaleDateString() : ''}</span>
                        <button class="btn-sm btn-danger" onclick="deleteVideo('${v._id || i}')">🗑️ Delete</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// ============================================
// RENDER NOTES / STUDY MATERIAL DOCUMENTS
// ============================================
function renderNotes(noteList) {
    const container = document.getElementById('noteListContainer');
    if (!container) return;
    
    if (!noteList || noteList.length === 0) {
        container.innerHTML = '<div class="text-center" style="padding:30px;color:#888;">📚 No study material documents added yet</div>';
        return;
    }
    
    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:20px;">';
    
    for (let i = 0; i < noteList.length; i++) {
        const n = noteList[i];
        const isWord = (n.fileType === 'doc' || n.fileType === 'docx' || (n.fileName && n.fileName.match(/\.docx?$/i)));
        const docIcon = isWord ? '📘' : '📕';
        const docTypeLabel = isWord ? 'WORD DOC' : 'PDF NOTE';
        const docHeaderBg = isWord 
            ? 'linear-gradient(135deg,#e3f2fd 0%,#bbdefb 100%)' 
            : 'linear-gradient(135deg,#ffebee 0%,#ffcdd2 100%)';
        const docIconColor = isWord ? '#1976d2' : '#c62828';
        const downloadFile = n.file || n.pdf || '';
        
        // Access badge
        let accessBadgeHtml = '';
        if (n.accessType === 'specific_centers') {
            const count = (n.allowedCenters && Array.isArray(n.allowedCenters)) ? n.allowedCenters.length : 0;
            accessBadgeHtml = `<span style="font-size:11px;background:#e9d8fd;color:#6b46c1;padding:3px 8px;border-radius:12px;font-weight:700;">🏫 ${count} Selected Centers</span>`;
        } else {
            accessBadgeHtml = `<span style="font-size:11px;background:#c6f6d5;color:#22543d;padding:3px 8px;border-radius:12px;font-weight:700;">🌐 All Partner Centers</span>`;
        }

        // Password badge
        const isLocked = !!(n.isProtected || (n.password && n.password.length > 0));
        const lockBadgeHtml = isLocked 
            ? `<span style="font-size:11px;background:#fed7d7;color:#9b2c2c;padding:3px 8px;border-radius:12px;font-weight:700;" title="Password: ${n.password || 'Set'}">🔒 Protected (${n.password ? n.password : 'PIN'})</span>`
            : `<span style="font-size:11px;background:#edf2f7;color:#4a5568;padding:3px 8px;border-radius:12px;font-weight:600;">🔓 Open Access</span>`;

        html += `
            <div style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 3px 12px rgba(0,0,0,0.08);transition:all 0.3s ease;border:1px solid #e2e8f0;display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                    <div style="padding:22px;text-align:center;background:${docHeaderBg};min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;">
                        <span style="position:absolute;top:10px;right:10px;font-size:10px;font-weight:800;letter-spacing:1px;background:rgba(255,255,255,0.8);padding:2px 8px;border-radius:10px;color:${docIconColor};">${docTypeLabel}</span>
                        <div style="font-size:46px;margin-bottom:6px;">${docIcon}</div>
                        ${downloadFile ? `<a href="${downloadFile}" download="${n.fileName || 'study-document'}" target="_blank" style="color:${docIconColor};font-weight:700;text-decoration:none;font-size:13px;display:inline-flex;align-items:center;gap:4px;background:white;padding:5px 12px;border-radius:20px;box-shadow:0 2px 6px rgba(0,0,0,0.1);">📥 View / Download File</a>` : '<span style="font-size:12px;color:#888;">(No file attached)</span>'}
                    </div>
                    <div style="padding:16px;">
                        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
                            ${accessBadgeHtml}
                            ${lockBadgeHtml}
                        </div>
                        <h4 style="font-size:15px;color:#2d3748;margin-bottom:6px;font-weight:700;">${n.title || 'Untitled'}</h4>
                        ${n.description ? `<p style="font-size:12px;color:#718096;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:10px;">${n.description}</p>` : ''}
                    </div>
                </div>
                <div style="padding:12px 16px;background:#f8fafc;border-top:1px solid #edf2f7;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:11px;color:#a0aec0;">${n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}</span>
                    <button class="btn-sm btn-danger" onclick="deleteNote('${n._id || i}')">🗑️ Delete</button>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// ============================================
// UPDATE COUNTS
// ============================================
function updateCounts() {
    const videoCount = document.getElementById('videoCount');
    const noteCount = document.getElementById('noteCount');
    if (videoCount) videoCount.textContent = `(${videos.length} videos)`;
    if (noteCount) noteCount.textContent = `(${notes.length} notes)`;
}

// ============================================
// SAVE VIDEO
// ============================================
async function saveVideo(event) {
    event.preventDefault();
    
    const editId = document.getElementById('editVideoId').value;
    const title = document.getElementById('videoTitle').value.trim();
    const link = document.getElementById('videoLink').value.trim();
    const description = document.getElementById('videoDescription').value.trim();
    let thumbnail = document.getElementById('videoThumbImg').src || '';
    
    if (!title) { showToast('Please enter video title', true); return; }
    if (!link) { showToast('Please enter video link', true); return; }
    
    // Show progress
    showVideoProgress(5, 'Preparing...');
    
    // If thumbnail is placeholder or empty, try to fetch from link
    if (!thumbnail || thumbnail === '') {
        showVideoProgress(10, 'Fetching thumbnail...');
        thumbnail = await getThumbnailFromLink(link);
    }
    
    const data = { title, link, description, thumbnail };
    
    try {
        showVideoProgress(20, 'Saving to server...');
        
        let response;
        if (editId) {
            response = await apiCall('/api/study-material/video/' + editId, {
                method: 'PUT',
                body: data
            }, function(progress) {
                // Update progress during upload
                const percent = 20 + (progress * 0.7);
                showVideoProgress(Math.min(percent, 95), 'Uploading...');
            });
        } else {
            response = await apiCall('/api/study-material/video', {
                method: 'POST',
                body: data
            }, function(progress) {
                // Update progress during upload
                const percent = 20 + (progress * 0.7);
                showVideoProgress(Math.min(percent, 95), 'Uploading...');
            });
        }
        
        showVideoProgress(98, 'Finalizing...');
        
        if (response.success) {
            showVideoProgress(100, 'Complete!');
            setTimeout(() => {
                showToast(editId ? 'Video updated!' : 'Video added!');
                resetVideoForm();
                loadStudyMaterial();
                hideVideoProgress();
            }, 500);
        } else {
            hideVideoProgress();
            showToast(response.message || 'Failed to save video', true);
        }
    } catch (error) {
        hideVideoProgress();
        showToast('Error saving video', true);
    }
}

// ============================================
// GET THUMBNAIL FROM LINK
// ============================================
function getThumbnailFromLink(link) {
    return new Promise((resolve) => {
        // YouTube
        const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const youtubeMatch = link.match(youtubeRegex);
        if (youtubeMatch) {
            const videoId = youtubeMatch[1];
            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
            resolve(thumbnailUrl);
            return;
        }
        
        // Vimeo
        const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
        const vimeoMatch = link.match(vimeoRegex);
        if (vimeoMatch) {
            const videoId = vimeoMatch[1];
            fetch(`https://vimeo.com/api/v2/video/${videoId}.json`)
                .then(response => response.json())
                .then(data => {
                    if (data && data[0] && data[0].thumbnail_large) {
                        resolve(data[0].thumbnail_large);
                    } else {
                        resolve('');
                    }
                })
                .catch(() => resolve(''));
            return;
        }
        
        // Dailymotion
        const dailymotionRegex = /(?:dailymotion\.com\/video\/)([a-zA-Z0-9]+)/;
        const dailymotionMatch = link.match(dailymotionRegex);
        if (dailymotionMatch) {
            const videoId = dailymotionMatch[1];
            resolve(`https://www.dailymotion.com/thumbnail/video/${videoId}`);
            return;
        }
        
        // No thumbnail found
        resolve('');
    });
}

// ============================================
// SAVE NOTE / STUDY MATERIAL DOCUMENT
// ============================================
async function saveNote(event) {
    event.preventDefault();
    
    const editId = document.getElementById('editNoteId').value;
    const title = document.getElementById('noteTitle').value.trim();
    const description = document.getElementById('noteDescription').value.trim();
    const accessType = document.getElementById('noteAccessType').value;
    const password = document.getElementById('notePassword').value.trim();
    
    const filePreview = document.getElementById('noteFilePreview') || document.getElementById('notePdfPreview');
    const fileContent = (filePreview && filePreview.dataset.fileBase64) || currentUploadedFileMeta.base64 || '';
    
    if (!title) { showToast('Please enter document title', true); return; }
    if (!fileContent) { showToast('Please upload a PDF or Word document file', true); return; }
    
    // Collect allowed centers if specific_centers
    let allowedCenters = [];
    if (accessType === 'specific_centers') {
        const checkedEls = document.querySelectorAll('.study-center-chk:checked');
        checkedEls.forEach(chk => allowedCenters.push(chk.value));
        if (allowedCenters.length === 0) {
            showToast('Please select at least one coaching center, or choose All Centers', true);
            return;
        }
    }

    const data = {
        title: title,
        description: description,
        file: fileContent,
        pdf: fileContent,
        fileName: currentUploadedFileMeta.name || 'document.pdf',
        fileType: currentUploadedFileMeta.type || 'pdf',
        accessType: accessType,
        allowedCenters: allowedCenters,
        password: password
    };
    
    showNoteProgress(5, 'Preparing document...');
    
    try {
        showNoteProgress(25, 'Saving to central server...');
        
        let response;
        if (editId) {
            response = await apiCall('/api/study-material/note/' + editId, {
                method: 'PUT',
                body: data
            });
        } else {
            response = await apiCall('/api/study-material/note', {
                method: 'POST',
                body: data
            });
        }
        
        showNoteProgress(95, 'Finalizing...');
        
        if (response.success) {
            showNoteProgress(100, 'Complete!');
            setTimeout(() => {
                showToast(editId ? 'Document updated!' : 'Study material document uploaded successfully!');
                resetNoteForm();
                loadStudyMaterial();
                hideNoteProgress();
            }, 500);
        } else {
            hideNoteProgress();
            showToast(response.message || 'Failed to save document', true);
        }
    } catch (error) {
        hideNoteProgress();
        showToast('Error saving document', true);
    }
}

// ============================================
// DELETE VIDEO
// ============================================
async function deleteVideo(id) {
    if (!confirm('Are you sure you want to delete this video?')) return;
    
    try {
        const data = await apiCall('/api/study-material/video/' + id, {
            method: 'DELETE'
        });
        
        if (data.success) {
            showToast('Video deleted!');
            loadStudyMaterial();
        } else {
            showToast('Failed to delete video', true);
        }
    } catch (error) {
        showToast('Error deleting video', true);
    }
}

// ============================================
// DELETE NOTE
// ============================================
async function deleteNote(id) {
    if (!confirm('Are you sure you want to delete this study material document?')) return;
    
    try {
        const data = await apiCall('/api/study-material/note/' + id, {
            method: 'DELETE'
        });
        
        if (data.success) {
            showToast('Document deleted!');
            loadStudyMaterial();
        } else {
            showToast('Failed to delete document', true);
        }
    } catch (error) {
        showToast('Error deleting document', true);
    }
}

// ============================================
// RESET FORMS
// ============================================
function resetVideoForm() {
    document.getElementById('videoForm').reset();
    document.getElementById('editVideoId').value = '';
    document.getElementById('videoThumbImg').src = '';
    document.getElementById('videoThumbImg').style.display = 'none';
    document.getElementById('videoThumbPlaceholder').style.display = 'block';
    document.getElementById('videoFormTitle').textContent = 'Add New Video';
    document.querySelector('#videoForm button[type="submit"]').textContent = '✅ Add Video';
    hideVideoProgress();
}

function resetNoteForm() {
    document.getElementById('noteForm').reset();
    document.getElementById('editNoteId').value = '';
    
    const placeholder = document.getElementById('noteFilePlaceholder') || document.getElementById('notePdfPlaceholder');
    const nameEl = document.getElementById('noteFileName') || document.getElementById('notePdfName');
    const preview = document.getElementById('noteFilePreview') || document.getElementById('notePdfPreview');
    
    if (placeholder) placeholder.style.display = 'block';
    if (nameEl) {
        nameEl.style.display = 'none';
        nameEl.textContent = '';
    }
    if (preview) {
        preview.dataset.fileBase64 = '';
        preview.dataset.pdfBase64 = '';
    }
    currentUploadedFileMeta = { name: '', type: 'pdf', base64: '' };
    
    document.getElementById('noteAccessType').value = 'all_centers';
    toggleNoteCenterSelection();
    
    const checkboxes = document.querySelectorAll('.study-center-chk');
    checkboxes.forEach(c => c.checked = false);

    document.getElementById('notePassword').value = '';
    document.getElementById('noteFormTitle').textContent = 'Add New Study Document (PDF / Word)';
    document.querySelector('#noteForm button[type="submit"]').textContent = '📚 Upload Study Material Document';
    hideNoteProgress();
}

// ============================================
// API CALL WITH PROGRESS
// ============================================
// Note: आपके existing apiCall function को modify करना होगा
// या progress callback को support करने के लिए इसे update करें
