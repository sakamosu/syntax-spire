// 設定オブジェクト
const CONFIG = {
  cubes: {
    count: 10,
    size: 60,
    maxOffset: 30,
    cellsPerSide: 6,
    cellSize: 60 / 6, // 10
    rotationRange: 0.1,
    edgeFadeDist: 1.5,
  },
  animation: {
    cameraSpeed: 0.001,
    noiseSpeed: 0.015,
    cellUpdateInterval: 200,
    cellChangeSpeed: 0.08,
    transitionDuration: 1000,
    gridAnimationSpeed: 0.05,
    sceneChangeFrames: 0.02, // sin(frameCount * 0.02)で使用
    worleyPointSpeed: 0.02,
    worleyInfluence: 0.4,
    noiseScale: 0.3,
    noiseSpeedY: 0.7,
    noiseSpeedZ: 1.3,
  },
  worley: {
    pointsPerCube: 2,
    thresholdBase: 0.3,
    thresholdVariance: 0.25,
  },
  bezier: {
    chainCount: 16,
    chainDelay: 0.5,
    fadeInStart: 0.3,
    fadeOutEnd: 0.7,
  },
  particles: {
    count: 400,
    boundary: 400,
    changeRate: 0.1,
    velocityRange: 0.3,
    sizeMin: 0.5,
    sizeMax: 2,
    opacityMin: 30,
    opacityMax: 100,
    rotSpeedRange: 0.02,
    gridPattern: 4, // 2x2パターン
    grayValue: 60,
  },
  camera: {
    distantRadius: 640, // 600 → 700
    closeRadius: 430, // 400 → 480
    switchInterval: 7500,
    baseHeight: -50,
    heightAmplitude: 80,
    targetAmplitude: 50,
    angleMultiplier: 0.5, // PI * 0.5
  },
  scene: {
    switchInterval: 7500,
  },
  lighting: {
    ambientBrightness: 70,
    directionalBrightness: 20,
    directionalVector: [-1, 0.5, -1],
  },
  colors: {
    blackBgMin: 10,
    blackBgMax: 95,
    cellBrightnessMin: 40,
    cellBrightnessMax: 30,
    warmHueMin: 20,
    warmHueMax: 40,
    warmSatMin: 40,
    warmSatMax: 30,
    warmBrightnessMin: 80,
    warmBrightnessMax: 20,
    edgeOpacity: 20,
    whiteBgColors: ["#9FE4EE", "#9C9CD9", "#E7AAE9", "#FED59B"],
  },
  misc: {
    gridDotSize: 0.3,
    cellAnimationTypes: 3,
    waveDistance: 2,
    handDrawnWobble: 0.015,
    handDrawnTimeSpeed: 0.02,
    handDrawnRotation: 0.03,
    handDrawnStrokeWeight: 0.2,
    handDrawnSketchWeight: 0.8,
  },
};

// HEXカラーをHSBに変換する関数
function hexToHsb(hex) {
  // #を除去
  hex = hex.replace("#", "");

  // RGB値を取得
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;

  let max = Math.max(r, g, b);
  let min = Math.min(r, g, b);
  let delta = max - min;

  // 明度（Brightness）
  let brightness = max * 100;

  // 彩度（Saturation）
  let saturation = max === 0 ? 0 : (delta / max) * 100;

  // 色相（Hue）
  let hue = 0;
  if (delta !== 0) {
    if (max === r) {
      hue = ((g - b) / delta) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }
    hue = hue * 60;
    if (hue < 0) hue += 360;
  }

  return { h: hue, s: saturation, b: brightness };
}

// 2つのHSB色の間を補間する関数
function interpolateHSB(color1, color2, t) {
  // 色相の補間（最短経路）
  let h1 = color1.h;
  let h2 = color2.h;
  let deltaH = h2 - h1;

  if (deltaH > 180) deltaH -= 360;
  else if (deltaH < -180) deltaH += 360;

  let h = h1 + deltaH * t;
  if (h < 0) h += 360;
  else if (h >= 360) h -= 360;

  // 彩度と明度の補間
  let s = lerp(color1.s, color2.s, t);
  let b = lerp(color1.b, color2.b, t);

  return { h: h, s: s, b: b };
}

// イージング関数のユーティリティモジュール
const Easing = {
  outCubic: (t) => {
    return 1 - Math.pow(1 - t, 3);
  },

  inCubic: (t) => {
    return t * t * t;
  },

  inOutQuad: (t) => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
};

// シーン管理クラス
class SceneManager {
  constructor() {
    this.currentScene = 0; // 0: 黒背景、1: 白背景
    this.transition = 0;
    this.changeTime = 0;
  }

  update() {
    // 7.5秒ごとにシーンを切り替え開始
    if (
      millis() - this.changeTime >
      CONFIG.scene.switchInterval + CONFIG.animation.transitionDuration
    ) {
      this.currentScene = 1 - this.currentScene;
      this.changeTime = millis();

      // グリッドアニメーションの起点をランダムに設定
      state.gridAnimationStart = millis();
      state.gridAnimationOrigin = {
        x: random([0, CONFIG.cubes.cellsPerSide]),
        y: random([0, CONFIG.cubes.cellsPerSide]),
        z: random([0, CONFIG.cubes.cellsPerSide]),
      };
    }

    // トランジションの進行度を計算
    let timeSinceChange = millis() - this.changeTime;
    if (timeSinceChange < CONFIG.animation.transitionDuration) {
      this.transition = timeSinceChange / CONFIG.animation.transitionDuration;
    } else {
      this.transition = 1;
    }
  }

  getBackgroundBrightness() {
    let eased = Easing.inOutQuad(this.transition);
    if (this.currentScene === 0) {
      // 白→黒へのトランジション
      return lerp(CONFIG.colors.blackBgMax, CONFIG.colors.blackBgMin, eased);
    } else {
      // 黒→白へのトランジション
      return lerp(CONFIG.colors.blackBgMin, CONFIG.colors.blackBgMax, eased);
    }
  }

