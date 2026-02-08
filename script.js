// scripts/main.js
// Single-file "Davies GTA" Phaser top-down prototype (merged modules).
// Recommended filename: scripts/main.js
// Requires Phaser (include CDN in index.html before this script).

const WIDTH = 1024, HEIGHT = 640;

/* ===================== Scenes ===================== */

// BootScene: generates runtime textures and starts Menu
class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }
  preload() {
    const w = this.cameras.main.width, h = this.cameras.main.height;
    this.add.text(w/2, h/2 - 20, 'Davies GTA', { fontSize: '40px', color:'#ffdd00' }).setOrigin(0.5);
  }
  create() {
    // generate runtime textures used across scenes
    const g = this.add.graphics();
    g.fillStyle(0x00aaff, 1); g.fillRect(0,0,24,32);
    g.generateTexture('playerTex', 24,32); g.clear();
    g.fillStyle(0xff3333,1); g.fillRect(0,0,48,28);
    g.generateTexture('carTex',48,28); g.clear();
    g.fillStyle(0xffdd00,1); g.fillCircle(12,12,12);
    g.generateTexture('markerTex',24,24); g.clear();
    g.destroy();
    this.scene.start('MenuScene');
  }
}

// MenuScene: title screen
class MenuScene extends Phaser.Scene {
  constructor() { super({ key:'MenuScene' }); }
  create() {
    const w = this.cameras.main.width, h = this.cameras.main.height;
    this.add.rectangle(0,0,w,h,0x111111).setOrigin(0);
    this.add.text(w/2, h/2 - 120, 'Davies GTA', { fontSize:'64px', color:'#ffdd00' }).setOrigin(0.5);
    this.add.text(w/2, h/2 - 60, 'Top-down prototype', { fontSize:'20px', color:'#ddd' }).setOrigin(0.5);

    const startBtn = this.add.rectangle(w/2, h/2 + 10, 260, 56, 0x0066bb).setInteractive({ useHandCursor: true }).setOrigin(0.5);
    this.add.text(w/2, h/2+10, 'START', { fontSize:'28px', color:'#fff' }).setOrigin(0.5);
    startBtn.on('pointerdown', ()=> this.startGame());
    this.input.keyboard.on('keydown-ENTER', ()=> this.startGame());
    this.input.keyboard.on('keydown-SPACE', ()=> this.startGame());
  }
  startGame() {
    this.cameras.main.fadeOut(300,0,0,0);
    this.time.delayedCall(320, ()=> this.scene.start('GameScene'));
  }
}

/* ===================== Utilities & Systems ===================== */

// InputManager: tracks movement keys + E press
class InputManager {
  constructor(scene){
    this.scene = scene;
    this.k = scene.input.keyboard;
    this.keyLeft = this.k.addKey('LEFT');
    this.keyRight = this.k.addKey('RIGHT');
    this.keyUp = this.k.addKey('UP');
    this.keyDown = this.k.addKey('DOWN');
    this.keyE = this.k.addKey('E');
    this.keyEsc = this.k.addKey('ESC');
    this.left = false; this.right = false; this.up = false; this.down = false;
    this.justPressedE = false; this.lastE = false;
  }
  update(){
    this.left = this.keyLeft.isDown;
    this.right = this.keyRight.isDown;
    this.up = this.keyUp.isDown;
    this.down = this.keyDown.isDown;
    const eNow = this.keyE.isDown;
    this.justPressedE = (!this.lastE && eNow);
    this.lastE = eNow;
  }
}

// CameraController: follow target and simple zoom
class CameraController {
  constructor(scene){
    this.scene = scene;
    this.target = null;
  }
  follow(gameObject){
    this.target = gameObject;
    this.scene.cameras.main.startFollow(this.target, true, 0.09, 0.09);
  }
  update(){
    if (!this.target || !this.target.body) return;
    const v = this.target.body.velocity;
    const speed = Math.sqrt(v.x*v.x + v.y*v.y);
    const desired = Phaser.Math.Clamp(1 + speed/1200, 1, 1.25);
    this.scene.cameras.main.setZoom(Phaser.Math.Linear(this.scene.cameras.main.zoom, desired, 0.02));
  }
}

// AudioManager: tiny ambience tone
class AudioManager {
  constructor(scene){ this.scene = scene; this._audio = null; }
  playAmbience(){
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = 80; o.start();
      const g = ctx.createGain(); g.gain.value = 0.0005; o.connect(g); g.connect(ctx.destination);
      this._audio = { ctx, o, g };
    } catch(e){}
  }
  stopAmbience(){ if (this._audio){ this._audio.o.stop(); this._audio.ctx.close(); this._audio = null; } }
}

