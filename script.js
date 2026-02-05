const canvas = document.getElementById("game");
const context = canvas.getContext("2d");

const ORIGINAL_WIDTH = 288;
const ORIGINAL_HEIGHT = 512;
const GAME_HEIGHT = ORIGINAL_HEIGHT;
const SCALE = GAME_HEIGHT / ORIGINAL_HEIGHT;
const GAME_WIDTH = ORIGINAL_WIDTH * SCALE;
const BACKGROUND_FILL = "#4ec0ca";

const assetBase = new URL(window.location.href);
if (!assetBase.pathname.endsWith("/")) {
  if (assetBase.pathname.includes(".")) {
    assetBase.pathname = assetBase.pathname.replace(/[^/]*$/, "");
  } else {
    assetBase.pathname = `${assetBase.pathname}/`;
  }
}
const assetUrl = (path) => new URL(path, assetBase).toString();

const sprites = {
  background: "Airbrush-image-extender.jpeg",
  base: "sprites/base.png",
  message: "sprites/message.png",
  gameover: "sprites/gameover.png",
  pipe: "sprites/pipe-green.png",
  startButton: "Start-button-sprite.png",
  digits: [
    "sprites/0.png",
    "sprites/1.png",
    "sprites/2.png",
    "sprites/3.png",
    "sprites/4.png",
    "sprites/5.png",
    "sprites/6.png",
    "sprites/7.png",
    "sprites/8.png",
    "sprites/9.png",
  ],
  bird: [
    "sprites/bluebird-upflap.png",
    "sprites/bluebird-midflap.png",
    "sprites/bluebird-downflap.png",
  ],
};

const sounds = {
  flap: "audio/wing.wav",
  point: "audio/point.wav",
  hit: "audio/hit.wav",
  die: "audio/die.wav",
  swoosh: "audio/swoosh.wav",
};

const loadedImages = {};
const loadedAudio = {};
let assetsReady = false;
let assetError = "";

const loadImage = (name, url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ name, url, image });
    image.onerror = () => reject(new Error(`Failed to load ${url}`));
    image.src = assetUrl(url);
  });

const loadAudio = (name, url) => {
  const audio = new Audio(assetUrl(url));
  audio.preload = "auto";
  loadedAudio[name] = audio;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const view = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

const resizeCanvas = () => {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  view.scale = Math.min(
    canvas.width / GAME_WIDTH,
    canvas.height / GAME_HEIGHT
  );
  view.offsetX = (canvas.width - GAME_WIDTH * view.scale) / 2;
  view.offsetY = (canvas.height - GAME_HEIGHT * view.scale) / 2;
  context.imageSmoothingEnabled = false;
};

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const physics = {
  gravity: 0.25 * SCALE,
  jump: -4.6 * SCALE,
};

const base = {
  x: 0,
  y: GAME_HEIGHT - 112 * SCALE,
  width: 336 * SCALE,
  height: 112 * SCALE,
  speed: 1.5 * SCALE,
};

const bird = {
  x: GAME_WIDTH / 2 - (34 * SCALE) / 2,
  y: 150 * SCALE,
  width: 34 * SCALE,
  height: 24 * SCALE,
  velocity: 0,
  rotation: 0,
  frameIndex: 0,
  frameTimer: 0,
  readyFlapTimer: 0,
};

const startButton = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};

const START_BUTTON_SCALE = 0.6;

const pipes = {
  list: [],
  width: 52 * SCALE,
  height: 320 * SCALE,
  gap: 100 * SCALE,
  speed: 1.5 * SCALE,
  spawnTimer: 0,
};

const difficulty = {
  maxSpeedMultiplier: 2.2,
  speedRamp: 0.02,
  minGap: 80 * SCALE,
  gapRamp: 0.4 * SCALE,
  driftBase: 6 * SCALE,
  driftRamp: 0.6 * SCALE,
  driftSpeedBase: 0.02,
  driftSpeedRamp: 0.001,
};

