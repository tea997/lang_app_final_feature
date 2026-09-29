# CHAPTER 3: FRONTEND — COMPLETE DEEP DIVE

---

## 3.1 `frontend/src/main.jsx` — Line by Line

### Why This File Exists
This is the **frontend entry point** — Vite and the browser start here. It mounts the React application into the HTML page and wraps it with all global providers.

```js
import { StrictMode } from "react";
```
- `StrictMode` — a React development tool that wraps your app and deliberately double-invokes certain functions (like renders, lifecycle methods, reducer functions) to detect side effects and deprecated patterns.
- In **production builds, StrictMode has zero runtime overhead** — it's completely stripped.
- Common confusion: "Why does my `useEffect` run twice?" → StrictMode in development.

```js
import { createRoot } from "react-dom/client";
```
- New React 18 API for creating a concurrent-mode root. Previously it was `ReactDOM.render()` (deprecated).
- "Concurrent mode" allows React to interrupt, pause, and resume renders — enabling features like `useTransition`, `Suspense`, etc.

```js
import "stream-chat-react/dist/css/v2/index.css";
import "./index.css";
```
- CSS imported here applies globally. Order matters: Stream's CSS loads first, then our custom CSS can override it.
- **Why import CSS in JS?** Vite handles CSS imports in JS files. At build time, it extracts them into a separate `.css` file that's loaded in the HTML `<head>`.

```js
import { BrowserRouter } from "react-router";
```
- `BrowserRouter` provides the routing context. It uses the **HTML5 History API** (`window.history.pushState`, `popstate` event) to manage navigation without full page reloads.
- **Alternative**: `HashRouter` uses URL hash (`#/friends`) — works without server configuration but looks ugly and breaks SEO.

```js
const queryClient = new QueryClient();
```
- Creates the TanStack Query (React Query) cache manager. This is a singleton that stores:
  - Cached query results (keyed by query keys).
  - Query state (loading, error, data).
  - Background refetch timers.

```js
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);
```
**Provider nesting order matters:**
1. `StrictMode` — outermost (dev checks)
2. `BrowserRouter` — provides routing context
3. `QueryClientProvider` — provides React Query context (cache access via `useQueryClient()`)
4. `App` — actual application

If you accidentally placed `QueryClientProvider` outside `BrowserRouter`, `useNavigate()` hooks would fail. Order reflects dependency — `App` needs both routing and query context.

---

## 3.2 How React Works Internally (Deep Dive)

### Virtual DOM
React maintains a **Virtual DOM** — a JavaScript object representation of the actual browser DOM.

```
Real DOM:              Virtual DOM (React's copy):
<div id="root">    →   { type: 'div', props: { id: 'root' }, children: [...] }
  <h1>Hello</h1>       { type: 'h1', props: {}, children: ['Hello'] }
</div>
```

### Reconciliation (The Diffing Algorithm)
When state changes:
1. React creates a NEW Virtual DOM tree.
2. Compares (diffs) new tree with old tree — this is **Reconciliation**.
3. Calculates minimal set of actual DOM mutations.
4. Applies only those mutations to the real DOM (**commit phase**).

**Why Virtual DOM?** Real DOM manipulation is expensive. Calculating changes in a JS object is cheap. This optimization makes React fast for complex UIs with frequent updates.

### React Rendering Phases
1. **Render phase** — React calls your components (pure, no side effects). Produces a new Virtual DOM.
2. **Commit phase** — React updates the real DOM with the diff.
3. **Cleanup** — `useEffect` cleanup runs.

