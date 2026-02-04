const canvas = document.getElementById("game");
const context = canvas.getContext("2d");

const GAME_WIDTH = 288;
const GAME_HEIGHT = 512;
const GAME_SCALE = 1.5;

canvas.width = GAME_WIDTH * GAME_SCALE;
canvas.height = GAME_HEIGHT * GAME_SCALE;
context.imageSmoothingEnabled = false;

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
  background: assetUrl("sprites/background-day.png"),
  base: assetUrl("sprites/base.png"),
  bird: [
    assetUrl("sprites/yellowbird-downflap.png"),
    assetUrl("sprites/yellowbird-midflap.png"),
    assetUrl("sprites/yellowbird-upflap.png"),
  ],
  pipe: assetUrl("sprites/pipe-green.png"),
  message: assetUrl("sprites/message.png"),
  gameover: assetUrl("sprites/gameover.png"),
  numbers: Array.from({ length: 10 }, (_, index) =>
    assetUrl(`sprites/${index}.png`)
  ),
};

const sounds = {
  wing: new Audio(assetUrl("audio/wing.wav")),
  point: new Audio(assetUrl("audio/point.wav")),
  hit: new Audio(assetUrl("audio/hit.wav")),
  die: new Audio(assetUrl("audio/die.wav")),
  swoosh: new Audio(assetUrl("audio/swoosh.wav")),
};

const loadedImages = {};
let assetsReady = false;
let assetError = null;

const game = {
  state: "ready",
  score: 0,
  best: 0,
};

const physics = {
  gravity: 0.32,
  flap: -5.6,
};

const bird = {
  x: 60,
  y: 150,
  velocity: 0,
  rotation: 0,
  frameIndex: 0,
  frameTimer: 0,
  width: 34,
  height: 24,
};

const base = {
  x: 0,
  y: GAME_HEIGHT - 112,
  speed: 1.5,
  width: 336,
};

