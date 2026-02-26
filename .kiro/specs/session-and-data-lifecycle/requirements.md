# Requirements Document

## Introduction

This document specifies requirements for implementing session management and data lifecycle features in a cloud cost optimization application. The system manages user sessions, CSV-based recommendation data, and report persistence with automatic cleanup on application close.

## Glossary

- **Session_Manager**: The component responsible for managing user authentication state and session lifecycle
- **Data_Cleanup_Service**: The backend service that removes CSV recommendations from the database
- **Report_Saver**: The component that persists recommendation data to the Reports collection
- **Close_Event_Handler**: The frontend component that detects and responds to browser window/tab close events
- **CSV_Recommendations**: Temporary recommendation data generated from CSV file uploads, stored in MongoDB
- **Reports_Collection**: Persistent MongoDB collection storing saved recommendation reports
- **Auth_Token**: JWT token stored in localStorage for user authentication
- **Recommendations_Page**: The frontend page where CSV recommendations are displayed to users
- **Page_Visit_Tracker**: Component that tracks whether user has viewed the Recommendations page

## Requirements

### Requirement 1: Automatic Session Termination on Application Close

**User Story:** As a security-conscious user, I want my session to automatically end when I close the browser tab, so that my authentication credentials are cleared and unauthorized access is prevented.

#### Acceptance Criteria

1. WHEN the browser tab is closed, THE Session_Manager SHALL clear all authentication tokens from localStorage
2. WHEN the browser tab is closed, THE Session_Manager SHALL clear the userId from localStorage
3. WHEN the browser window is closed, THE Session_Manager SHALL clear all authentication tokens from localStorage
4. WHEN a page refresh occurs, THE Session_Manager SHALL preserve authentication tokens in localStorage
5. THE Close_Event_Handler SHALL distinguish between page refresh events and actual window close events

### Requirement 2: Automatic CSV Recommendation Cleanup

**User Story:** As a user, I want my temporary CSV recommendations to be automatically deleted when I close the application, so that my workspace remains clean and no stale data persists.

#### Acceptance Criteria

1. WHEN the browser tab is closed, THE Data_Cleanup_Service SHALL delete all CSV_Recommendations associated with the authenticated user
2. WHEN the browser window is closed, THE Data_Cleanup_Service SHALL delete all CSV_Recommendations associated with the authenticated user
3. WHERE the user is in Cloud mode, THE Data_Cleanup_Service SHALL NOT delete any recommendations
4. WHEN a page refresh occurs, THE Data_Cleanup_Service SHALL NOT delete any CSV_Recommendations
5. WHEN CSV_Recommendations are deleted, THE Data_Cleanup_Service SHALL complete the operation within 2 seconds

### Requirement 3: Save Report Prompt on Close

**User Story:** As a user, I want to be prompted to save my recommendations before closing the application, so that I can preserve important analysis results.

#### Acceptance Criteria

1. WHEN the browser tab is closed AND the user has visited the Recommendations_Page, THE Close_Event_Handler SHALL display a save report prompt
2. WHEN the browser tab is closed AND the user has NOT visited the Recommendations_Page, THE Close_Event_Handler SHALL NOT display a save report prompt
3. WHEN the user selects "Yes" in the save report prompt, THE Report_Saver SHALL save the recommendations to the Reports_Collection
4. WHEN the user selects "No" in the save report prompt, THE Data_Cleanup_Service SHALL delete the CSV_Recommendations
5. WHEN the user closes the prompt without responding, THE Data_Cleanup_Service SHALL delete the CSV_Recommendations
6. WHEN the save report prompt is displayed, THE Close_Event_Handler SHALL prevent immediate window close until user responds or timeout occurs

### Requirement 4: Report Persistence

**User Story:** As a user, I want my saved reports to be stored permanently, so that I can access them later for analysis and comparison.

#### Acceptance Criteria

1. WHEN the user chooses to save a report, THE Report_Saver SHALL persist all recommendation data to the Reports_Collection
2. WHEN a report is saved, THE Report_Saver SHALL include a timestamp of when the report was created
3. WHEN a report is saved, THE Report_Saver SHALL associate the report with the authenticated userId
4. WHEN a report is saved successfully, THE Report_Saver SHALL complete within 3 seconds
5. IF report saving fails, THEN THE Report_Saver SHALL log the error and retain the CSV_Recommendations

### Requirement 5: Cleanup Execution Order