  shouldShowEffect(effectName) {
    switch (effectName) {
      case "grid":
        return (
          (this.currentScene === 0 && this.transition >= 0.8) ||
          (this.currentScene === 1 && this.transition < 0.2)
        );
      case "edges":
        return (
          (this.currentScene === 1 && this.transition >= 0.5) ||
          (this.currentScene === 0 && this.transition < 0.5)
        );
      case "bezier":
        return (
          (this.currentScene === 0 && this.transition >= 0.3) ||
          (this.currentScene === 1 && this.transition < 0.7)
        );
      case "particles":
        return (
          (this.currentScene === 0 && this.transition >= 0.8) ||
          (this.currentScene === 1 && this.transition < 0.2)
        );
      default:
        return false;
    }
  }
}

// カメラ制御クラス
class CameraController {
  constructor() {
    this.currentWork = 0; // 0: 遠景回転、1: 近接移動
    this.changeTime = 0;
    this.progress = 0;
  }

  update() {
    // 7.5秒ごとにカメラワークを切り替え
    if (millis() - this.changeTime > CONFIG.camera.switchInterval) {
      this.currentWork = 1 - this.currentWork;
      this.changeTime = millis();
      this.progress = 0;
    }

    // カメラワークの進行度を更新
    this.progress = (millis() - this.changeTime) / CONFIG.camera.switchInterval;
  }

  apply() {
    if (this.currentWork === 0) {
      this.applyDistantRotation();
    } else {
      this.applyCloseMovement();
    }
  }

  applyDistantRotation() {
    // 遠景で回転
    let radius = CONFIG.camera.distantRadius;
    let camX = radius * cos(frameCount * CONFIG.animation.cameraSpeed);
    let camZ = radius * sin(frameCount * CONFIG.animation.cameraSpeed);
    camera(camX, CONFIG.camera.baseHeight, camZ, 0, 0, 0, 0, 1, 0);
  }

  applyCloseMovement() {
    // 近距離で立方体の周りを回る
    let t = this.progress;

    // 高さを上下に波打たせる
    let camY =
      CONFIG.camera.baseHeight +
      sin(t * PI * 2) * CONFIG.camera.heightAmplitude;

    // 一定の半径で回転
    let radius = CONFIG.camera.closeRadius;
    let angle = t * PI * CONFIG.camera.angleMultiplier;
    let camX = radius * cos(angle);
    let camZ = radius * sin(angle);

    // ターゲットも少し動かして動的に
    let targetY = sin(t * PI * 2) * CONFIG.camera.targetAmplitude;
    camera(camX, camY, camZ, 0, targetY, 0, 0, 1, 0);
  }
}

// パーティクルシステムクラス
class ParticleSystem {
  constructor(count) {
    this.particles = [];
    this.count = count;
    this.boundary = CONFIG.particles.boundary;
    this.initialize();
  }

  initialize() {
    for (let i = 0; i < this.count; i++) {
      let pattern = this.generatePattern();

      this.particles.push({
        x: random(-this.boundary, this.boundary),
        y: random(-this.boundary, this.boundary),
        z: random(-this.boundary, this.boundary),
        vx: random(
          -CONFIG.particles.velocityRange,
          CONFIG.particles.velocityRange
        ),
        vy: random(
          -CONFIG.particles.velocityRange,
          CONFIG.particles.velocityRange
        ),
        vz: random(
          -CONFIG.particles.velocityRange,
          CONFIG.particles.velocityRange
        ),
        size: random(CONFIG.particles.sizeMin, CONFIG.particles.sizeMax),
        opacity: random(
          CONFIG.particles.opacityMin,
          CONFIG.particles.opacityMax
        ),
        rotX: random(TWO_PI),
        rotY: random(TWO_PI),
        rotZ: random(TWO_PI),
        rotSpeedX: random(
          -CONFIG.particles.rotSpeedRange,
          CONFIG.particles.rotSpeedRange
        ),
        rotSpeedY: random(
          -CONFIG.particles.rotSpeedRange,
          CONFIG.particles.rotSpeedRange
        ),
        rotSpeedZ: random(
          -CONFIG.particles.rotSpeedRange,
          CONFIG.particles.rotSpeedRange
        ),
        pattern: pattern,
      });
    }
  }

  generatePattern() {
    let pattern = [];
    for (let j = 0; j < CONFIG.particles.gridPattern; j++) {
      pattern.push(random() > 0.5 ? 1 : 0);
    }
    if (pattern.every((p) => p === 0)) {
      pattern[floor(random(CONFIG.particles.gridPattern))] = 1;
    }
    return pattern;
  }

  update() {
    for (let p of this.particles) {
      // 位置を更新
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      // 境界でラップアラウンド
      if (abs(p.x) > this.boundary) {
        p.x = -p.x + (p.x > 0 ? -this.boundary * 2 : this.boundary * 2);
      }
      if (abs(p.y) > this.boundary) {
        p.y = -p.y + (p.y > 0 ? -this.boundary * 2 : this.boundary * 2);
      }
      if (abs(p.z) > this.boundary) {
        p.z = -p.z + (p.z > 0 ? -this.boundary * 2 : this.boundary * 2);
      }

      // 回転を更新
      p.rotX += p.rotSpeedX;
      p.rotY += p.rotSpeedY;
      p.rotZ += p.rotSpeedZ;
    }
  }

  updatePatterns() {
    // ランダムに選ばれたパーティクルのパターンを変更
    let numToChange = floor(this.count * CONFIG.particles.changeRate);

    for (let i = 0; i < numToChange; i++) {
      let index = floor(random(this.particles.length));
      this.particles[index].pattern = this.generatePattern();
    }
  }

  render() {
    push();
    for (let p of this.particles) {
      push();
      translate(p.x, p.y, p.z);

      // ランダムな回転を適用
      rotateX(p.rotX);
      rotateY(p.rotY);
      rotateZ(p.rotZ);

      // 2x2グリッドパターンを描画
      noStroke();
      rectMode(CENTER);
      let gridSize = p.size;

      // 各セルを描画
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          let index = i * 2 + j;
          if (p.pattern[index] === 1) {
            // パーティクルは灰色
            fill(0, 0, CONFIG.particles.grayValue, p.opacity);
            push();
            translate((j - 0.5) * gridSize, (i - 0.5) * gridSize, 0);
            rect(0, 0, gridSize, gridSize);
            pop();
          }
        }
      }

