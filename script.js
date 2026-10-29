/* ==================================================
   1. 主场景与全局状态
================================================== */

const scene = document.getElementById("scene");
const photo = document.getElementById("photo");
const backdrop = document.getElementById("backdrop");
const startButton = document.getElementById("start");
const status = document.getElementById("status");

const enterMarker = document.getElementById("enter-marker");
const roomView = document.getElementById("room-view");
const roomImage = document.getElementById("room-image");
const roomWord = document.getElementById("room-word");
const roomWarning = document.getElementById("room-warning");
const roomExit = document.getElementById("room-exit");

let started = false;
let roomClickCount = 0;
let roomEnded = false;
let endingLocked = false;
let endingInProgress = false;
let lastRoomWord = "";

let wordTimeouts = [];
let glitchInterval = null;

let hasEnteredRoom = false;
let doorQuestionOpened = false;
let doorAnswerTriggered = false;

let doorQuestionElement = null;
let doorOptionElement = null;
let doorPhraseElement = null;
let doorCorruptionInterval = null;

const current = { x: 0, y: 0 };
const target = { x: 0, y: 0 };

const MAX_OFFSET = 18;
const MAX_TILT = 2.2;
const SMOOTHING = 0.055;

const roomWords = [
  "…",
  "Wither",
  "Collapse",
  "Paradox",
  "Achluophobia",
  "Scatter"
];

function setTarget(x, y) {
  target.x = Math.max(-1, Math.min(1, x));
  target.y = Math.max(-1, Math.min(1, y));
}


/* ==================================================
   2. 主场景视差
================================================== */

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


/* ==================================================
   3. 开始按钮
================================================== */

startButton?.addEventListener("click", (event) => {
  event.preventDefault();

  started = true;
  document.body.classList.add("started");

  if (status) {
    status.textContent = "移动鼠标探索";
  }
});


/* ==================================================
   4. ENTER 文字故障
================================================== */

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


/* ==================================================
   5. 清理房间文字动画
================================================== */

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


/* ==================================================
   6. 房间单词乱码
================================================== */

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


/* ==================================================
   7. 大厅问题显示控制
================================================== */

function updateDoorQuestionVisibility() {
  if (!doorQuestionElement) return;

  const inRoom = document.body.classList.contains("in-room");
  const inBearRoom = document.body.classList.contains("in-bear-room");

  doorQuestionElement.style.display =
    hasEnteredRoom && !inRoom && !inBearRoom
      ? "block"
      : "none";
}


/* ==================================================
   8. 进入隐藏房间
================================================== */

function enterDarkRoom(event) {
  if (!started) return;

  event.preventDefault();
  event.stopPropagation();

  if (document.body.classList.contains("in-room")) return;

  hasEnteredRoom = true;

  document.body.classList.add("in-room");
  setTarget(0, 0);

  updateDoorQuestionVisibility();

  if (endingLocked && roomView) {
    if (roomImage) {
      roomImage.style.visibility = "hidden";
    }

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


/* ==================================================
   9. 房间最终结局：警告、闪屏、黑屏
================================================== */

function playRoomEnding() {
  if (!roomView || !roomWarning || !roomImage) {
    console.error("找不到房间元素，请检查 HTML 中的 ID。");
    endingInProgress = false;
    roomEnded = false;
    return;
  }

  if (endingLocked || roomView.dataset.ending === "true") return;

  roomView.dataset.ending = "true";

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

        flash.style.background = "#000";
        flash.style.opacity = "1";

        setTimeout(() => {
          flash.remove();
        }, 120);
      }
    }, 65);
  }, duration);
}


/* ==================================================
   10. 点击房间图片
================================================== */