// SaveManager: quick localStorage saves
class SaveManager {
  constructor(scene){ this.scene = scene; }
  save(slot='quick'){
    const data = {
      x: this.scene.player.sprite.x,
      y: this.scene.player.sprite.y,
      inCar: this.scene.player.inCar
    };
    localStorage.setItem(`daviesgta-${slot}`, JSON.stringify(data));
  }
  load(slot='quick'){
    const raw = localStorage.getItem(`daviesgta-${slot}`);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch(e){ return null; }
  }
}

/* ===================== World / Entities ===================== */

// MapManager: draws road rectangles and buildings
class MapManager {
  constructor(scene){
    this.scene = scene;
    this.generateSimpleBlock();
  }
  generateSimpleBlock(){
    const s = this.scene;
    const road = s.add.graphics(); road.fillStyle(0x444444,1);
    road.fillRect(0, 280, 2048, 100);
    road.fillRect(980, 0, 100, 2048);
    const b = s.add.graphics(); b.fillStyle(0x333333,1);
    for (let i=0;i<6;i++){
      b.fillRect(100 + i*300, 50, 180, 180);
      b.fillRect(100 + i*300, 420, 180, 180);
    }
  }
}

// NPCManager: simple wandering peds
class NPCManager {
  constructor(scene){
    this.scene = scene; this.peds = [];
  }
  spawnPedestrians(count=8){
    for (let i=0;i<count;i++){
      const x = Phaser.Math.Between(150, 900), y = Phaser.Math.Between(150, 500);
      const ped = this.scene.physics.add.image(x,y,'playerTex').setScale(0.8);
      ped.setTint(Phaser.Display.Color.RandomRGB().color);
      ped.speed = Phaser.Math.Between(30,80);
      ped.dir = Phaser.Math.Angle.Random();
      this.peds.push(ped);
    }
  }
  update(time, dt){
    for (const p of this.peds){
      p.x += Math.cos(p.dir) * p.speed * dt/1000;
      p.y += Math.sin(p.dir) * p.speed * dt/1000;
      if (Phaser.Math.Between(0,1000) < 6) p.dir += Phaser.Math.FloatBetween(-1,1);
      if (p.x < 50 || p.x > 1998) p.dir = Math.PI - p.dir;
      if (p.y < 50 || p.y > 1998) p.dir = -p.dir;
    }
  }
}

// TrafficManager: simple moving cars
class TrafficManager {
  constructor(scene){
    this.scene = scene; this.cars = [];
  }
  spawnTraffic(n=4){
    for (let i=0;i<n;i++){
      const x = Phaser.Math.Between(200,1200), y = Phaser.Math.Between(200,1200);
      const car = this.scene.physics.add.image(x,y,'carTex');
      car.setTint(Phaser.Display.Color.RandomRGB().color);
      car.speed = Phaser.Math.Between(30,140);
      car.angle = Phaser.Math.Between(0,360);
      this.cars.push(car);
    }
  }
  update(time, dt){
    for (const c of this.cars){
      const a = Phaser.Math.DegToRad(c.angle);
      c.x += Math.cos(a) * c.speed * dt/1000;
      c.y += Math.sin(a) * c.speed * dt/1000;
      if (Phaser.Math.Between(0,1000) < 5) c.angle += Phaser.Math.Between(-30,30);
      if (c.x < 50 || c.x > 1998) c.angle = 180 - c.angle;
      if (c.y < 50 || c.y > 1998) c.angle = -c.angle;
    }
  }
}

/* ===================== Player & Car ===================== */

class Player {
  constructor(scene, x, y){
    this.scene = scene;
    this.sprite = scene.physics.add.image(x,y,'playerTex').setDepth(2);
    this.sprite.setCollideWorldBounds(true);
    this.speed = 180;
    this.inCar = false;
    this.enterRange = 48;
  }
  update(time, dt, input){
    if (this.inCar) return;
    let vx = 0, vy = 0;
    if (input.left) vx = -this.speed;
    if (input.right) vx = this.speed;
    if (input.up) vy = -this.speed;
    if (input.down) vy = this.speed;
    this.sprite.setVelocity(vx, vy);
    if (input.justPressedE && Phaser.Math.Distance.Between(this.sprite.x,this.sprite.y,this.scene.car.sprite.x,this.scene.car.sprite.y) < this.enterRange) {
      this.enterCar();
    }
  }
  enterCar(){
    this.inCar = true;
    this.sprite.setVisible(false);
    this.sprite.body.enable = false;
    this.scene.car.takeControl(this);
  }
  exitCar(spawnX, spawnY){
    this.inCar = false;
    this.sprite.setPosition(spawnX, spawnY);
    this.sprite.setVisible(true);
    this.sprite.body.enable = true;
  }
}

