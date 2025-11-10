# Directus 11.5.1 Electron App

A standalone offline desktop application for Directus 11.5.1, built with Electron. This allows you to run Directus as a desktop application without requiring an internet connection or external server.

![Build Status](https://github.com/yourusername/yourrepo/workflows/Build%20Directus%20Electron%20App/badge.svg)

## Features

- **Offline Support**: Run Directus completely offline on your local machine
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Self-Contained**: All dependencies bundled, no external setup required
- **SQLite Database**: Lightweight database included by default
- **Directus 11.5.1**: Latest Directus version with all features

## Download

Download the latest release for your platform:

- **Windows**: `.exe` installer
- **macOS**: `.zip` archive
- **Linux**: `.deb` (Debian/Ubuntu) or `.rpm` (Fedora/RHEL)

[Download Latest Release](https://github.com/yourusername/yourrepo/releases)

## Default Credentials

After installation, access Directus at `http://localhost:8055`

- **Email**: `admin@admin.com`
- **Password**: `admin123`

**⚠️ IMPORTANT**: Change these credentials immediately after first login!

## Building from Source

### Prerequisites

- Node.js 20 or higher
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/yourrepo.git
cd yourrepo

# Install dependencies
npm install

# Start in development mode
npm start

# Build for production
npm run make
```

### Build Output

Built applications will be in the `out/make` directory:
- Windows: `out/make/squirrel.windows/`
- macOS: `out/make/zip/darwin/`
- Linux: `out/make/deb/` and `out/make/rpm/`

## Configuration

Edit the `.env` file to customize Directus settings:

```env
# Server Configuration
HOST="0.0.0.0"
PORT=8055

# Database
DB_CLIENT="sqlite3"
DB_FILENAME="data.db"

# Security (CHANGE THESE!)
KEY="your-unique-key"
SECRET="your-unique-secret"
```

Generate secure keys:
```bash
openssl rand -hex 32
```

## Project Structure

```
directus-electron-app/
├── src/
│   ├── index.js          # Main Electron process
│   ├── preload.js        # Preload script
│   └── splash.html       # Splash screen
├── resources/            # Application icons and assets
├── .env                  # Directus configuration
├── forge.config.js       # Electron Forge configuration
└── package.json          # Dependencies and scripts
```

## GitHub Actions CI/CD

This project includes automated builds via GitHub Actions:

1. **On Push/PR**: Builds are tested on all platforms
2. **On Tag**: Creates a release with installers for all platforms

To create a release:
```bash
git tag -a v11.5.1 -m "Release v11.5.1"
git push origin v11.5.1
```

## Development

```bash
# Start in development mode with DevTools
npm start

# Package without creating installers
npm run package

# Create installers for current platform
npm run make
```

## Security Considerations

1. **Change Default Credentials**: The default admin credentials should be changed immediately
2. **Generate Unique Keys**: Generate unique KEY and SECRET values in `.env`
3. **Local Use Only**: This is designed for local/offline use, not for production servers
4. **Database Backups**: Regularly backup your `data.db` file

## Troubleshooting

### App Won't Start

1. Check if port 8055 is already in use
2. Delete `data.db` to reset the database
3. Check logs in the application data folder

### Build Fails

1. Ensure Node.js 20+ is installed
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

## License

MIT License - see LICENSE file for details

## Credits

This project packages [Directus](https://directus.io) into an Electron desktop application.

- Directus: https://github.com/directus/directus
- Electron: https://www.electronjs.org/

## Disclaimer

This is a community project and is not officially supported by the Directus team.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
