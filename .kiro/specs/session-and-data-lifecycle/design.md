# Design Document: Session and Data Lifecycle Management

## Overview

This design implements automatic session termination and data cleanup when users close the browser tab/window. The system distinguishes between page refreshes and actual close events, prompts users to save CSV recommendations before cleanup, and maintains separate lifecycle policies for CSV mode (temporary) vs Cloud mode (persistent) data.

The implementation uses the `beforeunload` event for close detection, `sessionStorage` for page visit tracking, and the `sendBeacon` API for reliable cleanup requests during window unload. A background cleanup job handles orphaned data from force-closed browsers.

### Key Design Decisions

1. **Event Detection**: Use `beforeunload` event with navigation timing to distinguish refresh from close
2. **Storage Strategy**: sessionStorage for visit tracking (auto-clears on session end), localStorage for auth tokens
3. **Cleanup Reliability**: sendBeacon API ensures cleanup requests complete even during page unload
4. **Mode Distinction**: Store mode flag with recommendations to enable selective cleanup
5. **Background Cleanup**: Scheduled job (every 6 hours) removes orphaned CSV data older than 24 hours
6. **Execution Order**: Save report → Delete recommendations → Clear auth (ensures data integrity)

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌─────────────────────┐      │
│  │   App.jsx        │────────▶│  CloseEventHandler  │      │
│  │  (beforeunload)  │         │  - detectEventType  │      │
│  └──────────────────┘         │  - handleClose      │      │
│                                │  - showPrompt       │      │
│                                └──────────┬──────────┘      │
│                                           │                  │
│  ┌──────────────────┐         ┌──────────▼──────────┐      │
│  │ Recommendations  │────────▶│  PageVisitTracker   │      │
│  │     .jsx         │         │  (sessionStorage)   │      │
│  └──────────────────┘         └─────────────────────┘      │
│                                                              │
│  ┌──────────────────┐         ┌─────────────────────┐      │
│  │  AuthContext     │────────▶│  SessionManager     │      │
│  │    .jsx          │         │  - clearAuth        │      │
│  └──────────────────┘         │  - executeCleanup   │      │
│                                └──────────┬──────────┘      │
│                                           │                  │
│                                           │ sendBeacon       │
└───────────────────────────────────────────┼──────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌─────────────────────┐      │
│  │  csvController   │────────▶│ DataCleanupService  │      │
│  │  - cleanup       │         │  - deleteCSVData    │      │
│  │  - saveReport    │         │  - preserveCloud    │      │
│  └──────────────────┘         └─────────────────────┘      │
│                                                              │
│  ┌──────────────────┐         ┌─────────────────────┐      │
│  │ cleanupService   │────────▶│  BackgroundJob      │      │
│  │    .js           │         │  - every 6 hours    │      │
│  └──────────────────┘         │  - remove old data  │      │
│                                └─────────────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │              MongoDB Collections                  │      │
│  │  - reports (persistent)                           │      │
│  │  - csvUploads (temporary, with mode flag)        │      │
│  │  - cloud_resources (persistent)                   │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Normal Close Flow (with save):**
```
1. User closes tab
2. beforeunload event fires
3. Check sessionStorage for 'visitedRecommendations'
4. If visited: Show prompt (returnValue = message)
5. User clicks "Save"
6. POST /api/csv/save-report (sendBeacon)
7. POST /api/csv/cleanup (sendBeacon)
8. Clear localStorage auth tokens
9. Window closes
```

**Normal Close Flow (without save):**
```
1. User closes tab
2. beforeunload event fires
3. Check sessionStorage for 'visitedRecommendations'
4. If visited: Show prompt
5. User clicks "Don't Save" or timeout (30s)
6. POST /api/csv/cleanup (sendBeacon)
7. Clear localStorage auth tokens
8. Window closes
```

**Refresh Flow:**
```
1. User refreshes page
2. beforeunload event fires
3. Detect refresh via performance.navigation.type === 1
4. Skip cleanup operations
5. Preserve localStorage auth tokens
6. Preserve sessionStorage visit tracking
7. Page reloads
```

**Force-Close Flow:**
```
1. Browser crashes or force-quits
2. No beforeunload event
3. Auth tokens remain in localStorage (expire in 24h)
4. CSV data remains in MongoDB (marked with timestamp)
5. Background job runs every 6 hours
6. Removes CSV data older than 24 hours
7. Logs cleanup count
```

## Components and Interfaces

### Frontend Components

#### 1. CloseEventHandler (App.jsx)

**Purpose**: Detect window close events and orchestrate cleanup operations

**Interface**:
```typescript
interface CloseEventHandler {
  // Event handler attached to window.beforeunload
  handleBeforeUnload(event: BeforeUnloadEvent): string | void;
  
  // Distinguish between refresh and close
  detectEventType(): 'refresh' | 'close';
  
  // Execute cleanup sequence
  executeCleanup(saveReport: boolean): Promise<void>;
}
```

**Implementation Details**:
- Attach to `window.addEventListener('beforeunload', handler)`
- Use `performance.navigation.type` to detect refresh (type === 1)
- Use `event.returnValue` to show browser's native prompt
- Set cleanup timeout: 5 seconds max
- Use sendBeacon for reliability

