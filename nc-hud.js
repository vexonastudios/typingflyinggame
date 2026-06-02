// nc-hud.js — NERF OPS: Rogue Protocol — HUD Overlay
'use strict';

class NCHUD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;

    // Damage flash
    this._damageFlash = 0;
    this._healFlash = 0;

    // Hit marker
    this._hitMarker = 0;
    this._hitMarkerKill = false;

    // Kill feed items
    this._killFeed = [];

    // Message queue
    this._messages = [];
  }

  resize(w, h) {
    this.W = w;
    this.H = h;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  showDamage(amount) {
    this._damageFlash = Math.min(255, this._damageFlash + amount * 4);
  }

  showHeal(amount) {
    this._healFlash = Math.min(180, this._healFlash + amount * 3);
  }

  showHitMarker(kill = false) {
    this._hitMarker = 300;
    this._hitMarkerKill = kill;
  }

  addKillFeed(enemyLabel, isCommander = false) {
    this._killFeed.unshift({ label: enemyLabel, isCommander, t: 3000 });
    if (this._killFeed.length > 4) this._killFeed.pop();
  }

  showMessage(text, duration = 2500, color = '#ffffff') {
    this._messages.push({ text, t: duration, maxT: duration, color });
  }

  // ── Main draw ──────────────────────────────────────────────────────────────────
  draw(state, dt) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);

    // Damage vignette
    if (this._damageFlash > 0) {
      const alpha = this._damageFlash / 255;
      const grad = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.8);
      grad.addColorStop(0, `rgba(200,0,0,0)`);
      grad.addColorStop(1, `rgba(200,0,0,${alpha * 0.6})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      this._damageFlash = Math.max(0, this._damageFlash - dt * 150);
    }

    // Heal flash
    if (this._healFlash > 0) {
      const alpha = this._healFlash / 180;
      const grad = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.8);
      grad.addColorStop(0, `rgba(0,200,0,0)`);
      grad.addColorStop(1, `rgba(0,200,0,${alpha * 0.3})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      this._healFlash = Math.max(0, this._healFlash - dt * 120);
    }

    // Crosshair
    this._drawCrosshair(state);

    // Hit marker
    if (this._hitMarker > 0) {
      const alpha = this._hitMarker / 300;
      const color = this._hitMarkerKill ? '#ff4444' : '#ffffff';
      ctx.strokeStyle = `rgba(${this._hitMarkerKill ? '255,60,60' : '255,255,255'},${alpha})`;
      ctx.lineWidth = 2;
      const cx = W/2, cy = H/2, s = 14;
      ctx.beginPath();
      ctx.moveTo(cx-s, cy-s); ctx.lineTo(cx+s, cy+s);
      ctx.moveTo(cx+s, cy-s); ctx.lineTo(cx-s, cy+s);
      ctx.stroke();
      this._hitMarker = Math.max(0, this._hitMarker - dt * 800);
    }

    // Bottom HUD bar
    this._drawBottomBar(state, dt);

    // Objectives panel (top right)
    this._drawObjectives(state);

    // Kill feed (top left)
    this._drawKillFeed(dt);

    // Messages (center)
    this._drawMessages(dt);

    // Low health warning pulse
    if (state.player.health < 25) {
      const pulse = Math.sin(Date.now() * 0.006) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(220,0,0,${pulse * 0.12})`;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = `rgba(255,80,80,${pulse * 0.9})`;
      ctx.font = `bold ${H * 0.03}px "Orbitron", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('⚠ CRITICAL HEALTH ⚠', W/2, H * 0.12);
    }

    // Compass / minimap indicator
    this._drawCompass(state);
  }

  // ── Crosshair ─────────────────────────────────────────────────────────────────
  _drawCrosshair(state) {
    const ctx = this.ctx;
    const cx = this.W / 2, cy = this.H / 2;
    const spread = (state.shooting ? 12 : 5);

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;

    // Four lines with gap
    const gap = spread;
    const len = 10;
    ctx.beginPath();
    ctx.moveTo(cx - gap - len, cy); ctx.lineTo(cx - gap, cy); // left
    ctx.moveTo(cx + gap, cy);       ctx.lineTo(cx + gap + len, cy); // right
    ctx.moveTo(cx, cy - gap - len); ctx.lineTo(cx, cy - gap); // top
    ctx.moveTo(cx, cy + gap);       ctx.lineTo(cx, cy + gap + len); // bottom
    ctx.stroke();

    // Center dot
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Bottom HUD ────────────────────────────────────────────────────────────────
  _drawBottomBar(state, dt) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const { player, level } = state;

    const barH = Math.min(80, H * 0.12);
    const barY = H - barH;

    // Semi-transparent bar background
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, barY, W, barH);

    // Border line
    ctx.strokeStyle = 'rgba(255,140,0,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barY); ctx.lineTo(W, barY);
    ctx.stroke();

    const pad = 16;
    const midY = barY + barH / 2;
    const fontSz = Math.max(11, barH * 0.2);

    // ── Health (left) ──
    const hpPct = Math.max(0, player.health / player.maxHealth);
    const hpBarW = Math.min(200, W * 0.18);
    const hpBarH = 8;
    const hpX = pad, hpY = midY - hpBarH/2;

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(hpX, hpY, hpBarW, hpBarH);

    const hpColor = hpPct > 0.5 ? '#44ff66' : hpPct > 0.25 ? '#ffaa00' : '#ff2222';
    ctx.fillStyle = hpColor;
    ctx.fillRect(hpX, hpY, hpBarW * hpPct, hpBarH);

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hpX, hpY, hpBarW, hpBarH);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSz}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`♥ ${player.health | 0}`, hpX, hpY - 5);

    // ── Ammo (center-left) ──
    const ammoX = pad + Math.min(220, W * 0.2);
    ctx.fillStyle = '#ffcc00';
    ctx.font = `bold ${fontSz * 1.5}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`${player.ammo}`, ammoX, midY + fontSz * 0.4);

    ctx.fillStyle = 'rgba(255,200,80,0.5)';
    ctx.font = `${fontSz}px monospace`;
    ctx.fillText(`/ ${player.maxAmmo}`, ammoX + fontSz * 2.5, midY + fontSz * 0.4);

    ctx.fillStyle = 'rgba(255,200,80,0.7)';
    ctx.font = `${fontSz * 0.8}px monospace`;
    ctx.fillText('AMMO', ammoX, midY - fontSz * 0.7);

    // ── Level name (center) ──
    if (level) {
      ctx.fillStyle = 'rgba(255,180,60,0.8)';
      ctx.font = `${fontSz * 0.8}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`LEVEL ${level.id} — ${level.name.toUpperCase()}`, W / 2, midY + 4);
    }

    // ── Timer (center-right) ──
    const elapsed = state.elapsedTime || 0;
    const mins = (elapsed / 60) | 0;
    const secs = (elapsed % 60) | 0;
    const timeStr = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    const timerX = W - pad - Math.min(220, W * 0.2);

    const parTime = level ? level.par : 999;
    const overPar = elapsed > parTime;
    ctx.fillStyle = overPar ? '#ff6644' : '#88ffcc';
    ctx.font = `bold ${fontSz * 1.2}px monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, timerX + 60, midY + 4);

    ctx.fillStyle = 'rgba(150,220,180,0.6)';
    ctx.font = `${fontSz * 0.8}px monospace`;
    ctx.fillText('TIME', timerX + 60, midY - fontSz * 0.8);

    // ── Score (right) ──
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSz * 1.1}px monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(`${state.score || 0}`, W - pad, midY + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${fontSz * 0.8}px monospace`;
    ctx.fillText('SCORE', W - pad, midY - fontSz * 0.8);

    // ── Key indicator ──
    if (player.hasKey) {
      ctx.fillStyle = '#44ffaa';
      ctx.font = `${fontSz * 1.2}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText('⚷', pad + hpBarW + 8, barY + 20);
    }
  }

  // ── Objectives panel ──────────────────────────────────────────────────────────
  _drawObjectives(state) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const { objectives, level, enemies } = state;
    if (!objectives && !level) return;

    const fontSz = Math.max(10, H * 0.018);
    const pad = 10;
    const x = W - 240 - pad;
    let y = pad + fontSz;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - pad, y - fontSz - 4, 240 + pad*2, fontSz * 2 + 8);

    ctx.fillStyle = '#ffcc00';
    ctx.font = `bold ${fontSz}px monospace`;
    ctx.textAlign = 'right';
    ctx.fillText('OBJECTIVES', W - pad, y);
    y += fontSz + 6;

    // Win condition indicator
    if (level) {
      const alive = enemies ? enemies.filter(e => !e.isDead).length : 0;
      const total = enemies ? enemies.length : 0;
      let objLine = '';

      switch (level.winCondition) {
        case 'eliminate_all':
          if (alive === 0) {
             objLine = `☑ Eliminate all ✓`;
          } else {
             objLine = `☐ Eliminate all (${alive}/${total} remaining)`;
          }
          break;
        case 'eliminate_commander':
          const cmd = enemies ? enemies.find(e => e.isCommander) : null;
          objLine = `☐ Eliminate commander${cmd && cmd.isDead ? ' ✓' : ''}`;
          break;
        case 'reach_exit':
          objLine = `☐ Reach the exit`;
          break;
        case 'objectives':
          objLine = `☐ Complete objectives`;
          break;
      }

      ctx.fillStyle = '#cccccc';
      ctx.font = `${fontSz * 0.9}px monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(objLine, W - pad, y);
      y += fontSz + 4;
    }

    // Per-objective items
    if (objectives) {
      for (const obj of objectives) {
        const done = obj.completed;
        ctx.fillStyle = done ? '#44ff44' : '#ffcc44';
        ctx.font = `${fontSz * 0.85}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(`${done ? '✓' : '○'} ${obj.label}`, W - pad, y);
        y += fontSz + 2;
      }
    }
  }

  // ── Kill feed ─────────────────────────────────────────────────────────────────
  _drawKillFeed(dt) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const fontSz = Math.max(10, H * 0.018);
    let y = 60;

    this._killFeed = this._killFeed.filter(k => k.t > 0);
    for (const k of this._killFeed) {
      const alpha = Math.min(1, k.t / 500);
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.5})`;
      ctx.fillRect(10, y - fontSz, 180, fontSz + 4);

      ctx.fillStyle = k.isCommander
        ? `rgba(255,200,0,${alpha})`
        : `rgba(255,120,60,${alpha})`;
      ctx.font = `${fontSz}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(`✕ ${k.label}`, 14, y);
      y += fontSz + 4;
      k.t -= dt * 1000;
    }
  }

  // ── Messages ──────────────────────────────────────────────────────────────────
  _drawMessages(dt) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const fontSz = Math.max(14, H * 0.025);

    this._messages = this._messages.filter(m => m.t > 0);
    let y = H * 0.32;
    for (const m of this._messages) {
      const alpha = Math.min(1, m.t / 400);
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.6})`;
      const tw = ctx.measureText(m.text).width + 32;
      ctx.fillRect(W/2 - tw/2, y - fontSz - 4, tw, fontSz + 12);

      ctx.fillStyle = m.color.replace(')', `,${alpha})`).replace('rgb(', 'rgba(') || `rgba(255,255,255,${alpha})`;
      ctx.font = `bold ${fontSz}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(m.text, W/2, y);
      y += fontSz + 8;
      m.t -= dt * 1000;
    }
  }

  // ── Compass ───────────────────────────────────────────────────────────────────
  _drawCompass(state) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const { player } = state;

    const cx = W / 2, cy = 28;
    const r = 22;

    // Background arc
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,140,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Cardinal labels
    const cardinals = [['N', 0], ['E', Math.PI/2], ['S', Math.PI], ['W', -Math.PI/2]];
    for (const [label, a] of cardinals) {
      const relA = a - player.angle;
      const x = cx + Math.sin(relA) * r;
      const y = cy - Math.cos(relA) * r;
      const isNorth = label === 'N';
      ctx.fillStyle = isNorth ? '#ff4444' : 'rgba(255,255,255,0.7)';
      ctx.font = `bold ${isNorth ? 11 : 9}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y);
    }

    // Forward indicator
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r + 6);
    ctx.lineTo(cx - 4, cy - r + 14);
    ctx.lineTo(cx + 4, cy - r + 14);
    ctx.closePath();
    ctx.fill();
  }

  // ── Full screen overlays ──────────────────────────────────────────────────────
  drawPause(W, H) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff8800';
    ctx.font = `bold ${H * 0.06}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W/2, H/2 - 20);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${H * 0.025}px monospace`;
    ctx.fillText('Press ESC or P to resume', W/2, H/2 + 20);
  }

  drawLevelComplete(W, H, score, par, time) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,20,0,0.8)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#44ff88';
    ctx.font = `bold ${H * 0.07}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL COMPLETE', W/2, H/2 - 60);

    const underPar = time <= par;
    ctx.fillStyle = underPar ? '#ffdd00' : '#cccccc';
    ctx.font = `${H * 0.03}px monospace`;
    ctx.fillText(underPar ? '⭐ UNDER PAR!' : 'Complete', W/2, H/2 - 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Score: ${score}`, W/2, H/2 + 30);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${H * 0.022}px monospace`;
    ctx.fillText('Press ENTER to continue', W/2, H/2 + 70);
  }

  drawGameOver(W, H, score) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(30,0,0,0.85)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff2222';
    ctx.font = `bold ${H * 0.07}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('MISSION FAILED', W/2, H/2 - 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${H * 0.03}px monospace`;
    ctx.fillText(`Final Score: ${score}`, W/2, H/2 + 10);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${H * 0.022}px monospace`;
    ctx.fillText('Press ENTER to retry  |  ESC to menu', W/2, H/2 + 55);
  }
}
