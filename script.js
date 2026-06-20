const canvas = document.querySelector("#wheel");
const ctx = canvas.getContext("2d");
const form = document.querySelector("#add-form");
const input = document.querySelector("#item-input");
const itemsList = document.querySelector("#items-list");
const spinButton = document.querySelector("#spin-button");
const modal = document.querySelector("#result-modal");
const resultTitle = document.querySelector("#result-title");
const closeModalButton = document.querySelector("#close-modal");
const deleteResultButton = document.querySelector("#delete-result");
const itemCount = document.querySelector("#item-count");
const listStatus = document.querySelector("#list-status");
const soundToggle = document.querySelector("#sound-toggle");
const soundLabel = document.querySelector("#sound-label");

const colors = [
  "#f45b69",
  "#2f80ed",
  "#27ae60",
  "#f2c94c",
  "#9b51e0",
  "#f2994a",
  "#00a8a8",
  "#eb5757",
  "#56ccf2",
  "#6fcf97",
];

let items = ["Pizza", "Movie", "Walk", "Game"];
let rotation = -Math.PI / 2;
let isSpinning = false;
let winningIndex = null;
let soundEnabled = true;
let audioContext = null;
let lastTickIndex = null;

function createAudioContext() {
  if (!audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      soundToggle.disabled = true;
      soundLabel.textContent = "No audio";
      return null;
    }

    audioContext = new AudioContext();
  }

  return audioContext;
}

function scheduleTone(audio, { frequency, duration = 0.08, type = "sine", gain = 0.08, delay = 0 }) {
  const startedAt = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startedAt);
  volume.gain.setValueAtTime(0.0001, startedAt);
  volume.gain.exponentialRampToValueAtTime(gain, startedAt + 0.012);
  volume.gain.exponentialRampToValueAtTime(0.0001, startedAt + duration);

  oscillator.connect(volume);
  volume.connect(audio.destination);
  oscillator.start(startedAt);
  oscillator.stop(startedAt + duration + 0.03);
}

function unlockAudio() {
  const audio = createAudioContext();

  if (!audio) {
    return Promise.resolve(null);
  }

  if (audio.state === "suspended") {
    return audio.resume().then(() => audio).catch(() => null);
  }

  return Promise.resolve(audio);
}

function playTone(options) {
  if (!soundEnabled) {
    return;
  }

  unlockAudio().then((audio) => {
    if (audio) {
      scheduleTone(audio, options);
    }
  });
}

function playButtonSound() {
  playTone({ frequency: 520, duration: 0.07, type: "triangle", gain: 0.09 });
  playTone({ frequency: 780, duration: 0.075, type: "sine", gain: 0.065, delay: 0.03 });
}

function playKeySound() {
  playTone({ frequency: 330 + Math.random() * 90, duration: 0.04, type: "triangle", gain: 0.035 });
}

function playTickSound() {
  playTone({ frequency: 980, duration: 0.032, type: "square", gain: 0.05 });
}

function playResultSound() {
  playTone({ frequency: 440, duration: 0.14, type: "sine", gain: 0.09 });
  playTone({ frequency: 660, duration: 0.16, type: "sine", gain: 0.085, delay: 0.07 });
  playTone({ frequency: 880, duration: 0.18, type: "triangle", gain: 0.08, delay: 0.14 });
}

function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  soundLabel.textContent = enabled ? "Audio on" : "Audio off";
  soundToggle.setAttribute("aria-pressed", String(enabled));

  if (!enabled && audioContext) {
    audioContext.suspend().catch(() => {});
  }
}

