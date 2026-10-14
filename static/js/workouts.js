/**
 * HABITFIT — Workout Planner & Active Session Logic (workouts.js)
 * Manages 7-day schedule, split templates, exercise customization, and the focused active workout session.
 */

let weeklyPlansCache = [];
let selectedDayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // 0=Mon..6=Sun

// Active Workout State
let activePlanData = null;
let workoutStartTime = null;
let stopwatchSeconds = 0;
let stopwatchTimer = null;

let restRemainingSeconds = 90;
let restInterval = null;

// ============================================================================
// WORKOUT PLANNER PAGE
// ============================================================================

async function loadWorkoutPlanner() {
  const grid = document.getElementById("workoutWeekScheduleGrid");
  if (!grid) return;

  try {
    const data = await HabitFit.api("/api/workouts/plans");
    weeklyPlansCache = data.plans || [];

    const splitBadge = document.getElementById("activeSplitNameText");
    if (splitBadge) {
      splitBadge.textContent = (data.active_split_name && data.active_split_name !== "None")
        ? data.active_split_name
        : "No active routine";
    }

    renderWeeklyScheduleGrid();
    renderSelectedDayDetails();
  } catch (err) {
    console.error("Error loading workout plans:", err);
  }
}

function renderWeeklyScheduleGrid() {
  const grid = document.getElementById("workoutWeekScheduleGrid");
  if (!grid) return;

  if (weeklyPlansCache.length === 0) {
    grid.innerHTML = `
      <div class="card" style="grid-column:1/-1; text-align:center; padding:36px 20px;">
        <i class="fa-solid fa-dumbbell" style="font-size:32px; color:var(--text-muted); margin-bottom:10px;"></i>
        <h3 style="font-size:16px; font-weight:700; margin-bottom:6px;">No Workout Plan Scheduled</h3>
        <p style="font-size:13.5px; color:var(--text-secondary); max-width:440px; margin:0 auto 16px;">
          Choose a workout split template (such as Push/Pull/Legs or Upper/Lower) or build your custom schedule.
        </p>
        <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="applySplitTemplateChoice('ppl')">
            <i class="fa-solid fa-bolt"></i> Load Push / Pull / Legs Split
          </button>
          <button class="btn btn-secondary btn-sm" onclick="applySplitTemplateChoice('full_body')">
            <i class="fa-solid fa-dumbbell"></i> Load Full Body Split
          </button>
        </div>
      </div>
    `;
    return;
  }

  const currentDow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  grid.innerHTML = weeklyPlansCache.map(p => `
    <div class="day-card ${p.day_of_week === currentDow ? 'current-day' : ''} ${p.day_of_week === selectedDayIdx ? 'selected' : ''}"
         onclick="selectScheduleDay(${p.day_of_week})">
      <div class="day-card-label">${p.day_name.slice(0, 3)}</div>
      <div class="day-card-name">${p.is_rest_day ? 'Rest & Recovery' : p.workout_name}</div>
      <div class="day-card-muscles">${p.is_rest_day ? 'Recovery' : (p.muscle_groups || `${p.exercise_count} exercises`)}</div>
    </div>
  `).join("");
}

function selectScheduleDay(dayIdx) {
  selectedDayIdx = dayIdx;
  renderWeeklyScheduleGrid();
  renderSelectedDayDetails();
}

