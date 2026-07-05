# SpartaFlow — Nginx Guide

> Reference for [`deployment/nginx.conf`](../deployment/nginx.conf): the
> production Nginx configuration that fronts the TanStack Start **SSR** server
> (Nitro/Node on `:3000`). It handles TLS, redirects, compression, caching,
> deep-link routing, security headers, rate limiting, proxying, and health.
>
> Request path:
> `client → Cloudflare → Nginx → app (SSR :3000) → Supabase`.
>
> Related: [`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md),
> [`docs/DOCKER.md`](./DOCKER.md).

---

## 1. What the config does

| Requirement | How it's implemented |
|---|---|
| **HTTPS only** | App is served only on the `:443` server block; TLS 1.2/1.3, modern ciphers, HSTS. |
| **HTTP → HTTPS redirect** | `:80` server `return 301 https://$host$request_uri` (except `/healthz` and ACME challenge). |
| **Compression** | `gzip` on for text/JS/CSS/JSON/SVG/fonts; Brotli block ready to enable if the module is present. |
| **Caching** | `/assets/` (fingerprinted) → `1y, immutable`; other static extensions → `30d`; HTML/SSR → not cached. |
| **SPA routing** | All non-asset paths proxy to the SSR server, which resolves the route — deep links / hard refreshes never 404. Static-only fallback documented in §7. |
| **Security headers** | HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; CSP baseline provided (commented). |
| **Rate limiting** | `limit_req` zones (`req_general` 30r/s, `req_strict` 10r/s) + `limit_conn` (20/IP), keyed on the **real** client IP. |
| **Proxy configuration** | `upstream spartaflow_app` with keepalive; forwards `Host`/`X-Forwarded-*`, WebSocket upgrade, sane timeouts. |
| **Health endpoint** | `GET /healthz` → `200 ok`, answered by Nginx directly (independent of the upstream) on both `:80` and `:443`. |

---

## 2. Before you deploy — edit these

1. **Server name** — replace `app.spartaflow.com` (both server blocks) with your host.
2. **Upstream target** — `deployment/nginx.conf` defaults to `127.0.0.1:3000`
   (host/systemd). For Docker Compose change it to `server app:3000;`.
3. **Certificates** — set `ssl_certificate` / `ssl_certificate_key` paths (see §4).
4. **Cloudflare IP ranges** — the `set_real_ip_from` list must stay current
   (<https://www.cloudflare.com/ips/>); otherwise rate limiting buckets everyone
   under Cloudflare's IPs.

---

## 3. Installing

**Host (Ubuntu/systemd):**

```bash
sudo cp deployment/nginx.conf /etc/nginx/nginx.conf
sudo nginx -t            # validate syntax
sudo systemctl reload nginx
```

**Docker Compose:** mount it and set the upstream to `app:3000`:

```yaml
# docker-compose.prod.yml (nginx service)
volumes:
  - ./deployment/nginx.conf:/etc/nginx/nginx.conf:ro
```

> `deployment/nginx.conf` is a **complete** `nginx.conf` (it owns the `http {}`
> block because rate-limit zones and the real-IP map must live there). If your
> host already has a managed `nginx.conf`, lift just the two `server {}` blocks
> into `/etc/nginx/conf.d/spartaflow.conf` and move the `limit_req_zone`, `map`,
> `gzip`, and `set_real_ip_from` lines into the existing `http {}`.

---

## 4. TLS / certificates

The config expects certs at `/etc/nginx/certs/`. Two supported options
(see [`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §5):

- **Cloudflare Origin CA (recommended, Full (strict)):** generate a long-lived
  origin cert in Cloudflare → save as `origin.pem` / `origin.key`. Optionally
  enable **Authenticated Origin Pulls** by uncommenting the
  `ssl_client_certificate` + `ssl_verify_client on;` lines so the origin accepts
  **only** Cloudflare.
- **Let's Encrypt:** issue with certbot (the `:80` block already serves
  `/.well-known/acme-challenge/` from `/var/www/certbot`), then point
  `ssl_certificate*` at `/etc/letsencrypt/live/<domain>/`.

> Set the Cloudflare SSL/TLS mode to **Full (strict)**. Never use *Flexible* — it
> leaves Cloudflare→origin in cleartext and causes redirect loops with
> "Always Use HTTPS".

---

## 5. Rate limiting — tuning

Three controls, all keyed on the **real** client IP (thanks to `real_ip_header
CF-Connecting-IP`):

| Zone | Rate | Applied to | Notes |
|---|---|---|---|
| `req_general` | 30 req/s, `burst=50 nodelay` | `location /` | Normal browsing headroom; absorbs bursts, rejects sustained floods with `429`. |
| `req_strict` | 10 req/s, `burst=10` | (opt-in) sensitive SSR endpoints | Uncomment the `/_serverFn/` block and set the real prefix. |
| `conn_limit` | 20 connections/IP | server-wide | Caps concurrent connections per client. |

Rejected requests return **429**. Raise the rates if legitimate users are
throttled; the zones reserve 10 MB each (~160k IPs). Because Cloudflare also does
edge rate limiting, treat these as origin-side defense-in-depth.

---

## 6. Security headers & CSP

Uncommented by default: HSTS, `nosniff`, `SAMEORIGIN`, `Referrer-Policy`,
`Permissions-Policy`, `Cross-Origin-Opener-Policy`.

**CSP is provided but commented** because a strict policy can break the app until
tuned. Roll it out safely:

1. Start with `Content-Security-Policy-Report-Only` (observe, don't block).
2. Ensure `connect-src` allows the Supabase origin
   (`https://*.supabase.co wss://*.supabase.co`) — the browser talks to Supabase
   directly ([`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) §10).
3. `style-src 'unsafe-inline'` is typically needed (Tailwind/inline styles).
4. Once clean in reports, switch to the enforcing `Content-Security-Policy`.

> **`add_header` inheritance gotcha:** if a `location` declares its own
> `add_header`, it drops the server-level ones. That's why the security headers
> are **repeated** inside `/assets/`. If you add CSP, add it there too (and to the
> static-extensions block if you want it on assets).

---

## 7. SPA / deep-link routing

SpartaFlow is **SSR**, not a static SPA. The config proxies every non-asset path
to the SSR server, so a hard refresh or shared deep link
(`/app/tasks/kanban`, `/app/tasks/$id`) is rendered by the app — **no 404s**, no
`try_files` fallback needed. This is the correct handling for this app.

**If you ever serve a static SPA build instead** (no SSR), replace the
`location /` proxy with a filesystem fallback:

```nginx
root /var/www/spartaflow/current/.output/public;
location / {
    try_files $uri $uri/ /index.html;   # SPA history fallback
}
```

Do **not** use both — the app is SSR today, so the proxy form is what ships.

---

## 8. Health checks

| Endpoint | Serves | Use |
|---|---|---|
| `GET /healthz` (`:80` and `:443`) | Nginx returns `200 "ok"` directly | Container/LB/uptime probes; independent of the upstream so it stays green during app restarts. |

```bash
curl -sS http://localhost/healthz     # ok
curl -skS https://localhost/healthz   # ok (self-signed will need -k locally)
```

To probe the **app** itself (end-to-end through the proxy), hit `/` — that goes
to the SSR server.

---

## 9. Validate & reload

```bash
sudo nginx -t                       # syntax + cert path check
sudo systemctl reload nginx         # zero-downtime reload
# Docker:
docker compose -f docker-compose.prod.yml exec nginx nginx -t
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `nginx -t` fails on `ssl_certificate` | Cert files missing at `/etc/nginx/certs/` | Install certs (§4) or fix paths. |
| Redirect loop | Cloudflare set to *Flexible* | Switch to **Full (strict)** (§4). |
| All users share a rate limit / `429` storms | Real-IP not configured or stale CF ranges | Update `set_real_ip_from` list (§2). |
| `502 Bad Gateway` | App not up / wrong upstream | Confirm SSR listens on `:3000`; fix `upstream` target (§2). |
| Assets not cached | Request path isn't `/assets/…` | Check the build output path; adjust the `location` prefixes. |
| CSP breaks the app | Policy too strict | Return to `Report-Only`, widen `connect-src`/`style-src` (§6). |
| Security header missing on assets | `add_header` not inherited into that location | Repeat the header in the location block (§6). |
| WebSocket/realtime fails | — | Realtime goes **direct** to Supabase, not through Nginx; the `Upgrade` map only covers app-served sockets. |
```
