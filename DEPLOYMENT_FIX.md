# Cloud Foundry Deployment Fix

## Problem
The CF buildpack was detecting cached `node_modules` and only running `npm rebuild` instead of a full `npm install`. This caused the build to fail because TypeScript (`tsc`) was not available during the build phase.

## Solution Applied: Local Build Strategy

The most reliable solution for Cloud Foundry deployments is to **build locally** before pushing. This avoids buildpack cache issues entirely.

### What Changed

1. **Created `deploy.sh` script**
   - Installs dependencies locally
   - Builds TypeScript to JavaScript
   - Verifies the build succeeded
   - Pushes to Cloud Foundry

2. **Simplified `package.json`**
   - Removed `postinstall` script (was causing issues during npm rebuild)
   - Kept simple `build` and `start` scripts

3. **Configuration remains optimal**
   - `dist/` directory is NOT in `.cfignore` (will be uploaded)
   - `node_modules/` IS in `.cfignore` (won't be uploaded)
   - TypeScript is in `dependencies` (not devDependencies) ✓
   - `NPM_CONFIG_PRODUCTION: false` is set ✓

## How to Deploy

### Option 1: Using the deployment script (Recommended)
```bash
./deploy.sh
```

### Option 2: Manual deployment
```bash
npm install
npm run build
cf push
```

### Option 3: Quick deployment (if already built)
```bash
cf push
```

## What Happens During Deployment

### Local (before CF push)
1. ✓ Dependencies installed
2. ✓ TypeScript compiled to JavaScript in `dist/`

### Cloud Foundry (during staging)
1. CF uploads code including `dist/` folder
2. CF installs production dependencies
3. CF starts app with `npm start`
4. App runs from pre-built `dist/server.js`

## Verifying the Build

Before pushing, verify the build was successful:
```bash
ls -la dist/
# Should show: server.js, config.js, routes/, clients/, etc.
```

## Troubleshooting

### If deployment still fails:
1. **Clear CF cache**:
```bash
cf delete ai-predictive-agent
./deploy.sh
```

2. **Verify local build**:
```bash
npm run build
ls dist/
```

3. **Check CF logs**:
```bash
cf logs ai-predictive-agent --recent
```

### If app doesn't start:
```bash
cf logs ai-predictive-agent --recent
cf restart ai-predictive-agent
```

## Why This Solution Works

- **No buildpack cache issues**: We build locally with all dependencies available
- **Faster CF staging**: CF doesn't need to compile TypeScript
- **More reliable**: We know the build works before pushing
- **Easier debugging**: Build errors happen locally where you can see them clearly
