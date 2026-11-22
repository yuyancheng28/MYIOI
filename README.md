# 投票现场 | MYIOI Vote Collect

一个可自行部署的在线投票系统，支持注册登录、三种角色、投票创建与参与、实时结果及管理员权限管理。

## 功能

- 注册和登录；新注册账号始终是普通用户，不能通过请求伪造管理员身份。
- **超级管理员**：拥有管理员的全部功能，并可授予或取消其他用户的管理员权限。
- **管理员**：创建投票、参与投票、查看所有投票结果。
- **普通用户**：参与投票、查看所有投票结果。
- 每位登录用户每项投票只能投一次；结果包含票数和百分比。
- SQLite 本地开发，支持 PostgreSQL 部署。

## 本地运行

需要 Node.js 18 或更高版本。

```bash
cp .env.example .env
# 编辑 .env，设置 JWT_SECRET 和初始超级管理员账号
npm install
npm run dev
```

前端：http://localhost:3000  
API：http://localhost:4000/api

首次启动时，设置 `INITIAL_ADMIN_USERNAME` 和 `INITIAL_ADMIN_PASSWORD` 会自动创建超级管理员。**请自行设置强密码，不要将生产密钥提交到仓库。**如未设置初始账号，可先注册普通账号，再在数据库中将其 role 更新为 `superadmin`。

## 配置

| 变量 | 用途 | 默认值 |
| --- | --- | --- |
| `PORT` | API 监听端口 | `4000` |
| `JWT_SECRET` | JWT 签名密钥，部署时必须改为随机强密钥 | 开发用默认值 |
| `DATABASE_PATH` | SQLite 数据库文件 | `./data/vote.db` |
| `DATABASE_URL` | PostgreSQL 连接字符串；设置后启用 PostgreSQL | 未设置 |
| `DB_SSL` | PostgreSQL 是否启用 SSL | `false` |
| `INITIAL_ADMIN_USERNAME` | 首次启动创建超级管理员的用户名 | 未设置 |
| `INITIAL_ADMIN_PASSWORD` | 首次启动创建超级管理员的密码（至少 8 位） | 未设置 |
| `NEXT_PUBLIC_API_URL` | 前端 API 地址 | `http://localhost:4000/api` |
| `WEB_ORIGIN` | 可选的前端 CORS 来源 | 允许所有来源 |

PostgreSQL 初始化：设置 `DATABASE_URL` 后启动 API 会运行 `database/schema_postgres.sql`。也可在 API workspace 中手动运行 `npm run migrate`。

## API 概览

登录后，受保护接口使用 `Authorization: Bearer <token>`。

- `POST /api/auth/register` — 注册（只创建普通用户）
- `POST /api/auth/login`、`GET /api/auth/me` — 登录和当前用户
- `GET /api/polls` — 投票列表及投票数
- `POST /api/polls` — 创建投票（管理员及超级管理员）
- `GET /api/polls/:id` — 投票详情
- `POST /api/polls/:id/vote` — 投票
- `GET /api/polls/:id/results` — 查看结果（所有登录用户）
- `GET /api/admin/users` — 用户列表（仅超级管理员）
- `PATCH /api/admin/users/:id/role` — 授予/取消管理员权限，JSON：`{"role":"admin"}` 或 `{"role":"user"}`（仅超级管理员）

用户角色从数据库实时读取，权限变更会立即生效。超级管理员角色不能通过管理界面修改。

## 检查

```bash
npm run build
```
