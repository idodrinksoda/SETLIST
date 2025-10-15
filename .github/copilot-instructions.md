# Copilot Instructions for SETLIST

## Project Overview
SETLIST is a simple web application for creating setlists for bands. The project consists of three main files:
- `index.html`: Main HTML entry point
- `script.js`: Handles all client-side logic
- `style.css`: Contains styles for the UI

## Architecture & Data Flow
- The app is a single-page application (SPA) with all logic in `script.js`.
- Data (setlists, songs) is managed in-memory in the browser; there is no backend or persistent storage.
- UI updates are handled by manipulating the DOM directly from `script.js`.

## Developer Workflows
- No build step: Directly open `index.html` in a browser to run the app.
- No test suite or test runner is present.
- Debugging is done using browser dev tools (console, inspector).

## Project-Specific Patterns
- All business logic is in `script.js`. Functions are typically triggered by user events (button clicks, form submissions).
- Song/setlist data is stored in JavaScript arrays/objects. There is no use of frameworks or external libraries.
- Styling is handled exclusively in `style.css`.
- The HTML structure in `index.html` is tightly coupled to the logic in `script.js` (selectors, IDs, etc.).

## Integration Points
- No external dependencies or APIs are used.
- No build tools, package managers, or config files are present.

## Examples
- To add a new feature (e.g., export setlist), implement the logic in `script.js`, update the UI in `index.html`, and style in `style.css`.
- To change the UI, edit both `index.html` and `style.css` as needed.

## Key Files
- `index.html`: Defines the UI structure and links to JS/CSS.
- `script.js`: All app logic and event handling.
- `style.css`: Visual design and layout.

## Conventions
- Keep all logic in `script.js` unless refactoring for clarity.
- Use clear, descriptive IDs/classes in HTML for easy JS/CSS targeting.
- Keep UI/logic tightly coupled for simplicity.

---
For questions or unclear patterns, review `README.md` or ask for clarification.
