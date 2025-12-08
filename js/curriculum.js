const supaCurr = getSupabase();

async function loadCurriculumView() {
  await requireAuth();
  showLoader();

  const { data: userRes } = await supaCurr.auth.getUser();
  const userId = userRes.user.id;

  const childFilter = document.getElementById("curChildFilter");
  const subjectFilter = document.getElementById("curSubjectFilter");
  const yearFilter = document.getElementById("curYearFilter");
  const termFilter = document.getElementById("curTermFilter");

  const newTopicInput = document.getElementById("curNewTopic");
  const newDescInput = document.getElementById("curNewDescription");
  const addTopicBtn = document.getElementById("curAddTopicBtn");
  const topicListEl = document.getElementById("curTopicList");

  const portfolioHeading = document.getElementById("curPortfolioHeading");
  const portfolioBadge = document.getElementById("curPortfolioBadge");
  const reportBtn = document.getElementById("curReportBtn");
  const resourceSelect = document.getElementById("curResourceSelect");
  const assessmentSelect = document.getElementById("curAssessmentSelect");
  const evidenceTypeSelect = document.getElementById("curEvidenceType");
  const evidenceFileInput = document.getElementById("curEvidenceFile");
  const evidenceUrlInput = document.getElementById("curEvidenceUrl");
  const evidenceNoteInput = document.getElementById("curEvidenceNote");
  const addEvidenceBtn = document.getElementById("curAddEvidenceBtn");
  const evidenceListEl = document.getElementById("curEvidenceList");

  let children = [];
  let subjects = [];
  let topics = [];
  let activeTopicId = null;

  const { data: kidsData } = await supaCurr
    .from("children")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  children = kidsData || [];

  children.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.grade || "No grade"})`;
    childFilter.appendChild(opt);
  });

  const { data: subjData } = await supaCurr
    .from("subjects")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .order("name", { ascending: true });
  subjects = subjData || [];

  subjects.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = s.name;
    subjectFilter.appendChild(opt);
  });

  const today = new Date();
  if (yearFilter) yearFilter.value = today.getFullYear();

  function childGradeForId(childId) {
    const c = children.find(ch => ch.id === childId);
    return c ? c.grade || null : null;
  }

  function statusLabel(status) {
    if (status === "in_progress") return "In progress";
    if (status === "completed") return "Completed";
    return "Not started";
  }

  async function loadTopics() {
    const year = parseInt(yearFilter.value || today.getFullYear(), 10);
    const term = termFilter.value;
    const childId = childFilter.value;
    const subject = subjectFilter.value;

    let query = supaCurr
      .from("curriculum_items")
      .select("*")
      .eq("user_id", userId)
      .eq("year", year)
      .order("subject", { ascending: true })
      .order("term", { ascending: true })
      .order("created_at", { ascending: true });

    if (term && term !== "all") {
      query = query.eq("term", term);
    }
    if (childId && childId !== "all") {
      query = query.eq("child_id", childId);
    }
    if (subject && subject !== "all") {
      query = query.eq("subject", subject);
    }

    const { data, error } = await query;
    if (error) {
      console.error(error);
      alert("Could not load curriculum topics.");
      return;
    }
    topics = data || [];
    renderTopics();
  }

  function renderTopics() {
    topicListEl.innerHTML = "";
    if (!topics.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No curriculum topics captured for this filter yet.";
      topicListEl.appendChild(empty);
      activeTopicId = null;
      updatePortfolioHeader();
      evidenceListEl.innerHTML = "";
      addEvidenceBtn.disabled = true;
      return;
    }

    topics.forEach(topic => {
      const child = children.find(c => c.id === topic.child_id);
      const card = document.createElement("div");
      card.className = "resource";
      card.dataset.id = topic.id;
      if (topic.id === activeTopicId) {
        card.style.borderColor = "#a3b18a";
        card.style.boxShadow = "0 0 0 2px rgba(163,177,138,0.25)";
      }
      card.innerHTML = `
        <div class="resource-header">
          <div>
            <p class="eyebrow">${topic.subject || "General"} • ${topic.term === "full_year" ? "Full year" : topic.term?.toUpperCase() || ""}</p>
            <h4 style="margin:0 0 0.15rem 0;">${topic.topic}</h4>
            <p class="muted" style="margin:0; font-size:0.82rem;">${topic.description || ""}</p>
            <p class="muted" style="margin:0.35rem 0 0; font-size:0.78rem;">
              ${child ? `For: ${child.name} (${child.grade || "grade not set"})` : (topic.grade ? `Grade: ${topic.grade}` : "Grade not specified")}
            </p>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.35rem; align-items:flex-end;">
            <select class="cur-status-select" data-id="${topic.id}"
                    style="padding:0.35rem 0.55rem; border-radius:999px; border:1px solid #dfe6d4; background:#fbfdf8; font-size:0.8rem;">
              <option value="not_started" ${topic.status === "not_started" ? "selected" : ""}>Not started</option>
              <option value="in_progress" ${topic.status === "in_progress" ? "selected" : ""}>In progress</option>
              <option value="completed" ${topic.status === "completed" ? "selected" : ""}>Completed</option>
            </select>
          </div>
        </div>
      `;
      topicListEl.appendChild(card);
    });
  }

  function updatePortfolioHeader() {
    const topic = topics.find(t => t.id === activeTopicId);
    if (!topic) {
      portfolioHeading.textContent = "Select a topic";
      portfolioBadge.textContent = "No topic selected";
      return;
    }
    portfolioHeading.textContent = topic.topic;
    portfolioBadge.textContent = `${topic.subject || "General"} • ${statusLabel(topic.status)}`;
  }

  async function loadEvidenceForActive() {
    evidenceListEl.innerHTML = "";
    if (!activeTopicId) {
      addEvidenceBtn.disabled = true;
      return;
    }
    addEvidenceBtn.disabled = false;

    const { data, error } = await supaCurr
      .from("curriculum_links")
      .select("*")
      .eq("user_id", userId)
      .eq("curriculum_item_id", activeTopicId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      alert("Could not load portfolio evidence.");
      return;
    }

    const list = data || [];
    if (!list.length) {
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = "No evidence attached yet. Use the form above to link packs, assessments, or files.";
      evidenceListEl.appendChild(li);
      return;
    }

    list.forEach(item => {
      const li = document.createElement("li");
      li.style.padding = "0.45rem 0.35rem";
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.justifyContent = "space-between";
      li.style.borderBottom = "1px solid #e5ead8";
      const kind = item.evidence_type || "other";
      const label = item.evidence_url ? `<a href="${item.evidence_url}" target="_blank">Open evidence</a>` : "";
      li.innerHTML = `
        <div style="flex:1; min-width:0;">
          <p style="margin:0; font-size:0.85rem;">
            <strong>${kind}</strong>${item.note ? " — " + item.note : ""}</p>
          <p class="muted" style="margin:0.1rem 0 0; font-size:0.75rem;">
            ${label}
          </p>
        </div>
        <button type="button" class="ghost-btn ghost-btn-small cur-evidence-delete" data-id="${item.id}">Delete</button>
      `;
      evidenceListEl.appendChild(li);
    });
  }

  async function refreshLinkedOptions() {
    resourceSelect.innerHTML = '<option value="">Link a saved pack (optional)</option>';
    assessmentSelect.innerHTML = '<option value="">Link an assessment (optional)</option>';

    const topic = topics.find(t => t.id === activeTopicId);
    if (!topic) return;

    const { data: resData } = await supaCurr
      .from("resources")
      .select("id, title, subject, grade")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    (resData || []).forEach(r => {
      if (topic.subject && r.subject && r.subject !== topic.subject) return;
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.title} • ${r.subject || "General"} ${r.grade ? `(${r.grade})` : ""}`;
      resourceSelect.appendChild(opt);
    });

    const { data: assessData } = await supaCurr
      .from("assessments")
      .select("id, subject, title, date, child")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    (assessData || []).forEach(a => {
      if (topic.subject && a.subject && a.subject !== topic.subject) return;
      const opt = document.createElement("option");
      opt.value = a.id;
      const date = a.date ? new Date(a.date).toLocaleDateString() : "";
      opt.textContent = `${a.title} • ${a.subject || "General"} • ${a.child || ""} ${date ? "• " + date : ""}`;
      assessmentSelect.appendChild(opt);
    });
  }

  addTopicBtn.addEventListener("click", async () => {
    const topicText = newTopicInput.value.trim();
    const desc = newDescInput.value.trim();
    const year = parseInt(yearFilter.value || today.getFullYear(), 10);
    const term = termFilter.value && termFilter.value !== "all" ? termFilter.value : "full_year";
    const childId = childFilter.value && childFilter.value !== "all" ? childFilter.value : null;
    const subject =
      subjectFilter.value && subjectFilter.value !== "all"
        ? subjectFilter.value
        : (subjects[0]?.name || "General");

    if (!topicText) {
      alert("Enter a topic title first.");
      return;
    }

    const grade = childId ? childGradeForId(childId) : null;

    const { data, error } = await supaCurr
      .from("curriculum_items")
      .insert({
        user_id: userId,
        child_id: childId,
        grade,
        subject,
        year,
        term,
        topic: topicText,
        description: desc || null
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      window.showToast("Could not add curriculum topic.", "error");
      return;
    }

    newTopicInput.value = "";
    newDescInput.value = "";
    topics.push(data);
    renderTopics();
    window.showToast("Curriculum topic added.", "success");
  });

  // Click selects a topic card, but ignores clicks on the status dropdown
  topicListEl.addEventListener("click", async (e) => {
    if (e.target.closest(".cur-status-select")) {
      return;
    }
    const card = e.target.closest(".resource");
    if (card && card.dataset.id) {
      activeTopicId = card.dataset.id;
      renderTopics();
      updatePortfolioHeader();
      await refreshLinkedOptions();
      await loadEvidenceForActive();
    }
  });

  // Change on the status dropdown updates topic status
  topicListEl.addEventListener("change", async (e) => {
    const statusSelect = e.target.closest(".cur-status-select");
    if (!statusSelect || !statusSelect.dataset.id) return;
    const id = statusSelect.dataset.id;
    const newStatus = statusSelect.value;
    const { error } = await supaCurr
      .from("curriculum_items")
      .update({ status: newStatus })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      console.error(error);
      window.showToast("Could not update topic status.", "error");
      return;
    }
    const topic = topics.find(t => t.id === id);
    if (topic) topic.status = newStatus;
    updatePortfolioHeader();
  });

  [childFilter, subjectFilter, yearFilter, termFilter].forEach(el => {
    if (!el) return;
    el.addEventListener("change", loadTopics);
  });

  evidenceTypeSelect.addEventListener("change", () => {
    const v = evidenceTypeSelect.value;
    if (v === "link") {
      evidenceUrlInput.style.display = "block";
      evidenceFileInput.style.display = "none";
    } else {
      evidenceUrlInput.style.display = "none";
      evidenceFileInput.style.display = "block";
    }
  });

  addEvidenceBtn.addEventListener("click", async () => {
    if (!activeTopicId) return;

    const resourceId = resourceSelect.value || null;
    const assessmentId = assessmentSelect.value || null;
    const type = evidenceTypeSelect.value;
    const note = evidenceNoteInput.value.trim() || null;
    let evidenceUrl = null;
    let evidenceKind = "other";

    if (type === "link") {
      const url = evidenceUrlInput.value.trim();
      if (!url) {
        alert("Paste a link for this evidence.");
        return;
      }
      evidenceUrl = url;
      evidenceKind = "link";
    } else {
      const file = evidenceFileInput.files[0];
      if (!file) {
        alert("Choose a file to upload.");
        return;
      }
      const ts = Date.now();
      const ext = file.name.split(".").pop() || "bin";
      const path = `${userId}/curriculum/${activeTopicId}/${ts}-${file.name}`;
      const { error: uploadErr } = await supaCurr.storage.from("packs").upload(path, file, {
        upsert: true
      });
      if (uploadErr) {
        console.error(uploadErr);
        alert("Could not upload file.");
        return;
      }
      const { data: urlData } = supaCurr.storage.from("packs").getPublicUrl(path);
      evidenceUrl = urlData.publicUrl;

      const mime = file.type || "";
      if (mime.startsWith("image/")) evidenceKind = "image";
      else if (mime.startsWith("video/")) evidenceKind = "video";
      else if (mime.startsWith("audio/")) evidenceKind = "audio";
      else if (mime === "application/pdf") evidenceKind = "pdf";
      else evidenceKind = "other";
    }

    const { error } = await supaCurr
      .from("curriculum_links")
      .insert({
        user_id: userId,
        curriculum_item_id: activeTopicId,
        resource_id: resourceId || null,
        assessment_id: assessmentId || null,
        evidence_url: evidenceUrl,
        evidence_type: evidenceKind,
        note
      });

    if (error) {
      console.error(error);
      window.showToast("Could not save evidence.", "error");
      return;
    }

    evidenceNoteInput.value = "";
    evidenceFileInput.value = "";
    evidenceUrlInput.value = "";
    await loadEvidenceForActive();
    window.showToast("Evidence added to this topic.", "success");
  });

  evidenceListEl.addEventListener("click", async (e) => {
    const btn = e.target.closest(".cur-evidence-delete");
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    const ok = window.confirm("Remove this evidence from the portfolio? The original file or link will not be deleted, only the link to this topic.");
    if (!ok) return;
    const { error } = await supaCurr
      .from("curriculum_links")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      console.error(error);
      window.showToast("Could not delete evidence.", "error");
      return;
    }
    await loadEvidenceForActive();
    window.showToast("Evidence removed from this topic.", "success");
  });

  if (reportBtn) {
    reportBtn.addEventListener("click", async () => {
      const year = parseInt(yearFilter.value || today.getFullYear(), 10);
      const term = termFilter.value;
      const childId = childFilter.value;

      let termForQuery = term && term !== "all" ? term : null;

      let query = supaCurr
        .from("curriculum_items")
        .select("*")
        .eq("user_id", userId)
        .eq("year", year)
        .order("subject", { ascending: true })
        .order("term", { ascending: true })
        .order("created_at", { ascending: true });

      if (termForQuery) query = query.eq("term", termForQuery);
      if (childId && childId !== "all") query = query.eq("child_id", childId);

      const { data: items, error } = await query;
      if (error) {
        console.error(error);
        alert("Could not load curriculum topics for the report.");
        return;
      }
      const list = items || [];
      if (!list.length) {
        alert("No curriculum topics found for this filter.");
        return;
      }

      const topicIds = list.map(t => t.id);
      const { data: links, error: linksErr } = await supaCurr
        .from("curriculum_links")
        .select("*")
        .eq("user_id", userId)
        .in("curriculum_item_id", topicIds);
      if (linksErr) {
        console.error(linksErr);
        alert("Could not load linked evidence.");
        return;
      }
      const linksByTopic = {};
      (links || []).forEach(l => {
        if (!linksByTopic[l.curriculum_item_id]) {
          linksByTopic[l.curriculum_item_id] = [];
        }
        linksByTopic[l.curriculum_item_id].push(l);
      });

      const rangeLabel = (() => {
        if (term === "term1") return `Term 1 ${year}`;
        if (term === "term2") return `Term 2 ${year}`;
        if (term === "term3") return `Term 3 ${year}`;
        if (term === "term4") return `Term 4 ${year}`;
        if (term === "full_year" || term === "all" || !term) return `Year ${year}`;
        return `${year}`;
      })();

      const childLabel = (() => {
        if (!childId || childId === "all") return "All kids / grade-based topics";
        const c = children.find(ch => ch.id === childId);
        if (!c) return "Child";
        return `${c.name}${c.grade ? " (" + c.grade + ")" : ""}`;
      })();

      const bySubject = new Map();
      list.forEach(t => {
        const subject = t.subject || "General";
        if (!bySubject.has(subject)) bySubject.set(subject, []);
        bySubject.get(subject).push(t);
      });

      let sectionsHtml = "";
      bySubject.forEach((rows, subject) => {
        const rowsHtml = rows
          .map(t => {
            const status = t.status || "not_started";
            const friendlyStatus =
              status === "in_progress"
                ? "In progress"
                : status === "completed"
                ? "Completed"
                : "Not started";
            const evidence = linksByTopic[t.id] || [];
            const evidenceSummary = evidence.length
              ? evidence
                  .map(e => e.evidence_type || "other")
                  .join(", ")
              : "None yet";
            return `<tr>
              <td>${t.term === "full_year" ? "Full year" : (t.term || "")}</td>
              <td>${t.topic}</td>
              <td>${friendlyStatus}</td>
              <td>${evidenceSummary}</td>
            </tr>`;
          })
          .join("");

        sectionsHtml += `
          <h3>${subject}</h3>
          <table>
            <thead>
              <tr>
                <th>Term</th>
                <th>Topic</th>
                <th>Status</th>
                <th>Evidence types linked</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      });

      const win = window.open("", "_blank");
      const logo = "🌿 Homeschool Planner";

      win.document.write(`
        <html>
          <head>
            <title>Curriculum report</title>
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
            <h2>Curriculum coverage report</h2>
            <p><strong>Learner / group:</strong> ${childLabel}</p>
            <p><strong>Period:</strong> ${rangeLabel}</p>
            <p><strong>Note:</strong> Evidence types show what's attached for each topic (packs, assessments, videos, etc.).</p>
            ${sectionsHtml}
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
      win.print();
    });
  }

  await loadTopics();
  updatePortfolioHeader();
  hideLoader();
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadCurriculumView();
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;
});
