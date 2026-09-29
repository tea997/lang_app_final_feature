# CHAPTER 5: 100 INTERVIEW QUESTIONS & ANSWERS

This chapter provides 100 technical interview questions based strictly on the technologies and architecture used in lingoConnect. These are categorized by domain.

---

### React & Frontend Internals (1-20)

**1. How does React's Virtual DOM work?**
React creates an in-memory data structure cache (the Virtual DOM). When state changes, a new Virtual DOM tree is created. React diffs this new tree against the old one (Reconciliation) to calculate the minimum number of operations required to update the actual DOM, then applies those changes in a single commit phase.

**2. Why did you choose Vite over Create React App?**
Vite uses native ES modules during development, meaning it doesn't bundle the entire app before starting the server. This makes HMR (Hot Module Replacement) nearly instant regardless of app size. CRA uses Webpack, which bundles everything and becomes very slow as the app grows.

**3. What is the purpose of `React.StrictMode`?**
It's a development-only tool that intentionally double-invokes components, state updaters, and side effects. This helps developers identify side-effects hidden in render functions and deprecated lifecycle methods. It is stripped out in production builds.

**4. Explain the difference between `useEffect` and `useLayoutEffect`.**
`useEffect` runs asynchronously *after* the browser has painted the DOM. `useLayoutEffect` runs synchronously *before* the browser paints. If you are reading DOM layout measurements and mutating state based on them, use `useLayoutEffect` to prevent visual flickering.

**5. How does React Router work without reloading the page?**
It uses the HTML5 History API (`pushState`, `replaceState`, `popstate`). When a `<Link>` is clicked, React Router intercepts the click, prevents the default browser navigation, updates the URL via `pushState`, and renders the corresponding component.

**6. Why is there a `vercel.json` file in your frontend?**
Because this is a Single Page Application (SPA). If a user refreshes the page on `/friends`, the Vercel server looks for a file named `/friends`. Since it doesn't exist, it would return a 404. The `vercel.json` rewrites all requests to `/index.html`, allowing React Router to handle the path client-side.

**7. How does Zustand differ from Redux?**
Zustand is a minimalistic, unopinionated state management solution. It requires no boilerplate (no actions, reducers, or context providers). You simply create a store and bind components to it. It avoids the Context API's issue of re-rendering all children by using subscribers.

**8. What is Prop Drilling and how did you avoid it?**
Prop drilling is passing data through many nested components that don't need the data, just to get it to a deeply nested child. I avoided it by using React Query for server state (caching data globally) and Zustand for client state (theme).

**9. What are React Query's primary benefits over `useEffect`?**
It provides built-in caching, background refetching, request deduplication, loading/error states, and stale-while-revalidate logic out of the box, drastically reducing boilerplate.

**10. How do you handle cache invalidation in React Query?**
By using `queryClient.invalidateQueries({ queryKey: [...] })` inside the `onSuccess` callback of a `useMutation`. This marks the cache as stale and triggers a background refetch.

**11. What is the difference between `useQuery` and `useMutation`?**
`useQuery` is declarative and runs automatically for reading data (GET requests). `useMutation` is imperative and only runs when explicitly called for writing data (POST, PUT, DELETE requests).

**12. Explain the purpose of Axios Interceptors in your project.**
Interceptors allow us to run code or modify requests/responses globally. We use a request interceptor to read the JWT from `localStorage` and attach it as an `Authorization: Bearer <token>` header to every outgoing API request.

**13. What is the difference between `localStorage` and `sessionStorage`?**
`localStorage` persists across browser sessions and tabs until explicitly cleared. `sessionStorage` is cleared when the page session ends (when the tab or window is closed).

**14. Why use TailwindCSS instead of traditional CSS?**
Tailwind is a utility-first CSS framework. It allows for rapid styling directly in the markup without context-switching to CSS files. It also results in smaller production CSS files because it purges unused classes during the build process.

**15. What is a Higher-Order Component (HOC)?**
An HOC is a function that takes a component and returns a new component, used for reusing component logic. (Note: Hooks largely replaced HOCs in modern React).

