// Shared colors and helpers
window.childColors = {
  Emma: "#A3B18A",
  Liam: "#A8B8D0",
  Ava: "#E6B7B2",
  Noah: "#D9C9A3"
};

window.subjectColors = {
  English: "#F5D97A",
  "Home Language": "#F5D97A",
  "First Additional Language": "#FBCFE8",
  Afrikaans: "#FBCFE8",
  Math: "#81C7B2",
  Mathematics: "#81C7B2",
  "Mathematics or Mathematical Literacy": "#81C7B2",
  Science: "#A9D18E",
  "Natural Sciences": "#A9D18E",
  "Natural Sciences & Technology": "#A9D18E",
  History: "#D7A272",
  Geography: "#6DAEDB",
  "Life Orientation": "#F4A89C",
  "Economic & Management Sciences": "#FDBA74",
  "Economic Management Sciences": "#FDBA74",
  Technology: "#BFDBFE",
  "Creative Arts": "#C7A8E0",
  "Physical Sciences": "#6EE7B7",
  "Life Sciences": "#4ADE80",
  Accounting: "#FBBF24",
  "Business Studies": "#F97316",
  Economics: "#FACC15",
  "Information Technology": "#38BDF8",
  "Computer Applications Technology": "#A5B4FC",
  General: "#E5E7EB"
};

// neutral, soft but distinct palette for children
const childPalette = [
  "#C7D2FE", // soft indigo
  "#BFDBFE", // soft blue
  "#A5F3FC", // soft cyan
  "#BBF7D0", // soft green
  "#FDE68A", // soft yellow
  "#FECACA"  // soft red
];
// slightly more saturated palette for subjects
const subjectPalette = ["#F9E5A6", "#D3E8C3", "#CDE4F4", "#E4D7F6", "#F9D3C9", "#F4E3B7"];

function colorFromPalette(name, palette, fallback) {
  if (!name) return fallback;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i) * 13) % 9973;
  }
  return palette[hash % palette.length] || fallback;
}

window.getChildColor = function (name) {
  if (window.childColors[name]) return window.childColors[name];
  return colorFromPalette(name, childPalette, "#9CA3AF");
};

window.getSubjectColor = function (name) {
  if (window.subjectColors[name]) return window.subjectColors[name];
  return colorFromPalette(name, subjectPalette, "#E5E7EB");
};

window.loadData = function (key) {
  return JSON.parse(localStorage.getItem(key)) || [];
};
window.saveData = function (key, data) {
  localStorage.setItem(key, JSON.stringify(data));
};

window.showLoader = function () {
  const el = document.getElementById("pageLoader");
  if (el) el.classList.remove("hidden");
};

window.hideLoader = function () {
  const el = document.getElementById("pageLoader");
  if (el) el.classList.add("hidden");
};
