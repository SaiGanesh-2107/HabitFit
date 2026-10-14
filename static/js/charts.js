/**
 * HabitFit – Dashboard, Charts, Progress Analytics, Nutrition, Sleep, Calendar, Reminders & Settings (charts.js)
 */

let dashboardWeeklyChart = null;
let progressTimelineChart = null;
let progressMuscleChart = null;
let progressStrengthChart = null;
let progressBodyWeightChart = null;
let nutritionMacroChart = null;
let nutritionHistoryChart = null;
let sleepTrendChart = null;

let analyticsCache = null;
let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth() + 1; // 1..12
let selectedCalendarDate = new Date().toISOString().slice(0, 10);

// ============================================================================
// 1. DAILY DASHBOARD
// ============================================================================

async function loadDashboard() {
  const habitContainer = document.getElementById("dashHabitsList");
  if (!habitContainer) return;

  try {
    const data = await HabitFit.api("/api/dashboard");

    // Top KPI cards
    const pctEl = document.getElementById("dashHabitPct");
    const pctSubEl = document.getElementById("dashHabitSub");
    const barEl = document.getElementById("dashHabitProgressBar");
    const streakEl = document.getElementById("dashBestStreak");
    const waterEl = document.getElementById("dashWaterConsumed");
    const waterSubEl = document.getElementById("dashWaterSub");
    const waterBarEl = document.getElementById("dashWaterBar");
    const sleepEl = document.getElementById("dashSleepHours");
    const sleepSubEl = document.getElementById("dashSleepSub");

    if (pctEl) pctEl.textContent = `${data.habits.completion_pct}%`;
    if (pctSubEl) pctSubEl.textContent = `${data.habits.completed_count}/${data.habits.total_count} habits completed today`;
    if (barEl) barEl.style.width = `${data.habits.completion_pct}%`;
    if (streakEl) streakEl.textContent = `${data.habits.best_streak} Days`;

    if (waterEl) waterEl.textContent = `${data.water.consumed_ml} ml`;
    if (waterSubEl) waterSubEl.textContent = `Goal: ${data.water.goal_ml} ml (${data.water.remaining_ml} ml left)`;
    if (waterBarEl) waterBarEl.style.width = `${data.water.pct}%`;

    if (sleepEl) {
      sleepEl.textContent = data.sleep ? `${data.sleep.duration_hours} hrs` : "Not logged";
    }
    if (sleepSubEl) {
      sleepSubEl.textContent = data.sleep
        ? `Quality: ${data.sleep.quality_rating}/10 • Recovery: ${data.sleep.recovery_rating}/10`
        : `Daily Goal: ${data.preferences.sleep_goal_hours || 8} hrs`;
    }

    // Render Today's Habits checklist on Dashboard
    habitContainer.innerHTML = (data.habits.items || [])
      .map(
        (h) => `
        <div class="habit-item ${h.completed_today ? "completed" : ""}" style="padding:10px 14px; margin-bottom:8px;">
          <div class="habit-left">
            <button class="habit-check-btn" onclick="dashToggleHabit(${h.id})">
              <i class="fa-solid fa-check"></i>
            </button>
            <div class="habit-icon-box" style="width:32px; height:32px; background:${h.color}22; color:${h.color};">
              <i class="fa-solid ${h.icon || "fa-check-circle"}"></i>
            </div>
            <div class="habit-details">
              <h4 style="font-size:0.9rem;">${h.name}</h4>
              <div class="habit-meta">
                <span>${h.category}</span>
                <span style="color:var(--accent-amber);"><i class="fa-solid fa-fire"></i> ${h.current_streak}d</span>
              </div>
            </div>
          </div>
          <span class="badge ${h.completed_today ? "badge-green" : "badge-purple"}">
            ${h.completed_today ? "Done" : "Pending"}
          </span>
        </div>
      `
      )
      .join("");

    // Render Today's Workout Card
    const workoutBox = document.getElementById("dashTodayWorkoutBox");
    if (workoutBox) {
      const wp = data.today_workout;
      if (!wp) {
        workoutBox.innerHTML = `<p style="color:var(--text-secondary);">No workout plan configured.</p>`;
      } else if (wp.is_rest_day) {
        workoutBox.innerHTML = `
          <div style="padding:16px; background:var(--bg-secondary); border-radius:12px; text-align:center;">
            <span class="badge badge-amber">Rest & Recovery Day</span>
            <h4 style="margin:8px 0 4px;">${wp.day_name}: ${wp.focus_area}</h4>
            <p style="font-size:0.84rem; color:var(--text-secondary);">Prioritize mobility, hydration, and 8+ hours of sleep today.</p>
          </div>
        `;
      } else {
        const exList = (wp.exercises || [])
          .slice(0, 5)
          .map(
            (e) => `
            <div style="display:flex; justify-content:space-between; font-size:0.84rem; padding:6px 0; border-bottom:1px solid var(--border-color);">
              <span><strong>${e.exercise_name}</strong> <small style="color:var(--text-secondary);">(${e.muscle_group})</small></span>
              <span>${e.target_sets} × ${e.target_reps} ${e.target_weight_kg > 0 ? `@ ${e.target_weight_kg}kg` : ""}</span>
            </div>
          `
          )
          .join("");

        workoutBox.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div>
              <span class="badge badge-green">${wp.day_name}</span>
              <h4 style="font-size:1.05rem; margin-top:4px;">${wp.focus_area}</h4>
            </div>
            ${
              wp.logged_session
                ? `<span class="badge badge-amber"><i class="fa-solid fa-circle-check"></i> Completed Today</span>`
                : `<button class="btn btn-sm btn-primary" onclick="dashQuickCompleteWorkout()"><i class="fa-solid fa-bolt"></i> Quick Log</button>`
            }
          </div>
          <div style="margin-bottom:12px;">${exList}</div>
          <a href="/workouts" class="btn btn-secondary btn-sm" style="width:100%;">
            <i class="fa-solid fa-dumbbell"></i> Open Full Workout Logger & Rest Timer
          </a>
        `;
      }
      window._dashTodayWorkout = wp;
    }

    // Render Upcoming Reminders
    const remBox = document.getElementById("dashRemindersList");
    if (remBox) {
      const rems = (data.reminders || []).slice(0, 4);
      remBox.innerHTML = rems.length
        ? rems
            .map(
              (r) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 12px; background:var(--bg-secondary); border-radius:10px; margin-bottom:8px;">
              <div>
                <strong style="font-size:0.85rem;">${r.title}</strong>
                <div style="font-size:0.75rem; color:var(--text-secondary);">${r.message}</div>
              </div>
              <span class="badge badge-cyan">${r.reminder_time}</span>
            </div>
          `
            )
            .join("")
        : `<p style="color:var(--text-secondary); font-size:0.85rem;">No active reminders.</p>`;
    }

    // Render Achievements Strip
    const achBox = document.getElementById("dashAchievementsList");
    if (achBox) {
      achBox.innerHTML = (data.achievements || [])
        .slice(0, 6)
        .map(
          (a) => `
          <div style="padding:10px 12px; border-radius:10px; background:var(--bg-secondary); border:1px solid ${
            a.unlocked ? "var(--accent-green)" : "var(--border-color)"
          }; opacity:${a.unlocked ? "1" : "0.55"}; display:flex; align-items:center; gap:10px;">
            <div class="stat-icon ${a.unlocked ? "amber" : "purple"}" style="width:36px; height:36px; font-size:1rem;">
              <i class="fa-solid ${a.icon}"></i>
            </div>
            <div>
              <strong style="font-size:0.82rem; display:block;">${a.title}</strong>
              <small style="font-size:0.72rem; color:var(--text-secondary);">
                ${a.unlocked ? `Unlocked (+${a.xp_reward} XP)` : `${a.current_progress}/${a.target_progress}`}
              </small>
            </div>
          </div>
        `
        )
        .join("");
    }

    // Render Weekly Activity Chart
    const ctx = document.getElementById("dashWeeklyChartCanvas");
    if (ctx && window.Chart) {
      if (dashboardWeeklyChart) dashboardWeeklyChart.destroy();
      dashboardWeeklyChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: data.weekly_chart.labels,
          datasets: [
            {
              type: "line",
              label: "Habit Completion (%)",
              data: data.weekly_chart.habit_pcts,
              borderColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              borderWidth: 3,
              tension: 0.35,
              fill: true,
              yAxisID: "y",
            },
            {
              type: "bar",
              label: "Workout Duration (mins)",
              data: data.weekly_chart.workout_minutes,
              backgroundColor: "rgba(139, 92, 246, 0.7)",
              borderRadius: 6,
              yAxisID: "y1",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: "#94a3b8" } },
          },
          scales: {
            x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.08)" } },
            y: {
              position: "left",
              min: 0,
              max: 100,
              ticks: { color: "#10b981", callback: (v) => `${v}%` },
              grid: { color: "rgba(148,163,184,0.08)" },
            },
            y1: {
              position: "right",
              min: 0,
              ticks: { color: "#8b5cf6", callback: (v) => `${v}m` },
              grid: { drawOnChartArea: false },
            },
          },
        },
      });
    }
  } catch (err) {
    console.error("Dashboard load error:", err);
  }
}

