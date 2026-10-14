/**
 * HABITFIT — Progress & Analytics Logic (progress.js)
 * Manages 7d/30d/90d filters, Habit Consistency Line Chart, Exercise Performance Chart, and Workout History table.
 */

let habitConsistencyChart = null;
let workoutPerformanceChart = null;
let progressDataCache = null;

async function loadProgressPage(days = 30, btnEl = null) {
  if (btnEl) {
    document.querySelectorAll(".prog-filter-tab").forEach(b => b.classList.remove("active"));
    btnEl.classList.add("active");
  }

  try {
    const data = await HabitFit.api(`/api/progress?range=${days}`);
    progressDataCache = data;

    // Update 4 Summary Cards
    const s = data.summary;
    const sessEl = document.getElementById("progSessionsCompleted");
    const rateEl = document.getElementById("progHabitRate");
    const durEl = document.getElementById("progTotalDuration");
    const streakEl = document.getElementById("progCurrentStreak");

    if (sessEl) sessEl.textContent = s.sessions_completed;
    if (rateEl) rateEl.textContent = `${s.habit_completion_rate}%`;
    if (durEl) durEl.textContent = `${s.total_duration_minutes}m`;
    if (streakEl) streakEl.textContent = `${s.current_streak} days`;

    renderHabitConsistencyChart(data.habit_chart);
    populateExerciseSelector(data.available_exercises);
    renderRecentHistoryTable(data.history);
  } catch (err) {
    console.error("Error loading progress:", err);
  }
}

function renderHabitConsistencyChart(chartData) {
  const canvas = document.getElementById("habitConsistencyChartCanvas");
  if (!canvas || !window.Chart) return;

  if (habitConsistencyChart) habitConsistencyChart.destroy();

  habitConsistencyChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: chartData.labels,
      datasets: [{
        label: "Habit Completion (%)",
        data: chartData.values,
        borderColor: "#6C63FF",
        backgroundColor: "rgba(108, 99, 255, 0.08)",
        borderWidth: 2.5,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: "#6C63FF",
        pointRadius: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Completion: ${ctx.parsed.y}%`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#758096", font: { size: 11 } }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: "#E8ECF2" },
          ticks: {
            color: "#758096",
            font: { size: 11 },
            callback: (v) => `${v}%`
          }
        }
      }
    }
  });
}

function populateExerciseSelector(exercises) {
  const select = document.getElementById("exerciseProgressSelect");
  if (!select) return;

  if (!exercises || exercises.length === 0) {
    select.innerHTML = `<option value="">No workout history recorded</option>`;
    if (workoutPerformanceChart) {
      workoutPerformanceChart.destroy();
      workoutPerformanceChart = null;
    }
    const canvas = document.getElementById("workoutPerformanceChartCanvas");
    if (canvas && window.Chart) {
      workoutPerformanceChart = new Chart(canvas, {
        type: "line",
        data: {
          labels: ["Day 1", "Day 7", "Day 14", "Day 21", "Day 30"],
          datasets: [{
            label: "Weight",
            data: [0, 0, 0, 0, 0],
            borderColor: "#CBD5E1",
            borderDash: [5, 5],
            borderWidth: 1.5,
            fill: false,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: "#94A3B8" } },
            y: { beginAtZero: true, suggestedMax: 50, grid: { color: "#E8ECF2" }, ticks: { color: "#94A3B8", callback: v => `${v} kg` } }
          }
        }
      });
    }
    return;
  }

  select.innerHTML = exercises.map(name => `<option value="${name}">${name}</option>`).join("");
  renderExercisePerformanceChart(exercises[0]);
}

function renderExercisePerformanceChart(exerciseName) {
  const canvas = document.getElementById("workoutPerformanceChartCanvas");
  if (!canvas || !window.Chart || !progressDataCache) return;

  const pts = progressDataCache.exercise_progression[exerciseName] || [];

  if (workoutPerformanceChart) workoutPerformanceChart.destroy();

  workoutPerformanceChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: pts.map(p => p.date),
      datasets: [{
        label: `${exerciseName} Weight`,
        data: pts.map(p => p.weight),
        borderColor: "#16A779",
        backgroundColor: "rgba(22, 167, 121, 0.08)",
        borderWidth: 2.5,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: "#16A779",
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Max Weight: ${ctx.parsed.y} kg`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#758096", font: { size: 11 } }
        },
        y: {
          beginAtZero: false,
          grid: { color: "#E8ECF2" },
          ticks: {
            color: "#758096",
            font: { size: 11 },
            callback: (v) => `${v} kg`
          }
        }
      }
    }
  });
}

function renderRecentHistoryTable(history) {
  const tbody = document.getElementById("recentWorkoutsTableBody");
  if (!tbody) return;

  if (!history || history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:32px 16px; color:var(--text-secondary);"><i class="fa-solid fa-dumbbell" style="font-size:24px; color:var(--text-muted); margin-bottom:8px; display:block;"></i>No workout sessions logged yet.<br><small style="color:var(--text-muted);">Complete and finish a workout session to see your logged exercises and weights here.</small></td></tr>`;
    return;
  }

  tbody.innerHTML = history.map(w => `
    <tr style="border-bottom:1px solid var(--border-color); font-size:13px;">
      <td style="padding:12px 10px; font-weight:600;">${w.session_date}</td>
      <td style="padding:12px 10px;">${w.workout_name}</td>
      <td style="padding:12px 10px; color:var(--text-secondary);">${w.duration_minutes} mins</td>
      <td style="padding:12px 10px;">
        <span class="badge-pill">${w.exercise_count || 1} exercises</span>
      </td>
      <td style="padding:12px 10px; color:var(--text-secondary); font-size:12px;">
        ${w.notes || 'Strict form'}
      </td>
    </tr>
  `).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("habitConsistencyChartCanvas")) {
    loadProgressPage(30);
  }
});
