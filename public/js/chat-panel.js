function initChatPanel(user) {
  const canChat = user.role === 'admin' || user.role === 'user';
  if (!canChat) return;

  const fab = document.getElementById('chat-fab');
  const panel = document.getElementById('chat-panel');
  const messagesEl = document.getElementById('chat-messages');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const history = [];

  fab.style.display = 'block';
  fab.addEventListener('click', () => panel.classList.toggle('open'));

  function appendBubble(role, content, scopePayload = null) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.textContent = content;

    if (scopePayload) {
      const btn = document.createElement('button');
      btn.className = 'scope-btn';
      btn.textContent = 'ดูช่วงเวลานี้';
      btn.addEventListener('click', () => openPlayback(scopePayload));
      bubble.appendChild(document.createElement('br'));
      bubble.appendChild(btn);
    }

    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    appendBubble('user', text);
    history.push({ role: 'user', content: text });

    const assistantBubble = appendBubble('assistant', 'กำลังค้นหา...');
    let scopePayload = null;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'ส่งข้อความไม่สำเร็จ');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let content = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === 'content') {
            content = event.content;
            assistantBubble.textContent = content;
          }
          if (event.type === 'scope') {
            scopePayload = event.payload;
          }
        }
      }

      if (scopePayload) {
        assistantBubble.innerHTML = '';
        assistantBubble.textContent = content || 'พบไฟล์ที่ตรงเวลาแล้ว';
        const btn = document.createElement('button');
        btn.className = 'scope-btn';
        btn.textContent = 'ดูช่วงเวลานี้';
        btn.addEventListener('click', () => openPlayback({
          fileName: scopePayload.fileName,
          channel: scopePayload.channel,
          seekSeconds: scopePayload.seekSeconds,
        }));
        assistantBubble.appendChild(document.createElement('br'));
        assistantBubble.appendChild(btn);
      }

      history.push({ role: 'assistant', content: content || 'ไม่พบข้อมูล' });
    } catch (error) {
      assistantBubble.textContent = error.message;
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') sendMessage();
  });
}
