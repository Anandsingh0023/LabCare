# LabCare – Laboratory Maintenance Reporting System

LabCare is a web application for reporting, assigning, tracking and closing maintenance requests for laboratory equipment. It is built with plain **HTML, CSS and vanilla JavaScript** on the frontend and uses **Supabase** (PostgreSQL database + Authentication) as the backend.

---

## Table of contents

1. [Problem statement](#problem-statement)
2. [Objectives](#objectives)
3. [Features](#features)
4. [User roles](#user-roles)
5. [Request workflow](#request-workflow)
6. [Technology stack](#technology-stack)
7. [System architecture](#system-architecture)
8. [Database tables](#database-tables)
9. [Authentication and role-based access control](#authentication-and-role-based-access-control)
10. [Row Level Security and database security](#row-level-security-and-database-security)
11. [Project folder structure](#project-folder-structure)
12. [Local setup](#local-setup)
13. [Supabase configuration](#supabase-configuration)
14. [Deployment on Cloudflare Pages](#deployment-on-cloudflare-pages)
15. [Known limitations and future improvements](#known-limitations-and-future-improvements)
16. [Academic project disclaimer](#academic-project-disclaimer)

---

## Problem statement

Broken laboratory equipment often stays unavailable because faults are reported informally (verbally or on paper) and are not tracked until they are fixed. Nobody can easily see which equipment is broken, who is repairing it, whether the repair was checked, or how often the same equipment fails.

## Objectives

- Provide one place where anyone can report a faulty piece of lab equipment.
- Let a Lab In-charge assign each request to a technician.
- Track every request through a clear status workflow until it is verified and closed.
- Keep a permanent, tamper-resistant history of every action.
- Show live statistics and simple reports based on real data.
- Enforce permissions in the **database**, not only in the user interface.

---

## Features

All features below are implemented in `index.html`, `style.css` and `script.js`.

| Area | What it does |
|---|---|
| **Login / Sign-up** | Email + password authentication with Supabase Auth. Sign-up asks only for full name, email and password (no role field). Shows loading states and clear error messages (wrong password, unconfirmed email, existing account, email rate limit). |
| **Session handling** | A signed-in user stays logged in after a page refresh. The app is hidden until a valid session and profile are loaded. Logout returns to the login screen. |
| **Top bar** | Shows the signed-in user's name and role, read from the database. |
| **Dashboard** | Live counts: Total, Open, Assigned, In Progress, Resolved (awaiting verification), Closed, and High priority (not closed), plus the 5 most recent requests. |
| **Report Issue** | Form with equipment name, lab location (dropdown), description and priority (Low / Medium / High). Validated in the browser and again by the database. |
| **All Requests** | Table with request ID, equipment, lab, reporter, technician, priority, status and date reported. Filters: *All / Reported by me / Assigned to me*, status, priority. Refresh button. |
| **Request Details** | Full information about one request, role-based action buttons, comments and history. |
| **Comments** | Any signed-in user can add a comment. Shows author, date/time and message. |
| **History** | Read-only timeline of every recorded action (created, assigned, status changes, comments, verification, reopening), written automatically by database triggers. |
| **Technicians** | Lists users with the Technician role and their workload (Assigned, In Progress, Awaiting verification, Closed). |
| **Repair History** | Lists closed requests (most recently closed first) with technician, closing date and verifier. |
| **Reports** | Bar charts of request counts by status, by priority and by lab, with the time the data was loaded. |
| **Responsive design** | Sidebar layout on desktop; horizontal swipeable menu and stacked cards on screens 768 px wide or less. |

---

## User roles

| Role | Can do |
|---|---|
| **Reporter** (default for every new account) | Report issues, view requests, add comments. |
| **Technician** | Everything a Reporter can do, plus update **only requests assigned to them**: *Assigned → In Progress → Resolved*. |
| **Lab In-charge** | Everything a Reporter can do, plus assign / reassign technicians, verify and close resolved work, reject a fix (back to In Progress) and reopen a closed request. Rejecting and reopening **require a reason** (at least 5 characters). |

Roles cannot be chosen at sign-up and cannot be changed from the website. Only the project owner can change a user's role in the Supabase Dashboard.

---

## Request workflow

```
Open ──assign──► Assigned ──start work──► In Progress ──mark resolved──► Resolved ──verify & close──► Closed
                     ▲                         ▲                             │                          │
                     └──── reassign ───────────┘◄──── reject fix (reason) ───┘                          │
                                               ◄──────────────── reopen (reason) ───────────────────────┘
```

- A new request always starts as **Open**.
- Assigning (or reassigning) a technician always sets the status to **Assigned**.
- Only the assigned technician can start work and mark it resolved.
- Only the Lab In-charge can verify & close, reject a fix, or reopen. The person who verifies is recorded.

---

## Technology stack

| Layer | Technology |
|---|---|
| Structure | HTML5 (`index.html`) |
| Styling | CSS3 with variables, Flexbox, Grid and media queries (`style.css`) |
| Logic | Vanilla JavaScript – no framework (`script.js`) |
| Backend | [Supabase](https://supabase.com): PostgreSQL database, Supabase Auth, auto-generated REST API |
| Client library | `@supabase/supabase-js` **v2.118.0**, loaded from the jsDelivr CDN with a `<script>` tag |

There is no build step, no Node.js server and no package manager.

---

## System architecture

```
┌──────────────────────────┐        HTTPS (JSON)        ┌─────────────────────────────────────┐
│ Browser                  │ ─────────────────────────► │ Supabase                            │
│  index.html  style.css   │                            │  • Auth (sign-up, login, sessions)  │
│  script.js               │ ◄───────────────────────── │  • REST API (PostgREST)             │
│  supabase-js (CDN)       │                            │  • PostgreSQL: tables, RLS policies,│
└──────────────────────────┘                            │    triggers, column privileges      │
                                                        └─────────────────────────────────────┘
```

1. `index.html` loads the Supabase library from the CDN, then `script.js`.
2. `script.js` creates one connection object, `supabaseClient`, using the **Project URL** and the **publishable (anon) key**.
3. After login, Supabase stores a signed session token (JWT) in the browser. Every database request automatically sends this token.
4. The frontend uses the query builder, for example:
   ```js
   const result = await supabaseClient
     .from("requests")
     .select("id, equipment_name, status")
     .order("created_at", { ascending: false });
   ```
   Every call returns `{ data, error }`, which the app checks before updating the page.
5. The database decides what the user may read or change (see [security](#row-level-security-and-database-security)). Hiding buttons in the UI is for convenience only.

### About the publishable key

The Supabase **Project URL** and **publishable key** are set as constants at the top of `script.js`. The publishable key is designed to be public: on its own it can only do what the database's Row Level Security and privileges allow. The values are deliberately **not reproduced in this README**.

The **secret / `service_role` key is never used in this project** and must never be placed in frontend code.

---

## Database tables

All tables are in the `public` schema of the Supabase PostgreSQL database.

| Table | Purpose | Main columns |
|---|---|---|
| `profiles` | One row per user, linked to `auth.users`. Stores the display name and role. | `id`, `full_name`, `role` (`reporter` / `technician` / `incharge`), `created_at` |
| `requests` | One row per maintenance request. | `id`, `equipment_name`, `lab_location`, `description`, `priority`, `status`, `reported_by`, `assigned_to`, `created_at`, `closed_at`, `verified_by`, `rework_reason` |
| `comments` | Comments and updates on a request. | `id`, `request_id`, `author_id`, `message`, `created_at` |
| `history` | Automatic, append-only log of every action on a request. | `id`, `request_id`, `actor_id`, `source`, `login_role`, `jwt_role`, `action`, `details`, `created_at` |

**Relationships (foreign keys):** `requests.reported_by`, `requests.assigned_to` and `requests.verified_by` reference `profiles`. `comments.request_id` and `history.request_id` reference `requests`. One request can have many comments and many history entries.

**Constraints include:** allowed values for `role`, `priority` and `status`; text length limits; every status except *Open* needs a technician; `closed_at` is set only when *Closed*; a rework reason must be 5–500 characters.

---

## Authentication and role-based access control

- **Sign-up** sends only full name, email and password to Supabase Auth.
- A database trigger (`handle_new_user`) automatically creates a `profiles` row with role **`reporter`**. The role is written by the database, so a user cannot pick their own role, even by editing the request in the browser.
- **Email confirmation**: if confirmation is enabled in Supabase, the user must click the link in the email before logging in.
- **Login** uses `signInWithPassword`. The app then reads the user's `full_name` and `role` from `public.profiles`. If the profile cannot be read, the user is signed out and the app stays hidden.
- **Role changes** are made only by the project owner in the Supabase Dashboard (Table Editor or SQL Editor). Website users have no permission to update `profiles`.
- The frontend shows only the actions allowed for the current role and status, but every change is checked again by the database.

---

## Row Level Security and database security

Security is enforced inside PostgreSQL in three layers:

| Layer | What it controls | Example |
|---|---|---|
| **Column privileges** (`GRANT` / `REVOKE`) | Which columns website users may write | New requests may only set `equipment_name`, `lab_location`, `description`, `priority`. Updates may only change `status`, `assigned_to`, `rework_reason`. |
| **Row Level Security (RLS)** | Which rows a user may read or change | Signed-in users can read requests; a technician can update only rows where `assigned_to` is their own ID; only the Lab In-charge can update any request. |
| **Triggers** | Whether a change follows the workflow | Only the In-charge may assign, close, reject or reopen; a reason is required for rework; new requests must start as *Open*. |

Other protections:

- Signed-out visitors (`anon` role) have **no access** to any table.
- Nobody can **delete** requests through the website.
- `reported_by` and comment `author_id` are set from the signed-in user's ID by the database, so users cannot act under another identity.
- **History is written only by triggers** and cannot be updated, deleted or truncated (blocked even for direct database edits unless the owner deliberately disables the protection).
- Functions that run with elevated rights (`SECURITY DEFINER`) are limited to the sign-up and history triggers, use an empty `search_path`, and cannot be called directly by website users.
- In the frontend, all user-provided text is displayed with `textContent` / `createElement` (never `innerHTML`) to prevent cross-site scripting (XSS).

---

## Project folder structure

```
LabCare/                     # Git repository root
├── README.md
└── lab-maintenance-system/  # the website (this is the folder that gets deployed)
    ├── .gitignore           # ignores .DS_Store, node_modules/, .env files, logs (inside this folder)
    ├── index.html           # login screen + all app sections (dashboard, forms, tables, details)
    ├── style.css            # design system, layout, components, responsive rules
    └── script.js            # Supabase connection, navigation, auth, data loading, workflow
```

`script.js` is organised in numbered sections:

| Section | Contents |
|---|---|
| 0 | Supabase connection (`supabaseClient`) |
| 1–4 | Sidebar navigation (`showSection`) |
| 5 | Authentication: login, sign-up, logout, session start-up |
| 6 | Shared data and helper functions |
| 7 | Loading profiles and requests (`refreshAllData`) |
| 8 | Dashboard, All Requests, Technicians, Repair History, Reports |
| 9 | Report Issue form |
| 10 | Request Details, actions, comments, history |
| 11 | App start-up |

---

## Local setup

### Requirements

- A modern browser (Chrome, Edge or Firefox).
- An internet connection (Supabase and the CDN are online services).
- [Visual Studio Code](https://code.visualstudio.com/) with the **Live Server** extension (recommended), or any static file server.
- A Supabase project prepared as described in [Supabase configuration](#supabase-configuration).

### Steps

1. Get the project:
   ```bash
   git clone <your-repository-url>
   ```
   ```bash
   cd LabCare/lab-maintenance-system
   ```
2. Open `script.js` and set your own values at the top (Section 0):
   ```js
   const SUPABASE_URL = "https://<your-project-ref>.supabase.co";
   const SUPABASE_PUBLISHABLE_KEY = "<your-publishable-or-anon-key>";
   ```
   Find them in the Supabase Dashboard under **Project Settings → API**. Never use the secret / `service_role` key.
3. Open the project in VS Code, right-click `lab-maintenance-system/index.html` and choose **Open with Live Server**. If you opened the whole `LabCare` folder in VS Code, the address will be similar to `http://127.0.0.1:5500/lab-maintenance-system/index.html`.

   Without VS Code, any static server works. Run it from inside `lab-maintenance-system/` (the folder that contains `index.html`), then open `http://127.0.0.1:5500/`:
   ```bash
   python3 -m http.server 5500
   ```
4. Sign up or log in. Open the browser console (F12) to see any errors.

---

## Supabase configuration

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Create the database objects** (tables, constraints, indexes, functions, triggers, privileges and RLS policies) by running the project's SQL setup script once in **SQL Editor**, with the Role set to `postgres`.
   > Note: the SQL setup script is **not currently stored in this repository**. See [future improvements](#known-limitations-and-future-improvements).
3. **Authentication → Providers:** enable Email. Keep **Confirm email** on.
4. **Authentication settings:** keep **anonymous sign-ins** turned off.
5. **Authentication → URL Configuration:**
   - **Site URL:** the address where the app runs (local Live Server address during development, or the deployed URL).
   - **Redirect URLs:** add the same addresses, for example `http://127.0.0.1:5500/**` for local development.
6. **Assign staff roles:** new users are always Reporters. To make someone a Technician or Lab In-charge, edit their `role` in `public.profiles` using the Supabase Dashboard (Table Editor or SQL Editor), for example:
   ```sql
   update public.profiles set role = 'technician' where id = '<user-uuid>';
   ```
7. **Keys:** copy only the Project URL and publishable key into `script.js`.

---

## Deployment on Cloudflare Pages

LabCare is a static site, so it can be hosted on [Cloudflare Pages](https://pages.cloudflare.com/) without a build step.

In this repository the website files are **not** at the repository root; they are inside the `lab-maintenance-system/` folder. The Cloudflare settings must point to that folder.

1. Push the project to a GitHub repository.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and select the repository.
3. Use this exact working configuration (Root directory is under **Root directory (advanced)**):

   | Setting | Value |
   |---|---|
   | Root directory | `lab-maintenance-system` |
   | Build output directory | `/` |
   | Build command | *(leave empty)* |
   | Framework preset | None |

   The build output directory is relative to the root directory, so `/` here means "publish the contents of `lab-maintenance-system/`". The app is then served at the site's root address.

   > If **Root directory** is left empty while the build output directory is `/`, Cloudflare publishes the whole repository. The app then works only at `https://<project-name>.pages.dev/lab-maintenance-system/` (the bare site address has no `index.html`). In that case use this full address everywhere below.

4. Deploy. Cloudflare gives the site an address such as `https://<project-name>.pages.dev`.
5. In Supabase, go to **Authentication → URL Configuration**, set the **Site URL** to the address where the app actually opens and add it to **Redirect URLs** (for example `https://<project-name>.pages.dev/**`), so confirmation emails link back to the live site.
6. Open the deployed site and test sign-up, login and logout.

---

## Known limitations and future improvements

### Known limitations

- The **lab list** in the Report Issue form is a fixed list in `index.html`; it must be edited by hand to match real labs.
- All requests are loaded at once; there is no pagination or text search.
- Every signed-in user can view all requests, comments and history (by design for a lab-wide system).
- Role changes are made only in the Supabase Dashboard; there is no admin page in the app.
- No email or push notifications when a request is assigned or updated.
- No photo uploads of broken equipment.
- An internet connection is required.
- Supabase's built-in email service limits how many confirmation emails can be sent per hour.
- Users who have created records cannot simply be deleted (their records are protected by foreign keys); they should be banned or demoted instead.
- The project owner (database administrator) can still change data directly in the database.

### Future improvements

- Store the SQL setup script and test suite in the repository (e.g. a `database/` folder).
- Search and pagination for large numbers of requests.
- In-app administration page for managing roles (with a secure server-side function).
- Email notifications for assignment and status changes.
- Image attachments using Supabase Storage.
- Export reports to CSV or PDF.
- Configurable lab list stored in the database.

---

## Academic project disclaimer

This project was developed as an academic project for a first-year BTech Computer Science and Engineering course. It is intended for learning and demonstration purposes. It has not been audited for production use, and it should not be relied on to manage real equipment or sensitive data without further review, testing and hardening.