**Key Logic**:
```javascript
const handleBeforeUnload = (event) => {
  // Detect event type
  const isRefresh = performance.navigation.type === 1 ||
                    performance.getEntriesByType('navigation')[0]?.type === 'reload';
  
  if (isRefresh) {
    // Don't cleanup on refresh
    return;
  }
  
  // Check if user visited recommendations page
  const visitedRecs = sessionStorage.getItem('visitedRecommendations');
  const hasCSVData = localStorage.getItem('offlineAnalysis');
  
  if (visitedRecs && hasCSVData) {
    // Show prompt
    event.preventDefault();
    event.returnValue = 'You have unsaved recommendations. Save before closing?';
    
    // Note: Modern browsers show generic message, not custom text
    // User choice triggers cleanup via separate handler
  } else {
    // Silent cleanup
    executeCleanup(false);
  }
};
```

#### 2. PageVisitTracker (Recommendations.jsx)

**Purpose**: Track whether user has viewed the Recommendations page

**Interface**:
```typescript
interface PageVisitTracker {
  // Mark page as visited
  markVisited(): void;
  
  // Check if page was visited
  hasVisited(): boolean;
  
  // Reset tracking (new session)
  reset(): void;
}
```

**Implementation Details**:
- Use `sessionStorage.setItem('visitedRecommendations', 'true')` on component mount
- sessionStorage auto-clears when browser/tab closes
- Persists across page refreshes within same session

**Key Logic**:
```javascript
useEffect(() => {
  // Mark page as visited when component mounts
  sessionStorage.setItem('visitedRecommendations', 'true');
  
  return () => {
    // Cleanup on unmount (optional)
  };
}, []);
```

#### 3. SessionManager (AuthContext.jsx)

**Purpose**: Manage authentication state and coordinate cleanup operations

**Interface**:
```typescript
interface SessionManager {
  // Clear authentication tokens
  clearAuth(): void;
  
  // Execute cleanup in correct order
  executeCleanup(options: CleanupOptions): Promise<void>;
  
  // Send cleanup request via sendBeacon
  sendCleanupBeacon(endpoint: string, data: object): boolean;
}

interface CleanupOptions {
  saveReport: boolean;
  userId: string;
  recommendations?: Array<Recommendation>;
}
```

**Implementation Details**:
- Execution order: save report → delete CSV data → clear auth
- Use sendBeacon for reliability during unload
- Handle errors gracefully (log and continue)
- Timeout after 5 seconds

**Key Logic**:
```javascript
const executeCleanup = async (options) => {
  const { saveReport, userId, recommendations } = options;
  const startTime = Date.now();
  const MAX_CLEANUP_TIME = 5000; // 5 seconds
  
  try {
    // Step 1: Save report if requested
    if (saveReport && recommendations) {
      const reportData = JSON.stringify({
        userId,
        name: `Report - ${new Date().toISOString()}`,
        type: 'CSV',
        recommendations
      });
      
      navigator.sendBeacon('/api/csv/save-report', reportData);
      
      // Wait briefly for save to initiate
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Step 2: Delete CSV recommendations
    const cleanupData = JSON.stringify({ userId, mode: 'csv' });
    navigator.sendBeacon('/api/csv/cleanup', cleanupData);
    
    // Step 3: Clear auth tokens
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    
    // Step 4: Clear CSV data cache
    localStorage.removeItem('offlineAnalysis');
    
    console.log('[Cleanup] Completed successfully');
  } catch (error) {
    console.error('[Cleanup] Error:', error);
    // Continue with auth clearing even if cleanup fails
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
  }
};
```

### Backend Components

#### 1. DataCleanupService (csvController.js)

**Purpose**: Delete CSV recommendations while preserving Cloud mode data

**Interface**:
```typescript
interface DataCleanupService {
  // Delete CSV recommendations for user
  deleteCSVRecommendations(userId: string): Promise<CleanupResult>;
  
  // Save report before cleanup
  saveReport(userId: string, reportData: ReportData): Promise<Report>;
  
  // Check if data is from CSV or Cloud mode
  getDataMode(userId: string): Promise<'csv' | 'cloud'>;
}

interface CleanupResult {
  success: boolean;
  deletedCount: number;
  errors?: Array<string>;
}
```

**Implementation Details**:
- Query by userId and mode field
- Only delete records where `mode === 'csv'` or `source === 'csv'`
- Preserve Cloud mode data (cloud_resources collection)
- Log all operations with timestamps
- Return deletion count

**Key Logic**:
```javascript
const deleteCSVRecommendations = async (userId) => {
  try {
    // Delete CSV uploads
    const csvResult = await CSVUpload.deleteMany({
      userId: userId,
      // Only delete CSV mode data
    });
    
    // Clear cached analysis data (if stored in DB)
    // Note: offlineAnalysis is in localStorage, cleared by frontend
    
    console.log(`[Cleanup] Deleted ${csvResult.deletedCount} CSV records for user ${userId}`);
    
    return {
      success: true,
      deletedCount: csvResult.deletedCount
    };
  } catch (error) {
    console.error('[Cleanup] Error deleting CSV data:', error);
    return {
      success: false,
      deletedCount: 0,
      errors: [error.message]
    };
  }
};
```

