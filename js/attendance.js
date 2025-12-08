const supaHours = getSupabase();

async function loadHoursView() {
  await requireAuth();
  showLoader();

  const { data: userRes } = await supaHours.auth.getUser();
  const userId = userRes.user.id;

  const childSelect = document.getElementById("hoursChildSelect");
  const monthInput = document.getElementById("hoursMonth");
  const periodLabel = document.getElementById("periodLabel");
  const hoursTotalEl = document.getElementById("hoursTotal");
  const hoursDaysEl = document.getElementById("hoursDays");
  const tableBody = document.querySelector("#hoursTable tbody");
  const csvBtn = document.getElementById("hoursCsv");
  const pdfBtn = document.getElementById("hoursPdf");

  let lastGroupedRows = [];
  let lastStart = null;
  let lastEnd = null;
  let lastChildLabel = "All kids";

  const { data: kids } = await supaHours
    .from("children")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  (kids || []).forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    childSelect.appendChild(opt);
  });

  // default to current month
  const today = new Date();
  const monthValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  monthInput.value = monthValue;

  async function refresh() {
    const selChild = childSelect.value;
    const [year, month] = monthInput.value.split("-");
    const start = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1);

    const startIso = start.toISOString().slice(0, 10);
    const endIso = end.toISOString().slice(0, 10);

    const { data: events } = await supaHours
      .from("events")
      .select("date, child, subject, duration_minutes")
      .eq("user_id", userId)
      .gte("date", startIso)
      .lte("date", endIso)
      .order("date", { ascending: true });

    const rows = {};
    (events || []).forEach(ev => {
      if (selChild !== "all" && ev.child !== selChild) return;
      const key = `${ev.date}::${ev.child}`;
      if (!rows[key]) {
        rows[key] = {
          date: ev.date,
          child: ev.child,
          minutes: 0,
          subjects: new Set()
        };
      }
      const dur = ev.duration_minutes || 60;
      rows[key].minutes += dur;
      if (ev.subject) rows[key].subjects.add(ev.subject);
    });

    const grouped = Object.values(rows);
    const totalMinutes = grouped.reduce((acc, r) => acc + r.minutes, 0);
    const days = new Set(grouped.map(r => r.date)).size;

    hoursTotalEl.textContent = (totalMinutes / 60).toFixed(1);
    hoursDaysEl.textContent = days;
    periodLabel.textContent = `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;

    lastGroupedRows = grouped;
    lastStart = start;
    lastEnd = end;
    lastChildLabel = selChild === "all" ? "All kids" : selChild;

    tableBody.innerHTML = "";
    grouped.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding:0.35rem 0.5rem;">${new Date(r.date).toLocaleDateString()}</td>
        <td style="padding:0.35rem 0.5rem;">${r.child || ""}</td>
        <td style="padding:0.35rem 0.5rem;">${r.minutes}</td>
        <td style="padding:0.35rem 0.5rem;">${Array.from(r.subjects).join(", ")}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  childSelect.addEventListener("change", refresh);
  monthInput.addEventListener("change", refresh);

  if (csvBtn) {
    csvBtn.addEventListener("click", () => {
      if (!lastGroupedRows.length) {
        alert("No attendance data for this period.");
        return;
      }
      const lines = [
        ["Date", "Child", "Minutes", "Hours", "Subjects"].join(",")
      ];
      lastGroupedRows.forEach(r => {
        const date = new Date(r.date).toLocaleDateString();
        const mins = r.minutes;
        const hrs = (mins / 60).toFixed(2);
        const subjects = Array.from(r.subjects).join(" ; ");
        lines.push(
          `"${date}","${r.child || ""}",${mins},${hrs},"${subjects.replace(/"/g, '""')}"`
        );
      });
      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "attendance.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener("click", () => {
      if (!lastGroupedRows.length) {
        alert("No attendance data for this period.");
        return;
      }
      const win = window.open("", "_blank");
      const logo = "🌿 Homeschool Planner";
      const periodText = periodLabel.textContent || "";
      const childText = lastChildLabel;

      const rowsHtml = lastGroupedRows
        .map(r => {
          const date = new Date(r.date).toLocaleDateString();
          const mins = r.minutes;
          const hrs = (mins / 60).toFixed(2);
          const subjects = Array.from(r.subjects).join(", ");
          return `<tr>
            <td>${date}</td>
            <td>${r.child || ""}</td>
            <td>${mins}</td>
            <td>${hrs}</td>
            <td>${subjects}</td>
          </tr>`;
        })
        .join("");

      win.document.write(`
        <html>
          <head>
            <title>Attendance Report</title>
            <style>
              body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; }
              h1 { margin: 0 0 4px 0; }
              h2 { margin: 12px 0 4px 0; font-size: 1.1rem; }
              p { margin: 2px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              th, td { border: 1px solid #d1d5db; padding: 4px 6px; font-size: 0.85rem; }
              th { background: #f3f4f6; }
            </style>
          </head>
          <body>
            <h1>${logo}</h1>
            <p><strong>Attendance report</strong></p>
            <p><strong>Child:</strong> ${childText}</p>
            <p><strong>Period:</strong> ${periodText}</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Child</th>
                  <th>Minutes</th>
                  <th>Hours</th>
                  <th>Subjects</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
      win.print();
    });
  }

  await refresh();
  hideLoader();
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadHoursView();
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;
});
