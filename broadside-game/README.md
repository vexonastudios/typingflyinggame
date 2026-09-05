# Broadside Bay

Static browser game at `/broadside`. Serve the repository over HTTP; there is no build step.

## Combat contract

- Port and starboard each own a separate battery, five gun states, and reload clock.
- Q and E, or the two touch buttons, intentionally fire the chosen side. No forward cannon, target snapping, side selection, or automatic player fire exists.
- Every gun launches from its physical muzzle along its own side's fixed firing sector. The ship's heading is the aiming system.
- A salvo staggers five shots over 0.34 seconds. Each fired cannon reloads for 9.6 seconds. The whole battery becomes ready after its last cannon loads; the opposite side is unaffected.
- A player can fire, sail past, turn, and fire the untouched battery before the first reload finishes. Changing sides during that window is recorded on the result screen.
- AI uses the same ship physics, wind power, batteries, firing arcs, projectile collisions, and `SeaBattle.fire()` method. Its steering aims a loaded side toward a predicted interception point. It must physically turn before it can fire.
- Box2D via Planck handles hull collisions and continuous collision detection for cannonballs. Land blocks shots. Friendly hulls do not take cannonball damage.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Rudder | A/D or left/right arrows | Hold the helm arrow buttons |
| Sail setting | W/S or up/down arrows | Sail slider |
| Port broadside | Q | Port button |
| Starboard broadside | E | Starboard button |
| Fullscreen | F | Fullscreen icon |
| Pause | Esc or P | Pause icon |

Pause, help, the family playtime overlay, lost window focus, and a hidden browser tab suspend simulation time. The camera frames the nearest opponent on portrait screens. The wind arrow on the chart points downwind.

## Files and verification

- `combat.mjs`: shared deterministic simulation and encounter definitions.
- `scene.mjs`: Three.js ships, islands, ocean, effects, camera and firing sectors.
- `game.mjs`: input, interface, audio, progression, and family timer integration.
- `../tests/broadside.test.mjs`: independent reloads, gun bearings, intentional side selection, alternating maneuvers, projectile collisions, AI behavior, wind, and reset regressions. Run `node --test tests/broadside.test.mjs` from the repository root.

Localhost exposes `window.__broadside` for deterministic rendering and input QA. Production does not expose this test handle.

Libraries are pinned and served locally: Three.js 0.170.0, Planck.js 1.3.0, and Lucide 0.468.0. Their licenses are in `vendor/`. Ship models, island meshes, sail textures, and effects are created by the game. The hub thumbnail is captured from its rendered scene.