      pop();
    }
    pop();
  }
}

// セルシステムクラス（Worleyノイズベースのセル管理）
class CellSystem {
  constructor() {
    this.cellMaps = [];
    this.worleyPointsArray = [];
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    // 各立方体用のセルマップとWorley点を初期化
    for (let i = 0; i < CONFIG.cubes.count; i++) {
      this.cellMaps[i] = new Map();
      this.worleyPointsArray[i] = [];
      this.initializeWorleyPoints(i);
    }
    this.initialized = true;
  }

  initializeWorleyPoints(cubeIndex) {
    for (let j = 0; j < CONFIG.worley.pointsPerCube; j++) {
      this.worleyPointsArray[cubeIndex].push({
        x: random(0, CONFIG.cubes.cellsPerSide),
        y: random(0, CONFIG.cubes.cellsPerSide),
        z: random(0, CONFIG.cubes.cellsPerSide),
        vx: random(
          -CONFIG.animation.worleyPointSpeed,
          CONFIG.animation.worleyPointSpeed
        ),
        vy: random(
          -CONFIG.animation.worleyPointSpeed,
          CONFIG.animation.worleyPointSpeed
        ),
        vz: random(
          -CONFIG.animation.worleyPointSpeed,
          CONFIG.animation.worleyPointSpeed
        ),
      });
    }
  }

  update() {
    if (!this.initialized) this.initialize();

    // 各立方体に対してセルを更新
    for (let cubeIndex = 0; cubeIndex < CONFIG.cubes.count; cubeIndex++) {
      this.updateWorleyPoints(cubeIndex);
      this.updateCellsForCube(cubeIndex);
    }
  }

  updateWorleyPoints(cubeIndex) {
    let worleyPoints = this.worleyPointsArray[cubeIndex];
    for (let point of worleyPoints) {
      // 特徴点をゆっくり移動
      point.x += point.vx;
      point.y += point.vy;
      point.z += point.vz;

      // 境界で跳ね返る
      if (point.x < 0 || point.x > CONFIG.cubes.cellsPerSide) point.vx *= -1;
      if (point.y < 0 || point.y > CONFIG.cubes.cellsPerSide) point.vy *= -1;
      if (point.z < 0 || point.z > CONFIG.cubes.cellsPerSide) point.vz *= -1;
    }
  }

  updateCellsForCube(cubeIndex) {
    let cellMap = this.cellMaps[cubeIndex];
    let previousStates = new Map();

    // 既存のセルの状態を一時保存
    for (let [key, cellData] of cellMap) {
      previousStates.set(key, cellData.active);
    }

    // 複数のノイズを組み合わせてパターンを生成
    for (let x = 0; x < CONFIG.cubes.cellsPerSide; x++) {
      for (let y = 0; y < CONFIG.cubes.cellsPerSide; y++) {
        for (let z = 0; z < CONFIG.cubes.cellsPerSide; z++) {
          let key = `${x},${y},${z}`;

          // シンプルなノイズ値を取得
          let value = this.combinedNoise(x, y, z, cubeIndex);

          // しきい値判定
          let threshold = CONFIG.worley.thresholdBase;
          threshold +=
            sin(frameCount * CONFIG.animation.sceneChangeFrames + cubeIndex) *
            CONFIG.worley.thresholdVariance;

          if (value > threshold) {
            if (!cellMap.has(key)) {
              cellMap.set(key, {
                x: x,
                y: y,
                z: z,
                age: 0,
                active: true,
                noiseValue: value,
                animationType: floor(random(CONFIG.misc.cellAnimationTypes)),
              });
            } else {
              let cell = cellMap.get(key);
              let wasActive = cell.active;
              cell.active = true;
              cell.noiseValue = value;
              if (!wasActive) {
                cell.fadeAge = undefined;
                cell.age = 0;
                cell.animationType = floor(
                  random(CONFIG.misc.cellAnimationTypes)
                );
              }
            }
          }
        }
      }
    }

    // アクティブでなくなったセルにフェードアウトを開始
    for (let [key, cellData] of cellMap) {
      let wasActive = previousStates.get(key);
      if (wasActive && !cellData.active) {
        cellData.fadeAge = 0;
      }

      // 現在のしきい値以下の既存セルを非アクティブに変更
      if (cellData.active) {
        let value = this.combinedNoise(
          cellData.x,
          cellData.y,
          cellData.z,
          cubeIndex
        );
        let threshold = CONFIG.worley.thresholdBase;
        threshold +=
          sin(frameCount * CONFIG.animation.sceneChangeFrames + cubeIndex) *
          CONFIG.worley.thresholdVariance;

        if (value <= threshold) {
          cellData.active = false;
          cellData.fadeAge = 0;
        }
      }
    }
  }

  combinedNoise(x, y, z, cubeIndex) {
    let worleyPoints = this.worleyPointsArray[cubeIndex];

    // 最も近い特徴点までの距離を計算
    let minDist = 999999;
    for (let point of worleyPoints) {
      let d = dist(x, y, z, point.x, point.y, point.z);
      if (d < minDist) {
        minDist = d;
      }
    }

    // 距離を0-1の範囲に正規化
    let maxInfluence =
      CONFIG.cubes.cellsPerSide * CONFIG.animation.worleyInfluence;
    let worleyValue = 1 - minDist / maxInfluence;
    worleyValue = max(0, worleyValue);

    // 滑らかな勾配のためにイージング関数を適用
    worleyValue = pow(worleyValue, 2.0);

    // パーリンノイズで変化を加える
    let noiseScale = CONFIG.animation.noiseScale;
    let perlinValue = noise(
      x * noiseScale + state.noiseOffset.x,
      y * noiseScale + state.noiseOffset.y,
      z * noiseScale + state.noiseOffset.z
    );

    // ワーリーノイズをメインに、パーリンノイズで変化を加える
    let combined = worleyValue * 0.8 + perlinValue * 0.2;

    // 立方体の端に向かって値を減少させる
    let edgeDist = min(
      min(x, CONFIG.cubes.cellsPerSide - x),
      min(y, CONFIG.cubes.cellsPerSide - y),
      min(z, CONFIG.cubes.cellsPerSide - z)
    );
    if (edgeDist < CONFIG.cubes.edgeFadeDist) {
      combined *= edgeDist / CONFIG.cubes.edgeFadeDist;
    }

    return combined;
  }