**16. How did you handle protected routes in React Router?**
By wrapping protected components in a conditional logic block. If `isAuthenticated` is true, render the component. If false, render the `<Navigate to="/login" />` component to programmatically redirect.

**17. What is Flash of Unauthenticated Content (FOUC)?**
It occurs when a protected route briefly renders its content before the app realizes the user isn't authenticated and redirects them. We prevent this by returning a loading spinner (`<PageLoader />`) while `isLoading` from `useAuthUser` is true.

**18. What is the purpose of the `key` prop when rendering arrays in React?**
It helps React identify which items have changed, are added, or are removed. It must be unique among siblings (e.g., `user._id`). Without it, React defaults to using array indices, which causes rendering bugs if the array is reordered.

**19. How does Vite achieve such fast development server start times?**
It leverages native ES modules in the browser. Instead of bundling the entire app before starting, it serves files over native ESM and transforms them on demand as the browser requests them.

**20. What is a controlled vs uncontrolled component in React?**
A controlled component's value is driven by React state (e.g., an `<input value={state} onChange={handleChange} />`). An uncontrolled component maintains its own internal state and is queried using a `ref`.

---

### Node.js & Backend Internals (21-40)

**21. Is Node.js single-threaded or multi-threaded?**
Node executes JavaScript on a single main thread. However, it uses a multi-threaded C++ library called `libuv` (the thread pool) to handle asynchronous I/O operations (like file system access or network requests) in the background.

**22. Explain the Node.js Event Loop.**
The Event Loop is what allows Node to perform non-blocking I/O operations. When an async operation completes, its callback is placed in an event queue. The Event Loop continuously checks the queue and executes callbacks on the main thread when it's free.

**23. What is Express.js?**
It's a fast, unopinionated, minimalist web framework for Node.js. It provides a robust set of features for web and mobile applications, abstracting the low-level `http` module to handle routing, requests, responses, and middleware easily.

**24. What is middleware in Express?**
Middleware functions are functions that have access to the request object (`req`), the response object (`res`), and the `next` function in the application's request-response cycle. They can execute code, modify req/res, end the cycle, or call `next()` to pass control forward.

**25. Why do we need `express.json()`?**
It's a built-in middleware that parses incoming requests with JSON payloads and makes the parsed data available under `req.body`. Without it, `req.body` would be undefined.

**26. How do you handle errors in Express asynchronous routes?**
By wrapping the async code in a `try/catch` block. If an error occurs, we log it and respond with a `res.status(500).json({ message: "Internal Server Error" })`. (Alternatively, passing the error to `next(err)` to use a global error handler).

**27. What is CORS and why is it necessary?**
Cross-Origin Resource Sharing is a security feature enforced by browsers. It prevents a malicious script on one domain from making unauthorized requests to another domain. The server must return specific headers (`Access-Control-Allow-Origin`) to permit cross-origin requests.

**28. Explain the CORS Preflight Request.**
For complex requests (like POST with custom headers or `application/json`), the browser first sends an HTTP `OPTIONS` request to the server to check if the actual request is permitted. If the server replies favorably, the browser sends the actual request.

**29. What happens if you forget to call `next()` in a middleware?**
The request will hang indefinitely. The client will eventually time out, because the middleware neither ended the response (e.g., `res.send()`) nor passed control to the next handler.

**30. Why did you use ES Modules (`import/export`) instead of CommonJS (`require`)?**
ES Modules are the official standard format to package JavaScript code for reuse. They allow for static analysis (enabling tree-shaking) and provide a consistent syntax across both frontend (Vite) and backend (Node).

**31. What is the purpose of `bcrypt.genSalt(10)`?**
It generates a random string (salt) with a cost factor of 10. The salt is appended to the password before hashing to defend against rainbow table attacks. The cost factor makes the hashing computationally expensive to deter brute-force attacks.

**32. Why are hashing algorithms like bcrypt slow by design?**
To mitigate brute-force and dictionary attacks. If hashing was extremely fast, an attacker could guess millions of passwords per second. Slowing it down makes cracking unfeasible.