class Car {
  constructor(scene,x,y){
    this.scene = scene;
    this.sprite = scene.physics.add.image(x,y,'carTex').setDepth(1);
    this.sprite.setCollideWorldBounds(true);
    this.controlled = false;
    this.driver = null;
    this.maxSpeed = 420;
    this.turnSpeed = 200;
  }
  takeControl(player){
    this.controlled = true;
    this.driver = player;
  }
  releaseControl(){
    this.controlled = false;
    this.driver = null;
  }
  update(time, dt, input){
    if (!this.controlled) {
      this.sprite.setVelocity(this.sprite.body.velocity.x*0.98, this.sprite.body.velocity.y*0.98);
      return;
    }
    const angle = Phaser.Math.DegToRad(this.sprite.angle);
    const dtf = dt/1000;
    if (input.up) {
      this.sprite.body.velocity.x += Math.cos(angle) * 300 * dtf;
      this.sprite.body.velocity.y += Math.sin(angle) * 300 * dtf;
    }
    if (input.down) {
      this.sprite.body.velocity.x -= Math.cos(angle) * 300 * dtf;
      this.sprite.body.velocity.y -= Math.sin(angle) * 300 * dtf;
    }
    if (input.left) this.sprite.angle -= this.turnSpeed * dtf;
    if (input.right) this.sprite.angle += this.turnSpeed * dtf;
    // cap speed
    const v = this.sprite.body.velocity;
    const speed = Math.sqrt(v.x*v.x + v.y*v.y);
    if (speed > this.maxSpeed) {
      this.sprite.setVelocity(v.x * this.maxSpeed/speed, v.y * this.maxSpeed/speed);
    }
    // exit on E
    if (input.justPressedE) {
      this.controlled = false;
      const spawnX = this.sprite.x - Math.cos(angle)*40;
      const spawnY = this.sprite.y - Math.sin(angle)*40;
      if (this.driver) this.driver.exitCar(spawnX, spawnY);
      this.driver = null;
    }
  }
}

/* ===================== Mission, Police, Wanted ===================== */

class MissionManager {
  constructor(scene){
    this.scene = scene;
    this.active = false;
    this.marker = null;
  }
  setPlayerAndCar(player, car){
    this.player = player; this.car = car;
    const x = Phaser.Math.Between(1200, 1800);
    const y = Phaser.Math.Between(200, 1800);
    this.marker = this.scene.physics.add.staticImage(x,y,'markerTex');
    this.scene.physics.add.overlap(this.player.sprite, this.marker, ()=> this.complete(), null, this);
    this.scene.physics.add.overlap(this.car.sprite, this.marker, ()=> this.complete(), null, this);
  }
  update(){ }
  complete(){
    if (this.active) return;
    this.active = true;
    const s = this.scene;
    s.tweens.add({ targets: this.marker, alpha:{from:1, to:0.2}, yoyo:true, repeat:6, duration:200});
    s.time.delayedCall(1500, ()=> { s.scene.start('MenuScene'); });
  }
}

class PoliceSystem {
  constructor(scene){ this.scene = scene; this.cops = []; }
  spawnCop(x,y){
    const cop = this.scene.physics.add.image(x,y,'carTex').setTint(0x0000ff);
    cop.speed = 180; this.cops.push(cop); return cop;
  }
  chase(target){
    if (this.cops.length === 0) {
      this.spawnCop(target.x + Phaser.Math.Between(200,400), target.y + Phaser.Math.Between(200,400));
    }
  }
  update(time, dt){
    for (const c of this.cops){
      const target = this.scene.player.inCar ? this.scene.car.sprite : this.scene.player.sprite;
      const angle = Math.atan2(target.y - c.y, target.x - c.x);
      c.x += Math.cos(angle) * c.speed * dt/1000;
      c.y += Math.sin(angle) * c.speed * dt/1000;
    }
  }
}

class WantedSystem {
  constructor(scene, policeSystem){ this.scene = scene; this.police = policeSystem; this.level = 0; this.decayTimer = 0; }
  addCrime(amount=1){
    this.level = Phaser.Math.Clamp(this.level + amount, 0, 5);
    if (this.level >= 1) this.police.chase(this.scene.player.sprite);
  }
  update(time, dt){
    if (this.level > 0){
      this.decayTimer += dt;
      if (this.decayTimer > 10000){ this.level--; this.decayTimer = 0; }
    }
    if (this.scene.ui && this.scene.ui.hud) {
      this.scene.ui.hud.setText(`Wanted: ${this.level}`);
    }
  }
}

/* ===================== UI: HUD & Minimap ===================== */

