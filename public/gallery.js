// ============================================
// GALLERY MANAGEMENT - COMPLETE (FIXED)
// ============================================

let galleryPhotos = [];
let selectedFiles = [];

// ============================================
// INIT GALLERY
// ============================================
function initGallery() {
    const container = document.getElementById('galleryApp');
    if (!container) return;
    
    container.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span class="icon">📤</span>
                Upload Photos
            </div>
            <div class="image-upload" id="galleryDropZone" onclick="document.getElementById('galleryInput').click()">
                <div style="font-size:48px;margin-bottom:10px;">📸</div>
                <div class="hint">Click to select multiple photos or drag & drop</div>
                <div style="font-size:12px;color:#999;margin-top:5px;">Supports: JPG, PNG, WebP (Max 5MB each)</div>
                <input type="file" id="galleryInput" accept="image/*" multiple onchange="handleGalleryFiles(event)">
            </div>
            <div id="galleryPreviewContainer" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:15px;"></div>
            
            <!-- Upload Progress -->
            <div id="galleryUploadProgress" style="display:none;margin-top:15px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                    <span style="font-size:14px;color:#667eea;font-weight:600;">
                        <span id="galleryProgressIcon">📸</span> 
                        <span id="galleryProgressMessage">Uploading Photos...</span>
                    </span>
                    <span id="galleryProgressText" style="font-size:14px;color:#667eea;font-weight:700;">0%</span>
                </div>
                <div style="width:100%;height:8px;background:#e9ecef;border-radius:10px;overflow:hidden;">
                    <div id="galleryProgressBar" style="width:0%;height:100%;background:linear-gradient(90deg,#f093fb,#f5576c);border-radius:10px;transition:width 0.3s ease;"></div>
                </div>
                <div id="galleryProgressDetails" style="font-size:12px;color:#888;margin-top:5px;text-align:center;"></div>
            </div>
            
            <button class="btn btn-success" onclick="uploadGalleryPhotos()" id="galleryUploadBtn" style="display:none;margin-top:15px;width:100%;padding:12px;">
                ✅ Upload Selected Photos
            </button>
        </div>

        <div class="card">
            <div class="card-title">
                <span class="icon">📸</span>
                Photo Gallery
                <span id="galleryCount" style="font-size:14px;color:#888;font-weight:normal;"></span>
            </div>
            <div id="galleryGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:15px;">
                <div class="text-center" style="padding:40px;color:#888;grid-column:1/-1;">Loading photos...</div>
            </div>
        </div>
    `;
    
    // Drag and Drop support
    const dropZone = document.getElementById('galleryDropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.borderColor = '#667eea';
            this.style.background = '#f0f2ff';
        });
        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.style.borderColor = '#e0e0e0';
            this.style.background = 'transparent';
        });
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderColor = '#e0e0e0';
            this.style.background = 'transparent';
            if (e.dataTransfer.files.length > 0) {
                document.getElementById('galleryInput').files = e.dataTransfer.files;
                handleGalleryFiles(e);
            }
        });
    }
    
    loadGallery();
}

// ============================================
// HANDLE GALLERY FILES
// ============================================
function handleGalleryFiles(event) {
    const files = event.target.files || event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const previewContainer = document.getElementById('galleryPreviewContainer');
    const uploadBtn = document.getElementById('galleryUploadBtn');
    
    selectedFiles = [];
    previewContainer.innerHTML = '';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
            showToast(file.name + ' is not an image', true);
            continue;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            showToast(file.name + ' is too large (max 5MB)', true);
            continue;
        }
        
        selectedFiles.push(file);
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.style.cssText = 'position:relative;width:120px;height:120px;border-radius:8px;overflow:hidden;border:2px solid #e0e0e0;';
            div.innerHTML = `
                <img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">
                <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:white;font-size:10px;padding:4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${file.name}
                </div>
                <button onclick="this.parentElement.remove();removeFromSelected('${file.name}')" 
                    style="position:absolute;top:-8px;right:-8px;width:24px;height:24px;border:none;background:#e74c3c;color:white;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">
                    ✕
                </button>
            `;
            previewContainer.appendChild(div);
        };
        reader.readAsDataURL(file);
    }
    
    if (selectedFiles.length > 0) {
        uploadBtn.style.display = 'block';
        uploadBtn.textContent = `✅ Upload ${selectedFiles.length} Photos`;
    } else {
        uploadBtn.style.display = 'none';
    }
}

// ============================================
// REMOVE FROM SELECTED
// ============================================
function removeFromSelected(fileName) {
    selectedFiles = selectedFiles.filter(f => f.name !== fileName);
    const uploadBtn = document.getElementById('galleryUploadBtn');
    if (selectedFiles.length === 0) {
        uploadBtn.style.display = 'none';
    } else {
        uploadBtn.textContent = `✅ Upload ${selectedFiles.length} Photos`;
    }
}

// ============================================
// PROGRESS BAR FUNCTIONS - GALLERY
// ============================================
function showGalleryProgress(percent, message = 'Uploading...', details = '') {
    const progressDiv = document.getElementById('galleryUploadProgress');
    const progressBar = document.getElementById('galleryProgressBar');
    const progressText = document.getElementById('galleryProgressText');
    const progressMessage = document.getElementById('galleryProgressMessage');
    const progressDetails = document.getElementById('galleryProgressDetails');
    const uploadBtn = document.getElementById('galleryUploadBtn');
    const icon = document.getElementById('galleryProgressIcon');
    
    if (progressDiv) {
        progressDiv.style.display = 'block';
        const p = Math.min(Math.max(percent, 0), 100);
        if (progressBar) progressBar.style.width = p + '%';
        if (progressText) progressText.textContent = Math.round(p) + '%';
        if (progressMessage) progressMessage.textContent = message;
        if (progressDetails) progressDetails.textContent = details;
        if (uploadBtn) uploadBtn.disabled = true;
        
        // Change icon based on progress
        if (icon) {
            if (p < 30) icon.textContent = '📸';
            else if (p < 60) icon.textContent = '⚡';
            else if (p < 90) icon.textContent = '🚀';
            else icon.textContent = '✅';
        }
    }
}

function hideGalleryProgress() {
    const progressDiv = document.getElementById('galleryUploadProgress');
    const uploadBtn = document.getElementById('galleryUploadBtn');
    if (progressDiv) {
        setTimeout(() => {
            progressDiv.style.display = 'none';
            const progressBar = document.getElementById('galleryProgressBar');
            const progressText = document.getElementById('galleryProgressText');
            const progressMessage = document.getElementById('galleryProgressMessage');
            const progressDetails = document.getElementById('galleryProgressDetails');
            const icon = document.getElementById('galleryProgressIcon');
            
            if (progressBar) progressBar.style.width = '0%';
            if (progressText) progressText.textContent = '0%';
            if (progressMessage) progressMessage.textContent = 'Uploading Photos...';
            if (progressDetails) progressDetails.textContent = '';
            if (icon) icon.textContent = '📸';
        }, 500);
    }
    if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = `✅ Upload ${selectedFiles.length} Photos`;
    }
}

// ============================================
// COMPRESS IMAGE WITH PROGRESS (FIXED)
// ============================================
function compressImageWithProgress(file, maxSizeKB, onProgress) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onprogress = function(e) {
            if (e.lengthComputable && onProgress) {
                const percent = (e.loaded / e.total) * 0.3;
                onProgress(percent);
            }
        };
        
        reader.onload = function(e) {
            if (onProgress) onProgress(0.35);
            
            const img = new Image();
            img.onload = function() {
                if (onProgress) onProgress(0.4);
                
                let quality = 0.9;
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let width = img.width;
                let height = img.height;
                
                const maxDimension = 800;
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
                
                if (onProgress) onProgress(0.5);
                
                while (base64.length / 1024 > maxSizeKB && quality > 0.1 && attempts < 15) {
                    quality -= 0.05;
                    base64 = canvas.toDataURL('image/jpeg', quality);
                    attempts++;
                    if (onProgress) {
                        const progress = 0.5 + (attempts * 0.03);
                        onProgress(Math.min(progress, 0.95));
                    }
                }
                
                if (onProgress) onProgress(0.98);
                resolve(base64);
                if (onProgress) onProgress(1.0);
            };
            
            img.onerror = function() {
                reject(new Error('Failed to load image'));
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = function() {
            reject(new Error('Failed to read file'));
        };
        
        reader.readAsDataURL(file);
    });
}

// ============================================
// UPLOAD GALLERY PHOTOS (FIXED)
// ============================================
async function uploadGalleryPhotos() {
    if (selectedFiles.length === 0) {
        showToast('No photos selected', true);
        return;
    }
    
    const uploadBtn = document.getElementById('galleryUploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = '⏳ Uploading...';
    
    try {
        const photos = [];
        const totalFiles = selectedFiles.length;
        
        // Show initial progress
        showGalleryProgress(0, 'Preparing photos...', `0/${totalFiles} photos`);
        
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            
            // Update progress for current file
            const baseProgress = (i / totalFiles) * 40;
            showGalleryProgress(
                baseProgress,
                `Processing photo ${i+1}/${totalFiles}...`,
                `${file.name} (${(file.size / 1024).toFixed(0)}KB)`
            );
            
            // Compress image with progress
            const compressedBase64 = await compressImageWithProgress(
                file, 
                200,
                function(compressProgress) {
                    // Update progress during compression
                    const currentProgress = baseProgress + (compressProgress * 40 / totalFiles);
                    showGalleryProgress(
                        Math.min(currentProgress, 95),
                        `Compressing ${file.name}...`,
                        `${Math.round(compressProgress * 100)}% done`
                    );
                }
            );
            
            photos.push({
                image: compressedBase64,
                title: file.name.split('.')[0],
                description: ''
            });
            
            // Update progress after each photo
            const afterProgress = ((i + 1) / totalFiles) * 40;
            showGalleryProgress(
                Math.min(afterProgress, 40),
                `Processed ${i+1}/${totalFiles} photos`,
                `${file.name} ✓`
            );
        }
        
        // Upload to server
        showGalleryProgress(45, 'Uploading to server...', `Sending ${totalFiles} photos`);
        
        // Simple API call without progress callback (since apiCall might not support it)
        const data = await apiCall('/api/gallery/photos', {
            method: 'POST',
            body: { photos: photos }
        });
        
        showGalleryProgress(98, 'Finalizing...', 'Almost done!');
        
        if (data.success) {
            showGalleryProgress(100, 'Complete!', `✅ ${totalFiles} photos uploaded!`);
            setTimeout(() => {
                showToast(`${totalFiles} photos uploaded successfully!`);
                selectedFiles = [];
                document.getElementById('galleryPreviewContainer').innerHTML = '';
                document.getElementById('galleryInput').value = '';
                uploadBtn.style.display = 'none';
                loadGallery();
                hideGalleryProgress();
            }, 800);
        } else {
            hideGalleryProgress();
            showToast(data.message || 'Failed to upload photos', true);
        }
    } catch (error) {
        hideGalleryProgress();
        showToast('Error uploading photos: ' + error.message, true);
        console.error('Upload error:', error);
    } finally {
        uploadBtn.disabled = false;
        if (selectedFiles.length > 0) {
            uploadBtn.textContent = `✅ Upload ${selectedFiles.length} Photos`;
        } else {
            uploadBtn.style.display = 'none';
        }
    }
}

// ============================================
// FILE TO BASE64 (Backward compatibility)
// ============================================
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            compressImageFile(file, 200, function(compressed) {
                resolve(compressed);
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================================
// COMPRESS IMAGE FILE (Backward compatibility)
// ============================================
function compressImageFile(file, maxSizeKB, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            let quality = 0.9;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let width = img.width;
            let height = img.height;
            
            const maxDimension = 800;
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
// LOAD GALLERY
// ============================================
async function loadGallery() {
    try {
        const data = await apiCall('/api/gallery');
        if (data.success) {
            galleryPhotos = data.data.photos || [];
            renderGallery(galleryPhotos);
            updateGalleryCount(galleryPhotos.length);
        }
    } catch (error) {
        showToast('Error loading gallery', true);
    }
}

// ============================================
// RENDER GALLERY
// ============================================
function renderGallery(photos) {
    const container = document.getElementById('galleryGrid');
    if (!container) return;
    
    if (!photos || photos.length === 0) {
        container.innerHTML = '<div class="text-center" style="padding:40px;color:#888;grid-column:1/-1;">📷 No photos uploaded yet</div>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        html += `
            <div style="position:relative;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);border:1px solid #f0f0f0;background:white;transition:all 0.3s ease;" 
                onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 8px 30px rgba(0,0,0,0.15)';"
                onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 2px 10px rgba(0,0,0,0.08)';">
                <div style="position:relative;padding-top:100%;background:#f0f0f0;">
                    <img src="${p.image}" alt="${p.title || 'Photo'}" 
                        style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;cursor:pointer;"
                        onclick="viewFullImage('${p.image}')">
                    ${p.title ? `<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));color:white;padding:30px 10px 10px;font-size:13px;font-weight:600;">${p.title}</div>` : ''}
                </div>
                <div style="padding:10px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:11px;color:#aaa;">${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}</span>
                    <button class="btn-sm btn-danger" onclick="deletePhoto('${p._id}')">🗑️</button>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ============================================
// UPDATE GALLERY COUNT
// ============================================
function updateGalleryCount(count) {
    const countEl = document.getElementById('galleryCount');
    if (countEl) {
        countEl.textContent = `(${count} photos)`;
    }
    const badge = document.getElementById('galleryBadge');
    if (badge) {
        badge.textContent = count;
    }
}

// ============================================
// VIEW FULL IMAGE
// ============================================
function viewFullImage(imageSrc) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:2000;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:20px;';
    modal.onclick = function() { this.remove(); };
    modal.innerHTML = `
        <img src="${imageSrc}" style="max-width:95%;max-height:95%;object-fit:contain;border-radius:8px;">
        <button style="position:absolute;top:20px;right:20px;width:40px;height:40px;border:none;background:rgba(255,255,255,0.2);color:white;border-radius:50%;font-size:24px;cursor:pointer;">✕</button>
    `;
    document.body.appendChild(modal);
}

