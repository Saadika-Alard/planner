const supaPortfolio = getSupabase();

async function loadPortfolioView() {
  await requireAuth();
  showLoader();

  const { data: userRes } = await supaPortfolio.auth.getUser();
  const userId = userRes.user.id;

  const childSelect = document.getElementById("portfolioChild");
  const yearInput = document.getElementById("portfolioYear");
  const termSelect = document.getElementById("portfolioTerm");
  const refreshBtn = document.getElementById("portfolioRefresh");
  const periodLabel = document.getElementById("portfolioPeriodLabel");

  const hoursEl = document.getElementById("portfolioHours");
  const assessmentsEl = document.getElementById("portfolioAssessments");
  const topicsEl = document.getElementById("portfolioTopics");
  const overviewBody = document.getElementById("portfolioOverviewBody");

  const reportBtn = document.getElementById("portfolioReportBtn");
  const videosBtn = document.getElementById("portfolioVideosBtn");

  let children = [];
  let lastSnapshot = null;

  const { data: kidsData } = await supaPortfolio
    .from("children")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  children = kidsData || [];

  children.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.name}${c.grade ? " (" + c.grade + ")" : ""}`;
    childSelect.appendChild(opt);
  });

  const today = new Date();
  if (yearInput) yearInput.value = today.getFullYear();

  function computeRange(year, term) {
    const y = year;
    let start;
    let end;
    if (term === "term1") {
      start = new Date(y, 0, 1);
      end = new Date(y, 2, 31);
    } else if (term === "term2") {
      start = new Date(y, 3, 1);
      end = new Date(y, 5, 30);
    } else if (term === "term3") {
      start = new Date(y, 6, 1);
      end = new Date(y, 8, 30);
    } else if (term === "term4") {
      start = new Date(y, 9, 1);
      end = new Date(y, 11, 31);
    } else {
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31);
    }
    return { start, end };
  }

  async function refreshSnapshot() {
    const childId = childSelect.value;
    if (!childId) {
      overviewBody.innerHTML = "";
      hoursEl.textContent = "0";
      assessmentsEl.textContent = "0";
      topicsEl.textContent = "0";
      periodLabel.textContent = "";
      lastSnapshot = null;
      if (reportBtn) reportBtn.disabled = true;
      if (videosBtn) videosBtn.disabled = true;
      return;
    }

    const child = children.find(c => c.id === childId);
    const year = parseInt(yearInput.value || today.getFullYear(), 10);
    const term = termSelect.value;
    const { start, end } = computeRange(year, term);
    const startIso = start.toISOString().slice(0, 10);
    const endIso = end.toISOString().slice(0, 10);

    const periodText = `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
    const rangeLabel =
      term === "year"
        ? `Year ${year}`
        : `${term.toUpperCase()} ${year}`;
    periodLabel.textContent = `${rangeLabel} • ${periodText}`;

    // Attendance: events for child
    const { data: events } = await supaPortfolio
      .from("events")
      .select("date, duration_minutes")
      .eq("user_id", userId)
      .eq("child_id", childId)
      .gte("date", startIso)
      .lte("date", endIso);

    const attendanceRows = {};
    (events || []).forEach(ev => {
      const key = ev.date;
      if (!attendanceRows[key]) {
        attendanceRows[key] = { date: ev.date, minutes: 0 };
      }
      const dur = ev.duration_minutes || 60;
      attendanceRows[key].minutes += dur;
    });

    const attendanceList = Object.values(attendanceRows);
    const totalMinutes = attendanceList.reduce((sum, r) => sum + r.minutes, 0);
    const totalHours = totalMinutes / 60;

    // Assessments for child
    const { data: assessments } = await supaPortfolio
      .from("assessments")
      .select("*")
      .eq("user_id", userId)
      .eq("child", child?.name || "")
      .gte("date", startIso)
      .lte("date", endIso);

    // Curriculum topics for child
    const { data: topics } = await supaPortfolio
      .from("curriculum_items")
      .select("*")
      .eq("user_id", userId)
      .eq("year", year)
      .eq("child_id", childId);

    hoursEl.textContent = totalHours.toFixed(1);
    assessmentsEl.textContent = (assessments || []).length;
    topicsEl.textContent = (topics || []).length;

    overviewBody.innerHTML = "";
    const rows = [
      {
        section: "Attendance",
        summary: `${attendanceList.length} days with work • ${totalHours.toFixed(
          1
        )} hours total`
      },
      {
        section: "Assessments",
        summary: `${(assessments || []).length} recorded results`
      },
      {
        section: "Curriculum",
        summary: `${(topics || []).length} topics captured (${
          (topics || []).filter(t => t.status === "completed").length
        } completed)`
      }
    ];
    rows.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding:0.35rem 0.5rem;">${r.section}</td>
        <td style="padding:0.35rem 0.5rem;">${r.summary}</td>
      `;
      overviewBody.appendChild(tr);
    });

    lastSnapshot = {
      child,
      year,
      term,
      start,
      end,
      startIso,
      endIso,
      attendanceList,
      totalHours,
      assessments: assessments || [],
      topics: topics || []
    };
    if (reportBtn) reportBtn.disabled = false;
    if (videosBtn) videosBtn.disabled = false;
  }

  refreshBtn.addEventListener("click", refreshSnapshot);

  if (reportBtn) {
    reportBtn.addEventListener("click", async () => {
      if (!lastSnapshot || !lastSnapshot.child) {
        alert("Choose a child and update the view first.");
        return;
      }
      const { child, year, term, start, end, attendanceList, totalHours, assessments, topics } =
        lastSnapshot;

      // Group topics by subject
      const topicBySubject = new Map();
      (topics || []).forEach(t => {
        const subj = t.subject || "General";
        if (!topicBySubject.has(subj)) topicBySubject.set(subj, []);
        topicBySubject.get(subj).push(t);
      });

      // Group assessments by subject
      const assessBySubject = new Map();
      (assessments || []).forEach(a => {
        const subj = a.subject || "General";
        if (!assessBySubject.has(subj)) assessBySubject.set(subj, []);
        assessBySubject.get(subj).push(a);
      });

      function statusLabel(status) {
        if (status === "in_progress") return "In progress";
        if (status === "completed") return "Completed";
        return "Not started";
      }

      const rangeLabel =
        term === "year" ? `Year ${year}` : `${term.toUpperCase()} ${year}`;
      const periodText = `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;

      let curriculumSections = "";
      topicBySubject.forEach((rows, subject) => {
        const rowsHtml = rows
          .map(t => {
            return `<tr>
              <td>${t.term === "full_year" ? "Full year" : t.term || ""}</td>
              <td>${t.topic}</td>
              <td>${statusLabel(t.status)}</td>
            </tr>`;
          })
          .join("");
        curriculumSections += `
          <h3>${subject}</h3>
          <table>
            <thead>
              <tr>
                <th>Term</th>
                <th>Topic</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      });

      let assessmentSections = "";
      assessBySubject.forEach((rows, subject) => {
        const rowsHtml = rows
          .map(a => {
            const date = a.date ? new Date(a.date).toLocaleDateString() : "";
            const score =
              a.score != null && a.out_of != null
                ? `${a.score} / ${a.out_of}`
                : "";
            return `<tr>
              <td>${date}</td>
              <td>${a.title || ""}</td>
              <td>${a.type || ""}</td>
              <td>${score}</td>
            </tr>`;
          })
          .join("");
        assessmentSections += `
          <h3>${subject}</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Assessment</th>
                <th>Type</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      });

      const attendanceRowsHtml = attendanceList
        .map(r => {
          const date = new Date(r.date).toLocaleDateString();
          const mins = r.minutes;
          const hrs = (mins / 60).toFixed(2);
          return `<tr>
            <td>${date}</td>
            <td>${mins}</td>
            <td>${hrs}</td>
          </tr>`;
        })
        .join("");

      const win = window.open("", "_blank");
      const logo = "🌿 Homeschool Planner";

      win.document.write(`
        <html>
          <head>
            <title>Portfolio – ${child.name}</title>
            <style>
              body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; color:#111827; }
              h1 { margin: 0 0 4px 0; font-size: 1.4rem; }
              h2 { margin: 16px 0 6px 0; font-size: 1.1rem; }
              h3 { margin: 12px 0 4px 0; font-size: 1rem; }
              p { margin: 2px 0; font-size: 0.9rem; }
              table { width: 100%; border-collapse: collapse; margin: 8px 0 16px 0; }
              th, td { border: 1px solid #d1d5db; padding: 4px 6px; font-size: 0.85rem; }
              th { background: #f3f4f6; }
            </style>
          </head>
          <body>
            <h1>${logo}</h1>
            <h2>Learner portfolio</h2>
            <p><strong>Learner:</strong> ${child.name}${child.grade ? " (" + child.grade + ")" : ""}</p>
            <p><strong>Period:</strong> ${rangeLabel} (${periodText})</p>
            <hr />
            <h2>Attendance</h2>
            <p><strong>Total hours:</strong> ${totalHours.toFixed(
              1
            )} hours</p>
            <p><strong>Days with work:</strong> ${attendanceList.length}</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Minutes</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                ${attendanceRowsHtml}
              </tbody>
            </table>
            <h2>Curriculum coverage</h2>
            ${curriculumSections}
            <h2>Assessments</h2>
            ${assessmentSections}
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
      win.print();
    });
  }

  if (videosBtn) {
    videosBtn.addEventListener("click", async () => {
      if (!lastSnapshot || !lastSnapshot.child) {
        alert("Choose a child and update the view first.");
        return;
      }
      if (typeof JSZip === "undefined") {
        alert("Zip library not loaded. Please check your connection and try again.");
        return;
      }
      const { child, year, term, startIso, endIso } = lastSnapshot;

      const { data: topics } = await supaPortfolio
        .from("curriculum_items")
        .select("id")
        .eq("user_id", userId)
        .eq("year", year)
        .eq("child_id", child.id);
      const topicIds = (topics || []).map(t => t.id);
      if (!topicIds.length) {
        alert("No curriculum topics found for this learner and period.");
        return;
      }

      const { data: links, error } = await supaPortfolio
        .from("curriculum_links")
        .select("*")
        .eq("user_id", userId)
        .in("curriculum_item_id", topicIds)
        .eq("evidence_type", "video");

      if (error) {
        console.error(error);
        alert("Could not load video evidence.");
        return;
      }
      const videos = links || [];
      if (!videos.length) {
        alert("No video evidence found for this learner and period.");
        return;
      }

      const zip = new JSZip();
      let indexText = `Video evidence for ${child.name} (${year}, ${term})\n`;

      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        if (!v.evidence_url) continue;
        indexText += `${i + 1}. ${v.evidence_url}\n`;
        try {
          const response = await fetch(v.evidence_url);
          const blob = await response.blob();
          const urlObj = new URL(v.evidence_url);
          const parts = urlObj.pathname.split("/");
          let filename = parts[parts.length - 1] || `video-${i + 1}.mp4`;
          if (!/\./.test(filename)) {
            filename = `${filename}.mp4`;
          }
          zip.file(filename, blob);
        } catch (e) {
          console.error("Failed to fetch video", v.evidence_url, e);
        }
      }

      zip.file(
        "README.txt",
        indexText +
          "\nNote: If any videos are missing, you can use the URLs above in a browser."
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${lastSnapshot.child.name.replace(/\s+/g, "-")}-videos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  await refreshSnapshot();
  hideLoader();
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadPortfolioView();
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;
});
