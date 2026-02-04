const canvas = document.getElementById("game");
const context = canvas.getContext("2d");

const ORIGINAL_WIDTH = 288;
const ORIGINAL_HEIGHT = 512;
const BACKGROUND_WIDTH = 1001;
const BACKGROUND_HEIGHT = 563;
const GAME_WIDTH = BACKGROUND_WIDTH;
const GAME_HEIGHT = BACKGROUND_HEIGHT;
const SCALE = GAME_HEIGHT / ORIGINAL_HEIGHT;
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
  x: 60 * SCALE,
  y: 150 * SCALE,
  width: 34 * SCALE,
  height: 24 * SCALE,
  velocity: 0,
  rotation: 0,
  frameIndex: 0,
  frameTimer: 0,
};

const pipes = {
  list: [],
  width: 52 * SCALE,
  height: 320 * SCALE,
  gap: 100 * SCALE,
  speed: 1.5 * SCALE,
  spawnTimer: 0,
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
  bird.y = 150 * SCALE;
  bird.velocity = 0;
  bird.rotation = 0;
  bird.frameIndex = 0;
  bird.frameTimer = 0;
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
  if (game.state === "ready") {
    startGame();
  }
  if (game.state === "playing") {
    bird.velocity = physics.jump;
    playSound("flap");
  }
};

const handleInput = () => {
  if (!assetsReady) return;
  if (game.state === "over") {
    resetGame();
    return;
  }
  flap();
};

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    handleInput();
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
  pipes.list.push({
    x: GAME_WIDTH,
    y: gapY,
    scored: false,
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
    bird.frameTimer += 1;
    bird.y = 150 * SCALE + Math.sin(bird.frameTimer / 10) * 6 * SCALE;
  }

  bird.frameTimer += 1;
  if (bird.frameTimer % 8 === 0) {
    bird.frameIndex = (bird.frameIndex + 1) % sprites.bird.length;
  }
};

const updatePipes = () => {
  if (game.state !== "playing") return;

  pipes.spawnTimer += 1;
  if (pipes.spawnTimer >= 90) {
    spawnPipe();
    pipes.spawnTimer = 0;
  }

  pipes.list.forEach((pipe) => {
    pipe.x -= pipes.speed;
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
      y: pipe.y + pipes.gap,
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
    base.x -= base.speed;
    if (base.x <= -base.width) {
      base.x += base.width;
    }
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
  context.drawImage(image, 0, 0, GAME_WIDTH, GAME_HEIGHT);
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

    context.fillStyle = "#d9b264";
    context.fillRect(44 * SCALE, 168 * SCALE, 200 * SCALE, 124 * SCALE);
    context.fillStyle = "#c28a3a";
    context.fillRect(44 * SCALE, 168 * SCALE, 200 * SCALE, 24 * SCALE);
    context.fillStyle = "#7a4d1c";
    context.fillRect(44 * SCALE, 292 * SCALE, 200 * SCALE, 6 * SCALE);
    context.strokeStyle = "#3d2312";
    context.lineWidth = 3 * SCALE;
    context.strokeRect(44 * SCALE, 168 * SCALE, 200 * SCALE, 124 * SCALE);

    context.fillStyle = "#f8e7b4";
    context.font = `${14 * SCALE}px Trebuchet MS`;
    context.fillText("Results", 120 * SCALE, 186 * SCALE);

    context.fillStyle = "#5b3215";
    context.font = `${16 * SCALE}px Trebuchet MS`;
    context.fillText("Score", 66 * SCALE, 220 * SCALE);
    context.fillText("Best", 66 * SCALE, 250 * SCALE);

    context.fillStyle = "#2b170f";
    context.font = `${20 * SCALE}px Trebuchet MS`;
    context.fillText(`${game.score}`, 190 * SCALE, 220 * SCALE);
    context.fillText(`${game.best}`, 190 * SCALE, 250 * SCALE);

    context.fillStyle = "#fff2c9";
    context.font = `${13 * SCALE}px Trebuchet MS`;
    context.fillText(
      "Tap / Space to try again",
      62 * SCALE,
      278 * SCALE
    );
    context.restore();
  }
};

const render = () => {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (assetsReady) {
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