const game = {
  state: "ready",
  score: 0,
  best: Number.parseInt(localStorage.getItem("flappy-best") || "0", 10),
};

const playSound = (name) => {
  const sound = loadedAudio[name];
  if (!sound) return;
  sound.currentTime = 0;
  sound.play().catch(() => {});
};

const resetGame = () => {
  bird.x = GAME_WIDTH / 2 - bird.width / 2;
  bird.y = 150 * SCALE;
  bird.velocity = 0;
  bird.rotation = 0;
  bird.frameIndex = 0;
  bird.frameTimer = 0;
  bird.readyFlapTimer = 0;
  pipes.list = [];
  pipes.spawnTimer = 0;
  game.score = 0;
  base.x = 0;
  game.state = "ready";
};

const startGame = () => {
  if (game.state === "ready") {
    game.state = "playing";
    playSound("swoosh");
  }
};

const endGame = () => {
  if (game.state !== "playing") return;
  game.state = "over";
  playSound("hit");
  playSound("die");
  if (game.score > game.best) {
    game.best = game.score;
    localStorage.setItem("flappy-best", `${game.best}`);
  }
};

const flap = () => {
  if (game.state === "playing") {
    bird.velocity = physics.jump;
    playSound("flap");
  }
};

const getPointerPosition = (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  return {
    x: (x - view.offsetX) / view.scale,
    y: (y - view.offsetY) / view.scale,
  };
};

const isWithinStartButton = (point) =>
  point &&
  point.x >= startButton.x &&
  point.x <= startButton.x + startButton.width &&
  point.y >= startButton.y &&
  point.y <= startButton.y + startButton.height;

const handleInput = (event) => {
  if (!assetsReady) return;
  const pointer = event ? getPointerPosition(event) : null;

  if (game.state === "ready") {
    if (isWithinStartButton(pointer)) {
      startGame();
    }
    return;
  }

  if (game.state === "over") {
    if (isWithinStartButton(pointer)) {
      resetGame();
      startGame();
    }
    return;
  }

  flap();
};

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (game.state === "ready") {
      startGame();
      return;
    }
    if (game.state === "over") {
      resetGame();
      startGame();
      return;
    }
    flap();
  }
  if (event.code === "KeyR") {
    if (game.state === "over") {
      resetGame();
    }
  }
});

window.addEventListener("pointerdown", handleInput);

const spawnPipe = () => {
  const gapY = (80 + Math.random() * 160) * SCALE;
  const effectiveScore = Math.max(0, game.score - 50);
  const difficultyLevel = Math.min(
    effectiveScore,
    (difficulty.maxSpeedMultiplier - 1) / difficulty.speedRamp
  );
  const driftAmplitude =
    difficulty.driftBase + difficultyLevel * difficulty.driftRamp;
  const driftSpeed =
    difficulty.driftSpeedBase + difficultyLevel * difficulty.driftSpeedRamp;
  pipes.list.push({
    x: GAME_WIDTH + pipes.width,
    y: gapY,
    scored: false,
    driftPhase: Math.random() * Math.PI * 2,
    driftAmplitude,
    driftSpeed,
  });
};

const checkCollision = (rect, target) =>
  rect.x < target.x + target.width &&
  rect.x + rect.width > target.x &&
  rect.y < target.y + target.height &&
  rect.y + rect.height > target.y;