roomImage?.addEventListener("click", (event) => {
  event.stopPropagation();

  if (!document.body.classList.contains("in-room")) return;
  if (endingLocked || roomEnded || endingInProgress) return;

  roomClickCount++;

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


/* ==================================================
   11. 退出房间
================================================== */

roomExit?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();

  clearWordTimeouts();

  document.body.classList.remove("in-room");
  setTarget(0, 0);

  updateDoorQuestionVisibility();

  if (endingLocked || endingInProgress) {
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


/* ==================================================
   12. 大厅问题、DONOTANSWER 弹窗、持续乱码
================================================== */

function setupDoorQuestion() {
  if (!document.getElementById("door-event-styles")) {
    const style = document.createElement("style");
    style.id = "door-event-styles";

    style.textContent = `
      #door-question-event {
        position: fixed;
        left: 5vw;
        top: 38%;
        transform: translateY(-50%);
        z-index: 5000;
        width: min(32vw, 380px);
        text-align: left;
        color: #e8e8e8;
        font-family: "Courier New", monospace;
        letter-spacing: 1px;
        text-shadow: 0 0 8px rgba(255,255,255,.22);
        user-select: none;
      }

      #door-question-text {
        display: inline-block;
        max-width: 100%;
        padding: 12px 0;
        font-size: clamp(18px, 2.4vw, 27px);
        line-height: 1.5;
        cursor: pointer;
        transition: color .15s, text-shadow .15s;
      }

      #door-question-text:hover {
        color: #fff;
        text-shadow: 0 0 12px rgba(255,255,255,.7);
      }

      #door-answer-option {
        display: none;
        margin: 10px 0 0;
        padding: 9px 13px;
        width: fit-content;
        max-width: 100%;
        color: #ff2929;
        border: 1px solid rgba(255,30,30,.55);
        background: rgba(0,0,0,.78);
        font: 900 14px "Courier New", monospace;
        letter-spacing: 3px;
        cursor: pointer;
        text-shadow: 2px 0 #740000, -2px 0 #ff0000;
        animation: doorOptionFlicker 1.8s infinite steps(2);
      }

      #door-answer-option:hover {
        background: rgba(80,0,0,.7);
        color: #fff;
      }

      @keyframes doorOptionFlicker {
        0%, 85%, 100% { opacity: 1; }
        87% { opacity: .35; }
        90% { opacity: .9; }
        93% { opacity: .2; }
      }

      .door-answer-burst {
        position: fixed;
        z-index: 99990;
        max-width: 90vw;
        padding: 5px 8px;
        color: #ff2929;
        background: rgba(0,0,0,.72);
        border: 1px solid rgba(255,30,30,.35);
        font: 900 clamp(11px, 1.5vw, 17px) "Courier New", monospace;
        letter-spacing: 1px;
        text-shadow: 2px 0 #000, -2px 0 #ff0000, 0 0 9px #f00;
        pointer-events: none;
        white-space: nowrap;
        animation: doorBurstGlitch .9s steps(2, end) forwards;
      }

      .door-answer-burst::after {
        content: "//// NO SIGNAL ////";
        position: absolute;
        left: 2px;
        top: 1px;
        color: #fff;
        opacity: .3;
        mix-blend-mode: difference;
        pointer-events: none;
      }

      @keyframes doorBurstGlitch {
        0% {
          opacity: 0;
          transform: translate(0, 0) scale(.65) skewX(25deg);
          filter: blur(5px);
        }
        12% {
          opacity: 1;
          transform: translate(-5px, 2px) scale(1.05) skewX(-15deg);
          filter: contrast(2);
        }
        35% {
          opacity: .95;
          transform: translate(4px, -5px) scale(.95) skewX(12deg);
          filter: blur(0);
        }
        65% {
          opacity: .75;
          transform: translate(-3px, 3px) scale(1.02);
          filter: contrast(2) blur(1px);
        }
        82% { opacity: .25; }
        100% {
          opacity: 0;
          transform: translate(8px, -8px) scale(1.12) skewX(-30deg);
          filter: blur(7px);
        }
      }

      #door-phrase.door-corrupted {
        display: inline-block;
        color: #ff3030;
        text-shadow: 2px 0 #000, -2px 0 #f00, 0 0 8px #f00;
        animation: doorPhraseGlitch .16s steps(2, end) infinite;
      }

      @keyframes doorPhraseGlitch {
        0% {
          transform: translate(0, 0);
          clip-path: inset(0 0 0 0);
        }
        25% {
          transform: translate(-2px, 1px);
          clip-path: inset(20% 0 35% 0);
        }
        50% {
          transform: translate(2px, -1px);
          clip-path: inset(60% 0 5% 0);
        }
        75% {
          transform: translate(-1px, 0);
          clip-path: inset(5% 0 70% 0);
        }
        100% {
          transform: translate(0, 0);
          clip-path: inset(0 0 0 0);
        }
      }

      @media (max-width: 600px) {
        #door-question-event {
          left: 6vw;
          top: 30%;
          width: min(70vw, 340px);
        }
      }
    `;

    document.head.appendChild(style);
  }

  const container = document.createElement("div");
  container.id = "door-question-event";
  container.style.display = "none";

  const question = document.createElement("div");
  question.id = "door-question-text";
  question.setAttribute("role", "button");
  question.setAttribute("tabindex", "0");
  question.setAttribute("aria-label", "What's behind the door?");

  const beginning = document.createElement("span");
  beginning.textContent = "What’s behind ";

  const phrase = document.createElement("span");
  phrase.id = "door-phrase";
  phrase.textContent = "the door";

  const punctuation = document.createElement("span");
  punctuation.textContent = "?";

  question.append(beginning, phrase, punctuation);

  const option = document.createElement("button");
  option.id = "door-answer-option";
  option.type = "button";
  option.textContent = "DONOTANSWER";

  container.append(question, option);
  document.body.appendChild(container);

  doorQuestionElement = container;
  doorOptionElement = option;
  doorPhraseElement = phrase;

  function openOption() {
    if (doorAnswerTriggered) return;

    doorQuestionOpened = true;
    doorOptionElement.style.display = "block";
  }

  question.addEventListener("click", openOption);

  question.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openOption();
    }
  });

  option.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (doorAnswerTriggered) return;
    doorAnswerTriggered = true;

    option.style.display = "none";

    const burstTexts = [
      "DONOTANSWER",
      "D0N0T4NSWER",
      "D░N▒T▓A░S▒W▓R",
      "DONOT//ANSWER",
      "N0_ANSWER",
      "▓▒░DONOTANSWER░▒▓",
      "D0N0T_4NSW3R",
      "DONOTANSWER.exe",
      "ERR//DONOTANSWER",
      "NO ANSWER",
      "DONOTANSWER",
      "DONOTANSWER//ERROR",
      "N̸O̸_̸A̸N̸S̸W̸E̸R̸",
      "▒▒▒ DONOTANSWER ▒▒▒",
      "D̷O̷N̷O̷T̷A̷N̷S̷W̷E̷R̷",
      "DO NOT ANSWER",
      "ANSWER DENIED",
      "DONOTANSWER_404",
      "▓▓▓ ERROR ▓▓▓"
    ];

    // 分批出现 54 个小弹窗。
    let spawned = 0;
    const totalPopups = 54;

    const popupSpawner = setInterval(() => {
      for (let batch = 0; batch < 3 && spawned < totalPopups; batch++) {
        const popup = document.createElement("div");
        popup.className = "door-answer-burst";
        popup.textContent = burstTexts[
          Math.floor(Math.random() * burstTexts.length)
        ];

        popup.style.left = `${2 + Math.random() * 82}vw`;
        popup.style.top = `${3 + Math.random() * 88}vh`;
        popup.style.animationDelay = `${Math.random() * 0.18}s`;
        popup.style.fontSize = `${11 + Math.random() * 9}px`;
        popup.style.setProperty(
          "--popup-tilt",
          `${Math.random() * 12 - 6}deg`
        );

        document.body.appendChild(popup);

        setTimeout(() => popup.remove(), 1100);

        spawned++;
      }

      if (spawned >= totalPopups) {
        clearInterval(popupSpawner);
      }
    }, 55);

    // 一秒后把 "the door" 替换成乱码，并持续变化直到刷新。
    setTimeout(() => {
      if (!doorPhraseElement) return;

      const randomGlyphs = "Ж▓※∆Φ░╳Я▒Ψ¤╬Ф∴ΩЖ#%?X_/";

      function updateCorruptedPhrase() {
        if (!doorPhraseElement) return;

        const length = 5 + Math.floor(Math.random() * 7);
        let corrupted = "";

        for (let i = 0; i < length; i++) {
          corrupted += randomGlyphs[
            Math.floor(Math.random() * randomGlyphs.length)
          ];
        }

        doorPhraseElement.textContent = corrupted;

        doorPhraseElement.style.transform =
          `translate(${Math.random() * 4 - 2}px, ${Math.random() * 3 - 1.5}px)`;
      }

      doorPhraseElement.classList.add("door-corrupted");
      updateCorruptedPhrase();

      if (doorCorruptionInterval !== null) {
        clearInterval(doorCorruptionInterval);
      }

      doorCorruptionInterval = setInterval(updateCorruptedPhrase, 85);
    }, 1000);
  });
}