async function dashToggleHabit(habitId) {
  const res = await HabitFit.api(`/api/habits/${habitId}/toggle`, { method: "POST" });
  HabitFit.handleGamificationResponse(res);
  HabitFit.toast(res.completed ? "Habit completed! (+15 XP)" : "Habit unchecked.");
  await loadDashboard();
}

async function dashQuickAddWater(ml) {
  const res = await HabitFit.api("/api/water", { method: "POST", body: { amount_ml: ml } });
  HabitFit.handleGamificationResponse(res);
  HabitFit.toast(res.message);
  await loadDashboard();
}

async function dashQuickCompleteWorkout() {
  const wp = window._dashTodayWorkout;
  if (!wp || !wp.exercises || wp.exercises.length === 0) return;
  const exercises = wp.exercises.map((e) => ({
    completed: true,
    exercise_name: e.exercise_name,
    muscle_group: e.muscle_group,
    sets_completed: e.target_sets,
    reps: e.target_reps,
    weight_kg: e.target_weight_kg,
    rest_seconds: e.rest_seconds,
  }));
  const res = await HabitFit.api("/api/workouts/sessions", {
    method: "POST",
    body: {
      title: `${wp.day_name}: ${wp.focus_area}`,
      focus_area: wp.focus_area,
      duration_minutes: wp.planned_duration_min || 55,
      notes: "Completed from Daily Dashboard.",
      exercises,
    },
  });
  HabitFit.handleGamificationResponse(res);
  HabitFit.toast(res.message);
  await loadDashboard();
}

