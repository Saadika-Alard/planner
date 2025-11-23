const supaClient = getSupabase();
let currentUser = null;
let pdfDoc = null;
let fileBlob = null;
let totalPages = 0;
let resources = [];
let childrenData = [];
let subjectsData = [];

const pdfUpload = document.getElementById("pdfUpload");
const thumbGrid = document.getElementById("thumbGrid");
const sorterArea = document.getElementById("sorterArea");
const teachCount = document.getElementById("teachCount");
const exCount = document.getElementById("exCount");
const teachingFolder = document.getElementById("teachingFolder");
const exerciseFolder = document.getElementById("exerciseFolder");
const saveBtn = document.getElementById("saveSplit");
const indicator = document.getElementById("pageIndicator");

let teachingPages = [];
let exercisePages = [];
let unassignedPages = [];
let selectedPages = new Set();

// extra resource UI
const extraTitleInput = document.getElementById("extraTitle");
const extraSubjectSelect = document.getElementById("extraSubject");
const extraGradeSelect = document.getElementById("extraGrade");
const extraTypeSelect = document.getElementById("extraType");
const extraLinkInput = document.getElementById("extraLink");
const extraFileInput = document.getElementById("extraFile");
const extraNotesInput = document.getElementById("extraNotes");
const saveExtraBtn = document.getElementById("saveExtraResource");

pdfUpload.addEventListener("change", handlePDFUpload);
saveBtn.addEventListener("click", saveLessonPacks);
if (saveExtraBtn) saveExtraBtn.addEventListener("click", saveExtraResource);

/* ----------------------------------------------------------
   Load PDF + Thumbnails
---------------------------------------------------------- */
async function handlePDFUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  fileBlob = file;
  showLoader();

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

  const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
  pdfDoc = pdf;
  totalPages = pdf.numPages;

  sorterArea.classList.remove("hidden");
  thumbGrid.innerHTML = "";

  teachingPages = [];
  exercisePages = [];
  unassignedPages = Array.from({ length: totalPages }, (_, i) => i + 1);
  updateIndicators();

  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.2 });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

      const div = document.createElement("div");
      div.classList.add("page-thumb");
      div.dataset.page = i;
      div.innerHTML = `<p>Page ${i}</p>`;
      div.prepend(canvas);

      div.onclick = toggleSelect;
      div.draggable = true;
      div.addEventListener("dragstart", dragStart);

      thumbGrid.appendChild(div);
    } catch (err) {
      console.error("Failed rendering page", i, err);
    }
  }

  setupDropZones();
  // optional: add drag-select if implemented later
  hideLoader();
}

/* ----------------------------------------------------------
   Page Selection
---------------------------------------------------------- */
function toggleSelect(e) {
  const page = +e.currentTarget.dataset.page;

  if (selectedPages.has(page)) {
    selectedPages.delete(page);
    e.currentTarget.classList.remove("selected");
  } else {
    if (!e.ctrlKey && !e.metaKey) clearSelections();
    selectedPages.add(page);
    e.currentTarget.classList.add("selected");
  }
}

function clearSelections() {
  selectedPages.forEach(p => {
    const el = document.querySelector(`.page-thumb[data-page="${p}"]`);
    if (el) el.classList.remove("selected");
  });
  selectedPages.clear();
}

/* ----------------------------------------------------------
   Drag to folders
---------------------------------------------------------- */
function dragStart(e) {
  const dragged = Array.from(
    selectedPages.size ? selectedPages : [e.target.dataset.page]
  );
  e.dataTransfer.setData("text/plain", dragged.join(","));
}

function setupDropZones() {
  [teachingFolder, exerciseFolder].forEach(folder => {
    folder.addEventListener("dragover", e => e.preventDefault());
    folder.addEventListener("drop", e => {
      e.preventDefault();
      const pages = e.dataTransfer.getData("text/plain").split(",").map(Number);
      movePagesToFolder(folder.id, pages);
    });
  });
}

