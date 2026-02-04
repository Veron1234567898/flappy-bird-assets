const canvas = document.getElementById("game");
const context = canvas.getContext("2d");

const GAME_WIDTH = 288;
const GAME_HEIGHT = 512;
const GAME_SCALE =
  Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--game-scale")
  ) || 1.5;

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

// ... keep sprites/sounds/etc as-is ...

const base = {
  x: 0,
  y: GAME_HEIGHT - 112,
  speed: 1.5,
  width: 336,
};

// ... inside update() ...
      pipes.list.push({
        x: GAME_WIDTH,
        y: gapY,
        scored: false,
      });
// ...
    base.x = (base.x - base.speed) % (base.width - GAME_WIDTH);

    if (bird.y + bird.height >= base.y) {
      bird.y = base.y - bird.height;
      bird.velocity = 0;
      endGame();
    }
// ...
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

// ... in drawScore() ...
  const startX = GAME_WIDTH / 2 - totalWidth / 2;

// ... in drawStateOverlay() ...
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

// ... in render() ...
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
