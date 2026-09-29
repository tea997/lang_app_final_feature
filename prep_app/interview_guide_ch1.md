# COMPLETE INTERVIEW PREPARATION GUIDE
## lingoConnect — Language Learning Platform
### Written as a Senior Engineer & System Design Interviewer

---

# CHAPTER 1: PROJECT OVERVIEW & OVERALL ARCHITECTURE

---

## 1.1 Concept

**lingoConnect** is a full-stack, real-time language exchange platform. It connects people who want to learn a language with native speakers of that language, enabling them to:

- Discover language partners based on their learning goals.
- Send/accept friend requests.
- Chat in real-time using text.
- Video/audio call each other.
- Practice conversational language with an AI tutor (LLaMA 3 via Groq API).
- Summarize their chat conversations using AI.
- Switch between 30+ visual themes.

---

## 1.2 Why It Exists

Language learning is more effective through conversation with real people. Existing apps (like Duolingo) focus on exercises. This app creates a social platform for real-time conversational practice, enhanced by AI when no human partner is available.

---

## 1.3 Technology Stack — Full Decision Map

| Layer | Technology | Why This? | Why NOT alternatives? |
|-------|-----------|-----------|----------------------|
| Frontend Framework | React 19 | Component-based, reactive, massive ecosystem | Next.js adds SSR complexity we don't need for an auth-gated SPA |
| Build Tool | Vite | Extremely fast HMR via native ES modules, near-instant dev server | Create React App is deprecated and slow |
| Styling | TailwindCSS + DaisyUI | Utility-first, rapid UI with theming system | Bootstrap is too opinionated; plain CSS is slow to write |
| HTTP Client | Axios | Interceptors, automatic JSON parsing, better error objects than fetch | fetch requires manual JSON parsing and no built-in interceptors |
| Server State | TanStack Query (React Query) | Caching, background refetch, loading/error states out of the box | Redux Thunk requires more boilerplate; no built-in caching |
| Client State | Zustand | Lightweight, no boilerplate, works outside React components | Redux is overkill for one piece of global state (theme) |
| Routing | React Router v7 | De-facto standard SPA router | TanStack Router is newer but less battle-tested |
| Backend | Node.js + Express | JS everywhere (frontend/backend same language), non-blocking I/O | Django/Spring Boot: different languages, steeper learning curve |
| Database | MongoDB (Atlas) | Flexible document model fits user profiles with varying fields | PostgreSQL: rigid schema, harder to iterate rapidly |
| ODM | Mongoose | Schema validation, hooks, model methods on top of MongoDB driver | Native MongoDB driver: no schema enforcement |
| Auth | JWT + localStorage | Stateless, works cross-origin, scalable without session storage | Sessions require server-side storage; cookies blocked cross-origin |
| Real-time Chat | Stream Chat SDK | Managed WebSocket infrastructure, handles scaling for us | Socket.io: we'd have to build/scale WebSocket servers ourselves |
| Video Calls | Stream Video SDK (WebRTC) | Managed SFU, handles WebRTC signaling & peer connections | Building raw WebRTC: complex, requires STUN/TURN servers |
| AI Language Tutor | Groq API (LLaMA 3.3 70B) | Free tier, extremely fast inference, OpenAI-compatible API | OpenAI GPT-4: costs more; Gemini: slightly different API format |
| Deployment (Frontend) | Vercel | Zero-config, Git integration, automatic HTTPS, edge CDN | Netlify: similar but Vercel has better React ecosystem support |
| Deployment (Backend) | Render | Free tier, auto-deploy from GitHub, managed TLS | Railway: similar; Heroku: no longer has free tier |

---

## 1.4 Overall Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     BROWSER (User's device)                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 React SPA (Vite Build)                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │  Pages   │ │Components│ │  Hooks   │ │  Store   │  │   │
│  │  │(10 pages)│ │(11 comps)│ │(4 hooks) │ │ Zustand  │  │   │
│  │  └────┬─────┘ └──────────┘ └────┬─────┘ └──────────┘  │   │
│  │       │                          │                       │   │
│  │  ┌────▼─────────────────────┐    │                       │   │
│  │  │      React Query Cache   │◄───┘                       │   │
│  │  └────┬─────────────────────┘                            │   │
│  │       │                                                   │   │
│  │  ┌────▼──────────────────────────────┐                   │   │
│  │  │         Axios Instance            │                   │   │
│  │  │  (Bearer Token Interceptor)       │                   │   │
│  │  └────┬──────────────────────────────┘                   │   │
│  └───────┼─────────────────────────────────────────────────┘   │
│          │                                                       │
└──────────┼───────────────────────────────────────────────────--─┘
           │ HTTPS (REST API calls with Authorization: Bearer)
           │
