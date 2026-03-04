---
title: "Your portfolio site is probably broken in ways you haven't checked"
date: "2026-03-05"
order: 1
tags: ["performance", "security", "webdev"]
excerpt: "I checked my portfolio properly for the first time. D security grade, 4.27s load time, 227 kB of unnecessary data. Here's exactly what was wrong and how I fixed it in a day."
readTime: "6 min read"
---

Most developers spend weeks building their portfolio. The design, the animations, the perfect copy. Then they deploy it and never look at it again.

I did the same thing. Until this week, when I actually checked mine properly for the first time.

Here's what I found - and why your site probably has the same issues.

## The Audit

I ran two checks. One for performance, one for security.

**Performance:** Chrome DevTools → Network tab, throttled to Fast 3G.
**Security:** [securityheaders.com](https://securityheaders.com) - paste your URL, get a grade.

My results:

- Load time: **4.27s**
- Data transferred: **227 kB**
- Security grade: **D**

Not catastrophic. But not good for a site whose entire purpose is to make a first impression on a hiring manager or potential client.

## The Performance Problem

The culprit was immediately obvious in the Network tab: **16 separate PNG requests** just for favicons and icons.

Every request has overhead - DNS lookup, TCP handshake, HTTP round trip. 16 small image requests is worse than 1 slightly larger one.

The fix: replace them with inline SVGs directly in the component. No network requests at all.

```tsx
// Before - 16 separate image requests
<img src="/icons/github.png" />
<img src="/icons/linkedin.png" />
// ... 14 more

// After - zero network requests
<svg viewBox="0 0 24 24" ...>
  <path d="..." />
</svg>
```

The second fix: **lazy load everything below the fold.** React makes this trivial.

```tsx
import { lazy, Suspense } from "react";

const Projects = lazy(() => import("./sections/Projects"));
const Contact = lazy(() => import("./sections/Contact"));

// In your JSX
<Suspense fallback={null}>
  <Projects />
  <Contact />
</Suspense>
```

The browser now only loads what the user can actually see. Everything else loads as they scroll.

**Result: 4.27s → 2.00s. 227 kB → 17.7 kB transferred.**

Same site. Same content. Half the load time, 92% less data.

## The Security Problem

A D grade on securityheaders.com means your site is missing HTTP security headers. These are response headers your server sends that tell the browser how to behave - what it can load, where it can connect, whether it can be embedded in an iframe.

Missing them doesn't break your site. But it means:

- Your site can be embedded in an iframe on another domain (clickjacking)
- Browsers won't enforce HTTPS strictly
- No protection against content injection

The fix for a Cloudflare Pages site is a single `_headers` file in your `/public` folder:

```
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; frame-ancestors 'none';
```

One file. No backend changes. No server config. Cloudflare picks it up on the next deploy.

**Result: D → A on securityheaders.com.**

## What I Built On Top

After fixing the portfolio, I built a blog - this one, at [blogs.omdongaonkar.in](https://blogs.omdongaonkar.in) - as a subdomain of the same domain. Vite + React, posts written in Markdown, auto-deployed to Cloudflare Pages on every push.

Total additional cost: zero. The domain was already there. Cloudflare Pages is free. A subdomain is just a DNS record.

The same `_headers` file approach applies here too. Same security setup, same caching rules, consistent across both.

## The Actual Takeaway

None of this was hard. The performance fixes took just 10 mins and security headers just took 20 minutes. The blog took a day.

The reason most portfolio sites have these issues isn't lack of skill - it's that nobody checks. You build the thing, it looks good in the browser, you ship it and move on.

Run securityheaders.com on your site right now. Open DevTools on a throttled connection. See what actually loads.

You'll probably find the same things I did.