function movePagesToFolder(folderId, pages) {
  teachingPages = teachingPages.filter(p => !pages.includes(p));
  exercisePages = exercisePages.filter(p => !pages.includes(p));
  unassignedPages = unassignedPages.filter(p => !pages.includes(p));

  if (folderId === "teachingFolder") teachingPages.push(...pages);
  if (folderId === "exerciseFolder") exercisePages.push(...pages);

  pages.forEach(p => {
    const el = document.querySelector(`.page-thumb[data-page="${p}"]`);
    if (el) el.remove();
  });

  clearSelections();
  updateIndicators();
}

/* ----------------------------------------------------------
   Indicators
---------------------------------------------------------- */
function updateIndicators() {
  teachCount.textContent = teachingPages.length;
  exCount.textContent = exercisePages.length;

  unassignedPages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => !teachingPages.includes(p) && !exercisePages.includes(p));

  indicator.textContent =
    `Unassigned: ${unassignedPages.length} / ${totalPages}`;

  saveBtn.disabled = unassignedPages.length > 0;
}

/* ----------------------------------------------------------
   Split PDF → Base64
---------------------------------------------------------- */
async function splitPDF(file, pagesList) {
  const bytes = await file.arrayBuffer();
  const original = await PDFLib.PDFDocument.load(bytes);
  const newPdf = await PDFLib.PDFDocument.create();

  for (const p of pagesList.sort((a, b) => a - b)) {
    const [pg] = await newPdf.copyPages(original, [p - 1]);
    newPdf.addPage(pg);
  }

  return await newPdf.saveAsBase64({ dataUri: false });
}

async function uploadToStorage(path, base64) {
  // convert base64 → blob
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });

  const { error } = await supaClient.storage.from("packs").upload(path, blob, { upsert: true });
  if (error) throw error;

  const { data } = supaClient.storage.from("packs").getPublicUrl(path);
  return data.publicUrl;
}

/* ----------------------------------------------------------
   Save Packs → Resources
---------------------------------------------------------- */
async function saveLessonPacks() {
  const teachingPack = teachingPages.length
    ? await splitPDF(fileBlob, teachingPages)
    : null;

  const exercisePack = exercisePages.length
    ? await splitPDF(fileBlob, exercisePages)
    : null;

  const modal = document.getElementById("saveModal");
  const subjectSelect = document.getElementById("modalSubject");
  const gradeSelect = document.getElementById("modalGrade");

  // Populate subjects from DB
  if (subjectSelect) {
    subjectSelect.innerHTML = "";
    const activeSubjects = (subjectsData || []).filter(s => s.active !== false);
    if (activeSubjects.length) {
      activeSubjects.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.name;
        opt.textContent = s.name;
        subjectSelect.appendChild(opt);
      });
    } else {
      const opt = document.createElement("option");
      opt.value = "General";
      opt.textContent = "General";
      subjectSelect.appendChild(opt);
    }
  }

  // Populate grade dropdown from distinct child grades
  if (gradeSelect) {
    gradeSelect.innerHTML = `<option value="">All grades</option>`;
    const grades = Array.from(
      new Set((childrenData || []).map(c => c.grade).filter(Boolean))
    ).sort();
    grades.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = g;
      gradeSelect.appendChild(opt);
    });
  }

  modal.classList.remove("hidden");

  document.getElementById("confirmSave").onclick = async () => {

    const title = document.getElementById("modalTitle").value || "Lesson Pack";
    const subject = document.getElementById("modalSubject").value || "General";
    const gradeTag = document.getElementById("modalGrade").value || null;
    const notes = document.getElementById("modalNotes").value || "";

    let teachingUrl = null;
    let exerciseUrl = null;

    try {
      const ts = Date.now();
      showLoader();
      if (teachingPack) {
        teachingUrl = await uploadToStorage(`${currentUser.id}/${ts}-teaching.pdf`, teachingPack);
      }
      if (exercisePack) {
        exerciseUrl = await uploadToStorage(`${currentUser.id}/${ts}-exercise.pdf`, exercisePack);
      }
    } catch (err) {
      alert("Upload failed. Make sure a 'packs' storage bucket exists and is public.");
      console.error(err);
      hideLoader();
      return;
    }

    const { data, error } = await supaClient
      .from("resources")
      .insert({
        user_id: currentUser.id,
        title,
        subject,
        grade: gradeTag,
        notes,
        teaching_pack_url: teachingUrl,
        exercise_pack_url: exerciseUrl
      })
      .select()
      .single();

    if (error) {
      alert("Failed to save pack to Supabase");
      console.error(error);
      hideLoader();
      return;
    }

    modal.classList.add("hidden");
    sorterArea.classList.add("hidden");
    await fetchResources();
    hideLoader();

    alert("Lesson Pack Saved!");
  };

  document.getElementById("cancelSave").onclick = () =>
    modal.classList.add("hidden");
}

