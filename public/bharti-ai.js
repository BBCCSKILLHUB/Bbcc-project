// ============================================================
// 🎙️ BHARTI (भारती) - UNIVERSAL AI VOICE & CHAT ASSISTANT
// BBCC SKILL HUB - FOR VISITOR, SUPER ADMIN & COACHING DIRECTORS
// ============================================================

(function () {
    // Detect context role
    const path = window.location.pathname;
    let currentRole = 'visitor';
    let roleLabel = 'BBCC Skill Hub Academic Assistant';

    if (path.includes('management')) {
        currentRole = 'super_admin';
        roleLabel = 'Executive Board Copilot';
    } else if (path.includes('coaching-dashboard')) {
        currentRole = 'coaching_director';
        roleLabel = 'Partner Coaching Assistant';
    }

    // State
    let isSpeaking = false;
    let isListening = false;
    let voiceEnabled = true;
    let recognition = null;
    let chatHistory = [];

    // Initialize Web Speech Recognition if available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'hi-IN'; // Supports Hindi / Hinglish and English

        recognition.onstart = function () {
            isListening = true;
            updateMicButtonUI(true);
        };

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript;
            const input = document.getElementById('bhartiInput');
            if (input) {
                input.value = transcript;
                sendMessageToBharti(transcript);
            }
        };

        recognition.onerror = function (e) {
            console.warn('BHARTI Speech Recognition Error:', e.error);
            isListening = false;
            updateMicButtonUI(false);
        };

        recognition.onend = function () {
            isListening = false;
            updateMicButtonUI(false);
        };
    }

    // Inject CSS
    const style = document.createElement('style');
    style.id = 'bharti-ai-styles';
    style.textContent = `
        /* ===== BHARTI FLOATING TRIGGER ===== */
        .bharti-trigger {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 99998;
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            user-select: none;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .bharti-trigger:hover {
            transform: scale(1.05);
        }

        .bharti-badge-pill {
            background: linear-gradient(135deg, #0b0e1a 0%, #1e293b 100%);
            border: 1px solid rgba(255, 215, 0, 0.35);
            padding: 8px 16px;
            border-radius: 30px;
            color: #ffd700;
            font-size: 13px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            white-space: nowrap;
        }

        .bharti-avatar-btn {
            width: 58px;
            height: 58px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ffd700 0%, #d97706 100%);
            border: 3px solid #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            color: #0b0e1a;
            box-shadow: 0 10px 30px rgba(217, 119, 6, 0.45);
            position: relative;
            transition: all 0.3s ease;
        }

        .bharti-pulse-wave {
            position: absolute;
            inset: -6px;
            border-radius: 50%;
            border: 2px solid #ffd700;
            animation: bhartiPulse 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
            pointer-events: none;
        }

        @keyframes bhartiPulse {
            0% { transform: scale(1); opacity: 0.9; }
            100% { transform: scale(1.35); opacity: 0; }
        }

        /* ===== BHARTI CHAT WINDOW ===== */
        .bharti-modal {
            position: fixed;
            bottom: 95px;
            right: 30px;
            width: 380px;
            max-width: calc(100vw - 40px);
            height: 540px;
            max-height: calc(100vh - 120px);
            background: #0f172a;
            border: 1px solid rgba(255, 215, 0, 0.25);
            border-radius: 20px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
            z-index: 99999;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .bharti-modal.active {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: all;
        }

        .bharti-header {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 215, 0, 0.2);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .bharti-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .bharti-hdr-avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ffd700, #f59e0b);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 800;
            color: #0b0e1a;
        }

        .bharti-hdr-title {
            color: #ffffff;
            font-weight: 700;
            font-size: 15px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .bharti-hdr-subtitle {
            font-size: 11px;
            color: #94a3b8;
        }

        .bharti-header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .bharti-btn-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.05);
            color: #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
        }

        .bharti-btn-icon:hover {
            background: rgba(255, 215, 0, 0.15);
            color: #ffd700;
        }

        .bharti-btn-icon.active-sound {
            color: #ffd700;
            border-color: rgba(255, 215, 0, 0.4);
        }

        /* Messages */
        .bharti-messages {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .bharti-messages::-webkit-scrollbar {
            width: 5px;
        }
        .bharti-messages::-webkit-scrollbar-thumb {
            background: #334155;
            border-radius: 10px;
        }

        .bharti-msg {
            max-width: 85%;
            padding: 10px 14px;
            border-radius: 14px;
            font-size: 13px;
            line-height: 1.45;
            word-wrap: break-word;
            animation: bhartiFadeIn 0.3s ease;
        }

        @keyframes bhartiFadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .bharti-msg.assistant {
            align-self: flex-start;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 215, 0, 0.15);
            color: #f1f5f9;
            border-bottom-left-radius: 4px;
        }

        .bharti-msg.user {
            align-self: flex-end;
            background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%);
            color: #0b0e1a;
            font-weight: 600;
            border-bottom-right-radius: 4px;
        }

        /* Quick Pills */
        .bharti-quick-pills {
            padding: 8px 14px;
            display: flex;
            gap: 8px;
            overflow-x: auto;
            white-space: nowrap;
            background: rgba(0, 0, 0, 0.15);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .bharti-quick-pills::-webkit-scrollbar {
            height: 3px;
        }

        .bharti-pill {
            background: rgba(255, 215, 0, 0.1);
            border: 1px solid rgba(255, 215, 0, 0.2);
            color: #ffd700;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
        }

        .bharti-pill:hover {
            background: #ffd700;
            color: #0b0e1a;
        }

        /* Input Bar */
        .bharti-input-bar {
            padding: 12px 16px;
            background: #1e293b;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .bharti-input {
            flex: 1;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            padding: 10px 14px;
            color: #ffffff;
            font-size: 13px;
            outline: none;
            transition: border-color 0.2s ease;
        }

        .bharti-input:focus {
            border-color: #ffd700;
        }

        .bharti-mic-btn {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            border: none;
            background: rgba(255, 255, 255, 0.08);
            color: #ffd700;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s ease;
            position: relative;
        }

        .bharti-mic-btn.listening {
            background: #ef4444;
            color: #ffffff;
            animation: micPulse 1.2s infinite;
        }

        @keyframes micPulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .bharti-send-btn {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            border: none;
            background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%);
            color: #0b0e1a;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 15px;
            font-weight: 700;
            transition: all 0.2s ease;
        }

        .bharti-send-btn:hover {
            transform: scale(1.05);
        }

        @media (max-width: 600px) {
            .bharti-badge-pill { display: none; }
            .bharti-modal {
                right: 15px;
                bottom: 85px;
                width: calc(100vw - 30px);
                height: 480px;
            }
        }
    `;
    document.head.appendChild(style);

    // Create DOM structure
    function buildBhartiDOM() {
        const trigger = document.createElement('div');
        trigger.className = 'bharti-trigger';
        trigger.id = 'bhartiTrigger';
        trigger.onclick = toggleBhartiModal;

        trigger.innerHTML = `
            <div class="bharti-badge-pill">
                <span>🎙️ Ask BHARTI</span>
            </div>
            <div class="bharti-avatar-btn">
                <span>🌸</span>
                <div class="bharti-pulse-wave"></div>
            </div>
        `;
        document.body.appendChild(trigger);

        const modal = document.createElement('div');
        modal.className = 'bharti-modal';
        modal.id = 'bhartiModal';

        // Choose role-based suggestions
        let quickPills = '';
        if (currentRole === 'super_admin') {
            quickPills = `
                <div class="bharti-pill" onclick="sendBhartiPreset('Coaching Centers dikhao')">🏫 Coaching Centers</div>
                <div class="bharti-pill" onclick="sendBhartiPreset('Pending payments status')">🔔 Payments Queue</div>
                <div class="bharti-pill" onclick="sendBhartiPreset('Total enrolled students')">👨‍🎓 Total Students</div>
                <div class="bharti-pill" onclick="sendBhartiPreset('Study material password kaise lagaye?')">📚 Study Materials</div>
            `;
        } else if (currentRole === 'coaching_director') {
            quickPills = `
                <div class="bharti-pill" onclick="sendBhartiPreset('Central study materials kaise dekhe?')">📚 Central Materials</div>
                <div class="bharti-pill" onclick="sendBhartiPreset('Naya student kaise add kare?')">➕ Student Admission</div>
                <div class="bharti-pill" onclick="sendBhartiPreset('Gallery photo kaise upload kare?')">📸 Upload Gallery</div>
                <div class="bharti-pill" onclick="sendBhartiPreset('Center dues payment kaise kare?')">💳 Clear Dues</div>
            `;
        } else {
            quickPills = `
                <div class="bharti-pill" onclick="sendBhartiPreset('BBCC Skill Hub kya hai?')">🏛️ About BBCC</div>
                <div class="bharti-pill" onclick="sendBhartiPreset('Affiliated coaching centers kaunse hain?')">🏫 Find Centers</div>
                <div class="bharti-pill" onclick="sendBhartiPreset('Digital notes & study material kaise milega?')">📖 Study Materials</div>
                <div class="bharti-pill" onclick="sendBhartiPreset('Admissions kaise hoti hai?')">🎓 Admissions</div>
            `;
        }

        modal.innerHTML = `
            <div class="bharti-header">
                <div class="bharti-header-left">
                    <div class="bharti-hdr-avatar">🌸</div>
                    <div>
                        <div class="bharti-hdr-title">BHARTI AI <span style="font-size:10px;background:#ffd700;color:#0b0e1a;padding:2px 6px;border-radius:10px;font-weight:800;">LIVE</span></div>
                        <div class="bharti-hdr-subtitle">${roleLabel}</div>
                    </div>
                </div>
                <div class="bharti-header-actions">
                    <button class="bharti-btn-icon active-sound" id="bhartiSoundToggle" onclick="toggleBhartiVoice()" title="Toggle Voice Speech">
                        <i class="fas fa-volume-up"></i>
                    </button>
                    <button class="bharti-btn-icon" onclick="toggleBhartiModal()" title="Close Assistant">
                        ✕
                    </button>
                </div>
            </div>

            <div class="bharti-messages" id="bhartiMessages">
                <div class="bharti-msg assistant">
                    Namaste! Main <strong>BHARTI</strong> hoon, BBCC Skill Hub ki AI Voice Assistant. Aap mujhse bol kar ya likh kar koi bhi sawal pooch sakte hain! 🙏
                </div>
            </div>

            <div class="bharti-quick-pills">
                ${quickPills}
            </div>

            <div class="bharti-input-bar">
                <input type="text" class="bharti-input" id="bhartiInput" placeholder="Boliye ya type karein..." onkeydown="handleBhartiKey(event)">
                <button class="bharti-mic-btn" id="bhartiMicBtn" onclick="toggleBhartiMic()" title="Mic se bole">
                    <i class="fas fa-microphone"></i>
                </button>
                <button class="bharti-send-btn" onclick="submitBhartiChat()" title="Send">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Toggle Modal
    window.toggleBhartiModal = function () {
        const modal = document.getElementById('bhartiModal');
        if (!modal) return;
        const isActive = modal.classList.contains('active');
        if (isActive) {
            modal.classList.remove('active');
            stopSpeech();
            if (recognition && isListening) recognition.stop();
        } else {
            modal.classList.add('active');
            const input = document.getElementById('bhartiInput');
            if (input) setTimeout(() => input.focus(), 200);
        }
    };

    // Voice Output Toggle
    window.toggleBhartiVoice = function () {
        voiceEnabled = !voiceEnabled;
        const btn = document.getElementById('bhartiSoundToggle');
        if (btn) {
            if (voiceEnabled) {
                btn.classList.add('active-sound');
                btn.innerHTML = '<i class="fas fa-volume-up"></i>';
            } else {
                btn.classList.remove('active-sound');
                btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
                stopSpeech();
            }
        }
    };

    // Speech Synthesis
    function speakText(text) {
        if (!voiceEnabled || !window.speechSynthesis) return;
        stopSpeech();

        // Clean formatting symbols
        const clean = text.replace(/[*_#`]/g, '').replace(/https?:\/\/\S+/g, '');
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;

        // Try Hindi / Indian English voices
        const voices = window.speechSynthesis.getVoices();
        const inVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('IN') || v.name.includes('India'));
        if (inVoice) utterance.voice = inVoice;

        utterance.onstart = function () { isSpeaking = true; };
        utterance.onend = function () { isSpeaking = false; };
        utterance.onerror = function () { isSpeaking = false; };

        window.speechSynthesis.speak(utterance);
    }

    function stopSpeech() {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            isSpeaking = false;
        }
    }

    // Mic Toggle
    window.toggleBhartiMic = function () {
        if (!recognition) {
            alert('Voice recognition is not supported in this browser. Please use Google Chrome or Edge.');
            return;
        }
        if (isListening) {
            recognition.stop();
        } else {
            stopSpeech();
            try {
                recognition.start();
            } catch (e) {
                console.warn(e);
            }
        }
    };

    function updateMicButtonUI(listening) {
        const btn = document.getElementById('bhartiMicBtn');
        if (!btn) return;
        if (listening) {
            btn.classList.add('listening');
            btn.innerHTML = '<i class="fas fa-stop"></i>';
        } else {
            btn.classList.remove('listening');
            btn.innerHTML = '<i class="fas fa-microphone"></i>';
        }
    }

    // Quick Pill Presets
    window.sendBhartiPreset = function (text) {
        sendMessageToBharti(text);
    };

    window.handleBhartiKey = function (event) {
        if (event.key === 'Enter') {
            submitBhartiChat();
        }
    };

    window.submitBhartiChat = function () {
        const input = document.getElementById('bhartiInput');
        if (!input) return;
        const msg = input.value.trim();
        if (!msg) return;
        input.value = '';
        sendMessageToBharti(msg);
    };

    // Send Message
    async function sendMessageToBharti(message) {
        const messagesContainer = document.getElementById('bhartiMessages');
        if (!messagesContainer) return;

        // Append user message
        const userDiv = document.createElement('div');
        userDiv.className = 'bharti-msg user';
        userDiv.textContent = message;
        messagesContainer.appendChild(userDiv);

        // Typing indicator
        const typingDiv = document.createElement('div');
        typingDiv.className = 'bharti-msg assistant';
        typingDiv.id = 'bhartiTypingBubble';
        typingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> BHARTI is thinking...';
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/ai/bharti', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    message: message,
                    role: currentRole,
                    history: chatHistory.slice(-6)
                })
            });

            const data = await res.json();
            typingDiv.remove();

            if (data.success && data.reply) {
                const aiDiv = document.createElement('div');
                aiDiv.className = 'bharti-msg assistant';
                aiDiv.innerHTML = data.reply.replace(/\n/g, '<br>');
                messagesContainer.appendChild(aiDiv);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                chatHistory.push({ role: 'user', content: message });
                chatHistory.push({ role: 'assistant', content: data.reply });

                // Speak reply
                speakText(data.audioText || data.reply);

                // Handle automated UI action if present
                if (data.action && data.action.type === 'navigate') {
                    executeAutomatedAction(data.action);
                }
            } else {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'bharti-msg assistant';
                errorDiv.textContent = data.message || 'Kshama karein, ek technical problem aayi.';
                messagesContainer.appendChild(errorDiv);
            }
        } catch (err) {
            typingDiv.remove();
            const errorDiv = document.createElement('div');
            errorDiv.className = 'bharti-msg assistant';
            errorDiv.textContent = 'Server se connection nahi ho paya. Kripya punah prayas karein.';
            messagesContainer.appendChild(errorDiv);
        }

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Automated UI action handler
    function executeAutomatedAction(action) {
        if (action.tab) {
            // Check if on Super Admin dashboard
            const tabBtn = document.querySelector(`.tab-btn[data-tab="${action.tab}"], .sidebar-nav-item[data-tab="${action.tab}"]`);
            if (tabBtn) {
                setTimeout(() => tabBtn.click(), 500);
            }
            // Check if on coaching dashboard
            const coachBtn = document.querySelector(`.c-nav-item[data-tab="${action.tab}"]`);
            if (coachBtn) {
                setTimeout(() => coachBtn.click(), 500);
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildBhartiDOM);
    } else {
        buildBhartiDOM();
    }
})();