**33. What is REST?**
Representational State Transfer. It's an architectural style where resources are manipulated using standard HTTP methods (GET, POST, PUT, DELETE) and communication is stateless (the server doesn't store client state between requests).

**34. Why do you use status code 201 for signup and 200 for login?**
HTTP 201 indicates "Created" — the signup request successfully resulted in the creation of a new user resource. HTTP 200 simply means "OK", representing a successful login action that didn't create a new resource.

**35. What does the `dotenv` package do?**
It loads environment variables from a `.env` file into `process.env`. This allows us to keep sensitive data (API keys, DB URIs) out of the source code.

**36. Explain how `__dirname` works in ES Modules.**
`__dirname` is not natively available in ES Modules. We polyfill it using `const __dirname = path.resolve();`, which returns the absolute path of the current working directory, allowing us to serve static frontend files.

**37. How would you handle a CPU-intensive task in Node.js?**
Since Node is single-threaded, a CPU-intensive task (like image processing) would block the event loop, freezing the server. I would offload it to a **Worker Thread** (`worker_threads` module) or a separate background service using a message queue (like RabbitMQ or Redis).

**38. What is the difference between `res.send()` and `res.json()`?**
`res.send()` sends the HTTP response and automatically sets the `Content-Type` based on the data type (string, buffer). `res.json()` explicitly formats the response as JSON and sets the `Content-Type` to `application/json`.

**39. How do you prevent Node.js from crashing on unhandled promise rejections?**
Historically, Node would just print a warning. In newer versions, it crashes. We prevent this by ensuring every async operation has a `.catch()` or is inside a `try/catch` block.

**40. What is a "stateless" backend?**
A backend that does not store any session information about the client in memory. Every request must contain all the information necessary for the server to authenticate and process it (e.g., passing a JWT on every request). This makes horizontal scaling trivial.

---

### Authentication & Security (41-60)

**41. What is a JWT and how is it structured?**
JSON Web Token. It has three parts separated by dots: Header (algorithm info, base64url encoded), Payload (claims like userId, base64url encoded), and Signature (header + payload hashed with a secret key).

**42. How does JWT verification work?**
The server takes the header and payload from the incoming token, hashes them using its own secret key, and compares the resulting signature with the signature in the token. If they match, the token hasn't been tampered with.

**43. Is the payload in a JWT encrypted?**
No, it is merely Base64URL encoded. Anyone can decode it. Therefore, sensitive information (like passwords) should never be stored in the payload. It provides integrity (tamper-proofing), not confidentiality.

**44. What happens if the `JWT_SECRET_KEY` is leaked?**
An attacker can forge valid tokens for any user (including admins) and bypass authentication completely. The mitigation is to immediately rotate (change) the secret key, which instantly invalidates all existing tokens.

**45. Why did you switch from using cookies to `localStorage` + Headers for auth?**
Modern browsers (especially Safari) strictly enforce privacy policies (like ITP) that block cross-origin cookies (`SameSite=None`), even if they are Secure. Since our frontend (Vercel) and backend (Render) are on different domains, the cookies were being dropped, breaking authentication.

**46. What is XSS (Cross-Site Scripting)?**
An attack where malicious JavaScript is injected into a trusted website. If successful, the script can run in the context of the user's browser, potentially stealing tokens from `localStorage` or making API calls on their behalf.

**47. How do you prevent XSS?**
By rigorously sanitizing user input. Fortunately, React automatically escapes variables in JSX, neutralizing most XSS vectors. We should also implement a strict Content Security Policy (CSP) header.

**48. What is CSRF (Cross-Site Request Forgery)?**
An attack that forces an end user to execute unwanted actions on a web application in which they're currently authenticated.

**49. Why is `Authorization: Bearer` immune to CSRF?**
CSRF relies on the browser automatically attaching cookies to requests, regardless of the origin. Browsers do not automatically attach custom headers. A malicious site cannot force a user's browser to send the `Authorization` header.

**50. What does the `HttpOnly` cookie flag do?**
It prevents client-side JavaScript (like `document.cookie`) from accessing the cookie. This protects the cookie from being stolen via XSS attacks. (Note: We use `localStorage` now, so we accept the XSS risk in exchange for cross-origin functionality).