// ============================================================================
// 2. PROGRESS & ANALYTICS PAGE
// ============================================================================

async function loadProgressAnalytics(days = 30, startStr = "", endStr = "") {
  const kpiTotalEl = document.getElementById("progTotalWorkouts");
  if (!kpiTotalEl) return;

  let query = `?days=${days}`;
  if (startStr && endStr) {
    query = `?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`;
  }

  try {
    const data = await HabitFit.api(`/api/analytics${query}`);
    analyticsCache = data;

    // Top KPIs
    kpiTotalEl.textContent = data.workout_kpis.total_all_time;
    document.getElementById("progWeeklyFreq").textContent = `${data.workout_kpis.weekly_frequency} / wk`;
    document.getElementById("progTotalTime").textContent = `${data.workout_kpis.period_minutes} mins`;
    document.getElementById("progHabitRate").textContent = `${data.habits_analytics.overall_rate}%`;

    // Week-over-week comparison
    const cw = data.workout_kpis.current_week;
    const pw = data.workout_kpis.previous_week;
    const wowBox = document.getElementById("weekOverWeekComparison");
    if (wowBox) {
      wowBox.innerHTML = `
        <div class="grid-3" style="margin-bottom:0;">
          <div style="padding:12px; background:var(--bg-secondary); border-radius:10px;">
            <span style="font-size:0.76rem; color:var(--text-secondary);">WORKOUTS (THIS WK VS LAST WK)</span>
            <h4 style="font-size:1.25rem; margin-top:4px;">${cw.workouts} <small style="color:var(--text-secondary); font-size:0.82rem;">vs ${pw.workouts}</small></h4>
          </div>
          <div style="padding:12px; background:var(--bg-secondary); border-radius:10px;">
            <span style="font-size:0.76rem; color:var(--text-secondary);">TRAINING TIME (THIS WK VS LAST WK)</span>
            <h4 style="font-size:1.25rem; margin-top:4px;">${cw.mins}m <small style="color:var(--text-secondary); font-size:0.82rem;">vs ${pw.mins}m</small></h4>
          </div>
          <div style="padding:12px; background:var(--bg-secondary); border-radius:10px;">
            <span style="font-size:0.76rem; color:var(--text-secondary);">VOLUME LIFTED (THIS WK VS LAST WK)</span>
            <h4 style="font-size:1.25rem; margin-top:4px;">${Math.round(cw.volume).toLocaleString()} kg <small style="color:var(--text-secondary); font-size:0.82rem;">vs ${Math.round(pw.volume).toLocaleString()} kg</small></h4>
          </div>
        </div>
      `;
    }

    // 1. Timeline Chart (Habit % + Sleep hours)
    const tlCanvas = document.getElementById("progTimelineChart");
    if (tlCanvas && window.Chart) {
      if (progressTimelineChart) progressTimelineChart.destroy();
      progressTimelineChart = new Chart(tlCanvas, {
        type: "line",
        data: {
          labels: data.timeline.labels,
          datasets: [
            {
              label: "Habit Completion (%)",
              data: data.timeline.habit_pcts,
              borderColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.14)",
              fill: true,
              tension: 0.35,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: "#94a3b8" } } },
          scales: {
            x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.08)" } },
            y: { min: 0, max: 100, ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.08)" } },
          },
        },
      });
    }

    // 2. Muscle Group Distribution Chart
    const mCanvas = document.getElementById("progMuscleChart");
    if (mCanvas && window.Chart) {
      if (progressMuscleChart) progressMuscleChart.destroy();
      progressMuscleChart = new Chart(mCanvas, {
        type: "bar",
        data: {
          labels: data.muscle_distribution.map((m) => m.muscle_group),
          datasets: [
            {
              label: "Total Sets Completed",
              data: data.muscle_distribution.map((m) => m.total_sets),
              backgroundColor: ["#10b981", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1"],
              borderRadius: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.08)" } },
          },
        },
      });
    }

    // 3. Exercise Strength Progression selector & chart
    const liftSelect = document.getElementById("progExerciseSelector");
    const exNames = Object.keys(data.exercise_progression || {});
    if (liftSelect && exNames.length > 0) {
      liftSelect.innerHTML = exNames.map((n) => `<option value="${n}">${n}</option>`).join("");
      renderExerciseProgressionChart(exNames[0]);
    }

    // 4. Body Weight Trend Chart
    const bwCanvas = document.getElementById("progBodyWeightChart");
    if (bwCanvas && window.Chart) {
      if (progressBodyWeightChart) progressBodyWeightChart.destroy();
      const bws = data.body_measurements || [];
      progressBodyWeightChart = new Chart(bwCanvas, {
        type: "line",
        data: {
          labels: bws.map((b) => b.log_date.slice(5)),
          datasets: [
            {
              label: "Body Weight (kg)",
              data: bws.map((b) => b.weight_kg),
              borderColor: "#06b6d4",
              backgroundColor: "rgba(6, 182, 212, 0.15)",
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: "#94a3b8" } } },
          scales: {
            x: { ticks: { color: "#94a3b8" } },
            y: { ticks: { color: "#94a3b8" } },
          },
        },
      });
    }

    // 5. Personal Records (PRs) Table
    const prBody = document.getElementById("progPrTableBody");
    if (prBody) {
      prBody.innerHTML = (data.personal_records || [])
        .map(
          (pr) => `
          <tr style="border-bottom:1px solid var(--border-color);">
            <td style="padding:10px;"><strong>${pr.exercise_name}</strong></td>
            <td style="padding:10px;"><span class="badge badge-purple">${pr.muscle_group}</span></td>
            <td style="padding:10px; font-weight:800; color:var(--accent-amber);">${pr.max_weight_kg} kg × ${pr.reps} reps</td>
            <td style="padding:10px; color:var(--text-secondary);">${pr.session_date}</td>
          </tr>
        `
        )
        .join("");
    }

    // 6. Most Consistent & Frequently Missed Habits
    const consEl = document.getElementById("progMostConsistentList");
    if (consEl) {
      consEl.innerHTML = (data.habits_analytics.most_consistent || [])
        .map(
          (h) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-secondary); border-radius:10px; margin-bottom:8px;">
            <div>
              <strong>${h.name}</strong>
              <div style="font-size:0.76rem; color:var(--text-secondary);">Streak: ${h.current_streak}d (Best: ${h.longest_streak}d)</div>
            </div>
            <span class="badge badge-green">${h.rate}%</span>
          </div>
        `
        )
        .join("");
    }

    const missedEl = document.getElementById("progMissedHabitsList");
    if (missedEl) {
      const missed = data.habits_analytics.frequently_missed || [];
      missedEl.innerHTML = missed.length
        ? missed
            .map(
              (h) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-secondary); border-radius:10px; margin-bottom:8px;">
              <div>
                <strong>${h.name}</strong>
                <div style="font-size:0.76rem; color:var(--text-secondary);">Completed ${h.completed_days} days in period</div>
              </div>
              <span class="badge badge-rose">${h.rate}%</span>
            </div>
          `
            )
            .join("")
        : `<p style="font-size:0.85rem; color:var(--accent-green);">No habits below 75% consistency! Outstanding work!</p>`;
    }
  } catch (err) {
    console.error("Analytics error:", err);
  }
}

