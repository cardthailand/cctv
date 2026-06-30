const players = new Map();

function createCameraBox(channel) {
  const box = document.createElement('div');
  box.className = 'cam-box';
  box.innerHTML = `
    <div class="cam-title">Channel ${channel}</div>
    <div class="cam-status connecting" id="status-${channel}">กำลังเชื่อมต่อ</div>
    <canvas id="video-canvas-${channel}"></canvas>
  `;
  return box;
}

function setStatus(channel, state, text) {
  const el = document.getElementById(`status-${channel}`);
  if (!el) return;
  el.className = `cam-status ${state}`;
  el.textContent = text;
}

async function connectChannel(channel) {
  try {
    const response = await fetch(`/api/stream/token?channel=${channel}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'ไม่สามารถขอ stream token ได้');
    }

    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseUrl = data.wsUrl || `${wsProtocol}//${location.hostname}:${data.wsPort}`;
    const separator = baseUrl.includes('?') ? '&' : '?';
    const wsUrl = `${baseUrl}${separator}token=${encodeURIComponent(data.token)}`;
    const canvas = document.getElementById(`video-canvas-${channel}`);
    const client = new WebSocket(wsUrl);

    client.onopen = () => setStatus(channel, 'connected', 'เชื่อมต่อแล้ว');
    client.onerror = () => setStatus(channel, 'error', 'ขาดการเชื่อมต่อ');
    client.onclose = () => {
      setStatus(channel, 'connecting', 'กำลังเชื่อมต่อใหม่');
      setTimeout(() => connectChannel(channel), 5000);
    };

    const player = new jsmpeg(client, { canvas, autoplay: true, audio: false });
    players.set(channel, { client, player, wsPort: data.wsPort });

    setTimeout(async () => {
      const refresh = await fetch(`/api/stream/token?channel=${channel}`);
      if (refresh.ok) {
        const next = await refresh.json();
        if (next.token !== data.token) {
          // token refreshed for next reconnect cycle
        }
      }
    }, (data.expiresIn - 30) * 1000);
  } catch (error) {
    setStatus(channel, 'error', error.message);
    setTimeout(() => connectChannel(channel), 5000);
  }
}

function initLiveView(channels) {
  const grid = document.getElementById('camera-grid');
  grid.innerHTML = '';

  if (!channels.length) {
    grid.innerHTML = '<p style="padding:20px;">ไม่มีสิทธิ์เข้าถึงกล้องใดๆ</p>';
    return;
  }

  const cols = channels.length === 1 ? 1 : 2;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (const channel of channels) {
    grid.appendChild(createCameraBox(channel));
    connectChannel(channel);
  }
}