┌──────────▼───────────────────────────────────────────────────────┐
│                   RENDER (Backend Server)                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Express.js App                           │ │
│  │  ┌─────────┐  ┌──────────────┐  ┌──────────────────────┐  │ │
│  │  │  CORS   │  │ cookieParser │  │   express.json()     │  │ │
│  │  │Middleware│  │  Middleware  │  │     Middleware        │  │ │
│  │  └─────────┘  └──────────────┘  └──────────────────────┘  │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │                    Routes                            │  │ │
│  │  │  /api/auth  /api/users  /api/chat  /api/ai           │  │ │
│  │  └──────────────────┬───────────────────────────────────┘  │ │
│  │                     │                                       │ │
│  │  ┌──────────────────▼───────────────────────────────────┐  │ │
│  │  │             protectRoute Middleware                  │  │ │
│  │  │         (JWT from Cookie OR Bearer header)           │  │ │
│  │  └──────────────────┬───────────────────────────────────┘  │ │
│  │                     │                                       │ │
│  │  ┌──────────────────▼───────────────────────────────────┐  │ │
│  │  │                 Controllers                          │  │ │
│  │  │  auth | user | chat | ai                            │  │ │
│  │  └──────────────────┬───────────────────────────────────┘  │ │
│  └─────────────────────┼──────────────────────────────────────┘ │
└────────────────────────┼─────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────────────┐
          │              │                       │
┌─────────▼────┐  ┌──────▼──────┐  ┌────────────▼────────┐
│  MongoDB     │  │ Stream API  │  │    Groq API          │
│  Atlas       │  │ (Chat SDK)  │  │  (LLaMA 3 LLM)       │
│  (Database)  │  │(Video SDK)  │  │  ai.api.groq.com     │
└──────────────┘  └─────────────┘  └─────────────────────┘
```

---

## 1.5 Folder Structure — Every Folder Explained

```
lang_final_feature/               ← Root (monorepo-style)
├── .gitignore                    ← Files git must NOT track (node_modules, .env)
├── package.json                  ← Root-level (no real code here, workspace awareness)
├── backend/                      ← All server-side code
│   ├── .env                      ← Secret keys (NEVER committed to git)
│   ├── package.json              ← Backend dependencies & npm scripts
│   └── src/                      ← Actual application source
│       ├── server.js             ← Entry point: app setup, middleware, route mounting
│       ├── controllers/          ← Business logic (what to do with each request)
│       │   ├── auth.controller.js
│       │   ├── user.controller.js
│       │   ├── chat.controller.js
│       │   └── ai.controller.js
│       ├── routes/               ← URL mapping (which URL goes to which controller)
│       │   ├── auth.route.js
│       │   ├── user.route.js
│       │   ├── chat.route.js
│       │   └── ai.route.js
│       ├── middleware/           ← Functions that run BETWEEN request and controller
│       │   └── auth.middleware.js
│       ├── models/               ← MongoDB schema definitions (Mongoose)
│       │   ├── User.js
│       │   └── FriendRequest.js
│       ├── lib/                  ← Shared utility/service modules
│       │   ├── db.js             ← MongoDB connection
│       │   └── stream.js         ← Stream Chat SDK client
│       └── scripts/              ← One-off utility scripts (seeding, etc.)
│
└── frontend/                     ← All client-side code
    ├── .env                      ← Public env vars (VITE_* prefix only)
    ├── vercel.json               ← Routing rules for Vercel SPA deployment
    ├── vite.config.js            ← Vite bundler configuration
    ├── tailwind.config.js        ← TailwindCSS theme customization
    ├── index.html                ← Single HTML entry point
    └── src/
        ├── main.jsx              ← React tree root: providers wrapping App
        ├── App.jsx               ← Router: maps URLs to pages, handles route protection
        ├── index.css             ← Global CSS (Tailwind base imports)
        ├── pages/                ← Full-page components (one per route)
        │   ├── SignUpPage.jsx
        │   ├── LoginPage.jsx
        │   ├── OnboardingPage.jsx
        │   ├── HomePage.jsx
        │   ├── FriendsPage.jsx
        │   ├── NotificationsPage.jsx
        │   ├── ChatPage.jsx
        │   ├── CallPage.jsx
        │   ├── AIPracticePage.jsx
        │   └── ProfilePage.jsx
        ├── components/           ← Reusable UI pieces (used in multiple pages)
        │   ├── Layout.jsx        ← Shell: Sidebar + Navbar + main content area
        │   ├── Navbar.jsx
        │   ├── Sidebar.jsx
        │   ├── FriendCard.jsx
        │   ├── ChatLoader.jsx
        │   ├── PageLoader.jsx
        │   ├── CallButton.jsx
        │   ├── ChatSummaryModal.jsx
        │   ├── ThemeSelector.jsx
        │   ├── NoFriendsFound.jsx
        │   └── NoNotificationsFound.jsx
        ├── hooks/                ← Custom React Hooks (encapsulate logic + data)
        │   ├── useAuthUser.js    ← Fetch and cache logged-in user
        │   ├── useLogin.js
        │   ├── useSignUp.js
        │   └── useLogout.js
        ├── lib/                  ← Shared utilities
        │   ├── axios.js          ← Axios instance with base URL + auth interceptor
        │   ├── api.js            ← All API function definitions
        │   └── utils.js          ← Helper functions (e.g. capitalize)
        ├── store/                ← Client-side global state (Zustand)
        │   └── useThemeStore.js
        └── constants/            ← Static data
            └── index.js          ← THEMES, LANGUAGES, LANGUAGE_TO_FLAG