function renderExerciseProgressionChart(exerciseName) {
  if (!analyticsCache || !analyticsCache.exercise_progression) return;
  const pts = analyticsCache.exercise_progression[exerciseName] || [];
  const canvas = document.getElementById("progStrengthChart");
  if (!canvas || !window.Chart) return;

  if (progressStrengthChart) progressStrengthChart.destroy();
  progressStrengthChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: pts.map((p) => p.date.slice(5)),
      datasets: [
        {
          label: `${exerciseName} Top Weight (kg)`,
          data: pts.map((p) => p.weight_kg),
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.2)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#94a3b8" } } },
      scales: {
        x: { ticks: { color: "#94a3b8" } },
        y: { ticks: { color: "#94a3b8", callback: (v) => `${v} kg` } },
      },
    },
  });
}

async function submitBodyMeasurementForm(e) {
  e.preventDefault();
  const payload = {
    log_date: document.getElementById("bmDate").value || new Date().toISOString().slice(0, 10),
    weight_kg: parseFloat(document.getElementById("bmWeight").value),
    body_fat_pct: document.getElementById("bmBodyFat").value || null,
    waist_cm: document.getElementById("bmWaist").value || null,
    chest_cm: document.getElementById("bmChest").value || null,
    arms_cm: document.getElementById("bmArms").value || null,
  };
  await HabitFit.api("/api/measurements", { method: "POST", body: payload });
  HabitFit.toast("Body measurements logged!");
  HabitFit.closeModal("bodyMeasurementModal");
  await loadProgressAnalytics(30);
}

// ============================================================================
// 3. WATER & NUTRITION PAGE
// ============================================================================