**51. What does the `Secure` cookie flag do?**
It ensures the cookie is only transmitted over encrypted (HTTPS) connections, preventing man-in-the-middle attacks from intercepting it over plain HTTP.

**52. How would you implement token expiration and refresh?**
Set a short expiration (e.g., 15 mins) on the Access Token, and issue a long-lived Refresh Token (e.g., 7 days) stored in an HttpOnly cookie. When the Access Token expires, the client calls a `/refresh` endpoint using the Refresh Token to get a new Access Token.

**53. How do you implement logout with JWTs?**
Because JWTs are stateless, you cannot "delete" them on the server. Logout is achieved by deleting the token on the client-side (clearing `localStorage`). For enhanced security, you can maintain a server-side "blacklist" of revoked tokens, but this defeats the stateless nature of JWT.

**54. What is Rate Limiting and why is it important?**
It restricts the number of requests a user or IP address can make to an API within a specified time window. It prevents brute-force attacks (e.g., on `/login`), DoS attacks, and API abuse (e.g., spamming the Groq AI endpoint).

**55. How do you securely store passwords in the database?**
By hashing them using a strong cryptographic hash function with a salt, like `bcrypt`, `Argon2`, or `scrypt`. Never store plain text passwords.

**56. What is the Same-Origin Policy (SOP)?**
A critical security mechanism that restricts how a document or script loaded from one origin can interact with a resource from another origin. CORS is the mechanism used to relax this policy safely.

**57. What are Injection Attacks (e.g., NoSQL Injection)?**
When untrusted user input is executed as code/commands. In MongoDB, passing a query object like `{ $gt: "" }` instead of a string in a login field could bypass authentication. Mongoose largely protects against this by strictly casting types based on the schema.

**58. Why do you exclude the password field in the `protectRoute` middleware?**
`User.findById(id).select("-password")` ensures the password hash is not attached to `req.user`, preventing it from accidentally being leaked to the frontend via API responses (like `/api/auth/me`).

**59. Can a user modify their token to become an admin?**
They can decode and modify the payload (e.g., changing `role: "user"` to `role: "admin"`), but they must re-sign it. Without the server's secret key, the new signature will be invalid, and `jwt.verify` will reject it.

**60. What is a Man-in-the-Middle (MitM) attack?**
When an attacker secretly intercepts and relays communication between two parties. Enforcing HTTPS (TLS/SSL encryption) for all traffic prevents MitM attacks by encrypting the data in transit.

---

### MongoDB & Mongoose (61-80)

**61. What is the difference between SQL and NoSQL?**
SQL databases are relational, table-based, and enforce rigid schemas (great for structured data and ACID transactions). NoSQL databases (like MongoDB) are document-based, storing JSON-like objects with dynamic schemas (great for unstructured data, rapid iteration, and horizontal scaling).

**62. What is Mongoose?**
An Object Data Modeling (ODM) library for MongoDB and Node.js. It provides a straight-forward, schema-based solution to model application data, featuring built-in type casting, validation, and hooks.

**63. How do Mongoose schemas differ from raw MongoDB?**
Raw MongoDB collections are schema-less (you can insert any document). Mongoose enforces a strict structure at the application level, rejecting inserts/updates that don't match the defined Schema types.

**64. Explain Mongoose Hooks (Middleware).**
Functions that execute at specific stages of a document's lifecycle (e.g., `pre('save')`, `post('remove')`). We use `pre('save')` to hash the user's password automatically before it hits the database.

**65. What is an ObjectId in MongoDB?**
A 12-byte unique identifier generated automatically for the `_id` field. It contains a timestamp, machine identifier, process id, and a random counter. Because it contains a timestamp, you can extract the creation date from an `_id` without a separate `createdAt` field.

**66. How does `populate()` work in Mongoose?**
MongoDB is not relational (no SQL JOINs). However, you can store ObjectIds referencing other documents (e.g., friends array). `populate("friends")` tells Mongoose to automatically perform a second query to fetch those user documents and replace the IDs with the actual objects.

