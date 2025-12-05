# ⚡ FIX 401 UNAUTHORIZED ERROR - START HERE

## 🎯 The Problem
Your app keeps failing with **401 Unauthorized** from SAC. This happens because SAC OAuth credentials are still set to "placeholder".

## ⏱️ Time to Fix: 5 minutes

---

## 🚀 FASTEST WAY TO FIX

### Step 1: Get SAC OAuth Credentials

**Log into SAC:** https://cvs-pharmacy-q.us10.hcs.cloud.sap

**Navigate:** System → Administration → App Integration → Add New OAuth Client

**Configure:**
- Grant Type: `Client Credentials`
- Scopes: Check `Planning` + `Data Import`
- Click Add

**IMPORTANT:** Copy the Client ID and Secret (shown only once!)

---

### Step 2: Set Credentials in Cloud Foundry

**On your terminal:**

```bash
cf set-env ai-predictive-agent SAC_CLIENT_ID "paste-your-client-id"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "paste-your-client-secret"
cf restart ai-predictive-agent
```

---

### Step 3: Verify

```bash
cf logs ai-predictive-agent --recent
```

**Look for:**
✅ "Successfully obtained OAuth access token"  
❌ No more "401 Unauthorized" errors

---

## 📚 Documentation Files

I've created comprehensive guides for you:

| File | Purpose |
|------|---------|
| **PERMANENT_SOLUTION.md** | Complete step-by-step guide (start here) |
| **QUICK_FIX_GUIDE.md** | Fast 5-minute fix with troubleshooting |
| **SAC_CREDENTIALS_SETUP.md** | Detailed OAuth setup instructions |
| **FIX_COMMANDS.sh** | Copy-paste commands reference |
| **set-sac-credentials.sh** | Interactive setup script |

---

## 🎬 Quick Start

**Option 1 - Manual (Recommended):**
```bash
# Read the complete guide
cat PERMANENT_SOLUTION.md

# Then run the commands in Step 2 above
```

**Option 2 - Interactive Script:**
```bash
# Run the interactive setup script
./set-sac-credentials.sh
```

**Option 3 - Copy-Paste Commands:**
```bash
# See all commands you need
./FIX_COMMANDS.sh
```

---

## ✅ Success Checklist

After fixing, you should see:
- [ ] No 401 errors in logs
- [ ] "Successfully obtained OAuth access token" message
- [ ] "Multi-Action triggered successfully" message
- [ ] Widget works in SAC story
- [ ] Can create forecasts without errors

---

## 🆘 If It Still Doesn't Work

1. **Read:** `QUICK_FIX_GUIDE.md` - Has troubleshooting section
2. **Check:** OAuth client has correct scopes (Planning + Data Import)
3. **Verify:** Multi-Action ID is correct: `E5280280114D3785596849C3D321B820`
4. **Test:** OAuth token URL is correct for your region

---

## 💡 Why This is Permanent

Once you set credentials with `cf set-env`:
- ✅ They persist forever (until you delete them)
- ✅ They survive app restarts
- ✅ They survive deployments
- ✅ They're encrypted and secure
- ✅ You never have to set them again

---

## 🔑 Key Commands

```bash
# Set credentials (do once)
cf set-env ai-predictive-agent SAC_CLIENT_ID "your-id"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-secret"
cf restart ai-predictive-agent

# Check if it worked
cf logs ai-predictive-agent --recent | grep -E "(OAuth|401)"

# Future deployments (credentials already there)
cf push
```

---

## 📖 Read This First

👉 **PERMANENT_SOLUTION.md** - Complete guide with everything you need

Then reference others as needed for troubleshooting.

---

## 🎯 Bottom Line

**The fix is simple:**
1. Create OAuth client in SAC (one-time, 2 minutes)
2. Set credentials with `cf set-env` (one-time, 1 minute)
3. Restart app (1 minute)
4. Done! 401 errors stop forever ✅

**Total time:** 5 minutes  
**Frequency:** One-time setup  
**Persistence:** Permanent  

---

## 🚀 Let's Fix This!

Open **PERMANENT_SOLUTION.md** and follow the steps. You'll be done in 5 minutes.

```bash
# On Linux/Mac
cat PERMANENT_SOLUTION.md

# Or open in your editor
code PERMANENT_SOLUTION.md
```

**Questions?** All documentation files have troubleshooting sections.

Good luck! 🎉
