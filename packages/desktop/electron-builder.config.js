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
  // Only ship the compiled Electron main/preload and package.json
  files: ['dist/**/*', 'package.json', 'assets/**/*'],
  win: {
    icon: 'assets/icon.png',
    target: ['nsis', 'portable'],
    signAndEditExecutable: false,
    verifyUpdateCodeSignature: false,
    sign: async () => {},
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'NS Luxury Villa',
    installerIcon: 'assets/icon.png',
    uninstallerIcon: 'assets/icon.png',
  },
};
