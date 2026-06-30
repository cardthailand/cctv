function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
  }
  return res.redirect('/login.html');
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' });
    }
    return next();
  };
}

function requireChannelAccess(req, res, next) {
  const channel = parseInt(req.query.channel || req.params.channel || req.body?.channel, 10);
  if (!Number.isInteger(channel)) {
    return res.status(400).json({ error: 'ต้องระบุ channel' });
  }
  if (!req.user?.channels?.includes(channel)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงช่องนี้' });
  }
  req.channel = channel;
  return next();
}

function canUseAiChat(user) {
  return user && (user.role === 'admin' || user.role === 'user');
}

module.exports = {
  requireAuth,
  requireRole,
  requireChannelAccess,
  canUseAiChat,
};
