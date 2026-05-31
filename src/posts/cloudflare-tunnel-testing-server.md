---
title: "How I Built a Permanent Testing Server Using Cloudflare Tunnel"
date: "2026-05-31"
order: 1
tags: ["devops", "cloudflare", "infrastructure", "php", "nodejs"]
excerpt: "ngrok URLs die. Cloud servers are overkill. I needed every local project to have a permanent public HTTPS URL accessible from anywhere — zero cloud cost, survives reboots. Here's the full setup using Cloudflare Tunnel on a spare Windows machine."
readTime: "8 min read"
---

# How I Built a Permanent Testing Server Using Cloudflare Tunnel

At work, we were constantly running into the same problem. A tester needs to check something, a client wants to preview a build, someone's on a different network - and the only options were spinning up a cloud server (overkill for testing), using ngrok (URLs die the moment you close the terminal), or asking everyone to physically come to the machine. None of these were sustainable.

So I set up a proper testing infrastructure using Cloudflare Tunnel on a spare Windows machine we had. Every project now has a permanent public HTTPS URL, accessible from anywhere in the world, that survives reboots - zero cloud cost.

Here's exactly how I built it.

---

## How It All Connects

Before getting into the setup, it helps to understand the architecture:

```
Tester anywhere in the world
           │
           ▼
project1.yourdomain.com        ← Cloudflare DNS
           │
           ▼
Cloudflare Network             ← forwards via tunnel
           │
           ▼
cloudflared on spare machine   ← tunnel client, always running
           │
           ▼
localhost:3001                 ← Apache or Node serving the project
           │
           ▼
Your actual project code
```

The key insight: the machine reaches OUT to Cloudflare, not the other way around. Your ISP never sees incoming traffic. Nothing to port-forward, nothing to block.

---

## Prerequisites

