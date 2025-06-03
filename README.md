# Wanderlust - Neighborhood Exploration App

A web application that gamifies exploring your neighborhood by tracking your walking routes and discovering new streets.

## Features

- 📍 Real-time GPS tracking of your walking routes
- 🗺️ Street segment discovery with XP rewards
- 🎮 Keyboard mode for testing and debugging
- 📊 Visual route overlay with different styles for discovered vs current routes
- 🎨 Multiple map styles (Voyager and Positron)
- 💾 Local storage of exploration progress
- 📱 PWA support for mobile installation
- 🔒 Screen wake lock to prevent sleep during tracking

## Getting Started

1. Open `index.html` in a web browser
2. Grant location permission when prompted
3. Click "Start Exploring" to begin tracking your route
4. Walk around to discover new street segments and earn XP!

### Mobile Usage

For the best mobile experience:
1. **Install as PWA**: Add to home screen for app-like experience
2. **Keep app visible**: Background tracking has limitations (see below)
3. **Enable location services**: Ensure high accuracy is enabled

## Background Tracking Limitations

⚠️ **Important**: Web apps have significant limitations for background tracking:

- **Screen Lock**: Most browsers pause JavaScript when screen is locked
- **Background App**: Tracking may stop when browser is backgrounded
- **Battery Optimization**: Browsers throttle inactive tabs to save battery

### What We Do to Help:
- 🔋 **Wake Lock API**: Keeps screen on during tracking (when supported)
- 👁️ **Visibility Detection**: Restarts tracking when app becomes visible again
- 🔄 **Auto-Recovery**: Attempts to restart location tracking on errors
- 📱 **PWA Manifest**: Better mobile app experience

### Best Practices:
- Keep the app visible and screen on during tracking
- Install as PWA for better performance
- Use airplane mode + WiFi if you need to save cellular data

## Usage

### Controls
- **Start/Stop Exploring**: Begin or end route tracking
- **Keyboard Mode**: Enable virtual movement using arrow keys or WASD (for testing)
- **Center Map**: Center the map on your current location
- **Clear Routes**: Reset all exploration progress

### Map Styles
- **Voyager**: Clean, modern map style (default)
- **Positron**: Minimal, light map style

## Technical Details

The app is built with vanilla JavaScript and uses:
- Leaflet.js for mapping
- Overpass API for street data
- Browser Geolocation API for GPS tracking
- LocalStorage for data persistence
- Wake Lock API for screen management
- Page Visibility API for background detection

### Project Structure
```
├── index.html          # Main HTML file
├── manifest.json       # PWA manifest
├── src/
│   ├── main.js         # Main application logic
│   ├── styles.css      # Stylesheet
│   ├── managers/       # Core functionality modules
│   │   ├── MapManager.js      # Map rendering and interaction
│   │   ├── RouteManager.js    # Route tracking and storage
│   │   └── LocationManager.js # GPS and location handling
│   └── services/       # External data services
│       └── streetService.js   # Street data from OpenStreetMap
```

## Development

To develop locally, simply serve the files with any web server. The app uses ES6 modules so requires a server (not file:// protocol).

Example with Python:
```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`

### Testing Background Behavior

1. Start tracking in browser
2. Switch to another tab or minimize browser
3. Return after a few minutes to see recovery behavior
4. Check console for background/visibility change logs
