import os
from datetime import datetime, timedelta
from functools import wraps

from dotenv import load_dotenv
from flask import (
    Flask,
    flash,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

from database import (
    WORKOUT_SPLIT_TEMPLATES,
    apply_split_template,
    get_db_connection,
    init_db,
    init_new_user_settings,
    setup_user_defaults,
)

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "habitfit-master-secret-key-2026")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# Initialize database schema and demo account
init_db()


def get_db():
    if "db" not in g:
        g.db = get_db_connection()
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "Authentication required", "authenticated": False}), 401
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function


def get_current_user():
    if "user_id" not in session:
        return None
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    if not user:
        session.clear()
        return None
    settings = db.execute("SELECT * FROM user_settings WHERE user_id = ?", (user["id"],)).fetchone()
    if not settings:
        db.execute("INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)", (user["id"],))
        db.commit()
        settings = db.execute("SELECT * FROM user_settings WHERE user_id = ?", (user["id"],)).fetchone()

    user_dict = dict(user)
    user_dict["settings"] = dict(settings) if settings else {}
    return user_dict


@app.context_processor
def inject_globals():
    user = get_current_user()
    today_dt = datetime.now()
    hour = today_dt.hour
    if hour < 12:
        greeting = "Good morning"
    elif hour < 17:
        greeting = "Good afternoon"
    else:
        greeting = "Good evening"

    unread_reminders = 0
    if user:
        db = get_db()
        unread_reminders = db.execute(
            "SELECT COUNT(*) FROM reminders WHERE user_id = ? AND is_enabled = 1",
            (user["id"],)
        ).fetchone()[0]

    return {
        "current_user": user,
        "greeting": greeting,
        "today_str": today_dt.strftime("%Y-%m-%d"),
        "today_formatted": today_dt.strftime("%A, %B %d, %Y"),
        "day_of_week_idx": today_dt.weekday(),  # 0=Monday .. 6=Sunday
        "unread_reminders": unread_reminders,
    }


def update_habit_streak(db, habit_id, user_id):
    """Calculate and persist current consecutive streak and longest streak."""
    rows = db.execute("""
        SELECT completion_date FROM habit_completions
        WHERE habit_id = ? AND user_id = ? AND completed = 1
        ORDER BY completion_date DESC
    """, (habit_id, user_id)).fetchall()

    dates = sorted({r["completion_date"] for r in rows}, reverse=True)
    if not dates:
        db.execute("UPDATE habits SET current_streak = 0 WHERE id = ?", (habit_id,))
        return 0, 0

    today = datetime.now().date()
    yesterday = today - timedelta(days=1)
    date_objs = [datetime.strptime(d, "%Y-%m-%d").date() for d in dates]

    current_streak = 0
    if date_objs[0] >= yesterday:
        expected = date_objs[0]
        for d_obj in date_objs:
            if d_obj == expected:
                current_streak += 1
                expected = expected - timedelta(days=1)
            else:
                break

    longest_streak = 1
    running = 1
    asc_dates = list(reversed(date_objs))
    for i in range(1, len(asc_dates)):
        if (asc_dates[i] - asc_dates[i - 1]).days == 1:
            running += 1
            longest_streak = max(longest_streak, running)
        else:
            running = 1

    habit_row = db.execute("SELECT longest_streak FROM habits WHERE id = ?", (habit_id,)).fetchone()
    prev_longest = habit_row["longest_streak"] if habit_row else 0
    final_longest = max(prev_longest, longest_streak, current_streak)

    db.execute(
        "UPDATE habits SET current_streak = ?, longest_streak = ? WHERE id = ?",
        (current_streak, final_longest, habit_id)
    )
    return current_streak, final_longest


# ==============================================================================
# AUTHENTICATION ROUTES
# ==============================================================================

@app.route("/login", methods=["GET", "POST"])
def login():
    if "user_id" in session:
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""

        if not email or not password:
            flash("Please enter both email and password.", "error")
            return render_template("login.html")

        db = get_db()
        user = db.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email,)).fetchone()
        if user and check_password_hash(user["password_hash"], password):
            session["user_id"] = user["id"]
            flash(f"Welcome back, {user['name']}!", "success")
            return redirect(url_for("dashboard"))

        flash("Invalid email or password. Please try again.", "error")
    return render_template("login.html")


