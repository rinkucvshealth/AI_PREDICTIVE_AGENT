# BAS Pull Instructions - Fix Build Errors

## Issue
You're seeing TypeScript errors in BAS:
```
error TS2339: Property 'username' does not exist on type...
error TS2339: Property 'password' does not exist on type...
```

This means your BAS environment has an **old version** of the code.

---

## ✅ Solution: Clean Pull from GitHub

### Option 1: Use the Automated Script (Recommended)

```bash
# Pull the latest code
git pull origin main

# Run the automated script
bash pull-and-build.sh
```

This script will:
- ✅ Checkout main branch
- ✅ Stash any local changes
- ✅ Pull latest from GitHub
- ✅ Install dependencies
- ✅ Build the project

---

### Option 2: Manual Steps

If the script doesn't work, do this manually:

```bash
# 1. Check current branch
git branch

# 2. Stash any local changes
git stash

# 3. Checkout main branch
git checkout main

# 4. Pull latest changes
git fetch origin
git pull origin main --force

# 5. Verify you have the correct file
git log --oneline -1 src/clients/sac-client.ts
# Should show: "Fix: Implement OAuth 2.0 for SAC API authentication"

# 6. Install dependencies
npm install

# 7. Build
npm run build
```

---

## ✅ Verification

After pulling, verify these files exist and have correct content:

### Check OAuth implementation
```bash
grep -n "config.sac.clientId" src/clients/sac-client.ts
```

**Expected output**: Should show line with `username: config.sac.clientId`

### Check config file
```bash
grep -n "clientId" src/config.ts
```

**Expected output**: Should show `clientId:` and `clientSecret:` fields

---

## 🔍 If You Still Get Errors

### 1. Verify Git Status
```bash
git status
```

**Look for**:
- Uncommitted changes that might be conflicting
- Untracked files that shouldn't be there

### 2. Check File Contents
```bash
# View the OAuth token method
sed -n '65,68p' src/clients/sac-client.ts
```

**Should show**:
```typescript
auth: {
  username: config.sac.clientId,
  password: config.sac.clientSecret,
},
```

**If it shows** `username: config.sac.username` → You have old code!

### 3. Force Clean Pull
```bash
# CAUTION: This will discard all local changes!
git reset --hard origin/main
npm install
npm run build
```

---

## 🚨 Common Issues & Solutions

### Issue: "Your local changes would be overwritten"
```bash
git stash
git pull origin main
```

### Issue: "Already up to date" but still have errors
```bash
# Force fetch and reset
git fetch origin
git reset --hard origin/main
npm run build
```

### Issue: npm install fails
```bash
# Clear npm cache
rm -rf node_modules package-lock.json
npm install
```

### Issue: Build still fails with same errors
```bash
# Check which commit you're on
git log --oneline -1

# Should be: "Add pull-and-build script for BAS" or newer
# If not, force pull:
git fetch origin
git reset --hard origin/main
```

---

## ✅ Success Indicators

After successful pull and build:

1. **Build Output**:
   ```
   > ai-predictive-agent@1.0.0 build
   > tsc
   
   (no errors)
   ```

2. **File Check**:
   ```bash
   ls -la src/clients/sac-client.ts
   # Modified date should be recent
   ```

3. **Content Check**:
   ```bash
   grep "clientId" src/clients/sac-client.ts
   # Should show: username: config.sac.clientId
   ```

---

## 📋 After Successful Build

Once build succeeds, proceed with deployment:

1. **Set OAuth Credentials**:
   ```bash
   cf set-env ai-predictive-agent SAC_CLIENT_ID "your-oauth-client-id"
   cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-oauth-client-secret"
   ```

2. **Deploy**:
   ```bash
   cf push ai-predictive-agent
   ```

3. **Verify**:
   ```bash
   cf logs ai-predictive-agent --recent
   ```

---

## 🆘 Still Having Issues?

### Check Git Remote
```bash
git remote -v
# Should show: https://github.com/rinkucvshealth/AI_PREDICTIVE_AGENT
```

### View Latest Commit on GitHub
Visit: https://github.com/rinkucvshealth/AI_PREDICTIVE_AGENT/commits/main

Latest commit should be: **"Add pull-and-build script for BAS"**

### Nuclear Option (Last Resort)
```bash
# Backup your .env file if you have one
cp .env .env.backup 2>/dev/null

# Clone fresh copy
cd ..
rm -rf AI_PREDICTIVE_AGENT
git clone https://github.com/rinkucvshealth/AI_PREDICTIVE_AGENT
cd AI_PREDICTIVE_AGENT

# Restore .env if you had one
cp ../AI_PREDICTIVE_AGENT.backup/.env . 2>/dev/null

# Build
npm install
npm run build
```

---

## 📞 Quick Help Commands

```bash
# Show current file version
git log -1 --format="%H %s" src/clients/sac-client.ts

# Show what changed in last pull
git log --oneline -5

# Compare your file with GitHub
git diff origin/main src/clients/sac-client.ts

# Show uncommitted changes
git status
git diff
```

---

**Last Updated**: 2025-12-04  
**GitHub Branch**: main  
**Latest Commit**: Add pull-and-build script for BAS
