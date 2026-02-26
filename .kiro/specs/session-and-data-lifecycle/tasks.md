# Implementation Plan: Session and Data Lifecycle Management

## Overview

This implementation plan breaks down the session and data lifecycle feature into discrete coding tasks. The implementation follows a backend-first approach, then frontend integration, and finally testing. Each task builds incrementally to ensure the system remains functional throughout development.

The feature implements automatic session termination and CSV data cleanup when users close the browser, with distinct handling for CSV mode (temporary) vs Cloud mode (persistent) data. A background cleanup job handles orphaned data from force-closed browsers.

## Tasks

- [x] 1. Update database schema and models
  - [x] 1.1 Add lifecycle fields to CSVUpload model
    - Add `mode` field (enum: 'csv', 'cloud', default: 'csv')
    - Add `lastAccessed` field (Date, default: Date.now)
    - Add `markedForDeletion` field (Boolean, default: false)
    - Add database indexes for efficient cleanup queries: `{ uploadDate: 1, status: 1 }` and `{ userId: 1, mode: 1 }`
    - _Requirements: 8.1, 8.4_

- [x] 2. Implement backend cleanup endpoints
  - [x] 2.1 Create POST /api/csv/cleanup endpoint
    - Add route handler in csvController.js
    - Verify authenticated user matches request userId
    - Delete only CSV mode records: `CSVUpload.deleteMany({ userId, mode: 'csv' })`
    - Return deletion count and success status
    - Log cleanup operations with userId and timestamp
    - _Requirements: 2.1, 2.2, 2.3, 8.2, 8.3_
  
  - [ ]* 2.2 Write property test for cleanup endpoint
    - **Property 2: CSV Mode Data Cleanup on Close**
    - **Property 3: Cloud Mode Data Preservation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 8.2, 8.3**
  
  - [x] 2.3 Create POST /api/csv/save-report endpoint
    - Add route handler in csvController.js
    - Verify authenticated user matches request userId
    - Calculate summary statistics (total recommendations, savings, counts by finding type, avg confidence)
    - Create Report document with userId, name, type, recommendations, summary, and generatedAt timestamp
    - Save to Reports collection
    - Return reportId and success status
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ]* 2.4 Write property tests for save-report endpoint
    - **Property 4: Report Persistence Completeness**
    - **Property 5: Report Timestamp Presence**
    - **Property 6: Report User Association**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 3. Implement background cleanup service
  - [x] 3.1 Create cleanupService.js with scheduled job
    - Install node-cron dependency
    - Create cleanupOrphanedData function to delete CSV records older than 24 hours
    - Query: `CSVUpload.deleteMany({ uploadDate: { $lt: cutoffTime }, status: 'processed' })`
    - Schedule job to run every 6 hours: `'0 */6 * * *'`
    - Log deletion count and timestamp
    - Handle errors gracefully without throwing
    - _Requirements: 7.3, 7.4, 7.5_
  
  - [ ]* 3.2 Write property test for background cleanup
    - **Property 11: Orphaned Data Cleanup**
    - **Validates: Requirements 7.4**
  
  - [x] 3.3 Start cleanup job in server.js
    - Import cleanupService
    - Call startCleanupJob() after server starts
    - Log job initialization
    - _Requirements: 7.4_

- [ ] 4. Checkpoint - Verify backend functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement frontend close event detection
  - [x] 5.1 Add beforeunload handler in App.jsx
    - Attach event listener to window.beforeunload
    - Implement detectEventType function using performance.navigation.type and performance.getEntriesByType
    - Return early if event is a refresh (type === 1 or navigation type === 'reload')
    - Check sessionStorage for 'visitedRecommendations' flag
    - Check localStorage for 'offlineAnalysis' (CSV data presence)
    - If both exist, set event.returnValue to trigger browser's native save prompt
    - If only CSV data exists (no visit), execute silent cleanup
    - _Requirements: 1.4, 1.5, 3.1, 3.2_
  
  - [ ]* 5.2 Write property test for event detection
    - **Property 1: Event Type Detection Accuracy**
    - **Validates: Requirements 1.5**
  
  - [ ]* 5.3 Write unit tests for close event handler
    - Test beforeunload fires on tab close
    - Test refresh detection logic
    - Test prompt display conditions
    - Test silent cleanup when no visit recorded

- [x] 6. Implement page visit tracking
  - [x] 6.1 Add visit tracking to Recommendations.jsx
    - Add useEffect hook that runs on component mount
    - Set sessionStorage item: `sessionStorage.setItem('visitedRecommendations', 'true')`
    - sessionStorage auto-clears on browser/tab close
    - _Requirements: 6.1, 6.2, 6.4_
  
  - [ ]* 6.2 Write property tests for page visit tracking
    - **Property 8: Page Visit Recording**
    - **Property 9: Visit Status Availability on Close**
    - **Validates: Requirements 6.1, 6.2**
  
  - [ ]* 6.3 Write unit tests for visit tracking
    - Test sessionStorage is set on mount
    - Test sessionStorage persists across refresh
    - Test sessionStorage clears on new session

- [ ] 7. Implement session cleanup orchestration
  - [ ] 7.1 Create sessionManager.js utility
    - Create executeCleanup function with options: { saveReport, userId, recommendations }
    - Implement execution order: save report → delete CSV data → clear auth tokens
    - Use navigator.sendBeacon for reliable requests during unload
    - Set 5-second timeout for cleanup operations
    - Handle errors gracefully and continue with remaining operations
    - Clear localStorage items: 'token', 'userId', 'user', 'offlineAnalysis'
    - Log all operations with timestamps
    - _Requirements: 5.1, 5.2, 5.3, 10.1, 10.4, 10.5_
  
  - [ ]* 7.2 Write property test for cleanup idempotency
    - **Property 7: Cleanup Idempotency**
    - **Validates: Requirements 5.4**
  
  - [ ]* 7.3 Write unit tests for cleanup execution
    - Test save report executes before delete CSV
    - Test delete CSV executes before clear auth
    - Test cleanup timeout after 5 seconds
    - Test sendBeacon usage with correct endpoints
    - Test fallback to fetch when sendBeacon fails

