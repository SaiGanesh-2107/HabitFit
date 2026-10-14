# HabitFit — Daily Habit Tracker & Workout Planner

**HabitFit** is a full-stack, responsive web application for managing daily habits, planning weekly gym workout splits, logging active workout sessions with sets/reps/weights, and tracking meaningful fitness progress.

Built with **HTML5, CSS3, Vanilla JavaScript, Python (Flask), SQLite, and Chart.js**.

---

## 1. Project Structure

```text
habitfit/
├── app.py                      # Flask routes, authentication & REST APIs
├── database.py                 # SQLite schema, workout templates & demo seeding
├── requirements.txt            # Flask, Werkzeug, python-dotenv
├── .env.example                # Environment variables template
├── .env                        # Local development configuration
├── README.md                   # Setup, architecture & running guide
├── templates/
│   ├── base.html               # Master layout: 230px fixed navy sidebar, header, mobile bottom nav
│   ├── login.html              # Sign-in page + 1-Click Demo Login
│   ├── register.html           # User registration & starting split selector
│   ├── dashboard.html          # Main Dashboard: 4 summary cards, habits list, workout card, weekly chart
│   ├── habits.html             # Daily Habits page: completion toggling, date picker, filters, modal
│   ├── workouts.html           # Workout Planner: 7-day schedule, day cards, routine customization
│   ├── active_workout.html     # Dedicated active workout session: sets table, rest timer, stopwatch
│   ├── progress.html           # Progress & Analytics: 7d/30d/90d filters, consistency & progression charts
│   ├── reminders.html          # Reminders: upcoming vs past list, switches, browser notification alerts
│   └── settings.html           # Minimal settings: profile, light/dark theme, kg/lbs unit, password
└── static/
    ├── css/
    │   └── style.css           # SaaS design system (#F5F7FA, #6C63FF, #16A779, 8px rhythm)
    └── js/
        ├── app.js              # Core API client, toasts, modals, theme toggling, reminder polling
        ├── habits.js           # Habits management, completion, and filters
        ├── workouts.js         # Workout schedule, split switcher, active session & rest timer
        ├── progress.js         # Progress KPIs, Chart.js line charts, and history table
        └── reminders.js        # Reminders list grouping, switches, and scheduling
```

---

## 2. Technology Stack

- **Frontend:** HTML5, CSS3 (Custom SaaS Design System), Vanilla JavaScript (No React/Vue).
- **Backend:** Python (Flask).
- **Database:** SQLite with foreign keys & indexed tables.
- **Charts:** Chart.js 4 (via CDN).
- **Icons:** Font Awesome 6 (via CDN).
- **Notifications:** In-app toast alerts & browser Notifications API.

---

## 3. How to Run Locally in VS Code

### Step 1: Open the Project in VS Code
Open the folder in VS Code:
```text
C:\Users\rudra_s6lz9lz\.gemini\antigravity\scratch\habitfit
```

### Step 2: Open Terminal in VS Code
Press <kbd>Ctrl</kbd> + <kbd>`</kbd> (PowerShell terminal).

### Step 3: (Optional) Create & Activate Virtual Environment
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### Step 4: Install Dependencies
```powershell
pip install -r requirements.txt
```

### Step 5: Start the Flask Application
```powershell
python app.py
```

Open your browser at:  
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 4. Demo Account Credentials

A demo account pre-populated with 14 days of habit consistency, workout sessions, and exercise progression is automatically initialized on startup:

- **Email:** `demo@habitfit.com`
- **Password:** `DemoPass123!`
- Or simply click the **"1-Click Demo Login"** button on the `/login` page.

You can also register a fresh user at `/register`.

---

## 5. Visual Design System

- **Background:** `#F5F7FA`
- **Card Background:** `#FFFFFF`
- **Primary Text:** `#172033`
- **Secondary Text:** `#758096`
- **Primary Accent:** `#6C63FF` (Purple)
- **Completed Status:** `#16A779` (Green)
- **Warning / Pending Status:** `#F2A93B` (Amber)
- **Border:** `#E8ECF2`
- **Sidebar Background:** `#111827` (Dark Navy)
- **Border Radius:** 12–16px
- **Spacing Rhythm:** 8px system