function renderSelectedDayDetails() {
  const panel = document.getElementById("selectedDayDetailsPanel");
  if (!panel) return;

  if (weeklyPlansCache.length === 0) {
    panel.innerHTML = `
      <div class="card" style="text-align:center; padding:28px 20px; color:var(--text-secondary);">
        <p style="font-size:13px;">Choose a routine template from the dropdown above to schedule and customize daily exercises.</p>
      </div>
    `;
    return;
  }

  const plan = weeklyPlansCache.find(p => p.day_of_week === selectedDayIdx);
  if (!plan) return;

  const exercises = plan.exercises || [];

  if (plan.is_rest_day) {
    panel.innerHTML = `
      <div class="card" style="text-align:center; padding:36px 20px;">
        <i class="fa-solid fa-couch" style="font-size:32px; color:var(--status-warning); margin-bottom:12px;"></i>
        <h3 style="font-size:18px; margin-bottom:6px;">${plan.day_name} — Rest & Recovery Day</h3>
        <p style="font-size:13.5px; color:var(--text-secondary); max-width:480px; margin:0 auto 18px;">
          Prioritize muscle repair, 8 hours of sleep, light mobility stretching, and hydration today.
        </p>
        <button class="btn btn-secondary btn-sm" onclick="openEditPlanModal(${plan.day_of_week})">
          <i class="fa-solid fa-pen"></i> Edit Day Plan
        </button>
      </div>
    `;
    return;
  }

  const exerciseRows = exercises.length === 0
    ? `<p style="color:var(--text-secondary); font-size:13px; padding:16px 0;">No exercises planned for this day yet.</p>`
    : exercises.map((e, idx) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color); font-size:13.5px;">
          <div>
            <strong>${idx + 1}. ${e.exercise_name}</strong>
          </div>
          <div style="color:var(--text-secondary); font-size:13px;">
            <span>${e.target_sets} sets × ${e.target_reps} reps</span>
            <span style="margin-left:12px;"><i class="fa-solid fa-hourglass-half" style="font-size:11px;"></i> ${e.rest_seconds}s rest</span>
          </div>
        </div>
      `).join("");

  panel.innerHTML = `
    <div class="card">
      <div class="card-header-row">
        <div>
          <span class="badge-pill" style="color:var(--accent-purple); font-weight:600;">${plan.day_name}</span>
          <h2 style="font-size:20px; font-weight:700; margin-top:4px;">${plan.workout_name}</h2>
          <p style="font-size:13px; color:var(--text-secondary);">${plan.muscle_groups} • ~${plan.estimated_duration} mins</p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary btn-sm" onclick="openEditPlanModal(${plan.day_of_week})">
            <i class="fa-solid fa-pen"></i> Edit Plan
          </button>
          <a href="/workouts/active/${plan.day_of_week}" class="btn btn-primary btn-sm">
            <i class="fa-solid fa-play"></i> Start Workout
          </a>
        </div>
      </div>
      <div style="margin-top:14px;">
        <h4 style="font-size:14px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; margin-bottom:8px; letter-spacing:0.04em;">Planned Exercises</h4>
        ${exerciseRows}
      </div>
    </div>
  `;
}

async function applySplitTemplateChoice(templateKey) {
  if (confirm("Applying this template will update your weekly training days. (Your workout history and PRs remain saved). Proceed?")) {
    const res = await HabitFit.api("/api/workouts/apply-template", {
      method: "POST",
      body: { template_key: templateKey }
    });
    HabitFit.toast(res.message);
    await loadWorkoutPlanner();
  }
}

function openEditPlanModal(dayIdx) {
  if (weeklyPlansCache.length === 0) {
    HabitFit.toast("Please select a workout split template first to customize it.", "error");
    return;
  }
  const plan = weeklyPlansCache.find(p => p.day_of_week === dayIdx);
  if (!plan) return;

  document.getElementById("editPlanDayIdx").value = dayIdx;
  document.getElementById("editPlanModalTitle").textContent = `Edit ${plan.day_name} Plan`;
  document.getElementById("editPlanWorkoutName").value = plan.workout_name;
  document.getElementById("editPlanMuscles").value = plan.muscle_groups;
  document.getElementById("editPlanDuration").value = plan.estimated_duration;
  document.getElementById("editPlanIsRest").checked = Boolean(plan.is_rest_day);

  renderModalExerciseRows(plan.exercises || []);
  HabitFit.openModal("editPlanModalDialog");
}

function renderModalExerciseRows(exercises) {
  const container = document.getElementById("modalExerciseRowsContainer");
  if (!container) return;

  container.innerHTML = exercises.map((e, idx) => `
    <div class="modal-ex-item">
      <div class="modal-ex-header">
        <input type="text" class="form-input ex-name-input" value="${e.exercise_name}" placeholder="Exercise Name" required>
        <button type="button" class="btn btn-sm btn-danger-outline" onclick="this.closest('.modal-ex-item').remove()" title="Remove Exercise">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="modal-ex-fields">
        <div class="modal-ex-field">
          <label>Sets</label>
          <input type="number" class="form-input ex-sets-input" value="${e.target_sets || 3}" min="1" max="15" placeholder="Sets">
        </div>
        <div class="modal-ex-field">
          <label>Reps</label>
          <input type="text" class="form-input ex-reps-input" value="${e.target_reps || '10'}" placeholder="Reps">
        </div>
        <div class="modal-ex-field">
          <label>Rest (s)</label>
          <input type="number" class="form-input ex-rest-input" value="${e.rest_seconds || 90}" step="15" placeholder="Rest">
        </div>
      </div>
    </div>
  `).join("");
}

function addModalExerciseRow() {
  const container = document.getElementById("modalExerciseRowsContainer");
  if (!container) return;
  const div = document.createElement("div");
  div.className = "modal-ex-item";
  div.innerHTML = `
    <div class="modal-ex-header">
      <input type="text" class="form-input ex-name-input" placeholder="Exercise Name" required>
      <button type="button" class="btn btn-sm btn-danger-outline" onclick="this.closest('.modal-ex-item').remove()" title="Remove Exercise">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="modal-ex-fields">
      <div class="modal-ex-field">
        <label>Sets</label>
        <input type="number" class="form-input ex-sets-input" value="3" min="1" max="15">
      </div>
      <div class="modal-ex-field">
        <label>Reps</label>
        <input type="text" class="form-input ex-reps-input" value="10">
      </div>
      <div class="modal-ex-field">
        <label>Rest (s)</label>
        <input type="number" class="form-input ex-rest-input" value="90" step="15">
      </div>
    </div>
  `;
  container.appendChild(div);
}

async function submitEditPlanForm(e) {
  e.preventDefault();
  const dayIdx = parseInt(document.getElementById("editPlanDayIdx").value, 10);
  const items = document.querySelectorAll("#modalExerciseRowsContainer .modal-ex-item");
  const exercises = [];

  items.forEach(it => {
    const name = it.querySelector(".ex-name-input")?.value.trim();
    if (name) {
      exercises.push({
        exercise_name: name,
        target_sets: parseInt(it.querySelector(".ex-sets-input")?.value || "3", 10),
        target_reps: it.querySelector(".ex-reps-input")?.value.trim() || "10",
        rest_seconds: parseInt(it.querySelector(".ex-rest-input")?.value || "90", 10),
      });
    }
  });

  const payload = {
    workout_name: document.getElementById("editPlanWorkoutName").value.trim(),
    muscle_groups: document.getElementById("editPlanMuscles").value.trim(),
    estimated_duration: parseInt(document.getElementById("editPlanDuration").value || "50", 10),
    is_rest_day: document.getElementById("editPlanIsRest").checked,
    exercises: exercises,
  };

  await HabitFit.api(`/api/workouts/plans/${dayIdx}`, { method: "POST", body: payload });
  HabitFit.toast("Workout schedule updated.");
  HabitFit.closeModal("editPlanModalDialog");
  await loadWorkoutPlanner();
}

// ============================================================================
// ACTIVE WORKOUT SESSION PAGE
// ============================================================================

async function loadActiveWorkoutPage(dayIdx) {
  const container = document.getElementById("activeWorkoutContainer");
  if (!container) return;

  try {
    const res = await HabitFit.api(`/api/workouts/active-plan?day=${dayIdx}`);
    activePlanData = res.plan;

    document.getElementById("activeWorkoutTitle").textContent = activePlanData.workout_name;
    document.getElementById("activeWorkoutMuscles").textContent = activePlanData.muscle_groups;

    startStopwatch();
    renderActiveExercises();
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:48px 20px;">
        <i class="fa-solid fa-dumbbell" style="font-size:36px; color:var(--text-muted); margin-bottom:12px;"></i>
        <h2 style="font-size:20px; font-weight:700; margin-bottom:6px;">No Workout Scheduled</h2>
        <p style="font-size:14px; color:var(--text-secondary); max-width:440px; margin:0 auto 20px;">
          You don't have a workout plan scheduled for this day yet. Choose a workout routine in the planner to get started.
        </p>
        <a href="/workouts" class="btn btn-primary">
          <i class="fa-solid fa-calendar-plus"></i> Go to Workout Planner
        </a>
      </div>
    `;
  }
}

