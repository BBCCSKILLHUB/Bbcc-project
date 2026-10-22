/**
 * BBCC SKILL HUB — "BHARTI" AI ASSISTANT WIDGET
 * Human-like AI Counselor powered by Google Gemini
 * Fully controlled via Admin Console (Bharti AI Manager)
 */

(function () {
    // Detect Role (visitor | coaching | student | teacher)
    const currentScript = document.currentScript;
    const scriptRole = currentScript ? currentScript.getAttribute('data-role') : null;
    const userRole = window.BHARTI_ROLE || scriptRole || 'visitor';
    const roleKey = (userRole === 'coaching' || userRole === 'director') ? 'coaching' : 
                    (userRole === 'student' ? 'students' : 
                    (userRole === 'teacher' ? 'teachers' : 'visitors'));

    let conversationHistory = [];
    let bhartiConfig = null;

    // Fetch live config from server
    fetch('/api/public/bharti-config')
        .then(res => res.json())
        .then(data => {
            if (!data.success || !data.config) return;
            bhartiConfig = data.config;

            // Check if globally disabled or disabled for current role
            if (bhartiConfig.enabled === false) return;
            if (bhartiConfig.visibleTo && bhartiConfig.visibleTo[roleKey] === false) {
                console.log(`[Bharti AI] Disabled for role: ${roleKey} by Admin.`);
                return;
            }

            initBhartiWidget();
        })
        .catch(err => {
            console.warn('[Bharti AI] Config load failed:', err);
        });

    function initBhartiWidget() {
        // Inject Styles
        const style = document.createElement('style');
        style.id = 'bharti-widget-styles';
        style.textContent = `
            .bharti-launcher-btn {
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 62px;
                height: 62px;
                border-radius: 50%;
                background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
                border: 2px solid rgba(255, 255, 255, 0.4);
                box-shadow: 0 8px 25px rgba(37, 99, 235, 0.4), 0 0 15px rgba(124, 58, 237, 0.3);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .bharti-launcher-btn:hover {
                transform: scale(1.08) translateY(-2px);
                box-shadow: 0 12px 30px rgba(37, 99, 235, 0.55), 0 0 25px rgba(124, 58, 237, 0.45);
            }
            .bharti-avatar-glow {
                position: absolute;
                inset: -4px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(96, 165, 250, 0.6) 0%, transparent 70%);
                animation: bhartiPulse 2.4s infinite;
                z-index: -1;
            }
            @keyframes bhartiPulse {
                0% { transform: scale(0.95); opacity: 0.8; }
                50% { transform: scale(1.15); opacity: 0.3; }
                100% { transform: scale(0.95); opacity: 0.8; }
            }
            .bharti-badge-pill {
                position: absolute;
                top: -6px;
                right: -6px;
                background: #10b981;
                color: #ffffff;
                font-size: 10px;
                font-weight: 800;
                padding: 2px 6px;
                border-radius: 10px;
                border: 2px solid #0f172a;
                letter-spacing: 0.5px;
            }
            .bharti-hint-bubble {
                position: fixed;
                bottom: 34px;
                right: 96px;
                background: #0f172a;
                color: #ffffff;
                padding: 8px 14px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 700;
                box-shadow: 0 4px 20px rgba(0,0,0,0.25);
                border: 1px solid rgba(255, 255, 255, 0.15);
                display: flex;
                align-items: center;
                gap: 6px;
                z-index: 99998;
                cursor: pointer;
                animation: bhartiFadeIn 0.5s ease-out;
            }
            @keyframes bhartiFadeIn {
                from { opacity: 0; transform: translateX(10px); }
                to { opacity: 1; transform: translateX(0); }
            }
            .bharti-chat-panel {
                position: fixed;
                bottom: 96px;
                right: 24px;
                width: 380px;
                max-width: calc(100vw - 32px);
                height: 540px;
                max-height: calc(100vh - 120px);
                background: #0f172a;
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 20px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
                display: none;
                flex-direction: column;
                overflow: hidden;
                z-index: 99999;
                backdrop-filter: blur(16px);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .bharti-chat-panel.open {
                display: flex;
                animation: bhartiSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes bhartiSlideUp {
                from { opacity: 0; transform: translateY(20px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .bharti-chat-header {
                background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                padding: 14px 18px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .bharti-header-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .bharti-avatar-circle {
                width: 38px;
                height: 38px;
                border-radius: 50%;
                background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                position: relative;
                color: #0f172a;
                font-weight: 900;
            }
            .bharti-status-dot {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #10b981;
                border: 2px solid #0f172a;
            }
            .bharti-header-info h4 {
                color: #ffffff;
                font-size: 15px;
                font-weight: 800;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .bharti-header-info p {
                color: #94a3b8;
                font-size: 11px;
                margin: 2px 0 0;
            }
            .bharti-close-btn {
                background: rgba(255, 255, 255, 0.08);
                border: none;
                color: #94a3b8;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                font-size: 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }
            .bharti-close-btn:hover {
                background: rgba(239, 68, 68, 0.2);
                color: #fca5a5;
            }
            .bharti-messages-box {
                flex: 1;
                padding: 16px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 12px;
                background: #090d16;
            }
            .bharti-msg {
                max-width: 82%;
                padding: 10px 14px;
                border-radius: 14px;
                font-size: 13.5px;
                line-height: 1.45;
                word-wrap: break-word;
            }
            .bharti-msg-bot {
                background: #1e293b;
                color: #f1f5f9;
                align-self: flex-start;
                border-bottom-left-radius: 4px;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .bharti-msg-user {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                color: #ffffff;
                align-self: flex-end;
                border-bottom-right-radius: 4px;
            }
            .bharti-quick-chips {
                display: flex;
                gap: 6px;
                overflow-x: auto;
                padding: 8px 12px;
                background: #0f172a;
                border-top: 1px solid rgba(255, 255, 255, 0.06);
                scrollbar-width: none;
            }
            .bharti-quick-chips::-webkit-scrollbar { display: none; }
            .bharti-chip {
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.12);
                color: #cbd5e1;
                padding: 5px 11px;
                border-radius: 14px;
                font-size: 11.5px;
                font-weight: 600;
                white-space: nowrap;
                cursor: pointer;
                transition: all 0.2s;
            }
            .bharti-chip:hover {
                background: rgba(37, 99, 235, 0.25);
                border-color: #38bdf8;
                color: #ffffff;
            }
            .bharti-input-row {
                padding: 12px 14px;
                background: #0f172a;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .bharti-input-field {
                flex: 1;
                background: #1e293b;
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 20px;
                padding: 9px 14px;
                color: #ffffff;
                font-size: 13.5px;
                outline: none;
            }
            .bharti-input-field:focus {
                border-color: #38bdf8;
            }
            .bharti-send-btn {
                background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
                border: none;
                color: #ffffff;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                transition: transform 0.2s;
            }
            .bharti-send-btn:hover {
                transform: scale(1.05);
            }
            .bharti-typing-indicator {
                font-size: 11px;
                color: #94a3b8;
                font-style: italic;
                padding-left: 6px;
                display: none;
            }
        `;
        document.head.appendChild(style);

        // Inject Markup
        const container = document.createElement('div');
        container.id = 'bharti-assistant-root';

        const chipsHtml = getRoleChips(roleKey);
        const welcomeText = bhartiConfig.welcomeMessage || "Namaste! Main **Bharti** hoon, BBCC SKILL HUB ki Chief Academic Counselor. Main aapki kya sahayata kar sakti hoon?";

        container.innerHTML = `
            <div class="bharti-hint-bubble" id="bhartiHintBubble" onclick="toggleBhartiChat()">
                <span>✨ Ask Bharti AI</span>
            </div>
            <button class="bharti-launcher-btn" id="bhartiLauncher" onclick="toggleBhartiChat()" title="Chat with Bharti AI">
                <div class="bharti-avatar-glow"></div>
                <span style="font-size:26px;">🤖</span>
                <span class="bharti-badge-pill">AI</span>
            </button>

            <div class="bharti-chat-panel" id="bhartiChatPanel">
                <div class="bharti-chat-header">
                    <div class="bharti-header-left">
                        <div class="bharti-avatar-circle">
                            <span>👩‍🏫</span>
                            <div class="bharti-status-dot"></div>
                        </div>
                        <div class="bharti-header-info">
                            <h4>BHARTI <span style="font-size:10px; background:rgba(37,99,235,0.3); color:#60a5fa; padding:1px 6px; border-radius:4px;">Gemini AI</span></h4>
                            <p>BBCC Academic Counselor (${capitalize(userRole)})</p>
                        </div>
                    </div>
                    <button class="bharti-close-btn" onclick="toggleBhartiChat()" title="Close">✕</button>
                </div>

                <div class="bharti-messages-box" id="bhartiMessages">
                    <div class="bharti-msg bharti-msg-bot">
                        ${formatMarkdown(welcomeText)}
                    </div>
                </div>

                <div class="bharti-quick-chips" id="bhartiChips">
                    ${chipsHtml}
                </div>

                <div class="bharti-typing-indicator" id="bhartiTyping">Bharti is thinking...</div>

                <form class="bharti-input-row" onsubmit="handleBhartiSend(event)">
                    <input type="text" id="bhartiInput" class="bharti-input-field" placeholder="Type your question..." autocomplete="off">
                    <button type="submit" class="bharti-send-btn" title="Send">➤</button>
                </form>
            </div>
        `;

        document.body.appendChild(container);

        // Auto hide hint bubble after 8 seconds
        setTimeout(() => {
            const hint = document.getElementById('bhartiHintBubble');
            if (hint) hint.style.display = 'none';
        }, 8000);
    }

    function getRoleChips(role) {
        if (role === 'coaching') {
            return `
                <span class="bharti-chip" onclick="sendBhartiPrompt('How does the 7-day free trial work?')">💡 7-Day Free Trial</span>
                <span class="bharti-chip" onclick="sendBhartiPrompt('How can I upload and monetize my study notes?')">📚 Sell Notes</span>
                <span class="bharti-chip" onclick="sendBhartiPrompt('How do I get my official BBCC Accreditation Certificate?')">🎖️ Get Certificate</span>
                <span class="bharti-chip" onclick="sendBhartiPrompt('Tips to increase student enrollment this session')">📈 Grow Admissions</span>
            `;
        }
        if (role === 'students') {
            return `
                <span class="bharti-chip" onclick="sendBhartiPrompt('How can I purchase Class 10/12 notes via Razorpay?')">📖 Buy E-Notes</span>
                <span class="bharti-chip" onclick="sendBhartiPrompt('How can I find top verified coaching centers in Madhubani / Patna?')">🏛️ Find Coaching</span>
                <span class="bharti-chip" onclick="sendBhartiPrompt('How can I download my Student ID Card?')">🪪 Student ID Card</span>
                <span class="bharti-chip" onclick="sendBhartiPrompt('Can you give me 5 effective revision tips for board exams?')">🎯 Exam Tips</span>
            `;
        }
        if (role === 'teachers') {
            return `
                <span class="bharti-chip" onclick="sendBhartiPrompt('How to structure a high-retention 45-minute lesson plan?')">📝 Lesson Plan</span>
                <span class="bharti-chip" onclick="sendBhartiPrompt('Generate 3 quick practice quiz questions for Class 10 Science')">🧪 Quiz Generator</span>
            `;
        }
        // Visitor default
        return `
            <span class="bharti-chip" onclick="sendBhartiPrompt('How do I register my coaching institute on BBCC?')">🏛️ Register Coaching</span>
            <span class="bharti-chip" onclick="sendBhartiPrompt('How can students join verified coaching centers?')">🎓 Student Admission</span>
            <span class="bharti-chip" onclick="sendBhartiPrompt('What study notes and books are available on E-Library?')">📚 E-Library Store</span>
            <span class="bharti-chip" onclick="sendBhartiPrompt('Who is Santosh Sir and what is BBCC SKILL HUB?')">🛡️ About BBCC</span>
        `;
    }

    window.toggleBhartiChat = function () {
        const panel = document.getElementById('bhartiChatPanel');
        const hint = document.getElementById('bhartiHintBubble');
        if (hint) hint.style.display = 'none';
        if (panel) {
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) {
                setTimeout(() => {
                    const inp = document.getElementById('bhartiInput');
                    if (inp) inp.focus();
                }, 100);
            }
        }
    };

    window.sendBhartiPrompt = function (text) {
        const inp = document.getElementById('bhartiInput');
        if (inp) {
            inp.value = text;
            handleBhartiSend(new Event('submit'));
        }
    };

    window.handleBhartiSend = async function (e) {
        if (e && e.preventDefault) e.preventDefault();
        const inp = document.getElementById('bhartiInput');
        if (!inp) return;
        const msg = inp.value.trim();
        if (!msg) return;

        // Append User Message
        appendMessage(msg, 'user');
        inp.value = '';

        // Show typing
        const typing = document.getElementById('bhartiTyping');
        if (typing) typing.style.display = 'block';

        try {
            const res = await fetch('/api/ai/bharti-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    role: userRole,
                    history: conversationHistory.slice(-8)
                })
            });
            const data = await res.json();
            if (typing) typing.style.display = 'none';

            if (data.success && data.reply) {
                appendMessage(data.reply, 'bot');
                conversationHistory.push({ role: 'user', content: msg });
                conversationHistory.push({ role: 'assistant', content: data.reply });
            } else {
                appendMessage(data.message || 'Apologies, I am having trouble connecting right now. Please try again.', 'bot');
            }
        } catch (err) {
            if (typing) typing.style.display = 'none';
            appendMessage('Network connection failed. Please ensure your internet is active.', 'bot');
        }
    };

    function appendMessage(text, sender) {
        const box = document.getElementById('bhartiMessages');
        if (!box) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `bharti-msg bharti-msg-${sender}`;
        msgDiv.innerHTML = formatMarkdown(text);
        box.appendChild(msgDiv);
        box.scrollTop = box.scrollHeight;
    }

    function formatMarkdown(str) {
        if (!str) return '';
        let escaped = str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Bold **text**
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic *text*
        escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Bullet points
        escaped = escaped.replace(/^[•\-\*]\s+(.*)$/gm, '• $1<br>');
        // Linebreaks
        escaped = escaped.replace(/\n/g, '<br>');

        return escaped;
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
})();
