// ============================================
// OPC.JS - Partner Coaching Centers + PDF Notes Module
// ============================================

// ❌ REMOVE THIS LINE - Already declared in index.html
// const API_BASE = window.location.origin + '/api';

let partnerCenters = [];

// ============================================
// FETCH PARTNER CENTERS FROM SERVER
// ============================================
async function fetchPartnerCenters() {
    try {
        const res = await fetch(`${API_BASE}/tuition-centers`);
        const result = await res.json();
        if (result.success && result.data && result.data.length > 0) {
            partnerCenters = result.data;
            renderPartnerCenters();
        } else {
            partnerCenters = [];
            renderPartnerCenters();
        }
    } catch (err) {
        console.error('❌ Partner centers fetch failed:', err);
        partnerCenters = [];
        renderPartnerCenters();
    }
}

// ============================================
// RENDER PARTNER CENTERS CARDS
// ============================================
function renderPartnerCenters() {
    const track = document.getElementById('partnerTrack');
    if (!track) return;

    if (!partnerCenters || partnerCenters.length === 0) {
        track.innerHTML = `
            <div class="partner-card" style="min-width:100%;max-width:100%;">
                <div style="padding:40px;text-align:center;color:rgba(255,255,255,0.3);">
                    <i class="fas fa-building" style="font-size:48px;display:block;margin-bottom:15px;"></i>
                    No partner coaching centers available
                </div>
            </div>
        `;
        return;
    }

    // Double items for infinite scroll effect
    const items = [...partnerCenters, ...partnerCenters];
    let html = '';

    for (let i = 0; i < items.length; i++) {
        const c = items[i];
        const initials = c.centerName ? c.centerName.split(' ').filter(w => w.length > 0).map(w => w[0]).join('').slice(0, 4).toUpperCase() : 'CC';
        
        const dirInitials = c.directorName ? c.directorName.split(' ').filter(w => w.length > 0).map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'D';
        const teacherCount = c.teachers ? c.teachers.length : 0;

        // Class display
        let classHtml = '';
        const classes = `${c.fromClass || 'N/A'} - ${c.toClass || 'N/A'}`;
        if (classes.length > 30) {
            classHtml = `
                <div class="center-classes">
                    ${classes.slice(0, 28)}<span class="more-classes" onclick="event.stopPropagation();openCenterDetails('${c._id}')">...see more</span>
                </div>
            `;
        } else {
            classHtml = `<div class="center-classes">${classes}</div>`;
        }

        // Social Media Icons - ONLY CENTER'S OWN SOCIAL LINKS
        let socialHtml = '';
        const socialLinks = [];

        // WhatsApp - Center's own WhatsApp number
        if (c.whatsappNumber && c.whatsappNumber.trim() !== '') {
            const cleanNumber = c.whatsappNumber.replace(/\D/g, '');
            socialLinks.push({ icon: 'fa-whatsapp', url: `https://wa.me/${cleanNumber}`, title: 'WhatsApp', color: '#25D366' });
        }
        // YouTube - Center's own YouTube
        if (c.youtubeLink && c.youtubeLink.trim() !== '' && c.youtubeLink.trim() !== '#') {
            socialLinks.push({ icon: 'fa-youtube', url: c.youtubeLink, title: 'YouTube', color: '#FF0000' });
        }
        // Facebook - Center's own Facebook
        if (c.facebookLink && c.facebookLink.trim() !== '' && c.facebookLink.trim() !== '#') {
            socialLinks.push({ icon: 'fa-facebook', url: c.facebookLink, title: 'Facebook', color: '#1877F2' });
        }
        // Instagram - Center's own Instagram
        if (c.instagramLink && c.instagramLink.trim() !== '' && c.instagramLink.trim() !== '#') {
            socialLinks.push({ icon: 'fa-instagram', url: c.instagramLink, title: 'Instagram', color: '#E4405F' });
        }
        // Telegram - Center's own Telegram
        if (c.telegramLink && c.telegramLink.trim() !== '' && c.telegramLink.trim() !== '#') {
            socialLinks.push({ icon: 'fa-telegram', url: c.telegramLink, title: 'Telegram', color: '#0088cc' });
        }
        // Twitter - Center's own Twitter
        if (c.twitterLink && c.twitterLink.trim() !== '' && c.twitterLink.trim() !== '#') {
            socialLinks.push({ icon: 'fa-twitter', url: c.twitterLink, title: 'Twitter', color: '#1DA1F2' });
        }
        // LinkedIn - Center's own LinkedIn
        if (c.linkedinLink && c.linkedinLink.trim() !== '' && c.linkedinLink.trim() !== '#') {
            socialLinks.push({ icon: 'fa-linkedin', url: c.linkedinLink, title: 'LinkedIn', color: '#0A66C2' });
        }
        // Encrypted Call - Center's own encrypted call link
        if (c.encryptedCallLink && c.encryptedCallLink.trim() !== '' && c.encryptedCallLink.trim() !== '#') {
            socialLinks.push({ icon: 'fa-lock', url: c.encryptedCallLink, title: 'Encrypted Call', color: '#16a34a', isEncrypted: true });
        }

        for (const link of socialLinks) {
            const isEncrypted = link.isEncrypted || false;
            socialHtml += `
                <a href="${link.url}" target="_blank" title="${link.title}" 
                   style="${isEncrypted ? 'background:rgba(37,99,235,0.1);border-color:rgba(37,99,235,0.2);color:#2563eb;' : ''}">
                    <i class="fab ${link.icon}" style="${!isEncrypted ? `color:${link.color}` : ''}"></i>
                </a>
            `;
        }

        // Teachers display
        let teachersHtml = '';
        if (c.teachers && c.teachers.length > 0) {
            const displayTeachers = c.teachers.slice(0, 5);
            for (const teacher of displayTeachers) {
                const tInitials = teacher.name ? teacher.name.split(' ').filter(w => w.length > 0).map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'T';
                teachersHtml += `
                    <div class="teacher-tag">
                        <div class="tag-avatar">
                            ${teacher.photo && teacher.photo.length > 50 ? 
                                `<img src="${teacher.photo}" alt="${teacher.name}">` : 
                                `<span>${tInitials}</span>`
                            }
                        </div>
                        <div class="tag-info">
                            <span class="tag-name">${teacher.name || 'Teacher'}</span>
                            <span class="tag-subject">${teacher.subject || ''} ${teacher.class ? '• ' + teacher.class : ''}</span>
                        </div>
                    </div>
                `;
            }
            if (c.teachers.length > 5) {
                teachersHtml += `<span style="font-size:12px;color:rgba(255,255,255,0.2);padding:6px 12px;">+${c.teachers.length - 5} more</span>`;
            }
        } else {
            teachersHtml = `<span class="no-teachers">No teachers listed</span>`;
        }

        // Director contact
        let directorContactHtml = '';
        if (c.encryptedCallLink && c.encryptedCallLink.trim() !== '' && c.encryptedCallLink.trim() !== '#') {
            directorContactHtml = `
                <a href="${c.encryptedCallLink}" target="_blank" class="encrypted-call-btn">
                    <i class="fas fa-lock"></i> Encrypted Call
                </a>
            `;
        } else if (c.contactNumber && c.contactNumber.trim() !== '') {
            directorContactHtml = `
                <div class="director-contact"><i class="fas fa-phone"></i> ${c.contactNumber}</div>
            `;
        }

        html += `
            <div class="partner-card" data-center-id="${c._id}">
                <div class="partner-card-header" onclick="openCenterDetails('${c._id}')" style="cursor:pointer;">
                    <div class="center-logo">
                        ${c.clogo && c.clogo.length > 50 ? 
                            `<img src="${c.clogo}" alt="${c.centerName}">` : 
                            `<span>${initials}</span>`
                        }
                    </div>
                    <div class="center-info">
                        <div class="center-name">${c.centerName || 'Unknown Center'}</div>
                        ${classHtml}
                        ${c.address ? `<div class="center-address">📍 ${c.address}</div>` : ''}
                    </div>
                </div>

                <div class="director-section" onclick="openCenterDetails('${c._id}')" style="cursor:pointer;">
                    <div class="director-avatar">
                        ${c.directorPhoto && c.directorPhoto.length > 50 ? 
                            `<img src="${c.directorPhoto}" alt="${c.directorName || 'Director'}">` : 
                            `<span>${dirInitials}</span>`
                        }
                    </div>
                    <div class="director-details">
                        <div class="director-label">👤 Director</div>
                        <div class="director-name">${c.directorName || 'Not specified'}</div>
                        ${directorContactHtml}
                    </div>
                </div>

                <div class="teachers-list">
                    <div class="teachers-label">
                        <i class="fas fa-chalkboard-teacher"></i>
                        Teachers (${teacherCount})
                    </div>
                    <div class="teacher-tags">
                        ${teachersHtml}
                    </div>
                </div>

                ${socialHtml ? `<div class="card-social">${socialHtml}</div>` : ''}
                
                <div style="padding: 0 25px 15px; text-align:center;">
                    <button onclick="openCenterDetails('${c._id}')" class="view-details-btn">
                        📋 View Full Details
                    </button>
                </div>
            </div>
        `;
    }

    track.innerHTML = html;
    track.style.animation = 'scrollPartners 40s linear infinite';
    
    // Setup manual drag events
    setupDragEvents(track);
}