/* ----------------------------------------------------------
   Render saved packs
---------------------------------------------------------- */
function renderResources() {
  const container = document.getElementById("resourceList");
  if (!container) return;

  const data = resources || [];
  container.innerHTML = "";

  data.forEach((r, i) => {
    const card = document.createElement("div");
    card.classList.add("resource");
    card.dataset.index = i;

    card.innerHTML = `
      <button class="delete-btn">✕</button>
      <div class="resource-header">
        <div>
          <h4>${r.title}</h4>
          <div class="resource-meta">
            ${r.grade ? `<span class="pill soft">${r.grade}</span>` : ""}
            <span class="pill soft" style="background:${window.getSubjectColor ? window.getSubjectColor(r.subject) : ''};">
              ${r.subject || "General"}
            </span>
            ${r.notes ? `<span class="pill">${r.notes}</span>` : ""}
          </div>
        </div>
      </div>

      <div class="resource-body">
        <div class="resource-section">
          <p class="eyebrow">Status</p>
          <div class="resource-badges">
            ${r.teaching_pack_url ? `<span class="pill soft">Teaching ready</span>` : `<span class="pill soft muted">No teaching pack</span>`}
            ${r.exercise_pack_url ? `<span class="pill soft">Exercise ready</span>` : `<span class="pill soft muted">No exercise pack</span>`}
          </div>
        </div>

        <div class="resource-section">
          <p class="eyebrow">Actions</p>
          <div class="resource-actions">
            <button class="assign-btn" data-id="${r.id}">📅 Assign</button>
            <div class="resource-links">
              ${r.teaching_pack_url ? `<a class="ghost-link" href="${r.teaching_pack_url}" target="_blank">📘 Teaching Pack</a>` : ""}
              ${r.exercise_pack_url ? `<a class="ghost-link" href="${r.exercise_pack_url}" target="_blank">✏️ Exercise Pack</a>` : ""}
            </div>
          </div>
        </div>
      </div>

      <div class="resource-footer">
        <span class="muted"><small>Uploaded: ${new Date(r.uploaded_at || Date.now()).toLocaleDateString()}</small></span>
      </div>
    `;

    container.appendChild(card);
  });

  if (!container.dataset.bound) {
    container.addEventListener("click", handleResourceClick);
    container.dataset.bound = "true";
  }
}

function handleResourceClick(e) {
  if (e.target.classList.contains("assign-btn")) {
    const resourceId = e.target.dataset.id;

    const modal = document.getElementById("assignModal");
    modal.classList.remove("hidden");

    // Populate child dropdown from DB
    const childSelect = document.getElementById("assignChild");
    const gradeDisplay = document.getElementById("assignChildGradeDisplay");
    if (childSelect) {
      childSelect.innerHTML = `<option value="">Select child</option>`;
      (childrenData || []).forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.name;
        opt.textContent = c.name;
        childSelect.appendChild(opt);
      });

      childSelect.onchange = () => {
        const selected = childrenData.find(c => c.name === childSelect.value);
        if (gradeDisplay) {
          gradeDisplay.textContent = selected && selected.grade
            ? `Grade: ${selected.grade}`
            : "Grade: –";
        }
      };

      // reset display
      if (gradeDisplay) gradeDisplay.textContent = "Grade: –";
      childSelect.value = "";
    }

    document.getElementById("confirmAssign").onclick = () => {

      const child = document.getElementById("assignChild").value;
      const start = document.getElementById("assignStartDate").value;
      const end = document.getElementById("assignEndDate").value;
      const childRow = (childrenData || []).find(c => c.name === child);
      const grade = childRow?.grade || "";

      if (!child || !start || !end) {
        alert("Child and start/end dates are required");
        return;
      }

      const res = resources.find(r => r.id === resourceId);
      let cur = new Date(start);
      const endDate = new Date(end);
      const rows = [];

      while (cur <= endDate) {
        rows.push({
          user_id: currentUser.id,
          title: res.title,
          child,
          child_id: childRow ? childRow.id : null,
          grade,
          date: cur.toISOString().split("T")[0],
          start_time: "",
          end_time: "",
          subject: res.subject || "General",
          resource_id: resourceId
        });
        cur.setDate(cur.getDate() + 1);
      }

      supaClient.from("events").insert(rows).then(({ error }) => {
        if (error) {
          alert("Failed to assign lesson");
          console.error(error);
          return;
        }
        modal.classList.add("hidden");
        alert("Lesson Assigned!");
      });
    };

    document.getElementById("cancelAssign").onclick = () =>
      modal.classList.add("hidden");
  }
}