function startStopwatch() {
  stopwatchSeconds = 0;
  clearInterval(stopwatchTimer);
  stopwatchTimer = setInterval(() => {
    stopwatchSeconds++;
    const mins = Math.floor(stopwatchSeconds / 60);
    const secs = stopwatchSeconds % 60;
    const disp = document.getElementById("activeWorkoutStopwatch");
    if (disp) {
      disp.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
  }, 1000);
}

function renderActiveExercises() {
  const listEl = document.getElementById("activeExercisesList");
  if (!listEl || !activePlanData) return;

  const unit = activePlanData.unit_preference || "kg";

  listEl.innerHTML = (activePlanData.exercises || []).map((ex, exIdx) => {
    let setRows = "";
    const setsCount = ex.target_sets || 3;
    for (let s = 1; s <= setsCount; s++) {
      setRows += `
        <div class="set-row active-set-row" data-ex-idx="${exIdx}">
          <div style="font-weight:600; color:var(--text-secondary); text-align:center;">${s}</div>
          <div style="color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ex.target_reps} reps</div>
          <div>
            <input type="number" step="0.5" class="form-input set-weight-input" value="${ex.last_weight || 20}" style="width:100%; max-width:85px; height:34px; padding:0 6px;">
          </div>
          <div>
            <input type="number" class="form-input set-reps-input" value="${ex.last_reps || 10}" min="1" max="100" style="width:100%; max-width:75px; height:34px; padding:0 6px;">
          </div>
          <div style="display:flex; justify-content:center; align-items:center;">
            <input type="checkbox" class="set-checkbox" checked style="width:18px; height:18px; accent-color:var(--status-completed); cursor:pointer;" onchange="updateActiveProgress()">
          </div>
        </div>
      `;
    }

    return `
      <div class="card active-exercise-card" style="margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <h3 style="font-size:16px; font-weight:700;">${ex.exercise_name}</h3>
          <button class="btn btn-sm btn-secondary" onclick="startRestCountdown(${ex.rest_seconds || 90})">
            <i class="fa-solid fa-hourglass-half" style="color:var(--accent-purple);"></i> Rest ${ex.rest_seconds || 90}s
          </button>
        </div>
        <div class="table-responsive-wrapper">
          <div class="set-table-header">
            <div style="text-align:center;">Set</div>
            <div>Target</div>
            <div>Weight (${unit})</div>
            <div>Reps Done</div>
            <div style="text-align:center;">Done</div>
          </div>
          ${setRows}
        </div>
      </div>
    `;
  }).join("");

  updateActiveProgress();
}

function updateActiveProgress() {
  const allChecks = document.querySelectorAll(".set-checkbox");
  const checked = document.querySelectorAll(".set-checkbox:checked");
  const total = allChecks.length;
  const done = checked.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const countEl = document.getElementById("activeExerciseProgressText");
  const barEl = document.getElementById("activeWorkoutProgressBar");
  if (countEl) countEl.textContent = `${done} of ${total} sets completed`;
  if (barEl) barEl.style.width = `${pct}%`;
}

function startRestCountdown(seconds) {
  restRemainingSeconds = seconds;
  clearInterval(restInterval);
  updateRestTimerDisplay();

  const bar = document.getElementById("activeRestTimerFloating");
  if (bar) bar.style.display = "flex";

  restInterval = setInterval(() => {
    if (restRemainingSeconds > 0) {
      restRemainingSeconds--;
      updateRestTimerDisplay();
    } else {
      clearInterval(restInterval);
      HabitFit.toast("Rest time finished! Ready for next set.");
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("HabitFit: Rest Complete", { body: "Time to start your next set!" });
      }
    }
  }, 1000);
}

