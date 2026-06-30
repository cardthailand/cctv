async function checkExistingSession() {
  const response = await fetch('/api/auth/me');
  if (response.ok) {
    window.location.href = '/index.html';
  }
}

async function login(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
  }
  return data;
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

async function getCurrentUser() {
  const response = await fetch('/api/auth/me');
  if (!response.ok) {
    window.location.href = '/login.html';
    return null;
  }
  const data = await response.json();
  return data.user;
}
