# HTTP Smuggling Lab

A Docker-based, real-world-oriented lab environment for studying HTTP request handling behavior, proxy/backend interactions, and the foundations of HTTP Request Smuggling research.

This project is designed to evolve progressively from **observability (v0)** to **parsing divergence and desynchronization scenarios (v1+)**, while keeping infrastructure close to production behavior.

---

## 🧠 Current Architecture


The lab follows a simple reverse proxy architecture:

```text

Client (curl / Burp Suite)

        ↓

NGINX Reverse Proxy

        ↓

Node.js Backend Service

```

This setup allows controlled observation of HTTP request handling across multiple layers.

- Reverse Proxy: NGINX (production-like configuration)
- Backend: Node.js (`http` module)
- Containerized via Docker
- Full request/response logging enabled
- Traffic observable via Burp Suite when configured as proxy

---

# 📦 v0 — Baseline Infrastructure (Observability Layer)

## 🎯 Goal

Establish a stable, reproducible, and observable HTTP pipeline.

## 🧱 What was built

- Dockerized environment (NGINX + Node backend)
- Working reverse proxy flow:
  - Client → NGINX → Backend
- Backend returns structured JSON responses
- Full request logging at both layers
- Stable HTTP behavior without crashes or desync

## 🔍 Key Observations

- Requests correctly forwarded through proxy
- Backend receives normalized HTTP requests
- No request splitting or ambiguity exists at this stage
- Burp Suite can intercept traffic when configured as proxy

## 📌 Purpose of v0

This phase is not about vulnerabilities.

It is about:

- Verifying request flow integrity
- Establishing observability
- Ensuring reproducibility of test conditions

---

# ⚙️ v1 — Enhanced Logging & Protocol Visibility Layer

## 🎯 Goal

Improve visibility into HTTP request structure across proxy and backend layers to prepare for later desynchronization experiments.

## 🧱 What was introduced

### NGINX improvements:
- Custom log format including:
  - Request line
  - Content-Length (CL)
  - Transfer-Encoding (TE)
  - Host header
- Explicit HTTP/1.1 proxy behavior configuration
- Connection handling adjustments for consistent request forwarding

### Backend improvements:
- Expanded request logging:
  - Method
  - URL
  - Headers
  - Full request body capture
- Structured logging boundaries for easier analysis

## 🔍 Key Observations

- Clear visibility into request transformation between layers
- Backend consistently receives parsed and normalized requests
- NGINX enforces strict validation (rejects ambiguous requests such as combined CL + TE)
- Burp Suite shows raw request behavior differences compared to curl due to normalization

## ⚠️ Important Behavior Noted

- Requests containing both `Content-Length` and `Transfer-Encoding` are rejected by NGINX with `400 Bad Request`
- This reflects real-world defensive behavior in production-grade reverse proxies
- No smuggling vulnerability is present at this stage (expected)

## 📌 Purpose of v1

This phase focuses on:

- Understanding HTTP request parsing boundaries
- Observing proxy vs backend behavior differences
- Identifying where real-world desynchronization *could* emerge in later stages

---

# HTTP Request Smuggling Lab — v2
 
## Overview
 
V2 introduces the first realistic parsing differential surface into the lab by adding **two HAProxy versions** as front-layer entry points in front of NGINX and the Node.js backend.
 
The goal of this version is not to produce a working exploit yet — it is to **confirm the infrastructure conditions** that make smuggling possible:
 
- Ambiguous requests (CL + TE) pass through HAProxy and reach NGINX
- Keepalive connection reuse is working end-to-end through the full chain
- NGINX and backend are isolated (no direct external access)
- Version-level behavioral differences between HAProxy 1.9 and 2.8 are observable
---
 
## Architecture
 
```
Client
  │
  ├──▶ HAProxy 1.9  (port 6000)  ──▶ NGINX (internal: 8000) ──▶ Node.js backend (internal: 3000)
  │
  └──▶ HAProxy 2.8  (port 6500)  ──▶ NGINX (internal: 8000) ──▶ Node.js backend (internal: 3000)
```
 
### Why two HAProxy versions?
 
HAProxy 1.9 and 2.8 have documented differences in how they handle ambiguous HTTP headers (`Content-Length` + `Transfer-Encoding` present simultaneously). Running both on the same downstream stack means any behavioral difference observed is purely a function of HAProxy version — not config variance or downstream differences.
 
This models a real-world scenario: a CDN or load balancer running older infrastructure in front of a hardened origin.
 
### Port Map
 
| Component     | Internal Port | External Port | Accessible From Outside? |
|---------------|---------------|---------------|--------------------------|
| HAProxy 1.9   | 6000          | 6000          | ✅ Yes (attack entry point) |
| HAProxy 2.8   | 6500          | 6500          | ✅ Yes (attack entry point) |
| NGINX         | 8000          | —             | ❌ No (internal only)     |
| Node.js       | 3000          | —             | ❌ No (internal only)     |
 
---
 
## Components
 
### HAProxy 1.9 (`docker/haproxy-1.8/`)
 
- Represents: legacy load balancer, older CDN edge node
- Logging: full request log with CL and TE header capture
- Key behavior: more permissive HTTP parsing by default
- Config: `option http-server-close` — reuses upstream connections, closes client connections after response
### HAProxy 2.8 (`docker/haproxy-2x/`)
 
- Represents: modern, maintained load balancer (current LTS)
- Logging: full request log with CL and TE header capture via `http-request capture`
- Key behavior: stricter HTTP parsing, more explicit smuggling protections
- Config: identical to 1.9 intentionally — any difference in behavior is version-level, not config-level
### NGINX (`docker/nginx/`)
 