function pauseRestCountdown() {
  clearInterval(restInterval);
}

function resetRestCountdown(sec = 90) {
  clearInterval(restInterval);
  restRemainingSeconds = sec;
  updateRestTimerDisplay();
}

function updateRestTimerDisplay() {
  const m = Math.floor(restRemainingSeconds / 60);
  const s = restRemainingSeconds % 60;
  const el = document.getElementById("floatingRestTimerText");
  if (el) el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function finishActiveWorkoutSession() {
  if (!confirm("Ready to complete and log this workout session?")) return;

  clearInterval(stopwatchTimer);
  clearInterval(restInterval);

  const durationMins = Math.max(1, Math.round(stopwatchSeconds / 60));
  const exercisesPayload = [];

  const cards = document.querySelectorAll(".active-exercise-card");
  cards.forEach((card, exIdx) => {
    const exObj = activePlanData.exercises[exIdx];
    const sets = [];
    const rows = card.querySelectorAll(".active-set-row");
    rows.forEach(r => {
      sets.push({
        target_reps: exObj.target_reps,
        weight: parseFloat(r.querySelector(".set-weight-input")?.value || "0"),
        reps_completed: parseInt(r.querySelector(".set-reps-input")?.value || "10", 10),
        completed: r.querySelector(".set-checkbox")?.checked ? 1 : 0,
      });
    });
    exercisesPayload.push({
      exercise_name: exObj.exercise_name,
      sets: sets,
    });
  });

  const payload = {
    plan_id: activePlanData.id,
    workout_name: activePlanData.workout_name,
    duration_minutes: durationMins,
    notes: "Completed in active workout logger.",
    exercises: exercisesPayload,
  };

  const res = await HabitFit.api("/api/workouts/finish", { method: "POST", body: payload });
  HabitFit.toast(res.message);

  setTimeout(() => {
    window.location.href = "/progress";
  }, 1200);
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("workoutWeekScheduleGrid")) loadWorkoutPlanner();
});
