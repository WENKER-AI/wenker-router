# Homebrew Tap for WENKER Router

This is the official Homebrew tap for [WENKER Router](https://github.com/WENKER-AI/wenker-router).

## Installation

```bash
# Add the tap
brew tap WENKER-AI/wenker-router

# Install
brew install wenker-router
```

## Usage

```bash
# Start WENKER Router
wenker

# Or with options
wenker --port 3600 --host 0.0.0.0

# Check version
wenker --version
```

## Configuration

Configuration is stored in `$(brew --prefix)/var/wenker/` by default.

## Uninstallation

```bash
brew uninstall wenker-router
brew untap WENKER-AI/wenker-router
```

## Building from Source

This formula downloads pre-built binaries from GitHub Releases. To build from source:

```bash
git clone https://github.com/WENKER-AI/wenker-router
cd wenker-router
npm install
npm run build
```

## Updating the Formula

When a new version is released:

1. Update `version` in `wenker-router.rb`
2. Update all `sha256` checksums (run `shasum -a 256 <file>` on each release asset)
3. Commit and push

The GitHub Actions workflow will automatically build and upload binaries for all platforms on tag push.