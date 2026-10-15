```javascript
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

const $ = id => document.getElementById(id);

const CHARACTERS = {
  yuji: {
    name: "YUJI ITADORI",
    short: "YUJI",
    hair: "#e85b70",
    skin: "#f3c39c",
    clothes: "#242b49",
    accent: "#e94254"
  },
  gojo: {
    name: "SATORU GOJO",
    short: "GOJO",
    hair: "#f0f2ff",
    skin: "#f1c4a7",
    clothes: "#171a32",
    accent: "#39a9ff"
  },
  sukuna: {
    name: "RYOMEN SUKUNA",
    short: "SUKUNA",
    hair: "#b83d4a",
    skin: "#f0b58e",
    clothes: "#33202d",
    accent: "#ff3152"
  },
  megumi: {
    name: "MEGUMI FUSHIGURO",
    short: "MEGUMI",
    hair: "#25283d",
    skin: "#e6b494",
    clothes: "#20283d",
    accent: "#a46aff"
  }
};

let playerChoice = "yuji";
let enemyChoice = "sukuna";
let player;
let enemy;
let playing = false;
let timeLeft = 60;
let lastTime = 0;
let timerAccumulator = 0;
let message = "CHOOSE YOUR FIGHTERS";
let keys = {};
let effects = [];

function makeFighter(id, x, facing) {
  return {
    id,
    data: CHARACTERS[id],
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing,
    health: 100,
    energy: 0,
    grounded: true,
    action: "idle",
    frame: 0,
    actionTime: 0,
    attackCooldown: 0,
    invulnerable: 0,
    block: false
  };
}

function buildChoices(containerId, isEnemy) {
  const container = $(containerId);
  container.innerHTML = "";

  for (const [id, data] of Object.entries(CHARACTERS)) {
    const card = document.createElement("button");
    card.className = "character";
    card.dataset.id = id;
    card.type = "button";

    const preview = document.createElement("canvas");
    preview.width = 48;
    preview.height = 64;

    const name = document.createElement("strong");
    name.textContent = data.short;

    card.append(preview, name);
    container.appendChild(card);

    const previewCtx = preview.getContext("2d");
    drawPixelFighter(previewCtx, 24, 56, data, 0, "idle", 0, 1);

    card.addEventListener("click", () => {
      if (isEnemy) {
        enemyChoice = id;
        if (enemyChoice === playerChoice) {
          message = "PICK TWO DIFFERENT FIGHTERS!";
          updateCards();
          return;
        }
      } else {
        playerChoice = id;
        if (playerChoice === enemyChoice) {
          enemyChoice = Object.keys(CHARACTERS).find(k => k !== id);
        }
      }

      updateCards();
      updateMatchup();
      resetRound(false);
    });
  }
}

function updateCards() {
  document.querySelectorAll("#playerChoices .character").forEach(card => {
    card.classList.toggle("selected", card.dataset.id === playerChoice);
  });

  document.querySelectorAll("#enemyChoices .character").forEach(card => {
    card.classList.toggle("selected", card.dataset.id === enemyChoice);
  });
}

function updateMatchup() {
  $("matchup").textContent =
    CHARACTERS[playerChoice].short + " VS " +
    CHARACTERS[enemyChoice].short;
}

function resetRound(startImmediately = false) {
  player = makeFighter(playerChoice, 250, 1);
  enemy = makeFighter(enemyChoice, 650, -1);
  timeLeft = 60;
  timerAccumulator = 0;
  effects = [];
  playing = startImmediately;
  message = startImmediately ? "FIGHT!" : "PRESS START TO FIGHT";
  updateHUD();
  drawScene();
}

$("startButton").addEventListener("click", () => {
  resetRound(true);
});

window.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();

  if (["a", "d", "w", "j", "k", "l", "i", " "].includes(key)) {
    event.preventDefault();
  }

  keys[key] = true;

  if (event.repeat || !playing) return;

  if (key === "w" && player.grounded) {
    player.vy = -10;
    player.grounded = false;
    player.action = "jump";
    player.actionTime = 0;
  }

  if (key === "j") attack(player, "punch");
  if (key === "k") attack(player, "kick");
  if (key === "l") special(player);
});

window.addEventListener("keyup", event => {
  keys[event.key.toLowerCase()] = false;
});

function attack(fighter, type) {
  if (!playing || fighter.attackCooldown > 0) return;

  fighter.action = type;
  fighter.actionTime = 0;
  fighter.attackCooldown = type === "punch" ? 0.35 : 0.55;
  fighter.block = false;

  const target = fighter === player ? enemy : player;
  const reach = type === "kick" ? 86 : 68;

  const distance = Math.abs(target.x - fighter.x);
  const inFront = (target.x - fighter.x) * fighter.facing > 0;

  if (distance < reach && inFront && target.invulnerable <= 0) {
    const blocked = target.block;
    const damage = type === "kick" ? 12 : 8;

    target.health = Math.max(0, target.health - (blocked ? 2 : damage));
    target.invulnerable = 0.25;
    target.x += fighter.facing * (blocked ? 4 : 15);
    fighter.energy = Math.min(100, fighter.energy + 12);
    effects.push({
      x: target.x,
      y: 235,
      life: 0.22,
      color: fighter.data.accent
    });

    if (target.health <= 0) finishRound(fighter);
  }
}

function special(fighter) {
  if (!playing || fighter.energy < 40 || fighter.attackCooldown > 0) {
    message = "NEED 40 ENERGY FOR SPECIAL!";
    return;
  }

  fighter.energy -= 40;
  fighter.action = "special";
  fighter.actionTime = 0;
  fighter.attackCooldown = 1;

  const target = fighter === player ? enemy : player;
  const distance = Math.abs(target.x - fighter.x);
  const inFront = (target.x - fighter.x) * fighter.facing > 0;

  effects.push({
    x: fighter.x + fighter.facing * 45,
    y: 220,
    life: 0.5,
    color: fighter.data.accent
  });

  if (distance < 250 && inFront && target.invulnerable <= 0) {
    target.health = Math.max(0, target.health - 22);
    target.invulnerable = 0.5;
    target.x += fighter.facing * 28;
    if (target.health <= 0) finishRound(fighter);
  }
}

function finishRound(winner) {
  playing = false;
  message = winner === player ? "YOU WIN!" : "YOU LOSE!";
}

function updateHUD() {
  $("playerName").textContent = CHARACTERS[playerChoice].short;
  $("enemyName").textContent = CHARACTERS[enemyChoice].short;
  $("playerHealth").style.width = player.health + "%";
  $("enemyHealth").style.width = enemy.health + "%";
  $("playerHP").textContent = player.health + " HP";
  $("enemyHP").textContent = enemy.health + " HP";
  $("timer").textContent = timeLeft;
  $("message").textContent = message;
}

function updateFighter(fighter, delta, isPlayer) {
  fighter.actionTime += delta;
  fighter.frame += delta * (fighter.action === "run" ? 12 : 8);

  fighter.attackCooldown = Math.max(0, fighter.attackCooldown - delta);
  fighter.invulnerable = Math.max(0, fighter.invulnerable - delta);

  if (fighter.action === "punch" && fighter.actionTime > 0.28) {
    fighter.action = "idle";
  }
  if (fighter.action === "kick" && fighter.actionTime > 0.4) {
    fighter.action = "idle";
  }
  if (fighter.action === "special" && fighter.actionTime > 0.5) {
    fighter.action = "idle";
  }

  if (isPlayer) {
    fighter.block = !!keys.i;

    if (fighter.action !== "punch" &&
        fighter.action !== "kick" &&
        fighter.action !== "special") {
      fighter.vx = 0;

      if (keys.a) {
        fighter.vx = -220;
        fighter.facing = -1;
      }

      if (keys.d) {
        fighter.vx = 220;
        fighter.facing = 1;
      }

      if (!fighter.grounded) {
        fighter.action = "jump";
      } else if (fighter.vx !== 0) {
        fighter.action = Math.abs(fighter.vx) > 180 ? "run" : "walk";
      } else if (!fighter.block) {
        fighter.action = "idle";
      } else {
        fighter.action = "block";
      }
    }
  } else {
    const distance = player.x - fighter.x;
    fighter.facing = distance >= 0 ? 1 : -1;
    fighter.vx = 0;

    if (fighter.action !== "punch" &&
        fighter.action !== "kick" &&
        fighter.action !== "special") {
      if (Math.abs(distance) > 80) {
        fighter.vx = Math.sign(distance) * 115;
        fighter.action = "walk";
      } else if (fighter.attackCooldown <= 0) {
        if (Math.random() < 0.018) {
          special(fighter);
        } else if (Math.random() < 0.08) {
          attack(fighter, Math.random() < 0.5 ? "punch" : "kick");
        } else {
          fighter.action = "idle";
        }
      }
    }
  }

  fighter.x += fighter.vx * delta;
  fighter.x = Math.max(35, Math.min(canvas.width - 35, fighter.x));

  fighter.vy += 25 * delta;
  fighter.y += fighter.vy;

  if (fighter.y >= 0) {
    fighter.y = 0;
    fighter.vy = 0;
    fighter.grounded = true;
  } else {
    fighter.grounded = false;
  }
}

function drawPixelFighter(c, x, groundY, data, frame, action, facing, yOffset = 0) {
  c.save();
  c.translate(x, groundY + yOffset);
  c.scale(facing, 1);

  const bob = action === "idle" ? Math.sin(frame * 4) * 1.5 : 0;
  const walk = action === "walk" || action === "run"
    ? Math.sin(frame * 8) * 4
    : 0;

  // Pixel shadow
  c.fillStyle = "#03040a";
  c.fillRect(-16, -3, 32, 4);

  // Legs
  c.fillStyle = data.clothes;

  if (action === "kick") {
    c.fillRect(-8, -28, 8, 25);
    c.fillRect(0, -30, 21 + Math.sin(frame * 8) * 3, 7);
  } else {
    c.fillRect(-10, -30 + walk, 8, 27);
    c.fillRect(3, -30 - walk, 8, 27);
  }

  // Shoes
  c.fillStyle = "#15151b";
  c.fillRect(-13, -5 + walk, 13, 5);
  c.fillRect(1, -5 - walk, 13, 5);

  // Body
  c.fillStyle = data.clothes;
  c.fillRect(-12, -52 + bob, 25, 25);

  // Jacket stripe
  c.fillStyle = data.accent;
  c.fillRect(-4, -50 + bob, 4, 20);

  // Arms
  if (action === "punch" || action === "special") {
    c.fillStyle = data.clothes;
    c.fillRect(7, -48 + bob, 20, 7);
    c.fillStyle = data.skin;
    c.fillRect(24, -49 + bob, 9, 9);
  } else if (action === "block") {
    c.fillStyle = data.clothes;
    c.fillRect(4, -50 + bob, 7, 19);
    c.fillRect(8, -54 + bob, 7, 16);
    c.fillStyle = data.skin;
    c.fillRect(6, -56 + bob, 8, 7);
  } else {
    c.fillStyle = data.clothes;
    c.fillRect(-17, -49 + bob, 7, 20);
    c.fillRect(10, -49 + bob, 7, 20);
    c.fillStyle = data.skin;
    c.fillRect(-18, -31 + bob, 9, 8);
    c.fillRect(10, -31 + bob, 9, 8);
  }

  // Head
  c.fillStyle = data.skin;
  c.fillRect(-9, -70 + bob, 19, 19);

  // Hair
  c.fillStyle = data.hair;
  c.fillRect(-11, -73 + bob, 22, 8);
  c.fillRect(-9, -78 + bob, 6, 8);
  c.fillRect(-2, -80 + bob, 6, 10);
  c.fillRect(5, -76 + bob, 6, 7);

  // Face pixels
  c.fillStyle = "#17151c";
  c.fillRect(2, -64 + bob, 3, 3);
  c.fillRect(-5, -64 + bob, 3, 3);

  if (data.short === "GOJO") {
    c.fillStyle = "#20243b";
    c.fillRect(-10, -65 + bob, 21, 5);
    c.fillStyle = data.accent;
    c.fillRect(-5, -65 + bob, 12, 2);
  }

  if (data.short === "SUKUNA") {
    c.fillStyle = data.accent;
    c.fillRect(-8, -60 + bob, 5, 2);
    c.fillRect(3, -60 + bob, 5, 2);
    c.fillRect(-4, -55 + bob, 10, 2);
  }

  if (data.short === "MEGUMI") {
    c.fillStyle = data.hair;
    c.fillRect(-12, -70 + bob, 6, 12);
    c.fillRect(7, -72 + bob, 6, 13);
  }

  // Special aura
  if (action === "special") {
    c.globalAlpha = 0.8;
    c.fillStyle = data.accent;
    c.fillRect(31, -55 + bob, 8, 8);
    c.fillRect(38, -48 + bob, 5, 5);
    c.fillRect(32, -42 + bob, 7, 4);
    c.globalAlpha = 1;
  }

  c.restore();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#121a2b");
  gradient.addColorStop(1, "#292037");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Moon
  ctx.fillStyle = "#c8d4f3";
  ctx.beginPath();
  ctx.arc(720, 80, 35, 0, Math.PI * 2);
  ctx.fill();

  // City silhouettes
  ctx.fillStyle = "#0b0e19";
  for (let i = 0; i < 12; i++) {
    const x = i * 82;
    const h = 60 + (i * 37 % 110);
    ctx.fillRect(x, 310 - h, 60, h);
    ctx.fillStyle = "#33324e";
    for (let wy = 330 - h; wy < 300; wy += 22) {
      ctx.fillRect(x + 12, wy, 5, 7);
      ctx.fillRect(x + 32, wy, 5, 7);
    }
    ctx.fillStyle = "#0b0e19";
  }

  // Ground
  ctx.fillStyle = "#151821";
  ctx.fillRect(0, 350, canvas.width, 70);

  ctx.strokeStyle = "#404052";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 350);
  ctx.lineTo(canvas.width, 350);
  ctx.stroke();

  ctx.strokeStyle = "#252938";
  for (let x = 0; x < canvas.width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 350);
    ctx.lineTo(x - 20, 420);
    ctx.stroke();
  }
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  if (player && enemy) {
    const playerGround = 350 + player.y;
    const enemyGround = 350 + enemy.y;

    drawPixelFighter(
      ctx, player.x, playerGround,
      player.data, player.frame,
      player.action, player.facing
    );

    drawPixelFighter(
      ctx, enemy.x, enemyGround,
      enemy.data, enemy.frame,
      enemy.action, enemy.facing
    );
  }

  effects = effects.filter(effect => effect.life > 0);
  for (const effect of effects) {
    effect.life -= 0.016;
    ctx.globalAlpha = Math.min(1, effect.life * 4);
    ctx.fillStyle = effect.color;
    ctx.fillRect(effect.x - 10, effect.y - 10, 20, 20);
    ctx.fillRect(effect.x - 17, effect.y - 2, 34, 4);
  }
  ctx.globalAlpha = 1;
}

function gameLoop(timestamp) {
  const delta = Math.min((timestamp - lastTime) / 1000 || 0, 0.04);
  lastTime = timestamp;

  if (playing && player && enemy) {
    updateFighter(player, delta, true);
    updateFighter(enemy, delta, false);

    timerAccumulator += delta;
    if (timerAccumulator >= 1) {
      timerAccumulator -= 1;
      timeLeft = Math.max(0, timeLeft - 1);
      if (timeLeft <= 0) {
        playing = false;
        message = player.health >= enemy.health ? "TIME UP - YOU WIN!" : "TIME UP - YOU LOSE!";
      }
    }

    updateHUD();
  }

  drawScene();
  requestAnimationFrame(gameLoop);
}

buildChoices("playerChoices", false);
buildChoices("enemyChoices", true);
updateCards();
updateMatchup();
resetRound(false);
requestAnimationFrame(gameLoop);
```
