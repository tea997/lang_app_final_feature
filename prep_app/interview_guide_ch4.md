# CHAPTER 4: SYSTEM DESIGN, SCALABILITY, AND SECURITY

---

## 4.1 System Design & Scalability

An interviewer will likely ask: *"How would you scale this application from 1,000 users to 1,000,000 users?"*

### Current Architecture Limitations
1. **Single Database Instance**: We're using a single MongoDB Atlas cluster. Under massive load, read/write contention will bottleneck.
2. **Backend Scalability**: A single Render web service instance.
3. **No Caching**: Every time a user visits the home page, the backend queries MongoDB for `getRecommendedUsers`. If 10,000 users log in at once, the DB will crash.

### Scaling Strategy (Step-by-Step)

#### 1. Horizontal Scaling (Web Tier)
Node.js is single-threaded. To handle more concurrent HTTP requests:
- Run multiple Node.js instances behind a **Load Balancer** (e.g., AWS ALB, Nginx).
- The Load Balancer routes incoming traffic in a Round-Robin fashion across instances.
- **Why this works**: Our backend is entirely **stateless**. Authentication uses JWT (which contains all necessary info and doesn't require session lookups), meaning any Node instance can handle any request.

#### 2. Caching Layer (Redis)
Database reads are slow. We should introduce **Redis** (an in-memory key-value store).
- **Caching Recommended Users**: The result of `getRecommendedUsers` can be cached in Redis with a TTL (Time To Live) of 5 minutes.
- **Caching Auth Profiles**: Instead of hitting MongoDB in `protectRoute` on every request, we could cache the user profile in Redis using the `userId` as the key.
- **Cache Invalidation**: The hardest part. When a user updates their profile, we must invalidate/update their cached entry.

#### 3. Database Scaling (Data Tier)
When a single MongoDB instance is maxed out:
- **Read Replicas**: Route all writes to the Primary node, but route all reads (e.g., fetching friends) to Secondary read-only nodes.
- **Sharding**: If data size exceeds one machine's capacity, MongoDB can distribute data across multiple machines based on a **Shard Key** (e.g., hashing the `_id`).

#### 4. Content Delivery Network (CDN)
- We already use Vercel, which acts as a global CDN. Static assets (HTML, CSS, JS, images) are cached at edge nodes geographically close to users, reducing latency and backend load.

#### 5. Real-Time Infrastructure (Stream)
- We don't need to scale WebSocket servers because **Stream SDK** handles it. They manage distributed WebSocket clusters. Our backend just generates a token.
- *Alternative*: If we built chat ourselves with Socket.io, we'd need **Redis Pub/Sub** to broadcast messages across multiple horizontally scaled Node.js servers.

---

## 4.2 Deployment Flow Internals

### Frontend: Vercel
1. **Build Process**: We use `vite build`. Vite bundles all React JSX, CSS, and assets into minified static files in the `/dist` directory.
2. **Deployment**: Vercel takes the `/dist` folder and distributes it across its global edge network.
3. **Routing (`vercel.json`)**: Configured to rewrite all routes to `/index.html` so React Router can handle client-side routing.
4. **Environment Variables**: `VITE_API_BASE_URL` is injected at build time, hardcoding the production backend URL into the bundled JavaScript.

### Backend: Render
1. **Build Process**: Render runs `npm install`.
2. **Start Process**: Render runs `node src/server.js`.
3. **Port Binding**: Render injects a dynamic `PORT` environment variable. Our app must listen on this port, otherwise Render will mark the deploy as failed.
4. **Environment Variables**: Secrets like `JWT_SECRET_KEY`, `MONGO_URI`, and `STEAM_API_KEY` are securely injected at runtime.
5. **HTTPS**: Render terminates SSL. Our Node app actually receives unencrypted HTTP traffic from Render's load balancer, which handles the HTTPS encryption with the outside world.

---

## 4.3 Security Deep Dive

### 1. Cross-Site Scripting (XSS)
**What it is**: An attacker injects malicious JavaScript into the application, which then executes in another user's browser.
**How it affects us**: Our JWT is stored in `localStorage`. If an attacker executes JS on our page, they can read `localStorage.getItem('jwt_token')` and steal the token, gaining full access to the account.
**Mitigation**:
- React naturally escapes variables in JSX (e.g., `<div>{user.bio}</div>` will render as text, not HTML).
- **Content Security Policy (CSP)**: We should configure HTTP headers to only allow scripts from trusted domains.

### 2. Cross-Site Request Forgery (CSRF)
**What it is**: An attacker tricks a user's browser into executing an unwanted action on a trusted site where they are authenticated.
**How it affects us**: If we used `HttpOnly` cookies for authentication, the browser would automatically attach the cookie to any request sent to our backend domain, even if the request originated from `evil-site.com`.
**Mitigation**:
- We use `Authorization: Bearer <token>` instead of relying solely on cookies. Browsers do not automatically attach custom headers to cross-origin requests. The token must be explicitly read by our JavaScript and attached, which `evil-site.com` cannot do.

### 3. Cross-Origin Resource Sharing (CORS)
**What it is**: A browser security mechanism that restricts web pages from making requests to a different domain than the one that served the web page.
**Implementation in our app**:
- The backend uses the `cors` middleware to explicitly allow `https://langshap.vercel.app`.
- If an unauthorized site tries to call our API, the backend will reject it, and the browser will block the response.

### 4. Rate Limiting (Missing Feature)
Currently, an attacker could write a script to hit `/api/auth/login` 10,000 times a second (brute force attack).
**Improvement**: Implement `express-rate-limit`.
```js
import rateLimit from "express-rate-limit";
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use("/api/", apiLimiter);
```

### 5. Input Validation (Missing Feature)
Currently, Mongoose handles validation, but it happens at the DB layer.
**Improvement**: Use a library like `Zod` or `Joi` to validate `req.body` *before* it hits the controller logic. This prevents unnecessary DB operations and provides better error messages.

---

## 4.4 Debugging Common Issues

### Issue 1: "CORS blocked the request"
- **Why**: The frontend URL does not match the `FRONTEND_URL` allowed in the backend CORS configuration.
- **Fix**: Ensure `process.env.FRONTEND_URL` on Render exactly matches the Vercel URL, without a trailing slash. Our backend regex handles trailing slashes dynamically just in case.

### Issue 2: "User logged out on refresh in Production"
- **Why**: Originally, we relied on an `HttpOnly` cookie for auth. Browsers block cross-site cookies (Vercel to Render) by default unless strict rules are met (`SameSite=None; Secure`). Safari blocks them entirely.
- **Fix**: We migrated to a hybrid approach. The backend returns the token in the JSON body, and the frontend stores it in `localStorage`, appending it as a `Bearer` header on every request via an Axios interceptor.

### Issue 3: "React Query infinite loading"
- **Why**: A query function failed but didn't throw an error properly, or the query key wasn't invalidated correctly.
- **Fix**: Ensure query functions return data or throw errors. Use `queryClient.invalidateQueries` in mutations.

---

## 4.5 Code Review & Improvements

If an interviewer asks you to critique your own code, mention these improvements:

1. **Pagination/Infinite Scroll**: `getRecommendedUsers` fetches all matching users. This won't scale. We need to implement pagination (e.g., `?page=1&limit=20`) using MongoDB `skip()` and `limit()`, and React Query's `useInfiniteQuery`.
2. **Database Transactions**: In `acceptFriendRequest`, we update two different user documents sequentially. If the server crashes between the two updates, data is inconsistent. We should use Mongoose transactions.
3. **Env Var Typo**: Fix `STEAM_API_KEY` to `STREAM_API_KEY` to avoid confusion.
4. **Rate Limiting**: Especially crucial for the `/api/ai/chat` route to prevent abuse and high Groq API bills.
5. **Typescript**: The project is in JavaScript. Migrating to TypeScript would catch many runtime errors at compile time and improve developer experience with better autocomplete.

---

## 4.6 Interview Questions — Chapter 4

**Q: Explain horizontal vs. vertical scaling.**
> "Vertical scaling (scaling up) means adding more CPU, RAM, or storage to an existing server. It's simple but has a hard physical limit and creates a single point of failure. Horizontal scaling (scaling out) means adding more servers and distributing traffic across them using a load balancer. It offers near-infinite scalability and high availability, but requires a stateless architecture (like our JWT setup)."

**Q: What is a reverse proxy?**
> "A reverse proxy is a server that sits in front of backend servers and forwards client requests to them. Nginx is a common example. It handles tasks like load balancing, SSL termination (decrypting HTTPS so the backend Node app doesn't have to), caching, and compression, protecting the backend servers from direct internet exposure."

**Q: How does `SameSite` cookie attribute work?**
> "`SameSite` controls whether cookies are sent with cross-site requests. `Strict` means the cookie is only sent if the request originates from the same site. `Lax` (default) allows it for top-level navigations (like clicking a link). `None` allows the cookie to be sent on cross-site requests (e.g., our Vercel frontend calling our Render backend API), but it MUST be paired with the `Secure` attribute (HTTPS only). Safari's Intelligent Tracking Prevention (ITP) often blocks `SameSite=None` cookies anyway, which is why we moved to `localStorage` + Headers."

**Q: If you used Redis for caching, what is a cache stampede and how do you prevent it?**
> "A cache stampede occurs when a popular cache key expires, and simultaneously, thousands of requests hit the server. They all find a cache miss and hit the database at the exact same time, crashing it. Prevent it using techniques like 'probabilistic early expiration' or adding a mutex lock so only the first request queries the DB and repopulates the cache while others wait."

---

## 4.7 Memory Aids — Chapter 4

### Flashcards
- **What is horizontal scaling?** → Adding more servers behind a load balancer
- **What does a Load Balancer do?** → Distributes incoming traffic across multiple servers
- **What is CSRF?** → Forcing a user's browser to execute unwanted actions on a trusted site
- **Why is JWT immune to CSRF?** → Browsers don't automatically send custom headers (like Authorization), unlike cookies
- **What is XSS?** → Injecting malicious JS into a page to steal data (like localStorage tokens)
- **What is Rate Limiting?** → Restricting the number of requests a user/IP can make in a given timeframe
- **What does `vite build` do?** → Bundles React code into static HTML/CSS/JS files for production
- **Why did we stop relying entirely on cookies?** → Cross-origin cookies (Vercel -> Render) are aggressively blocked by modern browsers (Safari)

### Cheat Sheet — Scaling Checklist
- [ ] Stateless backend (JWT)
- [ ] Load Balancer
- [ ] Redis Caching (for heavy reads)
- [ ] MongoDB Read Replicas
- [ ] MongoDB Sharding
- [ ] Pagination on API endpoints
- [ ] CDN for frontend assets
- [ ] Rate Limiting on API