#### 2. BackgroundCleanupJob (cleanupService.js)

**Purpose**: Remove orphaned CSV data from force-closed browsers

**Interface**:
```typescript
interface BackgroundCleanupJob {
  // Start the scheduled job
  start(): void;
  
  // Stop the scheduled job
  stop(): void;
  
  // Execute cleanup logic
  cleanupOrphanedData(): Promise<CleanupStats>;
}

interface CleanupStats {
  recordsRemoved: number;
  timestamp: Date;
  errors?: Array<string>;
}
```

**Implementation Details**:
- Use `node-cron` or `node-schedule` for scheduling
- Run every 6 hours: `0 */6 * * *`
- Delete CSV data older than 24 hours
- Log cleanup statistics
- Handle errors gracefully

**Key Logic**:
```javascript
const cron = require('node-cron');

// Run every 6 hours
const schedule = '0 */6 * * *';

const cleanupOrphanedData = async () => {
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  
  try {
    // Delete old CSV uploads
    const result = await CSVUpload.deleteMany({
      uploadDate: { $lt: cutoffTime },
      status: 'processed' // Only cleanup processed uploads
    });
    
    console.log(`[Background Cleanup] Removed ${result.deletedCount} orphaned CSV records`);
    
    return {
      recordsRemoved: result.deletedCount,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('[Background Cleanup] Error:', error);
    return {
      recordsRemoved: 0,
      timestamp: new Date(),
      errors: [error.message]
    };
  }
};

// Start the job
const startCleanupJob = () => {
  cron.schedule(schedule, cleanupOrphanedData);
  console.log('[Background Cleanup] Job started, running every 6 hours');
};

module.exports = { startCleanupJob, cleanupOrphanedData };
```

## Data Models

### Modified CSVUpload Model

Add fields to track mode and timestamps for cleanup:

```javascript
const CSVUploadSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    path: { type: String, required: true },
    size: { type: Number, required: true },
    uploadDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
    processedRecords: { type: Number, default: 0 },
    
    // NEW FIELDS for lifecycle management
    mode: { type: String, enum: ['csv', 'cloud'], default: 'csv' },
    lastAccessed: { type: Date, default: Date.now },
    markedForDeletion: { type: Boolean, default: false }
});

// Index for efficient cleanup queries
CSVUploadSchema.index({ uploadDate: 1, status: 1 });
CSVUploadSchema.index({ userId: 1, mode: 1 });
```

### Report Model (existing, no changes needed)

```javascript
const ReportSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['CSV', 'Cloud', 'Combined'], default: 'CSV' },
    status: { type: String, enum: ['Generated', 'Archived', 'Deleted'], default: 'Generated' },
    recommendations: [{ /* recommendation data */ }],
    summary: { /* aggregated stats */ },
    generatedAt: { type: Date, default: Date.now },
    size: String
});
```

### localStorage Structure

```typescript
interface LocalStorage {
  // Authentication
  token: string;              // JWT token
  userId: string;             // User ID
  user: string;               // Username
  
  // CSV Data Cache
  offlineAnalysis: string;    // JSON stringified recommendations
}
```

### sessionStorage Structure

```typescript
interface SessionStorage {
  // Page Visit Tracking
  visitedRecommendations: 'true' | null;  // Set when user visits Recommendations page
}
```

## API Endpoints

### 1. POST /api/csv/cleanup

**Purpose**: Delete CSV recommendations for authenticated user

**Request**:
```typescript
{
  userId: string;
  mode: 'csv' | 'cloud';
}
```

**Response**:
```typescript
{
  success: boolean;
  deletedCount: number;
  message: string;
}
```

**Implementation**:
```javascript
router.post('/cleanup', authenticateToken, async (req, res) => {
  try {
    const { userId, mode } = req.body;
    
    // Verify user matches authenticated user
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Only cleanup CSV mode data
    if (mode !== 'csv') {
      return res.json({ success: true, deletedCount: 0, message: 'No cleanup needed for Cloud mode' });
    }
    
    const result = await CSVUpload.deleteMany({
      userId: userId,
      mode: 'csv'
    });
    
    console.log(`[Cleanup] User ${userId} - deleted ${result.deletedCount} CSV records`);
    
    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: 'CSV data cleaned up successfully'
    });
  } catch (error) {
    console.error('[Cleanup] Error:', error);
    res.status(500).json({ error: 'Cleanup failed', details: error.message });
  }
});
```

### 2. POST /api/csv/save-report

**Purpose**: Save recommendations as a persistent report

**Request**:
```typescript
{
  userId: string;
  name: string;
  type: 'CSV' | 'Cloud' | 'Combined';
  recommendations: Array<Recommendation>;
}
```

**Response**:
```typescript
{
  success: boolean;
  reportId: string;
  message: string;
}
```