// ============================================
// DELETE PHOTO
// ============================================
async function deletePhoto(photoId) {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    
    try {
        const data = await apiCall('/api/gallery/photo/' + photoId, {
            method: 'DELETE'
        });
        
        if (data.success) {
            showToast('Photo deleted successfully!');
            loadGallery();
        } else {
            showToast('Failed to delete photo', true);
        }
    } catch (error) {
        showToast('Error deleting photo', true);
    }
}

// ============================================
// TOAST FUNCTION (if not exists)
// ============================================
if (typeof showToast !== 'function') {
    function showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        if (!toast) {
            const t = document.createElement('div');
            t.id = 'toast';
            t.style.cssText = 'position:fixed;bottom:30px;right:30px;background:#2ecc71;color:white;padding:15px 25px;border-radius:10px;font-weight:600;box-shadow:0 5px 20px rgba(0,0,0,0.2);display:none;z-index:2000;';
            document.body.appendChild(t);
        }
        const toastEl = document.getElementById('toast');
        toastEl.textContent = message;
        toastEl.className = 'toast' + (isError ? ' error' : '');
        if (isError) {
            toastEl.style.background = '#e74c3c';
        } else {
            toastEl.style.background = '#2ecc71';
        }
        toastEl.style.display = 'block';
        setTimeout(() => { toastEl.style.display = 'none'; }, 4000);
    }
}
