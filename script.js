
const scene = document.getElementById("scene");
const photo = document.getElementById("photo");
const backdrop = document.getElementById("backdrop");
const startButton = document.getElementById("start");
const status = document.getElementById("status");

// ===== 全局状态 =====

let started = false;
let roomClickCount = 0;
let roomEnded = false;
let endingLocked = false;
let lastRoomWord = "";
let wordTimeouts = [];
let glitchInterval = null;
let endingInProgress = false;

const current = { x: 0, y: 0 };
const target = { x: 0, y: 0 };

const MAX_OFFSET = 18;
const MAX_TILT = 2.2;
const SMOOTHING = 0.055;

function setTarget(x, y) {
  target.x = Math.max(-1, Math.min(1, x));
  target.y = Math.max(-1, Math.min(1, y));
}

// ===== 主场景伪 3D 视差 =====

scene?.addEventListener("mousemove", (event) => {
  if (!started || document.body.classList.contains("in-room")) return;

  const rect = scene.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  setTarget(
    ((event.clientX - rect.left) / rect.width - 0.5) * 2,
    ((event.clientY - rect.top) / rect.height - 0.5) * 2
  );
});

scene?.addEventListener("mouseleave", () => {
  setTarget(0, 0);
});

// ===== 开始按钮 =====

startButton?.addEventListener("click", (event) => {
  event.preventDefault();

  started = true;
  document.body.classList.add("started");

  if (status) {
    status.textContent = "移动鼠标探索";
  }
});

// ===== 主场景动画 =====

function animate() {
  current.x += (target.x - current.x) * SMOOTHING;
  current.y += (target.y - current.y) * SMOOTHING;

  const x = current.x;
  const y = current.y;

  if (photo) {
    photo.style.setProperty("--move-x", `${-x * MAX_OFFSET}px`);
    photo.style.setProperty("--move-y", `${-y * MAX_OFFSET}px`);
    photo.style.setProperty("--rotate-x", `${y * MAX_TILT}deg`);
    photo.style.setProperty("--rotate-y", `${-x * MAX_TILT}deg`);
  }

  if (backdrop) {
    backdrop.style.setProperty("--back-x", `${-x * 7}px`);
    backdrop.style.setProperty("--back-y", `${-y * 5}px`);
  }

  requestAnimationFrame(animate);
}

animate();

// ===== ENTER 文字故障效果 =====

const enterLabel = document.querySelector(".enter-label");
const originalText = "ENTER";
const enterGlitchChars = "▓▒░╳※∆ЖФЯ#%!?01";

function scrambleEnter() {
  if (!enterLabel) return;

  let result = "";

  for (const char of originalText) {
    result += Math.random() < 0.28
      ? enterGlitchChars[
          Math.floor(Math.random() * enterGlitchChars.length)
        ]
      : char;
  }

  enterLabel.textContent = result;
  enterLabel.setAttribute("data-text", result);
}

function glitchLoop() {
  if (enterLabel && Math.random() < 0.35) {
    scrambleEnter();

    setTimeout(() => {
      if (!enterLabel) return;

      enterLabel.textContent = originalText;
      enterLabel.setAttribute("data-text", originalText);
    }, 80 + Math.random() * 180);
  }

  setTimeout(glitchLoop, 120 + Math.random() * 300);
}

glitchLoop();

// ===== 房间元素 =====

const enterMarker = document.getElementById("enter-marker");
const roomView = document.getElementById("room-view");
const roomImage = document.getElementById("room-image");
const roomWord = document.getElementById("room-word");
const roomWarning = document.getElementById("room-warning");
const roomExit = document.getElementById("room-exit");

const roomWords = [
  "…",
  "Wither",
  "Collapse",
  "Paradox",
  "Achluophobia",
  "Scatter"
];

// ===== 清理文字动画 =====

function stopWordGlitch() {
  if (glitchInterval !== null) {
    clearInterval(glitchInterval);
    glitchInterval = null;
  }
}

function clearWordTimeouts() {
  wordTimeouts.forEach((timeout) => clearTimeout(timeout));
  wordTimeouts = [];
  stopWordGlitch();
}

// ===== 房间单词乱码 =====