async function loadNutritionPage() {
  const ringEl = document.getElementById("waterProgressRingFg");
  if (!ringEl) return;

  const dateVal = document.getElementById("nutritionDatePicker")?.value || new Date().toISOString().slice(0, 10);

  try {
    const data = await HabitFit.api(`/api/nutrition?date=${dateVal}`);

    // Update circular SVG progress indicator (circumference = 2 * pi * 80 = 502)
    const offset = 502 - (502 * data.water.pct) / 100;
    ringEl.style.strokeDashoffset = offset;
    document.getElementById("waterCirclePct").textContent = `${data.water.pct}%`;
    document.getElementById("waterCircleConsumed").textContent = `${data.water.consumed_ml} / ${data.water.goal_ml} ml`;
    document.getElementById("waterRemainingBadge").textContent = `${data.water.remaining_ml} ml remaining`;

    // Water logs list
    const waterList = document.getElementById("waterLogsList");
    if (waterList) {
      waterList.innerHTML = (data.water.logs || [])
        .map(
          (w) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-secondary); border-radius:8px; margin-bottom:6px; font-size:0.84rem;">
            <span><i class="fa-solid fa-droplet" style="color:var(--accent-cyan);"></i> <strong>+${w.amount_ml} ml</strong> <small style="color:var(--text-secondary);">at ${w.logged_time}</small></span>
            <button class="btn btn-sm btn-danger" onclick="deleteWaterEntry(${w.id})"><i class="fa-solid fa-xmark"></i></button>
          </div>
        `
        )
        .join("");
    }

    // Nutrition Macros
    const t = data.nutrition.totals;
    const g = data.nutrition.goals;
    document.getElementById("macroCaloriesVal").textContent = `${t.calories} / ${g.calorie_goal} kcal`;
    document.getElementById("macroProteinVal").textContent = `${t.protein_g}g / ${g.protein_goal_g}g`;
    document.getElementById("macroCarbsVal").textContent = `${t.carbs_g}g / ${g.carbs_goal_g}g`;
    document.getElementById("macroFatVal").textContent = `${t.fat_g}g / ${g.fat_goal_g}g`;

    document.getElementById("macroCaloriesBar").style.width = `${Math.min(100, (t.calories / Math.max(1, g.calorie_goal)) * 100)}%`;
    document.getElementById("macroProteinBar").style.width = `${Math.min(100, (t.protein_g / Math.max(1, g.protein_goal_g)) * 100)}%`;
    document.getElementById("macroCarbsBar").style.width = `${Math.min(100, (t.carbs_g / Math.max(1, g.carbs_goal_g)) * 100)}%`;
    document.getElementById("macroFatBar").style.width = `${Math.min(100, (t.fat_g / Math.max(1, g.fat_goal_g)) * 100)}%`;

    // Meals list
    const mealsEl = document.getElementById("mealsLoggedList");
    if (mealsEl) {
      const meals = data.nutrition.meals || [];
      mealsEl.innerHTML = meals.length
        ? meals
            .map(
              (m) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:var(--bg-secondary); border-radius:10px; margin-bottom:8px;">
              <div>
                <span class="badge badge-green">${m.meal_type}</span>
                <strong style="margin-left:8px;">${m.food_name}</strong>
                <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:4px;">
                  <strong>${m.calories} kcal</strong> • Protein: ${m.protein_g}g • Carbs: ${m.carbs_g}g • Fat: ${m.fat_g}g
                </div>
              </div>
              <button class="btn btn-sm btn-danger" onclick="deleteMealEntry(${m.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
          `
            )
            .join("")
        : `<p style="color:var(--text-secondary); font-size:0.86rem; text-align:center; padding:18px;">No meals logged for this date yet.</p>`;
    }

    // Macro Doughnut Chart
    const mCanvas = document.getElementById("nutritionMacroChartCanvas");
    if (mCanvas && window.Chart) {
      if (nutritionMacroChart) nutritionMacroChart.destroy();
      nutritionMacroChart = new Chart(mCanvas, {
        type: "doughnut",
        data: {
          labels: ["Protein (g)", "Carbs (g)", "Fats (g)"],
          datasets: [
            {
              data: [t.protein_g || 1, t.carbs_g || 1, t.fat_g || 1],
              backgroundColor: ["#10b981", "#8b5cf6", "#f59e0b"],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { color: "#94a3b8" } } },
        },
      });
    }
  } catch (err) {
    console.error("Nutrition load error:", err);
  }
}

async function addWaterIntake(amountMl) {
  const dateVal = document.getElementById("nutritionDatePicker")?.value || new Date().toISOString().slice(0, 10);
  const res = await HabitFit.api("/api/water", {
    method: "POST",
    body: { amount_ml: amountMl, date: dateVal },
  });
  HabitFit.handleGamificationResponse(res);
  HabitFit.toast(res.message);
  await loadNutritionPage();
}

async function deleteWaterEntry(id) {
  await HabitFit.api(`/api/water/${id}`, { method: "DELETE" });
  await loadNutritionPage();
}

async function submitMealLogForm(e) {
  e.preventDefault();
  const dateVal = document.getElementById("nutritionDatePicker")?.value || new Date().toISOString().slice(0, 10);
  const payload = {
    date: dateVal,
    meal_type: document.getElementById("mealTypeInput").value,
    food_name: document.getElementById("mealFoodNameInput").value.trim(),
    calories: parseInt(document.getElementById("mealCaloriesInput").value || "0", 10),
    protein_g: parseFloat(document.getElementById("mealProteinInput").value || "0"),
    carbs_g: parseFloat(document.getElementById("mealCarbsInput").value || "0"),
    fat_g: parseFloat(document.getElementById("mealFatInput").value || "0"),
  };
  await HabitFit.api("/api/nutrition/meals", { method: "POST", body: payload });
  HabitFit.toast(`Logged ${payload.food_name}!`);
  document.getElementById("mealFoodNameInput").value = "";
  await loadNutritionPage();
}

async function deleteMealEntry(id) {
  await HabitFit.api(`/api/nutrition/meals/${id}`, { method: "DELETE" });
  HabitFit.toast("Meal entry removed.");
  await loadNutritionPage();
}

// ============================================================================
// 4. SLEEP & RECOVERY TRACKER PAGE
// ============================================================================

