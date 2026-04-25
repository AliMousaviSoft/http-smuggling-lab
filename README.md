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

# 🚧 Next Phase (v2 - Planned)

The next iteration will focus on:

- Introducing realistic parsing divergence conditions
- Exploring backend-level HTTP parsing behavior edge cases
- Modeling conditions closer to real-world request smuggling scenarios (CL.TE / TE.CL variants)
- Preserving production-like NGINX behavior (no artificial weakening)

---

# 🧪 Tooling

- Docker / Docker Compose
- Node.js HTTP server
- NGINX reverse proxy
- Burp Suite (for request inspection and interception)

---

# ⚠️ Disclaimer

This project is strictly for educational and security research purposes.  
It is designed to study HTTP parsing behavior in controlled environments only.