async function fetchResources() {
  const { data, error } = await supaClient
    .from("resources")
    .select("*")
    .order("uploaded_at", { ascending: false });
  if (error) {
    console.error(error);
    return;
  }
  resources = data || [];
  renderResources();
}

async function fetchChildrenAndSubjects() {
  const { data: kids } = await supaClient
    .from("children")
    .select("*")
    .order("name", { ascending: true });
  childrenData = kids || [];

  const { data: subj } = await supaClient
    .from("subjects")
    .select("*")
    .order("name", { ascending: true });
  subjectsData = subj || [];

  // populate extra subject/grade dropdowns
  if (extraSubjectSelect) {
    extraSubjectSelect.innerHTML = `<option value="">Subject (optional)</option>`;
    subjectsData.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.name;
      opt.textContent = s.name;
      extraSubjectSelect.appendChild(opt);
    });
  }

  if (extraGradeSelect) {
    extraGradeSelect.innerHTML = `<option value="">Grade (optional)</option>`;
    const grades = Array.from(new Set((childrenData || []).map(c => c.grade).filter(Boolean))).sort();
    grades.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = g;
      extraGradeSelect.appendChild(opt);
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const { data } = await supaClient.auth.getUser();
  currentUser = data.user;
  showLoader();
  await fetchChildrenAndSubjects();
  await fetchResources();
  hideLoader();
});

/* ----------------------------------------------------------
   Extra Resource (quick add)
---------------------------------------------------------- */
async function saveExtraResource() {
  const title = extraTitleInput ? extraTitleInput.value.trim() : "";
  const subject = extraSubjectSelect ? extraSubjectSelect.value : "";
  const grade = extraGradeSelect ? extraGradeSelect.value : "";
  const kind = extraTypeSelect ? extraTypeSelect.value : "link";
  const link = extraLinkInput ? extraLinkInput.value.trim() : "";
  const file = extraFileInput ? extraFileInput.files[0] : null;
  const notes = extraNotesInput ? extraNotesInput.value.trim() : "";

  if (!title) {
    alert("Please add a title for the resource.");
    return;
  }

  let exerciseUrl = "";
  try {
    showLoader();
    if (kind === "pdf" && file) {
      const ts = Date.now();
      exerciseUrl = await uploadToStorage(`${currentUser.id}/${ts}-extra.pdf`, await splitPDF(file, [1]));
    } else if (kind === "link" && link) {
      exerciseUrl = link;
    } else {
      hideLoader();
      alert("Provide a link or upload a PDF.");
      return;
    }

    const { error } = await supaClient
      .from("resources")
      .insert({
        user_id: currentUser.id,
        title,
        subject: subject || "General",
        grade: grade || null,
        notes,
        teaching_pack_url: null,
        exercise_pack_url: exerciseUrl
      });

    hideLoader();

    if (error) {
      console.error(error);
      alert("Failed to save resource.");
      return;
    }

    if (extraTitleInput) extraTitleInput.value = "";
    if (extraLinkInput) extraLinkInput.value = "";
    if (extraFileInput) extraFileInput.value = "";
    if (extraNotesInput) extraNotesInput.value = "";
    if (extraSubjectSelect) extraSubjectSelect.value = "";
    if (extraGradeSelect) extraGradeSelect.value = "";

    await fetchResources();
    alert("Resource saved. You can now assign it like any other pack.");
  } catch (err) {
    hideLoader();
    console.error(err);
    alert("Something went wrong while saving the resource.");
  }
}