async function loadSleepPage() {
  const tableBody = document.getElementById("sleepLogsTableBody");
  if (!tableBody) return;

  try {
    const data = await HabitFit.api("/api/sleep");
    document.getElementById("sleepAvgDuration").textContent = `${data.summary.avg_duration} hrs`;
    document.getElementById("sleepConsistencyScore").textContent = `${data.summary.consistency_score}%`;
    document.getElementById("sleepAvgQuality").textContent = `${data.summary.avg_quality} / 10`;
    document.getElementById("sleepAvgRecovery").textContent = `${data.summary.avg_recovery} / 10`;

    const logs = data.logs || [];
    tableBody.innerHTML = logs
      .map(
        (s) => `
        <tr style="border-bottom:1px solid var(--border-color);">
          <td style="padding:10px;"><strong>${s.log_date}</strong></td>
          <td style="padding:10px;">${s.sleep_time} → ${s.wake_time}</td>
          <td style="padding:10px;"><span class="badge ${s.duration_hours >= 7.5 ? "badge-green" : "badge-amber"}">${s.duration_hours} hrs</span></td>
          <td style="padding:10px;">${s.quality_rating}/10</td>
          <td style="padding:10px;">${s.energy_rating}/10</td>
          <td style="padding:10px;">${s.recovery_rating}/10</td>
          <td style="padding:10px; color:var(--text-secondary); font-size:0.82rem;">${s.notes || "-"}</td>
          <td style="padding:10px;">
            <button class="btn btn-sm btn-danger" onclick="deleteSleepEntry(${s.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `
      )
      .join("");

    // Render Weekly Sleep Trend Chart
    const sCanvas = document.getElementById("sleepTrendChartCanvas");
    if (sCanvas && window.Chart) {
      if (sleepTrendChart) sleepTrendChart.destroy();
      const ordered = [...logs].reverse();
      sleepTrendChart = new Chart(sCanvas, {
        type: "bar",
        data: {
          labels: ordered.map((x) => x.log_date.slice(5)),
          datasets: [
            {
              label: "Sleep Duration (Hours)",
              data: ordered.map((x) => x.duration_hours),
              backgroundColor: "rgba(139, 92, 246, 0.7)",
              borderRadius: 6,
            },
            {
              type: "line",
              label: "Recovery Score (1-10)",
              data: ordered.map((x) => x.recovery_rating),
              borderColor: "#10b981",
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: "#94a3b8" } } },
          scales: {
            x: { ticks: { color: "#94a3b8" } },
            y: { beginAtZero: true, max: 12, ticks: { color: "#94a3b8" } },
          },
        },
      });
    }
  } catch (err) {
    console.error("Sleep page error:", err);
  }
}

async function submitSleepLogForm(e) {
  e.preventDefault();
  const payload = {
    log_date: document.getElementById("sleepDateInput").value,
    sleep_time: document.getElementById("sleepTimeInput").value,
    wake_time: document.getElementById("wakeTimeInput").value,
    quality_rating: parseInt(document.getElementById("sleepQualityInput").value || "8", 10),
    energy_rating: parseInt(document.getElementById("sleepEnergyInput").value || "8", 10),
    recovery_rating: parseInt(document.getElementById("sleepRecoveryInput").value || "8", 10),
    notes: document.getElementById("sleepNotesInput").value.trim(),
  };
  const res = await HabitFit.api("/api/sleep", { method: "POST", body: payload });
  HabitFit.handleGamificationResponse(res);
  HabitFit.toast(res.message);
  await loadSleepPage();
}

async function deleteSleepEntry(id) {
  await HabitFit.api(`/api/sleep/${id}`, { method: "DELETE" });
  HabitFit.toast("Sleep record removed.");
  await loadSleepPage();
}

// ============================================================================
// 5. INTERACTIVE CALENDAR & ACTIVITY HISTORY
// ============================================================================

