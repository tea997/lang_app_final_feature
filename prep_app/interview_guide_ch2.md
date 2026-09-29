# CHAPTER 2: BACKEND — COMPLETE DEEP DIVE

---

## 2.1 `backend/src/server.js` — Line by Line

### Why this file exists
This is the **entry point** of the Node.js backend application. When `npm start` runs `node src/server.js`, this file executes first. It:
1. Creates the Express application instance.
2. Registers global middleware (CORS, JSON parsing, cookie parsing).
3. Mounts route handlers.
4. Connects to MongoDB.
5. Starts listening on a port.

### Imports Analysis (Every Import Explained)

```js
import express from "express";
```
- **What it is**: Express.js is a minimal web framework for Node.js. It wraps Node's built-in `http` module, making it easy to define routes and middleware.
- **Why we need it**: Without Express, we'd have to write raw `http.createServer((req, res) => {...})` — parsing URLs, bodies, and headers manually. Express abstracts this.
- **How it works internally**: When you call `app.use(middleware)`, Express maintains an ordered array of middleware functions. For each incoming request, it executes them in order via a `next()` chain.

```js
import "dotenv/config";
```
- **What it is**: The `dotenv` package reads the `.env` file and loads its key-value pairs into `process.env`.
- **Why we need it**: `process.env.PORT`, `process.env.MONGO_URI`, etc., are `undefined` without this. We can't hardcode secrets in source code (security risk, inflexibility across environments).
- **The `dotenv/config` syntax**: This is the ESM-compatible way of importing dotenv. It side-effectfully runs the configuration immediately on import.

```js
import cookieParser from "cookie-parser";
```
- **What it is**: A middleware that parses the `Cookie` HTTP request header into a JavaScript object accessible at `req.cookies`.
- **Why we need it**: Without it, `req.cookies` would be `undefined`. We read `req.cookies.jwt` in `auth.middleware.js`.
- **How cookies work internally**: When a server sends `Set-Cookie: jwt=eyJh...; HttpOnly; Secure` in a response, the browser stores it and automatically sends `Cookie: jwt=eyJh...` in every subsequent request to that domain. `cookie-parser` turns that raw header string into a JS object.

```js
import cors from "cors";
```
- **What it is**: A middleware that adds the `Access-Control-Allow-Origin` and related headers to HTTP responses.
- **Why we need it**: Browsers enforce the **Same-Origin Policy (SOP)** — scripts on `langshap.vercel.app` are NOT allowed to make requests to `lang-app-backend.onrender.com` unless the backend explicitly says so via CORS headers.
- **What happens without it**: Browser blocks the response and throws a CORS error — which is exactly the first bug you saw in deployment.

```js
import path from "path";
```
- **What it is**: Node.js built-in module for working with file and directory paths.
- **Why we need it**: Used with `path.resolve()` to set `__dirname` (not natively available in ES Modules), and potentially to serve the frontend's static files.

```js
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import aiRoutes from "./routes/ai.route.js";
```
- Each import is a router object from Express — a mini-application with its own route definitions.

```js
import { connectDB } from "./lib/db.js";
```
- A function that establishes the Mongoose connection to MongoDB Atlas.

---

### Line-by-Line Code Explanation

```js
const app = express();
```
- Creates the Express application instance. `app` is an object that accumulates middleware and routes, and listens on a port.

```js
const PORT = process.env.PORT;
```
- Reads port from environment. **Critical production pattern**: Render injects `PORT` dynamically (usually 10000, not 5001). If hardcoded to 5001, the app would fail on Render.
- **Interview gotcha**: Why is `PORT` an env variable? Because on cloud platforms, the platform assigns the port. Your app must listen on whatever port the platform provides.