### When Does a Component Re-Render?
- State changes (`useState`, `useReducer`).
- Props change.
- Parent component re-renders (by default, even if props didn't change — mitigated by `React.memo`).
- Context value changes.

---

## 3.3 `frontend/src/App.jsx` — Line by Line

### Why This File Exists
Defines the routing structure of the entire application. Maps URL paths to page components. Implements route protection logic.

```js
const { isLoading, authUser } = useAuthUser();
```
- `isLoading` — true while the `GET /api/auth/me` request is in-flight.
- `authUser` — the logged-in user object (or null/undefined if not logged in).

```js
if (isLoading) return <PageLoader />;
```
- **Critical pattern**: While checking authentication (initial page load), show a spinner. Without this, the app would briefly render the Login page even for authenticated users, causing a flash.
- This is called **flash of unauthenticated content (FOUC)** — always prevent it.

```js
const isAuthenticated = Boolean(authUser);
const isOnboarded = authUser?.isOnboarded;
```
- `Boolean(null)` → `false`. `Boolean({...})` → `true`. Simple conversion.
- `authUser?.isOnboarded` — optional chaining. If `authUser` is null/undefined, returns `undefined` instead of throwing `TypeError`.

### Route Protection Pattern
```js
<Route
  path="/"
  element={
    isAuthenticated && isOnboarded ? (
      <Layout showSidebar={true}><HomePage /></Layout>
    ) : (
      <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
    )
  }
/>
```
**Logic breakdown:**
- If authenticated AND onboarded → show HomePage.
- If NOT authenticated → go to `/login`.
- If authenticated but NOT onboarded → go to `/onboarding`.

This is a common React Router protection pattern. The `<Navigate>` component programmatically redirects without a link click.

---

## 3.4 React Router — Deep Internals

### How Browser History API Works
```js
// Push state (navigate forward, no server request)
window.history.pushState({}, "", "/friends");

// Listen for back/forward button
window.addEventListener("popstate", (event) => { ... });
```

React Router's `BrowserRouter`:
1. Wraps the History API in a React context.
2. Provides `useNavigate()`, `useLocation()`, `useParams()` hooks.
3. `<Routes>` renders the component matching the current URL.
4. `<Navigate>` calls `navigate()` during render.
5. `<Link>` calls `navigate()` on click, preventing `<a>` tag's default page reload.

### Why We Need `vercel.json`
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
When a user visits `https://langshap.vercel.app/friends` directly:
- Vercel's server looks for a file at path `/friends`.
- No such file exists (only `index.html` and assets).
- **Without `vercel.json`**: Returns 404.
- **With `vercel.json`**: Returns `index.html`. React Router then reads the URL and renders the Friends page. ✅

---

## 3.5 All Custom Hooks — Deep Dive

### `useAuthUser.js`
```js
const useAuthUser = () => {
  const authUser = useQuery({
    queryKey: ["authUser"],
    queryFn: getAuthUser,
    retry: false,
  });
  return { isLoading: authUser.isLoading, authUser: authUser.data?.user };
};
```

**TanStack Query Internals:**
- `queryKey: ["authUser"]` — a unique identifier for this query. React Query uses it for caching and invalidation.
- `queryFn: getAuthUser` — the async function that fetches data.
- `retry: false` — don't retry on failure. If `/auth/me` returns 401, we don't want it to retry 3 times before showing the login page.
- `authUser.data?.user` — the response from `getAuthUser` is `{ user: {...} }`. We extract `.user`.

**React Query Cache Lifecycle:**
1. First mount: cache MISS → makes API request → stores result.
2. Component unmounts, remounts: cache HIT → returns cached data instantly → optionally refetches in background.
3. `queryClient.invalidateQueries(["authUser"])` — marks cache as stale → next access triggers refetch.

**Why React Query instead of `useEffect` + `useState`?**
```js
// WITHOUT React Query (boilerplate hell):
const [user, setUser] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  setLoading(true);
  getAuthUser()
    .then(data => { setUser(data.user); setLoading(false); })
    .catch(err => { setError(err); setLoading(false); });
}, []);

// WITH React Query (clean):
const { data, isLoading, error } = useQuery({ queryKey: ["authUser"], queryFn: getAuthUser });
```
React Query also adds: caching, background updates, stale-while-revalidate, deduplication (if 5 components call the same query simultaneously, only ONE HTTP request is made).

### `useLogin.js`
```js
const { mutate, isPending, error } = useMutation({
  mutationFn: login,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["authUser"] }),
});
return { error, isPending, loginMutation: mutate };
```

**`useMutation` vs `useQuery`:**
- `useQuery` — for **reading** data. Fetches automatically.
- `useMutation` — for **writing** data. Fires only when you call `mutate()`.

**The `onSuccess` pattern:**
- After successful login, we don't manually set `authUser` state.
- We invalidate the `authUser` query → React Query refetches from backend.
- Backend returns the full user object.
- App re-renders with authenticated state.
- This is the "single source of truth" principle — all components get user data from the same cache.

### `useLogout.js`
```js
const { mutate: logoutMutation } = useMutation({
  mutationFn: logout,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["authUser"] }),
});
```
After logout:
1. `logout()` in `api.js` calls `/auth/logout` → backend clears cookie.
2. `clearToken()` removes token from localStorage.
3. `queryClient.invalidateQueries(["authUser"])` → `/auth/me` is refetched.
4. `/auth/me` now gets 401 (no valid token).
5. `getAuthUser` catches the error and returns `null`.
6. `authUser` is null → `isAuthenticated` is false → `<Navigate to="/login" />`.

---

## 3.6 `frontend/src/lib/axios.js` — Deep Dive

```js
const BASE_URL = import.meta.env.MODE === "development"
  ? `http://${window.location.hostname}:5001/api`
  : (import.meta.env.VITE_API_BASE_URL || "/api");
```

**`import.meta.env`**: Vite's way of accessing environment variables. At build time, Vite replaces all `import.meta.env.VITE_*` references with their literal values. The built `index.js` contains the actual URL string.

**`import.meta.env.MODE`**: `"development"` during `vite dev`, `"production"` during `vite build`.

**`window.location.hostname`**: Returns the current host (e.g., `192.168.1.100` or `localhost`). This allows the dev server to work on any network — teammates on different IPs in the same LAN can access the app.

**`import.meta.env.VITE_*` prefix**: ONLY variables prefixed with `VITE_` are exposed to the browser bundle. Variables without this prefix (like `MONGO_URI`) are filtered out by Vite — a security feature.

```js
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```
**Axios Interceptor Internals:**
- `interceptors.request.use(fn)` — registers a function that runs on every request BEFORE it's sent.
- `config` — the Axios request configuration object (url, method, headers, data...).
- We mutate `config.headers.Authorization` and return the modified config.
- If `token` is null (not logged in), no Authorization header is added.

**Why localStorage and not sessionStorage?**
- `localStorage` persists across browser restarts.
- `sessionStorage` is cleared when the tab/window closes.
- For a "remember me" experience (7-day sessions), `localStorage` is appropriate.

---

## 3.7 `frontend/src/lib/api.js` — Every Function

```js
export const getAuthUser = async () => {
  try {
    const res = await axiosInstance.get("/auth/me");
    return res.data;
  } catch (error) {
    console.log("Error in getAuthUser:", error);
    return null;  // ← Returns null instead of throwing
  }
};
```
**Why `return null` instead of re-throwing?**
This function is used by `useAuthUser` to check login status. A 401 is NOT an unexpected error — it's the expected response for unauthenticated users. Returning `null` allows `App.jsx` to cleanly handle the unauthenticated case without React Query entering an error state.

```js
export const sendFriendRequest = async (userId) => {
  const response = await axiosInstance.post(`/users/friend-request/${userId}`);
  return response.data;
};
```
**URL construction**: Template literal with `userId` interpolated into the path. The `/` prefix is relative to `BASE_URL` (`/api`), so this becomes `/api/users/friend-request/507f1f77bcf86cd799439011`.

---

## 3.8 Pages — Every Page Explained

### `HomePage.jsx`
**Two parallel queries run simultaneously:**
```js
const { data: recommendedUsers = [] } = useQuery({
  queryKey: ["users"],
  queryFn: getRecommendedUsers,
});

const { data: outgoingFriendReqs } = useQuery({
  queryKey: ["outgoingFriendReqs"],
  queryFn: getOutgoingFriendReqs,
});
```
Both queries run in parallel (React Query fires both immediately). The page renders progressively as each resolves.

**The `outgoingRequestsIds` Set pattern:**
```js
const [outgoingRequestsIds, setOutgoingRequestsIds] = useState(new Set());

useEffect(() => {
  const outgoingIds = new Set();
  if (outgoingFriendReqs && outgoingFriendReqs.length > 0) {
    outgoingFriendReqs.forEach((req) => outgoingIds.add(req.recipient._id));
    setOutgoingRequestsIds(outgoingIds);
  }
}, [outgoingFriendReqs]);
```
**Why a `Set`?** Sets have O(1) lookup (`has()`). Checking `outgoingRequestsIds.has(user._id)` for each user card is instant regardless of how many pending requests exist. An array would be O(n) per check.

**Why `useEffect` not computed during render?** Building the Set from `outgoingFriendReqs` is a derived computation. You could use `useMemo` instead (which is cleaner):
```js
const outgoingRequestsIds = useMemo(() => {
  return new Set(outgoingFriendReqs?.map(req => req.recipient._id));
}, [outgoingFriendReqs]);
```
This would be a code review suggestion.

### `ChatPage.jsx` — Stream Chat Integration

**Flow:**
1. `useParams()` gets `targetUserId` from URL (e.g., `/chat/507f...`).
2. `useAuthUser()` gets the logged-in user.
3. `useQuery(["streamToken"])` fetches a Stream token from our backend.
4. `useEffect` initializes the Stream chat client when both `tokenData` and `authUser` are available.

```js
const client = StreamChat.getInstance(STREAM_API_KEY);
await client.connectUser(
  { id: authUser._id, name: authUser.fullName, image: authUser.profilePic },
  tokenData.token
);
```
- `STREAM_API_KEY` alone (no secret) — client-side, read-only permissions.
- `connectUser()` authenticates the user with Stream's WebSocket server. Opens a persistent connection.

```js
const channelId = [authUser._id, targetUserId].sort().join("-");
```
**Clever channel ID generation:**
- `[A_id, B_id].sort()` ensures the same ID regardless of who initiates: `[B, A].sort() === [A, B].sort()`.
- Joining creates: `"507fabc-507fdef"`.
- If A→B chat and B→A chat would create different channel IDs, you'd have duplicate channels. Sorting prevents this.

```js
const currChannel = client.channel("messaging", channelId, {
  members: [authUser._id, targetUserId],
});
await currChannel.watch();
```
- `"messaging"` — Stream channel type. Defines permissions (who can send, read, etc.).
- `watch()` — subscribes to real-time events on this channel. This establishes the WebSocket subscription.
- After `watch()`, `Stream-chat-react` components (`<MessageList />`, etc.) are live-connected.

### WebSockets — Deep Internals
**Traditional HTTP polling:** Client asks "Any new messages?" every 1 second. Wasteful.
**WebSockets:** A persistent, bidirectional TCP connection. Server can PUSH messages to client without client asking.

WebSocket handshake:
1. Client sends HTTP request with `Upgrade: websocket` header.
2. Server responds with `101 Switching Protocols`.
3. Connection is now a WebSocket — persistent, bidirectional.

Stream SDK manages this entire complexity — we just call `client.connectUser()` and `channel.watch()`.

### `CallPage.jsx` — Stream Video & WebRTC

```js
const videoClient = new StreamVideoClient({
  apiKey: STREAM_API_KEY,
  user,
  token: tokenData.token,
});

const callInstance = videoClient.call("default", callId);
await callInstance.join({ create: true });
```
- `callId` comes from the URL parameter — the same channel ID used in chat (so the call link in chat navigates to the right call).
- `{ create: true }` — creates the call if it doesn't exist (for the first person to join), or joins an existing call.

**WebRTC Internals:**
1. **Signaling**: Stream servers facilitate the initial connection setup (SDP offer/answer exchange, ICE candidate exchange) via WebSockets.
2. **Media**: After signaling, audio/video flows **peer-to-peer** (or through Stream's SFU for group calls).
3. **SFU (Selective Forwarding Unit)**: A server that receives each participant's video stream and selectively forwards it to others. More scalable than full mesh peer-to-peer.

```js
const CallContent = () => {
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  if (callingState === CallingState.LEFT) return navigate("/");
  // ...
};
```
`CallingState.LEFT` — Stream emits this state when the call ends. We navigate home.

### `AIPracticePage.jsx` — Detailed Analysis

**Session management state:**
```js
const [scenario, setScenario] = useState("general");
const [proficiency, setProficiency] = useState("intermediate");
const [messages, setMessages] = useState([]);  // conversation history
const [input, setInput] = useState("");
const [isLoading, setIsLoading] = useState(false);
const [sessionStarted, setSessionStarted] = useState(false);
```

**The `handleSend` function:**
```js
const handleSend = async () => {
  if (!input.trim() || isLoading) return;  // guard clause
  const userMessage = { role: "user", content: input.trim(), id: Date.now() };
  const newMessages = [...messages, userMessage];  // immutable update
  setMessages(newMessages);
  setInput("");
  setIsLoading(true);

  const { reply } = await sendAiMessage({
    messages: newMessages,        // entire conversation history
    language, nativeLanguage, proficiency, scenario
  });

  setMessages(prev => [...prev, { role: "assistant", content: reply, id: Date.now() + 1 }]);
};
```
**Key insight**: We send the ENTIRE conversation history to the AI on every message. This is how LLMs maintain conversational context — they don't have memory; they receive the full history each time. This means long conversations become expensive (more tokens = higher API cost/latency).

**The `parseMessage` function:**
```js
const parseMessage = (content) => {
  const correctionMatch = content.match(/(📝 \*Small correction:[\s\S]*)/);
  const parts = messageText.split("---");
  return { targetText, nativeText, correction };
};
```
The AI's response has a structured format that the frontend PARSES into separate UI elements:
- `targetText` — shown in the main bubble.
- `nativeText` — shown in a translation bubble below.
- `correction` — shown in a yellow correction bubble.

This **structured AI output → UI rendering** pattern is sophisticated and interview-worthy.

### `OnboardingPage.jsx`

```js
const handleRandomAvatar = () => {
  const idx = Math.floor(Math.random() * 100) + 1;
  const randomAvatar = `https://api.dicebear.com/9.x/avataaars/svg?seed=${idx}`;
  setFormState({ ...formState, profilePic: randomAvatar });
};
```
**DiceBear API**: A deterministic avatar generator. The same `seed` always produces the same avatar. Seeds 1-100 give 100 distinct avatar options. The SVG URL is stored as the `profilePic` string in MongoDB — no actual image upload is needed.

---

## 3.9 Components — Key Components Explained

### `Layout.jsx`
```js
const Layout = ({ children, showSidebar = false }) => (
  <div className="min-h-screen">
    <div className="flex">
      {showSidebar && <Sidebar />}
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  </div>
);
```
**Composition pattern**: `Layout` receives `children` props — whatever is placed between `<Layout>` tags. This allows different pages to share the same header/sidebar shell without code duplication.
**`showSidebar` prop**: Chat page uses `<Layout showSidebar={false}>` — no sidebar on the chat screen (more space for messages).

### `Sidebar.jsx`

```js
const location = useLocation();
const currentPath = location.pathname;
```
**Active link highlighting**: `useLocation()` returns the current URL info. We compare `currentPath` against each link's `to` prop to apply `btn-active` CSS class to the current page's link.

### `ChatSummaryModal.jsx`

**The custom markdown renderer:**
```js
text.split("\n").forEach((line) => {
  if (line.startsWith("## ")) {
    currentSection = { heading: line.replace("## ", ""), items: [] };
  } else if (currentSection) {
    currentSection.items.push(line.trim());
  }
});
```
The AI returns markdown-formatted text (`## Overall Summary`, `- bullet points`). Instead of using a markdown library (adding bundle size), we wrote a **custom parser** that converts the AI's specific output format into native DaisyUI components. This is more efficient and matches our app's design.

**Interview question**: *Why not use a markdown library like react-markdown?*
> "For this specific use case, the AI output follows a consistent, predictable structure (section headers with `##`, bullet points with `-`). A custom parser handles exactly what we need without the overhead of a full markdown library. It also gives us control to render each section as native DaisyUI card components, perfectly matching the app's design system."

---

## 3.10 State Management — Zustand vs Redux

### `useThemeStore.js`
```js
export const useThemeStore = create((set) => ({
  theme: localStorage.getItem("lingoconnect-theme") || localStorage.getItem("streamify-theme") || "coffee",
  setTheme: (theme) => {
    localStorage.setItem("lingoconnect-theme", theme);
    set({ theme });
  },
}));
```

**Zustand internals:**
- `create()` takes a function that receives `set` (state setter) and returns the initial state object.
- Components subscribe to only the parts of the store they use.
- When `set({ theme })` is called, Zustand runs React's render for all subscribed components.

**Why Zustand not Redux?**
- Redux requires: `Action types`, `Action creators`, `Reducers`, `Store`, `connect()` or `useSelector/useDispatch`.
- Zustand requires: one `create()` call.
- For ONE piece of global state (the theme), Zustand's simplicity wins.
- Redux shines for complex state with many actions, middleware, and time-travel debugging needs.

**Why not React Context?**
- Context causes ALL consumers to re-render when ANY context value changes.
- Zustand only re-renders components that subscribed to the specific state that changed.

**localStorage persistence**: Theme is saved to localStorage so it persists across page refreshes and browser restarts.

---

## 3.11 Interview Questions — Chapter 3

**Q: How does TanStack Query prevent duplicate API calls?**
> "React Query uses the `queryKey` as a cache key. If 10 components all call `useQuery({ queryKey: ['authUser'], queryFn: getAuthUser })` simultaneously, React Query deduplicates them into a SINGLE network request. All 10 components share the same cached result. This is called 'request deduplication' and is one of React Query's killer features."

**Q: How does React Router protect routes without a server?**
> "React Router works entirely in the browser via the History API. `<Routes>` checks the current URL and renders the matching component or a `<Navigate>` component. If the user is unauthenticated, we render `<Navigate to='/login' />`, which programmatically updates the URL to `/login`. No server round-trip occurs — it's all client-side JavaScript checking a condition and updating the URL."

**Q: What's the difference between `useEffect` and `useMemo`?**
> "`useEffect` handles side effects — operations outside React's rendering cycle (API calls, subscriptions, DOM manipulation). It runs AFTER render. `useMemo` memoizes a computed value — it runs DURING render. The `outgoingRequestsIds` Set computation in `HomePage` would be better as `useMemo(() => new Set(...), [outgoingFriendReqs])` since it's a pure derived value, not a side effect."

**Q: Why is the conversation history sent to Groq on every message?**
> "LLMs are stateless — they have no memory between API calls. To simulate a conversation, we send the COMPLETE history of messages (system prompt + all previous user/assistant turns) with every request. The model uses this history as context. This is the `messages` array format used by OpenAI/Groq: `[{role: 'system', content: '...'}, {role: 'user', content: '...'}, {role: 'assistant', content: '...'}]`."

**Q: What does `React.StrictMode` do?**
> "StrictMode helps identify potential problems by intentionally double-invoking component functions, state updater functions, and effects in development mode. If your code has unintended side effects (like modifying external variables in render), double-invocation exposes them. In production builds, StrictMode is completely removed — zero overhead."

**Q: What is the significance of the sorted channel ID in ChatPage?**
> "The channel ID `[userA, userB].sort().join('-')` ensures that the chat between User A and User B always has the same ID, regardless of who initiates the conversation. If we used `[authUser._id, targetUserId].join('-')` without sorting, User A → B would create channel `A-B` while B → A would create `B-A` — two separate channels for the same pair. Sorting makes the operation commutative."

---

## 3.12 Memory Aids — Chapter 3

### Flashcards
- **Why `StrictMode` double-invokes functions?** → To expose unintended side effects during development
- **What does `BrowserRouter` use?** → HTML5 History API (`pushState`, `popstate`)
- **Why `queryKey` matters in React Query?** → Cache key for deduplication and invalidation
- **What does `invalidateQueries` do?** → Marks cache as stale, triggers background refetch
- **How is Stream channel ID calculated?** → `[userId, targetUserId].sort().join("-")`
- **What is `channel.watch()`?** → Opens WebSocket subscription to receive real-time events
- **What is Zustand's `set()`?** → Updates store state and re-renders subscribed components
- **Why send full conversation to AI?** → LLMs are stateless — context comes from the messages array

### Cheat Sheet — Data Flow
```
User clicks → React Handler → useMutation → api.js fn → Axios interceptor adds token
→ HTTP request → Express → middleware → controller → MongoDB/Stream/Groq
→ Response → Axios → api.js return → React Query cache → component re-render

Key Query Keys:
  ["authUser"]         → user's own profile
  ["users"]            → recommended users list
  ["friends"]          → user's friends list
  ["friendRequests"]   → incoming/accepted requests
  ["outgoingFriendReqs"] → sent requests
  ["streamToken"]      → Stream API token

Zustand Store:
  theme: string        ← from localStorage, defaults to "coffee"
  setTheme(t): void    ← saves to localStorage + updates store
```
