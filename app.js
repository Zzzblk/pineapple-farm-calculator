const CROPS = {
  short: { name: "短熟果", minutes: 15, halfRemaining: 3 },
  medium: { name: "中短熟果", minutes: 60, halfRemaining: 5 },
  peach: { name: "桃子", minutes: 360, halfRemaining: 10 },
  long: { name: "长熟果", minutes: 960, halfRemaining: 10 },
};

const BEIJING_ZONE = "Asia/Shanghai";
const LOCAL_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const ZONE_LABELS = {
  "Asia/Shanghai": "上海",
  "Europe/Moscow": "莫斯科",
  "Asia/Tokyo": "东京",
  "Asia/Seoul": "首尔",
  "Asia/Singapore": "新加坡",
  "Europe/London": "伦敦",
  "Europe/Paris": "巴黎",
  "America/New_York": "纽约",
  "America/Los_Angeles": "洛杉矶",
  "America/Toronto": "多伦多",
  "Australia/Sydney": "悉尼",
  "Asia/Dubai": "迪拜",
};

const state = {
  crop: localStorage.getItem("pineapple-crop") || "short",
  fertilizer: Number(localStorage.getItem("pineapple-fertilizer") || 0),
  weekend: localStorage.getItem("pineapple-weekend") === "true",
  mode: localStorage.getItem("pineapple-mode") || "forward",
  targetStage: localStorage.getItem("pineapple-target-stage") || "half",
  inputZone: localStorage.getItem("pineapple-input-zone") || localStorage.getItem("pineapple-timezone") || "beijing",
  dualTimezone: localStorage.getItem("pineapple-dual-timezone") === "true",
  secondaryZone: localStorage.getItem("pineapple-secondary-zone") || "device",
  comparison: localStorage.getItem("pineapple-comparison") === "true",
  weekendOverrideDate: localStorage.getItem("pineapple-weekend-override-date") || "",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  date: $("#dateInput"),
  weekday: $("#weekdayBadge"),
  time: $("#timeInput"),
  weekend: $("#weekendToggle"),
  speed: $("#speedValue"),
  saving: $("#savingText"),
  resultKicker: $("#resultKicker"),
  duration: $("#durationValue"),
  subtitle: $("#resultSubtitle"),
  halfOffset: $("#halfOffset"),
  ripeOffset: $("#ripeOffset"),
  saved: $("#savedDuration"),
  halfRemaining: $("#halfRemaining"),
  warning: $("#resultWarning"),
  warningText: $("#warningText"),
  timeLabel: $("#timeFieldLabel"),
  targetStageControl: $("#targetStageControl"),
  inputZoneControl: $("#inputZoneControl"),
  inputLocalZone: $("#inputLocalZone"),
  timeBasisBadge: $("#timeBasisBadge"),
  inputNote: $("#inputNote"),
  localTimezoneName: $("#localTimezoneName"),
  timezoneDifference: $("#timezoneDifference"),
  timezoneOverview: $("#timezoneOverview"),
  dualTimezone: $("#dualTimezoneToggle"),
  secondaryTimezone: $("#secondaryTimezoneSelect"),
  secondaryZoneHeader: $("#secondaryZoneHeader"),
  comparisonToggle: $("#comparisonToggle"),
  comparisonPanel: $("#comparisonPanel"),
  comparisonTable: $("#comparisonTable"),
  scheduleTable: $("#scheduleTable"),
  resultStats: $("#resultStats"),
  resultCard: $(".result-card"),
  mobileResultPeek: $("#mobileResultPeek"),
  mobileResultLabel: $("#mobileResultLabel"),
  mobileBeijingTime: $("#mobileBeijingTime"),
  mobileLocalTime: $("#mobileLocalTime"),
  mobileSecondaryLabel: $("#mobileSecondaryLabel"),
  cells: {
    plant: { beijing: $("#plantBeijingTime"), local: $("#plantLocalTime") },
    half: { beijing: $("#halfBeijingTime"), local: $("#halfLocalTime") },
    ripe: { beijing: $("#ripeBeijingTime"), local: $("#ripeLocalTime") },
  },
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function getPartsInZone(date = new Date(), zone = BEIJING_ZONE) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
  );
}

