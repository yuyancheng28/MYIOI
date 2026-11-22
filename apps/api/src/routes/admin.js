const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('superadmin'));
router.get('/users', async (_req, res) => {
  try {
    const users = await db.all('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
    return res.json({ users });
  } catch (err) { console.error(err); return res.status(500).json({ message: '服务器暂时不可用。' }); }
});
router.patch('/users/:id/role', async (req, res) => {
  try {
    const role = req.body?.role;
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ message: '角色只能设置为管理员或普通用户。' });
    const target = await db.get('SELECT id, username, role, created_at FROM users WHERE id = $1', [req.params.id]);
    if (!target) return res.status(404).json({ message: '找不到该用户。' });
    if (target.role === 'superadmin') return res.status(403).json({ message: '超级管理员账号不能在此修改。' });
    await db.run('UPDATE users SET role = $1 WHERE id = $2', [role, target.id]);
    return res.json({ user: { ...target, role } });
  } catch (err) { console.error(err); return res.status(500).json({ message: '服务器暂时不可用。' }); }
});
module.exports = router;