  cleanupOldCells() {
    for (let cellMap of this.cellMaps) {
      for (let [key, cellData] of cellMap) {
        // フェードアウトが完了したセルを削除
        if (
          !cellData.active &&
          cellData.fadeAge !== undefined &&
          cellData.fadeAge > 1
        ) {
          cellMap.delete(key);
        }
      }
    }
  }

  getCellMap(index) {
    return this.cellMaps[index];
  }
}

// グローバル状態
let state = {
  // 立方体関連
  cubes: [],

  // システム
  sceneManager: null,
  cameraController: null,
  cellSystem: null,
  particleSystem: null,

  // アニメーション
  lastUpdateTime: 0,
  gridAnimationStart: 0,
  gridAnimationOrigin: { x: 0, y: 0, z: 0 },

  // ノイズ
  noiseOffset: { x: 0, y: 0, z: 0 },

  // その他
  bezierConnections: [],
};

function setup() {
  //createCanvas(windowWidth, windowHeight, WEBGL);
  //createCanvas(960, 1620, WEBGL);
  createCanvas(2160, 3840, WEBGL);
  frameRate(60);
  colorMode(HSB, 360, 100, 100);

  // p5.jsのノイズシードを設定
  noiseSeed(random(10000));

  // システムの初期化
  state.sceneManager = new SceneManager();
  state.cameraController = new CameraController();
  state.cellSystem = new CellSystem();
  state.cellSystem.initialize();
  state.particleSystem = new ParticleSystem(CONFIG.particles.count);

  // 立方体の初期化
  initializeCubes();

  // ベジエ曲線の接続を初期化
  initializeBezierConnections();
}

function initializeCubes() {
  for (let i = 0; i < CONFIG.cubes.count; i++) {
    state.cubes.push({
      x: random(-CONFIG.cubes.maxOffset, CONFIG.cubes.maxOffset),
      y:
        -((CONFIG.cubes.count - 1) * CONFIG.cubes.size) / 2 +
        i * CONFIG.cubes.size,
      z: random(-CONFIG.cubes.maxOffset, CONFIG.cubes.maxOffset),
      rotX: random(-CONFIG.cubes.rotationRange, CONFIG.cubes.rotationRange),
      rotY: random(TWO_PI),
      rotZ: random(-CONFIG.cubes.rotationRange, CONFIG.cubes.rotationRange),
    });
  }
}

function draw() {
  if (frameCount === 1) {
    capturer.start();
  }
  updateScene();
  updateBackground();
  updateAnimation();
  updateLighting();
  updateCamera();
  renderCubes();
  renderEffects();
  cleanupOldCells();

  if (frameCount < 60 * 15) {
    capturer.capture(canvas);
  } else if (frameCount === 60 * 15) {
    capturer.save();
    capturer.stop();
  }
}

// シーンの切り替えとトランジション管理
function updateScene() {
  state.sceneManager.update();
}

// 背景色の更新
function updateBackground() {
  let bgBrightness = state.sceneManager.getBackgroundBrightness();
  background(0, 0, bgBrightness);
}

// アニメーション関連の更新処理
function updateAnimation() {
  if (millis() - state.lastUpdateTime > CONFIG.animation.cellUpdateInterval) {
    state.cellSystem.update();
    // トランジション完了後、黒背景の場合のみパーティクル更新
    if (
      state.sceneManager.currentScene === 0 &&
      state.sceneManager.transition >= 1
    ) {
      state.particleSystem.updatePatterns();
    }
    state.lastUpdateTime = millis();
  }

  // ノイズオフセットを更新
  state.noiseOffset.x += CONFIG.animation.noiseSpeed;
  state.noiseOffset.y +=
    CONFIG.animation.noiseSpeed * CONFIG.animation.noiseSpeedY;
  state.noiseOffset.z +=
    CONFIG.animation.noiseSpeed * CONFIG.animation.noiseSpeedZ;
}

// ライティングの設定
function updateLighting() {
  // ライティング設定（トランジションに対応）
  let eased = Easing.inOutQuad(state.sceneManager.transition);
  let lightBrightness;
  let directionalHue;
  let directionalSat;

  if (state.sceneManager.currentScene === 0) {
    // 白→黒へのトランジション
    lightBrightness = CONFIG.lighting.directionalBrightness;
    directionalHue = lerp(30, 0, eased);
    directionalSat = lerp(10, 0, eased);
  } else {
    // 黒→白へのトランジション
    lightBrightness = CONFIG.lighting.directionalBrightness;
    directionalHue = lerp(0, 30, eased);
    directionalSat = lerp(0, 10, eased);
  }

  ambientLight(0, 0, CONFIG.lighting.ambientBrightness);
  directionalLight(
    directionalHue,
    directionalSat,
    lightBrightness,
    CONFIG.lighting.directionalVector[0],
    CONFIG.lighting.directionalVector[1],
    CONFIG.lighting.directionalVector[2]
  );
}

// カメラワークの更新
function updateCamera() {
  state.cameraController.update();
  state.cameraController.apply();
}

