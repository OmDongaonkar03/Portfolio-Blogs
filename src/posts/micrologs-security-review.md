---
title: "I Reviewed My Own Code Like I Was Trying to Break It"
date: "2026-03-1"
order: 1
tags: ["security", "php", "opensource"]
excerpt: "The day after I shipped Micrologs, I did a full security and performance review on my own code. I found 5 real issues. None exotic. All the kind of thing that doesn't hurt at 100 visits/day and quietly breaks at 10,000."
readTime: "8 min read"
---

Last week I built and shipped [Micrologs](https://github.com/OmDongaonkar03/Micrologs) - a self-hostable analytics and error tracking engine that runs on shared hosting. PHP + MySQL. No Redis, no VPS, no Docker. That post covers how it's built and why.

This post is about what happened the day after I shipped it.

I did a full security and performance review on my own code. Treated it like I was a senior engineer seeing it for the first time, trying to find every way it could fail under real traffic.

I found 5 real issues. None exotic. All fixable. All the kind of thing that doesn't hurt at 100 visits/day and quietly breaks at 10,000.

Here's exactly what I found and how I fixed each one.

---

## Issue 1 - Blind trust of X-Forwarded-For

**The problem:**

```php
function getClientIp()
{
    if (!empty($_SERVER["HTTP_X_FORWARDED_FOR"])) {
        $ips = explode(",", $_SERVER["HTTP_X_FORWARDED_FOR"]);
        return trim($ips[0]); // anyone can spoof this
    }
    return $_SERVER["REMOTE_ADDR"] ?? "";
}
```

`X-Forwarded-For` is just a header. Any client can send their own:

```
X-Forwarded-For: 127.0.0.1
```

Now your rate limiter thinks they're localhost. Unlimited requests. Your GeoIP lookup gets a fake IP. Your IP hash is poisoned. The fix costs an attacker zero effort.

**The fix:**

`REMOTE_ADDR` is set by the TCP connection itself - it cannot be spoofed. Only trust `X-Forwarded-For` when `REMOTE_ADDR` is a proxy you control:

```php
function getClientIp()
{
    $remoteAddr = $_SERVER["REMOTE_ADDR"] ?? "";
    $trustedProxies = [];

    if (defined("TRUSTED_PROXIES") && TRUSTED_PROXIES !== "") {
        $trustedProxies = array_map("trim", explode(",", TRUSTED_PROXIES));
    }

    if (!empty($trustedProxies) && in_array($remoteAddr, $trustedProxies, true)) {
        if (!empty($_SERVER["HTTP_X_FORWARDED_FOR"])) {
            $ips = array_map("trim", explode(",", $_SERVER["HTTP_X_FORWARDED_FOR"]));
            $clientIp = $ips[0];
            if (filter_var($clientIp, FILTER_VALIDATE_IP)) {
                return $clientIp;
            }
        }
    }

    return $remoteAddr;
}
```

On shared hosting with no proxy - set `TRUSTED_PROXIES` to empty and XFF is ignored entirely. On a VPS with Nginx in front of PHP-FPM - set it to `127.0.0.1` and it works correctly.

---

## Issue 2 - No payload size cap

**The problem:**

```php
$input = json_decode(file_get_contents("php://input"), true);
```

This was in every single endpoint. `file_get_contents("php://input")` reads the entire request body with no limit. Send a 500MB POST - the server loads 500MB into memory. Do it 10 times concurrently - the server is dead. This is a trivial DoS attack that requires zero skill.

**The fix:**

A `readJsonBody()` helper that hard-caps at 64KB:

```php
function readJsonBody(int $maxBytes = 65536): ?array
{
    $raw = file_get_contents("php://input", false, null, 0, $maxBytes + 1);

    if ($raw === false || $raw === "") {
        return null;
    }

    if (strlen($raw) > $maxBytes) {
        sendResponse(false, "Payload too large", null, 413);
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}
```

64KB is enormous for any legitimate tracking payload - a pageview beacon is maybe 500 bytes. This cap only ever affects attackers.

---

## Issue 3 - Unbounded context field

**The problem:**

```php
$context = isset($input["context"]) && is_array($input["context"])
    ? json_encode($input["context"])
    : null;
```

A deeply nested 10MB JSON object sent as `context` would be encoded and pushed straight to the DB. Even with the 64KB payload cap in place, deeply nested JSON can consume significantly more memory during `json_encode` than its raw byte size suggests.

**The fix:**

Encode first, then check:

```php
function encodeContext($raw, int $maxBytes = 8192): ?string
{
    if (!isset($raw) || !is_array($raw)) {
        return null;
    }

    $encoded = json_encode($raw, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($encoded === false || strlen($encoded) > $maxBytes) {
        return null; // drop silently - the event still records, context doesn't
    }

    return $encoded;
}
```

8KB is plenty for any real error context. Oversized context is dropped silently - you lose the context blob, not the event.

---

## Issue 4 - 15 database queries per pageview

**The problem:**

Every single pageview fired up to 15 sequential round-trips to MySQL:

- `SELECT visitor` → maybe `INSERT visitor` → `UPDATE visitor last_seen`
- `SELECT session` → maybe `INSERT session` → `UPDATE session last_activity`
- `SELECT dedup check`
- `SELECT location` → maybe `INSERT location`
- `SELECT device` → maybe `INSERT device`
- `SELECT bounce count` → maybe `UPDATE bounce flag`
- `INSERT pageview`

On shared hosting with 15–25 max DB connections, under 50 concurrent users these pile up and the connection pool saturates.

**The fix - `INSERT ... ON DUPLICATE KEY UPDATE`:**

One query instead of two, atomically.

```sql
INSERT INTO visitors (project_id, visitor_hash, fingerprint_hash)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
    fingerprint_hash = IF(
        fingerprint_hash = '' AND VALUES(fingerprint_hash) != '',
        VALUES(fingerprint_hash),
        fingerprint_hash
    ),
    last_seen = NOW()
```

Bounce flag - replaced a separate `COUNT(*) + UPDATE` with a single conditional `UPDATE`:

```sql
UPDATE sessions
SET is_bounced = 0
WHERE id = ?
  AND is_bounced = 1
  AND (SELECT COUNT(*) FROM pageviews WHERE session_id = ?) > 1
```

Result: **15 queries → 6–8** in the typical path for a returning visitor.

---

## Issue 5 - GeoIP file opened on every request

**The problem:**

```php
$reader = new \MaxMind\Db\Reader($dbPath);
$record = $reader->get($ip);
$reader->close();
```

Every tracking request opened the `.mmdb` file, read it, and closed it. On a busy endpoint, this was 20–80ms of overhead per request, every request.

**The fix - PHP static variables:**

A static variable inside a function is initialised once and persists for the lifetime of that PHP-FPM worker process:

```php
static $reader = null;
if ($reader === null) {
    $reader = new \MaxMind\Db\Reader($dbPath);
}
$record = $reader->get($ip);
// no close() - PHP cleans it up at process shutdown
```

First request: opens the file. Every request after that: reuses the open reader. Free performance, zero risk.

---

## Two operational fixes

**Log rotation.** `file_put_contents($logPath, $line, FILE_APPEND)` appended forever. One busy month and you have a 2GB log file on a shared host with disk quotas.

Fixed with shift rotation - before writing, check file size. If over 10MB, shift all existing files down (`.1→.2` up to `.5`, oldest deleted) and start fresh. Max 60MB on disk, last 50MB of history always preserved. Pure PHP, no cron.

**Request ID in logs.** Before this fix, logs under load looked like:

```
[14:22:01] [ERROR] [pageview.php] DB insert failed
[14:22:01] [ERROR] [pageview.php] DB insert failed
[14:22:01] [ERROR] [pageview.php] DB insert failed
```

3 errors at the same second. Is this 1 request that failed 3 times, or 3 different requests that each failed once? You can't tell.

Fixed by generating a unique 8-character ID per HTTP request:

```php
$GLOBALS["request_id"] = substr(bin2hex(random_bytes(4)), 0, 8);
```

Now:

```
[14:22:01] [ERROR] [a3f9c12b] [pageview.php] DB insert failed
[14:22:01] [ERROR] [a3f9c12b] [pageview.php] DB insert failed
[14:22:01] [INFO]  [f91c3d77] [pageview.php] pageview recorded
```

Same ID = same request. `grep "a3f9c12b" micrologs.log` shows the complete story of that one request from start to finish.

---

## What this changed

After all fixes, Micrologs handles ~10,000 pageviews/day on a standard shared host. No Redis, no queue, no VPS required.

The five issues above aren't exotic bugs. They're the standard gap between "works in development" and "survives real traffic." None of them showed up in testing. All of them would have shown up under load.

The lesson I keep re-learning: shipping v1 is step one. Reviewing it like you're trying to break it is step two. Most developers skip step two.

---

## What shipped after

- **v1.2.0** - Three new analytics endpoints: session duration and pages per session, new vs returning visitors, error trends over time
- **v1.3.0** - Full project management, link edit endpoints, error group status updates with `open → investigating → resolved / ignored` workflow
- **@micrologs/node v1.0.0** - Official Node.js SDK on npm. Zero dependencies, Node 18+, silent on failure

---

## The project

Micrologs is MIT licensed and open source.

- GitHub: [github.com/OmDongaonkar03/Micrologs](https://github.com/OmDongaonkar03/Micrologs)
- Node SDK: [npmjs.com/package/@micrologs/node](https://npmjs.com/package/@micrologs/node)

Python and Laravel SDKs are open contributions if that's your stack.