- Represents: hardened origin server
- Version: latest (1.29.x)
- Key behavior: rejects ambiguous CL + TE requests with `400 Bad Request`
- Logging: logs `$connection` variable to confirm upstream connection reuse
- Config: `proxy_request_buffering off` — streams request directly to backend without buffering
### Node.js Backend (`docker/backend/`)
 
- Represents: application server (llhttp parser)
- Key behavior: logs raw TCP chunks AND parsed HTTP request separately — allows observing what the parser accepted vs what arrived at socket level
- Socket-level logging confirms raw bytes arriving even when HTTP parser rejects the request
---
 
## What Was Confirmed in V2
 
### ✅ Full chain operational
All four containers start cleanly. Every request travels Client → HAProxy → NGINX → Backend with logs at each layer.
 
### ✅ Isolation correct
NGINX (8000) and backend (3000) are unreachable from outside Docker network:
```
curl http://localhost:8000/  →  Failed to connect
curl http://localhost:3000/  →  Failed to connect
```
 
### ✅ Keepalive reuse confirmed end-to-end
```bash
curl --http1.1 -v http://localhost:6000/test http://localhost:6000/test2
```
```
* Connection #0 to host localhost left intact
* Re-using existing http: connection with host localhost
```
One TCP connection reused for two sequential requests through the full HAProxy → NGINX → backend chain. This is the channel smuggling travels through.
 
### ✅ Both HAProxy versions forward ambiguous CL+TE payload
Neither HAProxy 1.9 nor 2.8 rejected the payload. Both forwarded it downstream. The blocker is NGINX, not HAProxy.
 
### ✅ Version-level differential observed
```
HAProxy 1.9  →  status=400  bytes=139
HAProxy 2.8  →  status=400  bytes=119
```
Same payload, different response sizes. The 400 comes from NGINX in both cases, but the two HAProxy versions produce slightly different error responses — observable version fingerprinting from the outside.
 
### ✅ Backend socket received raw bytes
Backend raw TCP log captured the ambiguous payload arriving at socket level:
```
POST / HTTP/1.1
Host: localhost
Transfer-Encoding: chunked
Content-Length: 6
 
0
 
G
```
The HTTP parser (llhttp) did not fire a full request handler because NGINX rejected upstream — but the raw bytes arrived at the socket. This confirms the transport layer is transparent.
 
---
 
## Current Blocker
 
**NGINX 1.29 rejects CL+TE ambiguity before it reaches the backend HTTP parser.**
 
This is correct, modern, defensive behavior. The `400 Bad Request` comes from NGINX, not HAProxy or the backend.
 
Evidence: response header `Server: nginx/1.29.8` on the 400 response from both HAProxy paths.
 
This is not a lab failure — it accurately models a hardened origin. The fix is addressed in v2.5.
 
---
 
## Key Concepts Demonstrated
 
### What HAProxy does
HAProxy is a high-availability load balancer and reverse proxy. It maintains **persistent connection pools** to upstream servers — reusing TCP connections across multiple requests. This connection reuse is what creates the smuggling channel: if HAProxy and the origin disagree on where one request ends, the leftover bytes become the prefix of the next request on that shared connection.
 
### Why connection reuse matters
Without keepalive connection reuse, each request gets its own TCP connection. There is no shared channel, so there is nothing to poison. Smuggling is only possible because the same TCP connection carries multiple sequential requests.
 
### Why two HAProxy versions
Real-world bug bounty targets run a wide range of infrastructure versions. The ability to observe behavioral differences between versions — from the outside, without knowing the version — is a core recon skill. The `bytes=139` vs `bytes=119` difference in v2 is a simple example of version fingerprinting via response differential.
 
---
 
## Reproduction Steps
 
```bash
# Start the lab
docker compose up --build
 
# Verify chain (both entry points)
curl -s http://localhost:6000/ | jq .
curl -s http://localhost:6500/ | jq .
 
# Verify isolation
curl http://localhost:8000/   # must fail
curl http://localhost:3000/   # must fail
 
# Verify keepalive reuse
curl --http1.1 -v http://localhost:6000/test http://localhost:6000/test2 2>&1 | grep -E "Connected|Re-using|Connection #"
 
# Send ambiguous CL+TE payload through HAProxy 1.9
curl -v http://localhost:6000/ \
  -H "Content-Length: 6" \
  -H "Transfer-Encoding: chunked" \
  --data-binary $'0\r\n\r\nG'
 
# Same payload through HAProxy 2.8
curl -v http://localhost:6500/ \
  -H "Content-Length: 6" \
  -H "Transfer-Encoding: chunked" \
  --data-binary $'0\r\n\r\nG'
```
 
---
 
## What's Next — v2.5
 
V2.5 addresses the NGINX blocker by switching to NGINX 1.14 (pre-hardening). This allows the ambiguous request to pass through NGINX and reach the backend's HTTP parser (llhttp), producing the first observable interpretation difference between layers — the foundation for a confirmed desync.
 
v2.5 goal: **confirm a working CL.TE desync with byte-level evidence showing what each layer decided differently.**

# 🧪 Tooling

- Docker / Docker Compose
- Node.js HTTP server
- NGINX reverse proxy
- Burp Suite (for request inspection and interception)

---

# ⚠️ Disclaimer

This project is strictly for educational and security research purposes.  
It is designed to study HTTP parsing behavior in controlled environments only.
