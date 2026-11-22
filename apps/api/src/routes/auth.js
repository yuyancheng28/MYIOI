const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { randomUUID } = require('crypto');

const router = express.Router();
const jwtSecret = () => process.env.JWT_SECRET || 'dev-secret-change-me';
const publicUser = ({ id, username, role, created_at }) => ({ id, username, role, created_at });

router.post('/register', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (username.length < 3 || username.length > 32 || !/^[\p{L}\p{N}_.-]+$/u.test(username)) {
      return res.status(400).json({ message: '用户名需为 3–32 位，只能包含字母、数字、下划线、点或短横线。' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: '密码长度必须为 8–128 位。' });
    }
    const existing = await db.get('SELECT id FROM users WHERE username = $1', [username]);
    if (existing) return res.status(409).json({ message: '该用户名已被使用。' });

    const id = randomUUID();
    const created_at = new Date().toISOString();
    const password_hash = await bcrypt.hash(password, 12);
    await db.run('INSERT INTO users (id, username, password_hash, role, created_at) VALUES ($1,$2,$3,$4,$5)', [id, username, password_hash, 'user', created_at]);
    const user = { id, username, role: 'user', created_at };
    const token = jwt.sign({ id }, jwtSecret(), { expiresIn: '7d' });
    return res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505' || String(err.code) === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ message: '该用户名已被使用。' });
    console.error(err);
    return res.status(500).json({ message: '服务器暂时不可用。' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password) return res.status(400).json({ message: '请输入用户名和密码。' });
    const user = await db.get('SELECT id, username, password_hash, role, created_at FROM users WHERE username = $1', [username]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: '用户名或密码错误。' });
    }
    const token = jwt.sign({ id: user.id }, jwtSecret(), { expiresIn: '7d' });
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: '服务器暂时不可用。' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ message: '请先登录。' });
    const payload = jwt.verify(token, jwtSecret());
    const user = await db.get('SELECT id, username, role, created_at FROM users WHERE id = $1', [payload.id]);
    if (!user) return res.status(401).json({ message: '账号不存在或已被删除。' });
    return res.json({ user: publicUser(user) });
  } catch {
    return res.status(401).json({ message: '登录已过期，请重新登录。' });
  }
});

module.exports = router;