const updateBird = () => {
  if (game.state === "playing") {
    bird.velocity += physics.gravity;
    bird.y += bird.velocity;
    bird.rotation = clamp(bird.velocity * 0.1, -0.4, 1.2);
  } else if (game.state === "over") {
    if (bird.y + bird.height < base.y) {
      bird.velocity += physics.gravity;
      bird.y += bird.velocity;
      bird.rotation = clamp(bird.velocity * 0.1, -0.4, 1.2);
      if (bird.y + bird.height >= base.y) {
        bird.y = base.y - bird.height;
        bird.velocity = 0;
        bird.rotation = 1.2;
      }
    }
  } else if (game.state === "ready") {
    bird.readyFlapTimer += 1;
    const targetY = 150 * SCALE;
    if (bird.y > targetY || bird.readyFlapTimer >= 45) {
      bird.velocity = physics.jump;
      bird.readyFlapTimer = 0;
    }
    bird.velocity += physics.gravity;
    bird.y += bird.velocity;
    bird.rotation = clamp(bird.velocity * 0.1, -0.4, 1.2);

    const minY = 60 * SCALE;
    const maxY = base.y - bird.height - 20 * SCALE;
    if (bird.y < minY) {
      bird.y = minY;
      bird.velocity = 0;
    }
    if (bird.y > maxY) {
      bird.y = maxY;
      bird.velocity = 0;
    }
  }

  bird.frameTimer += 1;
  if (bird.frameTimer % 8 === 0) {
    bird.frameIndex = (bird.frameIndex + 1) % sprites.bird.length;
  }
};

const updatePipes = () => {
  if (game.state !== "playing") return;

  const effectiveScore = Math.max(0, game.score - 50);
  const speedMultiplier = Math.min(
    difficulty.maxSpeedMultiplier,
    1 + effectiveScore * difficulty.speedRamp
  );
  const currentSpeed = pipes.speed * speedMultiplier;
  const currentGap = Math.max(
    difficulty.minGap,
    pipes.gap - effectiveScore * difficulty.gapRamp
  );
  const minGapY = 40 * SCALE;
  const maxGapY = base.y - currentGap - 40 * SCALE;

  pipes.spawnTimer += 1;
  if (pipes.spawnTimer >= 90) {
    spawnPipe();
    pipes.spawnTimer = 0;
  }

  pipes.list.forEach((pipe) => {
    pipe.x -= currentSpeed;
    pipe.driftPhase += pipe.driftSpeed;
    pipe.y += Math.sin(pipe.driftPhase) * (pipe.driftAmplitude / 20);
    pipe.y = clamp(pipe.y, minGapY, maxGapY);
  });

  pipes.list = pipes.list.filter((pipe) => pipe.x > -pipes.width);

  const birdBox = {
    x: bird.x,
    y: bird.y,
    width: bird.width,
    height: bird.height,
  };

  pipes.list.forEach((pipe) => {
    const topPipe = {
      x: pipe.x,
      y: pipe.y - pipes.height,
      width: pipes.width,
      height: pipes.height,
    };
    const bottomPipe = {
      x: pipe.x,
      y: pipe.y + currentGap,
      width: pipes.width,
      height: pipes.height,
    };

    if (checkCollision(birdBox, topPipe) || checkCollision(birdBox, bottomPipe)) {
      endGame();
    }

    if (!pipe.scored && pipe.x + pipes.width < bird.x) {
      pipe.scored = true;
      game.score += 1;
      playSound("point");
    }
  });
};

const updateBase = () => {
  if (game.state === "playing") {
    base.x = (base.x - base.speed) % base.width;
    if (base.x > 0) {
      base.x -= base.width;
    }
  }
  if (game.state === "playing") {
    if (bird.y + bird.height >= base.y) {
      bird.y = base.y - bird.height;
      bird.velocity = 0;
      endGame();
    }
  }
};

const update = () => {
  if (!assetsReady) return;
  updateBird();
  updatePipes();
  updateBase();
};

const drawBackground = () => {
  const image = loadedImages[sprites.background];
  const scale = GAME_HEIGHT / image.height;
  const targetWidth = image.width * scale;
  const offsetX = (GAME_WIDTH - targetWidth) / 2;
  context.drawImage(image, offsetX, 0, targetWidth, GAME_HEIGHT);
};

const drawBackdrop = () => {
  const image = loadedImages[sprites.background];
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
  const targetWidth = image.width * scale;
  const targetHeight = image.height * scale;
  const offsetX = (canvas.width - targetWidth) / 2;
  const offsetY = (canvas.height - targetHeight) / 2;
  context.drawImage(image, offsetX, offsetY, targetWidth, targetHeight);
};

