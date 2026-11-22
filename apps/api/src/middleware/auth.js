const jwt = require('jsonwebtoken');
const { db } = require('../db');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: '请先登录。' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    db.get('SELECT id, username, role FROM users WHERE id = $1', [decoded.id])
      .then((user) => {
        if (!user) return res.status(401).json({ message: '账号不存在或已被删除。' });
        req.user = user;
        return next();
      })
      .catch((error) => {
        console.error(error);
        return res.status(500).json({ message: '服务器暂时不可用。' });
      });
  } catch {
    return res.status(401).json({ message: '登录已过期，请重新登录。' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: '请先登录。' });
    if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ message: '你没有权限执行此操作。' });
    return next();
  };
}

module.exports = { requireAuth, requireRole };
