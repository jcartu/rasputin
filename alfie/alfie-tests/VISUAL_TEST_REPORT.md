# ALFIE Visual Test Report

Visual regression testing suite for ALFIE UI components with baseline screenshot capture and comparison.

## Test Coverage

### Views Tested

| View               | Themes | Viewports | Status |
| ------------------ | ------ | --------- | ------ |
| Welcome Screen     | 6      | 3         | ✅     |
| Chat with Messages | 6      | 3         | ✅     |
| Tool Panel         | 6      | 3         | ✅     |
| File Browser       | 6      | 3         | ✅     |
| Settings Panel     | 6      | 3         | ✅     |
| Search Results     | 6      | 3         | ✅     |
| ActivityLog        | 6      | 3         | ✅     |
| Modals/Dialogs     | 6      | -         | ✅     |

### Theme Coverage

| Theme     | Color Scheme                | Test Count |
| --------- | --------------------------- | ---------- |
| Light     | Light mode default          | 10+        |
| Dark      | Dark mode default           | 10+        |
| Midnight  | Deep dark with blue accents | 10+        |
| Solarized | Warm earthy tones           | 10+        |
| Nord      | Arctic color palette        | 10+        |
| Dracula   | Purple/pink dark theme      | 10+        |

### Responsive Breakpoints

| Viewport | Dimensions | Device Class   |
| -------- | ---------- | -------------- |
| Desktop  | 1920x1080  | Large screens  |
| Tablet   | 768x1024   | iPad/tablets   |
| Mobile   | 375x812    | iPhone/Android |

## Screenshot Locations

After running tests, screenshots are stored in:

```
tests/visual/snapshots.spec.ts-snapshots/
├── welcome-light.png
├── welcome-dark.png
├── welcome-midnight.png
├── welcome-solarized.png
├── welcome-nord.png
├── welcome-dracula.png
├── welcome-desktop.png
├── welcome-tablet.png
├── welcome-mobile.png
├── chat-light.png
├── chat-dark.png
├── chat-midnight.png
├── chat-solarized.png
├── chat-nord.png
├── chat-dracula.png
├── chat-desktop.png
├── chat-tablet.png
├── chat-mobile.png
├── chat-empty-state.png
├── chat-input-focused.png
├── chat-message-bubbles.png
├── tool-panel-light.png
├── tool-panel-dark.png
├── tool-panel-midnight.png
├── tool-panel-solarized.png
├── tool-panel-nord.png
├── tool-panel-dracula.png
├── tool-panel-desktop.png
├── tool-panel-tablet.png
├── tool-panel-mobile.png
├── tool-panel-execution-states.png
├── tool-panel-expanded.png
├── tool-panel-collapsed.png
├── file-browser-light.png
├── file-browser-dark.png
├── file-browser-midnight.png
├── file-browser-solarized.png
├── file-browser-nord.png
├── file-browser-dracula.png
├── file-browser-desktop.png
├── file-browser-tablet.png
├── file-browser-mobile.png
├── file-browser-tree.png
├── file-browser-preview.png
├── settings-light.png
├── settings-dark.png
├── settings-midnight.png
├── settings-solarized.png
├── settings-nord.png
├── settings-dracula.png
├── settings-desktop.png
├── settings-tablet.png
├── settings-mobile.png
├── settings-all-sections.png
├── settings-form-controls.png
├── search-light.png
├── search-dark.png
├── search-midnight.png
├── search-solarized.png
├── search-nord.png
├── search-dracula.png
├── search-desktop.png
├── search-tablet.png
├── search-mobile.png
├── search-empty-state.png
├── search-with-results.png
├── search-no-results.png
├── activity-log-light.png
├── activity-log-dark.png
├── activity-log-midnight.png
├── activity-log-solarized.png
├── activity-log-nord.png
├── activity-log-dracula.png
├── activity-log-closed.png
├── activity-log-open.png
├── activity-log-with-entries.png
├── activity-log-desktop.png
├── activity-log-tablet.png
├── activity-log-mobile.png
├── modal-light.png
├── modal-dark.png
├── modal-midnight.png
├── modal-solarized.png
├── modal-nord.png
├── modal-dracula.png
├── modal-confirmation.png
├── modal-settings.png
├── modal-new-session.png
├── modal-export.png
├── modal-error.png
├── animation-loading-spinner.png
├── animation-skeleton-loading.png
├── animation-progress-bar.png
├── animation-typing-indicator.png
├── animation-fade-transitions.png
├── all-panels-desktop.png
├── all-panels-tablet.png
├── all-panels-mobile.png
├── baseline-home.png
├── baseline-chat.png
├── baseline-settings.png
├── baseline-files.png
├── baseline-search.png
├── baseline-tools.png
├── baseline-scrolled.png
├── cross-browser-chromium.png
├── cross-browser-firefox.png
├── cross-browser-webkit.png
├── cross-browser-dark-chromium.png
├── cross-browser-dark-firefox.png
└── cross-browser-dark-webkit.png
```

