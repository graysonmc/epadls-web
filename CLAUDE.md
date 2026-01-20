# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EPADLS Scheduler is a Google Apps Script-based scheduling system for service management. It runs entirely within Google Sheets and uses Google's ecosystem for data storage, UI, and ticket generation.

## Development Commands

### Working with Development Environment
```bash
npm run push:dev    # Push local changes to development Google Apps Script
npm run pull:dev    # Pull remote changes from development
npm run open:dev    # Open development script in browser
npm run deploy:dev  # Create new development deployment
```

### Working with Production Environment
```bash
npm run push:prod   # Push to production (use with caution)
npm run pull:prod   # Pull from production
npm run open:prod   # Open production script in browser
npm run deploy:prod # Create new production deployment
```

### Utility Commands
```bash
npm run logs        # View Google Apps Script execution logs
npm run status      # Check file status
npm run backup      # Pull current version and commit to Git
```

## Architecture Overview

### Core System Design
The system is built as a monolithic Google Apps Script (`Code.js`) that manages service scheduling through Google Sheets as the database. Key architectural patterns:

1. **Module Pattern**: Core functionality is organized into object modules:
   - `DateManager` - Centralized date handling and calculations
   - `ServiceOrderValidator` - Business logic for service validation
   - `JobSiteManager` - Job site data management and caching
   - `NotificationManager` - User notifications and UI feedback
   - `TransactionalProcessor` - Batch operations with rollback capability

2. **Sheet-Based Data Model**: Uses Google Sheets as tables:
   - Job Sites - Master list of service locations
   - Recurring Services - Service definitions and frequencies
   - Service Management - Active service tracking and actions
   - Future Schedule - Projected service dates
   - Action History - Audit trail of all changes
   - Calendar View - Visual monthly calendar

3. **UI Integration**: Custom menus and dialogs using Google Apps Script's HTML Service for forms and sidebars.

### Key Technical Considerations

1. **Performance Optimization**: 
   - Batch operations to minimize API calls
   - Caching for frequently accessed data (job sites)
   - Optimized range operations using `getValues()` and `setValues()`

2. **Date Handling**:
   - All dates normalized to midnight EST
   - Weekend avoidance logic built into service scheduling
   - Support for day-of-week constraints

3. **Transaction Safety**:
   - `TransactionalProcessor` provides rollback capability
   - Action history tracking for all changes
   - Validation before any write operations

4. **Google Services Integration**:
   - Sheets API for data operations
   - Drive API for file management
   - Presentations API for ticket generation
   - Script Properties for configuration storage

### Development Workflow

1. Always pull from the appropriate environment before making changes
2. Test changes in development environment first
3. Use `npm run logs` to debug script execution
4. The script requires authorization for Google services on first run
5. Changes to `appsscript.json` require special attention as they affect permissions

### Common Development Tasks

- **Adding new service frequencies**: Update `FREQUENCY_DAYS` object
- **Modifying UI**: Edit HTML templates in dialog/form generation functions
- **Adding new sheets**: Update `SHEETS` configuration and `initializeSheets()`
- **Debugging**: Use `console.log()` and view with `npm run logs`

### Critical Functions

- `onOpen()` - Entry point, creates custom menu
- `generateServiceManagementSheet()` - Core service list generation
- `processServiceManagementActions()` - Handles user actions on services
- `TransactionalProcessor.processServiceActions()` - Batch processing with rollback
- `generateOptimizedCalendarView()` - Calendar visualization engine