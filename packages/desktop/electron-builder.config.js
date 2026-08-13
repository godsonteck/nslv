/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.nsvilla.management',
  productName: 'NS Luxury Villa Management System',
  electronVersion: '33.4.11',
  directories: {
    output: 'release',
  },
  files: ['dist/**/*', 'package.json'],
  extraResources: [
    {
      from: '../client/dist',
      to: 'client-dist',
      filter: ['**/*'],
    },
    {
      from: '../server/dist',
      to: 'server-dist',
      filter: ['**/*'],
    },
  ],
  win: {
    icon: 'assets/icon.png',
    target: ['portable', 'zip', 'dir'],
    signAndEditExecutable: false,
    verifyUpdateCodeSignature: false,
    sign: async () => {},
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'NS Luxury Villa Management',
    installerIcon: 'assets/icon.png',
    uninstallerIcon: 'assets/icon.png',
    installerHeader: 'assets/icon.png',
    installerSidebar: 'assets/icon.png',
  },
};