```js
const __dirname = path.resolve();
```
- In ES Modules (`"type": "module"` in package.json), `__dirname` is NOT defined (it's a CommonJS concept). `path.resolve()` with no arguments returns the current working directory — functionally equivalent.
- **Why we need it**: Used below to potentially serve frontend static files.

```js
app.use(
  cors({
    origin: (origin, callback) => {
      const frontendUrl = process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.replace(/\/$/, "")
        : null;
      const allowedOrigins = [frontendUrl].filter(Boolean);

      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\...)/.test(origin)
      ) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked for origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
```

**Deep CORS Internals:**
- `origin: (origin, callback)` — dynamic origin function. Called for EVERY request.
- `!origin` — requests with no Origin header (server-to-server calls, Postman by default, curl) are allowed. Browsers always send an Origin header.
- `.replace(/\/$/, "")` — strips trailing slash to prevent `"https://langshap.vercel.app/"` vs `"https://langshap.vercel.app"` mismatches.
- `.filter(Boolean)` — removes `null` if `FRONTEND_URL` isn't set.
- `credentials: true` — essential. Tells the browser that cookies and Authorization headers can be sent cross-origin. Also causes the response to include `Access-Control-Allow-Credentials: true`.
- **CRITICAL**: When `credentials: true`, the browser requires `Access-Control-Allow-Origin` to be a specific domain, NOT `*`. This is why we can't just use `cors({ origin: "*" })`.

**The Preflight (OPTIONS) Request:**
Before a cross-origin POST with a custom header (like Authorization), the browser first sends an HTTP OPTIONS request (preflight) asking: "Can I make this request?" The CORS middleware handles this automatically, responding with appropriate headers.

```js
app.use(express.json());
```
- Parses request bodies with `Content-Type: application/json` into `req.body`.
- **Without this**: `req.body` would be `undefined`. The signup/login controllers would fail because `const { email, password } = req.body` would destructure `undefined`.
- **How it works internally**: Reads the raw request body stream, buffers all chunks, calls `JSON.parse()` on the complete buffer.

```js
app.use(cookieParser());
```
- Parses `Cookie` header → `req.cookies` object.
- Must come before any middleware that reads `req.cookies` (like `protectRoute`).

```js
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ai", aiRoutes);
```
- Mounts each router at a base path. When Express sees a request to `/api/auth/login`, it strips the `/api/auth` prefix and passes `/login` to `authRoutes`.
- **Why prefix with `/api`?** Industry convention. Separates API endpoints from possible static file serving. Makes it easy to version APIs later (`/api/v2/...`).

```js
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}
```
- **What this does**: In production, serves the built React frontend as static files. The catch-all `*` route handles client-side routing (so refreshing `/friends` works).
- **Why this exists**: When frontend and backend are on the SAME server, you can serve both. In our deployment, they're on different servers (Vercel + Render), so this code is bypassed.
- **The `*` wildcard**: Essential for SPAs. Without it, visiting `/friends` directly would return a 404 from Express (Express has no route for `/friends`). With it, Express returns `index.html` and React Router handles the path on the client side.

```js
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectDB();
});
```
- Starts the HTTP server on the given port.
- `connectDB()` is called INSIDE the callback — this runs AFTER the server starts listening. This ensures the server is ready to accept connections even while MongoDB is still connecting.

---

## 2.2 Node.js & The Event Loop (Deep Internal)

### Concept
Node.js runs JavaScript in a single thread. But it can handle thousands of concurrent I/O operations through its **Event Loop**.

### How It Works Internally
```
┌───────────────────────────┐
│         timers             │  ← setTimeout, setInterval callbacks
├───────────────────────────┤
│     pending callbacks      │  ← I/O callbacks from previous iteration
├───────────────────────────┤
│         idle, prepare      │  ← internal use
├───────────────────────────┤
│           poll             │  ← retrieve new I/O events, execute callbacks
│                            │     Blocks here if nothing pending
├───────────────────────────┤
│           check            │  ← setImmediate callbacks
├───────────────────────────┤
│      close callbacks       │  ← e.g. socket.on('close')
└───────────────────────────┘
```
When Node calls `await mongoose.connect(...)`:
1. It creates an OS-level async network operation.
2. The Event Loop's thread is FREE to process other requests.
3. The OS completes the TCP handshake, notifies Node's libuv.
4. libuv pushes the callback onto the event queue.
5. Event Loop picks up the callback → the `conn` variable is resolved.

**Key insight**: Node is single-threaded for JS execution, but I/O is parallel because it's handled by the OS and libuv thread pool.

### Interview Questions
**Q: If Node is single-threaded, how does it handle 10,000 concurrent requests?**
> "Node handles concurrent requests through its non-blocking I/O model. When a request comes in that requires a database query, Node registers the query as an asynchronous operation and IMMEDIATELY processes the NEXT request. The DB response is handled later via a callback/Promise. This is effective for I/O-bound work (which describes most web apps) but NOT for CPU-intensive work like image processing (which would block the thread)."

**Q: What would block the Node event loop?**
> "CPU-intensive synchronous operations: complex cryptography done synchronously, image processing, heavy JSON.parse() of huge payloads, large loops. `bcrypt.hash()` with a high salt factor is potentially slow — but we use the async version which offloads to libuv's thread pool."

---

## 2.3 `backend/src/middleware/auth.middleware.js` — Line by Line

### Why This File Exists
Route protection. Many routes (like `/api/users`) should only be accessible to logged-in users. Instead of copy-pasting authentication logic into every controller, we extract it into one middleware that can be applied to any route.

### Every Line Explained

```js
import jwt from "jsonwebtoken";
```
- The `jsonwebtoken` npm package. Provides `jwt.sign()` (create token) and `jwt.verify()` (verify + decode token).

```js
import User from "../models/User.js";
```
- Mongoose model. We need it to look up the user from the database using the decoded userId from the JWT.

```js
export const protectRoute = async (req, res, next) => {
```
- `protectRoute` is an Express middleware function. Express middleware signature: `(req, res, next)`.
- `async` because it awaits database queries.
- `next` — calling this passes control to the NEXT function in the middleware chain (either another middleware or the route handler/controller).

```js
  let token = req.cookies.jwt;
```
- Checks for JWT in the `Cookie` header (works in dev where same-domain cookies work).

```js
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
```
- **Why this was added**: In production, frontend is on `langshap.vercel.app`, backend on `onrender.com`. Cross-origin cookies are blocked by browsers. The frontend now sends the token as `Authorization: Bearer <token>`.
- `?.startsWith("Bearer ")` — optional chaining. If `req.headers.authorization` is `undefined`, this doesn't throw; it returns `undefined`, and the `if` fails safely.
- `.split(" ")[1]` — splits `"Bearer eyJhb..."` by space, takes element at index 1 (the actual token).
- **Security note**: This dual-check approach is secure as long as the JWT itself is valid. The signature verification below catches any tampering.

```js
  if (!token) {
    return res.status(401).json({ message: "Unauthorized - No token provided" });
  }
```
- 401 Unauthorized — the standard HTTP status for "you need to be authenticated."
- `return` — immediately stops execution. Does NOT call `next()`, so the controller is never reached.

```js
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
```
- **JWT Verification Internals**:
  1. Split token into 3 parts: `header.payload.signature`.
  2. Decode header (base64) → algorithm type.
  3. Decode payload (base64) → `{ userId: "...", iat: 12345, exp: 12345 }`.
  4. Recompute signature from `base64(header) + "." + base64(payload)` + `JWT_SECRET_KEY`.
  5. Compare recomputed signature with the signature in the token.
  6. If they match → token is authentic. If not → throws `JsonWebTokenError`.
  7. Check `exp` claim against current time. If expired → throws `TokenExpiredError`.
- **What is `JWT_SECRET_KEY`?** A secret string known ONLY to the backend. If someone doesn't know this secret, they cannot forge a valid JWT. If this secret leaks, an attacker could create tokens for any user.

```js
  const user = await User.findById(decoded.userId).select("-password");
```
- Fetches the user from MongoDB using the ID from the JWT payload.
- `.select("-password")` — excludes the password hash from the result. The `-` prefix means "exclude this field." We never want to accidentally send the password hash to the frontend.
- **Why fetch from DB?** The user data in JWT is a snapshot at login time. The user might have been deleted or banned since then. Fetching confirms the user still exists.

```js
  req.user = user;
  next();
```
- Attaches the Mongoose user document to `req.user`. Controllers downstream access it via `req.user.id`, `req.user.email`, etc.
- `next()` — passes control forward. Without this, the request hangs forever.

---

## 2.4 JWT — Deep Internals

### What is a JWT?
JSON Web Token — a compact, URL-safe string for securely transmitting information between parties.

### Structure
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9   ← Header (base64url encoded JSON)
.
eyJ1c2VySWQiOiI2N2FiY2QiLCJpYXQiOjE2...  ← Payload (base64url encoded JSON)
.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c  ← Signature (HMAC-SHA256)
```

### Header Decoded
```json
{ "alg": "HS256", "typ": "JWT" }
```

### Payload Decoded
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "iat": 1625000000,   ← "issued at" (Unix timestamp)
  "exp": 1625604800    ← "expires at" (7 days later)
}
```

### Signature Computation
```
HMACSHA256(
  base64urlEncode(header) + "." + base64urlEncode(payload),
  JWT_SECRET_KEY
)
```

### Why Base64 and Not Encryption?
**CRITICAL INTERVIEW POINT**: JWT payload is base64 encoded, NOT encrypted. Anyone can decode it and read `userId`. BUT they cannot MODIFY it without invalidating the signature (they'd need the secret). So:
- ✅ JWT is tamper-proof (signature verification).
- ❌ JWT is NOT confidential (payload is readable).
- Never put sensitive data (passwords, credit cards) in JWT payload.

### Stateless vs. Session-Based
| JWT | Session |
|-----|---------|
| Token stored client-side | Session ID stored server-side |
| Server has no state | Server stores session in memory/Redis |
| Scales horizontally easily | All servers must share session store |
| Can't be revoked before expiry | Can be revoked instantly |
| Our implementation | Twitter, Facebook traditionally |

---

## 2.5 `backend/src/models/User.js` — Line by Line

### Why This File Exists
Defines the blueprint for user data in MongoDB. Mongoose uses this schema to:
- Validate data before saving.
- Provide instance methods (like `matchPassword`).
- Run pre-save hooks (like password hashing).
- Create the MongoDB collection.

```js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
```
- `mongoose`: The ODM library that sits between Node.js and MongoDB.
- `bcryptjs`: JavaScript implementation of the bcrypt hashing algorithm (bcrypt is an older, pure-JS implementation; bcryptjs doesn't require native bindings, works on all platforms).

```js
const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
```
- `required: true` — Mongoose-level validation. If you call `User.create({email: "..."})` without `fullName`, Mongoose throws a `ValidationError` BEFORE touching MongoDB.

```js
    email: { type: String, required: true, unique: true },
```
- `unique: true` — creates a **unique index** in MongoDB. MongoDB will reject any document where `email` already exists.
- **Performance**: Unique index means MongoDB maintains a B-tree index on `email`. Lookups like `User.findOne({ email: "..." })` are O(log n) instead of O(n) full collection scan.

```js
    password: { type: String, required: true, minlength: 6 },
```
- `minlength: 6` — Mongoose validation. Prevents short passwords at the data layer. Note: the actual hashed password stored is 60 chars long (bcrypt hash), so this validates the PLAIN TEXT password before hashing.

```js
    isOnboarded: { type: Boolean, default: false },
```
- **Critical flag**. New users default to `false`. After completing the onboarding form, set to `true`. Only `isOnboarded: true` users appear in `getRecommendedUsers()` query.

```js
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
```
- An array of MongoDB ObjectIds referencing other User documents.
- `ref: "User"` enables **population**: when you call `.populate("friends")`, Mongoose replaces those IDs with actual user documents.
- **Why store friend IDs on both users?** When User A accepts B's request, we add A's ID to B's friends array AND B's ID to A's friends array. This allows both to list their friends without joins.

```js
  { timestamps: true }
```
- Mongoose automatically adds `createdAt` and `updatedAt` fields. These are automatically managed — no manual date setting needed.

```js
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});
```

**Deep bcrypt explanation:**
- `pre("save")` — Mongoose lifecycle hook. Runs BEFORE every `save()` operation (including `create()`).
- `this.isModified("password")` — if password hasn't changed (e.g., we're updating `bio` only), skip hashing. Without this, every profile update would re-hash the already-hashed password, corrupting it.
- `bcrypt.genSalt(10)` — generates a cryptographically random salt with a **cost factor** of 10.

**What is bcrypt?**
```
bcrypt(password, salt) = hash
```
1. Salt is a random string appended to the password before hashing.
2. This means `bcrypt("password123", salt1) ≠ bcrypt("password123", salt2)`.
3. **Why salt?** Prevents rainbow table attacks — precomputed tables of `hash → password` mappings. Every user's hash is unique even if they have the same password.
4. Cost factor 10 means `2^10 = 1024` iterations of the hashing algorithm. Makes brute force slow.
5. `bcrypt.genSalt(10)` generates a string like `$2b$10$5mEYjGr2mGGEQ1UUdBdXau` (the `$2b$10$` encodes the algorithm version and cost).

```js
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};
```
- `bcrypt.compare()` — takes the plain text password and the stored hash, runs the hash with the same salt (embedded in the hash string), and compares.
- **Why is it on the schema instance?** Called as `user.matchPassword(password)` in the controller — clean, OOP-style API.

---

## 2.6 `backend/src/models/FriendRequest.js` — Line by Line

```js
const friendRequestSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "accepted"], default: "pending" },
}, { timestamps: true });
```

**Design decisions:**
- **Why a separate collection?** Friend requests have their own lifecycle (pending → accepted), their own data (status, timestamps), and we need to query them independently (e.g., "all pending requests for user X"). Putting them in the User document would create deeply nested arrays and complex queries.
- `enum: ["pending", "accepted"]` — Mongoose-level validation. Only these exact strings allowed. Attempting `status: "rejected"` throws a ValidationError.
- **Why no "rejected" status?** Simplicity. Rejected requests are just deleted (or could be). An enum with more states would add complexity for minimal user value.
- **Duplicate request prevention**: In `sendFriendRequest` controller, we check if a request already exists in BOTH directions with `$or`. This prevents A→B and B→A duplicate requests.

---

## 2.7 All Routes — Explained

### `auth.route.js`
```js
router.post("/signup", signup);          // Public — no auth needed
router.post("/login", login);            // Public — no auth needed
router.post("/logout", logout);          // Public — but clears auth
router.post("/onboarding", protectRoute, onboard);  // Protected
router.get("/me", protectRoute, (req, res) => {     // Protected
  res.status(200).json({ success: true, user: req.user });
});
```
**Note on `/me` route**: This is an inline route handler (no controller function). Simple enough to not need a separate controller. `req.user` is already set by `protectRoute`. This is the route called on every page load to check if user is logged in.

### `user.route.js`
```js
router.use(protectRoute);  // Applies protectRoute to ALL routes below
```
**Critical pattern**: Instead of adding `protectRoute` to each individual route definition, `router.use(protectRoute)` applies it as a global middleware to this entire router. Cleaner, can't accidentally miss protecting a route.

### `chat.route.js`
```js
router.get("/token", protectRoute, getStreamToken);
```
**Why is there only one route?** Stream handles all actual chat functionality (WebSocket connections, message storage, delivery). Our backend only needs to generate the Stream authentication token. All chat operations (send message, create channel) go directly from the frontend to Stream's servers using this token.

### `ai.route.js`
```js
router.use(protectRoute);
router.post("/chat", aiChat);
router.post("/summarize", summarizeChat);
```
**Why protected?** AI API calls cost money (Groq has rate limits and potential costs). If unprotected, anyone could spam the endpoint, exhausting the API quota. Authentication ensures only registered users can use the AI features.

---

## 2.8 All Controllers — Deep Dive

### `auth.controller.js — signup()`

**Full flow:**
1. Destructure `{ email, password, fullName }` from `req.body`.
2. Validate: if any field missing → 400.
3. Validate: password length ≥ 6 → 400.
4. Validate: email regex → 400.
5. Check duplicate: `User.findOne({ email })` → 400 "Email already exists".
6. Generate avatar: `Math.floor(Math.random() * 100) + 1` → DiceBear URL.
   - **DiceBear**: A free avatar generation service. `seed=42` always generates the same avatar. Random seeds give variety.
7. `User.create({...})` → Mongoose validates schema → triggers `pre('save')` → bcrypt hashes password → inserts into MongoDB.
8. `upsertStreamUser(...)` → Creates user in Stream's system so they can participate in chat/video.
   - **Why in a try/catch?** Stream API failure shouldn't block the signup. User is created in our DB regardless.
9. `jwt.sign({ userId: newUser._id }, JWT_SECRET_KEY, { expiresIn: "7d" })` → Creates signed JWT.
10. `res.cookie("jwt", token, { httpOnly, sameSite, secure })` → Sets cookie.
11. `res.status(201).json({ success: true, user: newUser, token })` → Responds with 201 Created.

**Why 201 (Created) not 200 (OK)?**
HTTP semantics: 200 means "request succeeded." 201 means "request succeeded AND a new resource was created." Signup creates a user resource → 201 is semantically correct.

### `user.controller.js — getRecommendedUsers()`

```js
const recommendedUsers = await User.find({
  $and: [
    { _id: { $ne: currentUserId } },      // not yourself
    { _id: { $nin: currentUser.friends } }, // not already friends
    { isOnboarded: true },                 // completed profile
  ],
});
```
**MongoDB query operators:**
- `$and` — all conditions must be true.
- `$ne` — "not equal" (exclude self).
- `$nin` — "not in" (exclude existing friends).
- `isOnboarded: true` — shorthand for `{ isOnboarded: { $eq: true } }`.

**Performance consideration**: For large databases, this query would benefit from compound indexes on `isOnboarded` and `_id`. Currently relies on the default `_id` index plus a collection scan for `isOnboarded`.

### `user.controller.js — acceptFriendRequest()`

```js
await User.findByIdAndUpdate(friendRequest.sender, {
  $addToSet: { friends: friendRequest.recipient },
});
await User.findByIdAndUpdate(friendRequest.recipient, {
  $addToSet: { friends: friendRequest.sender },
});
```
**`$addToSet`**: Adds element to array only if it doesn't already exist. Prevents duplicate friends. Alternative would be `$push`, but that allows duplicates.
**Two separate updates**: This is a weakness — if the second update fails, one user has the friend but not the other. In a production system with financial data, you'd use **MongoDB transactions** (`session.withTransaction()`). For a social app, this inconsistency is acceptable (and rare).

---

## 2.9 `backend/src/lib/stream.js` — Line by Line

```js
import { StreamChat } from "stream-chat";
import "dotenv/config";

const apiKey = process.env.STEAM_API_KEY;
const apiSecret = process.env.STEAM_API_SECRET;
```
**Note the typo**: `STEAM` (not `STREAM`). This is a subtle env variable naming mistake. It works, but is confusing. The correct name would be `STREAM_API_KEY`. Worth noting in a code review.

```js
const streamClient = StreamChat.getInstance(apiKey, apiSecret);
```
- `getInstance` is a **Singleton pattern**. The StreamChat client is expensive to create. This ensures only one instance exists regardless of how many times this module is imported.
- With both `apiKey` AND `apiSecret`, this client has **server-side privileges** — it can create tokens, manage users, query any channel, etc.
- On the frontend, the client is created with ONLY `apiKey` (no secret), giving it **client-side permissions** only.

```js
export const upsertStreamUser = async (userData) => {
  await streamClient.upsertUsers([userData]);
};
```
- `upsertUsers`: Creates the user if they don't exist, updates them if they do. Idempotent operation.
- Called during both signup AND onboarding (to update name/avatar after onboarding).
- Array argument `[userData]`: The API supports batch upserts.

```js
export const generateStreamToken = (userId) => {
  const userIdStr = userId.toString();
  return streamClient.createToken(userIdStr);
};
```
- `userId.toString()` — MongoDB ObjectIds are Objects, not strings. Stream requires a string. Without `.toString()`, the token might encode a non-string ID, breaking Stream authentication.
- `createToken()` — generates a JWT (yes, Stream also uses JWT internally!) signed with the `apiSecret`. This token proves to Stream's servers that this user is authorized.

---

## 2.10 `ai.controller.js` — Deep Dive

### Architecture Decision: Why Proxy to Groq?
```
Frontend → Our Backend → Groq API
```
If Frontend called Groq directly, the `GROK_API_KEY` would be in the browser's source code — anyone could steal it and use our API quota. The backend acts as a secure proxy, keeping the key server-side.

### The System Prompt Engineering
The AI controller constructs a complex system prompt:
```js
const systemPrompt = `You are an expert ${language} language tutor...
You are role-playing as: ${scenarioDescription}.
Proficiency level: ${proficiency.toUpperCase()}
...
- Reply in BOTH target language AND native language
- Include phonetic guide for non-Latin scripts
- Structure response: [target lang] / [transliteration] / --- / [native lang]
- End with a follow-up question
- Correct grammar gently using the 📝 format`
```

**Why this matters in interviews:**
- Shows understanding of prompt engineering.
- Dynamic prompts (language, scenario, proficiency) are injected at runtime.
- The AI's behavior is entirely determined by this prompt — changing it changes the product.

### `callGrokAPI()` Function
```js
const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "llama-3.3-70b-versatile",
    messages,
    temperature: 0.7,
  }),
});
```
- Uses native `fetch` (available in Node.js 18+) instead of Axios.
- The endpoint `/openai/v1/chat/completions` is OpenAI-compatible — Groq implemented the same API format as OpenAI for easy migration.
- `temperature: 0.7` — controls randomness. 0 = deterministic, 1 = very creative. 0.7 balances coherence and variety.
- `data.choices[0].message.content` — The response format (OpenAI/Groq): an array of choices. We take the first one.

---

## 2.11 Interview Questions — Chapter 2

**Q: What's the difference between `req.params`, `req.query`, and `req.body`?**
> "These are three ways data comes into an Express route. `req.params` contains URL path parameters — defined with `:` in routes like `/friend-request/:id`. `req.query` contains URL query string parameters like `/users?page=2&limit=10`. `req.body` contains the request body payload, typically JSON in our case, accessible after `express.json()` middleware parses it."

**Q: What happens if `JWT_SECRET_KEY` is leaked?**
> "An attacker who knows the secret key can sign arbitrary JWT payloads, creating tokens for any `userId`. They could create a token for an admin account without knowing the password. The fix: immediately rotate the key (change the env var), which invalidates ALL existing tokens instantly (since they were signed with the old key). This is one of JWT's advantages over sessions — mass logout is just a key rotation."

**Q: Why is `bcrypt.genSalt(10)` async?**
> "The hashing process involves 2^10 iterations of SHA-512, which is computationally expensive by design. Running it synchronously would block Node's event loop for several milliseconds, preventing other requests from being processed. The async version offloads the computation to libuv's thread pool."

**Q: What is the `$nin` operator and how does it scale?**
> "In MongoDB, `$nin` (not in array) checks each document's field against the provided array. For large friends lists, this could be slow as it performs a set comparison per document. For very large scale (millions of friends lists), a better approach would be maintaining a separate 'friendship' collection with compound indexes, or using a graph database like Neo4j."

**Q: Walk me through a friend request acceptance.**
1. User B clicks "Accept" → `acceptFriendRequest(requestId)` in `api.js`.
2. PUT to `/api/users/friend-request/:id/accept`.
3. `protectRoute` verifies B's token.
4. `acceptFriendRequest` controller: finds the FriendRequest by ID.
5. Verifies `friendRequest.recipient.toString() === req.user.id` (B can't accept someone else's request).
6. Sets `friendRequest.status = "accepted"`, saves.
7. Updates User A's friends array with B's ID using `$addToSet`.
8. Updates User B's friends array with A's ID using `$addToSet`.
9. Returns 200 OK.
10. Frontend's `onSuccess`: invalidates both `["friendRequests"]` and `["friends"]` queries → both refresh.

---

## 2.12 Memory Aids — Chapter 2

### Flashcards
- **What is `next()` in Express?** → Passes control to the next middleware/route handler
- **What does `protectRoute` do?** → Extracts token from cookie or Bearer header, verifies JWT, fetches user, attaches to `req.user`
- **What does `pre('save')` do?** → Runs before every Mongoose `.save()` — used here to hash password
- **What is `$addToSet`?** → MongoDB operator that adds to array only if not already present
- **Why `unique: true` on email?** → Creates MongoDB B-tree index, enforces uniqueness at DB level
- **What does `select("-password")` do?** → Excludes the password field from the query result
- **What is `StreamChat.getInstance()`?** → Singleton pattern — reuses one client instance across imports
- **Why call `upsertStreamUser` on signup?** → Creates the user in Stream's system so they can participate in chat/video

### Cheat Sheet
```
Route Types:
  Public: /auth/signup, /auth/login, /auth/logout
  Protected (individual): /auth/onboarding, /auth/me
  Protected (router-level): ALL /api/users routes, ALL /api/chat routes, ALL /api/ai routes

JWT Flow:
  Sign:   jwt.sign({ userId }, JWT_SECRET_KEY, { expiresIn: "7d" })
  Verify: jwt.verify(token, JWT_SECRET_KEY) → { userId, iat, exp }

bcrypt Flow:
  Hash:    salt = genSalt(10) → hash(password, salt)
  Verify:  bcrypt.compare(inputPassword, storedHash) → boolean

MongoDB Operators Used:
  $ne   → not equal (exclude self from recommendations)
  $nin  → not in array (exclude friends from recommendations)
  $and  → all conditions
  $or   → any condition (checking for existing friend requests both ways)
  $addToSet → add to array if not present (adding friends)
```
