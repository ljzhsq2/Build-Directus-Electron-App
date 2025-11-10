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
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    },
  ],
};