## Running Visual Tests

### Generate Baseline Screenshots

```bash
npm run test:visual:update
```

### Run Visual Comparison Tests

```bash
npm run test:visual
```

### Run for Specific Browser

```bash
npx playwright test tests/visual/ --project=chromium
npx playwright test tests/visual/ --project=firefox
npx playwright test tests/visual/ --project=webkit
```

### Run Specific Test Section

```bash
npx playwright test tests/visual/ -g "Welcome Screen"
npx playwright test tests/visual/ -g "Chat"
npx playwright test tests/visual/ -g "ActivityLog"
npx playwright test tests/visual/ -g "Modals"
npx playwright test tests/visual/ -g "Animation"
```

## Test Categories

### 1. Welcome Screen Tests

- Theme variations (6 themes)
- Responsive layouts (3 breakpoints)
- Element visibility verification

### 2. Chat View Tests

- Theme variations
- Responsive layouts
- Empty state
- Input focused state
- Message bubble styles

### 3. Tool Panel Tests

- Theme variations
- Responsive layouts
- Execution states (pending, running, success, error)
- Collapsed/expanded states

### 4. File Browser Tests

- Theme variations
- Responsive layouts
- Tree structure rendering
- File preview modal

### 5. Settings Panel Tests

- Theme variations
- Responsive layouts
- All sections rendered
- Form controls

### 6. Search Results Tests

- Theme variations
- Responsive layouts
- Empty state
- Results display
- No results state

### 7. ActivityLog Tests

- Theme variations
- Open/closed states
- Entry rendering
- Responsive behavior

### 8. Modals and Dialogs Tests

- Theme variations for all modals
- Confirmation dialog
- Settings modal
- New session dialog
- Export dialog
- Error dialog

### 9. Animation Tests

- Loading spinner
- Skeleton loading
- Progress bar
- Typing indicator
- Fade transitions

### 10. Panel Tests

- Sidebar
- Header
- Main content
- Footer
- Chat panel
- Tools panel

### 11. Baseline Screenshots

- All main views
- Scroll state
- Full page capture

### 12. Cross-Browser Tests

- Chromium consistency
- Firefox consistency
- WebKit consistency

## Visual Diff Thresholds

| Setting    | Value    | Purpose                          |
| ---------- | -------- | -------------------------------- |
| threshold  | 0.2      | Pixel difference tolerance (20%) |
| animations | disabled | Consistent captures              |
| fullPage   | varies   | Some tests capture full scroll   |

## Failure Investigation

When tests fail:

1. Check `reports/html/` for the interactive HTML report
2. Compare `actual` vs `expected` screenshots
3. Review the diff image highlighting changes
4. If changes are intentional, update baselines:
   ```bash
   npm run test:visual:update
   ```

## CI/CD Integration

Add to your pipeline:

```yaml
- name: Run Visual Tests
  run: npm run test:visual

- name: Upload Visual Report
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: visual-test-report
    path: |
      tests/visual/snapshots.spec.ts-snapshots/
      reports/
```

## Test Statistics

| Metric           | Count |
| ---------------- | ----- |
| Total test cases | 100+  |
| Views covered    | 8     |
| Themes tested    | 6     |
| Viewports tested | 3     |
| Modal types      | 6     |
| Animation types  | 5     |
| Panel types      | 6     |

## Maintenance

### Adding New Visual Tests

1. Add test to `tests/visual/snapshots.spec.ts`
2. Follow existing patterns for consistency
3. Run `npm run test:visual:update` to generate baseline
4. Commit the new snapshot files

### Updating Baselines

After intentional UI changes:

```bash
npm run test:visual:update
git add tests/visual/snapshots.spec.ts-snapshots/
git commit -m "Update visual baselines for [change description]"
```

### Test File Structure

```
tests/visual/
├── snapshots.spec.ts          # Main visual test file
└── __snapshots__/             # Auto-generated on first run
    └── snapshots.spec.ts-snapshots/
        └── *.png              # Baseline screenshots
```