- [ ] 8. Integrate cleanup with AuthContext
  - [ ] 8.1 Add cleanup logic to AuthContext.jsx
    - Import sessionManager utility
    - Add cleanup handler that calls executeCleanup
    - Wire cleanup handler to beforeunload event in App.jsx
    - Pass user state and recommendations to cleanup function
    - Handle user's save/don't save choice from browser prompt
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.3, 3.4, 3.5_
  
  - [ ]* 8.2 Write unit tests for AuthContext cleanup integration
    - Test cleanup is called on close event
    - Test auth tokens are cleared
    - Test CSV data is removed from localStorage

- [ ] 9. Implement JWT token expiration
  - [ ] 9.1 Update token generation with 24-hour expiration
    - Modify JWT signing in authentication service
    - Set expiration: `jwt.sign(payload, secret, { expiresIn: '24h' })`
    - Verify token includes exp claim
    - _Requirements: 7.1, 7.2_
  
  - [ ]* 9.2 Write property test for token expiration
    - **Property 10: Token Expiration Limit**
    - **Validates: Requirements 7.2**

- [ ] 10. Implement mode tracking and isolation
  - [ ] 10.1 Add mode field to CSV upload flow
    - Update CSV upload endpoint to set mode: 'csv'
    - Ensure mode is stored with each CSVUpload record
    - _Requirements: 8.4_
  
  - [ ] 10.2 Add mode field to Cloud resource flow
    - Verify Cloud resources are tracked separately (different collection or mode: 'cloud')
    - Ensure cleanup operations filter by mode
    - _Requirements: 8.1, 8.5_
  
  - [ ]* 10.3 Write property tests for mode isolation
    - **Property 12: Mode Identification**
    - **Property 13: Mode Storage with Recommendations**
    - **Property 14: Mode Data Isolation**
    - **Validates: Requirements 8.1, 8.4, 8.5**

- [ ] 11. Checkpoint - Verify end-to-end functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Add error handling and logging
  - [ ] 12.1 Add comprehensive error logging to cleanup operations
    - Log all cleanup operations with timestamp, userId, and operation type
    - Log errors with full context (operation, userId, error message, stack trace)
    - Use consistent log format: `[Cleanup] Operation - details`
    - Add error logging to Report_Saver failures
    - Add error logging to Data_Cleanup_Service failures
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 12.2 Implement graceful degradation for failures
    - Ensure auth tokens are cleared even if cleanup fails
    - Continue with remaining operations if one fails
    - Return partial success status with error details
    - _Requirements: 5.5, 9.4_
  
  - [ ]* 12.3 Write unit tests for error scenarios
    - Test cleanup continues after save report failure
    - Test auth clearing after cleanup failure
    - Test error logging includes required context
    - Test graceful degradation paths

- [ ] 13. Add timeout handling
  - [ ] 13.1 Implement cleanup timeout mechanism
    - Add 5-second timeout for cleanup operations
    - Use Promise.race to enforce timeout
    - Allow window close after timeout regardless of completion
    - Log timeout events
    - _Requirements: 10.1, 10.3_
  
  - [ ] 13.2 Implement prompt timeout
    - Browser's native beforeunload prompt has built-in timeout
    - Default to "don't save" if user doesn't respond within 30 seconds
    - Execute cleanup without save after timeout
    - _Requirements: 3.5, 10.2_
  
  - [ ]* 13.3 Write unit tests for timeout handling
    - Test cleanup timeout after 5 seconds
    - Test prompt timeout behavior
    - Test window closes after timeout

- [ ] 14. Final integration testing
  - [ ]* 14.1 Write integration test for full close flow with save
    - Test: Upload CSV → view recommendations → close tab → save report → data cleaned up
    - Verify report is saved to Reports collection
    - Verify CSV data is deleted
    - Verify auth tokens are cleared
    - _Requirements: 1.1, 2.1, 3.3, 4.1, 5.1_
  
  - [ ]* 14.2 Write integration test for full close flow without save
    - Test: Upload CSV → view recommendations → close tab → decline save → data cleaned up
    - Verify no report is saved
    - Verify CSV data is deleted
    - Verify auth tokens are cleared
    - _Requirements: 1.1, 2.1, 3.4, 5.3_
  
  - [ ]* 14.3 Write integration test for refresh flow
    - Test: Upload CSV → view recommendations → refresh page → data persists
    - Verify CSV data remains in localStorage
    - Verify auth tokens remain in localStorage
    - Verify sessionStorage visit flag persists
    - _Requirements: 1.4, 2.4, 6.5_
  
  - [ ]* 14.4 Write integration test for force-close recovery
    - Test: Upload CSV → browser crashes → background job cleans up after 24 hours
    - Simulate force-close by not triggering beforeunload
    - Advance time by 24+ hours
    - Run background cleanup job
    - Verify orphaned CSV data is removed
    - _Requirements: 7.3, 7.4, 7.5_

- [ ] 15. Final checkpoint - Complete verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Backend changes are implemented first to ensure API availability for frontend
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across many inputs
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end user flows
- The implementation uses sendBeacon API for reliable cleanup during page unload
- Background cleanup job provides safety net for force-closed browsers
- Mode distinction ensures CSV data is temporary while Cloud data persists
proceed