const drawBase = () => {
  const image = loadedImages[sprites.base];
  const offset = base.x;
  for (let x = offset; x < GAME_WIDTH + base.width; x += base.width) {
    context.drawImage(image, x, base.y, base.width, base.height);
  }
};

const drawPipes = () => {
  const image = loadedImages[sprites.pipe];
  pipes.list.forEach((pipe) => {
    context.save();
    context.translate(pipe.x + pipes.width / 2, pipe.y - pipes.height / 2);
    context.scale(1, -1);
    context.drawImage(
      image,
      -pipes.width / 2,
      -pipes.height / 2,
      pipes.width,
      pipes.height
    );
    context.restore();

    context.drawImage(
      image,
      pipe.x,
      pipe.y + pipes.gap,
      pipes.width,
      pipes.height
    );
  });
};

const drawBird = () => {
  const image = loadedImages[sprites.bird[bird.frameIndex]];
  context.save();
  context.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
  context.rotate(bird.rotation);
  context.drawImage(
    image,
    -bird.width / 2,
    -bird.height / 2,
    bird.width,
    bird.height
  );
  context.restore();
};

const drawScore = () => {
  const scoreText = `${game.score}`;
  const digitImages = scoreText.split("").map((digit) => {
    const spriteIndex = Number.parseInt(digit, 10);
    return loadedImages[sprites.digits[spriteIndex]];
  });

  const digitWidth = 18 * SCALE;
  const digitHeight = 28 * SCALE;
  const totalWidth = digitImages.length * digitWidth;
  const startX = GAME_WIDTH / 2 - totalWidth / 2;

  digitImages.forEach((image, index) => {
    context.drawImage(
      image,
      startX + index * digitWidth,
      30 * SCALE,
      digitWidth,
      digitHeight
    );
  });
};

const drawNumber = (value, x, y, digitWidth, digitHeight) => {
  const number = `${value}`;
  const images = number.split("").map((digit) => {
    const spriteIndex = Number.parseInt(digit, 10);
    return loadedImages[sprites.digits[spriteIndex]];
  });

  images.forEach((image, index) => {
    context.drawImage(
      image,
      x + index * digitWidth,
      y,
      digitWidth,
      digitHeight
    );
  });
};

const drawStartButton = (centerY) => {
  const image = loadedImages[sprites.startButton];
  const targetWidth = image.width * SCALE * START_BUTTON_SCALE;
  const targetHeight = image.height * SCALE * START_BUTTON_SCALE;
  startButton.width = targetWidth;
  startButton.height = targetHeight;
  startButton.x = GAME_WIDTH / 2 - targetWidth / 2;
  startButton.y = centerY - targetHeight / 2;
  context.drawImage(image, startButton.x, startButton.y, targetWidth, targetHeight);
};