function startWordGlitch(word) {
  if (!roomWord || endingLocked || roomEnded) return;

  stopWordGlitch();

  const glitchChars = "#%?X_/▒░▓※∆Ж01";

  function updateGlitch() {
    if (endingLocked || roomEnded) {
      stopWordGlitch();
      return;
    }

    const chars = [...word];

    const availableIndexes = chars
      .map((char, index) => ({ char, index }))
      .filter(({ char }) => char !== "…" && char !== " ")
      .map(({ index }) => index);

    if (availableIndexes.length === 0) {
      roomWord.textContent = word;
      roomWord.setAttribute("data-text", word);
      return;
    }

    const changeCount = Math.max(
      1,
      Math.ceil(availableIndexes.length * 0.2)
    );

    for (let i = availableIndexes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableIndexes[i], availableIndexes[j]] =
        [availableIndexes[j], availableIndexes[i]];
    }

    const selectedIndexes = new Set(
      availableIndexes.slice(0, changeCount)
    );

    const result = chars.map((char, index) => {
      if (selectedIndexes.has(index) && Math.random() < 0.75) {
        return glitchChars[
          Math.floor(Math.random() * glitchChars.length)
        ];
      }

      return char;
    }).join("");

    roomWord.textContent = result;
    roomWord.setAttribute("data-text", result);
  }

  updateGlitch();
  glitchInterval = setInterval(updateGlitch, 90);
}

// ===== 进入隐藏房间 =====
// 结局后仍允许进入，但房间会保持黑屏。

function enterDarkRoom(event) {
  if (!started) return;

  event.preventDefault();
  event.stopPropagation();

  if (document.body.classList.contains("in-room")) return;

  document.body.classList.add("in-room");
  setTarget(0, 0);

  // 结局后重新进入：确保房间仍然是黑的。
  if (endingLocked && roomView) {
    roomImage && (roomImage.style.visibility = "hidden");

    Object.assign(roomView.style, {
      background: "#000",
      backgroundImage: "none",
      filter: "none"
    });

    roomView.style.setProperty("--room-x", "0px");
    roomView.style.setProperty("--room-y", "0px");
    roomView.style.setProperty("--room-rx", "0deg");
    roomView.style.setProperty("--room-ry", "0deg");
  }
}

enterMarker?.addEventListener("click", enterDarkRoom);

enterMarker?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    enterDarkRoom(event);
  }
});

// ===== 最终结局 =====

function playRoomEnding() {
  if (!roomView || !roomWarning || !roomImage) {
    console.error("找不到房间元素，请检查 HTML 中的 ID。");
    endingInProgress = false;
    return;
  }

  if (endingLocked || roomView.dataset.ending === "true") return;

  roomView.dataset.ending = "true";

  // 显示红色警告。
  roomWarning.innerHTML =
    'YOU CANNOT FIND <span class="ending-glitch">XXX</span>';

  Object.assign(roomWarning.style, {
    color: "#ff1010",
    fontFamily: '"Courier New", monospace',
    fontWeight: "900",
    textShadow: "2px 0 #700, -2px 0 #f00",
    zIndex: "100",
    position: "relative"
  });

  const glitch = roomWarning.querySelector(".ending-glitch");

  if (glitch) {
    Object.assign(glitch.style, {
      display: "inline-block",
      minWidth: "3ch",
      fontFamily: "monospace"
    });
  }

  roomWarning.classList.add("visible");

  const symbols = "#%?X_/▒░▓※∆Ж01ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const duration = 1000 + Math.random() * 600;

  const glitchTimer = setInterval(() => {
    if (!glitch) return;

    let result = "";
    const length = 3 + Math.floor(Math.random() * 4);

    for (let i = 0; i < length; i++) {
      result += symbols[Math.floor(Math.random() * symbols.length)];
    }

    glitch.textContent = result;
    glitch.style.fontFamily =
      Math.random() < 0.5 ? "monospace" : "Impact, sans-serif";

    glitch.style.transform =
      `translate(${Math.random() * 6 - 3}px, ${Math.random() * 4 - 2}px)`;
  }, 55);

  setTimeout(() => {
    clearInterval(glitchTimer);
    roomWarning.classList.remove("visible");

    const flash = document.createElement("div");
    flash.id = "ending-flash";

    Object.assign(flash.style, {
      position: "fixed",
      inset: "0",
      zIndex: "99999",
      pointerEvents: "none",
      background: "#fff",
      opacity: "1"
    });

    document.body.appendChild(flash);

    let count = 0;

    const flashTimer = setInterval(() => {
      flash.style.background = count % 2 === 0 ? "#000" : "#fff";
      flash.style.opacity = count % 3 === 0 ? "1" : "0.88";
      count++;

      if (count >= 8) {
        clearInterval(flashTimer);

        // 永久锁定房间结局，直到刷新网页。
        endingLocked = true;
        roomEnded = true;
        endingInProgress = false;

        clearWordTimeouts();

        if (roomWord) {
          roomWord.classList.remove("visible");
          roomWord.textContent = "";
          roomWord.removeAttribute("data-text");
        }

        roomImage.style.visibility = "hidden";

        Object.assign(roomView.style, {
          background: "#000",
          backgroundImage: "none",
          filter: "none"
        });

        roomView.style.setProperty("--room-x", "0px");
        roomView.style.setProperty("--room-y", "0px");
        roomView.style.setProperty("--room-rx", "0deg");
        roomView.style.setProperty("--room-ry", "0deg");

        // 闪屏结束后移除临时闪烁层。
        flash.style.background = "#000";
        flash.style.opacity = "1";

        setTimeout(() => {
          flash.remove();
        }, 120);
      }
    }, 65);
  }, duration);
}

