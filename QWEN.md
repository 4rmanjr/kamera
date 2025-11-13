# Qwen Code Context - Geo Camera Pro Application

## Project Overview

Geo Camera Pro is a feature-rich mobile PWA (Progressive Web App) camera application built with vanilla JavaScript. It provides geotagged photography with watermark functionality, supporting custom project names, notes, logos, and QR codes that contain location data. The application is designed for field work, documentation, and surveying where precise GPS coordinates are important.

### Key Features

1. **Geotagged Photography**: Photos are automatically watermarked with GPS coordinates, accuracy, and timestamp
2. **Custom Watermarks**: Support for project names, notes, custom logos, and positioning
3. **QR Code Integration**: QR codes containing location data are embedded in photos
4. **Camera Controls**: Flash, zoom (1x-10x), and camera switching functionality
5. **Gallery Management**: Local storage and management of captured photos
6. **Real-time GPS Optimization**: Enhanced geolocation with accuracy improvements
7. **PWA Capabilities**: Offline-ready features with installable web app

### Architecture

The application uses a dependency injection pattern with a centralized container that manages all services:

- **DIContainer**: Manages all service instances and their dependencies
- **State Management**: Centralized state management in `State.js`
- **Event Bus**: Event-driven communication between modules
- **Service Layer**: Modular services for different functionality (camera, location, storage, etc.)

### Core Services

1. **CameraService**: Handles camera stream, flash, zoom, and capture functionality
2. **LocationService**: Advanced geolocation with real-time optimization and accuracy improvements
3. **StorageService**: IndexedDB for photo storage and localStorage for settings
4. **CanvasProcessorService**: Processes captured images with watermarks, text, logos, and QR codes
5. **GalleryController**: Manages photo gallery view and display
6. **UIController**: Manages all UI interactions and event handling

## Building and Running

This is a static web application with no build process required:

### Running the Application

1. Simply serve the files using any web server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```
   
2. Open the application in a mobile browser (for camera and geolocation access)

### Development Commands

- **Serve**: Use any static file server (as shown above)
- **Lint**: Manual code review based on guidelines in AGENTS.md
- **Test**: Test functionality in browser, particularly in mobile environment

## Development Conventions

### Code Style

- **Modularity**: Use ES6 modules (`import`/`export`) for code organization
- **Formatting**: 4 spaces for indentation
- **Naming Conventions**: 
  - Variables and functions: `camelCase`
  - Classes: `PascalCase`
- **Error Handling**: Use `try...catch` blocks for asynchronous operations
- **Comments**: JSDoc-style comments for file headers and complex functions
- **Asynchronous Code**: Prefer `async/await` for handling asynchronous operations
- **Dependency Injection**: Follow the existing dependency injection pattern using the `DIContainer`

### File Structure

```
js/
├── camera.js              # Camera functionality and controls
├── canvasProcessor.js     # Image processing with watermarks and QR codes
├── container.js           # Dependency injection container
├── dom.js                 # DOM element references
├── eventBus.js            # Event-driven communication system
├── gallery.js             # Gallery management
├── location.js            # Advanced geolocation services
├── main.js                # Application entry point
├── preview.js             # Photo preview functionality
├── state.js               # Centralized state management
├── storage.js             # IndexedDB and localStorage management
├── ui.js                  # UI event handling and controls
├── utils.js               # Utility functions
└── virtualGallery.js      # Virtualized gallery implementation
```

### Key Technologies

- **Frontend Framework**: Vanilla JavaScript with ES6 modules
- **Styling**: Tailwind CSS and custom CSS
- **Icons**: Phosphor Icons
- **Storage**: IndexedDB for photos, localStorage for settings
- **QR Codes**: Custom QR code generation for location data
- **PWA**: Progressive Web App features

### Important Notes

1. **Mobile-focused**: The app is optimized for mobile devices with touch interactions
2. **Camera Access**: Requires camera permissions in mobile browsers
3. **Geolocation**: Real-time GPS optimization for best accuracy
4. **Performance**: Optimized canvas operations for efficient image processing
5. **PWA Compliance**: Follows PWA best practices for installable web app

## Testing and Debugging

Since there is no formal testing framework:
- Test functionality directly in mobile browsers
- Use browser developer tools to inspect elements and console
- Manually verify camera, geolocation, and storage functionality
- Test different camera orientations and zoom levels