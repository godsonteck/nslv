# Windows desktop release

The NS Luxury Villa Windows application is a native Electron shell that loads
`https://nsluxury.vercel.app`. Data, permissions, and normal web-system changes
are served from the live cloud deployment; no local database or API server is
included in the installer.

## Build

On a Windows build computer with Node.js 20 or newer and dependencies installed:

```powershell
.\build-windows-setup.ps1
```

The installer is written to `packages\desktop\release`. It can be installed
on a different 64-bit Windows computer without Node.js or the source code.

## Native-shell updates

The installed shell checks its HTTPS release directory at startup and every
six hours. The default is `https://nsluxury.vercel.app/desktop-updates`.

For every version, publish these generated files to that exact directory:

- the `Setup <version>.exe`
- its `.blockmap` file
- `latest.yml`

Keep the files public over HTTPS and do not rename them. Increase
`packages/desktop/package.json`'s `version` for every native-shell release,
then rebuild. The update downloads in the background and installs when the
user closes the app.

To use another release host, set `NSLV_UPDATE_URL` to its HTTPS directory
before building. The address is embedded in the installer.

## Release safety

Use a Windows code-signing certificate before broad distribution. Unsigned
installers commonly prompt SmartScreen and do not provide publisher assurance.
Test every new installer and one upgrade from the previous version on a
separate Windows computer before announcing it.