@app.route("/demo-login", methods=["GET", "POST"])
def demo_login():
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", ("demo@habitfit.com",)).fetchone()
    if user:
        session["user_id"] = user["id"]
        flash("Logged into Demo Account (Alex Rivera).", "success")
        return redirect(url_for("dashboard"))
    flash("Demo user not found.", "error")
    return redirect(url_for("login"))


@app.route("/register", methods=["GET", "POST"])
def register():
    if "user_id" in session:
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        name = (request.form.get("name") or "").strip()
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""
        confirm_password = request.form.get("confirm_password") or ""
        split_choice = (request.form.get("workout_split") or "ppl").strip()

        if not name or not email or not password:
            flash("Name, email, and password are required.", "error")
            return render_template("register.html")

        if len(password) < 6:
            flash("Password must be at least 6 characters long.", "error")
            return render_template("register.html")

        if password != confirm_password:
            flash("Passwords do not match.", "error")
            return render_template("register.html")

        db = get_db()
        existing = db.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,)).fetchone()
        if existing:
            flash("An account with that email already exists. Please log in.", "error")
            return render_template("register.html")

        pw_hash = generate_password_hash(password)
        cur = db.cursor()
        cur.execute("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", (name, email, pw_hash))
        new_user_id = cur.lastrowid

        # Initialize clean empty settings for new user (zero habits, workouts, reminders)
        init_new_user_settings(db, new_user_id)
        db.commit()

        session["user_id"] = new_user_id
        flash(f"Welcome to HabitFit, {name}! Your dashboard is ready.", "success")
        return redirect(url_for("dashboard"))

    return render_template("register.html")


@app.route("/logout")
def logout():
    session.clear()
    flash("You have been signed out safely.", "info")
    return redirect(url_for("login"))


# ==============================================================================
# PAGE ROUTES
# ==============================================================================

@app.route("/")
@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html", active_page="dashboard")


@app.route("/habits")
@login_required
def habits_page():
    return render_template("habits.html", active_page="habits")


@app.route("/workouts")
@login_required
def workouts_page():
    return render_template("workouts.html", active_page="workouts")


@app.route("/workouts/active")
@app.route("/workouts/active/<int:day_idx>")
@login_required
def active_workout_page(day_idx=None):
    if day_idx is None:
        day_idx = datetime.now().weekday()
    return render_template("active_workout.html", active_page="workouts", active_day_idx=day_idx)


@app.route("/progress")
@login_required
def progress_page():
    return render_template("progress.html", active_page="progress")


@app.route("/reminders")
@login_required
def reminders_page():
    return render_template("reminders.html", active_page="reminders")


@app.route("/settings")
@login_required
def settings_page():
    return render_template("settings.html", active_page="settings")


# ==============================================================================
# REST API: DASHBOARD
# ==============================================================================

