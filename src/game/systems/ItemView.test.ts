import assert from "node:assert/strict";
import test from "node:test";
import type { Scene } from "phaser";
import { ITEM_DEFINITIONS, ITEM_VIEW_CONFIG, type GameItem } from "../data/items.ts";
import { ItemView } from "./ItemView.ts";
import { PerspectiveSystem } from "./PerspectiveSystem.ts";

class DisplayObject {
  visible = true;
  destroyed = false;
  x = 0;
  y = 0;
  scale = 1;
  setVisible(value: boolean) { this.visible = value; return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setScale(value: number) { this.scale = value; return this; }
  setOrigin() { return this; }
  setDepth() { return this; }
  setText() { return this; }
  clear() { return this; }
  fillStyle() { return this; }
  fillEllipse() { return this; }
  fillRoundedRect() { return this; }
  lineStyle() { return this; }
  strokeRoundedRect() { return this; }
  beginPath() { return this; }
  moveTo() { return this; }
  lineTo() { return this; }
  closePath() { return this; }
  fillPath() { return this; }
  strokePath() { return this; }
  destroy() { this.destroyed = true; }
}

test("items use the expanded course horizon and hide again when it contracts", (t) => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true, value: { matchMedia: () => ({ matches: false }) },
  });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });
  const images: DisplayObject[] = [];
  const glows: DisplayObject[] = [];
  const scene = { add: {
    image: () => { const image = new DisplayObject(); images.push(image); return image; },
    graphics: () => { const glow = new DisplayObject(); glows.push(glow); return glow; },
    text: () => new DisplayObject(),
  } } as unknown as Scene;
  const projection = new PerspectiveSystem();
  const view = new ItemView(scene, projection);
  const item: GameItem = { id: 1, type: "ghost-penguin", courseX: 0.6, distance: 3500 };

  // An item beyond 120m must be drawn as soon as the speed-expanded course shows it.
  projection.viewDistance = 4000;
  view.render(0, [item], 0, 0);
  assert.equal(images.length, 1);
  assert.equal(images[0].visible, true);
  const point = projection.project(item.courseX, item.distance);
  assert.equal(images[0].x, point.x);
  assert.equal(images[0].y, point.y);
  assert.ok(images[0].scale * ITEM_DEFINITIONS[item.type].assetFrame[2] >= ITEM_VIEW_CONFIG.minWidth);

  projection.viewDistance = 1200;
  view.render(0, [item], 0, 1);
  assert.equal(images[0].visible, false);
  assert.equal(glows[0].visible, false);
  view.render(2400, [item], 0, 2);
  assert.equal(images[0].visible, true);
  assert.equal(glows[0].visible, true);
  assert.equal(images.length, 1, "reuse the same image after deceleration");

  view.render(item.distance, [item], 0, 3);
  assert.equal(images[0].scale * ITEM_DEFINITIONS[item.type].assetFrame[2], ITEM_DEFINITIONS[item.type].visualWidth);
  view.render(item.distance, [], 0, 3);
  assert.equal(images[0].destroyed, true, "collection removes the image");
  assert.equal(glows[0].destroyed, true, "collection removes its decoration");
  view.render(2400, [item], 0, 0);
  view.reset();
  assert.equal(images[1].destroyed, true);
  assert.equal(glows[1].destroyed, true);
  view.destroy();
});
