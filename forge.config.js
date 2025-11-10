module.exports = {
  packagerConfig: {
    asar: true,
    protocols: [
      {
        name: 'Directus App',
        protocol: 'directus',
        schemes: ['directus'],
      },
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'DirectusApp',
        authors: 'Your Name',
        description: 'Directus 11.5.1 Offline Desktop Application',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    },
  ],
};
