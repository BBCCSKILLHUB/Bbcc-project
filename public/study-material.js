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
            <!-- Add PDF Note Form -->
            <div class="card">
                <div class="card-title">
                    <span class="icon">📄</span>
                    <span id="noteFormTitle">Add New PDF Note</span>
                </div>
                <form id="noteForm" onsubmit="saveNote(event)">
                    <div class="form-row">
                        <div class="form-group">
                            <label>PDF File *</label>
                            <div class="image-upload" onclick="document.getElementById('notePdfInput').click()">
                                <div class="preview" id="notePdfPreview">
                                    <span id="notePdfPlaceholder" style="font-size:40px;">📄</span>
                                    <span id="notePdfName" style="display:none;font-size:14px;color:#667eea;font-weight:600;"></span>
                                </div>
                                <div class="hint">Click to upload PDF file (Max 25MB)</div>
                                <input type="file" id="notePdfInput" accept=".pdf" onchange="handleNotePdf(event)">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Notes Title *</label>
                            <input type="text" id="noteTitle" placeholder="Enter notes title" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="noteDescription" rows="2" placeholder="Enter notes description"></textarea>
                    </div>
                    <input type="hidden" id="editNoteId" value="">
                    
                    <!-- Upload Progress -->
                    <div id="noteUploadProgress" style="display:none;margin:10px 0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                            <span style="font-size:14px;color:#28a745;font-weight:600;">📤 Uploading PDF...</span>
                            <span id="noteProgressText" style="font-size:14px;color:#28a745;font-weight:700;">0%</span>
                        </div>
                        <div style="width:100%;height:8px;background:#e9ecef;border-radius:10px;overflow:hidden;">
                            <div id="noteProgressBar" style="width:0%;height:100%;background:linear-gradient(90deg,#28a745,#20c997);border-radius:10px;transition:width 0.3s ease;"></div>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-success" style="width:100%;padding:12px;" id="noteSubmitBtn">
                        📄 Add PDF Note
                    </button>
                </form>
            </div>

            <!-- Notes List -->
            <div class="card">
                <div class="card-title">
                    <span class="icon">📚</span>
                    PDF Notes List
                    <span id="noteCount" style="font-size:14px;color:#888;font-weight:normal;"></span>
                </div>
                <div id="noteListContainer">
                    <div class="text-center" style="padding:30px;color:#888;">No PDF notes added yet</div>
                </div>
            </div>
        </div>
    `;
    
    loadStudyMaterial();
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
// PDF NOTE HANDLER
// ============================================
function handleNotePdf(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
        showToast('Please upload a PDF file', true);
        return;
    }
    
    if (file.size > 25 * 1024 * 1024) { // 25MB limit
        showToast('PDF file must be less than 25MB', true);
        return;
    }
    
    // Show upload progress for PDF
    showNoteProgress(10, 'Reading PDF...');
    
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
        document.getElementById('notePdfName').textContent = file.name;
        document.getElementById('notePdfName').style.display = 'block';
        document.getElementById('notePdfPlaceholder').style.display = 'none';
        document.getElementById('notePdfPreview').dataset.pdfBase64 = base64;
        hideNoteProgress();
        showToast('PDF uploaded successfully!');
    };
    
    reader.onerror = function() {
        hideNoteProgress();
        showToast('Error reading PDF file', true);
    };
    
    reader.readAsDataURL(file);
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
// RENDER NOTES
// ============================================
function renderNotes(noteList) {
    const container = document.getElementById('noteListContainer');
    if (!container) return;
    
    if (!noteList || noteList.length === 0) {
        container.innerHTML = '<div class="text-center" style="padding:30px;color:#888;">📄 No PDF notes added yet</div>';
        return;
    }
    
    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">';
    
    for (let i = 0; i < noteList.length; i++) {
        const n = noteList[i];
        html += `
            <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);transition:all 0.3s ease;border:1px solid #f0f0f0;">
                <div style="padding:20px;text-align:center;background:linear-gradient(135deg,#f8f9fa 0%,#e9ecef 100%);min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                    <div style="font-size:48px;margin-bottom:5px;">📄</div>
                    <a href="${n.pdf}" target="_blank" style="color:#667eea;font-weight:600;text-decoration:none;font-size:14px;">📥 View PDF</a>
                </div>
                <div style="padding:15px;">
                    <h4 style="font-size:16px;color:#333;margin-bottom:5px;">${n.title || 'Untitled'}</h4>
                    ${n.description ? `<p style="font-size:13px;color:#888;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:10px;">${n.description}</p>` : ''}
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:11px;color:#aaa;">${n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}</span>
                        <button class="btn-sm btn-danger" onclick="deleteNote('${n._id || i}')">🗑️ Delete</button>
                    </div>
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
// SAVE NOTE
// ============================================
async function saveNote(event) {
    event.preventDefault();
    
    const editId = document.getElementById('editNoteId').value;
    const title = document.getElementById('noteTitle').value.trim();
    const description = document.getElementById('noteDescription').value.trim();
    const pdf = document.getElementById('notePdfPreview').dataset.pdfBase64 || '';
    
    if (!title) { showToast('Please enter notes title', true); return; }
    if (!pdf) { showToast('Please upload a PDF file', true); return; }
    
    // Show progress
    showNoteProgress(5, 'Preparing...');
    
    const data = { title, description, pdf };
    
    try {
        showNoteProgress(20, 'Saving to server...');
        
        let response;
        if (editId) {
            response = await apiCall('/api/study-material/note/' + editId, {
                method: 'PUT',
                body: data
            }, function(progress) {
                const percent = 20 + (progress * 0.7);
                showNoteProgress(Math.min(percent, 95), 'Uploading...');
            });
        } else {
            response = await apiCall('/api/study-material/note', {
                method: 'POST',
                body: data
            }, function(progress) {
                const percent = 20 + (progress * 0.7);
                showNoteProgress(Math.min(percent, 95), 'Uploading...');
            });
        }
        
        showNoteProgress(98, 'Finalizing...');
        
        if (response.success) {
            showNoteProgress(100, 'Complete!');
            setTimeout(() => {
                showToast(editId ? 'Note updated!' : 'Note added!');
                resetNoteForm();
                loadStudyMaterial();
                hideNoteProgress();
            }, 500);
        } else {
            hideNoteProgress();
            showToast(response.message || 'Failed to save note', true);
        }
    } catch (error) {
        hideNoteProgress();
        showToast('Error saving note', true);
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
    if (!confirm('Are you sure you want to delete this PDF note?')) return;
    
    try {
        const data = await apiCall('/api/study-material/note/' + id, {
            method: 'DELETE'
        });
        
        if (data.success) {
            showToast('Note deleted!');
            loadStudyMaterial();
        } else {
            showToast('Failed to delete note', true);
        }
    } catch (error) {
        showToast('Error deleting note', true);
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
    document.getElementById('notePdfPlaceholder').style.display = 'block';
    document.getElementById('notePdfName').style.display = 'none';
    document.getElementById('notePdfPreview').dataset.pdfBase64 = '';
    document.getElementById('noteFormTitle').textContent = 'Add New PDF Note';
    document.querySelector('#noteForm button[type="submit"]').textContent = '📄 Add PDF Note';
    hideNoteProgress();
}

// ============================================
// API CALL WITH PROGRESS
// ============================================
// Note: आपके existing apiCall function को modify करना होगा
// या progress callback को support करने के लिए इसे update करें