```

---

## 1.6 Request Lifecycle — One Full Login Traced

This is the **most important flow** to understand. Follow a login request from click to dashboard:

### Step 1: User clicks "Sign In" button on LoginPage
- React captures the form state: `{ email: "user@example.com", password: "pass123" }`
- `handleLogin(e)` calls `e.preventDefault()` (prevents page reload — normal HTML form behavior).
- Calls `loginMutation(loginData)` — this is `mutate` from TanStack Query's `useMutation`.

### Step 2: useLogin hook fires
```js
// useLogin.js
const { mutate, isPending, error } = useMutation({
  mutationFn: login,          // ← calls api.js login()
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["authUser"] }),
});
```
- `mutationFn: login` is called with `{ email, password }`.
- TanStack Query sets `isPending: true`, triggering the loading spinner in the UI.

### Step 3: api.js login() runs
```js
// api.js
export const login = async (loginData) => {
  const response = await axiosInstance.post("/auth/login", loginData);
  saveToken(response.data.token);   // ← stores JWT in localStorage
  return response.data;
};
```
- Calls `axiosInstance.post("/auth/login", loginData)`.
- Before sending, the Axios interceptor runs (checks localStorage for a token — none exists yet for login).

### Step 4: Axios sends HTTP POST to backend
- Full URL: `https://lang-app-backend-d78w.onrender.com/api/auth/login`
- Request headers include: `Content-Type: application/json`
- Request body (JSON): `{"email":"user@example.com","password":"pass123"}`

### Step 5: Render (backend) receives the request
- Express receives on port 5001 (Render injects this via `process.env.PORT`).
- CORS middleware checks: is `https://langshap.vercel.app` in allowed origins? Yes. Passes.
- `express.json()` middleware parses the JSON body into `req.body`.
- Request matches `router.post("/auth/login", login)` in auth.route.js.
- No `protectRoute` middleware on this route (login is public).

### Step 6: login controller executes (auth.controller.js)
```js
export async function login(req, res) {
  const { email, password } = req.body;
  // 1. Validate fields present
  // 2. Find user in MongoDB
  const user = await User.findOne({ email });
  // 3. Verify password
  const isPasswordCorrect = await user.matchPassword(password);
  // 4. Sign JWT
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "7d" });
  // 5. Set cookie (works in dev; blocked cross-origin in prod)
  res.cookie("jwt", token, { httpOnly: true, sameSite: "none", secure: true });
  // 6. Send response with token in body too
  res.status(200).json({ success: true, user, token });
}
```

### Step 7: Response travels back to frontend
- `api.js` receives `{ success: true, user: {...}, token: "eyJhb..." }`
- `saveToken(response.data.token)` runs → `localStorage.setItem("jwt_token", "eyJhb...")`
- `login()` returns `response.data`.