**Implementation**:
```javascript
router.post('/save-report', authenticateToken, async (req, res) => {
  try {
    const { userId, name, type, recommendations } = req.body;
    
    // Verify user
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Calculate summary stats
    const summary = {
      totalRecommendations: recommendations.length,
      totalSavings: recommendations.reduce((sum, r) => sum + (r.savings || 0), 0),
      oversizedCount: recommendations.filter(r => r.finding === 'Oversized').length,
      undersizedCount: recommendations.filter(r => r.finding === 'Undersized').length,
      optimalCount: recommendations.filter(r => r.finding === 'Optimal').length,
      avgConfidence: recommendations.reduce((sum, r) => sum + (r.confidence || 0), 0) / recommendations.length
    };
    
    // Create report
    const report = new Report({
      userId,
      name,
      type,
      recommendations,
      summary,
      generatedAt: new Date()
    });
    
    await report.save();
    
    console.log(`[Save Report] User ${userId} - saved report ${report._id}`);
    
    res.json({
      success: true,
      reportId: report._id,
      message: 'Report saved successfully'
    });
  } catch (error) {
    console.error('[Save Report] Error:', error);
    res.status(500).json({ error: 'Failed to save report', details: error.message });
  }
});
```

### 3. GET /api/csv/cleanup-stats

**Purpose**: Get cleanup statistics (admin/debugging)