function drawWheel() {
  const width = canvas.width;
  const center = width / 2;
  const radius = center - 14;

  ctx.clearRect(0, 0, width, width);
  ctx.save();
  ctx.translate(center, center);
  ctx.rotate(rotation);

  if (items.length === 0) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#e7ebe6";
    ctx.fill();
    ctx.fillStyle = "#6a6f75";
    ctx.font = "700 30px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Add items", 0, 0);
    ctx.restore();
    return;
  }

  const slice = (Math.PI * 2) / items.length;

  items.forEach((item, index) => {
    const start = index * slice;
    const end = start + slice;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    ctx.rotate(start + slice / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = `${items.length > 8 ? 18 : 24}px system-ui, sans-serif`;
    ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
    ctx.shadowBlur = 3;
    ctx.fillText(shorten(item), radius - 26, 0);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.restore();
}

function shorten(text) {
  return text.length > 18 ? `${text.slice(0, 17)}...` : text;
}

function renderItems() {
  itemsList.innerHTML = "";
  itemCount.textContent = items.length;
  listStatus.textContent = isSpinning ? "Spinning" : "Ready";

  items.forEach((item, index) => {
    const li = document.createElement("li");
    const swatch = document.createElement("span");
    const label = document.createElement("span");
    const deleteButton = document.createElement("button");

    swatch.className = "swatch";
    swatch.style.backgroundColor = colors[index % colors.length];
    swatch.style.color = colors[index % colors.length];
    label.textContent = item;
    deleteButton.className = "delete-item";
    deleteButton.type = "button";
    deleteButton.textContent = "x";
    deleteButton.setAttribute("aria-label", `Delete ${item}`);
    deleteButton.addEventListener("click", () => {
      playButtonSound();
      removeItem(index);
    });

    li.append(swatch, label, deleteButton);
    itemsList.append(li);
  });

  spinButton.disabled = items.length === 0 || isSpinning;
}

function removeItem(index) {
  if (isSpinning) {
    return;
  }

  items.splice(index, 1);
  winningIndex = null;
  rotation = -Math.PI / 2;
  renderItems();
  drawWheel();
}

function normalizeRotation(angle) {
  return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

function getWinningIndex() {
  const slice = (Math.PI * 2) / items.length;
  const pointerAngle = -Math.PI / 2;
  const wheelAngleAtPointer = normalizeRotation(pointerAngle - rotation);
  return Math.floor(wheelAngleAtPointer / slice) % items.length;
}

function spinWheel() {
  if (isSpinning || items.length === 0) {
    return;
  }

  isSpinning = true;
  spinButton.disabled = true;
  lastTickIndex = getWinningIndex();
  renderItems();

  const startRotation = rotation;
  const extraTurns = 5 + Math.random() * 3;
  const targetRotation = startRotation + extraTurns * Math.PI * 2 + Math.random() * Math.PI * 2;
  const duration = 3600;
  const startedAt = performance.now();

  function animate(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    rotation = startRotation + (targetRotation - startRotation) * eased;
    drawWheel();

    const tickIndex = getWinningIndex();
    if (tickIndex !== lastTickIndex) {
      playTickSound();
      lastTickIndex = tickIndex;
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }

    isSpinning = false;
    winningIndex = getWinningIndex();
    playResultSound();
    showResult();
    renderItems();
  }

  requestAnimationFrame(animate);
}

function showResult() {
  resultTitle.textContent = items[winningIndex];
  modal.classList.add("open");
}

function closeModal() {
  modal.classList.remove("open");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  playButtonSound();
  const value = input.value.trim();

  if (!value) {
    input.focus();
    return;
  }

  items.push(value);
  input.value = "";
  rotation = -Math.PI / 2;
  renderItems();
  drawWheel();
  input.focus();
});

input.addEventListener("keydown", (event) => {
  if (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete") {
    playKeySound();
  }
});

spinButton.addEventListener("click", () => {
  playButtonSound();
  spinWheel();
});

soundToggle.addEventListener("click", () => {
  setSoundEnabled(!soundEnabled);

  if (soundEnabled) {
    unlockAudio().then(() => playButtonSound());
  }
});

closeModalButton.addEventListener("click", () => {
  playButtonSound();
  closeModal();
});

deleteResultButton.addEventListener("click", () => {
  playButtonSound();
  if (winningIndex !== null) {
    removeItem(winningIndex);
  }

  closeModal();
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    playButtonSound();
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.classList.contains("open")) {
    playButtonSound();
    closeModal();
  }
});

renderItems();
drawWheel();