@app.route("/api/dashboard")
@login_required
def api_dashboard():
    db = get_db()
    user_id = session["user_id"]
    today_dt = datetime.now()
    today_str = today_dt.strftime("%Y-%m-%d")
    dow = today_dt.weekday()

    # 1. Today's Habits
    habits_rows = db.execute("""
        SELECT h.*,
               COALESCE(hc.completed, 0) AS completed_today
        FROM habits h
        LEFT JOIN habit_completions hc ON hc.habit_id = h.id AND hc.completion_date = ?
        WHERE h.user_id = ? AND h.is_active = 1
        ORDER BY h.reminder_time ASC, h.id ASC
    """, (today_str, user_id)).fetchall()

    habits = [dict(r) for r in habits_rows]
    total_habits = len(habits)
    completed_habits = sum(1 for h in habits if h["completed_today"])
    remaining_habits = max(0, total_habits - completed_habits)
    habit_pct = round((completed_habits / total_habits) * 100) if total_habits > 0 else 0

    # Current streak (highest active streak across user habits)
    current_streak = max((h["current_streak"] for h in habits), default=0)

    # 2. Today's Workout
    today_plan_row = db.execute("""
        SELECT * FROM workout_plans WHERE user_id = ? AND day_of_week = ?
    """, (user_id, dow)).fetchone()

    today_workout = None
    if today_plan_row:
        tw_dict = dict(today_plan_row)
        ex_rows = db.execute("""
            SELECT * FROM workout_exercises
            WHERE plan_id = ? AND user_id = ?
            ORDER BY sort_order ASC, id ASC
        """, (tw_dict["id"], user_id)).fetchall()
        tw_dict["exercises"] = [dict(x) for x in ex_rows]
        tw_dict["exercise_count"] = len(tw_dict["exercises"])

        # Check if already logged today
        logged = db.execute("""
            SELECT id FROM workout_sessions WHERE user_id = ? AND session_date = ? LIMIT 1
        """, (user_id, today_str)).fetchone()
        tw_dict["is_completed_today"] = bool(logged)
        today_workout = tw_dict

    # 3. Weekly Completion Rate (Monday to Sunday of current week)
    monday_dt = today_dt.date() - timedelta(days=dow)
    week_days = [(monday_dt + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]

    weekly_habits_scheduled = total_habits * (dow + 1)
    weekly_habits_completed = db.execute("""
        SELECT COUNT(*) FROM habit_completions
        WHERE user_id = ? AND completed = 1 AND completion_date BETWEEN ? AND ?
    """, (user_id, week_days[0], today_str)).fetchone()[0]

    weekly_pct = round((weekly_habits_completed / weekly_habits_scheduled) * 100) if weekly_habits_scheduled > 0 else 0

    # Previous week comparison
    prev_monday_str = (monday_dt - timedelta(days=7)).strftime("%Y-%m-%d")
    prev_sunday_str = (monday_dt - timedelta(days=1)).strftime("%Y-%m-%d")
    prev_week_completed = db.execute("""
        SELECT COUNT(*) FROM habit_completions
        WHERE user_id = ? AND completed = 1 AND completion_date BETWEEN ? AND ?
    """, (user_id, prev_monday_str, prev_sunday_str)).fetchone()[0]
    prev_week_scheduled = total_habits * 7
    prev_weekly_pct = round((prev_week_completed / prev_week_scheduled) * 100) if prev_week_scheduled > 0 else 0
    weekly_diff = weekly_pct - prev_weekly_pct if prev_week_scheduled > 0 else None

    # 4. Weekly Activity Bar Chart (Mon through Sun)
    day_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    weekly_chart_values = []
    total_week_completed = 0
    for idx, d_str in enumerate(week_days):
        cnt = db.execute("""
            SELECT COUNT(*) FROM habit_completions
            WHERE user_id = ? AND completed = 1 AND completion_date = ?
        """, (user_id, d_str)).fetchone()[0]
        weekly_chart_values.append(cnt)
        total_week_completed += cnt

    return jsonify({
        "summary": {
            "today_habits": {
                "completed": completed_habits,
                "total": total_habits,
                "remaining": remaining_habits,
                "percentage": habit_pct,
            },
            "today_workout": today_workout,
            "current_streak": {
                "days": current_streak,
            },
            "weekly_completion": {
                "percentage": weekly_pct,
                "previous_percentage": prev_weekly_pct,
                "diff": weekly_diff,
            }
        },
        "habits": habits,
        "weekly_chart": {
            "labels": day_labels,
            "values": weekly_chart_values,
            "total_completed": total_week_completed,
            "week_range": f"{monday_dt.strftime('%b %d')} - {(monday_dt + timedelta(days=6)).strftime('%b %d')}",
        }
    })


# ==============================================================================
# REST API: DAILY HABITS
# ==============================================================================

@app.route("/api/habits", methods=["GET", "POST"])
@login_required
def api_habits():
    db = get_db()
    user_id = session["user_id"]

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        category = (data.get("category") or "Health").strip()
        frequency = (data.get("frequency") or "daily").strip()
        reminder_time = (data.get("reminder_time") or "08:00").strip()
        target_value = int(data.get("target_value") or 1)
        target_unit = (data.get("target_unit") or "check").strip()

        if not name:
            return jsonify({"error": "Habit name is required."}), 400

        cur = db.cursor()
        cur.execute("""
            INSERT INTO habits (user_id, name, category, frequency, reminder_time, target_value, target_unit, current_streak, longest_streak)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
        """, (user_id, name, category, frequency, reminder_time, target_value, target_unit))
        habit_id = cur.lastrowid
        db.commit()
        return jsonify({"message": f"Habit '{name}' created.", "habit_id": habit_id}), 201

    target_date = request.args.get("date") or datetime.now().strftime("%Y-%m-%d")
    status_filter = request.args.get("status") or "all"

    rows = db.execute("""
        SELECT h.*,
               COALESCE(hc.completed, 0) AS completed_today
        FROM habits h
        LEFT JOIN habit_completions hc ON hc.habit_id = h.id AND hc.completion_date = ?
        WHERE h.user_id = ? AND h.is_active = 1
        ORDER BY h.reminder_time ASC, h.id ASC
    """, (target_date, user_id)).fetchall()

    habits = [dict(r) for r in rows]
    total_count = len(habits)
    completed_count = sum(1 for h in habits if h["completed_today"])
    completion_pct = round((completed_count / total_count) * 100) if total_count > 0 else 0

    if status_filter == "completed":
        habits = [h for h in habits if h["completed_today"]]
    elif status_filter == "pending":
        habits = [h for h in habits if not h["completed_today"]]

    return jsonify({
        "date": target_date,
        "habits": habits,
        "summary": {
            "completed": completed_count,
            "total": total_count,
            "remaining": max(0, total_count - completed_count),
            "percentage": completion_pct,
        }
    })


@app.route("/api/habits/<int:habit_id>", methods=["PUT", "DELETE"])
@login_required
def api_habit_modify(habit_id):
    db = get_db()
    user_id = session["user_id"]

    habit = db.execute("SELECT * FROM habits WHERE id = ? AND user_id = ?", (habit_id, user_id)).fetchone()
    if not habit:
        return jsonify({"error": "Habit not found."}), 404

    if request.method == "DELETE":
        db.execute("DELETE FROM habits WHERE id = ? AND user_id = ?", (habit_id, user_id))
        db.commit()
        return jsonify({"message": "Habit deleted successfully."})

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or habit["name"]).strip()
    category = (data.get("category") or habit["category"]).strip()
    frequency = (data.get("frequency") or habit["frequency"]).strip()
    reminder_time = (data.get("reminder_time") or habit["reminder_time"]).strip()
    target_value = int(data.get("target_value") or habit["target_value"])
    target_unit = (data.get("target_unit") or habit["target_unit"]).strip()

    db.execute("""
        UPDATE habits
        SET name = ?, category = ?, frequency = ?, reminder_time = ?, target_value = ?, target_unit = ?
        WHERE id = ? AND user_id = ?
    """, (name, category, frequency, reminder_time, target_value, target_unit, habit_id, user_id))
    db.commit()
    return jsonify({"message": "Habit updated successfully."})