**Response**:
```typescript
{
  totalCSVRecords: number;
  oldRecords: number;  // > 24 hours
  lastCleanup: Date;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

After analyzing the acceptance criteria, I've identified the following testable properties. Note that many criteria were combined or marked as examples rather than universal properties, as they test specific scenarios rather than rules that apply across all inputs.

### Property 1: Event Type Detection Accuracy

*For any* beforeunload event, the Close_Event_Handler should correctly classify it as either 'refresh' or 'close', and these classifications should be mutually exclusive and exhaustive.

**Validates: Requirements 1.5**

### Property 2: CSV Mode Data Cleanup on Close

*For any* authenticated user with CSV mode recommendations, when a close event (not refresh) occurs, all CSV recommendations associated with that user should be deleted from the database.

**Validates: Requirements 2.1, 2.2, 8.3**

### Property 3: Cloud Mode Data Preservation

*For any* authenticated user with Cloud mode recommendations, when a close event occurs, none of the Cloud mode recommendations should be deleted.

**Validates: Requirements 2.3, 8.2**

### Property 4: Report Persistence Completeness

*For any* set of recommendations being saved as a report, the persisted report in the Reports_Collection should contain all recommendation data from the original set.

**Validates: Requirements 4.1**

### Property 5: Report Timestamp Presence

*For any* report saved to the Reports_Collection, the report document should include a valid timestamp indicating when it was created.

**Validates: Requirements 4.2**

### Property 6: Report User Association

*For any* report saved to the Reports_Collection, the report document should be associated with the authenticated userId who created it.

**Validates: Requirements 4.3**

### Property 7: Cleanup Idempotency

*For any* user session, if multiple close events are triggered in rapid succession, only one cleanup operation should execute (subsequent requests should be ignored or return immediately).

**Validates: Requirements 5.4**

### Property 8: Page Visit Recording

*For any* navigation to the Recommendations page, the Page_Visit_Tracker should set the visit status to true in sessionStorage.

**Validates: Requirements 6.1**

### Property 9: Visit Status Availability on Close

*For any* close event, the Page_Visit_Tracker should provide the current visit status (visited or not visited) to the Close_Event_Handler.

**Validates: Requirements 6.2**

### Property 10: Token Expiration Limit

*For any* JWT authentication token generated by the system, the token's expiration time should be no more than 24 hours from the time of creation.

**Validates: Requirements 7.2**

### Property 11: Orphaned Data Cleanup

*For any* CSV recommendation record older than 24 hours, when the background cleanup job runs, that record should be removed from the database.

**Validates: Requirements 7.4**

### Property 12: Mode Identification

*For any* recommendation record in the system, it should be possible to determine whether it was generated from CSV mode or Cloud mode.

**Validates: Requirements 8.1**

### Property 13: Mode Storage with Recommendations

*For any* recommendation record created, the record should include a field indicating its source mode (CSV or Cloud).

**Validates: Requirements 8.4**

### Property 14: Mode Data Isolation

*For any* user who switches between CSV and Cloud modes, the recommendations from each mode should be stored and tracked separately (operations on CSV data should not affect Cloud data and vice versa).

**Validates: Requirements 8.5**

## Error Handling

### Error Categories

1. **Network Errors**: sendBeacon failures, API timeouts
2. **Storage Errors**: localStorage/sessionStorage quota exceeded
3. **Database Errors**: MongoDB connection failures, query errors
4. **Timing Errors**: Cleanup timeout, prompt timeout
5. **State Errors**: Invalid user state, missing data

### Error Handling Strategy

#### Frontend Error Handling

**localStorage/sessionStorage Errors**:
```javascript
try {
  sessionStorage.setItem('visitedRecommendations', 'true');
} catch (error) {
  console.error('[PageVisit] Storage error:', error);
  // Fallback: use in-memory flag
  window._visitedRecommendations = true;
}
```

**sendBeacon Failures**:
```javascript
const success = navigator.sendBeacon('/api/csv/cleanup', data);
if (!success) {
  console.error('[Cleanup] sendBeacon failed, attempting fetch');
  // Fallback: try fetch with keepalive
  fetch('/api/csv/cleanup', {
    method: 'POST',
    body: data,
    keepalive: true
  }).catch(err => {
    console.error('[Cleanup] Fetch also failed:', err);
    // Last resort: clear local data anyway
    localStorage.removeItem('offlineAnalysis');
  });
}
```

**Cleanup Timeout**:
```javascript
const cleanupWithTimeout = async (cleanupFn, timeout = 5000) => {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Cleanup timeout')), timeout)
  );
  
  try {
    await Promise.race([cleanupFn(), timeoutPromise]);
  } catch (error) {
    console.error('[Cleanup] Timeout or error:', error);
    // Continue with auth clearing
    clearAuthTokens();
  }
};
```

**Prompt Timeout**:
```javascript
// Browser's native beforeunload prompt has built-in timeout
// For custom prompts (if used):
const showPromptWithTimeout = (message, timeout = 30000) => {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.log('[Prompt] Timeout - defaulting to no save');
      resolve(false);
    }, timeout);
    
    // Show prompt and wait for user response
    const response = confirm(message);
    clearTimeout(timer);
    resolve(response);
  });
};
```

#### Backend Error Handling

**Database Errors**:
```javascript
const deleteCSVRecommendations = async (userId) => {
  try {
    const result = await CSVUpload.deleteMany({ userId, mode: 'csv' });
    return { success: true, deletedCount: result.deletedCount };
  } catch (error) {
    console.error(`[Cleanup] DB error for user ${userId}:`, error);
    
    // Log to error tracking service
    logger.error('CSV cleanup failed', {
      userId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date()
    });
    
    // Return partial success
    return {
      success: false,
      deletedCount: 0,
      errors: [error.message]
    };
  }
};
```

**Report Save Failures**:
```javascript
router.post('/save-report', authenticateToken, async (req, res) => {
  try {
    const report = new Report(req.body);
    await report.save();
    res.json({ success: true, reportId: report._id });
  } catch (error) {
    console.error('[Save Report] Error:', error);
    
    // Log error with context
    logger.error('Report save failed', {
      userId: req.body.userId,
      error: error.message,
      timestamp: new Date()
    });
    
    // Return error to frontend
    res.status(500).json({
      error: 'Failed to save report',
      message: 'Your recommendations are still available. Please try saving again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
```

**Background Job Errors**:
```javascript
const cleanupOrphanedData = async () => {
  try {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await CSVUpload.deleteMany({
      uploadDate: { $lt: cutoffTime },
      status: 'processed'
    });
    
    logger.info('Background cleanup completed', {
      recordsRemoved: result.deletedCount,
      timestamp: new Date()
    });
    
    return { recordsRemoved: result.deletedCount, timestamp: new Date() };
  } catch (error) {
    logger.error('Background cleanup failed', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date()
    });
    
    // Don't throw - let job continue on next schedule
    return { recordsRemoved: 0, timestamp: new Date(), errors: [error.message] };
  }
};
```

### Error Logging

All errors should be logged with:
- Timestamp
- User ID (if available)
- Error message and stack trace
- Context (what operation was being performed)
- Environment (development/production)

**Logging Format**:
```javascript
logger.error('Operation failed', {
  operation: 'csv-cleanup',
  userId: userId,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV
});
```

### Graceful Degradation

**Priority Order**:
1. Clear authentication tokens (highest priority - security)
2. Delete CSV recommendations (medium priority - data cleanup)
3. Save report (lowest priority - user convenience)

If any operation fails, continue with remaining operations:
```javascript
const executeCleanup = async (options) => {
  const errors = [];
  
  // Try to save report
  if (options.saveReport) {
    try {
      await saveReport(options.recommendations);
    } catch (error) {
      errors.push({ operation: 'save-report', error: error.message });
      // Continue with cleanup
    }
  }
  
  // Try to delete CSV data
  try {
    await deleteCSVData(options.userId);
  } catch (error) {
    errors.push({ operation: 'delete-csv', error: error.message });
    // Continue with auth clearing
  }
  
  // Always clear auth tokens (critical for security)
  try {
    clearAuthTokens();
  } catch (error) {
    errors.push({ operation: 'clear-auth', error: error.message });
    // Force clear even if error
    localStorage.clear();
  }
  
  if (errors.length > 0) {
    console.error('[Cleanup] Completed with errors:', errors);
  }
};
```

## Testing Strategy

This feature requires a dual testing approach combining unit tests for specific scenarios and property-based tests for universal behaviors.

### Unit Testing

Unit tests focus on specific examples, edge cases, and integration points:

**Frontend Unit Tests** (Jest + React Testing Library):

1. **Close Event Detection**:
   - Test beforeunload event fires on tab close
   - Test beforeunload event fires on window close
   - Test refresh detection (performance.navigation.type === 1)
   - Test navigation away detection

2. **Page Visit Tracking**:
   - Test sessionStorage is set when Recommendations page mounts
   - Test sessionStorage persists across refresh
   - Test sessionStorage clears on new session

3. **Prompt Display Logic**:
   - Test prompt shows when visitedRecommendations=true and hasCSVData=true
   - Test prompt doesn't show when visitedRecommendations=false
   - Test prompt doesn't show when hasCSVData=false
   - Test prompt timeout after 30 seconds

4. **Cleanup Execution Order**:
   - Test save report executes before delete CSV
   - Test delete CSV executes before clear auth
   - Test cleanup timeout after 5 seconds

5. **sendBeacon Usage**:
   - Test sendBeacon is called with correct endpoint
   - Test sendBeacon is called with correct data
   - Test fallback to fetch when sendBeacon fails

**Backend Unit Tests** (Jest + Supertest):

1. **Cleanup Endpoint**:
   - Test DELETE /api/csv/cleanup deletes CSV records
   - Test DELETE /api/csv/cleanup preserves Cloud records
   - Test DELETE /api/csv/cleanup requires authentication
   - Test DELETE /api/csv/cleanup returns deletion count

2. **Save Report Endpoint**:
   - Test POST /api/csv/save-report creates report
   - Test POST /api/csv/save-report includes timestamp
   - Test POST /api/csv/save-report associates userId
   - Test POST /api/csv/save-report handles errors

3. **Background Cleanup Job**:
   - Test job deletes records older than 24 hours
   - Test job preserves records newer than 24 hours
   - Test job logs deletion count
   - Test job handles database errors

### Property-Based Testing

Property-based tests verify universal behaviors across many generated inputs. We'll use **fast-check** for JavaScript property testing.

**Configuration**: Each property test should run minimum 100 iterations.

**Property Test 1: Event Type Detection Accuracy**
```javascript
// Feature: session-and-data-lifecycle, Property 1: Event type detection is mutually exclusive
const fc = require('fast-check');

test('Property 1: Event type detection is mutually exclusive and exhaustive', () => {
  fc.assert(
    fc.property(
      fc.record({
        navigationType: fc.integer({ min: 0, max: 2 }),
        navigationEntryType: fc.constantFrom('navigate', 'reload', 'back_forward', 'prerender')
      }),
      (mockNavigation) => {
        const eventType = detectEventType(mockNavigation);
        
        // Should return either 'refresh' or 'close', never both or neither
        expect(['refresh', 'close']).toContain(eventType);
        
        // Verify classification logic
        if (mockNavigation.navigationType === 1 || mockNavigation.navigationEntryType === 'reload') {
          expect(eventType).toBe('refresh');
        } else {
          expect(eventType).toBe('close');
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test 2: CSV Mode Data Cleanup**
```javascript
// Feature: session-and-data-lifecycle, Property 2: CSV data is deleted on close
test('Property 2: All CSV recommendations are deleted on close', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.array(fc.record({
        userId: fc.uuid(),
        mode: fc.constant('csv'),
        recommendations: fc.array(fc.anything())
      }), { minLength: 1, maxLength: 20 }),
      async (csvRecords) => {
        // Setup: Insert CSV records
        await CSVUpload.insertMany(csvRecords);
        
        // Execute: Cleanup for each user
        for (const record of csvRecords) {
          await deleteCSVRecommendations(record.userId);
        }
        
        // Verify: All CSV records deleted
        for (const record of csvRecords) {
          const remaining = await CSVUpload.find({ userId: record.userId, mode: 'csv' });
          expect(remaining).toHaveLength(0);
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test 3: Cloud Mode Data Preservation**
```javascript
// Feature: session-and-data-lifecycle, Property 3: Cloud data is preserved on close
test('Property 3: Cloud recommendations are never deleted on close', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.array(fc.record({
        userId: fc.uuid(),
        mode: fc.constant('cloud'),
        resourceId: fc.string(),
        provider: fc.constantFrom('AWS', 'AZURE', 'GCP')
      }), { minLength: 1, maxLength: 20 }),
      async (cloudRecords) => {
        // Setup: Insert Cloud records
        await CloudResource.insertMany(cloudRecords);
        
        const beforeCount = await CloudResource.countDocuments({ mode: 'cloud' });
        
        // Execute: Attempt cleanup for each user
        for (const record of cloudRecords) {
          await deleteCSVRecommendations(record.userId);
        }
        
        // Verify: All Cloud records still exist
        const afterCount = await CloudResource.countDocuments({ mode: 'cloud' });
        expect(afterCount).toBe(beforeCount);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test 4: Report Persistence Completeness**
```javascript
// Feature: session-and-data-lifecycle, Property 4: All recommendation data is persisted
test('Property 4: Saved reports contain all original recommendation data', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.record({
        userId: fc.uuid(),
        name: fc.string({ minLength: 1 }),
        recommendations: fc.array(fc.record({
          id: fc.string(),
          name: fc.string(),
          finding: fc.constantFrom('Oversized', 'Undersized', 'Optimal'),
          savings: fc.float({ min: 0, max: 10000 })
        }), { minLength: 1, maxLength: 50 })
      }),
      async (reportData) => {
        // Execute: Save report
        const report = await saveReport(reportData);
        
        // Verify: All recommendations present
        expect(report.recommendations).toHaveLength(reportData.recommendations.length);
        
        // Verify: Each recommendation preserved
        for (let i = 0; i < reportData.recommendations.length; i++) {
          expect(report.recommendations[i].id).toBe(reportData.recommendations[i].id);
          expect(report.recommendations[i].name).toBe(reportData.recommendations[i].name);
          expect(report.recommendations[i].finding).toBe(reportData.recommendations[i].finding);
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test 5: Report Timestamp Presence**
```javascript
// Feature: session-and-data-lifecycle, Property 5: Reports have valid timestamps
test('Property 5: All saved reports include creation timestamp', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.record({
        userId: fc.uuid(),
        name: fc.string({ minLength: 1 }),
        recommendations: fc.array(fc.anything(), { minLength: 1 })
      }),
      async (reportData) => {
        const beforeSave = new Date();
        
        // Execute: Save report
        const report = await saveReport(reportData);
        
        const afterSave = new Date();
        
        // Verify: Timestamp exists and is valid
        expect(report.generatedAt).toBeDefined();
        expect(report.generatedAt).toBeInstanceOf(Date);
        expect(report.generatedAt.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
        expect(report.generatedAt.getTime()).toBeLessThanOrEqual(afterSave.getTime());
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test 6: Report User Association**
```javascript
// Feature: session-and-data-lifecycle, Property 6: Reports are associated with correct user
test('Property 6: All saved reports are associated with the creating user', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.record({
        userId: fc.uuid(),
        name: fc.string({ minLength: 1 }),
        recommendations: fc.array(fc.anything(), { minLength: 1 })
      }),
      async (reportData) => {
        // Execute: Save report
        const report = await saveReport(reportData);
        
        // Verify: userId matches
        expect(report.userId.toString()).toBe(reportData.userId);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test 7: Cleanup Idempotency**
```javascript
// Feature: session-and-data-lifecycle, Property 7: Multiple cleanup calls are idempotent
test('Property 7: Repeated cleanup calls produce same result', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.record({
        userId: fc.uuid(),
        csvRecords: fc.array(fc.anything(), { minLength: 1, maxLength: 10 })
      }),
      async (testData) => {
        // Setup: Insert CSV records
        await CSVUpload.insertMany(
          testData.csvRecords.map(r => ({ ...r, userId: testData.userId, mode: 'csv' }))
        );
        
        // Execute: Multiple cleanup calls
        const result1 = await deleteCSVRecommendations(testData.userId);
        const result2 = await deleteCSVRecommendations(testData.userId);
        const result3 = await deleteCSVRecommendations(testData.userId);
        
        // Verify: First call deletes, subsequent calls find nothing
        expect(result1.deletedCount).toBe(testData.csvRecords.length);
        expect(result2.deletedCount).toBe(0);
        expect(result3.deletedCount).toBe(0);
        
        // Verify: No records remain
        const remaining = await CSVUpload.find({ userId: testData.userId, mode: 'csv' });
        expect(remaining).toHaveLength(0);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test 8: Page Visit Recording**
```javascript
// Feature: session-and-data-lifecycle, Property 8: Page visits are recorded
test('Property 8: Visiting recommendations page sets visit flag', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 10 }), // Number of visits
      (visitCount) => {
        // Clear before test
        sessionStorage.clear();
        
        // Execute: Simulate multiple visits
        for (let i = 0; i < visitCount; i++) {
          markPageVisited();
        }
        
        // Verify: Flag is set
        expect(sessionStorage.getItem('visitedRecommendations')).toBe('true');
        expect(hasVisitedRecommendations()).toBe(true);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test 9: Visit Status Availability**
```javascript
// Feature: session-and-data-lifecycle, Property 9: Visit status is available on close
test('Property 9: Close handler can always read visit status', () => {
  fc.assert(
    fc.property(
      fc.boolean(), // Whether page was visited
      (visited) => {
        // Setup: Set or clear visit flag
        if (visited) {
          sessionStorage.setItem('visitedRecommendations', 'true');
        } else {
          sessionStorage.removeItem('visitedRecommendations');
        }
        
        // Execute: Check status
        const status = hasVisitedRecommendations();
        
        // Verify: Status matches setup
        expect(status).toBe(visited);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test 10: Token Expiration Limit**
```javascript
// Feature: session-and-data-lifecycle, Property 10: Tokens expire within 24 hours
test('Property 10: All JWT tokens expire within 24 hours', () => {
  fc.assert(
    fc.property(
      fc.record({
        userId: fc.uuid(),
        email: fc.emailAddress()
      }),
      (userData) => {
        // Execute: Generate token
        const token = generateAuthToken(userData);
        const decoded = jwt.decode(token);
        
        // Verify: Expiration is set
        expect(decoded.exp).toBeDefined();
        
        // Verify: Expiration is within 24 hours
        const now = Math.floor(Date.now() / 1000);
        const maxExpiration = now + (24 * 60 * 60); // 24 hours in seconds
        
        expect(decoded.exp).toBeLessThanOrEqual(maxExpiration);
        expect(decoded.exp).toBeGreaterThan(now); // Not already expired
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test 11: Orphaned Data Cleanup**
```javascript
// Feature: session-and-data-lifecycle, Property 11: Old data is removed by background job
test('Property 11: Records older than 24 hours are deleted', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.array(fc.record({
        userId: fc.uuid(),
        hoursOld: fc.integer({ min: 0, max: 72 }) // 0-72 hours old
      }), { minLength: 5, maxLength: 20 }),
      async (records) => {
        // Setup: Insert records with various ages
        const now = new Date();
        await CSVUpload.insertMany(
          records.map(r => ({
            userId: r.userId,
            mode: 'csv',
            status: 'processed',
            uploadDate: new Date(now.getTime() - r.hoursOld * 60 * 60 * 1000),
            filename: 'test.csv',
            originalName: 'test.csv',
            path: '/tmp/test.csv',
            size: 1000
          }))
        );
        
        // Execute: Run cleanup job
        await cleanupOrphanedData();
        
        // Verify: Only records < 24 hours remain
        for (const record of records) {
          const remaining = await CSVUpload.find({ userId: record.userId });
          
          if (record.hoursOld >= 24) {
            expect(remaining).toHaveLength(0); // Should be deleted
          } else {
            expect(remaining.length).toBeGreaterThan(0); // Should be preserved
          }
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test 12: Mode Identification**
```javascript
// Feature: session-and-data-lifecycle, Property 12: Recommendation mode is identifiable
test('Property 12: All recommendations have identifiable mode', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.array(fc.record({
        userId: fc.uuid(),
        mode: fc.constantFrom('csv', 'cloud'),
        data: fc.anything()
      }), { minLength: 1, maxLength: 20 }),
      async (records) => {
        // Setup: Insert mixed mode records
        await CSVUpload.insertMany(records);
        
        // Execute: Query all records
        const allRecords = await CSVUpload.find({});
        
        // Verify: Each record has identifiable mode
        for (const record of allRecords) {
          expect(['csv', 'cloud']).toContain(record.mode);
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test 13: Mode Storage**
```javascript
// Feature: session-and-data-lifecycle, Property 13: Mode is stored with recommendations
test('Property 13: Created recommendations include mode field', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.record({
        userId: fc.uuid(),
        mode: fc.constantFrom('csv', 'cloud'),
        filename: fc.string({ minLength: 1 })
      }),
      async (recordData) => {
        // Execute: Create record
        const record = await CSVUpload.create({
          ...recordData,
          originalName: recordData.filename,
          path: `/tmp/${recordData.filename}`,
          size: 1000
        });
        
        // Verify: Mode field exists and matches
        expect(record.mode).toBeDefined();
        expect(record.mode).toBe(recordData.mode);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test 14: Mode Data Isolation**
```javascript
// Feature: session-and-data-lifecycle, Property 14: Mode data is isolated
test('Property 14: Operations on one mode do not affect the other', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.record({
        userId: fc.uuid(),
        csvCount: fc.integer({ min: 1, max: 10 }),
        cloudCount: fc.integer({ min: 1, max: 10 })
      }),
      async (testData) => {
        // Setup: Insert both CSV and Cloud records
        const csvRecords = Array(testData.csvCount).fill(null).map((_, i) => ({
          userId: testData.userId,
          mode: 'csv',
          filename: `csv-${i}.csv`,
          originalName: `csv-${i}.csv`,
          path: `/tmp/csv-${i}.csv`,
          size: 1000
        }));
        
        const cloudRecords = Array(testData.cloudCount).fill(null).map((_, i) => ({
          userId: testData.userId,
          resourceId: `cloud-${i}`,
          provider: 'AWS',
          service: 'EC2'
        }));
        
        await CSVUpload.insertMany(csvRecords);
        await CloudResource.insertMany(cloudRecords);
        
        // Execute: Delete CSV data
        await deleteCSVRecommendations(testData.userId);
        
        // Verify: CSV deleted, Cloud preserved
        const remainingCSV = await CSVUpload.find({ userId: testData.userId, mode: 'csv' });
        const remainingCloud = await CloudResource.find({ userId: testData.userId });
        
        expect(remainingCSV).toHaveLength(0);
        expect(remainingCloud).toHaveLength(testData.cloudCount);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

Integration tests verify end-to-end flows:

1. **Full Close Flow with Save**:
   - User uploads CSV → views recommendations → closes tab → saves report → data cleaned up

2. **Full Close Flow without Save**:
   - User uploads CSV → views recommendations → closes tab → declines save → data cleaned up

3. **Refresh Flow**:
   - User uploads CSV → views recommendations → refreshes page → data persists

4. **Force-Close Recovery**:
   - User uploads CSV → browser crashes → background job cleans up after 24 hours

### Test Coverage Goals

- Unit tests: 80% code coverage
- Property tests: 100% of identified properties
- Integration tests: All critical user flows
- Error scenarios: All error handling paths