- A spare Windows machine (always-on)
- XAMPP installed (Apache only needed, MySQL optional)
- A domain you own
- A free Cloudflare account
- cloudflared CLI ([download from GitHub](https://github.com/cloudflare/cloudflared/releases))
- Node.js + PM2 (only if you have Node projects)

---

## Part A - Connect Your Domain to Cloudflare

This is a one-time step. After this, all DNS management happens on Cloudflare.

**1. Add your domain to Cloudflare**

Login to cloudflare.com → Add a Site → enter your domain → select Free plan. Cloudflare will scan your existing DNS records automatically.

**2. Get your nameservers**

Cloudflare will give you two nameservers like:
```
ns1.cloudflare.com
ns2.cloudflare.com
```

**3. Point your registrar to Cloudflare**

Go to your domain registrar (GoDaddy, Namecheap, etc.) → find the nameserver settings → replace them with the two Cloudflare nameservers.

DNS propagation takes anywhere from 5 minutes to a few hours. After this, your domain is fully managed by Cloudflare and you never touch the registrar for DNS again.

> **Note:** Any existing DNS records (MX records for email etc.) were copied by Cloudflare during the scan. Your existing services won't break.

---

## Part B - XAMPP Virtual Hosts for PHP Projects

By default Apache serves everything from port 80 under `/htdocs`. Virtual Hosts let each project get its own port so the routing logic in your PHP code needs zero changes.

**Before:**
```
localhost/project1 → htdocs/project1
localhost/project2 → htdocs/project2
```

**After:**
```
localhost:3001 → htdocs/project1 (project thinks it's at /)
localhost:3002 → htdocs/project2 (project thinks it's at /)
```

### Step 1 - Add extra ports to Apache

Open `C:\xampp\apache\conf\httpd.conf` and find the Listen section:

```apache
Listen 80
Listen 3001
Listen 3002
Listen 3003
# Add one line per project
```

### Step 2 - Enable the virtual hosts include

In the same file, make sure this line is not commented out:

```apache
Include conf/extra/httpd-vhosts.conf
```

### Step 3 - Configure virtual hosts per project

Open `C:\xampp\apache\conf\extra\httpd-vhosts.conf` and add a block for each project:

```apache
<VirtualHost *:3001>
    DocumentRoot "C:/xampp/htdocs/project1"
    <Directory "C:/xampp/htdocs/project1">
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>

<VirtualHost *:3002>
    DocumentRoot "C:/xampp/htdocs/project2"
    <Directory "C:/xampp/htdocs/project2">
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### Step 4 - Restart Apache and verify

Open XAMPP Control Panel → Stop Apache → Start Apache. Then open `http://localhost:3001` in your browser - you should see your project homepage.

> **Troubleshooting:** If you get 403 Forbidden, double check `AllowOverride All` and `Require all granted` are in the Directory block. If Apache won't start, check port conflicts: `netstat -ano | findstr :3001`

### Step 5 - Make Apache auto-start on boot

In XAMPP Control Panel, click the checkbox under the **Svc** column next to Apache → click Yes. Apache now starts automatically every time Windows boots.

---

## Part C - PM2 for Node Projects

Skip this part if you have no Node.js projects.

PM2 is a process manager that keeps Node apps running permanently and restarts them automatically after crashes or reboots.

### Install PM2

```bash
npm install -g pm2
npm install -g pm2-windows-startup
```

### Start your Node project

```bash
cd C:\projects\myapp
pm2 start server.js --name myapp
```

### Set the port in your app

```js
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
```

Each Node project gets its own port number - same as Apache virtual hosts.

### Save and auto-start on boot

```bash
pm2 save
pm2-startup install
```

**Useful PM2 commands:**

| Command | What it does |
|---|---|
| `pm2 list` | See all running projects |
| `pm2 logs myapp` | Live logs for a project |
| `pm2 restart myapp` | Restart after code changes |
| `pm2 monit` | Live CPU/memory dashboard |

---

## Part D - Cloudflare Tunnel Setup

This is the core of the whole thing. One-time setup - after this, subdomains are permanent and survive reboots forever.

### Step 1 - Install cloudflared

Download `cloudflared-windows-amd64.exe` from the [GitHub releases page](https://github.com/cloudflare/cloudflared/releases), rename it to `cloudflared.exe`, and place it at `C:\cloudflared\cloudflared.exe`.

Add it to your system PATH:
1. Open Start → search **Environment Variables**
2. Under System Variables find **Path** → Edit
3. Add `C:\cloudflared`

Verify the install:
```bash
cloudflared --version
```

### Step 2 - Login to Cloudflare

```bash
cloudflared tunnel login
```

This opens your browser. Authorize the account where your domain lives. A certificate is saved automatically at `C:\Users\YourUser\.cloudflared\cert.pem`.

### Step 3 - Create a tunnel

You only need one tunnel for all projects if you use a single config file (recommended):

```bash
cloudflared tunnel create testing-server
```

This outputs a tunnel ID (a long UUID). Note it down - you'll need it in the config file.

### Step 4 - Map subdomains to the tunnel

```bash
cloudflared tunnel route dns testing-server project1.yourdomain.com
cloudflared tunnel route dns testing-server project2.yourdomain.com
```

This automatically creates the DNS records on Cloudflare. You don't need to touch the dashboard. These subdomains are now permanent - they survive reboots and restarts.

### Step 5 - Create the config file

Create `C:\Users\YourUser\.cloudflared\config.yml`:

```yaml
tunnel: testing-server
credentials-file: C:\Users\YourUser\.cloudflared\<tunnel-id>.json

ingress:
  - hostname: project1.yourdomain.com
    service: http://localhost:3001
  - hostname: project2.yourdomain.com
    service: http://localhost:3002
  - hostname: nodeapp.yourdomain.com
    service: http://localhost:4000
  - service: http_status:404
```

Replace `<tunnel-id>` with the actual UUID from Step 3.

### Step 6 - Test run

```bash
cloudflared tunnel --config C:\Users\YourUser\.cloudflared\config.yml run
```

Open `project1.yourdomain.com` in your browser. If your site loads, the tunnel is working. Press Ctrl+C to stop.

### Step 7 - Run as a Windows service

```bash
cloudflared service install
net start cloudflared
```

This registers cloudflared as a Windows service that starts on boot. From this point, everything is permanent and automatic.

---

## Part E - Adding a New Project

Every time you add a project, this is the checklist. Takes about 5 minutes.

**For a PHP project:**
1. Create folder at `C:\xampp\htdocs\projectX`
2. Add `Listen 300X` to `httpd.conf`
3. Add `<VirtualHost *:300X>` block to `httpd-vhosts.conf`
4. Restart Apache from XAMPP Control Panel
5. Add new hostname entry to `config.yml`
6. Restart cloudflared: `net stop cloudflared && net start cloudflared`
7. Open `projectX.yourdomain.com` to verify

**For a Node project:**
1. Place project at `C:\projects\projectX`
2. Set `PORT=300X` in `.env`
3. `pm2 start server.js --name projectX`
4. `pm2 save`
5. Add new hostname entry to `config.yml`
6. Restart cloudflared: `net stop cloudflared && net start cloudflared`
7. Open `projectX.yourdomain.com` to verify

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Site not loading | Check Apache is running in XAMPP + `net start cloudflared` |
| 403 Forbidden | Check `AllowOverride All` and `Require all granted` in vhosts config |
| 502 Bad Gateway | Node app not running - check `pm2 list` |
| Port conflict | `netstat -ano | findstr :3001` |
| Tunnel not connecting | Re-run `cloudflared tunnel login` - cert may have expired |
| Node crashes on reboot | Re-run `pm2 save` and `pm2-startup install` |
| Changes not showing (PHP) | Restart Apache after any `.conf` edits |
| Changes not showing (Node) | `pm2 restart projectX` after code changes |

---

## Result

Every project on the machine has a permanent public HTTPS URL. Testers can open the site from anywhere in the world - no same-WiFi requirement, no cloud bill, no manual steps after the initial setup.

The most underrated part is how invisible it becomes once it's running. Nobody has to think about infrastructure. It just works.