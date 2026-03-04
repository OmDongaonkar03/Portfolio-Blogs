---
title: "I Built a Self-Hostable Plausible + Sentry Alternative in One Day"
date: "2026-02-27"
order: 3
tags: ["analytics", "php", "opensource"]
excerpt: "Every analytics or error tracking tool assumed you had a VPS or were happy paying a SaaS bill. So I built one that runs on shared hosting. In a day."
readTime: "6 min read"
---

I worked on projects that run on shared hosting. PHP + MySQL, no root access. It's a real environment that a lot of developers actually ship to - and almost no tooling is built for it.

But every analytics or error tracking tool I looked at assumed you had a VPS at minimum, or were happy paying a SaaS bill every month. Plausible is great - but it's paid per site, and self-hosting it means Docker, which means a VPS. Sentry's free tier is generous until it isn't. And there was a hard requirement: no third-party services touching user data.

So I built one. In a day. It's called **Micrologs**.

## What it does

Drop one script tag on your site:

```html
<script
  src="https://yourdomain.com/snippet/micrologs.js"
  data-public-key="your_public_key"
  data-environment="production"
  async>
</script>
```

From that point, you get:

- Pageviews, sessions, unique visitors, bounce rate
- Country / region / city breakdown (via local MaxMind GeoLite2 - no runtime API calls)
- Device, OS, browser breakdown
- Referrer categorization - organic, social, email, referral, direct
- UTM campaign tracking
- JS errors auto-caught - `window.onerror` and `unhandledrejection`, grouped by fingerprint
- Manual error tracking from any backend over a single HTTP call
- Audit logging
- Tracked link shortener with click analytics

All of it hits your own database. Nothing leaves your server.

## The constraint that shaped everything

Shared hosting means no Redis, no background workers, no daemons, no WebSockets. You get PHP and MySQL and that's it.

This forced some interesting decisions.

**Rate limiting without Redis.** Most rate limiters use Redis or a DB table with a timestamp. I went file-based - append-only `.req` files, one per request, inside a per-IP directory. Counting recent requests = counting files newer than the window. No locking, no DB writes on every request, works on any host.

```php
foreach (glob($userDir . "/*.req") as $file) {
    if ($now - filemtime($file) <= $windowSeconds) {
        $attempts++;
    } else {
        @unlink($file);
    }
}
```

Cleanup runs probabilistically - 1% chance on each request. No cron job needed.

**Geolocation without API calls.** MaxMind's GeoLite2 database ships as a `.mmdb` file you drop on your server. Every lookup is local. Zero latency overhead, zero external dependency at runtime.

**Visitor identification without being creepy.** No raw IPs stored, ever. IPs are SHA-256 hashed with a salt immediately on ingestion. For visitor tracking, a UUID is stored in a cookie for 365 days. If the cookie gets cleared, a canvas fingerprint kicks in as a fallback to re-identify the same visitor - then re-associates the new cookie hash so the next visit is seamless again.

## The architecture is designed in stages

- **v1** - clean REST API, works on shared hosting, zero extra infrastructure
- **v2** - Redis caching, async queuing, webhook alerts - opt-in for VPS users
- **v3** - WebSockets and a live dashboard feed - opt-in for realtime

The key decision: each stage is strictly opt-in. Shared hosting users will never be broken by what VPS users unlock.

## Some implementation details worth talking about

**Error grouping by fingerprint.** When an error comes in, I hash `project_id + error_type + message + file + line` into a SHA-256 fingerprint. Same error fires 1000 times - 1 group, 1000 occurrences. If you mark an error as resolved and it fires again, it automatically reopens.

```php
$fingerprint = hash(
    "sha256",
    $projectId . $errorType . $message . $file . ($line ?? "")
);
```

**Public key vs secret key separation.** The JS snippet uses a public key - safe to expose in the browser, locked to a whitelist of allowed domains. Analytics queries and link management use a secret key - server-side only, never in frontend code.

**SPA support in the snippet.** History-based routing doesn't trigger page loads, so `pushState` and `replaceState` get patched to fire pageviews on navigation.

```js
history.pushState = function () {
    _push.apply(this, arguments);
    onUrlChange();
};
```

**Bot filtering.** UA string matching is obvious, but real browsers always send `Accept-Language` and `Accept` headers. If those are missing, it's a bot or a script regardless of what the UA says.

## What the API looks like

```bash
curl https://yourdomain.com/api/analytics/visitors.php?range=30d \
  -H "X-API-Key: your_secret_key"
```

```json
{
  "success": true,
  "data": {
    "unique_visitors": 1842,
    "total_pageviews": 5631,
    "bounce_rate": 43.2,
    "over_time": [
      { "date": "2026-01-28", "pageviews": 178, "unique_visitors": 91 }
    ]
  }
}
```

It's an engine, not a dashboard. The data comes back as JSON - what you do with it is up to you.

## Stack

- PHP 8.1+
- MySQL 8.0+ / MariaDB 10.4+
- MaxMind GeoLite2 (local `.mmdb` file)
- Vanilla JS snippet, zero dependencies, ~3KB

No Node, no Docker, no Redis, no build step. Clone it, import the schema, fill in the env file, drop the snippet. That's the entire setup.

## It's already in production

We shipped it internally at the company the same day I built it. It's tracking real traffic right now.

## Open source, MIT

GitHub: [github.com/OmDongaonkar03/Micrologs](https://github.com/OmDongaonkar03/Micrologs)

If you're on shared hosting, running a privacy-first product, or just tired of paying for tools you could own - give it a try. Issues and PRs are open.

v2 is next. Webhooks for error alerts, Redis caching as opt-in, async queuing. If you have thoughts on what matters most, open an issue.