@app.route("/api/habits/<int:habit_id>/toggle", methods=["POST"])
@login_required
def api_habit_toggle(habit_id):
    db = get_db()
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}
    target_date = data.get("date") or datetime.now().strftime("%Y-%m-%d")

    habit = db.execute("SELECT * FROM habits WHERE id = ? AND user_id = ?", (habit_id, user_id)).fetchone()
    if not habit:
        return jsonify({"error": "Habit not found."}), 404

    existing = db.execute("""
        SELECT * FROM habit_completions WHERE habit_id = ? AND user_id = ? AND completion_date = ?
    """, (habit_id, user_id, target_date)).fetchone()

    if existing and existing["completed"]:
        db.execute("DELETE FROM habit_completions WHERE id = ?", (existing["id"],))
        new_state = 0
    else:
        db.execute("""
            INSERT OR REPLACE INTO habit_completions (habit_id, user_id, completion_date, completed)
            VALUES (?, ?, ?, 1)
        """, (habit_id, user_id, target_date))
        new_state = 1

    current_streak, longest_streak = update_habit_streak(db, habit_id, user_id)
    db.commit()

    return jsonify({
        "habit_id": habit_id,
        "completed": new_state,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "message": "Habit marked completed!" if new_state else "Habit marked pending."
    })