// 立方体の描画
function renderCubes() {
  // 立方体を描画
  for (let i = 0; i < state.cubes.length; i++) {
    let cube = state.cubes[i];
    push();

    // 立方体の位置に移動
    translate(cube.x, cube.y, cube.z);

    // 回転を適用
    rotateX(cube.rotX);
    rotateY(cube.rotY);
    rotateZ(cube.rotZ);

    // スケールアニメーション（未使用のため削除）
    // cube.scale += (cube.targetScale - cube.scale) * 0.1;
    // scale(cube.scale);

    // 立方体の原点を左下隅に移動
    translate(
      -CONFIG.cubes.size / 2,
      -CONFIG.cubes.size / 2,
      -CONFIG.cubes.size / 2
    );

    // 立方体のセル、グリッド、エッジを描画
    renderCubeCells(i);
    renderGridDots(i);
    renderCubeEdges();

    pop();
  }
}

// 立方体のセルを描画
function renderCubeCells(cubeIndex) {
  let cellMap = state.cellSystem.getCellMap(cubeIndex);
  for (let [key, cellData] of cellMap) {
    // 新規出現中のセルのみアニメーション進行
    if (cellData.age < 1) {
      cellData.age += CONFIG.animation.cellChangeSpeed;
    }

    // 非アクティブなセルのフェードアウト進行
    if (!cellData.active && cellData.fadeAge !== undefined) {
      cellData.fadeAge += CONFIG.animation.cellChangeSpeed;
    }

    // 出現と消失のイージング
    let cellScale;
    let rotationX = 0,
      rotationY = 0,
      rotationZ = 0;

    if (!cellData.active && cellData.fadeAge !== undefined) {
      // 消失時のイージング（ease in cubic）
      let fadeProgress = cellData.fadeAge > 1 ? 1 : cellData.fadeAge;
      cellScale = 1 - Easing.inCubic(fadeProgress);
    } else if (cellData.age < 1) {
      // 出現時のアニメーション（タイプによって変化）
      let progress = cellData.age;

      switch (cellData.animationType) {
        case 0: // スケールアップ
          cellScale = Easing.outCubic(progress);
          break;

        case 1: // Z軸180度回転
          cellScale = Easing.outCubic(progress);
          // Z軸周りに180度回転
          rotationZ = (1 - progress) * PI;
          break;

        case 2: // フリップ
          cellScale = Easing.outCubic(progress);
          // Y軸周りに180度回転
          rotationY = (1 - progress) * PI;
          break;

        default:
          cellScale = Easing.outCubic(progress);
      }
    } else {
      // 静的に滞留
      cellScale = 1;
    }

    push();
    translate(
      cellData.x * CONFIG.cubes.cellSize + CONFIG.cubes.cellSize / 2,
      cellData.y * CONFIG.cubes.cellSize + CONFIG.cubes.cellSize / 2,
      cellData.z * CONFIG.cubes.cellSize + CONFIG.cubes.cellSize / 2
    );

    // アニメーションによる回転を適用
    if (rotationY !== 0) rotateY(rotationY);
    if (rotationZ !== 0) rotateZ(rotationZ);
    // rotationXは常に0なのでチェック不要

    // ノイズ値に基づいて色を計算
    let noiseVal = cellData.noiseValue || 0.5;

    // 実際のシーン状態を判定（トランジション中も考慮）
    let isBlackBg =
      (state.sceneManager.currentScene === 0 &&
        state.sceneManager.transition >= 0.5) ||
      (state.sceneManager.currentScene === 1 &&
        state.sceneManager.transition < 0.5);

    if (isBlackBg) {
      // 黒背景：灰色のグラデーション
      let brightness =
        CONFIG.colors.cellBrightnessMin +
        noiseVal * CONFIG.colors.cellBrightnessMax;
      fill(0, 0, brightness);
    } else {
      // 白背景：ノイズベースで色を選択（グラデーションなし）
      let colorNoiseScale = 0.04; // 色の塊の大きさを制御
      let colorNoise = noise(
        cellData.x * colorNoiseScale + cubeIndex * 0.5,
        cellData.y * colorNoiseScale,
        cellData.z * colorNoiseScale + frameCount * 0.0005 // 時間でゆっくり変化
      );

      // ノイズ値の範囲を拡張して端の色も出やすくする（0.25-0.75 → 0-1）
      colorNoise = map(colorNoise, 0.25, 0.75, 0, 1);
      colorNoise = constrain(colorNoise, 0, 1);

      // ノイズ値を配列のインデックスに変換（整数値）
      let colorIndex = floor(colorNoise * CONFIG.colors.whiteBgColors.length);
      colorIndex = constrain(
        colorIndex,
        0,
        CONFIG.colors.whiteBgColors.length - 1
      );

      // 選択した色を取得してHSBに変換
      let hexColor = CONFIG.colors.whiteBgColors[colorIndex];
      let color = hexToHsb(hexColor);

      // そのまま色を適用（微調整なし）
      fill(color.h, color.s, color.b);
    }

    // セルのサイズをノイズ値でも変化させる
    let sizeModifier = 0.8 + noiseVal * 0.4;

    if (isBlackBg) {
      // 黒背景：通常のボックス
      noStroke();
      box(CONFIG.cubes.cellSize * cellScale * sizeModifier);
    } else {
      // 白背景：手書き風ボックス
      drawHandDrawnBox(CONFIG.cubes.cellSize * cellScale * sizeModifier);
    }

    // border（ノイズ値に応じた発光効果）
    if (isBlackBg) {
      // 黒背景：白い辺
      push();
      noFill();
      stroke(0, 0, 100);
      strokeWeight(0.3);
      box(CONFIG.cubes.cellSize * cellScale * sizeModifier);
      pop();
    }

    pop();
  }
}