// ============================================
// DRAG EVENTS FOR PARTNER CARDS (Manual Scroll)
// ============================================
function setupDragEvents(track) {
    let isDown = false;
    let startX = 0;
    let currentTranslate = 0;
    let prevTranslate = 0;
    let animationID = 0;
    let initialTransform = 0;

    // Get initial transform value
    function getInitialTransform() {
        const style = window.getComputedStyle(track);
        const transform = style.transform;
        if (transform && transform !== 'none') {
            const matrix = transform.match(/matrix.*\((.+)\)/);
            if (matrix) {
                const values = matrix[1].split(', ');
                return parseFloat(values[4]) || 0;
            }
        }
        return 0;
    }

    // Update transform
    function setTranslate(x, animate = false) {
        if (animate) {
            track.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        } else {
            track.style.transition = 'none';
        }
        track.style.transform = `translateX(${x}px)`;
    }

    // Get current transform X
    function getCurrentTranslate() {
        const style = window.getComputedStyle(track);
        const transform = style.transform;
        if (transform && transform !== 'none') {
            const matrix = transform.match(/matrix.*\((.+)\)/);
            if (matrix) {
                const values = matrix[1].split(', ');
                return parseFloat(values[4]) || 0;
            }
        }
        return 0;
    }

    // Mouse events
    track.addEventListener('mousedown', (e) => {
        isDown = true;
        track.style.animationPlayState = 'paused';
        track.style.transition = 'none';
        startX = e.pageX;
        prevTranslate = getCurrentTranslate();
        track.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const currentX = e.pageX;
        const diff = currentX - startX;
        currentTranslate = prevTranslate + diff;
        
        // Get card width + gap for boundary
        const cardWidth = track.querySelector('.partner-card')?.offsetWidth || 320;
        const gap = 25;
        const totalWidth = (cardWidth + gap);
        const trackWidth = track.scrollWidth || (partnerCenters.length * totalWidth);
        const containerWidth = track.parentElement.offsetWidth;
        
        // Allow dragging both directions with limit
        const maxTranslate = 0;
        const minTranslate = -(trackWidth - containerWidth);
        
        if (currentTranslate > maxTranslate) {
            currentTranslate = maxTranslate;
        } else if (currentTranslate < minTranslate) {
            currentTranslate = minTranslate;
        }
        
        setTranslate(currentTranslate, false);
    });

    window.addEventListener('mouseup', () => {
        if (isDown) {
            isDown = false;
            track.style.cursor = 'grab';
            track.style.animationPlayState = 'running';
            
            // Smooth snap - if dragged significantly, keep position
            // Otherwise resume auto-scroll
            const current = getCurrentTranslate();
            const cardWidth = track.querySelector('.partner-card')?.offsetWidth || 320;
            const gap = 25;
            const totalWidth = (cardWidth + gap);
            
            // Check if near edge
            const trackWidth = track.scrollWidth || (partnerCenters.length * totalWidth);
            const containerWidth = track.parentElement.offsetWidth;
            const minTranslate = -(trackWidth - containerWidth);
            
            if (current > -50) {
                setTranslate(0, true);
            } else if (current < minTranslate + 50) {
                setTranslate(minTranslate, true);
            } else {
                // Resume auto-scroll from current position
                track.style.animationPlayState = 'running';
            }
        }
    });

    // Touch events
    let touchStartX = 0;
    let touchPrevTranslate = 0;

    track.addEventListener('touchstart', (e) => {
        isDown = true;
        track.style.animationPlayState = 'paused';
        touchStartX = e.touches[0].pageX;
        touchPrevTranslate = getCurrentTranslate();
        track.style.transition = 'none';
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        const currentX = e.touches[0].pageX;
        const diff = currentX - touchStartX;
        currentTranslate = touchPrevTranslate + diff;
        
        const cardWidth = track.querySelector('.partner-card')?.offsetWidth || 320;
        const gap = 25;
        const totalWidth = (cardWidth + gap);
        const trackWidth = track.scrollWidth || (partnerCenters.length * totalWidth);
        const containerWidth = track.parentElement.offsetWidth;
        
        const maxTranslate = 0;
        const minTranslate = -(trackWidth - containerWidth);
        
        if (currentTranslate > maxTranslate) {
            currentTranslate = maxTranslate;
        } else if (currentTranslate < minTranslate) {
            currentTranslate = minTranslate;
        }
        
        setTranslate(currentTranslate, false);
    }, { passive: true });

    track.addEventListener('touchend', () => {
        isDown = false;
        track.style.animationPlayState = 'running';
        
        const current = getCurrentTranslate();
        const cardWidth = track.querySelector('.partner-card')?.offsetWidth || 320;
        const gap = 25;
        const totalWidth = (cardWidth + gap);
        const trackWidth = track.scrollWidth || (partnerCenters.length * totalWidth);
        const containerWidth = track.parentElement.offsetWidth;
        const minTranslate = -(trackWidth - containerWidth);
        
        if (current > -50) {
            setTranslate(0, true);
        } else if (current < minTranslate + 50) {
            setTranslate(minTranslate, true);
        } else {
            track.style.animationPlayState = 'running';
        }
    }, { passive: true });

    // Prevent context menu on drag
    track.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ============================================
// OPEN CENTER DETAILS POPUP
// ============================================
function openCenterDetails(centerId) {
    // Find center data
    const center = partnerCenters.find(c => c._id === centerId);
    if (!center) {
        showToast('Center not found', true);
        return;
    }

    // Build social links HTML for popup
    let socialPopupHtml = '';
    const socialLinks = [];

    if (center.whatsappNumber && center.whatsappNumber.trim() !== '') {
        const cleanNumber = center.whatsappNumber.replace(/\D/g, '');
        socialLinks.push({ icon: 'fa-whatsapp', url: `https://wa.me/${cleanNumber}`, title: 'WhatsApp', color: '#25D366' });
    }
    if (center.youtubeLink && center.youtubeLink.trim() !== '' && center.youtubeLink.trim() !== '#') {
        socialLinks.push({ icon: 'fa-youtube', url: center.youtubeLink, title: 'YouTube', color: '#FF0000' });
    }
    if (center.facebookLink && center.facebookLink.trim() !== '' && center.facebookLink.trim() !== '#') {
        socialLinks.push({ icon: 'fa-facebook', url: center.facebookLink, title: 'Facebook', color: '#1877F2' });
    }
    if (center.instagramLink && center.instagramLink.trim() !== '' && center.instagramLink.trim() !== '#') {
        socialLinks.push({ icon: 'fa-instagram', url: center.instagramLink, title: 'Instagram', color: '#E4405F' });
    }
    if (center.telegramLink && center.telegramLink.trim() !== '' && center.telegramLink.trim() !== '#') {
        socialLinks.push({ icon: 'fa-telegram', url: center.telegramLink, title: 'Telegram', color: '#0088cc' });
    }
    if (center.twitterLink && center.twitterLink.trim() !== '' && center.twitterLink.trim() !== '#') {
        socialLinks.push({ icon: 'fa-twitter', url: center.twitterLink, title: 'Twitter', color: '#1DA1F2' });
    }
    if (center.linkedinLink && center.linkedinLink.trim() !== '' && center.linkedinLink.trim() !== '#') {
        socialLinks.push({ icon: 'fa-linkedin', url: center.linkedinLink, title: 'LinkedIn', color: '#0A66C2' });
    }
    if (center.encryptedCallLink && center.encryptedCallLink.trim() !== '' && center.encryptedCallLink.trim() !== '#') {
        socialLinks.push({ icon: 'fa-lock', url: center.encryptedCallLink, title: 'Encrypted Call', color: '#16a34a' });
    }

    for (const link of socialLinks) {
        socialPopupHtml += `
            <a href="${link.url}" target="_blank" class="popup-social-link" style="background:${link.color}20;border-color:${link.color}40;color:${link.color};">
                <i class="fab ${link.icon}"></i> ${link.title}
            </a>
        `;
    }

    // Teachers HTML for popup
    let teachersPopupHtml = '';
    if (center.teachers && center.teachers.length > 0) {
        for (const teacher of center.teachers) {
            teachersPopupHtml += `
                <div class="popup-teacher-item">
                    <div class="popup-teacher-avatar">
                        ${teacher.photo && teacher.photo.length > 50 ? 
                            `<img src="${teacher.photo}" alt="${teacher.name}">` : 
                            `<span>${teacher.name ? teacher.name.charAt(0).toUpperCase() : 'T'}</span>`
                        }
                    </div>
                    <div class="popup-teacher-info">
                        <div class="popup-teacher-name">${teacher.name || 'Teacher'}</div>
                        <div class="popup-teacher-detail">📚 ${teacher.subject || 'N/A'}</div>
                        <div class="popup-teacher-detail">🎯 ${teacher.class || 'N/A'}</div>
                    </div>
                </div>
            `;
        }
    } else {
        teachersPopupHtml = `<p style="color:rgba(255,255,255,0.3);text-align:center;">No teachers listed</p>`;
    }

    // Create popup modal
    const modal = document.createElement('div');
    modal.className = 'center-details-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.92);
        backdrop-filter: blur(20px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: modalFadeIn 0.4s ease;
    `;

    modal.innerHTML = `
        <div class="center-details-content" style="
            background: rgba(255,255,255,0.03);
            border-radius: 24px;
            max-width: 700px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            padding: 30px;
            border: 1px solid rgba(255,255,255,0.05);
            position: relative;
            box-shadow: 0 30px 80px rgba(0,0,0,0.5);
        ">
            <button onclick="this.closest('.center-details-modal').remove()" style="
                position: sticky;
                top: 0;
                float: right;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 1px solid rgba(255,255,255,0.1);
                background: rgba(255,255,255,0.05);
                color: #fff;
                font-size: 20px;
                cursor: pointer;
                transition: all 0.3s ease;
                z-index: 10;
                margin-bottom: 10px;
            " onmouseover="this.style.background='rgba(255,0,0,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                ✕
            </button>

            <div style="display:flex;align-items:center;gap:20px;margin-bottom:20px;">
                <div style="
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 3px solid rgba(255,215,0,0.2);
                    background: #1a1f35;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                    color: #ffd700;
                    flex-shrink: 0;
                ">
                    ${center.clogo && center.clogo.length > 50 ? 
                        `<img src="${center.clogo}" alt="${center.centerName}" style="width:100%;height:100%;object-fit:cover;">` : 
                        `<span>${center.centerName ? center.centerName.charAt(0).toUpperCase() : 'C'}</span>`
                    }
                </div>
                <div>
                    <h2 style="font-size:24px;font-weight:700;color:#fff;">${center.centerName || 'Unknown Center'}</h2>
                    <p style="color:rgba(255,215,0,0.5);font-size:14px;">${center.fromClass || 'N/A'} - ${center.toClass || 'N/A'}</p>
                    ${center.address ? `<p style="color:rgba(255,255,255,0.3);font-size:13px;margin-top:4px;">📍 ${center.address}</p>` : ''}
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;padding:15px;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid rgba(255,255,255,0.03);">
                ${center.email ? `<div><span style="color:rgba(255,255,255,0.3);font-size:11px;">📧 Email</span><p style="color:#fff;font-size:14px;">${center.email}</p></div>` : ''}
                ${center.contactNumber ? `<div><span style="color:rgba(255,255,255,0.3);font-size:11px;">📞 Contact</span><p style="color:#fff;font-size:14px;">${center.contactNumber}</p></div>` : ''}
                ${center.whatsappNumber ? `<div><span style="color:rgba(255,255,255,0.3);font-size:11px;">💬 WhatsApp</span><p style="color:#fff;font-size:14px;">${center.whatsappNumber}</p></div>` : ''}
                ${center.directorName ? `<div><span style="color:rgba(255,255,255,0.3);font-size:11px;">👤 Director</span><p style="color:#fff;font-size:14px;">${center.directorName}</p></div>` : ''}
            </div>

            ${center.description ? `
                <div style="margin-bottom:20px;padding:15px;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid rgba(255,255,255,0.03);">
                    <span style="color:rgba(255,255,255,0.3);font-size:11px;">📝 Description</span>
                    <p style="color:rgba(255,255,255,0.7);font-size:14px;margin-top:4px;">${center.description}</p>
                </div>
            ` : ''}

            ${socialPopupHtml ? `
                <div style="margin-bottom:20px;">
                    <span style="color:rgba(255,255,255,0.3);font-size:11px;display:block;margin-bottom:10px;">🔗 Social Media Links</span>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;">
                        ${socialPopupHtml}
                    </div>
                </div>
            ` : ''}

            <div style="margin-bottom:10px;">
                <span style="color:rgba(255,255,255,0.3);font-size:11px;display:block;margin-bottom:10px;">👨‍🏫 Teachers (${center.teachers ? center.teachers.length : 0})</span>
                <div style="display:grid;gap:10px;">
                    ${teachersPopupHtml}
                </div>
            </div>

            <div style="text-align:center;margin-top:15px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.03);">
                <button onclick="this.closest('.center-details-modal').remove()" style="
                    padding:10px 30px;
                    background:rgba(255,215,0,0.1);
                    border:1px solid rgba(255,215,0,0.2);
                    border-radius:25px;
                    color:#ffd700;
                    font-size:14px;
                    cursor:pointer;
                    transition:all 0.3s ease;
                " onmouseover="this.style.background='rgba(255,215,0,0.2)'" onmouseout="this.style.background='rgba(255,215,0,0.1)'">
                    ✕ Close
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on outside click
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.remove();
        }
    });

    // Close on Escape key
    const escHandler = function(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// ============================================
// FETCH PDF NOTES FROM SERVER
// ============================================
async function fetchPDFNotes() {
    try {
        const res = await fetch(`${API_BASE}/study-material`);
        const result = await res.json();
        if (result.success && result.data && result.data.notes && result.data.notes.length > 0) {
            renderPDFNotes(result.data.notes);
        } else {
            renderPDFNotes([]);
        }
    } catch (err) {
        console.error('❌ PDF Notes fetch failed:', err);
        renderPDFNotes([]);
    }
}

// ============================================
// RENDER PDF NOTES
// ============================================
function renderPDFNotes(notes) {
    const container = document.getElementById('pdfNotesContainer');
    if (!container) return;

    if (!notes || notes.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:40px; color:rgba(255,255,255,0.3);">
                <i class="fas fa-file-pdf" style="font-size:48px; display:block; margin-bottom:15px; color:rgba(255,255,255,0.1);"></i>
                No PDF notes available
            </div>
        `;
        return;
    }

    let html = '';
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        html += `
            <div class="note-card">
                <a href="${note.pdf}" download="${note.title || 'note'}.pdf" target="_blank">
                    <i class="fas fa-file-pdf"></i>
                    <h3>${note.title || 'Untitled'}</h3>
                    ${note.description ? `<p>${note.description}</p>` : ''}
                    <span class="download-btn">📥 Download PDF</span>
                    <div style="font-size:11px; color:rgba(255,255,255,0.2); margin-top:8px;">
                        ${note.createdAt ? new Date(note.createdAt).toLocaleDateString() : ''}
                    </div>
                </a>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ============================================
// TOAST NOTIFICATION
// ============================================
function showToast(message, isError = false) {
    const existing = document.querySelector('.custom-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'custom-toast';
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
        z-index: 99999;
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
// AUTO INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const partnerSection = document.getElementById('partnerSection');
    if (partnerSection) {
        fetchPartnerCenters();
    }
    
    const pdfSection = document.getElementById('pdfNotesSection');
    if (pdfSection) {
        fetchPDFNotes();
    }
});
