/**
 * AI Advisor Chat Logic
 * Implements the conversation flow and simulated intelligence for the prototype.
 */

document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const suggestionChips = document.querySelectorAll('.chip');

    // 1. Send Message functionality
    function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        // User message
        appendMessage('user', text);
        userInput.value = '';
        userInput.style.height = 'auto';

        // AI Response simulation
        simulateAIResponse(text);
    }

    function appendMessage(role, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}-message`;

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        msgDiv.innerHTML = `
            <div class="message-content">${text}</div>
            <div class="message-time">${time}</div>
        `;

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function simulateAIResponse(query) {
        // Typing indicator simulation
        const typingId = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai-message';
        typingDiv.id = typingId;
        typingDiv.innerHTML = `<div class="message-content"><i class="fas fa-ellipsis-h fa-pulse"></i> 思考中...</div>`;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Wait a bit to simulate processing
        await new Promise(r => setTimeout(r, 1500));

        chatMessages.removeChild(typingDiv);

        let response = '';
        const q = query.toLowerCase();

        if (q.includes('清潔度') || q.includes('状態')) {
            response = '代官山店の現在の清潔度スコアは「92点」です。非常に良好な状態が維持されていますが、前回のレポートで「床面の微細なクラック」が報告されています。水漏れの原因になる可能性があるため、次回の清掃時に詳しくチェックするようスタッフに伝えています。';
        } else if (q.includes('提案') || q.includes('次') || q.includes('プラン')) {
            response = '現在の清掃サイクルでは、レンジフードの洗浄を3ヶ月に1回実施していますが、最近の厨房の稼働率上昇（レポートの油付着量から算出）を考慮すると、2.5ヶ月に1回への短縮を検討される価値があります。これにより、排気ファンの故障リスクを大幅に低減できます。見積もりを作成しましょうか？';
        } else if (q.includes('コスト') || q.includes('抑えたい')) {
            response = 'コスト最適化の観点では、定期清掃の一部をスタッフの方による「日常メンテナンス・チェックリスト」に置き換えることで、プロの清掃頻度を調整できる可能性があります。AIが店舗状況に合わせた専用のチェックリストを作成することも可能です。';
        } else {
            response = '承知いたしました。店舗のカルテデータや清掃履歴を詳しく分析し、最適な解決策を提案いたします。具体的にどの部分（エアコン、床、厨房など）についてお困りですか？';
        }

        appendMessage('ai', response);
    }

    // 2. Event Listeners
    sendBtn.addEventListener('click', sendMessage);

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    });

    // Suggestion chips
    suggestionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            userInput.value = chip.textContent;
            sendMessage();
        });
    });
});