// グリッドドットの描画
function renderGridDots(cubeIndex) {
  // グリッドの交点にドットを表示
  let showGrid = state.sceneManager.shouldShowEffect("grid");
  if (showGrid) {
    noStroke();

    // 波紋アニメーションの進行度を計算
    let animationTime = millis() - state.gridAnimationStart;
    let maxDistance = sqrt(
      3 * CONFIG.cubes.cellsPerSide * CONFIG.cubes.cellsPerSide
    ); // 対角線の長さ
    let currentRadius = animationTime * CONFIG.animation.gridAnimationSpeed;

    // グリッドの交点に白いドットを配置（立方体の表面のみ）
    for (let x = 0; x <= CONFIG.cubes.cellsPerSide; x++) {
      for (let y = 0; y <= CONFIG.cubes.cellsPerSide; y++) {
        for (let z = 0; z <= CONFIG.cubes.cellsPerSide; z++) {
          // 立方体の表面上の点のみ表示
          if (
            x === 0 ||
            x === CONFIG.cubes.cellsPerSide ||
            y === 0 ||
            y === CONFIG.cubes.cellsPerSide ||
            z === 0 ||
            z === CONFIG.cubes.cellsPerSide
          ) {
            // 起点からの距離を計算
            let distance = dist(
              x,
              y,
              z,
              state.gridAnimationOrigin.x,
              state.gridAnimationOrigin.y,
              state.gridAnimationOrigin.z
            );

            // 波紋の位置に応じてドットの表示と大きさを制御
            let dotScale = 0;
            let sm = state.sceneManager;

            if (sm.currentScene === 0 && sm.transition > 0.5) {
              // 出現アニメーション
              if (distance <= currentRadius) {
                // 波紋の先端に近いほど小さく
                let fadeFactor =
                  1 -
                  max(
                    0,
                    (distance - (currentRadius - CONFIG.misc.waveDistance)) /
                      CONFIG.misc.waveDistance
                  );
                dotScale = min(1, fadeFactor);
              }
            } else if (sm.currentScene === 1 && sm.transition > 0.5) {
              // 消失アニメーション
              // 起点から遠い点から順に消える
              if (distance > currentRadius) {
                // まだ消えていない
                dotScale = 1;
              } else {
                // 波紋が通過した後、フェードアウト
                let fadeFactor = max(
                  0,
                  (distance - (currentRadius - CONFIG.misc.waveDistance)) /
                    CONFIG.misc.waveDistance
                );
                dotScale = max(0, 1 - fadeFactor);
              }
            } else if (sm.currentScene === 0 && sm.transition <= 0.5) {
              // 前のシーンの消失が続いている
              let remainingRadius = (0.5 - sm.transition) * 2 * maxDistance;
              if (distance > remainingRadius) {
                // まだ消えていない
                dotScale = 1;
              } else {
                // 波紋が通過した後、フェードアウト
                let fadeFactor = max(
                  0,
                  (distance - (remainingRadius - CONFIG.misc.waveDistance)) /
                    CONFIG.misc.waveDistance
                );
                dotScale = max(0, 1 - fadeFactor);
              }
            } else if (sm.currentScene === 1 && sm.transition <= 0.5) {
              // 次のシーンの出現準備
              dotScale = 0;
            }

            if (dotScale > 0) {
              push();
              translate(
                x * CONFIG.cubes.cellSize,
                y * CONFIG.cubes.cellSize,
                z * CONFIG.cubes.cellSize
              );
              // フェードを考慮した明度
              fill(0, 0, 100 * dotScale);
              sphere(CONFIG.misc.gridDotSize * dotScale);
              pop();
            }
          }
        }
      }
    }
  }
}

// 立方体のエッジを描画
function renderCubeEdges() {
  // 白背景のときは立方体の辺（エッジ）を表示
  let showEdges = state.sceneManager.shouldShowEffect("edges");
  if (showEdges) {
    // エッジの透明度を計算
    let edgeOpacity;
    let sm = state.sceneManager;
    if (sm.currentScene === 1) {
      // 出現時: 0.5→1.0の区間でフェードイン
      edgeOpacity =
        sm.transition > 0.5 ? map(sm.transition, 0.5, 1.0, 0, 1) : 0;
    } else {
      // 消失時: 0→0.5の区間でフェードアウト
      edgeOpacity = sm.transition < 0.5 ? map(sm.transition, 0, 0.5, 1, 0) : 0;
    }

    // イージング適用
    edgeOpacity = Easing.inOutQuad(edgeOpacity);

    stroke(0, 0, CONFIG.colors.edgeOpacity * edgeOpacity); // 薄いグレーの線（透明度付き）
    strokeWeight(0.08);
    noFill();

    // 立方体のエッジを描画
    push();
    // 立方体の12本の辺を描画
    beginShape(LINES);

    // 底面の4辺
    vertex(0, 0, 0);
    vertex(CONFIG.cubes.size, 0, 0);

    vertex(CONFIG.cubes.size, 0, 0);
    vertex(CONFIG.cubes.size, CONFIG.cubes.size, 0);

    vertex(CONFIG.cubes.size, CONFIG.cubes.size, 0);
    vertex(0, CONFIG.cubes.size, 0);

    vertex(0, CONFIG.cubes.size, 0);
    vertex(0, 0, 0);

    // 上面の4辺
    vertex(0, 0, CONFIG.cubes.size);
    vertex(CONFIG.cubes.size, 0, CONFIG.cubes.size);

    vertex(CONFIG.cubes.size, 0, CONFIG.cubes.size);
    vertex(CONFIG.cubes.size, CONFIG.cubes.size, CONFIG.cubes.size);

    vertex(CONFIG.cubes.size, CONFIG.cubes.size, CONFIG.cubes.size);
    vertex(0, CONFIG.cubes.size, CONFIG.cubes.size);

    vertex(0, CONFIG.cubes.size, CONFIG.cubes.size);
    vertex(0, 0, CONFIG.cubes.size);

    // 垂直の4辺
    vertex(0, 0, 0);
    vertex(0, 0, CONFIG.cubes.size);

    vertex(CONFIG.cubes.size, 0, 0);
    vertex(CONFIG.cubes.size, 0, CONFIG.cubes.size);

    vertex(CONFIG.cubes.size, CONFIG.cubes.size, 0);
    vertex(CONFIG.cubes.size, CONFIG.cubes.size, CONFIG.cubes.size);

    vertex(0, CONFIG.cubes.size, 0);
    vertex(0, CONFIG.cubes.size, CONFIG.cubes.size);

    endShape();
    pop();
  }
}

// エフェクトの描画（ベジエ曲線とパーティクル）
function renderEffects() {
  renderBezierCurves();
  renderParticles();
}

