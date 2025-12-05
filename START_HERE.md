# 🎯 START HERE - Fix 401 Error Permanently

## What's Wrong?
Your app fails with **401 Unauthorized** from SAC because OAuth credentials are "placeholder" instead of real values.

## The Fix (5 minutes)

### 1️⃣ Create OAuth Client in SAC
- Go to: https://cvs-pharmacy-q.us10.hcs.cloud.sap
- Navigate: System → Administration → App Integration
- Add OAuth Client (Grant Type: Client Credentials)
- Copy Client ID and Secret

### 2️⃣ Set Credentials in CF
```bash
cf set-env ai-predictive-agent SAC_CLIENT_ID "your-client-id"
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "your-client-secret"
cf restart ai-predictive-agent
```

### 3️⃣ Done!
Check logs: `cf logs ai-predictive-agent --recent`

Should see: ✅ "Successfully obtained OAuth access token"

---

## 📚 Documentation Guide

| Read This | When | Time |
|-----------|------|------|
| **README_FIX_401.md** | Quick overview | 2 min |
| **PERMANENT_SOLUTION.md** | Complete step-by-step guide | 10 min |
| **VISUAL_FIX_GUIDE.md** | Prefer diagrams? | 5 min |
| **QUICK_FIX_GUIDE.md** | In a hurry? | 3 min |
| **SAC_CREDENTIALS_SETUP.md** | Detailed OAuth setup | 15 min |
| **FIX_COMMANDS.sh** | Just show me commands | 1 min |

---

## 🚀 Quick Commands

```bash
# Step 1: Get credentials from SAC first!

# Step 2: Set them
cf set-env ai-predictive-agent SAC_CLIENT_ID "..."
cf set-env ai-predictive-agent SAC_CLIENT_SECRET "..."
cf restart ai-predictive-agent

# Step 3: Verify
cf logs ai-predictive-agent --recent | grep -E "(OAuth|401)"
```

---

## ✅ What Success Looks Like

**Logs will show:**
```
[INFO] Successfully obtained OAuth access token ✅
[INFO] Multi-Action triggered successfully ✅
```

**No more:**
```
[ERROR] 401 Unauthorized ❌
[ERROR] Failed to trigger Multi-Action ❌
```

---

## 🆘 Need Help?

1. **Can't create OAuth client?** → Ask your SAC admin
2. **Still getting 401?** → Read QUICK_FIX_GUIDE.md (troubleshooting section)
3. **CF CLI not working?** → Install from https://docs.cloudfoundry.org/cf-cli/

---

## 💡 Why This Works

- OAuth credentials authenticate your app with SAC
- Cloud Foundry stores them securely
- They persist across restarts and deployments
- One-time setup, permanent fix

---

## 🎯 Bottom Line

**Problem:** 401 Unauthorized from SAC  
**Cause:** Placeholder OAuth credentials  
**Fix:** Set real credentials with `cf set-env`  
**Time:** 5 minutes  
**Frequency:** One-time  

**Ready?** → Open PERMANENT_SOLUTION.md and follow the steps!
