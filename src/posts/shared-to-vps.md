---
title: "What Happens When You Move From Shared Hosting to a VPS"
date: "2026-03-10"
order: 1
tags: ["performance", "php", "architecture", "self-hosted"]
excerpt: "Micrologs v1 ran on shared hosting — PHP + MySQL, no extras, ~10k pageviews/day ceiling. v2 runs on a VPS. The ceiling jumped to 500k pageviews/day on a single node — and unbounded with proper load balancing. Here's what actually changed."
readTime: "7 min read"
---

Micrologs v1 was deliberately constrained. PHP + MySQL, no Redis, no background workers, no VPS required. The pitch was: drop one file on your $2/month shared host and start tracking. That worked. v1.3.1 is the stable shared hosting release and it handles ~10,000 pageviews/day without complaint.

But somewhere around v1.3.1, I started thinking about what happened when you removed those constraints.

Not "rewrite in Go" or "switch to Postgres." Same PHP. Same MySQL. Just a VPS — which means persistent processes, background workers, and access to a fast in-memory store like Valkey.

The ceiling went from ~10,000 pageviews/day to ~500,000 on a single node. With proper load balancing and node management, that number climbs to ~2.4M. Here's what actually changed and why.

---

## The real constraint on shared hosting isn't the hardware

On shared hosting, PHP starts fresh on every request, does its work, and dies. No state between requests. No background processes. No way to keep anything alive between calls.

This means every single thing that needs to happen for a pageview — auth, geolocation, user agent parsing, database writes — has to happen synchronously, inside that one request, while the user's browser waits for a response.

On a quiet site, that's fine. Under real load, it becomes the ceiling. PHP-FPM workers pile up waiting on database queries. The connection pool saturates. Everything slows down together.

The problem isn't that shared hosting is slow. It's that the synchronous-everything model has nowhere to go. You can't offload work anywhere, because there's nowhere to offload it to.

On a VPS, that changes.

---

## What a VPS actually unlocks

Two things specifically:

**Persistent processes.** PHP-FPM workers are long-lived on a VPS. A cached value in process memory stays cached. A Valkey connection stays open. A background worker keeps running. You stop paying the cold-start cost on every single request.

**Background work.** You can run Supervisor. You can keep worker processes alive. You can have things happening in the background that have nothing to do with the current HTTP request. This is the big one.

Micrologs v2 uses both.

---

## The shift: stop doing everything in the request cycle

In v1, a single pageview triggered the full stack synchronously — geolocation, user agent parsing, session resolution, database writes — all of it blocking, all of it happening while the browser waited.

In v2, the tracking endpoint does almost nothing. It validates auth, hashes the IP, and pushes the raw payload to a Valkey queue. That's it. Response goes back to the browser in ~2–5ms.

The actual work — GeoIP lookup, UA parsing, all the database writes — happens in a background worker that pulls from the queue and processes jobs completely off the HTTP request cycle.

The data that ends up in the database is identical to v1. The enrichment still happens. It just happens after the response, not before it.

This one shift is responsible for most of the throughput gain. A PHP-FPM worker that responds in 2ms can handle ~30,000 requests/minute. One that responds in 150ms handles ~400. That gap is the ceiling difference between v1 and v2.

---

## Caching on the read side

The queue handles writes. Valkey also handles reads.

Analytics queries are expensive — they touch a lot of rows. In v1, every analytics request hit MySQL directly. If you're polling a dashboard every 30 seconds, you're running that query every 30 seconds.

In v2, the first request hits MySQL and the result is cached in Valkey with a TTL. Every request within that window returns the cached result at ~2ms. Workers invalidate the cache when new data is written. Polling dashboards become nearly free.

---

## Schema cleanup

This one doesn't make headlines but it compounds over time.

Redundant indexes, dead indexes from old query paths, composite indexes that could be consolidated — v2.1.0 was a cleanup pass on all of it. The DB sees less write amplification per INSERT and the indexes stay leaner as the dataset grows. On a small dataset these gains are invisible. On a table with millions of rows under sustained write load, they matter.

---

## What the numbers look like

Stress test: 100 virtual users, 60 seconds, Docker on WSL2.

| Metric | Before (v2.1.0) | After (v2.2.0) |
|---|---|---|
| Requests/minute | ~1,300 | ~16,000 |
| p95 latency | ~6,000ms | ~400ms |
| Error rate | high | ~2% (WSL2 TCP noise) |

The ~2% error rate is from WSL2's virtualisation layer, not the application. On a real Linux VPS, p99 < 10ms is expected.

---

## The ceiling, explained

**v1.3.1 (shared hosting):** ~10,000 pageviews/day. Synchronous everything. Runs on $2/month.

**v2.2.0 (single VPS node):** ~500,000 pageviews/day. Async queue, background workers, analytics cache.

**v2.2.0 (with load balancing + multiple nodes):** Theoretically unbounded. The async architecture is horizontally scalable by design — stateless tracking endpoint, workers pulling from a shared queue. How far it scales depends entirely on how much infrastructure you throw at it. Adding nodes doesn't require redesigning anything.

---

## There's still a lot left to do

Honest caveat: v2 is not a fully optimized system. It's a meaningfully better architecture than v1, and the numbers show that. But there are optimizations I haven't touched yet — better worker concurrency tuning, smarter cache invalidation, connection pooling, more granular queue prioritization.

I'll get to them as I learn more. That's the honest state of it. Every version of Micrologs has been the same loop: build it, ship it, review it under real conditions, find what breaks, fix it. v2 is no different. The 500k ceiling is real today. What it looks like in v3 depends on what I learn between now and then.

---

## The project

Micrologs is MIT licensed. v1.3.1 is the stable shared hosting release. v2.2.0 is the current stable VPS release.

- GitHub: [github.com/OmDongaonkar03/Micrologs](https://github.com/OmDongaonkar03/Micrologs)