// ベジエ曲線の描画
function renderBezierCurves() {
  // 黒背景のときベジエ曲線を描画
  let showBezier = state.sceneManager.shouldShowEffect("bezier");

  if (showBezier) {
    // ベジエ曲線を描画

    // 立方体間を接続するベジエ曲線を描画
    noFill();

    // 各チェーンを一つの連続した曲線として描画（グラデーション効果付き）
    for (
      let chainIdx = 0;
      chainIdx < state.bezierConnections.length;
      chainIdx++
    ) {
      let chain = state.bezierConnections[chainIdx];

      // チェーンごとに異なるタイミングでフェードイン・アウト
      let chainDelay =
        (chainIdx / CONFIG.bezier.chainCount) * CONFIG.bezier.chainDelay;
      let adjustedOpacity;
      let sm = state.sceneManager;

      if (sm.currentScene === 0 && sm.transition < 1) {
        // フェードイン時：順次出現（先頭から順に）
        let fadeProgress = (sm.transition - 0.3) / 0.7; // 0.3→1.0を0→1にマップ
        fadeProgress = fadeProgress - chainDelay;
        fadeProgress = constrain(fadeProgress / (1 - 0.5), 0, 1);
        adjustedOpacity = Easing.inOutQuad(fadeProgress) * 100;
      } else if (sm.currentScene === 1 && sm.transition < 0.7) {
        // フェードアウト時：順次消失（最後から順に）
        let reversedIdx = CONFIG.bezier.chainCount - 1 - chainIdx;
        let reverseDelay = (reversedIdx / CONFIG.bezier.chainCount) * 0.5;
        let fadeProgress = sm.transition / 0.7; // 0→0.7を0→1にマップ
        fadeProgress = fadeProgress - reverseDelay;
        fadeProgress = constrain(fadeProgress / (1 - 0.5), 0, 1);
        adjustedOpacity = (1 - Easing.inOutQuad(fadeProgress)) * 100;
      } else {
        // 完全に表示または非表示
        adjustedOpacity = sm.currentScene === 0 ? 100 : 0;
      }

      // 透明度を適用
      stroke(0, 0, 100, adjustedOpacity);
      strokeWeight(0.1);

      beginShape();

      // 最初の点を設定
      let firstPoint = chain.points[0];
      let firstCube = state.cubes[firstPoint.cubeIndex];
      vertex(
        firstCube.x + firstPoint.x,
        firstCube.y + firstPoint.y,
        firstCube.z + firstPoint.z
      );

      // 残りの点をベジエ曲線で接続
      for (let i = 0; i < chain.points.length - 1; i++) {
        let p1 = chain.points[i];
        let p2 = chain.points[i + 1];
        let cube1 = state.cubes[p1.cubeIndex];
        let cube2 = state.cubes[p2.cubeIndex];

        // 現在の点
        let x1 = cube1.x + p1.x;
        let y1 = cube1.y + p1.y;
        let z1 = cube1.z + p1.z;

        // 次の点
        let x2 = cube2.x + p2.x;
        let y2 = cube2.y + p2.y;
        let z2 = cube2.z + p2.z;

        // 制御点を計算（垂直方向に少しオフセット）
        let cp1x = x1;
        let cp1y = y1 + (y2 - y1) * 0.33;
        let cp1z = z1;

        let cp2x = x2;
        let cp2y = y2 - (y2 - y1) * 0.33;
        let cp2z = z2;

        // ベジエ頂点を追加
        bezierVertex(cp1x, cp1y, cp1z, cp2x, cp2y, cp2z, x2, y2, z2);
      }

      endShape();
    }
  }
}

// パーティクルの描画
function renderParticles() {
  // 黒背景のときのみパーティクルを描画・更新
  let showParticles = state.sceneManager.shouldShowEffect("particles");
  if (showParticles) {
    state.particleSystem.update();
    state.particleSystem.render();
  }
}

// 古いセルの削除
function cleanupOldCells() {
  state.cellSystem.cleanupOldCells();
}

function updateCells() {
  // 各立方体に対してセルを更新
  for (let cubeIndex = 0; cubeIndex < CONFIG.cubes.count; cubeIndex++) {
    // Worley特徴点を更新
    updateWorleyPoints(cubeIndex);

    // 既存のセルの状態を一時保存
    let cellMap = state.cellMaps[cubeIndex];
    let previousStates = new Map();
    for (let [key, cellData] of cellMap) {
      previousStates.set(key, cellData.active);
    }

    // 複数のノイズを組み合わせてパターンを生成
    for (let x = 0; x < CONFIG.cubes.cellsPerSide; x++) {
      for (let y = 0; y < CONFIG.cubes.cellsPerSide; y++) {
        for (let z = 0; z < CONFIG.cubes.cellsPerSide; z++) {
          let key = `${x},${y},${z}`;

          // シンプルなノイズ値を取得
          let value = combinedNoise(x, y, z, cubeIndex);

          // しきい値判定（ワーリーノイズに適した値）
          let threshold = 0.3; // ワーリーノイズに合わせて調整

          // 時間とともに閾値を変化させる（より大きな変動）
          threshold += sin(frameCount * 0.02 + cubeIndex) * 0.25; // 変動幅をさらに大きく

          if (value > threshold) {
            if (!cellMap.has(key)) {
              cellMap.set(key, {
                x: x,
                y: y,
                z: z,
                age: 0,
                active: true,
                noiseValue: value, // ノイズ値を保存
                animationType: floor(random(CONFIG.misc.cellAnimationTypes)),
                // rotationAngle: 0, // 未使用
              });
            } else {
              let cell = cellMap.get(key);
              let wasActive = cell.active;
              cell.active = true;
              cell.noiseValue = value;
              // 非アクティブから再度アクティブになった場合のみ
              if (!wasActive) {
                cell.fadeAge = undefined;
                cell.age = 0; // 出現アニメーションを再開
                cell.animationType = floor(random(3)); // 新しいアニメーションタイプを選択
              }
            }
          }
        }
      }
    }

    // アクティブでなくなったセルにフェードアウトを開始
    for (let [key, cellData] of cellMap) {
      let wasActive = previousStates.get(key);
      if (wasActive && !cellData.active) {
        cellData.fadeAge = 0; // フェードアウト開始
      }
    }

    // 現在のしきい値以下の既存セルを非アクティブに変更
    for (let [key, cellData] of cellMap) {
      if (cellData.active) {
        let value = combinedNoise(
          cellData.x,
          cellData.y,
          cellData.z,
          cubeIndex
        );
        let threshold = 0.3;
        threshold += sin(frameCount * 0.02 + cubeIndex) * 0.25;

        if (value <= threshold) {
          cellData.active = false;
          cellData.fadeAge = 0; // フェードアウト開始
        }
      }
    }
  }
}

