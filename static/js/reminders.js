/**
 * HABITFIT — Reminders Logic (reminders.js)
 * Manages Upcoming vs Completed/Past reminders, scheduling, switches, and browser notifications.
 */

let remindersCache = [];

async function loadRemindersPage() {
  const upContainer = document.getElementById("upcomingRemindersList");
  const pastContainer = document.getElementById("pastRemindersList");
  if (!upContainer || !pastContainer) return;

  try {
    const data = await HabitFit.api("/api/reminders");
    remindersCache = data.all_reminders || [];

    renderReminderGroup(upContainer, data.upcoming, "No upcoming reminders scheduled.");
    renderReminderGroup(pastContainer, data.completed_or_past, "No disabled or past reminders.");
  } catch (err) {
    console.error("Error loading reminders:", err);
  }
}

function renderReminderGroup(container, items, emptyText) {
  if (!items || items.length === 0) {
    container.innerHTML = `<p style="color:var(--text-secondary); font-size:13px; padding:12px 0;">${emptyText}</p>`;
    return;
  }

  container.innerHTML = items.map(r => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border:1px solid var(--border-color); border-radius:var(--radius-sm); margin-bottom:8px; background:var(--bg-card);">
      <div>
        <div style="font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px;">
          <span>${r.title}</span>
          ${r.related_type !== 'none' ? `<span class="badge-pill">${r.related_type}</span>` : ''}
        </div>
        <div style="font-size:12.5px; color:var(--text-secondary); margin-top:2px;">
          <i class="fa-regular fa-clock"></i> ${r.reminder_time} • Repeat: ${r.repeat_schedule}
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <label style="position:relative; display:inline-block; width:36px; height:20px; cursor:pointer;">
          <input type="checkbox" ${r.is_enabled ? 'checked' : ''} onchange="toggleReminderSwitch(${r.id}, this.checked)" style="opacity:0; width:0; height:0;">
          <span style="position:absolute; inset:0; background-color:${r.is_enabled ? 'var(--status-completed)' : '#CBD5E1'}; border-radius:34px; transition:0.2s;">
            <span style="position:absolute; height:14px; width:14px; left:${r.is_enabled ? '18px' : '3px'}; bottom:3px; background-color:white; border-radius:50%; transition:0.2s;"></span>
          </span>
        </label>
        <button class="btn btn-sm btn-danger-outline" onclick="deleteReminderItem(${r.id})" title="Delete">
          <i class="fa-solid fa-trash" style="font-size:11px;"></i>
        </button>
      </div>
    </div>
  `).join("");
}

async function toggleReminderSwitch(remId, isEnabled) {
  await HabitFit.api(`/api/reminders/${remId}`, {
    method: "PUT",
    body: { is_enabled: isEnabled ? 1 : 0 }
  });
  HabitFit.toast(isEnabled ? "Reminder enabled." : "Reminder disabled.");
  await loadRemindersPage();
}

function openAddReminderModal() {
  document.getElementById("remModalTitle").value = "";
  document.getElementById("remModalType").value = "none";
  document.getElementById("remModalTime").value = "08:00";
  document.getElementById("remModalRepeat").value = "daily";
  HabitFit.openModal("addReminderModalDialog");
}

async function submitReminderForm(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById("remModalTitle").value.trim(),
    related_type: document.getElementById("remModalType").value,
    reminder_time: document.getElementById("remModalTime").value,
    repeat_schedule: document.getElementById("remModalRepeat").value,
  };

  if (!payload.title) {
    HabitFit.toast("Title is required.", "error");
    return;
  }

  await HabitFit.api("/api/reminders", { method: "POST", body: payload });
  HabitFit.toast("Reminder scheduled.");
  HabitFit.closeModal("addReminderModalDialog");
  await loadRemindersPage();
}

async function deleteReminderItem(remId) {
  if (confirm("Delete this reminder?")) {
    await HabitFit.api(`/api/reminders/${remId}`, { method: "DELETE" });
    HabitFit.toast("Reminder deleted.");
    await loadRemindersPage();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("upcomingRemindersList")) {
    loadRemindersPage();
  }
});
