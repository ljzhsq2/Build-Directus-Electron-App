module.exports = {
  packagerConfig: {
    asar: true,
    icon: './resources/icon',
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
        iconUrl: 'https://raw.githubusercontent.com/yourusername/yourrepo/main/resources/icon.ico',
        setupIcon: './resources/icon.ico',
        loadingGif: './resources/loading.gif',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'Your Name',
          homepage: 'https://github.com/yourusername/yourrepo',
          icon: './resources/icon.png',
        },
        mimeType: ['x-scheme-handler/directus'],
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          homepage: 'https://github.com/yourusername/yourrepo',
          icon: './resources/icon.png',
        },
      },
    },
  ],
};