const pipes = {
  list: [],
  gap: 100,
  width: 52,
  interval: 95,
  timer: 0,
  minY: -190,
  maxY: -50,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resetGame() {
  game.state = "ready";
  game.score = 0;
  bird.y = 150;
  bird.velocity = 0;
  bird.rotation = 0;
  bird.frameIndex = 0;
  bird.frameTimer = 0;
  pipes.list = [];
  pipes.timer = 0;
}

function startGame() {
  if (game.state === "ready") {
    game.state = "playing";
    sounds.swoosh.currentTime = 0;
    sounds.swoosh.play();
  }
}

function endGame() {
  if (game.state !== "over") {
    game.state = "over";
    sounds.hit.currentTime = 0;
    sounds.hit.play();
    sounds.die.currentTime = 0;
    sounds.die.play();
    game.best = Math.max(game.best, game.score);
  }
}

function flap() {
  bird.velocity = physics.flap;
  sounds.wing.currentTime = 0;
  sounds.wing.play();
}

function handleInput() {
  if (!assetsReady) {
    return;
  }
  if (game.state === "ready") {
    startGame();
    flap();
    return;
  }
  if (game.state === "playing") {
    flap();
    return;
  }
  if (game.state === "over") {
    resetGame();
  }
}

function loadAssets() {
  const sources = [
    sprites.background,
    sprites.base,
    sprites.pipe,
    sprites.message,
    sprites.gameover,
    ...sprites.bird,
    ...sprites.numbers,
  ];

  let loaded = 0;
  sources.forEach((source) => {
    const image = new Image();
    image.src = source;
    image.onload = () => {
      loaded += 1;
      if (loaded === sources.length) {
        assetsReady = true;
        resetGame();
      }
    };
    image.onerror = () => {
      assetError = `Missing asset: ${source}`;
    };
    loadedImages[source] = image;
  });
}

function update() {
  if (!assetsReady) {
    return;
  }

  if (game.state === "playing") {
    bird.velocity += physics.gravity;
    bird.y += bird.velocity;

    bird.rotation = clamp(bird.velocity * 0.1, -0.4, 1.2);

    pipes.timer += 1;
    if (pipes.timer % pipes.interval === 0) {
      const gapY =
        pipes.minY + Math.random() * (pipes.maxY - pipes.minY);
      pipes.list.push({
        x: GAME_WIDTH,
        y: gapY,
        scored: false,
      });
    }

    pipes.list.forEach((pipe) => {
      pipe.x -= base.speed;
    });

    if (pipes.list.length && pipes.list[0].x < -pipes.width) {
      pipes.list.shift();
    }

    base.x = (base.x - base.speed) % (base.width - GAME_WIDTH);

    if (bird.y + bird.height >= base.y) {
      bird.y = base.y - bird.height;
      bird.velocity = 0;
      endGame();
    }

    pipes.list.forEach((pipe) => {
      const topPipeBottom = pipe.y + 320;
      const bottomPipeTop = topPipeBottom + pipes.gap;
      const inPipeX =
        bird.x + bird.width > pipe.x && bird.x < pipe.x + pipes.width;
      const hitsTop = bird.y < topPipeBottom;
      const hitsBottom = bird.y + bird.height > bottomPipeTop;
      if (inPipeX && (hitsTop || hitsBottom)) {
        endGame();
      }

      if (!pipe.scored && pipe.x + pipes.width < bird.x) {
        pipe.scored = true;
        game.score += 1;
        sounds.point.currentTime = 0;
        sounds.point.play();
      }
    });
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
    bird.y = 150 + Math.sin(bird.frameTimer / 10) * 6;
  }

  bird.frameTimer += 1;
  if (bird.frameTimer % 7 === 0) {
    bird.frameIndex = (bird.frameIndex + 1) % sprites.bird.length;
  }
}

function drawBackground() {
  context.drawImage(loadedImages[sprites.background], 0, 0);
}

function drawPipes() {
  pipes.list.forEach((pipe) => {
    context.save();
    context.translate(pipe.x + pipes.width / 2, pipe.y + 320 / 2);
    context.scale(1, -1);
    context.drawImage(loadedImages[sprites.pipe], -pipes.width / 2, -160);
    context.restore();

    const bottomY = pipe.y + 320 + pipes.gap;
    context.drawImage(loadedImages[sprites.pipe], pipe.x, bottomY);
  });
}

function drawBase() {
  const baseImage = loadedImages[sprites.base];
  context.drawImage(baseImage, base.x, base.y);
  context.drawImage(baseImage, base.x + base.width - 1, base.y);
}

function drawBird() {
  const birdImage = loadedImages[sprites.bird[bird.frameIndex]];
  context.save();
  context.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
  context.rotate(bird.rotation);
  context.drawImage(
    birdImage,
    -bird.width / 2,
    -bird.height / 2,
    bird.width,
    bird.height
  );
  context.restore();
}

function drawScore() {
  const digits = game.score.toString().split("");
  const totalWidth = digits.length * 18;
  const startX = GAME_WIDTH / 2 - totalWidth / 2;

  digits.forEach((digit, index) => {
    const numberImage = loadedImages[sprites.numbers[Number(digit)]];
    context.drawImage(numberImage, startX + index * 18, 20);
  });
}

function drawStateOverlay() {
  if (game.state === "ready") {
    const messageImage = loadedImages[sprites.message];
    const targetWidth = 240;
    const scale = targetWidth / messageImage.width;
    const targetHeight = messageImage.height * scale;
    context.drawImage(
      messageImage,
      (GAME_WIDTH - targetWidth) / 2,
      80,
      targetWidth,
      targetHeight
    );
  }

  if (game.state === "over") {
    const gameoverImage = loadedImages[sprites.gameover];
    const targetWidth = 220;
    const scale = targetWidth / gameoverImage.width;
    const targetHeight = gameoverImage.height * scale;
    context.drawImage(
      gameoverImage,
      (GAME_WIDTH - targetWidth) / 2,
      70,
      targetWidth,
      targetHeight
    );
    const bestText = `Best: ${game.best}`;
    context.fillStyle = "rgba(0,0,0,0.6)";
    context.fillRect(58, 210, 172, 54);
    context.fillStyle = "#fff";
    context.font = "18px Trebuchet MS";
    context.fillText(bestText, 78, 238);
    context.fillText("Press R to restart", 64, 262);
  }
}

function render() {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(GAME_SCALE, 0, 0, GAME_SCALE, 0, 0);

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
}

function tick() {
  update();
  render();
  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    handleInput();
  }
  if (event.code === "KeyR") {
    event.preventDefault();
    resetGame();
  }
});

window.addEventListener("click", () => {
  handleInput();
});

loadAssets();
requestAnimationFrame(tick);
