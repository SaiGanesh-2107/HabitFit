/**
 * HABITFIT — Core Application JavaScript (app.js)
 * Clean API wrapper, Toast notifications, Modals, Theme toggling, and Reminder checker.
 */

const HabitFit = {
  async api(url, options = {}) {
    const config = {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    };
    if (config.body && typeof config.body === "object") {
      config.body = JSON.stringify(config.body);
    }
    try {
      const res = await fetch(url, config);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      return data;
    } catch (err) {
      HabitFit.toast(err.message || "An error occurred", "error");
      throw err;
    }
  },

  toast(message, type = "success") {
    let shelf = document.getElementById("toastShelf");
    if (!shelf) {
      shelf = document.createElement("div");
      shelf.id = "toastShelf";
      shelf.className = "toast-shelf";
      document.body.appendChild(shelf);
    }

    const item = document.createElement("div");
    item.className = "toast-msg";
    const icon = type === "error" ? "fa-circle-exclamation" : "fa-circle-check";
    const iconColor = type === "error" ? "var(--status-danger)" : "var(--status-completed)";

    item.innerHTML = `
      <i class="fa-solid ${icon}" style="color:${iconColor}; font-size:15px;"></i>
      <span>${message}</span>
    `;
    shelf.appendChild(item);

    setTimeout(() => {
      item.style.opacity = "0";
      item.style.transition = "opacity 0.25s ease";
      setTimeout(() => item.remove(), 250);
    }, 3800);
  },

  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add("open");
  },

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove("open");
  },

  toggleMobileDrawer() {
    const sidebar = document.getElementById("appSidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (!sidebar) return;
    const isOpen = sidebar.classList.contains("drawer-open");
    if (isOpen) {
      this.closeMobileDrawer();
    } else {
      sidebar.classList.add("drawer-open");
      if (overlay) overlay.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  },

  closeMobileDrawer() {
    const sidebar = document.getElementById("appSidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) sidebar.classList.remove("drawer-open");
    if (overlay) overlay.classList.remove("active");
    document.body.style.overflow = "";
  },

  async toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    localStorage.setItem("habitfit_theme", next);

    try {
      await fetch("/api/settings/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
    } catch (_) {}
  },

  async requestNotificationPermission() {
    if (!("Notification" in window)) {
      HabitFit.toast("Browser notifications are not supported in this browser.", "error");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      HabitFit.toast("Browser notifications enabled! Live reminders will alert when tab is active.");
      new Notification("HabitFit Reminders Active", {
        body: "You will receive reminders for scheduled habits and workouts.",
      });
    } else {
      HabitFit.toast("Notification permission was denied. In-app reminders will still work.", "error");
    }
  },

  async checkActiveReminders() {
    try {
      const res = await fetch("/api/reminders");
      if (!res.ok) return;
      const data = await res.json();
      const upcoming = data.upcoming || [];

      const listEl = document.getElementById("headerNotifList");
      const badgeEl = document.getElementById("headerUnreadBadge");

      if (badgeEl) {
        badgeEl.textContent = upcoming.length;
        badgeEl.style.display = upcoming.length > 0 ? "inline-block" : "none";
      }

      if (listEl) {
        if (upcoming.length === 0) {
          listEl.innerHTML = `<p style="color:var(--text-secondary); font-size:12.5px; text-align:center; padding:12px 0;">No upcoming reminders.</p>`;
        } else {
          listEl.innerHTML = upcoming.slice(0, 5).map(r => `
            <div style="padding:8px 0; border-bottom:1px solid var(--border-color); font-size:12.5px;">
              <div style="display:flex; justify-content:space-between; font-weight:600;">
                <span>${r.title}</span>
                <span style="color:var(--accent-purple);">${r.reminder_time}</span>
              </div>
              <span style="color:var(--text-secondary); font-size:11px;">Repeat: ${r.repeat_schedule}</span>
            </div>
          `).join("");
        }
      }

      // Check current minute for trigger
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5);
      const todayStr = now.toISOString().slice(0, 10);
      const firedKey = `hf_alert_${todayStr}_${hhmm}`;

      if (!sessionStorage.getItem(firedKey)) {
        upcoming.forEach(r => {
          if (r.reminder_time === hhmm) {
            sessionStorage.setItem(firedKey, "1");
            HabitFit.toast(`Reminder: ${r.title}`);
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`HabitFit: ${r.title}`, { body: `Scheduled at ${r.reminder_time}` });
            }
          }
        });
      }
    } catch (_) {}
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Notification bell toggle
  const notifBtn = document.getElementById("headerNotifBtn");
  const popover = document.getElementById("headerNotifPopover");
  if (notifBtn && popover) {
    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      popover.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!popover.contains(e.target) && e.target !== notifBtn) {
        popover.classList.remove("open");
      }
    });
  }

  // Close modals on backdrop click
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("open");
    });
  });

  // Close mobile drawer when a nav item is clicked
  document.querySelectorAll(".sidebar-nav a").forEach(link => {
    link.addEventListener("click", () => {
      HabitFit.closeMobileDrawer();
    });
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      HabitFit.closeMobileDrawer();
      document.querySelectorAll(".modal-overlay.open").forEach(modal => {
        modal.classList.remove("open");
      });
      if (popover) popover.classList.remove("open");
    }
  });

  // Check reminders
  HabitFit.checkActiveReminders();
  setInterval(() => HabitFit.checkActiveReminders(), 30000);
});