async function loadCalendarPage(year = currentCalendarYear, month = currentCalendarMonth) {
  const grid = document.getElementById("calendarMonthGrid");
  if (!grid) return;

  currentCalendarYear = year;
  currentCalendarMonth = month;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  document.getElementById("calendarMonthTitle").textContent = `${monthNames[month - 1]} ${year}`;

  try {
    const data = await HabitFit.api(`/api/calendar?year=${year}&month=${month}`);
    const daysMap = data.days || {};

    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0=Sun..6=Sat
    const daysInMonth = new Date(year, month, 0).getDate();

    let html = "";
    for (let i = 0; i < firstDayIndex; i++) {
      html += `<div class="cal-day empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const info = daysMap[dStr] || {};
      const isSelected = dStr === selectedCalendarDate;

      let statusBadge = "";
      if (info.status === "complete") {
        statusBadge = `<span style="width:8px; height:8px; border-radius:50%; background:var(--accent-green);"></span>`;
      } else if (info.status === "partial") {
        statusBadge = `<span style="width:8px; height:8px; border-radius:50%; background:var(--accent-amber);"></span>`;
      } else if (info.status === "missed") {
        statusBadge = `<span style="width:8px; height:8px; border-radius:50%; background:var(--accent-rose);"></span>`;
      }

      html += `
        <div class="cal-day ${isSelected ? "selected" : ""}" onclick="inspectCalendarDate('${dStr}')">
          <div class="cal-day-num">
            <span>${d}</span>
            ${statusBadge}
          </div>
          <div class="cal-indicators">
            ${
              info.habits_completed > 0
                ? `<div class="cal-pill badge-green"><i class="fa-solid fa-check"></i> ${info.habits_completed}/${info.habits_total} Habits</div>`
                : ""
            }
            ${
              info.workouts && info.workouts.length > 0
                ? `<div class="cal-pill badge-purple"><i class="fa-solid fa-dumbbell"></i> Workout Done</div>`
                : info.is_rest_day
                ? `<div class="cal-pill badge-amber">Rest Day</div>`
                : ""
            }
          </div>
        </div>
      `;
    }

    grid.innerHTML = html;
    await inspectCalendarDate(selectedCalendarDate);
  } catch (err) {
    console.error("Calendar load error:", err);
  }
}

function changeCalendarMonth(delta) {
  let m = currentCalendarMonth + delta;
  let y = currentCalendarYear;
  if (m < 1) {
    m = 12;
    y--;
  } else if (m > 12) {
    m = 1;
    y++;
  }
  loadCalendarPage(y, m);
}

async function inspectCalendarDate(dateStr) {
  selectedCalendarDate = dateStr;
  document.querySelectorAll(".cal-day").forEach((el) => {
    el.classList.toggle("selected", el.getAttribute("onclick")?.includes(dateStr));
  });

  const panel = document.getElementById("calendarDayInspector");
  if (!panel) return;

  try {
    const data = await HabitFit.api(`/api/calendar/day?date=${dateStr}`);
    const habitsHtml = (data.habits || [])
      .map(
        (h) => `
        <div style="display:flex; justify-content:space-between; font-size:0.84rem; padding:6px 0; border-bottom:1px solid var(--border-color);">
          <span>${h.name}</span>
          <span class="badge ${h.completed ? "badge-green" : "badge-rose"}">${h.completed ? "Completed" : "Missed"}</span>
        </div>
      `
      )
      .join("");

    const workoutsHtml = (data.workouts || []).length
      ? data.workouts
          .map(
            (w) => `
          <div style="padding:10px; background:var(--bg-secondary); border-radius:8px; margin-bottom:8px;">
            <strong style="font-size:0.88rem; color:var(--accent-purple);">${w.title}</strong>
            <div style="font-size:0.78rem; color:var(--text-secondary);">${w.duration_minutes} mins • ${w.total_volume_kg} kg total volume</div>
          </div>
        `
          )
          .join("")
      : `<p style="font-size:0.82rem; color:var(--text-secondary);">No logged workout sessions (${
          data.planned_workout?.is_rest_day ? "Scheduled Rest Day" : `Planned: ${data.planned_workout?.focus_area || "None"}`
        }).</p>`;

    panel.innerHTML = `
      <span class="badge badge-purple">${data.date}</span>
      <h3 style="font-size:1.15rem; margin:6px 0 14px;">${data.formatted_date}</h3>

      <h4 style="font-size:0.86rem; color:var(--text-secondary); text-transform:uppercase; margin-bottom:6px;">Workouts</h4>
      ${workoutsHtml}

      <h4 style="font-size:0.86rem; color:var(--text-secondary); text-transform:uppercase; margin:14px 0 6px;">Habits Breakdown</h4>
      <div>${habitsHtml}</div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px;">
        <div style="padding:10px; background:var(--bg-secondary); border-radius:8px;">
          <small style="color:var(--text-secondary);">Water Intake</small>
          <strong style="display:block; font-size:1rem; color:var(--accent-cyan);">${data.water_ml} ml</strong>
        </div>
        <div style="padding:10px; background:var(--bg-secondary); border-radius:8px;">
          <small style="color:var(--text-secondary);">Sleep Logged</small>
          <strong style="display:block; font-size:1rem; color:var(--accent-purple);">${
            data.sleep ? `${data.sleep.duration_hours} hrs` : "—"
          }</strong>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Day inspector error:", err);
  }
}

// ============================================================================
// 6. SMART REMINDERS PAGE
// ============================================================================

async function loadRemindersPage() {
  const container = document.getElementById("remindersPageList");
  if (!container) return;

  try {
    const data = await HabitFit.api("/api/reminders");
    const items = data.reminders || [];

    if (items.length === 0) {
      container.innerHTML = `<p style="color:var(--text-secondary);">No reminders configured yet.</p>`;
      return;
    }

    container.innerHTML = items
      .map(
        (r) => `
        <div class="habit-item" style="opacity:${r.is_enabled ? "1" : "0.6"};">
          <div class="habit-left">
            <div class="stat-icon ${r.category === "workout" ? "purple" : r.category === "water" ? "cyan" : "green"}" style="width:40px; height:40px; font-size:1rem;">
              <i class="fa-solid ${
                r.category === "workout"
                  ? "fa-dumbbell"
                  : r.category === "water"
                  ? "fa-droplet"
                  : r.category === "sleep"
                  ? "fa-moon"
                  : "fa-bell"
              }"></i>
            </div>
            <div>
              <h4 style="font-size:0.96rem;">${r.title}</h4>
              <p style="font-size:0.82rem; color:var(--text-secondary);">${r.message}</p>
              <div class="habit-meta">
                <span class="badge badge-green"><i class="fa-regular fa-clock"></i> ${r.reminder_time}</span>
                <span class="badge badge-purple">${r.recurrence}</span>
                ${r.snoozed_until ? `<span class="badge badge-amber">Snoozed until ${r.snoozed_until}</span>` : ""}
              </div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-sm btn-secondary" onclick="HabitFit.snoozeReminder(${r.id}, 15)">Snooze 15m</button>
            <button class="btn btn-sm ${r.is_enabled ? "btn-primary" : "btn-outline"}" onclick="toggleReminderEnabled(${r.id}, ${!r.is_enabled})">
              ${r.is_enabled ? "Enabled" : "Disabled"}
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteReminderItem(${r.id})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `
      )
      .join("");
  } catch (err) {
    console.error("Failed to load reminders:", err);
  }
}

async function submitNewReminderForm(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById("remTitleInput").value.trim(),
    message: document.getElementById("remMessageInput").value.trim(),
    category: document.getElementById("remCategoryInput").value,
    reminder_time: document.getElementById("remTimeInput").value,
    recurrence: document.getElementById("remRecurrenceInput").value,
  };
  await HabitFit.api("/api/reminders", { method: "POST", body: payload });
  HabitFit.toast("Smart reminder created!");
  document.getElementById("remTitleInput").value = "";
  document.getElementById("remMessageInput").value = "";
  await loadRemindersPage();
}