**67. What are MongoDB Indexes?**
Special data structures (usually B-trees) that store a small portion of the data in an easy-to-traverse form. They drastically speed up read queries. We use `unique: true` on the `email` field, which implicitly creates an index.

**68. What happens if you query a collection without an index?**
MongoDB must perform a "Collection Scan", examining every single document to see if it matches the query. This is extremely slow for large datasets.

**69. What does the `$addToSet` operator do?**
It adds a value to an array only if the value is not already present. We use it when accepting friend requests to ensure we don't add the same friend twice.

**70. What does the `$and` operator do in your `getRecommendedUsers` query?**
It requires all specified conditions to be met. We use it to find users who are: 1) not the current user, AND 2) not already in the friends list, AND 3) fully onboarded.

**71. How do you perform a transaction in MongoDB?**
Using `session.startTransaction()`. It allows executing multiple operations in isolation. If one fails, you `abortTransaction()` to rollback everything. We *should* use this in `acceptFriendRequest` where we update two separate user documents.

**72. What is Sharding in MongoDB?**
A method for distributing data across multiple machines. When a dataset is too large for a single server, MongoDB splits the data into chunks based on a "Shard Key" and distributes them, enabling horizontal scaling of the database.

**73. What is a Replica Set?**
A group of MongoDB servers maintaining the same data set. It provides redundancy and high availability. If the Primary node goes down, a Secondary node is automatically elected as the new Primary.

**74. How do you handle schema migrations in MongoDB?**
Since NoSQL is flexible, you can just start saving new fields. For existing documents, you either run a one-off script to update them, or handle the missing fields gracefully in the application logic (e.g., `user.location || "Unknown"`).

**75. What is the difference between `find()` and `findOne()`?**
`find()` returns an array of documents (or an empty array) matching the query. `findOne()` returns the first single document that matches, or `null` if none match.

**76. Why did you use a separate `FriendRequest` model instead of embedding it in `User`?**
Friend requests represent a relationship with its own state (pending/accepted) and timestamps. Embedding them in the User document would lead to unbounded array growth (an anti-pattern in MongoDB) and complex query syntax to update specific embedded objects.

**77. What does `{ timestamps: true }` do in Mongoose?**
It automatically adds and manages `createdAt` and `updatedAt` Date fields on the document.

**78. How does `findByIdAndUpdate` differ from `save()`?**
`findByIdAndUpdate` sends an update command directly to MongoDB. It is faster but **bypasses Mongoose middleware** (like `pre('save')`) by default. `save()` loads the document into memory, modifies it, and sends the whole document back, triggering all hooks.

**79. What is Aggregation in MongoDB?**
A framework for data processing pipelines. Documents enter a multi-stage pipeline (like `$match`, `$group`, `$sort`) that transforms them into aggregated results (e.g., calculating the total number of users per language).

**80. What is the BSON format?**
Binary JSON. It's the format MongoDB uses to store documents. It extends standard JSON by adding support for data types like Date, raw binary data, and ObjectId.

---

### Real-Time, WebSockets & System Design (81-100)

**81. What is a WebSocket?**
A protocol providing full-duplex (bidirectional) communication channels over a single, persistent TCP connection. Unlike HTTP, where the client must request data, WebSockets allow the server to push data to the client instantly.

**82. Why did you use Stream SDK instead of building WebSockets with Socket.io?**
Managing WebSockets at scale is highly complex. Socket.io requires sticky sessions and Redis Pub/Sub to work across multiple backend servers. Stream manages the infrastructure, scaling, message persistence, offline support, and UI components, saving months of development time.

**83. How does WebRTC differ from WebSockets?**
WebSockets route data through a central server. WebRTC (Web Real-Time Communication) establishes a **peer-to-peer** connection between browsers to stream audio/video directly, drastically reducing latency and server bandwidth costs.

**84. What are STUN and TURN servers in WebRTC?**
Because of NATs and firewalls, browsers often can't connect directly. A STUN server tells a browser its public IP address. If direct connection still fails (strict firewall), a TURN server acts as a relay, forwarding media packets between peers. Stream Video SDK handles this under the hood.