function inputZone() {
  return state.mode === "reverse" ? "beijing" : state.inputZone;
}

function setInputsToDate(date = new Date()) {
  const zone = inputZone() === "local" ? LOCAL_ZONE : BEIJING_ZONE;
  const p = getPartsInZone(date, zone);
  elements.date.value = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  elements.time.value = `${pad(p.hour)}:${pad(p.minute)}`;
}

function readInputTimestamp() {
  if (!elements.date.value || !elements.time.value) return null;
  const [year, month, day] = elements.date.value.split("-").map(Number);
  const [hour = 0, minute = 0] = elements.time.value.split(":").map(Number);
  if (inputZone() === "local") return new Date(year, month - 1, day, hour, minute, 0).getTime();
  return Date.UTC(year, month - 1, day, hour - 8, minute, 0);
}

function formatDateTimeParts(timestamp, zone) {
  const p = getPartsInZone(new Date(timestamp), zone);
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

function createDateText(value) {
  const date = document.createElement("span");
  date.className = "date-display";
  date.textContent = value;
  return date;
}

function setTextWithDate(element, prefix, date, suffix = "") {
  element.replaceChildren(prefix, createDateText(date), suffix);
}

function setTimeCell(element, timestamp, zone) {
  const value = formatDateTimeParts(timestamp, zone);
  const date = createDateText(value.date);
  const time = document.createElement("strong");
  time.textContent = value.time;
  element.replaceChildren(date, time);
  element.dateTime = new Date(timestamp).toISOString();
}

function formatDateTime(timestamp, zone) {
  const value = formatDateTimeParts(timestamp, zone);
  return `${value.date} ${value.time}`;
}

function durationText(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds > 0 && seconds < 60) return "不足1分钟";
  const totalMinutes = Math.floor(seconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days}天`);
  if (hours) parts.push(`${hours}小时`);
  if (minutes || parts.length === 0) parts.push(`${minutes}分钟`);
  return parts.join("");
}

function floorSeconds(value) {
  return Math.floor(value + 1e-7);
}

function getCalculation() {
  const crop = CROPS[state.crop];
  const speed = 1 + state.fertilizer + (state.weekend ? 0.05 : 0);
  const baseSeconds = crop.minutes * 60;
  const baseHalfRemaining = crop.halfRemaining * 60;
  const matureDuration = floorSeconds(baseSeconds / speed);
  const halfRemaining = floorSeconds(baseHalfRemaining / speed);
  const reverseToHalfDuration = floorSeconds((baseSeconds - baseHalfRemaining) / speed);
  const toHalfDuration = state.mode === "forward" || state.targetStage === "ripe"
    ? matureDuration - halfRemaining
    : reverseToHalfDuration;
  const savedDuration = baseSeconds - matureDuration;
  const inputTimestamp = readInputTimestamp();
  if (inputTimestamp === null) return null;

  let plantTimestamp;
  let halfTimestamp;
  let ripeTimestamp;
  if (state.mode === "forward") {
    plantTimestamp = inputTimestamp;
    halfTimestamp = plantTimestamp + toHalfDuration * 1000;
    ripeTimestamp = plantTimestamp + matureDuration * 1000;
  } else if (state.targetStage === "ripe") {
    ripeTimestamp = inputTimestamp;
    plantTimestamp = ripeTimestamp - matureDuration * 1000;
    halfTimestamp = ripeTimestamp - halfRemaining * 1000;
  } else {
    halfTimestamp = inputTimestamp;
    plantTimestamp = halfTimestamp - toHalfDuration * 1000;
    ripeTimestamp = halfTimestamp + halfRemaining * 1000;
  }

  return { crop, speed, matureDuration, halfRemaining, toHalfDuration, savedDuration, plantTimestamp, halfTimestamp, ripeTimestamp };
}

function timezoneOffsetMinutes(timestamp, zone) {
  const p = getPartsInZone(new Date(timestamp), zone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - timestamp) / 60000);
}

function formatMinuteDifference(minutes) {
  if (minutes === 0) return "与北京时间相同";
  const direction = minutes > 0 ? "快" : "慢";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  const amount = [hours ? `${hours}小时` : "", rest ? `${rest}分钟` : ""].filter(Boolean).join("");
  return `比北京${direction} ${amount}`;
}

function zoneSummary(zone, timestamp = Date.now()) {
  const zoneName = new Intl.DateTimeFormat("zh-CN", {
    timeZone: zone,
    timeZoneName: "short",
  }).formatToParts(new Date(timestamp)).find((part) => part.type === "timeZoneName")?.value || "当地时区";
  const difference = timezoneOffsetMinutes(timestamp, zone) - timezoneOffsetMinutes(timestamp, BEIJING_ZONE);
  return { zoneName, difference };
}

function selectedSecondaryZone() {
  return state.secondaryZone === "device" ? LOCAL_ZONE : state.secondaryZone;
}

function zoneCityLabel(zone) {
  if (state.secondaryZone === "device" && zone === LOCAL_ZONE) {
    return `设备 · ${ZONE_LABELS[zone] || zone.split("/").pop().replaceAll("_", " ")}`;
  }
  return ZONE_LABELS[zone] || zone.split("/").pop().replaceAll("_", " ");
}

function updateTimezoneLabels(timestamp = Date.now()) {
  const deviceSummary = zoneSummary(LOCAL_ZONE, timestamp);
  const deviceCity = ZONE_LABELS[LOCAL_ZONE] || LOCAL_ZONE.split("/").pop().replaceAll("_", " ");
  const zone = selectedSecondaryZone();
  const summary = zoneSummary(zone, timestamp);
  const city = zoneCityLabel(zone);
  elements.localTimezoneName.textContent = `${city} · ${summary.zoneName}`;
  elements.timezoneDifference.textContent = formatMinuteDifference(summary.difference);
  elements.inputLocalZone.textContent = `${deviceCity} · ${deviceSummary.zoneName}`;
  elements.secondaryZoneHeader.textContent = city;
  elements.mobileSecondaryLabel.textContent = city;
  document.body.classList.toggle("same-timezone", summary.difference === 0);
}

function comparisonPlantTimestamp(crop, fertilizer, targetTimestamp) {
  const speed = 1 + fertilizer + (state.weekend ? 0.05 : 0);
  const baseSeconds = crop.minutes * 60;
  const halfRemaining = crop.halfRemaining * 60;
  const duration = state.targetStage === "ripe"
    ? floorSeconds(baseSeconds / speed)
    : floorSeconds((baseSeconds - halfRemaining) / speed);
  return targetTimestamp - duration * 1000;
}

function comparisonHarvestTimestamps(crop, fertilizer, plantTimestamp) {
  const speed = 1 + fertilizer + (state.weekend ? 0.05 : 0);
  const matureDuration = floorSeconds((crop.minutes * 60) / speed);
  const halfRemaining = floorSeconds((crop.halfRemaining * 60) / speed);
  return {
    half: plantTimestamp + (matureDuration - halfRemaining) * 1000,
    ripe: plantTimestamp + matureDuration * 1000,
  };
}

function renderComparison(targetTimestamp) {
  const cropRows = [
    ["short", "15分钟", "香蕉等"],
    ["medium", "1小时", "菠萝等"],
    ["peach", "6小时", "桃子"],
    ["long", "16小时", "牛油果等"],
  ];
  const fertilizers = [[0, "不施肥"], [0.1, "蓝肥"], [0.3, "紫肥"], [0.5, "金肥"]];
  const cells = [];
  const corner = document.createElement("div");
  corner.className = "comparison-cell comparison-cell--head comparison-cell--crop";
  corner.textContent = "作物";
  cells.push(corner);
  fertilizers.forEach(([bonus, label]) => {
    const cell = document.createElement("div");
    cell.className = "comparison-cell comparison-cell--head";
    cell.innerHTML = `<b>${label}</b><small>${bonus ? `+${bonus * 100}%` : "自然"}</small>`;
    cells.push(cell);
  });
  cropRows.forEach(([key, timeLabel, cropLabel]) => {
    const cropCell = document.createElement("div");
    cropCell.className = `comparison-cell comparison-cell--crop${state.crop === key ? " is-current" : ""}`;
    cropCell.innerHTML = `<b>${timeLabel}</b><small>${cropLabel}</small>`;
    cells.push(cropCell);
    fertilizers.forEach(([bonus]) => {
      const cell = document.createElement("div");
      cell.className = `comparison-cell${state.crop === key && state.fertilizer === bonus ? " is-current" : ""}`;
      if (state.mode === "reverse") {
        const value = formatDateTimeParts(comparisonPlantTimestamp(CROPS[key], bonus, targetTimestamp), BEIJING_ZONE);
        cell.innerHTML = `<small class="date-display">${value.date.slice(5)}</small><strong>${value.time}</strong>`;
      } else {
        const values = comparisonHarvestTimestamps(CROPS[key], bonus, targetTimestamp);
        const half = formatDateTimeParts(values.half, BEIJING_ZONE);
        const ripe = formatDateTimeParts(values.ripe, BEIJING_ZONE);
        cell.classList.add("comparison-cell--harvest");
        cell.innerHTML = `<span><i>半熟</i><small class="date-display">${half.date.slice(5)}</small><strong>${half.time}</strong></span><span><i>成熟</i><small class="date-display">${ripe.date.slice(5)}</small><strong>${ripe.time}</strong></span>`;
      }
      cells.push(cell);
    });
  });
  elements.comparisonTable.replaceChildren(...cells);
}

function render() {
  const result = getCalculation();
  if (!result) return;
  const { crop, speed, matureDuration, halfRemaining, toHalfDuration, savedDuration, plantTimestamp, halfTimestamp, ripeTimestamp } = result;

  elements.speed.textContent = `×${speed.toFixed(2)}`;
  elements.saving.textContent = savedDuration > 0
    ? `节省 ${((savedDuration / (crop.minutes * 60)) * 100).toFixed(1)}% 时间`
    : "按原始时长生长";

  const reverseTarget = state.targetStage === "ripe" ? "成熟" : "半熟";
  elements.resultKicker.textContent = `${crop.name} · ${state.mode === "forward" ? "收获安排" : `${reverseTarget}倒推`}`;
  if (state.mode === "forward") {
    elements.duration.textContent = durationText(matureDuration);
    elements.subtitle.textContent = "种下后成熟所需时间";
  } else {
    const plantBeijing = formatDateTimeParts(plantTimestamp, BEIJING_ZONE);
    elements.duration.textContent = `北京 ${plantBeijing.time}`;
    setTextWithDate(elements.subtitle, "", plantBeijing.date, " 建议种下");
  }

  setTimeCell(elements.cells.plant.beijing, plantTimestamp, BEIJING_ZONE);
  const secondaryZone = selectedSecondaryZone();
  setTimeCell(elements.cells.plant.local, plantTimestamp, secondaryZone);
  setTimeCell(elements.cells.half.beijing, halfTimestamp, BEIJING_ZONE);
  setTimeCell(elements.cells.half.local, halfTimestamp, secondaryZone);
  setTimeCell(elements.cells.ripe.beijing, ripeTimestamp, BEIJING_ZONE);
  setTimeCell(elements.cells.ripe.local, ripeTimestamp, secondaryZone);

  elements.halfOffset.textContent = `种下后 ${durationText(toHalfDuration)}`;
  elements.ripeOffset.textContent = `半熟后约 ${durationText(halfRemaining)}`;
  elements.saved.textContent = durationText(savedDuration);
  elements.halfRemaining.textContent = durationText(halfRemaining);
  elements.warning.hidden = state.comparison || !(state.mode === "reverse" && plantTimestamp < Date.now());
  elements.warningText.textContent = `建议种植时间已经过去，请把目标${reverseTarget}时间往后调整。`;
  elements.resultCard.classList.toggle("is-reverse", state.mode === "reverse");

  const keyTimestamp = state.mode === "reverse" ? plantTimestamp : ripeTimestamp;
  const keyBeijing = formatDateTimeParts(keyTimestamp, BEIJING_ZONE);
  const keyLocal = formatDateTimeParts(keyTimestamp, secondaryZone);
  elements.mobileResultLabel.textContent = state.mode === "reverse" ? "建议种下" : "预计成熟";
  elements.mobileBeijingTime.textContent = `北京 ${keyBeijing.time}`;
  elements.mobileLocalTime.textContent = keyLocal.time;
  elements.dualTimezone.checked = state.dualTimezone;
  elements.comparisonToggle.checked = state.comparison;
  elements.timezoneOverview.hidden = state.comparison || !state.dualTimezone;
  elements.secondaryTimezone.disabled = state.comparison || !state.dualTimezone;
  elements.resultCard.classList.toggle("single-zone", !state.dualTimezone);
  elements.mobileResultPeek.classList.toggle("single-zone", !state.dualTimezone);

  elements.comparisonPanel.hidden = !state.comparison;
  elements.scheduleTable.hidden = state.comparison;
  elements.resultStats.hidden = state.comparison;
  elements.resultCard.classList.toggle("is-comparison", state.comparison);
  document.body.classList.toggle("comparison-mode", state.comparison);
  if (state.comparison) {
    const inputTimestamp = readInputTimestamp();
    const inputBeijing = formatDateTimeParts(inputTimestamp, BEIJING_ZONE);
    renderComparison(inputTimestamp);
    if (state.mode === "reverse") {
      elements.resultKicker.textContent = `${state.targetStage === "ripe" ? "成熟" : "半熟"}目标 · 多方案倒推`;
      elements.duration.textContent = "多方案下种子时间";
      setTextWithDate(elements.subtitle, `${state.weekend ? "有" : "无"}周末加成计算 · 目标${state.targetStage === "ripe" ? "成熟" : "半熟"}时间：`, inputBeijing.date, ` ${inputBeijing.time}`);
    } else {
      elements.resultKicker.textContent = "种下时间 · 多方案正算";
      elements.duration.textContent = "多方案半熟 / 成熟时间";
      setTextWithDate(elements.subtitle, `${state.weekend ? "有" : "无"}周末加成计算 · 种下时间：`, inputBeijing.date, ` ${inputBeijing.time}`);
    }
    elements.mobileResultLabel.textContent = "多方案对比";
    elements.mobileBeijingTime.textContent = "查看 16 组时间";
    elements.mobileResultPeek.classList.add("single-zone");
  }

  const rows = $$(".schedule-row:not(.schedule-row--head)");
  rows.forEach((row) => row.classList.remove("is-focus"));
  const focusIndex = state.mode === "forward" ? 2 : state.targetStage === "half" ? 1 : 2;
  rows[focusIndex]?.classList.add("is-focus");
  updateTimezoneLabels(plantTimestamp);
}

function selectButtons(selector, attribute, value) {
  $$(selector).forEach((button) => {
    const selected = button.dataset[attribute] === String(value);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}

function saveState() {
  localStorage.setItem("pineapple-crop", state.crop);
  localStorage.setItem("pineapple-fertilizer", String(state.fertilizer));
  localStorage.setItem("pineapple-weekend", String(state.weekend));
  localStorage.setItem("pineapple-mode", state.mode);
  localStorage.setItem("pineapple-target-stage", state.targetStage);
  localStorage.setItem("pineapple-input-zone", state.inputZone);
  localStorage.setItem("pineapple-dual-timezone", String(state.dualTimezone));
  localStorage.setItem("pineapple-secondary-zone", state.secondaryZone);
  localStorage.setItem("pineapple-comparison", String(state.comparison));
  localStorage.setItem("pineapple-weekend-override-date", state.weekendOverrideDate);
}

function syncWeekendFromDate() {
  const value = elements.date.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    elements.weekday.textContent = "星期—";
    return;
  }
  const [year, month, day] = value.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 4)).getUTCDay();
  elements.weekday.textContent = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][weekday];
  if (state.weekendOverrideDate === value) return;
  state.weekend = weekday === 5 || weekday === 6 || weekday === 0;
  state.weekendOverrideDate = "";
  elements.weekend.checked = state.weekend;
  saveState();
}

function chooseCrop(crop) {
  state.crop = crop;
  selectButtons(".crop-option", "crop", crop);
  saveState(); render();
}

function chooseFertilizer(value) {
  state.fertilizer = Number(value);
  selectButtons(".fertilizer-option", "bonus", value);
  saveState(); render();
}

function updateTimeControls() {
  const reverse = state.mode === "reverse";
  elements.targetStageControl.hidden = !reverse;
  elements.inputZoneControl.hidden = reverse;
  elements.timeLabel.textContent = reverse
    ? state.targetStage === "ripe" ? "目标成熟时间（北京时间）" : "目标半熟时间（北京时间）"
    : "种下的时间";
  elements.timeBasisBadge.textContent = reverse
    ? "固定按北京时间输入"
    : state.inputZone === "local" ? "按设备当地时间输入" : "按北京时间输入";
  elements.inputNote.textContent = reverse
    ? "游戏目标时间固定按北京时间填写；海外时间对照与多方案对比可按需开启。"
    : "正算时可按北京或设备当地时间输入；海外时间对照与多方案对比可按需开启。";
}

function chooseMode(mode) {
  const currentInstant = readInputTimestamp() || Date.now();
  state.mode = mode;
  $$(".mode-tab").forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  updateTimeControls();
  setInputsToDate(new Date(currentInstant));
  syncWeekendFromDate();
  saveState(); render();
}

function chooseTargetStage(stage) {
  state.targetStage = stage;
  selectButtons(".stage-option", "stage", stage);
  updateTimeControls();
  saveState(); render();
}

function chooseInputZone(zone) {
  const currentInstant = readInputTimestamp() || Date.now();
  state.inputZone = zone;
  selectButtons(".input-zone-option", "inputZone", zone);
  updateTimeControls();
  setInputsToDate(new Date(currentInstant));
  syncWeekendFromDate();
  saveState(); render();
}

function bindEvents() {
  $$(".crop-option").forEach((button) => button.addEventListener("click", () => chooseCrop(button.dataset.crop)));
  $$(".fertilizer-option").forEach((button) => button.addEventListener("click", () => chooseFertilizer(button.dataset.bonus)));
  $$(".mode-tab").forEach((button) => button.addEventListener("click", () => chooseMode(button.dataset.mode)));
  $$(".stage-option").forEach((button) => button.addEventListener("click", () => chooseTargetStage(button.dataset.stage)));
  $$(".input-zone-option").forEach((button) => button.addEventListener("click", () => chooseInputZone(button.dataset.inputZone)));
  elements.weekend.addEventListener("change", () => {
    state.weekend = elements.weekend.checked;
    state.weekendOverrideDate = elements.date.value;
    saveState(); render();
  });
  elements.dualTimezone.addEventListener("change", () => {
    state.dualTimezone = elements.dualTimezone.checked;
    if (state.dualTimezone) state.comparison = false;
    saveState(); render();
  });
  elements.comparisonToggle.addEventListener("change", () => {
    state.comparison = elements.comparisonToggle.checked;
    if (state.comparison) state.dualTimezone = false;
    saveState(); render();
  });
  elements.secondaryTimezone.addEventListener("change", () => {
    state.secondaryZone = elements.secondaryTimezone.value;
    saveState(); render();
  });
  elements.date.addEventListener("input", () => { syncWeekendFromDate(); render(); });
  elements.time.addEventListener("input", render);
  $("#nowButton").addEventListener("click", () => { setInputsToDate(); syncWeekendFromDate(); render(); });
  $("#rulesToggle").addEventListener("click", () => {
    const toggle = $("#rulesToggle");
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    $("#rulesContent").hidden = expanded;
  });
}

function init() {
  if (!CROPS[state.crop]) state.crop = "short";
  if (![0, 0.1, 0.3, 0.5].includes(state.fertilizer)) state.fertilizer = 0;
  if (!["forward", "reverse"].includes(state.mode)) state.mode = "forward";
  if (!["half", "ripe"].includes(state.targetStage)) state.targetStage = "half";
  if (!["beijing", "local"].includes(state.inputZone)) state.inputZone = "beijing";
  if (state.secondaryZone !== "device" && !Object.hasOwn(ZONE_LABELS, state.secondaryZone)) state.secondaryZone = "device";

  elements.weekend.checked = state.weekend;
  elements.dualTimezone.checked = state.dualTimezone;
  elements.comparisonToggle.checked = state.comparison;
  elements.secondaryTimezone.value = state.secondaryZone;
  selectButtons(".crop-option", "crop", state.crop);
  selectButtons(".fertilizer-option", "bonus", state.fertilizer);
  selectButtons(".stage-option", "stage", state.targetStage);
  selectButtons(".input-zone-option", "inputZone", state.inputZone);
  updateTimezoneLabels();
  setInputsToDate();
  syncWeekendFromDate();
  bindEvents();
  chooseMode(state.mode);
}

init();
