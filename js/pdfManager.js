let pdfDoc = null;
let fileBlob = null;
let totalPages = 0;
let resources = loadData("resources") || [];

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

pdfUpload.addEventListener("change", handlePDFUpload);
saveBtn.addEventListener("click", saveLessonPacks);

/* ----------------------------------------------------------
   Load PDF + Thumbnails
---------------------------------------------------------- */
async function handlePDFUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  fileBlob = file;

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
  enableDragSelect();
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
   Split PDF to Base64
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
  modal.classList.remove("hidden");

  document.getElementById("confirmSave").onclick = () => {

    const id = "res_" + crypto.randomUUID(); // 🔥 UNIQUE RESOURCE ID

    const resource = {
      id,
      title: document.getElementById("modalTitle").value || "Lesson Pack",
      subject: document.getElementById("modalSubject").value || "General",
      notes: document.getElementById("modalNotes").value || "",
      teachingPack,
      exercisePack,
      uploaded: new Date().toISOString()
    };

    resources.push(resource);
    saveData("resources", resources);

    modal.classList.add("hidden");
    sorterArea.classList.add("hidden");
    renderResources();

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

  const data = loadData("resources") || [];
  container.innerHTML = "";

  data.forEach((r, i) => {
    const card = document.createElement("div");
    card.classList.add("resource");
    card.dataset.index = i;

    card.innerHTML = `
      <button class="delete-btn">✕</button>
      <h4>${r.title}</h4>
      <p><b>${r.subject}</b></p>
      <button class="assign-btn" data-id="${r.id}">📅 Assign</button>
    `;

    container.appendChild(card);
  });

  container.addEventListener("click", handleResourceClick);
}

function handleResourceClick(e) {
  if (e.target.classList.contains("assign-btn")) {
    const resourceId = e.target.dataset.id;

    const modal = document.getElementById("assignModal");
    modal.classList.remove("hidden");

    document.getElementById("confirmAssign").onclick = () => {

      const child = document.getElementById("assignChild").value;
      const start = document.getElementById("assignStartDate").value;
      const end = document.getElementById("assignEndDate").value;

      if (!child || !start || !end) {
        alert("All fields required");
        return;
      }

      const events = loadData("calendarEvents") || [];

      let cur = new Date(start);
      const endDate = new Date(end);

      while (cur <= endDate) {
        events.push({
          id: crypto.randomUUID(),
          title: resources.find(r => r.id === resourceId).title,
          child,
          date: cur.toISOString().split("T")[0],
          startTime: "",
          endTime: "",
          subject: resources.find(r => r.id === resourceId).subject,
          resourceId  // 🔥 ONLY THIS LINKS THE PDF
        });

        cur.setDate(cur.getDate() + 1);
      }

      saveData("calendarEvents", events);
      modal.classList.add("hidden");

      alert("Lesson Assigned!");
    };

    document.getElementById("cancelAssign").onclick = () =>
      modal.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", renderResources);