**User Story:** As a user, I want the system to handle my data correctly during shutdown, so that my choices about saving reports are respected before any data is deleted.

#### Acceptance Criteria

1. WHEN the user chooses to save a report, THE Session_Manager SHALL execute report saving before deleting CSV_Recommendations
2. WHEN the user chooses to save a report, THE Session_Manager SHALL execute report saving before clearing authentication tokens
3. WHEN the user chooses not to save a report, THE Session_Manager SHALL delete CSV_Recommendations before clearing authentication tokens
4. WHEN cleanup operations are in progress, THE Close_Event_Handler SHALL prevent duplicate cleanup requests
5. IF any cleanup operation fails, THEN THE Session_Manager SHALL log the error and continue with remaining cleanup operations

### Requirement 6: Page Visit Tracking

**User Story:** As a user, I want the system to know whether I've viewed my recommendations, so that I'm only prompted to save reports when relevant.

#### Acceptance Criteria

1. WHEN the user navigates to the Recommendations_Page, THE Page_Visit_Tracker SHALL record that the page has been visited
2. WHEN the user closes the application, THE Page_Visit_Tracker SHALL provide visit status to the Close_Event_Handler
3. WHEN a new session begins, THE Page_Visit_Tracker SHALL reset the visit status to not visited
4. THE Page_Visit_Tracker SHALL store visit status in sessionStorage
5. WHEN a page refresh occurs, THE Page_Visit_Tracker SHALL preserve the visit status

### Requirement 7: Browser Force-Close Handling

**User Story:** As a security-conscious user, I want my session to be terminated even if I force-close the browser, so that my credentials don't remain accessible.

#### Acceptance Criteria

1. WHEN the browser is force-closed, THE Session_Manager SHALL rely on token expiration for security
2. THE Auth_Token SHALL include an expiration time of no more than 24 hours
3. WHEN the browser is force-closed, THE Data_Cleanup_Service SHALL mark orphaned CSV_Recommendations for cleanup
4. THE Data_Cleanup_Service SHALL run a background job every 6 hours to remove orphaned CSV_Recommendations older than 24 hours
5. WHEN orphaned data cleanup runs, THE Data_Cleanup_Service SHALL log the number of records removed

### Requirement 8: CSV Mode vs Cloud Mode Distinction

**User Story:** As a user working in Cloud mode, I want my cloud-based recommendations to persist, so that only temporary CSV data is cleaned up automatically.

#### Acceptance Criteria

1. THE Session_Manager SHALL identify whether recommendations were generated from CSV mode or Cloud mode
2. WHEN recommendations are from Cloud mode, THE Data_Cleanup_Service SHALL NOT delete them on application close
3. WHEN recommendations are from CSV mode, THE Data_Cleanup_Service SHALL delete them on application close
4. THE Session_Manager SHALL store the recommendation source mode with each recommendation record
5. WHEN the user switches between CSV and Cloud modes, THE Session_Manager SHALL track each mode's data separately

### Requirement 9: Error Handling and Logging

**User Story:** As a system administrator, I want comprehensive error logging during cleanup operations, so that I can diagnose and fix issues with session management.

#### Acceptance Criteria

1. WHEN any cleanup operation fails, THE Session_Manager SHALL log the error with timestamp and userId
2. WHEN the Data_Cleanup_Service fails to delete recommendations, THE Session_Manager SHALL log the error and continue with session termination
3. WHEN the Report_Saver fails to save a report, THE Session_Manager SHALL log the error and notify the user
4. IF the Close_Event_Handler encounters an exception, THEN THE Session_Manager SHALL log the error and attempt graceful degradation
5. THE Session_Manager SHALL log successful completion of all cleanup operations for audit purposes

### Requirement 10: Non-Blocking Cleanup Operations

**User Story:** As a user, I want the application to close quickly when I'm done, so that cleanup operations don't delay my workflow.

#### Acceptance Criteria

1. WHEN cleanup operations are initiated, THE Close_Event_Handler SHALL allow the window to close after 5 seconds regardless of completion status
2. WHEN the save report prompt is displayed, THE Close_Event_Handler SHALL timeout after 30 seconds if no user response is received
3. WHEN cleanup operations are in progress, THE Session_Manager SHALL execute them asynchronously where possible
4. THE Data_Cleanup_Service SHALL send cleanup requests to the backend without waiting for confirmation
5. WHEN the window close is imminent, THE Session_Manager SHALL use the sendBeacon API for reliable cleanup requests
