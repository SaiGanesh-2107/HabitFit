/**
 * HABITFIT — Daily Habits Logic (habits.js)
 * Manages habit creation, completion toggle, filters, streak counts, and date picker.
 */

let habitsCache = [];
let currentFilter = "all";
let selectedHabitDate = new Date().toISOString().slice(0, 10);

async function loadHabitsPage() {
  const container = document.getElementById("habitsListTable");
  if (!container) return;

  const datePicker = document.getElementById("habitDateSelector");
  if (datePicker && datePicker.value) {
    selectedHabitDate = datePicker.value;
  }

  try {
    const data = await HabitFit.api(`/api/habits?date=${selectedHabitDate}&status=${currentFilter}`);
    habitsCache = data.habits || [];

    // Update compact summary card
    const compEl = document.getElementById("habitsSummaryCompleted");
    const totalEl = document.getElementById("habitsSummaryTotal");
    const pctEl = document.getElementById("habitsSummaryPct");
    const barEl = document.getElementById("habitsSummaryBar");

    if (compEl) compEl.textContent = data.summary.completed;
    if (totalEl) totalEl.textContent = data.summary.total;
    if (pctEl) pctEl.textContent = `${data.summary.percentage}%`;
    if (barEl) barEl.style.width = `${data.summary.percentage}%`;

    renderHabitsList();
  } catch (err) {
    console.error("Error loading habits:", err);
  }
}

function setHabitFilter(filterType, btnEl) {
  currentFilter = filterType;
  document.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  loadHabitsPage();
}

function renderHabitsList() {
  const container = document.getElementById("habitsListTable");
  if (!container) return;

  if (habitsCache.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:var(--text-secondary);">
        <i class="fa-solid fa-clipboard-check" style="font-size:32px; color:var(--text-muted); margin-bottom:12px;"></i>
        <h4 style="font-size:16px; font-weight:700; color:var(--text-primary); margin-bottom:4px;">No habits added yet</h4>
        <p style="font-size:13.5px; max-width:360px; margin:0 auto 16px;">
          Build good daily routines and stay consistent by tracking your first activity.
        </p>
        <button class="btn btn-sm btn-primary" onclick="openAddHabitModal()">
          <i class="fa-solid fa-plus"></i> Add Your First Habit
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = habitsCache.map(h => `
    <div class="habit-row ${h.completed_today ? 'completed' : ''}" id="habit-row-${h.id}">
      <div class="habit-left">
        <button class="checkbox-btn" onclick="toggleHabitItem(${h.id})" title="Toggle completion">
          <i class="fa-solid fa-check"></i>
        </button>
        <div>
          <div class="habit-info-name">${h.name}</div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:2px;">
            <span class="badge-pill">${h.category}</span>
            <span class="habit-meta-time"><i class="fa-regular fa-clock"></i> ${h.reminder_time || 'Daily'}</span>
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:16px;">
        <span class="habit-streak-badge" title="Consecutive day streak">
          <i class="fa-solid fa-fire"></i> ${h.current_streak} days
        </span>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm btn-secondary" onclick="openEditHabitModal(${h.id})" title="Edit">
            <i class="fa-solid fa-pen" style="font-size:11px;"></i>
          </button>
          <button class="btn btn-sm btn-danger-outline" onclick="deleteHabitItem(${h.id}, '${h.name.replace(/'/g, "\\'")}')" title="Delete">
            <i class="fa-solid fa-trash" style="font-size:11px;"></i>
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

async function toggleHabitItem(habitId) {
  try {
    const res = await HabitFit.api(`/api/habits/${habitId}/toggle`, {
      method: "POST",
      body: { date: selectedHabitDate }
    });
    HabitFit.toast(res.message);
    await loadHabitsPage();
  } catch (_) {}
}

function openAddHabitModal() {
  document.getElementById("habitModalTitle").textContent = "Add Daily Habit";
  document.getElementById("habitModalId").value = "";
  document.getElementById("habitModalName").value = "";
  document.getElementById("habitModalCategory").value = "Health";
  document.getElementById("habitModalFrequency").value = "daily";
  document.getElementById("habitModalReminder").value = "08:00";
  document.getElementById("habitModalTargetVal").value = "1";
  document.getElementById("habitModalTargetUnit").value = "check";
  HabitFit.openModal("habitModalDialog");
}

function openEditHabitModal(habitId) {
  const h = habitsCache.find(x => x.id === habitId);
  if (!h) return;
  document.getElementById("habitModalTitle").textContent = "Edit Habit";
  document.getElementById("habitModalId").value = h.id;
  document.getElementById("habitModalName").value = h.name;
  document.getElementById("habitModalCategory").value = h.category;
  document.getElementById("habitModalFrequency").value = h.frequency;
  document.getElementById("habitModalReminder").value = h.reminder_time || "08:00";
  document.getElementById("habitModalTargetVal").value = h.target_value || 1;
  document.getElementById("habitModalTargetUnit").value = h.target_unit || "check";
  HabitFit.openModal("habitModalDialog");
}

async function submitHabitModalForm(e) {
  e.preventDefault();
  const id = document.getElementById("habitModalId").value;
  const payload = {
    name: document.getElementById("habitModalName").value.trim(),
    category: document.getElementById("habitModalCategory").value,
    frequency: document.getElementById("habitModalFrequency").value,
    reminder_time: document.getElementById("habitModalReminder").value,
    target_value: parseInt(document.getElementById("habitModalTargetVal").value || "1", 10),
    target_unit: document.getElementById("habitModalTargetUnit").value.trim() || "check",
  };

  if (!payload.name) {
    HabitFit.toast("Habit name is required.", "error");
    return;
  }

  if (id) {
    await HabitFit.api(`/api/habits/${id}`, { method: "PUT", body: payload });
    HabitFit.toast("Habit updated.");
  } else {
    await HabitFit.api("/api/habits", { method: "POST", body: payload });
    HabitFit.toast("New habit created.");
  }
  HabitFit.closeModal("habitModalDialog");
  if (document.getElementById("habitsListTable")) {
    await loadHabitsPage();
  } else if (typeof loadDashboardView === "function") {
    await loadDashboardView();
  }
}

async function deleteHabitItem(habitId, name) {
  if (confirm(`Are you sure you want to delete "${name}"?`)) {
    await HabitFit.api(`/api/habits/${habitId}`, { method: "DELETE" });
    HabitFit.toast("Habit deleted.");
    if (document.getElementById("habitsListTable")) {
      await loadHabitsPage();
    } else if (typeof loadDashboardView === "function") {
      await loadDashboardView();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("habitsListTable")) {
    loadHabitsPage();
  }
});