# ==============================================================================
# REST API: WORKOUT PLANNER & ACTIVE WORKOUT SESSIONS
# ==============================================================================

@app.route("/api/workouts/plans", methods=["GET"])
@login_required
def api_get_workout_plans():
    db = get_db()
    user_id = session["user_id"]
    settings = db.execute("SELECT active_split_name FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()

    plans_rows = db.execute("""
        SELECT * FROM workout_plans WHERE user_id = ? ORDER BY day_of_week ASC
    """, (user_id,)).fetchall()

    plans = []
    for p in plans_rows:
        pd = dict(p)
        exs = db.execute("""
            SELECT * FROM workout_exercises
            WHERE plan_id = ? AND user_id = ?
            ORDER BY sort_order ASC, id ASC
        """, (p["id"], user_id)).fetchall()
        pd["exercises"] = [dict(x) for x in exs]
        pd["exercise_count"] = len(pd["exercises"])
        plans.append(pd)

    templates_list = [{"key": k, "name": v["name"]} for k, v in WORKOUT_SPLIT_TEMPLATES.items()]

    active_name = (settings["active_split_name"] if settings and settings["active_split_name"] and settings["active_split_name"] != "None" else "None")

    return jsonify({
        "active_split_name": active_name,
        "plans": plans,
        "templates": templates_list,
    })


@app.route("/api/workouts/apply-template", methods=["POST"])
@login_required
def api_apply_workout_template():
    db = get_db()
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}
    template_key = data.get("template_key", "ppl")

    if template_key not in WORKOUT_SPLIT_TEMPLATES:
        return jsonify({"error": "Invalid template key."}), 400

    apply_split_template(db, user_id, template_key)
    db.commit()
    return jsonify({"message": f"Applied {WORKOUT_SPLIT_TEMPLATES[template_key]['name']} routine."})


