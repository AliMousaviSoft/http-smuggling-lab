# HTTP Request Smuggling Lab

A Docker-based, real-world-oriented lab environment for studying HTTP request handling behavior, proxy/backend interactions, and the foundations of HTTP Request Smuggling research.

This project evolves progressively from observability (v0) toward realistic desynchronization scenarios, while keeping all infrastructure close to production behavior. No components are artificially weakened — vulnerabilities emerge from real parsing differences between real stacks.

---

## Design Principles

- **No custom HTTP parsers** — only real production-grade components
- **No artificial weakening** — misconfiguration must reflect realistic production mistakes
- **Vulnerabilities emerge from differential behavior** — two real systems disagreeing, not one broken system
- **Every version is documented** — findings are recorded before moving forward

---

## Lab Architecture (Current State — v2.5)

```
Client (curl / Burp Suite Pro)
  │
  ├──▶ HAProxy 1.9   (port 6000)  ──▶ NGINX (internal: 8000) ──▶ Node.js (internal: 3000)
  │    HTTP/1.1 baseline
  │
  ├──▶ HAProxy 2.8   (port 6500)  ──▶ NGINX (internal: 8000) ──▶ Node.js (internal: 3000)
  │    H2+TLS, ALPN negotiation
  │
  ├──▶ ATS 8.1.11    (port 6100)  ──▶ NGINX (internal: 8000) ──▶ Node.js (internal: 3000)
  │    CVE surface, H2 (in progress)
  │
  └──▶ ATS 9.2.9     (port 6200)  ──▶ NGINX (internal: 8000) ──▶ Node.js (internal: 3000)
       More patched, comparison baseline
```

### Port Map

| Component     | External Port | Protocol      | Role |
|---------------|---------------|---------------|------|
| HAProxy 1.9   | 6000          | HTTP/1.1      | Legacy LB baseline |
| HAProxy 2.8   | 6500          | H2+TLS        | Modern LB, hardened |
| ATS 8.1.11    | 6100          | HTTP/1.1→H2   | CVE-2021-37147 surface |
| ATS 9.2.9     | 6200          | HTTP/1.1→H2   | Patched comparison |
| NGINX 1.29    | internal only | HTTP/1.1      | Hardened origin |
| Node.js       | internal only | HTTP/1.1      | Backend, llhttp parser |

---

## Version History

---

### v0 — Baseline Infrastructure

**Goal:** Establish a stable, reproducible, observable HTTP pipeline.

**What was built:**
- Dockerized NGINX + Node.js backend
- Working reverse proxy flow: Client → NGINX → Backend
- Backend returns structured JSON responses
- Full request logging at both layers
- Burp Suite can intercept traffic when configured as proxy

**Key observation:** Requests correctly forwarded, no ambiguity, no vulnerabilities. Pure infrastructure validation.

---

### v1 — Enhanced Logging & Protocol Visibility

**Goal:** Improve visibility into HTTP request structure across layers to prepare for desynchronization experiments.

**What was introduced:**

NGINX: custom log format capturing request line, Content-Length, Transfer-Encoding, Host header, and upstream connection ID (`$connection`).

Backend: expanded logging capturing method, URL, headers, raw TCP chunks, and full body. Raw socket logging separates what arrived at transport layer vs what the HTTP parser accepted.

**Key observations:**
- NGINX rejects requests with both `Content-Length` and `Transfer-Encoding` with `400 Bad Request`
- curl and Burp normalize requests differently — curl suppresses ambiguous headers
- Backend raw socket receives bytes even when upstream rejects the HTTP request
- This is correct, modern, defensive behavior — not a lab failure

**Purpose:** Understand HTTP request parsing boundaries before introducing differential behavior.

---

### v2 — Dual HAProxy Differential Matrix

**Goal:** Introduce the first realistic parsing differential surface using two HAProxy versions as front-layer entry points.

**Architecture:**
```
Client → HAProxy 1.9 (port 6000) → NGINX → Node.js
Client → HAProxy 2.8 (port 6500) → NGINX → Node.js
```

**Why two HAProxy versions:**
HAProxy 1.9 and 2.8 have documented differences in handling ambiguous HTTP headers. Running both against identical downstream infrastructure means any behavioral difference is purely version-level — not config variance. This models a real-world CDN or load balancer running older infrastructure in front of a hardened origin.

**What was confirmed:**

| Finding | Evidence |
|---|---|
| Full chain operational | All containers log on every request |
| Isolation correct | `curl localhost:8000` and `localhost:3000` both fail |
| Keepalive reuse confirmed | `Re-using existing http: connection` across two requests |
| Both HAProxy versions forward CL+TE payload | Neither rejected at ingress |
| Version-level differential observed | `bytes=139` (1.9) vs `bytes=119` (2.8) on identical payload |
| Backend socket received raw bytes | Transport layer is transparent |

**Blocker identified:** NGINX 1.29 rejects CL+TE ambiguity before reaching the backend HTTP parser. The 400 comes from NGINX, not HAProxy. This is accurate modern behavior and is addressed in v2.5.

---

### v2.5 — H2 Downgrade Desync Surface (In Progress)