setupDoorQuestion();


/* ==================================================
   13. 房间内独立视差
================================================== */

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







/* ========================================
   BEAR ROOM — 新房间交互
======================================== */

(() => {
  const balloon = document.getElementById("bear-balloon");
  const bearRoom = document.getElementById("bear-room");
  const bearExit = document.getElementById("bear-exit");
  const bearDialogue = document.getElementById("bear-dialogue");
  const bearReplies = document.querySelectorAll(".bear-reply");

  if (
    !balloon ||
    !bearRoom ||
    !bearExit ||
    !bearDialogue ||
    bearReplies.length === 0
  ) {
    console.warn(
      "Bear Room: 请检查 HTML 中的 bear-balloon、bear-room、bear-exit、bear-dialogue 和 bear-reply。"
    );
    return;
  }

  // 点击三次才进入新房间
  let balloonClicks = 0;
  const clicksRequired = 3;

  // 已选回复会一直记录，直到刷新网页
  const selectedReplies = new Set();

  // 记录当前对话，返回房间时保留
  const initialDialogue = "Have you bring some new story today?";

  const replyAnswers = {
    0: "i‘ll catch it anyways...",
    1: "primary destruction awaits",
    2: "then why are you breathing?"
  };

  let glitchTimer = null;

  // 让回复按钮与保存状态同步
  function updateReplies() {
    bearReplies.forEach((button) => {
      const replyId = Number(button.dataset.reply);

      if (selectedReplies.has(replyId)) {
        button.classList.add("bear-selected");
        button.disabled = true;
        button.setAttribute("aria-hidden", "true");
        button.tabIndex = -1;
      } else {
        button.classList.remove("bear-selected");
        button.disabled = false;
        button.removeAttribute("aria-hidden");
        button.tabIndex = 0;
      }
    });
  }

  // 进入房间
  function enterBearRoom() {
    balloonClicks = 0;

    document.body.classList.add("in-bear-room");
    if (typeof updateDoorQuestionVisibility === "function") {
      updateDoorQuestionVisibility();
   }

    // 保留已选选项及当前对话
    updateReplies();

    // 进入时闪一下
    bearRoom.classList.remove("bear-glitching");

    void bearRoom.offsetWidth;

    bearRoom.classList.add("bear-glitching");

    setTimeout(() => {
      bearRoom.classList.remove("bear-glitching");
    }, 260);

    // 新房间的轻微随机故障效果
    if (glitchTimer !== null) {
      clearInterval(glitchTimer);
    }

    glitchTimer = setInterval(() => {
      if (!document.body.classList.contains("in-bear-room")) {
        clearInterval(glitchTimer);
        glitchTimer = null;
        return;
      }

      if (Math.random() < 0.22) {
        bearRoom.classList.add("bear-glitching");

        setTimeout(() => {
          bearRoom.classList.remove("bear-glitching");
        }, 260);
      }
    }, 1400);
  }

  // 主场景气球：点击三次进入
  balloon.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (document.body.classList.contains("in-room")) return;
    if (document.body.classList.contains("in-bear-room")) return;

    balloonClicks++;

    // 前两次只让气球晃动
    const shape = balloon.querySelector(".balloon-shape");

    if (shape) {
      shape.animate(
        [
          { transform: "rotate(0deg) scale(1)" },
          { transform: "rotate(-8deg) scale(1.04)" },
          { transform: "rotate(7deg) scale(0.98)" },
          { transform: "rotate(0deg) scale(1)" }
        ],
        {
          duration: 260,
          easing: "ease-out"
        }
      );
    }

    if (balloonClicks >= clicksRequired) {
      enterBearRoom();
    }
  });

  // 选择一个回复
  bearReplies.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (!document.body.classList.contains("in-bear-room")) return;

      const replyId = Number(button.dataset.reply);

      // 防止重复选择
      if (selectedReplies.has(replyId)) return;

      // 只隐藏已经点击的选项
      selectedReplies.add(replyId);
      button.classList.add("bear-selected");
      button.disabled = true;
      button.setAttribute("aria-hidden", "true");
      button.tabIndex = -1;

      // 更新底部对话框
      const answer = replyAnswers[replyId];

      if (answer) {
        bearDialogue.textContent = answer;
      }

      // 选择时触发轻微故障闪烁
      bearRoom.classList.remove("bear-glitching");

      void bearRoom.offsetWidth;

      bearRoom.classList.add("bear-glitching");

      setTimeout(() => {
        bearRoom.classList.remove("bear-glitching");
      }, 260);
    });
  });

  // 离开房间：保留选择和对话
  bearExit.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    document.body.classList.remove("in-bear-room");
    if (typeof updateDoorQuestionVisibility === "function") {
     updateDoorQuestionVisibility();
   }

    if (glitchTimer !== null) {
      clearInterval(glitchTimer);
      glitchTimer = null;
    }

    bearRoom.classList.remove("bear-glitching");

    // 下次进入时，重新从 0 次点击开始
    balloonClicks = 0;
  });

  // 初始化
  bearDialogue.textContent = initialDialogue;
  updateReplies();
})();

const bgMusic = document.getElementById("bg-music");
const musicToggle = document.getElementById("music-toggle");

bgMusic.volume = 0.25;

musicToggle.addEventListener("click", async () => {
  if (bgMusic.paused) {
    try {
      await bgMusic.play();
      musicToggle.textContent = "♫ MUSIC: ON";
    } catch (error) {
      musicToggle.textContent = "MUSIC FAILED";
    }
  } else {
    bgMusic.pause();
    musicToggle.textContent = "♫ MUSIC: OFF";
  }
});