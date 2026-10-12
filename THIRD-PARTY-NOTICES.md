# Third-party software notices

The project's GPLv3 license does not replace independent dependency licenses.

- **Electron**: MIT, https://github.com/electron/electron. The Windows package retains `LICENSE.electron.txt`.
- **Chromium and bundled components**: multiple licenses, supplied in `LICENSES.chromium.html` beside the app. Electron source/build instructions identify the matching Chromium revision.
- **electron-builder / app-builder-lib**: MIT, https://github.com/electron-userland/electron-builder. Development and packaging tools.
- **Playwright**: Apache-2.0, https://github.com/microsoft/playwright. Test tooling.
- **ffmpeg-static**: GPL-3.0-or-later, https://github.com/eugeneware/ffmpeg-static. Media tooling; its standalone executable is not shipped in the game.
- **parse-cache-control**: BSD-3-Clause, Walmart and contributors. Its installed package supplies the complete license; it is a build-tool dependency.
- **Blender, Python, NumPy and FFmpeg**: optional external authoring tools, under their own licenses. Not required to play.

`package-lock.json` records exact JavaScript dependency versions and upstream
locations. `npm ci` restores their notices. Preserve runtime notices when
redistributing the installer or portable app. No player saves are distributed.