// ===== 点击房间图片 =====

roomImage?.addEventListener("click", (event) => {
  event.stopPropagation();

  if (!document.body.classList.contains("in-room")) return;
  if (endingLocked || roomEnded || endingInProgress) return;

  roomClickCount++;

  // 第 20 次点击触发结局。
  if (roomClickCount >= 20) {
    roomEnded = true;
    endingInProgress = true;

    clearWordTimeouts();

    if (roomWord) {
      roomWord.classList.remove("visible");
      roomWord.textContent = "";
      roomWord.removeAttribute("data-text");
    }

    playRoomEnding();
    return;
  }

  let nextWord;

  do {
    nextWord = roomWords[
      Math.floor(Math.random() * roomWords.length)
    ];
  } while (roomWords.length > 1 && nextWord === lastRoomWord);

  lastRoomWord = nextWord;

  clearWordTimeouts();

  if (!roomWord) return;

  roomWord.classList.add("visible");
  roomWord.textContent = nextWord;
  roomWord.setAttribute("data-text", nextWord);

  startWordGlitch(nextWord);

  wordTimeouts.push(setTimeout(() => {
    if (endingLocked || roomEnded) return;

    stopWordGlitch();

    roomWord.classList.remove("visible");
    roomWord.textContent = "";
    roomWord.removeAttribute("data-text");
  }, 1100));
});

// ===== 退出房间 =====
// 结局前正常退出并重置点击次数。
// 结局后只离开房间，不清除结局状态。

roomExit?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();

  clearWordTimeouts();
  document.body.classList.remove("in-room");
  setTarget(0, 0);

  if (endingLocked || endingInProgress) {
    // 保留结局状态，外部场景不受影响。
    return;
  }

  roomClickCount = 0;
  roomEnded = false;
  lastRoomWord = "";

  if (roomWord) {
    roomWord.classList.remove("visible");
    roomWord.textContent = "";
    roomWord.removeAttribute("data-text");
  }

  if (roomWarning) {
    roomWarning.classList.remove("visible");
  }
});

// ===== 房间内独立伪 3D 视差 =====

roomView?.addEventListener("mousemove", (event) => {
  if (!document.body.classList.contains("in-room")) return;
  if (roomEnded || endingLocked || endingInProgress) return;

  const rect = roomView.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;

  roomView.style.setProperty("--room-x", `${-x * 12}px`);
  roomView.style.setProperty("--room-y", `${-y * 12}px`);
  roomView.style.setProperty("--room-rx", `${y * -1.5}deg`);
  roomView.style.setProperty("--room-ry", `${x * 1.5}deg`);
});