function updateWorleyPoints(cubeIndex) {
  let worleyPoints = state.worleyPointsArray[cubeIndex];
  for (let point of worleyPoints) {
    // 特徴点をゆっくり移動
    point.x += point.vx;
    point.y += point.vy;
    point.z += point.vz;

    // 境界で跳ね返る
    if (point.x < 0 || point.x > CONFIG.cubes.cellsPerSide) point.vx *= -1;
    if (point.y < 0 || point.y > CONFIG.cubes.cellsPerSide) point.vy *= -1;
    if (point.z < 0 || point.z > CONFIG.cubes.cellsPerSide) point.vz *= -1;
  }
}

// ワーリーノイズベースの連続的なパターン生成
function combinedNoise(x, y, z, cubeIndex) {
  let worleyPoints = state.worleyPointsArray[cubeIndex];

  // 最も近い特徴点までの距離を計算
  let minDist = 999999;
  for (let point of worleyPoints) {
    let d = dist(x, y, z, point.x, point.y, point.z);
    if (d < minDist) {
      minDist = d;
    }
  }

  // 距離を0-1の範囲に正規化（連続的な勾配を作る）
  let maxInfluence = CONFIG.cubes.cellsPerSide * 0.4; // 影響範囲を狭めて変化を速く
  let worleyValue = 1 - minDist / maxInfluence;
  worleyValue = max(0, worleyValue); // 0以上にクランプ

  // 滑らかな勾配のためにイージング関数を適用
  worleyValue = pow(worleyValue, 2.0); // よりシャープな変化

  // パーリンノイズで変化を加える
  let noiseScale = 0.3;
  let perlinValue = noise(
    x * noiseScale + state.noiseOffset.x,
    y * noiseScale + state.noiseOffset.y,
    z * noiseScale + state.noiseOffset.z
  );

  // ワーリーノイズをメインに、パーリンノイズで変化を加える
  let combined = worleyValue * 0.8 + perlinValue * 0.2;

  // 立方体の端に向かって値を減少させる
  let edgeDist = min(
    min(x, CONFIG.cubes.cellsPerSide - x),
    min(y, CONFIG.cubes.cellsPerSide - y),
    min(z, CONFIG.cubes.cellsPerSide - z)
  );
  if (edgeDist < 1.5) {
    combined *= edgeDist / 1.5;
  }

  return combined;
}

// 手書き風のボックスを描画（軽量版）
function drawHandDrawnBox(size) {
  let halfSize = size / 2;

  // シンプルな揺れで手書き感を表現
  let wobble = size * CONFIG.misc.handDrawnWobble;
  let timeOffset = frameCount * CONFIG.misc.handDrawnTimeSpeed;

  // 基本の頂点位置（揺れを時間ベースで計算）
  let w1 = sin(timeOffset) * wobble;
  let w2 = cos(timeOffset * 1.3) * wobble;
  let w3 = sin(timeOffset * 0.7) * wobble;

  push();

  // 塗りつぶしと枠線を同時に描画
  stroke(0, 0, 10);
  strokeWeight(CONFIG.misc.handDrawnStrokeWeight);

  // シンプルなボックスに軽微な歪みを加える
  push();
  // わずかな回転で手書き感を演出
  rotateX(w1 * CONFIG.misc.handDrawnRotation);
  rotateY(w2 * CONFIG.misc.handDrawnRotation);
  rotateZ(w3 * CONFIG.misc.handDrawnRotation);

  // 通常のボックスを描画（処理が軽い）
  box(size);
  pop();

  // 木目模様を追加（軽量版）
  noFill();
  stroke(0, 0, 20, 20);
  strokeWeight(0.3);

  // 前面にシンプルな木目線を3本だけ描画
  push();
  for (let i = 0; i < 3; i++) {
    let yOffset = map(i, 0, 2, -halfSize * 0.6, halfSize * 0.6);

    // シンプルな曲線で木目を表現
    beginShape();
    vertex(-halfSize, yOffset + sin(i) * halfSize * 0.1, halfSize);
    bezierVertex(
      -halfSize * 0.5,
      yOffset + sin(i + 1) * halfSize * 0.15,
      halfSize,
      halfSize * 0.5,
      yOffset - sin(i + 2) * halfSize * 0.15,
      halfSize,
      halfSize,
      yOffset + sin(i + 3) * halfSize * 0.1,
      halfSize
    );
    endShape();
  }
  pop();

  pop();
}

// ベジエ曲線の接続を初期化
function initializeBezierConnections() {
  state.bezierConnections = [];

  // 連続した曲線を作成
  for (
    let chainIndex = 0;
    chainIndex < CONFIG.bezier.chainCount;
    chainIndex++
  ) {
    // 各立方体を通るランダムなポイントを収集
    let points = [];

    for (let i = 0; i < state.cubes.length; i++) {
      // 立方体内のランダムなグリッドポイントを選択
      points.push({
        cubeIndex: i,
        x: random(-CONFIG.cubes.size / 2, CONFIG.cubes.size / 2),
        y: random(-CONFIG.cubes.size / 2, CONFIG.cubes.size / 2),
        z: random(-CONFIG.cubes.size / 2, CONFIG.cubes.size / 2),
      });
    }

    // チェーン全体を一つのオブジェクトとして保存
    state.bezierConnections.push({
      chainId: chainIndex,
      points: points,
    });
  }
}
