'use client';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const roleNames = { superadmin: '超级管理员', admin: '管理员', user: '普通用户' };

export default function HomePage() {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [polls, setPolls] = useState([]);
  const [selectedPollId, setSelectedPollId] = useState('');
  const [pollDetail, setPollDetail] = useState(null);
  const [options, setOptions] = useState([]);
  const [results, setResults] = useState([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const authHeaders = useMemo(() => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...authHeaders, ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || '请求失败，请稍后重试。');
    return data;
  }
  function saveSession(data) { localStorage.setItem('myioi-token', data.token); setToken(data.token); setUser(data.user); setMessage(''); }
  function logout() { localStorage.removeItem('myioi-token'); setToken(''); setUser(null); setPolls([]); setUsers([]); setSelectedPollId(''); setPollDetail(null); setMessage(''); }

  useEffect(() => {
    const saved = localStorage.getItem('myioi-token');
    if (!saved) { setAuthReady(true); return; }
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${saved}` } })
      .then(async (res) => { if (!res.ok) throw new Error('expired'); return res.json(); })
      .then((data) => { setToken(saved); setUser(data.user); })
      .catch(() => localStorage.removeItem('myioi-token'))
      .finally(() => setAuthReady(true));
  }, []);
  useEffect(() => {
    if (!token || !user) return;
    api('/polls').then((data) => setPolls(data.polls || [])).catch((error) => setMessage(error.message));
    if (user.role === 'superadmin') api('/admin/users').then((data) => setUsers(data.users || [])).catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);
  async function submitAuth(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { saveSession(await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify({ username, password }) })); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  async function loadPolls() {
    try { const data = await api('/polls'); setPolls(data.polls || []); } catch (error) { setMessage(error.message); }
  }
  async function openPoll(id) {
    setSelectedPollId(id); setSelectedOptionId(''); setMessage('');
    try {
      const [detail, outcome] = await Promise.all([api(`/polls/${id}`), api(`/polls/${id}/results`)]);
      setPollDetail(detail.poll); setOptions(detail.options || []); setSelectedOptionId(detail.votedOptionId || '');
      setResults(outcome.results || []); setTotalVotes(Number(outcome.totalVotes || 0));
    } catch (error) { setMessage(error.message); }
  }
  async function createPoll(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    const pollOptions = optionsText.split('\n').map((item) => item.trim()).filter(Boolean);
    try {
      await api('/polls', { method: 'POST', body: JSON.stringify({ title, description, options: pollOptions }) });
      setTitle(''); setDescription(''); setOptionsText(''); setMessage('投票已创建。'); await loadPolls();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  async function vote(event) {
    event.preventDefault(); if (!selectedOptionId) { setMessage('请先选择一个选项。'); return; }
    setBusy(true); setMessage('');
    try {
      await api(`/polls/${selectedPollId}/vote`, { method: 'POST', body: JSON.stringify({ optionId: selectedOptionId }) });
      setMessage('投票成功，感谢参与！'); await openPoll(selectedPollId); await loadPolls();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  async function changeRole(target, role) {
    try {
      await api(`/admin/users/${target.id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
      setUsers((current) => current.map((item) => item.id === target.id ? { ...item, role } : item));
      setMessage(`${target.username} 的角色已更新。`);
    } catch (error) { setMessage(error.message); }
  }
  if (!authReady) return <main className="page-shell"><div className="loading">正在载入…</div></main>;

  return <main className="page-shell"><div className="container">
    <header className="topbar"><a className="brand" href="#home" aria-label="投票现场首页"><span className="brand-mark">V</span><span>投票<span className="brand-accent">现场</span></span></a>
      {user ? <div className="account"><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><span className="account-name"><b>{user.username}</b><small>{roleNames[user.role] || user.role}</small></span><button className="button button-quiet" onClick={logout}>退出</button></div> : <span className="secure-note">简单 · 公平 · 透明</span>}
    </header>
    {!user ? <section className="auth-layout" id="home"><div className="hero-copy"><span className="eyebrow"><i /> 让每个声音都被看见</span><h1>好决定，<br />从<span>每一票</span>开始。</h1><p>创建投票，邀请大家参与。结果即时呈现，让团队决定更简单。</p><div className="hero-points"><span>✓ 每人每项投票限投一次</span><span>✓ 注册即用，无需繁琐设置</span><span>✓ 透明查看实时结果</span></div></div>
      <form className="auth-card" onSubmit={submitAuth}><div className="auth-tabs"><button type="button" className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setMessage(''); }}>登录</button><button type="button" className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setMessage(''); }}>创建账号</button></div><h2>{mode === 'login' ? '欢迎回来' : '加入投票现场'}</h2><p className="muted">{mode === 'login' ? '登录以继续参与和管理投票。' : '创建一个账号，立即加入投票。'}</p>
        <label>用户名<input autoComplete="username" minLength={3} maxLength={32} required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="输入用户名" /></label><label>密码<input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" /></label>{message && <p className="notice" role="alert">{message}</p>}<button className="button button-primary full" disabled={busy}>{busy ? '请稍候…' : mode === 'login' ? '登录账号' : '注册并继续'} <span>→</span></button><p className="auth-foot">注册账号默认为普通用户，管理员由超级管理员分配。</p>
      </form></section> : <>
      <section className="welcome-row"><div><span className="eyebrow">工作台</span><h1>你好，{user.username}<span className="wave"> 👋</span></h1><p className="muted">今天想和大家一起决定什么？</p></div><div className="stats-card"><span className="stats-icon">◎</span><span><b>{polls.length}</b><small>项投票</small></span></div></section>
      {message && <div className="notice notice-wide" role="status">{message}<button aria-label="关闭提示" onClick={() => setMessage('')}>×</button></div>}
      <section className="dashboard-grid"><div className="main-column">
        {(user.role === 'admin' || user.role === 'superadmin') && <form className="panel create-panel" onSubmit={createPoll}><div className="panel-heading"><div><span className="eyebrow">新建</span><h2>发起一项投票</h2></div><span className="heading-icon">＋</span></div><label>投票标题<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：下次团建去哪儿？" /></label><label>补充说明 <span className="optional">（选填）</span><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="告诉参与者一些背景信息…" /></label><label>投票选项 <span className="optional">（每行一个，至少两个）</span><textarea required rows={4} value={optionsText} onChange={(event) => setOptionsText(event.target.value)} placeholder={'海边露营\n城市徒步\n桌游派对'} /></label><button className="button button-primary" disabled={busy}>发布投票 <span>→</span></button></form>}
        <section className="panel polls-panel"><div className="panel-heading"><div><span className="eyebrow">大家的选择</span><h2>所有投票 <span className="count-pill">{polls.length}</span></h2></div><button className="button button-quiet" onClick={loadPolls}>刷新 ↻</button></div>{polls.length === 0 ? <div className="empty-state"><span>◉</span><b>这里还没有投票</b><p>有想法的话，创建第一项投票吧。</p></div> : <div className="poll-list">{polls.map((poll) => <button key={poll.id} className={`poll-item ${selectedPollId === poll.id ? 'poll-selected' : ''}`} onClick={() => openPoll(poll.id)}><span className="poll-symbol">◉</span><span className="poll-title"><b>{poll.title}</b><small>{poll.description || '暂无说明'}</small></span><span className="poll-meta"><b>{Number(poll.total_votes || 0)}</b><small>票</small></span><span className="poll-arrow">→</span></button>)}</div>}</section>
      </div><aside className="side-column"><div className="side-note"><span className="side-note-icon">✳</span><h3>每一票都重要</h3><p>每位用户在每项投票中可以选择一次。提交后即可查看投票结果。</p></div><div className="role-card"><span className="eyebrow">当前身份</span><div className="role-badge">{roleNames[user.role] || user.role}</div><p>{user.role === 'superadmin' ? '你可以创建投票，并管理其他用户的管理员权限。' : user.role === 'admin' ? '你可以发起投票、参与投票并查看结果。' : '你可以参与投票并查看结果。'}</p></div></aside></section>
      {pollDetail && <section className="panel detail-panel"><div className="panel-heading"><div><span className="eyebrow">投票详情</span><h2>{pollDetail.title}</h2></div><button className="button button-quiet" onClick={() => { setPollDetail(null); setSelectedPollId(''); }}>收起 ×</button></div>{pollDetail.description && <p className="detail-description">{pollDetail.description}</p>}<div className="detail-grid"><form className="vote-form" onSubmit={vote}><h3>{pollDetail.hasVoted ? '你已完成投票' : '选择你的答案'}</h3>{options.map((option) => <label key={option.id} className={`option-row ${selectedOptionId === option.id ? 'option-selected' : ''}`}><input type="radio" name="vote-option" checked={selectedOptionId === option.id} disabled={pollDetail.hasVoted || busy} onChange={() => setSelectedOptionId(option.id)} /><span>{option.text}</span>{pollDetail.votedOptionId === option.id && <small>你的选择</small>}</label>)}{!pollDetail.hasVoted && <button className="button button-primary" disabled={busy}>确认投票 <span>→</span></button>}</form><div className="results-box"><div className="results-heading"><h3>实时结果</h3><span>{totalVotes} 票</span></div>{results.map((item) => { const count = Number(item.vote_count || 0); const percent = totalVotes ? Math.round(count / totalVotes * 100) : 0; return <div className="result-item" key={item.id}><div className="result-label"><span>{item.text}</span><b>{count} <small>票 · {percent}%</small></b></div><div className="progress-track"><span style={{ width: `${percent}%` }} /></div></div>; })}{results.length === 0 && <p className="muted">暂无结果</p>}</div></div></section>}
      {user.role === 'superadmin' && <section className="panel users-panel"><div className="panel-heading"><div><span className="eyebrow">权限管理</span><h2>用户与管理员</h2></div><span className="count-pill">{users.length} 位用户</span></div><p className="muted">只有超级管理员可以授予或取消管理员权限。</p><div className="users-list">{users.map((item) => <div className="user-row" key={item.id}><span className="avatar avatar-small">{item.username.slice(0, 1).toUpperCase()}</span><span className="user-row-name"><b>{item.username}</b><small>{roleNames[item.role] || item.role}</small></span>{item.role === 'superadmin' ? <span className="protected-label">最高权限</span> : <button className={`button ${item.role === 'admin' ? 'button-outline' : 'button-soft'}`} onClick={() => changeRole(item, item.role === 'admin' ? 'user' : 'admin')}>{item.role === 'admin' ? '取消管理员' : '设为管理员'}</button>}</div>)}</div></section>}
      <footer className="footer">投票现场 <span>·</span> 每一个好决定，都值得认真对待。</footer>
    </>}
  </div></main>;
}
