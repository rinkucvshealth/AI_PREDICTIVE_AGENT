# SAC Multi-Action Template

## 📋 Multi-Action Configuration for Predictive Forecasting

This document provides the template for creating the Multi-Action in SAC.

---

## 🎯 Multi-Action Details

**Name**: `Run_Predictive_Forecast`

**Description**: Automated predictive forecasting workflow triggered by AI agent

**Model**: PRDA_PL_PLAN

---

## 📝 Input Parameters

Define these parameters for the Multi-Action:

| Parameter Name | Type | Required | Description | Example |
|---------------|------|----------|-------------|---------|
| `GLAccount` | String | Yes | GL Account number to forecast | "41000000" |
| `ForecastPeriod` | Number | Yes | Number of months to forecast | 6 |
| `VersionName` | String | Yes | Version name for saving forecast | "Forecast_Nov2024" |

---

## 🔄 Multi-Action Steps

### Step 1: Run Predictive Scenario

**Action Type**: Run Predictive Scenario

**Configuration**:
```
Scenario: [Your Predictive Scenario Name]
Input Parameters:
  - GL Account: @GLAccount
  - Forecast Months: @ForecastPeriod
Execution Mode: Synchronous
```

**Settings**:
- Wait for completion: Yes
- Timeout: 300 seconds (5 minutes)
- On Error: Stop execution

---

### Step 2: MultiStep_ToRun_Predictive_Forecastvia_AIagent

**Action Type**: Data Action - Save

**Configuration**:
```
Source: Predictive Scenario Output
Target Version: @VersionName
Data Region: Forecast Period
Commit: Yes
```

**Settings**:
- Overwrite existing data: Yes
- Audit trail: Yes
- On Error: Rollback

---

### Step 3: Refresh Story (Optional)

**Action Type**: Refresh Story

**Configuration**:
```
Story: [Your Forecast Story]
or
Story ID: @StoryID (if passed as parameter)
Refresh Mode: Full
```

**Settings**:
- Wait for refresh: No (async)
- On Error: Log but continue

---

## 🔐 Security & Permissions

### Required User Permissions:
- ✅ Planning Model: Read & Write
- ✅ Predictive Scenarios: Execute
- ✅ Versions: Create & Write
- ✅ Stories: Read & Refresh (if using Step 3)

### Service Account Setup:
1. Create dedicated service account in SAC
2. Assign Planning permissions
3. Grant access to PRDA_PL_PLAN model
4. Test Multi-Action execution

---

## 🧪 Testing Multi-Action

### Manual Test in SAC:

1. Open PRDA_PL_PLAN model
2. Navigate to Multi-Actions
3. Select `Run_Predictive_Forecast`
4. Click **Run**
5. Enter test parameters:
   ```
   GLAccount: 41000000
   ForecastPeriod: 6
   VersionName: Test_Forecast
   ```
6. Monitor execution
7. Verify results in target version

### Expected Results:
- ✅ Predictive scenario completes
- ✅ Forecast data saved to version
- ✅ Story refreshed (if enabled)
- ✅ Execution time: < 2 minutes

---

## 📊 Monitoring & Logging

### Execution Logs:
- Navigate to: Model → Multi-Actions → Execution History
- Check: Execution status, duration, errors
- Filter by: Date, Status, User

### Common Log Entries:
```
✅ SUCCESS: Multi-Action completed successfully
⚠️  WARNING: Story refresh delayed
❌ ERROR: Insufficient permissions
❌ ERROR: Predictive scenario timeout
```

---

## 🔧 Troubleshooting

### Issue: Multi-Action Timeout

**Symptoms**: Execution exceeds 5 minutes

**Solutions**:
- Reduce forecast period
- Optimize predictive scenario
- Add filters to reduce data volume
- Increase timeout in Step 1

### Issue: Version Already Exists

**Symptoms**: Save fails with "version exists" error

**Solutions**:
- Enable "Overwrite existing data" in Step 2
- Use unique version names (add timestamp)
- Delete old versions before running

### Issue: Insufficient Memory

**Symptoms**: Out of memory error during execution

**Solutions**:
- Add GL Account filter
- Reduce forecast period
- Process in smaller batches
- Contact SAC admin for memory increase

---

## 📈 Performance Optimization

### Best Practices:

1. **Limit Data Scope**
   - Use GL Account filter
   - Specify date ranges
   - Filter by organizational units

2. **Version Management**
   - Auto-delete old forecasts
   - Use naming convention: `Forecast_YYYYMMDD_HHMMSS`
   - Keep max 10 forecast versions

3. **Execution Scheduling**
   - Run during off-peak hours
   - Avoid concurrent executions
   - Monitor system load

---

## 🚀 API Integration

Once Multi-Action is created, get the ID:

### Method 1: From URL
```
https://cvs-pharmacy-q.us10.hcs.cloud.sap/sap/fpa/ui/tenants/.../models/PRDA_PL_PLAN/multiactions/{MULTI_ACTION_ID}
                                                                                                      ↑
                                                                                            Copy this ID
```

### Method 2: From API
```bash
curl -X GET \
  'https://cvs-pharmacy-q.us10.hcs.cloud.sap/api/v1/models/PRDA_PL_PLAN/multiactions' \
  -H 'Authorization: Basic <credentials>'
```

### Update AI Agent Config:
```bash
SAC_MULTI_ACTION_ID=<COPIED_ID>
```

---

## ✅ Validation Checklist

Before going live:

- [ ] Multi-Action created in SAC
- [ ] All 3 steps configured correctly
- [ ] Input parameters defined
- [ ] Permissions assigned to service account
- [ ] Manual test successful
- [ ] Multi-Action ID copied
- [ ] AI Agent config updated
- [ ] End-to-end test completed

---

## 📞 Support Contacts

- **SAC Admin**: [Your SAC Admin Team]
- **Predictive Scenarios**: [Analytics Team]
- **Technical Issues**: [IT Support]

---

**Template Version**: 1.0  
**Last Updated**: November 2024