class HUD {
  constructor(scene){
    this.scene = scene;
    this.dom = document.getElementById('hud') || this.createDom();
    this.text = 'Ready'; this.player = null;
  }
  createDom(){
    const d = document.createElement('div');
    d.id = 'hud';
    d.style.position = 'absolute'; d.style.left = '12px'; d.style.top = '12px';
    d.style.padding = '8px 10px'; d.style.background = 'rgba(0,0,0,0.4)';
    d.style.borderRadius='6px'; d.style.color='#fff';
    document.body.appendChild(d);
    return d;
  }
  setPlayer(p){ this.player = p; }
  setText(t){ this.text = t; this.dom.innerText = t; }
  update(){
    if (!this.player) return;
    const m = this.scene.mission.marker;
    if (m){
      const refX = this.player.inCar ? this.scene.car.sprite.x : this.player.sprite.x;
      const refY = this.player.inCar ? this.scene.car.sprite.y : this.player.sprite.y;
      const dist = Math.round(Phaser.Math.Distance.Between(refX, refY, m.x, m.y));
      this.dom.innerText = `${this.text} • Distance: ${dist} m`;
    }
  }
}

class Minimap {
  constructor(scene){
    this.scene = scene;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 200; this.canvas.height = 120;
    this.canvas.style.position='absolute'; this.canvas.style.right='12px'; this.canvas.style.top='12px';
    this.canvas.style.border='2px solid rgba(255,255,255,0.08)';
    this.canvas.style.background='rgba(0,0,0,0.25)';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.player = null;
  }
  setPlayer(p){ this.player = p; }
  update(){
    if (!this.player) return;
    const W = 2048, H = 2048;
    const scaleX = this.canvas.width / W, scaleY = this.canvas.height / H;
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    const m = this.scene.mission.marker;
    if (m) { this.ctx.fillStyle = '#ffea00'; this.ctx.fillRect(m.x * scaleX - 3, m.y * scaleY - 3, 6,6); }
    const px = this.player.inCar ? this.scene.car.sprite.x : this.player.sprite.x;
    const py = this.player.inCar ? this.scene.car.sprite.y : this.player.sprite.y;
    this.ctx.fillStyle = '#00aaff'; this.ctx.beginPath();
    this.ctx.arc(px*scaleX, py*scaleY, 4,0,Math.PI*2); this.ctx.fill();
  }
}

class UIManager {
  constructor(scene){
    this.scene = scene;
    this.hud = new HUD(scene);
    this.minimap = new Minimap(scene);
  }
  setPlayer(player){
    this.player = player;
    this.hud.setPlayer(player);
    this.minimap.setPlayer(player);
  }
  hudSet(text){ this.hud.setText(text); }
  update(time, dt){
    this.hud.update(time, dt);
    this.minimap.update(time, dt);
  }
}

/* ===================== GameScene: glue everything ===================== */

class GameScene extends Phaser.Scene {
  constructor(){ super({ key: 'GameScene' }); }
  create(){
    const W = this.cameras.main.width, H = this.cameras.main.height;
    this.add.rectangle(0,0,W*2,H*2,0x2b2b2b).setOrigin(0);

    // managers and systems
    this.map = new MapManager(this);
    this.inputMgr = new InputManager(this);
    this.audio = new AudioManager(this);
    this.save = new SaveManager(this);
    this.ui = new UIManager(this);
    this.cameraCtrl = new CameraController(this);
    this.npc = new NPCManager(this);
    this.traffic = new TrafficManager(this);
    this.mission = new MissionManager(this);
    this.police = new PoliceSystem(this);
    this.wanted = new WantedSystem(this, this.police);

    // create player and car
    this.player = new Player(this, 120, 320);
    this.car = new Car(this, 300, 300);

    // wire up
    this.cameraCtrl.follow(this.player.sprite);
    this.ui.setPlayer(this.player);
    this.mission.setPlayerAndCar(this.player, this.car);
    this.npc.spawnPedestrians(12);
    this.traffic.spawnTraffic(6);
    this.audio.playAmbience();

    // world bounds
    this.physics.world.setBounds(0,0,2048,2048);
    this.cameras.main.setBounds(0,0,2048,2048);

    // HUD initial
    this.ui.hudSet('Mission: Go to the yellow marker');

    // fade in
    this.cameras.main.fadeIn(300,0,0,0);

    // simple ESC back to menu
    this.input.keyboard.on('keydown-ESC', ()=> this.scene.start('MenuScene'));
  }

  update(time, dt){
    this.inputMgr.update();
    this.player.update(time, dt, this.inputMgr);
    this.car.update(time, dt, this.inputMgr);
    this.cameraCtrl.update();
    this.npc.update(time, dt);
    this.traffic.update(time, dt);
    this.mission.update();
    this.ui.update(time, dt);
    this.police.update(time, dt);
    this.wanted.update(time, dt);
  }
}

/* ===================== Boot the Phaser Game ===================== */

const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'game',
  physics: { default: 'arcade', arcade: { debug: false } },
  backgroundColor: '#111111',
  scene: [ BootScene, MenuScene, GameScene ],
};

window.game = new Phaser.Game(config);
