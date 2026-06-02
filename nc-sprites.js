// nc-sprites.js — NERF OPS: Rogue Protocol — Procedural Sprite Generator
'use strict';

const EnemySpriteGen = {
  // Cache of generated sprite sheets by color
  _cache: {},

  // Grid size for the pixel art (64x64)
  SIZE: 64,

  // Frames: 0=Idle, 1=WalkLeft, 2=WalkRight, 3=Shoot
  FRAMES: 4,

  // Generates a sprite sheet for a specific enemy color
  getSpriteSheet(primaryColor, accentColor, isCommander) {
    const cacheKey = `${primaryColor}_${accentColor}_${isCommander}`;
    if (this._cache[cacheKey]) return this._cache[cacheKey];

    const S = this.SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = S * this.FRAMES;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    // Generate each frame
    this._drawFrame(ctx, 0 * S, 0, S, primaryColor, accentColor, isCommander, 'idle');
    this._drawFrame(ctx, 1 * S, 0, S, primaryColor, accentColor, isCommander, 'walk1');
    this._drawFrame(ctx, 2 * S, 0, S, primaryColor, accentColor, isCommander, 'walk2');
    this._drawFrame(ctx, 3 * S, 0, S, primaryColor, accentColor, isCommander, 'shoot');

    this._cache[cacheKey] = canvas;
    return canvas;
  },

  _drawFrame(ctx, ox, oy, S, color, accent, isCommander, frame) {
    ctx.save();
    ctx.translate(ox, oy);

    // Pixel art scale factor
    const px = S / 32; // 32x32 logical grid

    const rect = (x, y, w, h, fill) => {
      ctx.fillStyle = fill;
      ctx.fillRect(Math.floor(x * px), Math.floor(y * px), Math.ceil(w * px), Math.ceil(h * px));
    };

    // Common colors
    const skin = '#f4c494';
    const darkSuit = '#22252a';
    const darkSuitLight = '#333740';
    const armor = color;
    const armorDark = this._darken(color, 0.7);
    const visor = '#111';
    const visorGlow = accent;
    const gunDark = '#1a1a1a';
    const gunLight = '#444';
    const bootColor = '#111';

    // Animation offsets
    let bobY = 0;
    let legL = 0, legR = 0;
    let gunZ = 0; // z-offset (fake foreshortening)
    let muzzleFlash = false;

    if (frame === 'walk1') { bobY = -1; legL = -2; legR = 1; }
    if (frame === 'walk2') { bobY = -1; legL = 1; legR = -2; }
    if (frame === 'shoot') { bobY = 0; gunZ = -1; muzzleFlash = true; }

    const centerY = 4 + bobY;

    // --- LEGS ---
    // Left Leg
    rect(11, 22 + centerY + legL, 4, 8, darkSuitLight);
    rect(10, 28 + centerY + legL, 5, 2, bootColor); // Boot
    // Right Leg
    rect(17, 22 + centerY + legR, 4, 8, darkSuit);
    rect(17, 28 + centerY + legR, 5, 2, bootColor);

    // --- TORSO ---
    rect(11, 10 + centerY, 10, 12, darkSuit);
    // Chest Armor
    rect(10, 10 + centerY, 12, 8, armorDark);
    rect(11, 11 + centerY, 10, 6, armor);
    // Armor details
    rect(14, 12 + centerY, 4, 4, darkSuit);
    if (isCommander) {
      rect(15, 13 + centerY, 2, 2, '#ffd700'); // Gold star
    }

    // --- LEFT ARM (Back) ---
    rect(18, 11 + centerY, 4, 8, darkSuit);
    rect(19, 17 + centerY, 3, 3, skin); // hand

    // --- HEAD ---
    rect(12, 2 + centerY, 8, 8, skin); // base face
    rect(11, 1 + centerY, 10, 5, armorDark); // helmet dome
    rect(12, 1 + centerY, 8, 4, armor); 
    // Visor
    rect(11, 5 + centerY, 10, 3, visor);
    rect(13, 6 + centerY, 6, 1, visorGlow); // Glowing eye slit

    // --- BLASTER WEAPON ---
    const gw = 14;
    const gh = 4;
    const gx = 6 + gunZ;
    const gy = 16 + centerY;
    
    // Gun body
    rect(gx, gy, gw, gh, gunDark);
    rect(gx + 2, gy - 1, 8, 2, gunLight); // top rail
    rect(gx + 4, gy + gh, 3, 3, gunDark); // grip
    rect(gx + 8, gy + gh, 4, 2, accent);  // magazine/energy cell
    rect(gx - 2, gy + 1, 4, 2, accent);   // barrel tip

    // --- RIGHT ARM (Front, holding gun) ---
    rect(9, 12 + centerY, 4, 6, darkSuitLight);
    // Shoulder pad
    rect(8, 11 + centerY, 6, 4, armor);
    // Hand holding grip
    rect(10, 18 + centerY, 3, 3, skin);
    // Left hand holding barrel
    rect(15, 17 + centerY, 3, 3, skin);

    // --- MUZZLE FLASH ---
    if (muzzleFlash) {
      const fx = gx - 8;
      const fy = gy - 2;
      rect(fx + 2, fy + 2, 4, 4, '#ffffff'); // core
      rect(fx, fy + 2, 8, 4, '#ffcc00');     // outer horizontal
      rect(fx + 2, fy, 4, 8, '#ffcc00');     // outer vertical
      rect(fx + 3, fy + 1, 2, 6, '#ffffff'); // bright vertical
    }

    ctx.restore();
  },

  _darken(hex, factor) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.floor(r * factor);
    g = Math.floor(g * factor);
    b = Math.floor(b * factor);
    const clamp = x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0');
    return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
  }
};
