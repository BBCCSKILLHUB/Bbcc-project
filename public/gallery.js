// ============================================
// GALLERY MANAGEMENT - COMPLETE
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
// UPLOAD GALLERY PHOTOS
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
        for (let i = 0; i < selectedFiles.length; i++) {
            const base64 = await fileToBase64(selectedFiles[i]);
            photos.push({
                image: base64,
                title: selectedFiles[i].name.split('.')[0],
                description: ''
            });
        }
        
        const data = await apiCall('/api/gallery/photos', {
            method: 'POST',
            body: { photos: photos }
        });
        
        if (data.success) {
            showToast(`${selectedFiles.length} photos uploaded successfully!`);
            selectedFiles = [];
            document.getElementById('galleryPreviewContainer').innerHTML = '';
            document.getElementById('galleryInput').value = '';
            uploadBtn.style.display = 'none';
            loadGallery();
        } else {
            showToast(data.message || 'Failed to upload photos', true);
        }
    } catch (error) {
        showToast('Error uploading photos', true);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = `✅ Upload ${selectedFiles.length} Photos`;
    }
}

// ============================================
// FILE TO BASE64
// ============================================
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Compress image before saving
            compressImageFile(file, 200, function(compressed) {
                resolve(compressed);
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================================
// COMPRESS IMAGE FILE
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
