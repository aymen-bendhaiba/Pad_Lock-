# Project Documentation

## 2026-06-16 - Login Screen

Implemented the Fleet Intelligence Platform login screen from the provided Figma screenshot.

Changes made:

- Replaced the default starter page with a responsive login screen.
- Used the existing images from `public/images`: `loginBg.png`, `logo.png`, and `logoHarmony.png`.
- Applied Inter typography through `next/font/google`.
- Used the provided brand gradient colors `#0C4E71` and `#1E9ADA` for KPI emphasis.
- Built a right-side login form card with email/password fields, forgot password link, primary login button, Google login button, and sign-up link.
- Added responsive layout behavior for desktop and smaller screens.
- Updated page metadata for the Fleet Intelligence Platform.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

Notes:

- No new libraries or frameworks were added for this screen.
- `IMPLEMENTATION_NOTES.md` is intentionally local-only and ignored by Git.

## 2026-06-16 - Dashboard Screen

Implemented the Fleet Intelligence Platform dashboard screen from the provided Figma screenshot.

Changes made:

- Added a new `/dashboard` route using the Next.js App Router.
- Built a responsive operational dashboard layout with a left sidebar, top search bar, user controls, KPI cards, chart panels, and summary sections.
- Reused the existing administration logo from `public/images/logo.png`.
- Applied the provided accent colors `#2A9D90` and `#34C759`.
- Added a custom redesigned Fleet Activity visualization with layered movement flow, alert line, baseline trace, plotted pulses, and legend chips.
- Added metric cards for assets, online/offline status, movement, idle, lock state, and alarms.
- Added Connection Status, Top Alarms, and Asset Distribution panels.
- Installed `lucide-react` for consistent dashboard iconography.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

Notes:

- `IMPLEMENTATION_NOTES.md` remains local-only and explains the dependency choice.

### Dashboard Refinement Pass

Adjusted after review:

- Expanded the desktop sidebar for more comfortable navigation spacing.
- Made the desktop sidebar sticky so it stays visible while the dashboard content scrolls.
- Removed visible browser scrollbars while preserving normal scroll behavior.
- Let the dashboard content use the available page width instead of staying constrained to a narrow centered container.
- Reworked Fleet Activity into a weekly movement lane chart while keeping the dark Fleet Pulse summary panel.
- Reworked Asset Distribution into a location-based bar and trend chart showing asset counts and movement trend by region/place.

## 2026-06-16 - Live Map Screen

Implemented the Fleet Intelligence Platform live map screen from the provided Figma screenshot.

Changes made:

- Added a new `/live-map` route using the Next.js App Router.
- Reused the existing dashboard sidebar/topbar structure with Live Map as the active navigation item.
- Built a full-height operational map workspace with a real worldwide OpenStreetMap/Leaflet map, normal zoom/pan behavior, vehicle markers, playback/geofence/alarm actions, and status legend.
- Added a right-side asset panel with search, filtering, vehicle cards, battery/condition/lock indicators, statuses, and pagination controls.
- Installed `leaflet`, `react-leaflet`, and `@types/leaflet` for real map rendering.
- Wired sidebar navigation items to real route paths instead of static placeholders.
- Capped map zoom to prevent blank high-zoom tile states.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

## 2026-06-16 - Commands Screen

Implemented the Fleet Intelligence Platform commands screen from the provided multi-section screenshots.

Changes made:

- Added a new `/commands` route using the Next.js App Router.
- Reused the application sidebar/topbar structure with Commands as the active navigation item.
- Added the RFID Cards Authorization selector in the header.
- Built tabbed command sections for Device Status, Low Battery, Sleep Mode, Password, Phone Number, and Add RFID.
- Added responsive command tables, search fields, status metadata, action buttons, pagination, and footer legends.
- Added expanded RFID tag management with searchable tag chips and add/save controls.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

### Commands Interaction Refinement

Adjusted after prototype review:

- Wired command search inputs to filter the static device rows by name/code.
- Added inline edit behavior for Low Battery, Sleep Mode, and Password rows.
- Added Password eye controls that toggle between masked and visible password text.
- Added Add RFID prototype behavior for searching existing tag chips, adding a typed RFID tag, and removing tag chips.
- Refined Add RFID dropdown rows so each device can expand/collapse independently, visible rows can be selected, and tag counts update from the static chip data.
- Added a working Commands/RFID header selector and implemented the Device Command Center mode with selectable devices, quick commands, executable static command history, command search, status filter, and export feedback.
- Reworked the command center selector label to `Remote card authorization` and added the three card authorization sections: On-site, Remote, and Slave. Each section keeps static prototype controls working, including device selection, synchronization feedback, RFID card inputs, add/clear actions, authorization, unbind controls, and RFID search.
- Restored the `Commands` option as the third top-level selector mode, including the command metrics, selectable devices, quick command terminal, execute behavior, command history search/filter, and export feedback.
