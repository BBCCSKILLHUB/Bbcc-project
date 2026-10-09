// ============================================
// SIDEBAR BANNER MANAGEMENT - COMPLETE
// ============================================

let selectedBannerFiles = [];

// ============================================
// INIT SIDEBAR BANNER
// ============================================
function initSidebarBanner() {
    const container = document.getElementById('sidebarBannerApp');
    if (!container) return;
    
    container.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span class="icon">🖼️</span>
                Upload Banners
            </div>
            <div class="image-upload" id="bannerDropZone" onclick="document.getElementById('bannerInput').click()">
                <div style="font-size:48px;margin-bottom:10px;">📸</div>
                <div class="hint">Click to select multiple banners or drag & drop</div>
                <div style="font-size:12px;color:#999;margin-top:5px;">Supports: JPG, PNG, WebP (Recommended: 1200x400px)</div>
                <input type="file" id="bannerInput" accept="image/*" multiple onchange="handleBannerFiles(event)">
            </div>
            
            <div style="margin-top:15px;">
                <div class="form-group">
                    <label>Banner Title (Optional)</label>
                    <input type="text" id="bannerTitle" placeholder="Enter banner title">
                </div>
                <div class="form-group">
                    <label>Banner Link (Optional)</label>
                    <input type="url" id="bannerLink" placeholder="https://example.com">
                </div>
            </div>
            
            <div id="bannerPreviewContainer" class="gallery-preview-container"></div>
            <button class="btn btn-success" onclick="uploadBanners()" id="bannerUploadBtn" style="display:none;margin-top:15px;width:100%;padding:12px;">
                ✅ Upload Selected Banners
            </button>
        </div>

        <div class="card">
            <div class="card-title">
                <span class="icon">🎠</span>
                Banner Slideshow
                <span id="bannerCount" style="font-size:14px;color:#888;font-weight:normal;"></span>
            </div>
            
            <!-- Banner Preview -->
            <div style="position:relative;background:#0b0e1a;border-radius:12px;overflow:hidden;margin-bottom:20px;">
                <div id="bannerSlideContainer" style="position:relative;padding-top:33.33%;background:#0b0e1a;">
                    <div id="bannerSlide" style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;transition:transform 0.5s ease;">
                        <div class="text-center" style="width:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:18px;">
                            No banners uploaded yet
                        </div>
                    </div>
                    <button id="bannerPrevBtn" onclick="changeBannerSlide(-1)" style="position:absolute;top:50%;left:10px;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;display:none;z-index:10;">◀</button>
                    <button id="bannerNextBtn" onclick="changeBannerSlide(1)" style="position:absolute;top:50%;right:10px;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;display:none;z-index:10;">▶</button>
                </div>
                <div id="bannerDots" style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10;"></div>
            </div>
            
            <!-- Banner List -->
            <div id="bannerListContainer" class="gallery-grid">
                <div class="text-center" style="padding:40px;color:#888;grid-column:1/-1;">No banners uploaded yet</div>
            </div>
        </div>
    `;
    
    // Drag and Drop support
    const dropZone = document.getElementById('bannerDropZone');
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
                document.getElementById('bannerInput').files = e.dataTransfer.files;
                handleBannerFiles(e);
            }
        });
    }
    
    loadBanners();
}

// ============================================
// HANDLE BANNER FILES
// ============================================
function handleBannerFiles(event) {
    const files = event.target.files || event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const previewContainer = document.getElementById('bannerPreviewContainer');
    const uploadBtn = document.getElementById('bannerUploadBtn');
    
    selectedBannerFiles = [];
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
        
        selectedBannerFiles.push(file);
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'gallery-preview-item';
            div.innerHTML = `
                <img src="${e.target.result}">
                <div class="file-name">${file.name}</div>
                <button onclick="this.parentElement.remove();removeFromBannerSelected('${file.name}')" class="remove-btn">✕</button>
            `;
            previewContainer.appendChild(div);
        };
        reader.readAsDataURL(file);
    }
    
    if (selectedBannerFiles.length > 0) {
        uploadBtn.style.display = 'block';
        uploadBtn.textContent = `✅ Upload ${selectedBannerFiles.length} Banners`;
    } else {
        uploadBtn.style.display = 'none';
    }
}

// ============================================
// REMOVE FROM SELECTED
// ============================================
function removeFromBannerSelected(fileName) {
    selectedBannerFiles = selectedBannerFiles.filter(f => f.name !== fileName);
    const uploadBtn = document.getElementById('bannerUploadBtn');
    if (selectedBannerFiles.length === 0) {
        uploadBtn.style.display = 'none';
    } else {
        uploadBtn.textContent = `✅ Upload ${selectedBannerFiles.length} Banners`;
    }
}

// ============================================
// UPLOAD BANNERS
// ============================================
async function uploadBanners() {
    if (selectedBannerFiles.length === 0) {
        showToast('No banners selected', true);
        return;
    }
    
    const title = document.getElementById('bannerTitle').value.trim();
    const link = document.getElementById('bannerLink').value.trim();
    const uploadBtn = document.getElementById('bannerUploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = '⏳ Uploading...';
    
    try {
        const banners = [];
        for (let i = 0; i < selectedBannerFiles.length; i++) {
            const base64 = await fileToBase64Banner(selectedBannerFiles[i]);
            banners.push({
                image: base64,
                title: title || selectedBannerFiles[i].name.split('.')[0],
                link: link || ''
            });
        }
        
        const data = await apiCall('/api/sidebar-banner/banners', {
            method: 'POST',
            body: { banners: banners }
        });
        
        if (data.success) {
            showToast(`${selectedBannerFiles.length} banners uploaded successfully!`);
            selectedBannerFiles = [];
            document.getElementById('bannerPreviewContainer').innerHTML = '';
            document.getElementById('bannerInput').value = '';
            document.getElementById('bannerTitle').value = '';
            document.getElementById('bannerLink').value = '';
            uploadBtn.style.display = 'none';
            loadBanners();
        } else {
            showToast(data.message || 'Failed to upload banners', true);
        }
    } catch (error) {
        showToast('Error uploading banners', true);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = `✅ Upload ${selectedBannerFiles.length} Banners`;
    }
}

// ============================================
// FILE TO BASE64
// ============================================
function fileToBase64Banner(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            compressImageFileBanner(file, 200, function(compressed) {
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
function compressImageFileBanner(file, maxSizeKB, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            let quality = 0.9;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let width = img.width;
            let height = img.height;
            
            // Max dimensions for banner (16:9 ratio)
            const maxWidth = 1200;
            const maxHeight = 400;
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
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
// LOAD BANNERS
// ============================================
let bannerData = [];
let currentBannerIndex = 0;
let bannerInterval = null;

async function loadBanners() {
    try {
        const data = await apiCall('/api/sidebar-banner');
        if (data.success) {
            bannerData = data.data.banners || [];
            renderBanners(bannerData);
            updateBannerCount(bannerData.length);
            startBannerSlideshow();
        }
    } catch (error) {
        showToast('Error loading banners', true);
    }
}

// ============================================
// RENDER BANNERS
// ============================================
function renderBanners(banners) {
    const container = document.getElementById('bannerListContainer');
    if (!container) return;
    
    if (!banners || banners.length === 0) {
        container.innerHTML = '<div class="text-center" style="padding:40px;color:#888;grid-column:1/-1;">🖼️ No banners uploaded yet</div>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < banners.length; i++) {
        const b = banners[i];
        html += `
            <div class="gallery-item">
                <div class="img-wrapper" onclick="viewFullImage('${b.image}')">
                    <img src="${b.image}" alt="${b.title || 'Banner'}">
                    ${b.title ? `<div class="title-overlay">${b.title}</div>` : ''}
                </div>
                <div class="item-footer">
                    <span class="date">${b.createdAt ? new Date(b.createdAt).toLocaleDateString() : ''}</span>
                    <button class="btn-sm btn-danger" onclick="deleteBanner('${b._id}')">🗑️</button>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ============================================
// UPDATE BANNER COUNT
// ============================================
function updateBannerCount(count) {
    const countEl = document.getElementById('bannerCount');
    if (countEl) {
        countEl.textContent = `(${count} banners)`;
    }
    const badge = document.getElementById('sidebarBannerBadge');
    if (badge) {
        badge.textContent = count;
    }
}

// ============================================
// START BANNER SLIDESHOW
// ============================================
function startBannerSlideshow() {
    // Clear existing interval
    if (bannerInterval) {
        clearInterval(bannerInterval);
        bannerInterval = null;
    }
    
    const slideContainer = document.getElementById('bannerSlide');
    const prevBtn = document.getElementById('bannerPrevBtn');
    const nextBtn = document.getElementById('bannerNextBtn');
    const dotsContainer = document.getElementById('bannerDots');
    
    if (!bannerData || bannerData.length === 0) {
        slideContainer.innerHTML = `
            <div class="text-center" style="width:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:18px;">
                No banners uploaded yet
            </div>
        `;
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        dotsContainer.innerHTML = '';
        currentBannerIndex = 0;
        return;
    }
    
    // Show navigation buttons
    prevBtn.style.display = 'block';
    nextBtn.style.display = 'block';
    
    // Render dots
    let dotsHtml = '';
    for (let i = 0; i < bannerData.length; i++) {
        dotsHtml += `
            <span onclick="goToBannerSlide(${i})" 
                  style="width:10px;height:10px;border-radius:50%;background:${i === currentBannerIndex ? '#ffd700' : 'rgba(255,255,255,0.3)'};cursor:pointer;transition:all 0.3s ease;">
            </span>
        `;
    }
    dotsContainer.innerHTML = dotsHtml;
    
    // Render slide
    updateBannerSlide();
    
    // Start auto-slide
    bannerInterval = setInterval(() => {
        changeBannerSlide(1);
    }, 4000);
}

// ============================================
// UPDATE BANNER SLIDE
// ============================================
function updateBannerSlide() {
    const slideContainer = document.getElementById('bannerSlide');
    const dotsContainer = document.getElementById('bannerDots');
    
    if (!bannerData || bannerData.length === 0 || currentBannerIndex >= bannerData.length) {
        return;
    }
    
    const banner = bannerData[currentBannerIndex];
    
    slideContainer.innerHTML = `
        <div style="width:100%;height:100%;position:relative;">
            <img src="${banner.image}" style="width:100%;height:100%;object-fit:cover;">
            ${banner.title ? `
                <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));color:white;padding:20px;text-align:center;font-size:18px;font-weight:600;">
                    ${banner.title}
                    ${banner.link ? `<br><a href="${banner.link}" target="_blank" style="color:#ffd700;font-size:14px;text-decoration:none;">🔗 Visit Link</a>` : ''}
                </div>
            ` : ''}
        </div>
    `;
    
    // Update dots
    const dots = dotsContainer.querySelectorAll('span');
    dots.forEach((dot, index) => {
        dot.style.background = index === currentBannerIndex ? '#ffd700' : 'rgba(255,255,255,0.3)';
    });
}

// ============================================
// CHANGE BANNER SLIDE
// ============================================
function changeBannerSlide(direction) {
    if (!bannerData || bannerData.length === 0) return;
    
    currentBannerIndex = (currentBannerIndex + direction + bannerData.length) % bannerData.length;
    updateBannerSlide();
}

// ============================================
// GO TO BANNER SLIDE
// ============================================
function goToBannerSlide(index) {
    if (!bannerData || bannerData.length === 0 || index >= bannerData.length) return;
    
    currentBannerIndex = index;
    updateBannerSlide();
    
    // Reset interval
    if (bannerInterval) {
        clearInterval(bannerInterval);
        bannerInterval = setInterval(() => {
            changeBannerSlide(1);
        }, 4000);
    }
}

// ============================================
// DELETE BANNER
// ============================================
async function deleteBanner(bannerId) {
    if (!confirm('Are you sure you want to delete this banner?')) return;
    
    try {
        const data = await apiCall('/api/sidebar-banner/banner/' + bannerId, {
            method: 'DELETE'
        });
        
        if (data.success) {
            showToast('Banner deleted successfully!');
            loadBanners();
        } else {
            showToast('Failed to delete banner', true);
        }
    } catch (error) {
        showToast('Error deleting banner', true);
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
