import os
import sqlite3
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash

DB_PATH = os.environ.get("DATABASE_PATH", "habitfit.db")


def get_db_connection():
    """Create and return a SQLite connection with foreign keys enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


DEFAULT_HABITS = [
    ("Drink water", "Health", "daily", "08:00", 2000, "ml"),
    ("Morning workout", "Fitness", "daily", "07:00", 1, "session"),
    ("Study for one hour", "Learning", "daily", "18:00", 60, "mins"),
    ("Read for 20 minutes", "Personal", "daily", "20:30", 20, "mins"),
]

WORKOUT_SPLIT_TEMPLATES = {
    "ppl": {
        "name": "Push / Pull / Legs (PPL)",
        "days": [
            (0, "Monday", "Push Day", "Chest · Shoulders · Triceps", 55, 0, [
                ("Bench Press", 3, "8", 120),
                ("Incline Dumbbell Press", 3, "10", 90),
                ("Shoulder Press", 3, "10", 90),
                ("Triceps Pushdown", 3, "12", 60),
            ]),
            (1, "Tuesday", "Pull Day", "Back · Rear Delts · Biceps", 60, 0, [
                ("Barbell Deadlift", 3, "6", 150),
                ("Lat Pulldown", 3, "10", 75),
                ("Barbell Row", 3, "8", 90),
                ("Bicep Curl", 3, "12", 60),
            ]),
            (2, "Wednesday", "Legs & Core", "Quads · Hamstrings · Calves · Abs", 60, 0, [
                ("Barbell Squat", 4, "8", 120),
                ("Romanian Deadlift", 3, "10", 90),
                ("Leg Press", 3, "12", 90),
                ("Hanging Leg Raise", 3, "15", 60),
            ]),
            (3, "Thursday", "Rest & Recovery Day", "Active Recovery & Mobility", 30, 1, []),
            (4, "Friday", "Upper Body Power", "Chest · Back · Shoulders", 55, 0, [
                ("Overhead Press", 4, "8", 120),
                ("Pull-Ups", 3, "8", 90),
                ("Dumbbell Bench Press", 3, "10", 90),
                ("Face Pulls", 3, "15", 60),
            ]),
            (5, "Saturday", "Lower Body & Arms", "Legs · Biceps · Triceps", 50, 0, [
                ("Bulgarian Split Squat", 3, "10", 90),
                ("Calf Raises", 4, "15", 60),
                ("Incline Hammer Curl", 3, "12", 60),
                ("Overhead Tricep Extension", 3, "12", 60),
            ]),
            (6, "Sunday", "Rest & Recovery Day", "Sleep, Hydration & Stretching", 20, 1, []),
        ]
    },
    "upper_lower": {
        "name": "Upper / Lower Split",
        "days": [
            (0, "Monday", "Upper Body Strength", "Chest · Back · Arms", 60, 0, [
                ("Bench Press", 4, "6", 120),
                ("Bent-Over Row", 4, "6", 90),
                ("Overhead Press", 3, "8", 90),
                ("Barbell Curl", 3, "10", 60),
            ]),
            (1, "Tuesday", "Lower Body Strength", "Quads · Hamstrings · Core", 60, 0, [
                ("Barbell Squat", 4, "6", 120),
                ("Romanian Deadlift", 4, "8", 90),
                ("Leg Press", 3, "10", 90),
                ("Plank", 3, "60s", 60),
            ]),
            (2, "Wednesday", "Rest & Recovery Day", "Rest & Mobility", 30, 1, []),
            (3, "Thursday", "Upper Body Hypertrophy", "Chest · Shoulders · Back", 55, 0, [
                ("Incline Dumbbell Press", 3, "10", 90),
                ("Lat Pulldown", 3, "10", 75),
                ("Lateral Raise", 3, "12", 60),
                ("Triceps Pushdown", 3, "12", 60),
            ]),
            (4, "Friday", "Lower Body Hypertrophy", "Glutes · Hamstrings · Calves", 55, 0, [
                ("Leg Press", 4, "12", 90),
                ("Lying Leg Curl", 3, "12", 75),
                ("Calf Raises", 4, "15", 60),
                ("Hanging Leg Raise", 3, "12", 60),
            ]),
            (5, "Saturday", "Rest & Recovery Day", "Stretching & Walking", 30, 1, []),
            (6, "Sunday", "Rest & Recovery Day", "Recovery & Prep", 20, 1, []),
        ]
    },
    "full_body": {
        "name": "Full Body 3-Day Split",
        "days": [
            (0, "Monday", "Full Body A", "Chest · Legs · Back", 60, 0, [
                ("Barbell Squat", 3, "8", 120),
                ("Bench Press", 3, "8", 120),
                ("Bent-Over Row", 3, "8", 90),
                ("Plank", 3, "60s", 60),
            ]),
            (1, "Tuesday", "Rest & Recovery Day", "Rest & Light Walk", 30, 1, []),
            (2, "Wednesday", "Full Body B", "Deadlift · Shoulders · Arms", 60, 0, [
                ("Barbell Deadlift", 3, "6", 150),
                ("Overhead Press", 3, "8", 90),
                ("Lat Pulldown", 3, "10", 75),
                ("Bicep Curl", 3, "10", 60),
            ]),
            (3, "Thursday", "Rest & Recovery Day", "Rest & Mobility", 30, 1, []),
            (4, "Friday", "Full Body C", "Legs · Chest · Back", 60, 0, [
                ("Romanian Deadlift", 3, "10", 90),
                ("Incline Dumbbell Press", 3, "10", 90),
                ("Cable Row", 3, "10", 75),
                ("Triceps Pushdown", 3, "12", 60),
            ]),
            (5, "Saturday", "Rest & Recovery Day", "Active Recovery", 30, 1, []),
            (6, "Sunday", "Rest & Recovery Day", "Rest & Nutrition Prep", 20, 1, []),
        ]
    },
    "custom": {
        "name": "Custom Split",
        "days": [
            (0, "Monday", "Chest & Triceps", "Chest · Triceps", 50, 0, [("Bench Press", 3, "8", 90), ("Triceps Pushdown", 3, "12", 60)]),
            (1, "Tuesday", "Back & Biceps", "Back · Biceps", 50, 0, [("Lat Pulldown", 3, "10", 75), ("Bicep Curl", 3, "12", 60)]),
            (2, "Wednesday", "Legs & Abs", "Legs · Core", 50, 0, [("Barbell Squat", 3, "8", 120), ("Hanging Leg Raise", 3, "12", 60)]),
            (3, "Thursday", "Shoulders", "Shoulders · Traps", 45, 0, [("Overhead Press", 3, "8", 90), ("Lateral Raise", 3, "12", 60)]),
            (4, "Friday", "Upper Body", "Chest · Back", 50, 0, [("Dumbbell Press", 3, "10", 90), ("Cable Row", 3, "10", 75)]),
            (5, "Saturday", "Arms & Core", "Biceps · Triceps · Abs", 45, 0, [("Hammer Curl", 3, "12", 60), ("Plank", 3, "60s", 60)]),
            (6, "Sunday", "Rest & Recovery Day", "Rest", 30, 1, []),
        ]
    }
}


def init_db():
    """Create all SQLite tables and seed demo user."""
    conn = get_db_connection()
    cur = conn.cursor()

    cur.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        theme TEXT DEFAULT 'light',
        unit_preference TEXT DEFAULT 'kg',
        notifications_enabled INTEGER DEFAULT 1,
        preferred_workout_days TEXT DEFAULT 'Mon,Tue,Wed,Fri,Sat',
        active_split_name TEXT DEFAULT 'None'
    );

    CREATE TABLE IF NOT EXISTS habits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Health',
        frequency TEXT DEFAULT 'daily',
        reminder_time TEXT DEFAULT '08:00',
        target_value INTEGER DEFAULT 1,
        target_unit TEXT DEFAULT 'check',
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS habit_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        completion_date TEXT NOT NULL,
        completed INTEGER DEFAULT 1,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(habit_id, completion_date)
    );

    CREATE TABLE IF NOT EXISTS workout_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        day_name TEXT NOT NULL,
        workout_name TEXT NOT NULL,
        muscle_groups TEXT NOT NULL,
        estimated_duration INTEGER DEFAULT 60,
        is_rest_day INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        UNIQUE(user_id, day_of_week)
    );

    CREATE TABLE IF NOT EXISTS workout_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exercise_name TEXT NOT NULL,
        target_sets INTEGER DEFAULT 3,
        target_reps TEXT DEFAULT '10',
        rest_seconds INTEGER DEFAULT 90,
        sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id INTEGER REFERENCES workout_plans(id) ON DELETE SET NULL,
        session_date TEXT NOT NULL,
        workout_name TEXT NOT NULL,
        duration_minutes INTEGER DEFAULT 50,
        notes TEXT DEFAULT '',
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exercise_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exercise_name TEXT NOT NULL,
        set_number INTEGER NOT NULL,
        target_reps TEXT DEFAULT '10',
        weight REAL DEFAULT 0,
        reps_completed INTEGER DEFAULT 10,
        completed INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        related_type TEXT DEFAULT 'none',
        related_id INTEGER DEFAULT NULL,
        reminder_time TEXT NOT NULL,
        reminder_date TEXT DEFAULT '',
        repeat_schedule TEXT DEFAULT 'daily',
        is_enabled INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    ensure_demo_account(conn)
    conn.close()


def apply_split_template(conn, user_id, template_key="ppl"):
    """Assign 7-day workout routine from template to user."""
    if template_key not in WORKOUT_SPLIT_TEMPLATES:
        template_key = "ppl"
    template = WORKOUT_SPLIT_TEMPLATES[template_key]
    cur = conn.cursor()

    cur.execute("DELETE FROM workout_plans WHERE user_id = ?", (user_id,))
    cur.execute("UPDATE user_settings SET active_split_name = ? WHERE user_id = ?", (template["name"], user_id))

    for day_idx, day_name, w_name, muscles, duration, is_rest, ex_list in template["days"]:
        cur.execute("""
            INSERT INTO workout_plans (user_id, day_of_week, day_name, workout_name, muscle_groups, estimated_duration, is_rest_day)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, day_idx, day_name, w_name, muscles, duration, is_rest))
        plan_id = cur.lastrowid

        for idx, (ex_name, sets, reps, rest_sec) in enumerate(ex_list):
            cur.execute("""
                INSERT INTO workout_exercises (plan_id, user_id, exercise_name, target_sets, target_reps, rest_seconds, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (plan_id, user_id, ex_name, sets, reps, rest_sec, idx))


def init_new_user_settings(conn, user_id):
    """Initialize empty user settings for a new user without default habits, workouts, or reminders."""
    cur = conn.cursor()
    cur.execute("""
        INSERT OR IGNORE INTO user_settings (user_id, theme, unit_preference, preferred_workout_days, notifications_enabled, active_split_name)
        VALUES (?, 'light', 'kg', 'Mon,Tue,Wed,Fri,Sat', 1, 'None')
    """, (user_id,))


def setup_user_defaults(conn, user_id, split_key="ppl"):
    """Seed starting settings, default habits, workout split, and default reminders for the demo user."""
    cur = conn.cursor()
    cur.execute("INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)", (user_id,))

    # Create default habits
    for name, cat, freq, rem_time, t_val, t_unit in DEFAULT_HABITS:
        cur.execute("""
            INSERT INTO habits (user_id, name, category, frequency, reminder_time, target_value, target_unit, current_streak, longest_streak)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
        """, (user_id, name, cat, freq, rem_time, t_val, t_unit))

    # Apply workout split
    apply_split_template(conn, user_id, split_key)

    # Seed reminders
    default_rems = [
        ("Morning workout reminder", "workout", None, "07:00", "daily"),
        ("Drink water reminder", "habit", None, "10:30", "daily"),
        ("Afternoon hydration check", "habit", None, "14:30", "daily"),
        ("Evening reading wind-down", "habit", None, "20:30", "daily"),
    ]
    for title, rel_type, rel_id, rem_time, rep in default_rems:
        cur.execute("""
            INSERT INTO reminders (user_id, title, related_type, related_id, reminder_time, repeat_schedule, is_enabled)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        """, (user_id, title, rel_type, rel_id, rem_time, rep))


def ensure_demo_account(conn):
    """Seed clean demo user (demo@habitfit.com / DemoPass123!) with 14 days of realistic records."""
    cur = conn.cursor()
    existing = cur.execute("SELECT id FROM users WHERE email = ?", ("demo@habitfit.com",)).fetchone()
    if existing:
        return existing["id"]

    pw_hash = generate_password_hash("DemoPass123!")
    cur.execute("""
        INSERT INTO users (name, email, password_hash)
        VALUES ('Alex Rivera', 'demo@habitfit.com', ?)
    """, (pw_hash,))
    user_id = cur.lastrowid

    setup_user_defaults(conn, user_id, "ppl")

    today = datetime.now().date()
    habits = cur.execute("SELECT id, name FROM habits WHERE user_id = ? ORDER BY id", (user_id,)).fetchall()

    # 14 days of habit completion history
    for days_ago in range(13, -1, -1):
        d_str = (today - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        for idx, h in enumerate(habits):
            if days_ago == 0:
                # Today: 3 of 4 completed so user can immediately click the remaining one!
                done = idx in (0, 1, 2)
            else:
                done = (days_ago + idx) % 5 != 0
            if done:
                cur.execute("""
                    INSERT OR IGNORE INTO habit_completions (habit_id, user_id, completion_date, completed)
                    VALUES (?, ?, ?, 1)
                """, (h["id"], user_id, d_str))

    # Calculate realistic streaks
    for idx, h in enumerate(habits):
        streak = 5 if idx in (0, 1) else (3 if idx == 2 else 2)
        cur.execute("UPDATE habits SET current_streak = ?, longest_streak = ? WHERE id = ?", (streak, streak + 3, h["id"]))

    # Seed 6 recent workout sessions with exercise sets
    workout_history = [
        (12, "Push Day", 55, [
            ("Bench Press", [("8", 60.0, 8), ("8", 60.0, 8), ("8", 60.0, 8)]),
            ("Incline Dumbbell Press", [("10", 22.0, 10), ("10", 22.0, 10), ("10", 22.0, 10)]),
            ("Shoulder Press", [("10", 18.0, 10), ("10", 18.0, 10), ("10", 18.0, 9)]),
            ("Triceps Pushdown", [("12", 20.0, 12), ("12", 20.0, 12), ("12", 20.0, 12)]),
        ]),
        (10, "Pull Day", 58, [
            ("Barbell Deadlift", [("6", 100.0, 6), ("6", 100.0, 6), ("6", 100.0, 6)]),
            ("Lat Pulldown", [("10", 50.0, 10), ("10", 50.0, 10), ("10", 50.0, 10)]),
            ("Barbell Row", [("8", 60.0, 8), ("8", 60.0, 8), ("8", 60.0, 8)]),
            ("Bicep Curl", [("12", 14.0, 12), ("12", 14.0, 12), ("12", 14.0, 11)]),
        ]),
        (8, "Legs & Core", 60, [
            ("Barbell Squat", [("8", 80.0, 8), ("8", 80.0, 8), ("8", 80.0, 8), ("8", 80.0, 8)]),
            ("Romanian Deadlift", [("10", 70.0, 10), ("10", 70.0, 10), ("10", 70.0, 10)]),
            ("Leg Press", [("12", 140.0, 12), ("12", 140.0, 12), ("12", 140.0, 12)]),
        ]),
        (5, "Push Day", 52, [
            ("Bench Press", [("8", 62.5, 8), ("8", 62.5, 8), ("8", 62.5, 8)]),
            ("Incline Dumbbell Press", [("10", 24.0, 10), ("10", 24.0, 10), ("10", 24.0, 9)]),
            ("Shoulder Press", [("10", 20.0, 10), ("10", 20.0, 10), ("10", 20.0, 10)]),
        ]),
        (3, "Pull Day", 56, [
            ("Barbell Deadlift", [("6", 105.0, 6), ("6", 105.0, 6), ("6", 105.0, 6)]),
            ("Lat Pulldown", [("10", 55.0, 10), ("10", 55.0, 10), ("10", 55.0, 10)]),
            ("Barbell Row", [("8", 62.5, 8), ("8", 62.5, 8), ("8", 62.5, 8)]),
        ]),
        (1, "Push Day", 54, [
            ("Bench Press", [("8", 65.0, 8), ("8", 65.0, 8), ("8", 65.0, 7)]),
            ("Incline Dumbbell Press", [("10", 24.0, 10), ("10", 24.0, 10), ("10", 24.0, 10)]),
            ("Shoulder Press", [("10", 20.0, 10), ("10", 20.0, 10), ("10", 20.0, 10)]),
            ("Triceps Pushdown", [("12", 22.5, 12), ("12", 22.5, 12), ("12", 22.5, 12)]),
        ]),
    ]

    for days_ago, w_name, dur, ex_sets in workout_history:
        s_date = (today - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        cur.execute("""
            INSERT INTO workout_sessions (user_id, session_date, workout_name, duration_minutes, notes)
            VALUES (?, ?, ?, ?, 'Completed with strict form.')
        """, (user_id, s_date, w_name, dur))
        sess_id = cur.lastrowid

        for ex_name, s_tuples in ex_sets:
            for s_num, (t_reps, w_val, r_comp) in enumerate(s_tuples, 1):
                cur.execute("""
                    INSERT INTO exercise_sets (session_id, user_id, exercise_name, set_number, target_reps, weight, reps_completed, completed)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                """, (sess_id, user_id, ex_name, s_num, t_reps, w_val, r_comp))

    conn.commit()
    return user_id
