const supaAssess = getSupabase();

async function loadAssessmentsView() {
  await requireAuth();
  showLoader();

  const { data: userRes } = await supaAssess.auth.getUser();
  const userId = userRes.user.id;

  const childSelect = document.getElementById("assessChild");
  const subjectSelect = document.getElementById("assessSubject");
  const dateInput = document.getElementById("assessDate");
  const titleInput = document.getElementById("assessTitle");
  const typeSelect = document.getElementById("assessType");
  const scoreInput = document.getElementById("assessScore");
  const outOfInput = document.getElementById("assessOutOf");
  const notesInput = document.getElementById("assessNotes");
  const fileInput = document.getElementById("assessFile");
  const saveBtn = document.getElementById("saveAssessment");

  const filterChildSelect = document.getElementById("assessFilterChild");
  const monthInput = document.getElementById("assessMonth");
  const periodLabel = document.getElementById("assessPeriodLabel");
  const tableBody = document.querySelector("#assessTable tbody");
  const tableEl = document.getElementById("assessTable");
  const reportBtn = document.getElementById("assessReportBtn");
  const reportYearInput = document.getElementById("assessReportYear");
  const reportRangeSelect = document.getElementById("assessReportRange");
  const reportCommentInput = document.getElementById("assessReportComment");
  const reportDecisionSelect = document.getElementById("assessReportDecision");

  const { data: kids } = await supaAssess
    .from("children")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  const kidGradeByName = new Map();
  (kids || []).forEach(c => {
    if (c.name) {
      kidGradeByName.set(c.name, c.grade || "");
    }
    const opt1 = document.createElement("option");
    opt1.value = c.name;
    opt1.textContent = c.name;
    childSelect.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = c.name;
    opt2.textContent = c.name;
    filterChildSelect.appendChild(opt2);
  });

  const { data: subjects } = await supaAssess
    .from("subjects")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  (subjects || []).forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = s.name;
    subjectSelect.appendChild(opt);
  });

  // default dates
  const today = new Date();
  const monthValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  monthInput.value = monthValue;
  dateInput.value = today.toISOString().slice(0, 10);
  if (reportYearInput) {
    reportYearInput.value = today.getFullYear();
  }

  async function refreshTable() {
    const selChild = filterChildSelect.value;
    const [year, month] = monthInput.value.split("-");
    const start = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1);

    const startIso = start.toISOString().slice(0, 10);
    const endIso = end.toISOString().slice(0, 10);

    const { data: assessments } = await supaAssess
      .from("assessments")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startIso)
      .lte("date", endIso)
      .order("date", { ascending: true });

    const list = (assessments || []).filter(a =>
      selChild === "all" ? true : a.child === selChild
    );

    periodLabel.textContent = `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
    tableBody.innerHTML = "";
    if (!list.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td colspan="8" style="padding:0.6rem; font-size:0.85rem; color:#6b7280;">
          No assessments recorded for this child in the selected month.
        </td>
      `;
      tableBody.appendChild(tr);
      return;
    }
    list.forEach(a => {
      const tr = document.createElement("tr");
      const score =
        a.score != null && a.out_of != null
          ? `${a.score} / ${a.out_of}`
          : "";
      tr.innerHTML = `
        <td style="padding:0.35rem 0.5rem;">${new Date(a.date).toLocaleDateString()}</td>
        <td style="padding:0.35rem 0.5rem;">${a.child || ""}</td>
        <td style="padding:0.35rem 0.5rem;">${a.subject || ""}</td>
        <td style="padding:0.35rem 0.5rem;">${a.title || ""}</td>
        <td style="padding:0.35rem 0.5rem;">${a.type || ""}</td>
        <td style="padding:0.35rem 0.5rem;">${score}</td>
        <td style="padding:0.35rem 0.5rem;">
          ${a.proof_url ? `<a href="${a.proof_url}" target="_blank">Open</a>` : ""}
        </td>
        <td style="padding:0.35rem 0.5rem;">
          <button type="button" class="delete-assess-btn" data-id="${a.id}">Delete</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  saveBtn.onclick = async () => {
    const child = childSelect.value;
    const subject = subjectSelect.value;
    const date = dateInput.value;
    const title = titleInput.value.trim();
    const type = typeSelect.value;
    const score = scoreInput.value ? parseFloat(scoreInput.value) : null;
    const outOf = outOfInput.value ? parseFloat(outOfInput.value) : null;
    const notes = notesInput.value.trim();

    if (!child || !subject || !date || !title) {
      alert("Child, subject, date, and title are required.");
      return;
    }

    let proofUrl = null;
    if (fileInput && fileInput.files[0]) {
      const file = fileInput.files[0];
      const ts = Date.now();
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${userId}/assess-${ts}.${ext}`;
      const { error: uploadErr } = await supaAssess.storage.from("packs").upload(path, file, {
        upsert: true
      });
      if (uploadErr) {
        console.error(uploadErr);
        alert("Failed to upload assessment file.");
        return;
      }
      const { data: urlData } = supaAssess.storage.from("packs").getPublicUrl(path);
      proofUrl = urlData.publicUrl;
    }

    // optional duplicate check
    const { data: existing } = await supaAssess
      .from("assessments")
      .select("id")
      .eq("user_id", userId)
      .eq("child", child)
      .eq("subject", subject)
      .eq("date", date)
      .eq("title", title)
      .limit(1);

    if (existing && existing.length) {
      const proceed = window.confirm(
        "An assessment with the same child, subject, date, and title already exists. Save anyway?"
      );
      if (!proceed) {
        return;
      }
    }

    const { error } = await supaAssess
      .from("assessments")
      .insert({
        user_id: userId,
        child,
        subject,
        date,
        title,
        type,
        score,
        out_of: outOf,
        notes,
        proof_url: proofUrl
      });

    if (error) {
      console.error(error);
      window.showToast("Failed to save assessment.", "error");
      return;
    }

    titleInput.value = "";
    scoreInput.value = "";
    outOfInput.value = "";
    notesInput.value = "";
    if (fileInput) fileInput.value = "";

    await refreshTable();
    window.showToast("Assessment saved to log.", "success");
  };

  filterChildSelect.addEventListener("change", refreshTable);
  monthInput.addEventListener("change", refreshTable);

  if (tableEl) {
    tableEl.addEventListener("click", async (e) => {
      const btn = e.target.closest(".delete-assess-btn");
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;
      const ok = window.confirm("Delete this assessment record?");
      if (!ok) return;
      const { error } = await supaAssess
        .from("assessments")
        .delete()
        .eq("id", id);
      if (error) {
        console.error(error);
        window.showToast("Failed to delete assessment.", "error");
        return;
      }
      await refreshTable();
      window.showToast("Assessment deleted.", "success");
    });
  }

  if (reportBtn) {
    reportBtn.addEventListener("click", async () => {
      const selChild = filterChildSelect.value;
      if (selChild === "all" || !selChild) {
        alert("Please choose a specific child first to generate a school report.");
        return;
      }

       const overallComment = reportCommentInput
        ? reportCommentInput.value.trim()
        : "";
      const promotionDecision = reportDecisionSelect
        ? reportDecisionSelect.value
        : "none";

      const baseYear = reportYearInput && reportYearInput.value
        ? parseInt(reportYearInput.value, 10)
        : today.getFullYear();
      if (!baseYear || Number.isNaN(baseYear)) {
        alert("Please enter a valid year for the report.");
        return;
      }

      let start;
      let end;
      const range = reportRangeSelect ? reportRangeSelect.value : "year";

      if (range === "term1") {
        start = new Date(baseYear, 0, 1);   // Jan 1
        end = new Date(baseYear, 2, 31);    // Mar 31
      } else if (range === "term2") {
        start = new Date(baseYear, 3, 1);   // Apr 1
        end = new Date(baseYear, 5, 30);    // Jun 30
      } else if (range === "term3") {
        start = new Date(baseYear, 6, 1);   // Jul 1
        end = new Date(baseYear, 8, 30);    // Sep 30
      } else if (range === "term4") {
        start = new Date(baseYear, 9, 1);   // Oct 1
        end = new Date(baseYear, 11, 31);   // Dec 31
      } else {
        start = new Date(baseYear, 0, 1);
        end = new Date(baseYear, 11, 31);
      }

      const startIso = start.toISOString().slice(0, 10);
      const endIso = end.toISOString().slice(0, 10);

      const { data: assessments, error } = await supaAssess
        .from("assessments")
        .select("*")
        .eq("user_id", userId)
        .eq("child", selChild)
        .gte("date", startIso)
        .lte("date", endIso)
        .order("subject", { ascending: true })
        .order("date", { ascending: true });

      if (error) {
        console.error(error);
        alert("Could not load assessments for this report.");
        return;
      }

      const list = assessments || [];
      if (!list.length) {
        alert("No assessments found for this child in the selected period.");
        return;
      }

      const bySubject = new Map();
      const allPercents = [];

      list.forEach(a => {
        const subject = a.subject || "General";
        if (!bySubject.has(subject)) {
          bySubject.set(subject, []);
        }
        let percent = null;
        const hasScores =
          a.score != null &&
          a.out_of != null &&
          Number(a.out_of) > 0;
        if (hasScores) {
          percent = (Number(a.score) / Number(a.out_of)) * 100;
          allPercents.push(percent);
        }
        bySubject.get(subject).push({
          ...a,
          percent
        });
      });

      const overallAverage =
        allPercents.length
          ? allPercents.reduce((sum, p) => sum + p, 0) / allPercents.length
          : null;

      const childGrade = kidGradeByName.get(selChild) || "";
      const rangeLabel = (() => {
        if (range === "term1") return `Term 1 ${baseYear}`;
        if (range === "term2") return `Term 2 ${baseYear}`;
        if (range === "term3") return `Term 3 ${baseYear}`;
        if (range === "term4") return `Term 4 ${baseYear}`;
        return `Year ${baseYear}`;
      })();
      const periodText = `${rangeLabel} (${start.toLocaleDateString()} – ${end.toLocaleDateString()})`;

      // Attendance for same child and period
      const { data: events, error: eventsError } = await supaAssess
        .from("events")
        .select("date, child, duration_minutes, subject")
        .eq("user_id", userId)
        .eq("child", selChild)
        .gte("date", startIso)
        .lte("date", endIso)
        .order("date", { ascending: true });

      let attendanceHtml = "";
      if (!eventsError && events && events.length) {
        const byDate = {};
        (events || []).forEach(ev => {
          const key = ev.date;
          if (!byDate[key]) {
            byDate[key] = { date: ev.date, minutes: 0, subjects: new Set() };
          }
          const dur = ev.duration_minutes || 60;
          byDate[key].minutes += dur;
          if (ev.subject) byDate[key].subjects.add(ev.subject);
        });
        const rows = Object.values(byDate);
        const totalMinutes = rows.reduce((sum, r) => sum + r.minutes, 0);
        const totalHours = (totalMinutes / 60).toFixed(1);
        const daysCount = rows.length;

        const rowsHtml = rows
          .map(r => {
            const dateStr = new Date(r.date).toLocaleDateString();
            const mins = r.minutes;
            const hrs = (mins / 60).toFixed(2);
            const subjectsStr = Array.from(r.subjects).join(", ");
            return `<tr>
              <td>${dateStr}</td>
              <td>${mins}</td>
              <td>${hrs}</td>
              <td>${subjectsStr}</td>
            </tr>`;
          })
          .join("");

        attendanceHtml = `
          <h2>Attendance summary</h2>
          <p><strong>Total instructional hours:</strong> ${totalHours} hours</p>
          <p><strong>Days with learning logged:</strong> ${daysCount}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Minutes</th>
                <th>Hours</th>
                <th>Subjects</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      } else {
        attendanceHtml = `
          <h2>Attendance summary</h2>
          <p>No attendance records were logged for this period.</p>
        `;
      }

      // Teacher/parent summary and promotion decision
      const decisionLabel = (() => {
        if (promotionDecision === "promoted") return "Promoted to next grade";
        if (promotionDecision === "in_progress") return "Progressing, promotion decision pending";
        if (promotionDecision === "retained") return "Repeating current grade";
        return "";
      })();

      let summaryHtml = "<h2>Overall summary</h2>";
      if (overallComment) {
        summaryHtml += `<p><strong>Teacher/parent comment:</strong> ${overallComment}</p>`;
      }
      if (decisionLabel) {
        summaryHtml += `<p><strong>Promotion decision:</strong> ${decisionLabel}</p>`;
      }
      if (!overallComment && !decisionLabel) {
        summaryHtml += "<p>No overall comment or promotion decision recorded for this period.</p>";
      }

      let sectionsHtml = "";
      bySubject.forEach((rows, subject) => {
        const subjectPercents = rows
          .map(r => r.percent)
          .filter(p => p != null);
        const subjectAvg = subjectPercents.length
          ? subjectPercents.reduce((sum, p) => sum + p, 0) / subjectPercents.length
          : null;

        const rowsHtml = rows
          .map(r => {
            const dateStr = r.date ? new Date(r.date).toLocaleDateString() : "";
            const scoreStr =
              r.score != null && r.out_of != null
                ? `${r.score} / ${r.out_of}`
                : "";
            const pctStr =
              r.percent != null ? `${r.percent.toFixed(1)}%` : "";
            return `<tr>
              <td>${dateStr}</td>
              <td>${r.title || ""}</td>
              <td>${r.type || ""}</td>
              <td>${scoreStr}</td>
              <td>${pctStr}</td>
            </tr>`;
          })
          .join("");

        sectionsHtml += `
          <h3>${subject}</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Assessment</th>
                <th>Type</th>
                <th>Score</th>
                <th>Percent</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <p><strong>${subject} average:</strong> ${
            subjectAvg != null ? subjectAvg.toFixed(1) + "%" : "Not enough data"
          }</p>
        `;
      });

      const win = window.open("", "_blank");
      const logo = "🌿 Homeschool Planner";
      const overallText =
        overallAverage != null
          ? `${overallAverage.toFixed(1)}% (pass guideline: 50%)`
          : "Not enough data";

      win.document.write(`
        <html>
          <head>
            <title>School report – ${selChild}</title>
            <style>
              body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; color:#111827; }
              h1 { margin: 0 0 4px 0; font-size: 1.4rem; }
              h2 { margin: 16px 0 6px 0; font-size: 1.1rem; }
              h3 { margin: 12px 0 4px 0; font-size: 1rem; }
              p { margin: 2px 0; font-size: 0.9rem; }
              table { width: 100%; border-collapse: collapse; margin: 8px 0 16px 0; }
              th, td { border: 1px solid #d1d5db; padding: 4px 6px; font-size: 0.85rem; }
              th { background: #f3f4f6; }
              .meta { margin-bottom: 10px; }
            </style>
          </head>
          <body>
            <h1>${logo}</h1>
            <h2>Academic report</h2>
            <div class="meta">
              <p><strong>Learner:</strong> ${selChild}</p>
              <p><strong>Grade:</strong> ${childGrade || "—"}</p>
              <p><strong>Period:</strong> ${periodText}</p>
              <p><strong>Overall average (all subjects):</strong> ${overallText}</p>
              <p><strong>Parent/guardian contact:</strong> ${userRes.user.email || ""}</p>
            </div>
            ${summaryHtml}
            ${attendanceHtml}
            ${sectionsHtml}
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
      win.print();
    });
  }

  await refreshTable();
  hideLoader();
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadAssessmentsView();
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;
});