async function toggleReminderEnabled(id, nextState) {
  await HabitFit.api(`/api/reminders/${id}`, {
    method: "PUT",
    body: { is_enabled: nextState },
  });
  HabitFit.toast(nextState ? "Reminder enabled." : "Reminder paused.");
  await loadRemindersPage();
}

async function deleteReminderItem(id) {
  await HabitFit.api(`/api/reminders/${id}`, { method: "DELETE" });
  HabitFit.toast("Reminder deleted.");
  await loadRemindersPage();
}

// ============================================================================
// 7. SETTINGS, PROFILE & PERSONAL JOURNAL
// ============================================================================

async function loadJournalNotes() {
  const box = document.getElementById("journalNotesList");
  if (!box) return;
  const data = await HabitFit.api("/api/journal");
  const notes = data.notes || [];
  box.innerHTML = notes.length
    ? notes
        .map(
          (n) => `
        <div style="padding:14px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:10px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div>
              <span class="badge badge-green">${n.note_date}</span>
              <span class="badge badge-purple">${n.mood}</span>
              <strong style="margin-left:6px;">${n.title}</strong>
            </div>
            <button class="btn btn-sm btn-danger" onclick="deleteJournalEntry(${n.id})"><i class="fa-solid fa-trash"></i></button>
          </div>
          <p style="font-size:0.86rem; color:var(--text-secondary);">${n.content}</p>
        </div>
      `
        )
        .join("")
    : `<p style="color:var(--text-secondary); font-size:0.85rem;">No journal notes recorded yet.</p>`;
}

async function submitJournalForm(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById("journalTitleInput").value.trim(),
    mood: document.getElementById("journalMoodInput").value,
    content: document.getElementById("journalContentInput").value.trim(),
  };
  await HabitFit.api("/api/journal", { method: "POST", body: payload });
  HabitFit.toast("Journal entry saved! (+10 XP)");
  document.getElementById("journalTitleInput").value = "";
  document.getElementById("journalContentInput").value = "";
  await loadJournalNotes();
}

async function deleteJournalEntry(id) {
  await HabitFit.api(`/api/journal/${id}`, { method: "DELETE" });
  HabitFit.toast("Journal note deleted.");
  await loadJournalNotes();
}

async function submitProfileSettingsForm(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById("profNameInput").value.trim(),
    fitness_goal: document.getElementById("profGoalInput").value.trim(),
    experience_level: document.getElementById("profLevelInput").value,
    new_password: document.getElementById("profPasswordInput").value,
  };
  const res = await HabitFit.api("/api/settings/profile", { method: "PUT", body: payload });
  HabitFit.toast(res.message);
  document.getElementById("profPasswordInput").value = "";
}

async function submitPreferencesSettingsForm(e) {
  e.preventDefault();
  const payload = {
    water_goal_ml: parseInt(document.getElementById("prefWaterGoal").value || "2500", 10),
    calorie_goal: parseInt(document.getElementById("prefCalorieGoal").value || "2200", 10),
    protein_goal_g: parseInt(document.getElementById("prefProteinGoal").value || "160", 10),
    carbs_goal_g: parseInt(document.getElementById("prefCarbsGoal").value || "220", 10),
    fat_goal_g: parseInt(document.getElementById("prefFatGoal").value || "70", 10),
    sleep_goal_hours: parseFloat(document.getElementById("prefSleepGoal").value || "8.0"),
    weekly_workout_goal: parseInt(document.getElementById("prefWorkoutGoal").value || "5", 10),
    theme: document.documentElement.getAttribute("data-theme") || "dark",
  };
  const res = await HabitFit.api("/api/settings/preferences", { method: "PUT", body: payload });
  HabitFit.toast(res.message);
}

// Auto-initialize page modules on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("dashHabitsList")) loadDashboard();
  if (document.getElementById("progTotalWorkouts")) loadProgressAnalytics(30);
  if (document.getElementById("waterProgressRingFg")) loadNutritionPage();
  if (document.getElementById("sleepLogsTableBody")) loadSleepPage();
  if (document.getElementById("calendarMonthGrid")) loadCalendarPage();
  if (document.getElementById("remindersPageList")) loadRemindersPage();
  if (document.getElementById("journalNotesList")) loadJournalNotes();
});
