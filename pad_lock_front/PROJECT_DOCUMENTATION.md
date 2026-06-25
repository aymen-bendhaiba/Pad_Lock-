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

### Dashboard Backend Integration

Adjusted after backend integration:

- Replaced static dashboard KPI/chart content with a client dashboard panel that loads `GET /api/dashboard/summary` for the selected date range.
- Normalized documented backend sections: `kpis`, `connectionStatus`, `lockActivity`, `topAlarms`, `lockStateDistribution`, and `rfidSyncStatus`.
- Removed hardcoded dashboard counts from the main cards, connection chart, fleet pulse, top alarms, asset distribution chart, and locked/unlocked footer.
- Added backend loading and error labels so dashboard testing shows whether the summary endpoint responded.
### Dashboard Refinement Pass

Adjusted after review:

- Expanded the desktop sidebar for more comfortable navigation spacing.
- Made the desktop sidebar sticky so it stays visible while the dashboard content scrolls.
- Removed visible browser scrollbars while preserving normal scroll behavior.
- Let the dashboard content use the available page width instead of staying constrained to a narrow centered container.
- Reworked Fleet Activity into a weekly movement lane chart while keeping the dark Fleet Pulse summary panel.
- Reworked Asset Distribution into a location-based bar and trend chart showing asset counts and movement trend by region/place.

### Login Backend Integration

Connected the login form to the NestJS Lock Management API.

Changes made:

- Added a small frontend API helper in `lib/api.ts`.
- Pointed the default API base URL to `http://192.168.70.46/api`, with `NEXT_PUBLIC_API_BASE_URL` support for later environment changes.
- Moved the login form behavior into a client component while preserving the existing visual layout.
- Wired login submission to `POST /api/auth/login`.
- Stored the returned bearer token in browser local storage for later protected API calls.
- Redirected users to `/dashboard` after a successful login.
- Added loading and error states to the login button/form.
- Added a shared profile logout button across authenticated pages that clears the stored JWT/cache and routes back to the login screen.

### Startup Splash And Cache Warmup

Added a first-load splash screen and frontend API cache warmup.

Changes made:

- Added a full-screen splash overlay using the existing login background and administration logo.
- Added a cache warmer that runs when an access token exists or is stored after login.
- Preloads shared heavy endpoints in parallel: dashboard summary, country geo-boundaries, geofences, devices, alerts, locks, and recent history for the first returned devices.
- Stores cached API responses in browser local storage keyed by endpoint and token signature.
- Expires cached responses at the JWT expiration time, falling back to the documented 15-minute token lifetime when the token does not include an `exp` claim.
- Added `cachedApiJson` and `warmAppCache` helpers in `lib/api.ts` for later page integrations.

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


### Live Map Backend Integration

Adjusted after backend integration:

- Replaced the static `liveMapAssets` dataset with a client live-map panel that loads backend devices from `GET /api/devices`.
- Enriches device rows with available lock records from `GET /api/locks` and alert state from `GET /api/alerts` so marker/list status, lock state, battery, and signal values come from backend data when present.
- Added tolerant position parsing for common backend shapes such as direct latitude/longitude fields, nested `position`/`lastPosition` objects, and GeoJSON-like coordinate arrays.
- Added 15-second polling for `/devices`, `/locks`, and `/alerts` so moving lock positions can refresh without a full page reload while the backend streaming endpoint for positions is not defined yet.
- Kept click-to-zoom behavior from the asset sidebar and now only plots markers for backend assets that include valid coordinates.
- Search, status/lock filtering, counts, legends, and empty/error/loading states now reflect backend data instead of fixed prototype numbers.
- Added a live-map layer switcher so users can choose between satellite imagery and OpenStreetMap street tiles.
- Replaced default map controls with custom icon-only zoom and layer controls for cleaner UI/UX.
- Layer-specific zoom limits now keep satellite imagery at its sharp native level while allowing deeper street-map zoom.
- Added marker click behavior that zooms directly to the selected lock and opens a compact backend device information popup.
- Popup details are now generated directly from each original `/devices` row, with `/locks` and `/alerts` kept out of the popup body.
- Refined the marker popup into a compact device card, removed Last Seen from the detail list, and moved the map layer controls to the top-right for cleaner map ergonomics.
- Added dynamic Playback controls backed by `GET /api/history/:terminalId`, including selected lock state, route loading, play/pause, reset, timeline scrubbing, route polyline, and animated current-point marker.
- Playback now calls the history endpoint with explicit `from` and `to` query parameters and exposes date inputs in the UI for testing backend position ranges.

### Live Map Imagery Update

Adjusted after review:

- Replaced the street-map tile layer with a free imagery-only satellite tile layer through Leaflet.
- Avoided Google Maps API billing and API-key requirements.
- Kept the existing asset list, custom vehicle markers, and click-to-focus behavior.
- Avoided map label/boundary overlays so the live map shows satellite imagery plus only the application's own markers/geofence overlays.

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

## 2026-06-17 - Reports Screen

Implemented the Fleet Intelligence Platform reports and analytics screen from the provided screenshots.

Changes made:

- Added a new `/reports` route using the Next.js App Router.
- Reused the application sidebar/topbar structure with Reports as the active navigation item.
- Built a reports table with search, status filtering, row selection, select-all behavior, action menus, delete behavior, pagination controls, and export feedback.
- Added the Generate New Report modal with report name, report type, date range, asset/device selection, output format, include-charts toggle, report summary card, cancel, and generate actions.
- Wired Generate Report to add a new static processing row to the table so the prototype demonstrates the expected workflow.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

## 2026-06-22 - Alarms Screen

Implemented the Alarm Records screen from the provided design.

Changes made:

- Added a new `/alarms` route using the existing application shell with Alarms active in the sidebar.
- Built KPI cards for critical alarms, unread alerts, active investigations, and resolved alerts.
- Added alarm tabs for Summary, List, Unread, and Resolved.
- Added search, type filtering, severity filtering, row selection, action menus, export feedback, and pagination controls.
- Wired the page to `GET /api/alerts` through the shared API cache helper for the initial alert list.
- Added a live fetch-based stream subscription to `GET /api/alerts/stream` with `Authorization: Bearer <token>` so new backend alerts appear immediately without refreshing and no JWT is placed in the URL.
- Added tolerant alert normalization for common backend fields such as `terminalId`, `deviceId`, `type`, `eventType`, `severity`, `status`, `timestamp`, `createdAt`, `description`, and `message`.
- Removed fallback prototype rows so the page now displays backend alert data only.
- Added backend-only loading, empty, error, and stream reconnecting states so testing clearly shows the real backend status.
- Replaced the static sidebar alarm badge with a shared dynamic notification badge that loads unread alerts from `/api/alerts` and updates from `/api/alerts/stream`.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

## 2026-06-22 - Geofence Management Screen

Implemented the first backend-ready geofence management browsing workflow.

Changes made:

- Added a new `/geofence` route using the Next.js App Router.
- Reused the existing application shell with Geofence active in the sidebar.
- Added a continent sidebar using the known continent set for navigation.
- Added a second sidebar that loads countries from the backend documentation pattern `GET /api/geo-boundaries?type=country&continent={name}&limit=100`.
- Country browsing avoids the default 50-row response by using the documented maximum `limit=100` for each selected continent, matching the backend example for Africa and applying the same rule to every continent.
- Added country-level geofence results loaded from backend `GET /api/geofences`.
- Added country selection behavior that fetches `GET /api/geo-boundaries/:id` only to calculate a map focus point for zooming.
- Added map rendering for matching polygon, circle, and route geofence shapes when the backend returns coordinates or GeoJSON geometry.
- Kept selected country boundaries out of the map overlay so country clicks zoom the map without visually selecting the country as a geofence.
- Added tolerant GeoJSON parsing for geometry strings, Feature, FeatureCollection, Polygon, MultiPolygon, and common `geojson`/`geoJson` field names.
- Boundary-linked geofences now use the selected country's fetched boundary geometry as a drawing fallback when the geofence row only returns `geoBoundaryId`.
- Geofence matching now supports `geoBoundaryId`, `boundaryId`, string `boundary`/`geoBoundary`, nested boundary `id`, and nested boundary `uuid`.
- Deferred POST/create behavior for the next pass, per workflow decision.
- Refreshed `/geofences` and selected continent country lists from the backend when opening the geofence page, so stale warmup cache cannot hide newly created backend geofences.
- Expanded geofence/country normalization to support backend relation variants including `_id`, nested `country`, nested `boundary`/`geoBoundary`, country code aliases, boundary names, and geometry fields used by imported boundary data.
- Improved coordinate parsing for nested polygon arrays so backend-created geofences and imported boundary geometries can render consistently on the map.
- Added geometry-based country matching: when a backend geofence has coordinates but no country or boundary relation fields, the frontend checks whether its points fall inside the selected country boundary.
- Added bbox support for geofence and boundary responses. Bboxes are interpreted as rectangular polygon rings, not circles, and polygon/ring rendering takes priority over circle rendering.
- Treats the selected country boundary response as a preset geofence. This means countries still show a geofence from `/api/geo-boundaries/:id` even when `/api/geofences` has no saved custom rows yet.
- Added typed `getGeoBoundaries(query)` and `getGeoBoundaryById(id)` helpers so geofence browsing follows the backend contract: lightweight list/search queries first, then one boundary-by-id request only when map drawing geometry is needed.
- Restored selected-country map highlighting with a distinct orange dashed boundary so country selection is visually separate from geofence overlays.
- Split selected country rendering from geofence rendering: the selected country uses its own orange boundary highlight, while the country preset geofence uses the same backend country shape but only draws with the geofence color after the user clicks it.
- Removed the incorrect region/city child-boundary lookup because the current imported preset geofences are country boundary features from the backend geo-boundaries catalog, not `/api/geofences` rows.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

### Live Map Playback Cache Fix

Adjusted after backend playback testing:

- Updated the shared `cachedApiJson` helper so forced backend reads use browser `cache: "no-store"`. This prevents playback history requests from receiving HTTP `304` responses with no usable JSON body when the user clicks Playback.
- Added a defensive `304` fallback that returns the token-scoped local cache only when a fresh cache entry already exists.
- This keeps startup caching useful for heavy endpoints while making manual playback/history refreshes dynamic.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
### Live Map Playback Coordinate Array Support

Adjusted after backend history response review:

- Added playback parsing for raw history responses shaped as coordinate-pair arrays, for example `[ [33.960208, -6.86387], ... ]`.
- Treats those backend history pairs as `[latitude, longitude]` so the route draws in the correct location on the live map.
- Kept support for object-based history rows and nested position fields so future backend history DTOs remain compatible.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
### Shared Header Alerts And Profile Menu

Adjusted after navbar review:

- Added a shared dynamic notification button beside the sidebar logo. It reuses the live alert count from `GET /api/alerts` and `/api/alerts/stream` instead of showing a static bell.
- Added stored user profile handling in `lib/api.ts`. Login now stores the backend `user` payload when available, with JWT/email fallback for name, email, and initials.
- Replaced static `Amina Alaoui` / `a.alaoui@harmony.ma` header text across authenticated pages with a shared profile dropdown.
- Added a Logout action inside the profile dropdown that clears the JWT, cached API data, stored user profile, and returns to the login screen.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
### Global Live Alert Toasts

Adjusted after notification review:

- Added a global `AlertToastListener` mounted in the root layout so new backend alerts can notify users from any page.
- The listener opens the authenticated `GET /api/alerts/stream` fetch stream with `Authorization: Bearer <token>` and listens only for live `alert` events.
- New alerts display as red top-right toast notifications with severity, alert type, message, and device id.
- Toasts auto-dismiss after a short delay, can be dismissed manually, and clicking the toast routes the user to `/alarms` to review the full alert list.
- Duplicate live alert events are de-duplicated by backend id/uuid/event id or a terminal/type/timestamp fallback.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
### Profile Hydration Fix

Adjusted after hydration warning review:

- Updated the shared profile dropdown so the server render and first client render both use the same stable placeholder profile.
- The real stored login/JWT profile is loaded after hydration, preventing React text mismatch warnings such as `User` versus `admin@example.com`.
- Kept logout and profile update behavior unchanged.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
### Dashboard Backend Range Filter

Adjusted after backend filter update:

- Turned the dashboard top-right date control into a working range selector.
- Added `Last 7 days`, `Last 30 days`, `This month`, and `Last quarter` options.
- Changing the selector recalculates `from` and `to` ISO values and reloads `GET /api/dashboard/summary?from=...&to=...` through the shared API helper.
- The dashboard loading label now reappears while the selected backend range is being fetched.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
### Dashboard Custom Range Filter

Adjusted after dashboard filter review:

- Kept the quick preset selector for common periods: Last 7 days, Last 30 days, This month, and Last quarter.
- Added a separate custom date range control so users can request a smaller or more specific reporting window.
- Both controls feed the same backend query contract: `GET /api/dashboard/summary?from=...&to=...`.
- The custom range normalizes dates to full-day backend bounds, from `00:00:00.000` through `23:59:59.999`.
- The Fleet Activity range label now reflects either the selected preset or the custom range mode.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

### Alarms Status Actions And Range Filter

Adjusted after alarms workflow review:

- Renamed the second alarm tab from `List` to `Investigate` and made it show only alerts with `Investigating` status.
- Added an alarm date filter beside the top-right date button, with quick presets and a custom date range.
- Existing alerts now reload through `GET /api/alerts?from=...&to=...` when the selected date range changes.
- Added client-side date filtering from each alert timestamp as a fallback in case the backend ignores the range query.
- Reworked the Status column into colored dynamic badges with a pending `Saving...` state.
- Wired row actions and `Mark all as read` to attempt backend status persistence through alert status endpoints, while preserving optimistic UI feedback and rollback on failed updates.
- Kept the live alert stream separate from date-range reloads so changing filters does not reconnect the stream.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

### Alarms Backend Contract Alignment

Adjusted after backend route confirmation:

- Updated alarm status persistence to use the exact backend endpoint `PATCH /api/alerts/:id/status`.
- Sends backend status payloads as lowercase values: `unread`, `read`, `investigating`, and `resolve`.
- Updated alert loading to combine backend status filters with date ranges, for example `GET /api/alerts?status=unread&from=...&to=...`.
- `Investigate`, `Unread`, and `Resolved` tabs now pass backend `status` query values while `Summary` loads all statuses for the selected date range.
- Normalizes backend `resolve` responses back into the UI label `Resolved`.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

### Alarm Unread Status Normalization Fix

Adjusted after backend unread status review:

- Fixed frontend status parsing so backend `unread` is checked before `read`.
- This prevents `unread` from being displayed as `Read` just because the word contains `read`.
- Existing `read`, `investigating`, and `resolve` mappings remain unchanged.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

### Geofence Create Button Placeholder

Adjusted after geofence page review:

- Added a `Create geofence` action button beside the backend geofence count badge in the map header.
- Kept the button presentational for now so the create workflow can be wired in the next pass without changing the current browsing behavior.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
