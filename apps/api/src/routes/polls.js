const express = require('express');
const { randomUUID } = require('crypto');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.get('/', requireAuth, async (req, res) => {
  try {
    const polls = await db.all(`SELECT p.*, COUNT(v.id) AS total_votes,
      MAX(CASE WHEN v.user_id = $1 THEN 1 ELSE 0 END) AS has_voted
      FROM polls p LEFT JOIN votes v ON v.poll_id = p.id
      GROUP BY p.id ORDER BY p.created_at DESC`, [req.user.id]);
    return res.json({ polls });
  } catch (err) { console.error(err); return res.status(500).json({ message: '服务器暂时不可用。' }); }
});

router.post('/', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const rawOptions = req.body?.options;
    if (!title || title.length > 120 || !Array.isArray(rawOptions)) return res.status(400).json({ message: '请填写投票标题（最多 120 字）和选项。' });
    const options = [...new Set(rawOptions.map((option) => String(option).trim()).filter(Boolean))];
    if (options.length < 2 || options.length > 20 || options.some((option) => option.length > 100)) return res.status(400).json({ message: '选项需为 2–20 个，每项最多 100 字，且不能重复。' });
    const pollId = randomUUID();
    const now = new Date().toISOString();
    await db.run('INSERT INTO polls (id, title, description, created_by, created_at) VALUES ($1,$2,$3,$4,$5)', [pollId, title, description, req.user.id, now]);
    for (const text of options) await db.run('INSERT INTO poll_options (id, poll_id, text, created_at) VALUES ($1,$2,$3,$4)', [randomUUID(), pollId, text, now]);
    return res.status(201).json({ message: '投票创建成功。', pollId });
  } catch (err) { console.error(err); return res.status(500).json({ message: '服务器暂时不可用。' }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const poll = await db.get('SELECT * FROM polls WHERE id = $1', [req.params.id]);
    if (!poll) return res.status(404).json({ message: '找不到这项投票。' });
    const options = await db.all('SELECT * FROM poll_options WHERE poll_id = $1 ORDER BY created_at, id', [req.params.id]);
    const vote = await db.get('SELECT option_id FROM votes WHERE poll_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    return res.json({ poll, options, hasVoted: Boolean(vote), votedOptionId: vote?.option_id || null });
  } catch (err) { console.error(err); return res.status(500).json({ message: '服务器暂时不可用。' }); }
});

router.post('/:id/vote', requireAuth, async (req, res) => {
  try {
    const pollId = req.params.id;
    const optionId = String(req.body?.optionId || '');
    const poll = await db.get('SELECT id FROM polls WHERE id = $1', [pollId]);
    if (!poll) return res.status(404).json({ message: '找不到这项投票。' });
    const option = await db.get('SELECT id FROM poll_options WHERE id = $1 AND poll_id = $2', [optionId, pollId]);
    if (!option) return res.status(400).json({ message: '请选择有效选项。' });
    try {
      await db.run('INSERT INTO votes (id, poll_id, option_id, user_id, created_at) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), pollId, optionId, req.user.id, new Date().toISOString()]);
    } catch (err) {
      if (err.code === '23505' || String(err.code).startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({ message: '每人只能参与一次，这项投票你已经投过票了。' });
      throw err;
    }
    return res.json({ message: '投票成功，感谢参与！' });
  } catch (err) { console.error(err); return res.status(500).json({ message: '服务器暂时不可用。' }); }
});

router.get('/:id/results', requireAuth, async (req, res) => {
  try {
    const poll = await db.get('SELECT * FROM polls WHERE id = $1', [req.params.id]);
    if (!poll) return res.status(404).json({ message: '找不到这项投票。' });
    const results = await db.all(`SELECT o.id, o.text, COUNT(v.id) AS vote_count
      FROM poll_options o LEFT JOIN votes v ON v.option_id = o.id
      WHERE o.poll_id = $1 GROUP BY o.id, o.text ORDER BY o.created_at ASC, o.id ASC`, [req.params.id]);
    const totalVotes = results.reduce((sum, row) => sum + Number(row.vote_count || 0), 0);
    return res.json({ poll, results, totalVotes });
  } catch (err) { console.error(err); return res.status(500).json({ message: '服务器暂时不可用。' }); }
});

module.exports = router;
