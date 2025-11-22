// Shared colors and helpers
window.childColors = {
  Emma: "#A3B18A",
  Liam: "#A8B8D0",
  Ava: "#E6B7B2",
  Noah: "#D9C9A3"
};

window.subjectColors = {
  English: "#F5D97A",
  Math: "#81C7B2",
  Science: "#A9D18E",
  History: "#D7A272",
  Geography: "#6DAEDB",
  "Creative Arts": "#C7A8E0",
  "Life Orientation": "#F4A89C"
};

window.loadData = function (key) {
  return JSON.parse(localStorage.getItem(key)) || [];
};
window.saveData = function (key, data) {
  localStorage.setItem(key, JSON.stringify(data));
};
