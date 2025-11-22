document.addEventListener("DOMContentLoaded", () => {

  const calendar = document.getElementById("calendar");
  const monthYear = document.getElementById("monthYear");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const addEventBtn = document.getElementById("addEventBtn");

  const eventModal = document.getElementById("eventModal");
  const saveEventBtn = document.getElementById("saveEvent");
  const closeEventModalBtn = document.getElementById("closeModal");

  const lessonModal = document.getElementById("lessonModal");
  const closeLessonModal = document.getElementById("closeLessonModal");

  const eventList = document.getElementById("eventList");

  let currentDate = new Date();

  /* ---------------------------------------------------------
     Render calendar
  --------------------------------------------------------- */
  function renderCalendar() {

    const events = loadData("calendarEvents") || [];
    const resources = loadData("resources") || [];

    calendar.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    monthYear.textContent =
      first.toLocaleString("default", { month: "long" }) + " " + year;

    const startDay = first.getDay();

    for (let i = 0; i < startDay; i++) {
      calendar.innerHTML += `<div class="day empty"></div>`;
    }

    for (let d = 1; d <= last.getDate(); d++) {

      const cell = document.createElement("div");
      cell.className = "day";

      const dateObj = new Date(year, month, d);
      const iso = dateObj.toISOString().split("T")[0];

      cell.innerHTML = `<span class="date-num">${d}</span>`;

      const todays = events.filter(e => e.date === iso);

      if (todays.length) {
        const container = document.createElement("div");
        container.classList.add("day-events");

        todays.forEach(ev => {

          const chip = document.createElement("div");
          chip.className = `calendar-event child-${ev.child.toLowerCase()}`;

          chip.innerHTML = `
            <small>${ev.title}</small>
            ${ev.startTime ? `<span class="time">${ev.startTime}</span>` : ""}
          `;

          chip.onclick = e => {
            e.stopPropagation();
            openLessonModal(ev);
          };

          container.appendChild(chip);
        });

        cell.appendChild(container);
      }

      cell.onclick = () => openEventModal(iso);
      calendar.appendChild(cell);
    }

    renderSidebar();
  }

  /* ---------------------------------------------------------
     Sidebar
  --------------------------------------------------------- */
  function renderSidebar() {
    const events = loadData("calendarEvents") || [];

    eventList.innerHTML = "";

    if (!events.length) {
      eventList.innerHTML = "<li>No scheduled lessons.</li>";
      return;
    }

    events
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(ev => {
        const li = document.createElement("li");
        li.innerHTML = `
          <b>${new Date(ev.date).toLocaleDateString()}</b>
          — ${ev.title} (${ev.child})
        `;
        eventList.appendChild(li);
      });
  }

  /* ---------------------------------------------------------
     Add Event Modal (manual events)
  --------------------------------------------------------- */
  function openEventModal(date) {
    eventModal.classList.remove("hidden");
    document.getElementById("eventDate").value = date;
  }

  saveEventBtn.onclick = () => {
    const title = document.getElementById("eventTitle").value.trim();
    const date = document.getElementById("eventDate").value;
    const child = document.getElementById("eventChild").value;
    const subject = document.getElementById("eventSubject").value;
    const startTime = document.getElementById("eventStartTime").value;
    const endTime = document.getElementById("eventEndTime").value;

    if (!title || !date || !child || !subject) {
      alert("All fields required");
      return;
    }

    const events = loadData("calendarEvents") || [];

    events.push({
      id: crypto.randomUUID(),
      title,
      date,
      child,
      subject,
      startTime,
      endTime,
      resourceId: null   // manual events have no PDF packs
    });

    saveData("calendarEvents", events);
    eventModal.classList.add("hidden");
    renderCalendar();
  };

  closeEventModalBtn.onclick = () =>
    eventModal.classList.add("hidden");


  /* ---------------------------------------------------------
     Lesson viewer modal
  --------------------------------------------------------- */
  function openLessonModal(ev) {
  const resources = loadData("resources") || [];
  const res = resources.find(r => r.id === ev.resourceId);

  lessonModal.classList.remove("hidden");
  document.getElementById("lessonTitle").textContent = ev.title;
  document.getElementById("lessonChild").textContent = ev.child;
  document.getElementById("lessonSubject").textContent = ev.subject;

  document.getElementById("lessonTime").textContent =
    ev.startTime && ev.endTime
      ? `${ev.startTime} – ${ev.endTime}`
      : "Not specified";

  const links = document.getElementById("lessonLinks");
  links.innerHTML = "";

  if (!res) {
    links.innerHTML = "<p>No lesson pack attached.</p>";
    return;
  }

  // 🔥 NO MORE SAVING PDFs TO LOCALSTORAGE!
  // We simply pass resourceId and type in the URL

  if (res.teachingPack) {
    links.innerHTML += `
      <a href="pdf-viewer.html?res=${res.id}&type=teaching"
         target="_blank">📘 Teaching Pack</a>
    `;
  }

  if (res.exercisePack) {
    links.innerHTML += `
      <a href="pdf-viewer.html?res=${res.id}&type=exercise"
         target="_blank">✏️ Exercise Pack</a>
    `;
  }
}


  closeLessonModal.onclick = () =>
    lessonModal.classList.add("hidden");


  /* ---------------------------------------------------------
     Calendar navigation
  --------------------------------------------------------- */
  prevBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  };

  nextBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  };

  addEventBtn.onclick = () =>
    openEventModal(new Date().toISOString().split("T")[0]);

  renderCalendar();
});
