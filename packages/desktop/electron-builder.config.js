/**
 * @type {import('electron-builder').Configuration}
 * NS Luxury Villa — Cloud Desktop Shell
 * Packages the Electron shell that connects to the live Vercel deployment.
 * No local client or server bundling needed — the app is 100% cloud-connected.
 */
module.exports = {
  appId: 'com.nsvilla.management',
  productName: 'NS Luxury Villa Management System',
  electronVersion: '33.4.11',
  directories: {
    output: 'release',
  },
  publish: [
    {
      provider: 'generic',
      url: process.env.NSLV_UPDATE_URL || 'https://nsluxury.vercel.app/desktop-updates',
      channel: 'latest',
    },
  ],
  // Only ship the compiled Electron main/preload and package.json
  files: ['dist/**/*', 'package.json', 'assets/**/*'],
  win: {
    // Generated from packages/client/src/assets/images/ns-logo.jpeg.
    icon: 'assets/ns-luxury-villa.ico',
    target: ['nsis'],
    // Embed the NS logo into the installed executable so Windows shortcuts and
    // the taskbar use it instead of Electron's fallback icon.
    signAndEditExecutable: true,
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'NS Luxury Villa',
    installerIcon: 'assets/ns-luxury-villa.ico',
    uninstallerIcon: 'assets/ns-luxury-villa.ico',
  },
};
