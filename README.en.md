# IRiXi Owl Focus · an owl companion Pomodoro timer

[简体中文](README.md) · [English](README.en.md)

Write down one thing to do and focus with a red-scarfed owl. Build up focused time, collect decorations and make the room your own.

A cozy desktop Pomodoro timer with an interactive companion, focus rewards and a customizable room.

[Features](#features) · [Run from source](#run-from-source) · [Local data and limitations](#local-data-and-limitations) · [Report an issue](https://github.com/Irixil/irixi-owl-focus/issues)

Created by [IRiXi](https://github.com/Irixil). Official repository: [Irixil/irixi-owl-focus](https://github.com/Irixil/irixi-owl-focus).

![Product concept illustration of Owl Focus and its customizable room](docs/images/owl-focus-concept-hero.webp)

*A concept illustration composed from existing project artwork, not an application screenshot.*

## See it in action

![Real interaction demo from an earlier version](docs/images/owl-focus-demo.gif)

*An earlier real-app demo with isolated sample data and test-all-items mode. It does not prove that those items were earned through focus, or demonstrate every later layout feature. See [demo provenance](docs/images/demo-sources.md).*

## Features

- **One focus session at a time.** Set a task and duration, then start, pause, continue or end. The owl blinks, sips tea and responds to a tap. Reduced motion is available.
- **Prepare or start the next round.** Save the next focus and break durations without changing the current round. Start a new round even when the old one is unfinished; only actual focused time is retained.
- **Focus rewards.** Each full minute of effective focus earns a growth mark. Five accumulated minutes unlock round glasses; ten unlock a reading chair. Pauses, breaks and offline time do not add growth.
- **A room to arrange.** Try lamps, rugs, plants, pictures, tables and decorations. Move and resize them, adjust their layer, and mirror supported items.
- **Save when it feels right.** Save the whole arrangement or cancel to restore the previous one. Test-all-items layouts are separate from normal decorations and permanent collections.

Room interactions adapt to different window sizes. See the [room layout notes](docs/room-camera-v56.md) and [development history](docs/development-history.md) for detailed behavior and verification limits.

## Run from source

Node.js 22.12 or later is required. Electron is pinned to 44.0.0.

```sh
git clone https://github.com/Irixil/irixi-owl-focus.git
cd irixi-owl-focus
npm ci
npm start
```

For a first session, enter one task and start the timer. Open the collection and decoration controls, try one item, then save the arrangement.

To try the existing items without earning them:

```sh
npm start -- --test-all-items
```

This option only sets the initial test preference if you have not already chosen one. It respects the saved preference afterwards; you can also toggle the mode in the collection controls. Test mode does not grant permanent rewards or add focus time.

Source startup is available, but there is no public, ready-to-install universally signed package. The verified target is primarily macOS arm64; other platforms have not been accepted. The UI is primarily Simplified Chinese. This English README does not mean the application has an English UI.

## Standalone timer or full toolbox?

This repository contains the companion timer, not the toolbox's other utilities. For screenshot OCR, translation, clipboard history, tasks and notes in the same workbench, see [IRiXi Toolbox, a macOS Dynamic Island productivity toolbox](https://github.com/Irixil/IRiXi-Toolbox).

The standalone app and the embedded timer use separate saves and do not automatically synchronize.

## Local data and limitations

Focus progress, collections and saved room arrangements are stored locally. Development and tests can set `OWL_FOCUS_DATA_DIR` to a separate directory. Existing saves are backed up before migration; a damaged save stops with an error rather than being replaced with empty progress.

After reopening or detecting an interruption, an unfinished session pauses for your confirmation. Offline time is not added to focus rewards.

The standalone app does not yet query real foreground applications; its activity-recording entry remains disabled. There is no mobile app, App Store release or long-term-memory feature. Full real-device sleep and long-running background behavior remain unverified. A timer is not proof that a real-world task was completed.

Previous checks cover different slices of timer logic, persistence, standalone windows and the toolbox's embedded module. See [verification notes](docs/verification.md) and [development history](docs/development-history.md). This documentation update is not a new whole-product acceptance test.

## Development checks

```sh
npm test
npm run verify:ui
npm run verify:reopen
npm run verify:room
npm run verify:durations
npm run verify:durations-reopen
```

## Artwork and permissions

The owl and room use artwork generated and approved for this project. The concept image is composed from those existing assets. The bundled ZCOOL KuaiLe and LXGW WenKai fonts retain their SIL OFL 1.1 notices. See [asset provenance](docs/assets.md), [concept-image sources](docs/images/concept-sources.txt) and [attribution](ATTRIBUTION.md).

The project's own code and artwork remain **UNLICENSED**. A public repository does not itself grant an open-source or artwork license. Third-party fonts and dependencies retain their own licenses. This update does not change those terms.
