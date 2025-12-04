# Merge Conflict Resolution Guide

## 🚨 Conflict Summary

You have a merge conflict in `src/server.ts` when pulling from GitHub.

```
CONFLICT (content): Merge conflict in src/server.ts
Automatic merge failed; fix conflicts and then commit the result.
```

---

## 📋 Quick Resolution (Recommended)

Since the GitHub version has the latest widget fixes, **accept the incoming changes** from GitHub:

### Option 1: Accept GitHub Version (Easiest)

```bash
# In BAS terminal
cd ~/projects/AI_PREDICTIVE_AGENT

# Accept the GitHub version (theirs)
git checkout --theirs src/server.ts

# Stage the resolved file
git add src/server.ts

# Complete the merge
git commit -m "Merge: Resolve conflict by accepting GitHub widget fixes"

# Verify everything is up to date
git status
```

This will use the complete version from GitHub that includes all widget routes.

---

## 📋 Manual Resolution (If You Made Local Changes)

If you have local changes in BAS that you want to keep:

### Step 1: View the Conflict

```bash
cat src/server.ts
```

Look for conflict markers:

```typescript
<<<<<<< HEAD
// Your local BAS version
=======
// GitHub version with widget routes
>>>>>>> origin/main
```

### Step 2: Edit the File

Open `src/server.ts` in BAS editor and look for sections marked with:
- `<<<<<<< HEAD` - Your local version
- `=======` - Divider
- `>>>>>>> origin/main` - GitHub version

### Step 3: Choose What to Keep

The GitHub version should have this code (which you want):

```typescript
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';  // ← This is needed for widget
import { config } from './config';
import { logger } from './utils/logger';
import forecastRouter from './routes/forecast';

// ... middle of file ...

// API routes
app.use('/api/forecast', forecastRouter);

// Serve widget files (no authentication required for SAC to load them)
app.use('/widget', express.static(path.join(__dirname, '../public/widget'), {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Content-Type', 'application/javascript');
  }
}));
```

**Keep this GitHub version!** It has the widget routes.

### Step 4: Remove Conflict Markers

Delete these lines:
```
<<<<<<< HEAD
=======
>>>>>>> origin/main
```

Keep only the content you want.

### Step 5: Save and Commit

```bash
# Stage the resolved file
git add src/server.ts

# Complete the merge
git commit -m "Merge: Resolve conflict in server.ts - keep widget routes"

# Verify
git status
```

---

## ✅ Quick Fix Script

Copy and paste this entire block into BAS terminal:

```bash
cd ~/projects/AI_PREDICTIVE_AGENT

# Accept GitHub version (has widget fixes)
git checkout --theirs src/server.ts

# Stage and commit
git add src/server.ts
git commit -m "Merge: Accept GitHub widget fixes"

# Verify merge is complete
if [ $? -eq 0 ]; then
  echo "✅ Merge conflict resolved!"
  echo "Ready to build and deploy"
  git status
else
  echo "❌ Something went wrong. Check git status."
fi
```

---

## 🔍 Verify Resolution

After resolving, check that `src/server.ts` has:

```bash
# Should find 'path' import
grep "import path" src/server.ts

# Should find widget route
grep "app.use('/widget'" src/server.ts
```

**Expected output**: Both commands should find matches.

---

## 🚀 After Resolving Conflict

Once the merge is complete:

```bash
# Build the app
npm run build

# Deploy to Cloud Foundry
cf push ai-predictive-agent

# Verify deployment
cf logs ai-predictive-agent --recent
```

---

## 🆘 If You're Stuck

### Nuclear Option: Start Fresh

If the conflict is too confusing, start with a clean copy:

```bash
cd ~/projects

# Backup current version (just in case)
mv AI_PREDICTIVE_AGENT AI_PREDICTIVE_AGENT.backup

# Clone fresh from GitHub
git clone https://github.com/rinkucvshealth/AI_PREDICTIVE_AGENT
cd AI_PREDICTIVE_AGENT

# Install and build
npm install
npm run build

# Deploy
cf push ai-predictive-agent
```

This gives you a clean copy with all the widget fixes from GitHub.

---

## 📊 What Caused the Conflict

**Timeline**:
1. You had an older version in BAS
2. I pushed widget fixes to GitHub (added widget routes)
3. You tried to pull → Git found conflicting changes in `src/server.ts`
4. Git couldn't auto-merge → Manual resolution needed

**The Issue**: 
- Your local BAS had one version of `src/server.ts`
- GitHub has a newer version with widget routes
- Both modified the same lines

**The Solution**:
- Accept GitHub version (has all the fixes)

---

## ✅ Success Indicators

After resolving:

```bash
git status
```

**Should show**:
```
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

**Should NOT show**:
```
You have unmerged paths.
(fix conflicts and run "git commit")
```

---

## 🎯 Quick Commands Reference

```bash
# Accept GitHub version
git checkout --theirs src/server.ts
git add src/server.ts
git commit -m "Merge: Accept GitHub widget fixes"

# Check status
git status

# Build and deploy
npm run build
cf push ai-predictive-agent
```

---

**Recommended**: Use **Option 1** (accept GitHub version) since it has all the complete fixes!
