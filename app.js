const CROPS = {
  short: { name: "短熟果", minutes: 15, halfRemaining: 3 },
  medium: { name: "中短熟果", minutes: 60, halfRemaining: 5 },
  peach: { name: "桃子", minutes: 360, halfRemaining: 10 },
  long: { name: "长熟果", minutes: 960, halfRemaining: 10 },
};

const state = {
  crop: localStorage.getItem("pineapple-crop") || "short",
  fertilizer: Number(localStorage.getItem("pineapple-fertilizer") || 0),
  weekend: localStorage.getItem("pineapple-weekend") === "true",
  mode: localStorage.getItem("pineapple-mode") || "forward",
  targetStage: localStorage.getItem("pineapple-target-stage") || "half",
  timezone: localStorage.getItem("pineapple-timezone") || "beijing",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  date: $("#dateInput"),
  time: $("#timeInput"),
  timezone: $("#timezoneSelect"),
  weekend: $("#weekendToggle"),
  speed: $("#speedValue"),
  saving: $("#savingText"),
  resultKicker: $("#resultKicker"),
  duration: $("#durationValue"),
  subtitle: $("#resultSubtitle"),
  plant: $("#plantTime"),
  half: $("#halfTime"),
  ripe: $("#ripeTime"),
  halfOffset: $("#halfOffset"),
  ripeOffset: $("#ripeOffset"),
  saved: $("#savedDuration"),
  halfRemaining: $("#halfRemaining"),
  timezoneBadge: $("#timezoneBadge"),
  warning: $("#resultWarning"),
  warningText: $("#warningText"),
  timeLabel: $("#timeFieldLabel"),
  targetStageControl: $("#targetStageControl"),
  toast: $("#toast"),
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function getPartsInTimezone(date = new Date(), timezone = state.timezone) {
  if (timezone === "local") {
    return {
      year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
      hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds(),
    };
  }

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function setInputsToDate(date = new Date()) {
  const p = getPartsInTimezone(date);
  elements.date.value = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  elements.time.value = `${pad(p.hour)}:${pad(p.minute)}`;
}

function readInputTimestamp() {
  if (!elements.date.value || !elements.time.value) return null;
  const [year, month, day] = elements.date.value.split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = elements.time.value.split(":").map(Number);
  if (state.timezone === "local") return new Date(year, month - 1, day, hour, minute, second).getTime();
  return Date.UTC(year, month - 1, day, hour - 8, minute, second);
}

function formatDateTime(timestamp) {
  const timezone = state.timezone === "beijing" ? "Asia/Shanghai" : undefined;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(timestamp)).replaceAll("/", "-");
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

// Avoid values such as 21600 / 1.35 becoming 15999.999999999998.
// The game-facing rule still floors genuine fractional seconds.
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
  // In forward mode the mature moment is the primary result, so derive the
  // half-ripe point backwards from it to avoid accumulating two floor errors.
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

  return {
    crop, speed, matureDuration, halfRemaining, toHalfDuration, savedDuration,
    plantTimestamp, halfTimestamp, ripeTimestamp,
  };
}

function render() {
  const result = getCalculation();
  if (!result) return;

  const { crop, speed, matureDuration, halfRemaining, toHalfDuration, savedDuration, plantTimestamp, halfTimestamp, ripeTimestamp } = result;
  elements.speed.textContent = `×${speed.toFixed(2)}`;
  elements.saving.textContent = savedDuration > 0 ? `比无加成节省 ${((savedDuration / (crop.minutes * 60)) * 100).toFixed(1)}% 时间` : "按原始时长生长";
  const reverseTarget = state.targetStage === "ripe" ? "成熟" : "半熟";
  elements.resultKicker.textContent = `${crop.name} · ${state.mode === "forward" ? "收获安排" : `${reverseTarget}倒推`}`;
  elements.duration.textContent = state.mode === "forward" ? durationText(matureDuration) : formatDateTime(plantTimestamp);
  elements.subtitle.textContent = state.mode === "forward" ? "种下后成熟所需时间" : "建议在这个时刻种下";
  elements.plant.textContent = formatDateTime(plantTimestamp);
  elements.half.textContent = formatDateTime(halfTimestamp);
  elements.ripe.textContent = formatDateTime(ripeTimestamp);
  elements.halfOffset.textContent = `种下后 ${durationText(toHalfDuration)}`;
  elements.ripeOffset.textContent = `半熟后约 ${durationText(halfRemaining)}`;
  elements.saved.textContent = durationText(savedDuration);
  elements.halfRemaining.textContent = durationText(halfRemaining);
  elements.timezoneBadge.textContent = state.timezone === "beijing" ? "北京时间" : "设备本地时间";
  elements.warning.hidden = !(state.mode === "reverse" && plantTimestamp < Date.now());
  elements.warningText.textContent = `建议种植时间已经过去，请把目标${reverseTarget}时间往后调整。`;
}

function selectButtons(selector, attribute, value) {
  $$(selector).forEach((button) => {
    const selected = button.dataset[attribute] === String(value);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
    if (button.hasAttribute("role") && button.getAttribute("role") === "tab") {
      button.setAttribute("aria-selected", String(selected));
    }
  });
}

function saveState() {
  localStorage.setItem("pineapple-crop", state.crop);
  localStorage.setItem("pineapple-fertilizer", String(state.fertilizer));
  localStorage.setItem("pineapple-weekend", String(state.weekend));
  localStorage.setItem("pineapple-mode", state.mode);
  localStorage.setItem("pineapple-target-stage", state.targetStage);
  localStorage.setItem("pineapple-timezone", state.timezone);
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

function chooseMode(mode) {
  state.mode = mode;
  $$(".mode-tab").forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  elements.targetStageControl.hidden = mode !== "reverse";
  updateTimeLabel();
  saveState(); render();
}

function updateTimeLabel() {
  if (state.mode === "forward") {
    elements.timeLabel.textContent = "种下的时间";
    return;
  }
  elements.timeLabel.textContent = state.targetStage === "ripe" ? "目标成熟时间" : "目标半熟时间";
}

function chooseTargetStage(stage) {
  state.targetStage = stage;
  selectButtons(".stage-option", "stage", stage);
  updateTimeLabel();
  saveState(); render();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

async function shareResult() {
  const result = getCalculation();
  if (!result) return;
  const title = "菠萝农场种植安排";
  const text = [
    `${result.crop.name}｜生长速度 ×${result.speed.toFixed(2)}`,
    `种下：${formatDateTime(result.plantTimestamp)}`,
    `半熟：${formatDateTime(result.halfTimestamp)}`,
    `成熟：${formatDateTime(result.ripeTimestamp)}`,
  ].join("\n");

  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      showToast("种植安排已分享");
      return;
    }
    await navigator.clipboard.writeText(`${title}\n${text}`);
    showToast("种植安排已复制");
  } catch (error) {
    if (error.name !== "AbortError") showToast("暂时无法分享，请截图保存");
  }
}

function bindEvents() {
  $$(".crop-option").forEach((button) => button.addEventListener("click", () => chooseCrop(button.dataset.crop)));
  $$(".fertilizer-option").forEach((button) => button.addEventListener("click", () => chooseFertilizer(button.dataset.bonus)));
  $$(".mode-tab").forEach((button) => button.addEventListener("click", () => chooseMode(button.dataset.mode)));
  $$(".stage-option").forEach((button) => button.addEventListener("click", () => chooseTargetStage(button.dataset.stage)));
  elements.weekend.addEventListener("change", () => {
    state.weekend = elements.weekend.checked;
    saveState(); render();
  });
  elements.timezone.addEventListener("change", () => {
    const currentInstant = readInputTimestamp() || Date.now();
    state.timezone = elements.timezone.value;
    setInputsToDate(new Date(currentInstant));
    saveState(); render();
  });
  elements.date.addEventListener("input", render);
  elements.time.addEventListener("input", render);
  $("#nowButton").addEventListener("click", () => { setInputsToDate(); render(); });
  $("#shareButton").addEventListener("click", shareResult);
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
  if (!["beijing", "local"].includes(state.timezone)) state.timezone = "beijing";

  elements.weekend.checked = state.weekend;
  elements.timezone.value = state.timezone;
  selectButtons(".crop-option", "crop", state.crop);
  selectButtons(".fertilizer-option", "bonus", state.fertilizer);
  selectButtons(".stage-option", "stage", state.targetStage);
  chooseMode(state.mode);
  setInputsToDate();
  bindEvents();
  render();
}

init();