const drawStateOverlay = () => {
  if (game.state === "ready") {
    const messageImage = loadedImages[sprites.message];
    const targetWidth = 240 * SCALE;
    const scale = targetWidth / messageImage.width;
    const targetHeight = messageImage.height * scale;
    context.drawImage(
      messageImage,
      (GAME_WIDTH - targetWidth) / 2,
      80 * SCALE,
      targetWidth,
      targetHeight
    );
    drawStartButton(330 * SCALE);
  }

  if (game.state === "over") {
    context.save();
    context.fillStyle = "rgba(0, 0, 0, 0.4)";
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const gameoverImage = loadedImages[sprites.gameover];
    const titleWidth = 200 * SCALE;
    const titleScale = titleWidth / gameoverImage.width;
    const titleHeight = gameoverImage.height * titleScale;
    context.drawImage(
      gameoverImage,
      (GAME_WIDTH - titleWidth) / 2,
      70 * SCALE,
      titleWidth,
      titleHeight
    );

    const panelWidth = 216 * SCALE;
    const panelHeight = 128 * SCALE;
    const panelX = (GAME_WIDTH - panelWidth) / 2;
    const panelY = 160 * SCALE;
    const panelHeaderHeight = 26 * SCALE;
    context.fillStyle = "#e7d8a6";
    context.fillRect(panelX, panelY, panelWidth, panelHeight);
    context.fillStyle = "#c49a55";
    context.fillRect(panelX, panelY, panelWidth, panelHeaderHeight);
    context.fillStyle = "#8b5b2a";
    context.fillRect(panelX, panelY + panelHeight, panelWidth, 6 * SCALE);
    context.strokeStyle = "#6b3f1b";
    context.lineWidth = 3 * SCALE;
    context.strokeRect(panelX, panelY, panelWidth, panelHeight);

    context.fillStyle = "#b05223";
    context.font = `${12 * SCALE}px Trebuchet MS`;
    context.fillText("MEDAL", panelX + 18 * SCALE, panelY + 18 * SCALE);
    context.fillText("SCORE", panelX + 134 * SCALE, panelY + 18 * SCALE);

    context.fillStyle = "#e6e2dd";
    context.beginPath();
    context.arc(
      panelX + 52 * SCALE,
      panelY + 70 * SCALE,
      20 * SCALE,
      0,
      Math.PI * 2
    );
    context.fill();
    context.strokeStyle = "#c7c1b8";
    context.lineWidth = 2 * SCALE;
    context.stroke();
    context.fillStyle = "#d9d3c7";
    context.beginPath();
    context.arc(
      panelX + 52 * SCALE,
      panelY + 70 * SCALE,
      10 * SCALE,
      0,
      Math.PI * 2
    );
    context.fill();

    const scoreY = panelY + 46 * SCALE;
    const bestY = panelY + 78 * SCALE;
    const digitWidth = 18 * SCALE;
    const digitHeight = 28 * SCALE;
    const scoreX = panelX + 136 * SCALE;
    drawNumber(game.score, scoreX, scoreY, digitWidth, digitHeight);
    drawNumber(game.best, scoreX, bestY, digitWidth, digitHeight);

    if (game.score >= game.best && game.score > 0) {
      context.fillStyle = "#e84d2f";
      context.fillRect(panelX + 120 * SCALE, panelY + 90 * SCALE, 44 * SCALE, 16 * SCALE);
      context.fillStyle = "#f7f2e8";
      context.font = `${10 * SCALE}px Trebuchet MS`;
      context.fillText("NEW", panelX + 128 * SCALE, panelY + 102 * SCALE);
    }

    drawStartButton(340 * SCALE);
    context.restore();
  }
};

const render = () => {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (assetsReady) {
    drawBackdrop();
  } else {
    context.fillStyle = BACKGROUND_FILL;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);

  if (!assetsReady) {
    context.fillStyle = "#0f0f0f";
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    context.fillStyle = "#fff";
    context.font = "16px Trebuchet MS";
    if (assetError) {
      context.fillText("Assets not found.", 70, 235);
      context.font = "12px Trebuchet MS";
      context.fillText(assetError, 30, 260);
    } else {
      context.fillText("Loading assets...", 70, 250);
    }
    return;
  }

  drawBackground();
  drawPipes();
  drawBase();
  drawBird();
  drawScore();
  drawStateOverlay();
};

const tick = () => {
  update();
  render();
  requestAnimationFrame(tick);
};

Promise.all([
  loadImage("background", sprites.background),
  loadImage("base", sprites.base),
  loadImage("message", sprites.message),
  loadImage("gameover", sprites.gameover),
  loadImage("pipe", sprites.pipe),
  loadImage("start-button", sprites.startButton),
  ...sprites.digits.map((digit, index) => loadImage(`digit-${index}`, digit)),
  ...sprites.bird.map((frame, index) => loadImage(`bird-${index}`, frame)),
])
  .then((results) => {
    results.forEach(({ url, image }) => {
      loadedImages[url] = image;
    });
    assetsReady = true;
  })
  .catch((error) => {
    assetError = error.message;
  });

Object.entries(sounds).forEach(([name, url]) => {
  loadAudio(name, url);
});

requestAnimationFrame(tick);