@app.route("/api/workouts/plans/<int:day_idx>", methods=["POST"])
@login_required
def api_update_day_plan(day_idx):
    db = get_db()
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}

    plan = db.execute(
        "SELECT id FROM workout_plans WHERE user_id = ? AND day_of_week = ?",
        (user_id, day_idx)
    ).fetchone()
    if not plan:
        return jsonify({"error": "Plan day not found."}), 404

    workout_name = (data.get("workout_name") or "Training Day").strip()
    muscle_groups = (data.get("muscle_groups") or "").strip()
    estimated_duration = int(data.get("estimated_duration") or 50)
    is_rest_day = 1 if data.get("is_rest_day") else 0
    exercises_data = data.get("exercises") or []

    cur = db.cursor()
    cur.execute("""
        UPDATE workout_plans
        SET workout_name = ?, muscle_groups = ?, estimated_duration = ?, is_rest_day = ?
        WHERE id = ? AND user_id = ?
    """, (workout_name, muscle_groups, estimated_duration, is_rest_day, plan["id"], user_id))

    # Replace exercises for this day
    cur.execute("DELETE FROM workout_exercises WHERE plan_id = ? AND user_id = ?", (plan["id"], user_id))
    for idx, ex in enumerate(exercises_data):
        ex_name = (ex.get("exercise_name") or "Exercise").strip()
        t_sets = int(ex.get("target_sets") or 3)
        t_reps = str(ex.get("target_reps") or "10").strip()
        rest_sec = int(ex.get("rest_seconds") or 90)
        cur.execute("""
            INSERT INTO workout_exercises (plan_id, user_id, exercise_name, target_sets, target_reps, rest_seconds, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (plan["id"], user_id, ex_name, t_sets, t_reps, rest_sec, idx))

    db.commit()
    return jsonify({"message": f"{workout_name} schedule saved."})


@app.route("/api/workouts/active-plan")
@login_required
def api_active_workout_plan():
    db = get_db()
    user_id = session["user_id"]
    day_arg = request.args.get("day")
    dow = int(day_arg) if day_arg is not None else datetime.now().weekday()

    plan_row = db.execute("""
        SELECT * FROM workout_plans WHERE user_id = ? AND day_of_week = ?
    """, (user_id, dow)).fetchone()

    if not plan_row:
        return jsonify({"error": "No workout scheduled for this day."}), 404

    p_dict = dict(plan_row)
    exs = db.execute("""
        SELECT * FROM workout_exercises
        WHERE plan_id = ? AND user_id = ?
        ORDER BY sort_order ASC, id ASC
    """, (p_dict["id"], user_id)).fetchall()
    p_dict["exercises"] = [dict(x) for x in exs]

    # Look up user's last recorded weights for each exercise
    for ex in p_dict["exercises"]:
        last_set = db.execute("""
            SELECT weight, reps_completed FROM exercise_sets
            WHERE user_id = ? AND LOWER(exercise_name) = LOWER(?)
            ORDER BY id DESC LIMIT 1
        """, (user_id, ex["exercise_name"])).fetchone()
        ex["last_weight"] = last_set["weight"] if last_set else 20.0
        ex["last_reps"] = last_set["reps_completed"] if last_set else int(str(ex["target_reps"]).split("-")[0] if "-" in str(ex["target_reps"]) else ex["target_reps"])

    settings = db.execute("SELECT unit_preference FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    p_dict["unit_preference"] = settings["unit_preference"] if settings else "kg"

    return jsonify({"plan": p_dict})


@app.route("/api/workouts/finish", methods=["POST"])
@login_required
def api_finish_workout_session():
    db = get_db()
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}

    plan_id = data.get("plan_id")
    workout_name = (data.get("workout_name") or "Workout Session").strip()
    session_date = data.get("session_date") or datetime.now().strftime("%Y-%m-%d")
    duration_minutes = int(data.get("duration_minutes") or 45)
    notes = (data.get("notes") or "").strip()
    exercises_data = data.get("exercises") or []

    cur = db.cursor()
    cur.execute("""
        INSERT INTO workout_sessions (user_id, plan_id, session_date, workout_name, duration_minutes, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, plan_id, session_date, workout_name, duration_minutes, notes))
    sess_id = cur.lastrowid

    total_sets_saved = 0
    for ex in exercises_data:
        ex_name = (ex.get("exercise_name") or "").strip()
        sets_list = ex.get("sets") or []
        for s_idx, s in enumerate(sets_list, 1):
            t_reps = str(s.get("target_reps") or "10").strip()
            w_val = float(s.get("weight") or 0)
            r_comp = int(s.get("reps_completed") or 10)
            comp = 1 if s.get("completed", True) else 0

            cur.execute("""
                INSERT INTO exercise_sets (session_id, user_id, exercise_name, set_number, target_reps, weight, reps_completed, completed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (sess_id, user_id, ex_name, s_idx, t_reps, w_val, r_comp, comp))
            total_sets_saved += 1

    # Also automatically complete the "Morning workout" or workout habit for today if it exists
    workout_habit = db.execute("""
        SELECT id FROM habits
        WHERE user_id = ? AND (LOWER(category) = 'fitness' OR LOWER(name) LIKE '%workout%')
        LIMIT 1
    """, (user_id,)).fetchone()
    if workout_habit:
        cur.execute("""
            INSERT OR REPLACE INTO habit_completions (habit_id, user_id, completion_date, completed)
            VALUES (?, ?, ?, 1)
        """, (workout_habit["id"], user_id, session_date))
        update_habit_streak(db, workout_habit["id"], user_id)

    db.commit()
    return jsonify({
        "message": f"Awesome job! Workout '{workout_name}' saved successfully.",
        "session_id": sess_id,
        "total_sets": total_sets_saved,
    }), 201


# ==============================================================================
# REST API: PROGRESS
# ==============================================================================

@app.route("/api/progress")
@login_required
def api_progress():
    db = get_db()
    user_id = session["user_id"]
    days_range = int(request.args.get("range") or 30)
    if days_range not in (7, 30, 90):
        days_range = 30

    today = datetime.now().date()
    start_date = today - timedelta(days=days_range - 1)
    start_str = start_date.strftime("%Y-%m-%d")
    today_str = today.strftime("%Y-%m-%d")

    # 1. Summary Cards
    sessions_row = db.execute("""
        SELECT COUNT(*) AS total_sessions,
               COALESCE(SUM(duration_minutes), 0) AS total_duration
        FROM workout_sessions
        WHERE user_id = ? AND session_date BETWEEN ? AND ?
    """, (user_id, start_str, today_str)).fetchone()
    total_sessions = sessions_row["total_sessions"]
    total_duration = sessions_row["total_duration"]

    habits_count = db.execute(
        "SELECT COUNT(*) FROM habits WHERE user_id = ? AND is_active = 1", (user_id,)
    ).fetchone()[0]

    scheduled_habits_period = habits_count * days_range
    completed_habits_period = db.execute("""
        SELECT COUNT(*) FROM habit_completions
        WHERE user_id = ? AND completed = 1 AND completion_date BETWEEN ? AND ?
    """, (user_id, start_str, today_str)).fetchone()[0]

    habit_rate = round((completed_habits_period / scheduled_habits_period) * 100) if scheduled_habits_period > 0 else 0

    current_streak = db.execute(
        "SELECT COALESCE(MAX(current_streak), 0) FROM habits WHERE user_id = ? AND is_active = 1",
        (user_id,)
    ).fetchone()[0]

    # 2. Habit Consistency Daily Line Chart Points
    consistency_labels = []
    consistency_values = []
    curr = start_date
    step = 1 if days_range <= 30 else 3
    while curr <= today:
        d_str = curr.strftime("%Y-%m-%d")
        c_cnt = db.execute("""
            SELECT COUNT(*) FROM habit_completions
            WHERE user_id = ? AND completed = 1 AND completion_date = ?
        """, (user_id, d_str)).fetchone()[0]
        pct = round((c_cnt / habits_count) * 100) if habits_count > 0 else 0
        consistency_labels.append(curr.strftime("%b %d"))
        consistency_values.append(pct)
        curr += timedelta(days=step)

    # 3. Exercise Performance Progression Data
    exercise_names_rows = db.execute("""
        SELECT DISTINCT exercise_name FROM exercise_sets
        WHERE user_id = ? AND weight > 0
        ORDER BY exercise_name ASC
    """, (user_id,)).fetchall()
    available_exercises = [r["exercise_name"] for r in exercise_names_rows]

    exercise_progression = {}
    for ex_name in available_exercises:
        pts = db.execute("""
            SELECT ws.session_date, MAX(es.weight) AS max_weight, es.reps_completed
            FROM exercise_sets es
            JOIN workout_sessions ws ON ws.id = es.session_id
            WHERE es.user_id = ? AND LOWER(es.exercise_name) = LOWER(?)
            GROUP BY ws.session_date
            ORDER BY ws.session_date ASC
        """, (user_id, ex_name)).fetchall()
        exercise_progression[ex_name] = [
            {"date": r["session_date"][5:], "weight": r["max_weight"], "reps": r["reps_completed"]}
            for r in pts
        ]

    # 4. Recent Workout History Table
    recent_sessions = db.execute("""
        SELECT ws.*,
               COUNT(DISTINCT es.exercise_name) AS exercise_count
        FROM workout_sessions ws
        LEFT JOIN exercise_sets es ON es.session_id = ws.id
        WHERE ws.user_id = ?
        GROUP BY ws.id
        ORDER BY ws.session_date DESC, ws.id DESC
        LIMIT 15
    """, (user_id,)).fetchall()

    return jsonify({
        "range_days": days_range,
        "summary": {
            "sessions_completed": total_sessions,
            "habit_completion_rate": habit_rate,
            "total_duration_minutes": total_duration,
            "current_streak": current_streak,
        },
        "habit_chart": {
            "labels": consistency_labels,
            "values": consistency_values,
        },
        "available_exercises": available_exercises,
        "exercise_progression": exercise_progression,
        "history": [dict(r) for r in recent_sessions],
    })


# ==============================================================================
# REST API: REMINDERS
# ==============================================================================

@app.route("/api/reminders", methods=["GET", "POST"])
@login_required
def api_reminders():
    db = get_db()
    user_id = session["user_id"]

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        title = (data.get("title") or "").strip()
        related_type = (data.get("related_type") or "none").strip()
        related_id = data.get("related_id") or None
        reminder_time = (data.get("reminder_time") or "08:00").strip()
        reminder_date = (data.get("reminder_date") or "").strip()
        repeat_schedule = (data.get("repeat_schedule") or "daily").strip()

        if not title:
            return jsonify({"error": "Reminder title is required."}), 400

        cur = db.cursor()
        cur.execute("""
            INSERT INTO reminders (user_id, title, related_type, related_id, reminder_time, reminder_date, repeat_schedule, is_enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        """, (user_id, title, related_type, related_id, reminder_time, reminder_date, repeat_schedule))
        db.commit()
        return jsonify({"message": f"Reminder '{title}' created.", "id": cur.lastrowid}), 201

    rows = db.execute("""
        SELECT * FROM reminders WHERE user_id = ? ORDER BY reminder_time ASC, id ASC
    """, (user_id,)).fetchall()

    items = [dict(r) for r in rows]
    upcoming = [r for r in items if r["is_enabled"]]
    completed_or_past = [r for r in items if not r["is_enabled"]]

    return jsonify({
        "upcoming": upcoming,
        "completed_or_past": completed_or_past,
        "all_reminders": items,
    })


@app.route("/api/reminders/<int:rem_id>", methods=["PUT", "DELETE"])
@login_required
def api_reminder_modify(rem_id):
    db = get_db()
    user_id = session["user_id"]

    rem = db.execute("SELECT * FROM reminders WHERE id = ? AND user_id = ?", (rem_id, user_id)).fetchone()
    if not rem:
        return jsonify({"error": "Reminder not found."}), 404

    if request.method == "DELETE":
        db.execute("DELETE FROM reminders WHERE id = ? AND user_id = ?", (rem_id, user_id))
        db.commit()
        return jsonify({"message": "Reminder deleted."})

    data = request.get_json(silent=True) or {}
    title = (data.get("title") or rem["title"]).strip()
    related_type = (data.get("related_type") or rem["related_type"]).strip()
    reminder_time = (data.get("reminder_time") or rem["reminder_time"]).strip()
    repeat_schedule = (data.get("repeat_schedule") or rem["repeat_schedule"]).strip()
    is_enabled = 1 if data.get("is_enabled", rem["is_enabled"]) else 0

    db.execute("""
        UPDATE reminders
        SET title = ?, related_type = ?, reminder_time = ?, repeat_schedule = ?, is_enabled = ?
        WHERE id = ? AND user_id = ?
    """, (title, related_type, reminder_time, repeat_schedule, is_enabled, rem_id, user_id))
    db.commit()
    return jsonify({"message": "Reminder updated."})


# ==============================================================================
# REST API: SETTINGS
# ==============================================================================

@app.route("/api/settings/profile", methods=["PUT"])
@login_required
def api_settings_profile():
    db = get_db()
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()

    if not name:
        return jsonify({"error": "Name cannot be empty."}), 400

    db.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))
    db.commit()
    return jsonify({"message": "Profile name updated."})


@app.route("/api/settings/preferences", methods=["PUT"])
@login_required
def api_settings_preferences():
    db = get_db()
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}

    theme = (data.get("theme") or "light").strip()
    unit_pref = (data.get("unit_preference") or "kg").strip()
    notifs = 1 if data.get("notifications_enabled", 1) else 0
    workout_days = (data.get("preferred_workout_days") or "Mon,Tue,Wed,Fri,Sat").strip()

    db.execute("""
        UPDATE user_settings
        SET theme = ?, unit_preference = ?, notifications_enabled = ?, preferred_workout_days = ?
        WHERE user_id = ?
    """, (theme, unit_pref, notifs, workout_days, user_id))
    db.commit()
    return jsonify({"message": "Preferences saved."})


@app.route("/api/settings/password", methods=["PUT"])
@login_required
def api_settings_password():
    db = get_db()
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}
    current_pw = data.get("current_password") or ""
    new_pw = data.get("new_password") or ""

    user = db.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
    if not check_password_hash(user["password_hash"], current_pw):
        return jsonify({"error": "Current password is incorrect."}), 400

    if len(new_pw) < 6:
        return jsonify({"error": "New password must be at least 6 characters."}), 400

    new_hash = generate_password_hash(new_pw)
    db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user_id))
    db.commit()
    return jsonify({"message": "Password changed successfully."})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="127.0.0.1", port=port, debug=True)