**85. What is an SFU (Selective Forwarding Unit)?**
In group video calls, peer-to-peer (mesh) fails because sending your video to 10 people requires massive upload bandwidth. An SFU is a server that receives your single video stream and forwards it to the 10 other participants. Stream uses SFUs.

**86. How would you scale this application's backend?**
The backend is stateless (thanks to JWT). We can deploy multiple Node.js instances behind a Load Balancer (like AWS ALB or Nginx). The load balancer distributes incoming HTTP requests across all instances.

**87. What role does a CDN play in this architecture?**
A Content Delivery Network (Vercel) caches our static frontend assets (JS, CSS, HTML, images) on edge servers globally. When a user in Japan accesses the app, they download the UI from a Tokyo server instead of our main US server, drastically improving load times.

**88. Why is Node.js considered good for I/O bound applications?**
Because its non-blocking, event-driven architecture handles thousands of concurrent I/O operations (like database queries or API calls to Groq) with minimal RAM overhead, unlike traditional threaded models (like Java/Apache) which allocate a heavy thread per request.

**89. Explain the proxy pattern used in your AI controller.**
If the React app called the Groq API directly, we would expose our `GROQ_API_KEY` to the public. Instead, React calls our backend, and the backend securely calls Groq. The backend acts as a proxy, hiding the secret key.

**90. How do LLMs (like LLaMA 3) maintain conversation history?**
They don't. LLMs are stateless APIs. We must send the *entire* conversation history (system prompt + all past messages) in every single API request so the model has the context to generate the next response.

**91. How would you implement caching for the recommended users list?**
I would use Redis. When `getRecommendedUsers` is called, check Redis first. If a cache miss occurs, query MongoDB, store the result in Redis with a 5-minute TTL, and return it. This saves database load.

**92. What is a Cache Stampede and how do you prevent it?**
When a popular cache key expires, multiple concurrent requests might all hit the database simultaneously to regenerate it, causing a DB crash. Prevent it using a mutex lock (only one request regenerates the cache) or probabilistic early expiration.

**93. What is the difference between monolithic and microservices architecture?**
A monolith has all logic (Auth, Users, Chat) in one codebase and server. Microservices split these domains into separate, independently deployable services communicating via network protocols. Our app is a monolith, which is appropriate for its current size.

**94. What is a Reverse Proxy?**
A server that sits in front of backend web servers and intercepts client requests (e.g., Nginx, or Render's load balancer). It handles SSL termination, load balancing, and caching, protecting the backend servers.

**95. How do you handle environment variables in production?**
They are never committed to version control. They are entered securely into the hosting platform's dashboard (Render/Vercel). The platform injects them into the runtime environment when the container starts.

**96. What is CI/CD?**
Continuous Integration / Continuous Deployment. It's the automation of building, testing, and deploying code. In our setup, pushing to GitHub automatically triggers Vercel and Render to build and deploy the new code.

**97. How would you prevent API abuse on the AI route?**
Implement Rate Limiting using an in-memory store like Redis (e.g., `express-rate-limit`). Restrict users to 20 AI messages per minute. Return HTTP status `429 Too Many Requests` if exceeded.

**98. What is the difference between TCP and UDP?**
TCP is reliable, ordered, and error-checked (used for HTTP, WebSockets, text chat). UDP is fast, stateless, and doesn't guarantee delivery (used for WebRTC audio/video where losing a frame is better than buffering).

**99. How does React Query's "stale-while-revalidate" work?**
When a component requests cached data that is marked "stale", React Query immediately returns the old data so the UI renders instantly, while simultaneously fetching fresh data in the background and silently updating the UI when it arrives.

**100. If your app goes down entirely, how do you debug it?**
1. Check Vercel logs to see if the frontend is serving.
2. Open Browser Network Tab: Are API requests failing?
3. Check Render logs: Did the Node server crash? (Look for unhandled exceptions).
4. Check MongoDB Atlas dashboard: Is the database accepting connections or maxed out on CPU/RAM?
5. Identify the bottleneck, patch the code or scale the infrastructure accordingly.