**Goal:** Move from HTTP/1.1 CL+TE to HTTP/2 → HTTP/1.1 downgrade as the realistic modern attack surface.

**Why shift to H2:**

Modern production stacks have hardened HTTP/1.1 CL+TE handling. The current real-world bug bounty attack surface has shifted to the **H2 → HTTP/1.1 downgrade layer**:

- Client speaks HTTP/2 to the CDN or load balancer
- The CDN downgrades to HTTP/1.1 toward the origin
- The downgrade process can introduce header ambiguity that the origin didn't expect

This is where real bug bounty findings are being made in 2025-2026. No downgrading of components is required — the vulnerability comes from the protocol translation, not from running old software.

**What was tested against HAProxy 2.8 (H2+TLS):**

| Attack | Result | Reason |
|---|---|---|
| H2.CL (content-length > frame size) | `PROTOCOL_ERROR` | HAProxy 2.8 validates frame size vs CL |
| H2.TE (transfer-encoding in H2) | `<BADREQ>` | HAProxy rejects forbidden H2 header per RFC 7540 |

HAProxy 2.8 is fully patched against both attacks. This is accurate modern behavior.

**Why Apache Traffic Server was introduced:**

HAProxy 2.8 enforces RFC 7540 strictly — it will not forward forbidden headers downstream. To find a real H2 desync surface, a component with documented H2 smuggling history is needed.

ATS (Apache Traffic Server) has multiple real CVEs in this area:

- **CVE-2021-37147** — H2 request smuggling via `transfer-encoding` header forwarding. ATS 8.x passes `transfer-encoding` from H2 into the HTTP/1.1 backend request without stripping it. This is exactly the H2.TE attack that HAProxy 2.8 blocked.
- **CVE-2021-37148** — Related H2 parsing issue in the same version range.

ATS is used in production at scale (LinkedIn, Yahoo, Comcast). Finding bugs against ATS-backed infrastructure is a real bug bounty target class.

Running ATS 8.x (vulnerable range) and ATS 9.x (more patched) mirrors the HAProxy approach — same payload, two versions, observable differential.

**Why Kong was planned:**

Kong is an API gateway built on top of NGINX/OpenResty. It adds a third parsing layer between the load balancer and the origin:

```
Client → Kong (API gateway) → NGINX → Node.js
```

This is the topology of most modern SaaS platforms and microservice architectures. Bug bounty programs on these platforms typically have Kong or a similar API gateway in the path. Kong's OpenResty/Lua plugin layer introduces its own header handling behavior that differs from both HAProxy and raw NGINX — creating additional differential surface.

**Current ATS status:**

Both ATS containers confirmed operational:
```bash
curl -s http://localhost:6100/  →  {"status":"ok","note":"backend responded","body_length":0}
curl -s http://localhost:6200/  →  {"status":"ok","note":"backend responded","body_length":0}
```

ATS 8.x debug logs show full internal request pipeline including incoming request, proxy request, and response reconstruction — providing deep visibility into header handling decisions.

Next step: enable H2+TLS on ATS 8.x and send H2.TE payload to confirm CVE-2021-37147 behavior.

---

## Planned Versions

```
v3  — Multi-stack differential matrix
      Kong OSS + NGINX + Node.js (API gateway topology)
      Envoy + NGINX + Node.js (service mesh topology)

v4  — CDN simulation layer
      Varnish (cache poisoning via request ambiguity)
      Gateway normalization inconsistencies

v5  — HTTP/2 tunneling
      Request tunneling beyond classic CL.TE/TE.CL
      H2 multiplexing abuse

v6  — Realistic application layer
      Login / authentication endpoint
      Admin panel (restricted path)
      User profile / account page
      Public vs private route boundary
      Full exploitation chain practice
```

---

## Tooling

- Docker / Docker Compose
- Node.js HTTP server (llhttp parser)
- NGINX reverse proxy
- HAProxy 1.9 and 2.8
- Apache Traffic Server 8.1.11 and 9.2.9
- Burp Suite Pro (H2 Repeater for H2.TE injection)
- curl (raw payload testing)

---

## Reproduction Steps

```bash
# Start the lab
docker compose up -d

# Verify all entry points
curl -s http://localhost:6000/ | jq .   # HAProxy 1.9
curl -sk https://localhost:6500/ | jq . # HAProxy 2.8 (H2+TLS)
curl -s http://localhost:6100/ | jq .   # ATS 8.x
curl -s http://localhost:6200/ | jq .   # ATS 9.x

# Verify isolation
curl http://localhost:8000/  # must fail
curl http://localhost:3000/  # must fail

# Keepalive reuse test
curl --http1.1 -v http://localhost:6000/test http://localhost:6000/test2 2>&1 | grep -E "Connected|Re-using|Connection #"

# H2 test through HAProxy 2.8
curl --http2-prior-knowledge -v https://localhost:6500/ -k
```

---

## Disclaimer

This project is strictly for educational and security research purposes.
It is designed to study HTTP parsing behavior in controlled environments only.
Do not use techniques or tools from this lab against systems you do not own or have explicit permission to test.
