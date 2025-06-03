# Wanderlust - Neighborhood Exploration App

A web application that gamifies exploring your neighborhood by tracking your walking routes and discovering new streets.

## Features

- 📍 Real-time GPS tracking of your walking routes
- 🗺️ Street segment discovery with XP rewards
- 🎮 Keyboard mode for testing and debugging
- 📊 Visual route overlay with different styles for discovered vs current routes
- 🎨 Multiple map styles (Voyager and Positron)
- 💾 Local storage of exploration progress

## Getting Started

1. Open `index.html` in a web browser
2. Grant location permission when prompted
3. Click "Start Exploring" to begin tracking your route
4. Walk around to discover new street segments and earn XP!

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

### Project Structure
```
├── index.html          # Main HTML file
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