### Step 8: TanStack Query handles `onSuccess`
- `queryClient.invalidateQueries({ queryKey: ["authUser"] })` marks the `authUser` cache as stale.
- React Query immediately refetches `getAuthUser()` (which calls `/api/auth/me`).

### Step 9: `/api/auth/me` is fetched with the new token
- Axios interceptor reads token from localStorage, adds `Authorization: Bearer eyJhb...` header.
- Backend `protectRoute` middleware extracts, verifies JWT, fetches user, sets `req.user`.
- Returns `{ success: true, user: {...} }`.

### Step 10: App re-renders
- `useAuthUser` hook receives the user data.
- `authUser` is now truthy, `isOnboarded` is checked.
- `App.jsx` redirects to `/` (Home) or `/onboarding`.
- User sees the dashboard.

---

## 1.7 Interview Questions — Chapter 1

### Common Questions
**Q: Describe your project in 30 seconds.**
> "lingoConnect is a real-time language learning social platform. Users sign up, complete a profile with their native and target languages, discover language partners, send friend requests, and chat or video-call each other using Stream's real-time infrastructure. The app also includes an AI conversation partner powered by LLaMA 3 via Groq, and a chat summarization feature. It's built with React on the frontend, Node.js/Express on the backend, MongoDB for data, and deployed on Vercel and Render."

**Q: Why did you use MongoDB instead of PostgreSQL?**
> "User profiles in this app have a naturally document-shaped structure — nested friends arrays, flexible bio fields, optional language properties. MongoDB's document model maps directly to JavaScript objects, allowing rapid schema evolution during development. If I needed strong ACID transactions across multiple collections (e.g., financial data or complex relational queries), I'd have chosen PostgreSQL."

**Q: What does REST mean and does your API follow it?**
> "REST (Representational State Transfer) is an architectural style for APIs. Key constraints include: stateless server (each request contains all info needed, no server-side session), resource-based URLs, HTTP methods as verbs (GET=read, POST=create, PUT=update, DELETE=delete). Yes, my API is RESTful: `/api/users` returns users (GET), `/api/auth/login` logs in (POST), `/api/users/friend-request/:id/accept` accepts (PUT)."

### Senior/Follow-up Questions
**Q: How would you handle 10,000 concurrent chat connections?**
> "Since real-time chat is offloaded to Stream's infrastructure, we don't manage WebSocket connections ourselves. For our REST API, Node's event loop handles thousands of concurrent I/O-bound requests efficiently (each DB call is async/non-blocking). We could add horizontal scaling behind an ALB with multiple Node instances."

**Q: What are the current security weaknesses in your setup?**
> "JWT in localStorage is vulnerable to XSS — if a malicious script runs on the page, it can steal the token. In production, I'd add a strict Content Security Policy (CSP) header to mitigate XSS. I'd also implement rate limiting on auth endpoints, and add input sanitization. The `.env` file containing secrets should never be committed — I'm using Render/Vercel environment variable injection in production."

---

## 1.8 Memory Aids — Chapter 1

### Flashcards
- **What is the entry point of the frontend?** → `main.jsx`
- **What is the entry point of the backend?** → `server.js`
- **Where is JWT stored?** → `localStorage` (key: `jwt_token`)
- **How is JWT sent to the backend?** → `Authorization: Bearer <token>` header via Axios interceptor
- **What makes users visible on Home page?** → `isOnboarded: true` flag in MongoDB
- **What manages server-side state on frontend?** → TanStack Query (React Query)
- **What manages client-side global state?** → Zustand (`useThemeStore`)
- **Why was Stream SDK chosen for chat?** → Managed WebSocket infrastructure, no need to scale our own servers

### Cheat Sheet
```
Frontend: React + Vite + TailwindCSS + DaisyUI + React Router + TanStack Query + Zustand + Axios
Backend:  Node.js + Express + MongoDB + Mongoose + JWT + bcryptjs + cookie-parser + cors
Real-time: Stream Chat SDK (text) + Stream Video SDK (WebRTC video)
AI:       Groq API → LLaMA 3.3-70b-versatile model
Deploy:   Frontend → Vercel | Backend → Render | DB → MongoDB Atlas
Auth:     JWT in localStorage → Axios interceptor → Authorization: Bearer header
```

---
*Continue to Chapter 2: Backend Deep Dive (server.js, middleware, routes, controllers, models)*
