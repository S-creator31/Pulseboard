# PulseBoard - Project Architecture & Context

## Package Layouts

The repository consists of two top-level directories:

### Client (`/client`)
- **Framework**: Next.js 15 (App Router, JavaScript/JSX) with Tailwind CSS v4.
- **Styling**: `client/app/globals.css` defines an electric violet + hot coral design token system with semantic colors and custom fonts (`Sora`, `Manrope`, `JetBrains Mono`).
- **Directories**:
  - `app/`: Next.js App Router pages:
    - `/` (Home landing page)
    - `/login`, `/register` (Authentication pages)
    - `/dashboard` (User board listing and board creation links)
    - `/create-board` (New board modal/page with color picker)
    - `/board/[id]` (Interactive Kanban board page with lists and task cards)
  - `components/`: UI components (`List.jsx`, `Task.jsx`, `PulseAvatar.jsx`, `PulseLogo.jsx`, `ActivityLog.jsx`, `AddMemberForm.jsx`).
  - `context/`: React context providers (`AuthContext.jsx` managing JWT tokens and current user state).
  - `lib/`: Utilities (`colors.js` for board/user color mappings).

### Server (`/server`)
- **Runtime**: Node.js with Express 5 and Mongoose 8.
- **Entry Point**: `server/app.js`.
- **Directories**:
  - `config/`: MongoDB connection setup (`db.js`).
  - `controllers/`: Request handlers (`authController.js`, `boardController.js`, `listController.js`, `taskController.js`, `activityLogController.js`).
  - `middlewares/`: Security & access control (`authMiddleware.js`, `checkBoardAccess.js`, `adminMiddleware.js`).
  - `models/`: Mongoose schemas (`User.js`, `Board.js`, `List.js`, `Task.js`, `ActivityLog.js`).
  - `routes/`: Express route definitions (`authRoutes.js`, `boardRoutes.js`, `listRoutes.js`, `taskRoutes.js`, `activityLogRoutes.js`).
  - `utils/`: Utilities such as `generateToken.js`.

---

## Route Registration in `server/app.js`

Routes are mounted with an `/api` prefix:
- `/api/auth` -> `routes/authRoutes.js` (register, login)
- `/api/boards` -> `routes/boardRoutes.js` (CRUD boards, add member, update member role)
- `/api/lists` -> `routes/listRoutes.js` (create, get by board, delete list)
- `/api/tasks` -> `routes/taskRoutes.js` (create, get by board, move, status update, delete)
- `/api/activity-logs` -> `routes/activityLogRoutes.js` (fetch board activity logs)

---

## Mongoose Models and Fields

### `User` (`server/models/User.js`)
- `name` (String, required)
- `email` (String, required, unique)
- `password` (String, required, bcrypt hashed)
- `role` (String, enum: `['user', 'admin']`, default: `'user'`)
- Timestamps (`createdAt`, `updatedAt`)

### `Board` (`server/models/Board.js`)
- `title` (String, required)
- `color` (String, enum: `['violet', 'coral', 'teal', 'amber', 'pink']`, default: `'violet'`)
- `owner` (ObjectId ref `'User'`, required)
- `members` (Array of `{ user: ObjectId ref 'User', role: enum ['admin', 'member'] }`)
- `createdAt` (Date, default: Date.now)

### `List` (`server/models/List.js`)
- `title` (String, required)
- `board` (ObjectId ref `'Board'`, required)
- `order` (Number, default: 0)
- `statusKey` (String, enum: `['todo', 'in-progress', 'done']`, for mapping column state to task status)
- Virtual: `tasks` (ref: `'Task'`, localField: `'_id'`, foreignField: `'list'`)
- Timestamps (`createdAt`, `updatedAt`)

### `Task` (`server/models/Task.js`)
- `title` (String, required, trim: true)
- `description` (String, default: '')
- `board` (ObjectId ref `'Board'`, required)
- `list` (ObjectId ref `'List'`, required)
- `assignedTo` (ObjectId ref `'User'`)
- `status` (String, enum: `['todo', 'in-progress', 'done']`, default: `'todo'`)
- `order` (Number, default: 0)
- Timestamps (`createdAt`, `updatedAt`)

### `ActivityLog` (`server/models/ActivityLog.js`)
- `board` (ObjectId ref `'Board'`, required)
- `user` (ObjectId ref `'User'`)
- `action` (String, required)
- `task` (ObjectId ref `'Task'`)
- Timestamps (`createdAt`, `updatedAt`)

---

## Auth Flow and Middlewares

1. **JWT Auth**:
   - `generateToken(id)` creates a signed JWT using `process.env.JWT_SECRET` with 30-day expiration.
   - Client stores token in `localStorage` under key `'token'`.
2. **Middlewares**:
   - `protect` (`server/middlewares/authMiddleware.js`):
     - Reads `req.headers.authorization` Bearer token.
     - Decodes JWT, finds user via `User.findById(decoded.id).select('-password')`.
     - Sets `req.user`. Returns 401 if token is invalid or missing.
   - `checkBoardAccess` (`server/middlewares/checkBoardAccess.js`):
     - Resolves `boardId` from params (`:boardId`, `:id`), query, or body.
     - Confirms `req.user._id` is either `board.owner` or present in `board.members`. Returns 404 if board not found, 403 if unauthorized.
   - `adminMiddleware` (`server/middlewares/adminMiddleware.js`):
     - Verifies `req.user && req.user.role === 'admin'`.

---

## Existing Activity Log Helper

Defined in `server/controllers/activityLogController.js`:
```javascript
const logActivity = async ({ boardId, userId, action, taskId }) => { ... }
```
- Creates an `ActivityLog` document linking `board`, `user`, `action`, and optional `task`.
- Used across task controllers (creation, status update, deletion).

---

## Design Tokens (`client/app/globals.css`)

Defined in root variables and accessible in Tailwind theme:
- **Brand**:
  - `--color-brand`: `#6d28f5` (Pulse Violet)
  - `--color-brand-strong`: `#5416e0`
  - `--color-brand-soft`: `#efe7ff`
  - `--color-accent`: `#ff5a4e` (Pulse Coral)
  - `--color-accent-soft`: `#ffe6e2`
- **Semantic**:
  - `--color-success`: `#12b76a`, `--color-success-soft`: `#e3faf0`
  - `--color-warning`: `#f79009`, `--color-warning-soft`: `#fef3e0`
  - `--color-danger`: `#f04438`, `--color-danger-soft`: `#fdeceb`
- **Neutrals (Violet-biased)**:
  - `--color-ink`: `#17132b`, `--color-ink-muted`: `#635e7a`
  - `--color-paper`: `#fdfbff`, `--color-surface`: `#ffffff`, `--color-surface-2`: `#f4f1fb`, `--color-line`: `#e6e1f5`
- **Typography**:
  - Display: `Sora` (`--font-sora`, `.font-display`)
  - Sans: `Manrope` (`--font-manrope`)
  - Mono / Figures: `JetBrains Mono` (`--font-jetbrains`, `.font-data`)
- **Radii**:
  - `--radius-md`: `12px`, `--radius-lg`: `18px`, `--radius-pill`: `999px`

---

## Client Data-Fetching Pattern

- **Authentication**: `useAuth()` hook from `client/context/AuthContext.jsx` supplies `{ user, loading, login, register, logout }`.
- **API Requests**:
  - Handled via `axios` or native `fetch` with `Authorization: Bearer ${token}` header.
  - Base URL configured from `process.env.NEXT_PUBLIC_API_URL` (typically `http://localhost:5000/api`).
  - Optimistic UI updates on state mutation with server reconciliation.
