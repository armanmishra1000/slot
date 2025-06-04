export function setupPixiBackground() {
  const container = document.querySelector('.slot-canvas-container');
  if (!container || !window.PIXI) return;

  const app = new PIXI.Application({
    width: container.clientWidth,
    height: container.clientHeight,
    transparent: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  });
  app.view.classList.add('pixi-layer');
  container.appendChild(app.view);

  const g = new PIXI.Graphics();
  g.beginFill(0xffd862);
  g.drawCircle(0, 0, 3);
  g.endFill();
  const starTexture = app.renderer.generateTexture(g);

  const stars = [];
  for (let i = 0; i < 30; i++) {
    const s = new PIXI.Sprite(starTexture);
    s.x = Math.random() * app.screen.width;
    s.y = Math.random() * app.screen.height;
    s.alpha = 0.3 + Math.random() * 0.5;
    s.scale.set(0.5 + Math.random() * 0.8);
    app.stage.addChild(s);
    stars.push({ sprite: s, speed: 0.1 + Math.random() * 0.3 });
  }

  app.ticker.add(() => {
    stars.forEach(obj => {
      obj.sprite.rotation += obj.speed * 0.05;
    });
  });
}
