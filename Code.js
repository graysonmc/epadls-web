// ====================================================================
// EPADLS Scheduling System
// Last Updated: July 22, 2025
// Environment: DEVELOPMENT/PRODUCTION
// ====================================================================

// ===== CONFIGURATION =====
const SHEETS = {
  JOB_SITES: 'Job Sites',
  RECURRING_SERVICES: 'Recurring Services',
  SERVICE_MANAGEMENT: 'Service Management',
  FUTURE_SCHEDULE: 'Future Schedule',
  ACTION_HISTORY: 'Action History',
  MANIFEST_LOG: 'Manifest Log',
  CALENDAR_VIEW: 'Calendar View'
};

const FREQUENCY_DAYS = {
  'weekly': 7,
  'Every 2 weeks': 14,
  'Every 4 weeks': 28,
  'Every 8 weeks': 56,
  'Every 3 months': 90,
  'Every 4 months': 120,
  'Every 6 months': 180,
  'Annually': 365
};

const CALENDAR_CONFIG = {
  SHEET_NAME: 'Calendar View',
  START_ROW: 5,
  DAYS_ORDER: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  COLORS: {
    HEADER: '#4a86e8',
    WEEKEND: '#f3f3f3',
    WEEKDAY: '#ffffff',
    TODAY: '#fff2cc',
    OVERDUE: '#f4cccc',
    SERVICE_BOX: '#e8f0fe',
    BORDER: '#cccccc',
    RESCHEDULED: '#e1d5f0'
  }
};

// ====================================================================
// UNIFIED FRAMEWORK COMPONENTS
// ====================================================================

/**
 * Centralized Date Management System
 */
const DateManager = {
  normalize: function(date) {
    if (!date) return null;
    let d;
    if (date instanceof Date && !isNaN(date)) {
      d = new Date(date);
    } else if (typeof date === 'string' || typeof date === 'number') {
      d = new Date(date);
    } else {
      return null;
    }
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  },
  
  today: function() {
    return this.normalize(new Date());
  },
  
  validateEndDate: function(dateStr) {
    const date = this.normalize(dateStr);
    const min = this.today();
    if (!date) return { date: min, message: 'Invalid date format. Using today\'s date.' };
    if (date < min) return { date: min, message: `Date adjusted to today (${min.toLocaleDateString()}). The Service Manager always shows ALL overdue services.` };
    return { date: date, message: null };
  },
  
  calculateServiceDate: function(lastDate, frequency, dayConstraint = '') {
    const baseDate = this.normalize(lastDate);
    const daysToAdd = FREQUENCY_DAYS[frequency];
    if (!baseDate || !daysToAdd) return null;
    
    let nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + daysToAdd);
    
    if (dayConstraint) {
      const targetDay = this.getDayNumber(dayConstraint);
      if (targetDay !== -1) {
        while (nextDate.getDay() !== targetDay) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
      }
    }
    
    const dayOfWeek = nextDate.getDay();
    if (dayOfWeek === 6) nextDate.setDate(nextDate.getDate() - 1);
    else if (dayOfWeek === 0) nextDate.setDate(nextDate.getDate() + 1);
    
    return { date: nextDate };
  },
  
  format: function(date, format = 'MM/dd/yyyy') {
    if (!date) return '';
    return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), format);
  },
  
  getDayNumber: function(dayName) {
    if (!dayName || typeof dayName !== 'string') return -1;
    const days = {'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6};
    return days[dayName.toLowerCase().trim()] || -1;
  }
};

/**
 * Calculate quarter from date
 * @param {Date} date - The date to calculate quarter for
 * @returns {string} Quarter in format "Q1 2025"
 */
function calculateQuarter(date) {
  if (!date) return '';
  const d = new Date(date);
  const month = d.getMonth(); // 0-11
  const year = d.getFullYear();
  const quarter = Math.floor(month / 3) + 1;
  return `Q${quarter} ${year}`;
}

/**
 * Service Order Validation Framework
 */
const ServiceOrderValidator = {
  validateAllActions: function(actions) {
    const validation = { isValid: true, errors: [], warnings: [] };
    const serviceActions = [...(actions.completions || []), ...(actions.cancellations || [])];
    if (serviceActions.length > 0) {
      const orderValidation = this.validateServiceOrder(serviceActions);
      if (!orderValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...orderValidation.errors);
      }
    }
    if (actions.reschedules && actions.reschedules.length > 0) {
      const rescheduleValidation = this.validateReschedules(actions.reschedules);
      if (!rescheduleValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...rescheduleValidation.errors);
      }
      validation.warnings.push(...rescheduleValidation.warnings);
    }
    return validation;
  },

  validateServiceOrder: function(serviceActions) {
    const validation = { isValid: true, errors: [] };
    const futureSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.FUTURE_SCHEDULE);
    if (!futureSheet || futureSheet.getLastRow() < 2) return validation;
    const futureData = futureSheet.getRange(2, 1, futureSheet.getLastRow() - 1, 9).getValues();
    
    const actionsByServiceId = serviceActions.reduce((map, action) => {
        (map[action.serviceId] = map[action.serviceId] || []).push(action);
        return map;
    }, {});
    
    for (const serviceId in actionsByServiceId) {
      const actions = actionsByServiceId[serviceId];
      const pendingInstances = futureData
        .filter(row => row[0] === serviceId)
        .map(row => ({ date: DateManager.normalize(row[6]), serviceId: row[0] }))
        .sort((a, b) => a.date - b.date);
        
      for (const action of actions) {
        const actionDate = DateManager.normalize(action.scheduledDate);
        if(!actionDate) continue;
        const olderPending = pendingInstances.filter(instance => 
          instance.date.getTime() < actionDate.getTime() &&
          !actions.some(a => DateManager.normalize(a.scheduledDate).getTime() === instance.date.getTime())
        );
        if (olderPending.length > 0) {
          validation.isValid = false;
          validation.errors.push({
            serviceId: serviceId,
            message: `Has an older instance for ${DateManager.format(olderPending[0].date)} that must be addressed first.`,
            type: 'ORDER_VIOLATION'
          });
          break; 
        }
      }
    }
    return validation;
  },
  
  validateReschedules: function(reschedules) {
    const validation = { isValid: true, errors: [], warnings: [] };
    const futureSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.FUTURE_SCHEDULE);
    if (!futureSheet || futureSheet.getLastRow() < 2) return validation;
    const futureData = futureSheet.getRange(2, 1, futureSheet.getLastRow() - 1, 9).getValues();
    
    reschedules.forEach(reschedule => {
      const pendingInstances = futureData.filter(row => row[0] === reschedule.serviceId).map(row => ({ date: DateManager.normalize(row[6]) }));
      const originalDate = DateManager.normalize(reschedule.originalDate);
      const olderInstances = pendingInstances.filter(instance => instance.date.getTime() < originalDate.getTime());
      
      if (olderInstances.length > 0) {
        validation.isValid = false;
        validation.errors.push({
          serviceId: reschedule.serviceId,
          message: `from ${DateManager.format(originalDate)} has ${olderInstances.length} older instance(s).`,
          olderDates: olderInstances.map(i => DateManager.format(i.date)),
          type: 'RESCHEDULE_ORDER_VIOLATION',
          originalDate: originalDate
        });
      }
      
      const newDate = DateManager.normalize(reschedule.newDate);
      if (pendingInstances.some(instance => instance.date.getTime() === newDate.getTime())) {
        validation.warnings.push({ serviceId: reschedule.serviceId, message: `Rescheduling to ${DateManager.format(newDate)} creates a duplicate.`});
      }
    });
    return validation;
  }
};

/**
 * Job Site Reference System
 */
const JobSiteManager = {
  getAllSites: function() {
    const scriptCache = CacheService.getScriptCache();
    const cachedSites = scriptCache.get('jobSitesByID');
    if (cachedSites) return JSON.parse(cachedSites);
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.JOB_SITES);
    if (!sheet || sheet.getLastRow() < 2) return {};
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
    const jobSites = data.reduce((map, row) => {
        if (row[0]) map[row[0]] = { 
          id: row[0], 
          name: row[1] || '', 
          address: row[2] || '', 
          streetNumber: row[3] || '',
          streetAddress: row[4] || '',
          city: row[5] || '',
          zipCode: row[6] || '',
          county: row[7] || '',
          latitude: row[8] || '',
          longitude: row[9] || ''
        };
        return map;
    }, {});
    
    scriptCache.put('jobSitesByID', JSON.stringify(jobSites), 600);
    return jobSites;
  },

  clearCache: function() {
    CacheService.getScriptCache().remove('jobSitesByID');
  },
  
  migrateToIdBased: function() {
    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const servicesSheet = ss.getSheetByName(SHEETS.RECURRING_SERVICES);
    const jobSitesSheet = ss.getSheetByName(SHEETS.JOB_SITES);

    if (!servicesSheet || !jobSitesSheet) {
      return ui.alert('Error: Required sheets not found.');
    }

    // --- START OF DIAGNOSTIC FIX ---

    // 1. Get all valid site names from the 'Job Sites' sheet (the source of truth).
    const allSitesObject = this.getAllSites();
    const validSiteNames = new Set(Object.values(allSitesObject).map(site => site.name.trim().toLowerCase()));
    const nameToIdMap = Object.values(allSitesObject).reduce((map, site) => {
        map[site.name.trim().toLowerCase()] = site.id;
        return map;
    }, {});

    // 2. Get all service data and find any names in 'Recurring Services' that don't have a match.
    let headers = servicesSheet.getRange(1, 1, 1, servicesSheet.getLastColumn()).getValues()[0];
    const jobSiteNameColIndex = headers.indexOf('Job Site Name');
    
    if (jobSiteNameColIndex === -1) {
        return ui.alert('Error: A column header named "Job Site Name" could not be found in the "Recurring Services" sheet. Please check your headers.');
    }

    if (servicesSheet.getLastRow() < 2) {
        return ui.alert('Migration not needed: No data in "Recurring Services" sheet.');
    }

    const servicesData = servicesSheet.getRange(2, 1, servicesSheet.getLastRow() - 1, headers.length).getValues();
    const uniqueServiceNames = new Set(servicesData.map(row => row[jobSiteNameColIndex]?.toString().trim().toLowerCase()).filter(Boolean));
    const unmatchableNames = [...uniqueServiceNames].filter(name => !validSiteNames.has(name));

    // 3. **REPORTING STEP:** If there are mismatches, stop and report them to the user.
    if (unmatchableNames.length > 0) {
      let message = 'Migration Failed: The following job site names in your "Recurring Services" sheet do not have an exact match in your "Job Sites" sheet.\n\nPlease correct these names in the "Recurring Services" sheet and run the migration again.\n\nUNMATCHED NAMES:\n';
      unmatchableNames.forEach(name => { message += `• "${name}"\n`; });
      // Using preformatted text in HTML for better display
      const htmlOutput = HtmlService.createHtmlOutput(`<pre>${message}</pre>`).setWidth(400).setHeight(300);
      return ui.showModalDialog(htmlOutput, 'Data Mismatch Found');
    }

    // 4. If we get here, all names are valid. Now, create or verify the 'Job Site ID' column.
    let jobSiteIdColIndex = headers.indexOf('Job Site ID');
    if (jobSiteIdColIndex === -1) {
      servicesSheet.insertColumnAfter(jobSiteNameColIndex + 1);
      headers = servicesSheet.getRange(1, 1, 1, servicesSheet.getLastColumn()).getValues()[0]; // Re-fetch headers
      jobSiteIdColIndex = jobSiteNameColIndex + 1;
      servicesSheet.getRange(1, jobSiteIdColIndex + 1).setValue('Job Site ID').setFontWeight('bold');
    }
    
    // 5. Iterate and update IDs.
    let updatesMade = 0;
    servicesData.forEach(row => {
      const jobSiteName = row[jobSiteNameColIndex];
      const jobSiteId = nameToIdMap[jobSiteName?.toString().trim().toLowerCase()];
      if (jobSiteId && !row[jobSiteIdColIndex]) {
        row[jobSiteIdColIndex] = jobSiteId;
        updatesMade++;
      }
    });

    // 6. Write back the updated data and give feedback.
    if (updatesMade > 0) {
      servicesSheet.getRange(2, 1, servicesData.length, headers.length).setValues(servicesData);
    }
    
    this.clearCache();
    ui.alert('Migration Complete', `${updatesMade} service records were updated with Job Site IDs.`, ui.ButtonSet.OK);
    // --- END OF DIAGNOSTIC FIX ---
  }
};

/**
 * Notification and Audit System
 */
const NotificationManager = {
  adjustments: [],
  reset: function() { this.adjustments = []; },
  log: function(type, details) { this.adjustments.push({ type, ...details }); },
  
  showValidationErrors: function(validation) {
    const ui = SpreadsheetApp.getUi();
    if (validation.errors.length === 0) return;
    
    let message = 'The following issues prevent processing:\n\n';
    validation.errors.forEach(error => { message += `❌ ${error.serviceId}: ${error.message}\n`; });
    
    if (validation.errors.some(e => e.type === 'RESCHEDULE_ORDER_VIOLATION')) {
      message += '\n\n⚠️ Please address the older scheduled services first.';
    }
    
    ui.alert('Action Order Issue', message, ui.ButtonSet.OK);
  },

  showSmartRescheduleDialog: function(violations) {
    const html = HtmlService.createTemplate(getSmartRescheduleDialogHtml()).evaluate().setWidth(500).setHeight(480);
    html.violations = JSON.stringify(violations);
    SpreadsheetApp.getUi().showModalDialog(html, 'Smart Reschedule Options');
  },
  
  showProcessingSummary: function() {
    const ui = SpreadsheetApp.getUi();
    let message = 'Processing Complete!\n\n';
    const counts = this.adjustments.reduce((acc, adj) => {
        acc[adj.type] = (acc[adj.type] || 0) + 1;
        return acc;
    }, {});
    
    if (counts.COMPLETION) message += `✓ ${counts.COMPLETION} services completed\n`;
    if (counts.RESCHEDULE) message += `↻ ${counts.RESCHEDULE} services rescheduled\n`;
    if (counts.CANCELLATION) message += `✗ ${counts.CANCELLATION} services cancelled\n`;
    message += '\nAll views have been refreshed.';
    ui.alert('Processing Summary', message, ui.ButtonSet.OK);
  }
};

/**
 * Transactional Processing System
 */
const TransactionalProcessor = {
  snapshot: null,

  process: function(operationType, data) {
    const ui = SpreadsheetApp.getUi();
    NotificationManager.reset();
    
    const lock = LockService.getScriptLock();
    try {
      if (!lock.tryLock(15000)) {
        ui.alert('Operation Failed', 'Another process is running. Please try again.', ui.ButtonSet.OK);
        return { success: false };
      }

      const validation = ServiceOrderValidator.validateAllActions(data);
      if (!validation.isValid) {
        NotificationManager.showValidationErrors(validation);
        return { success: false };
      }

      this.createSnapshot();
      this.executeOperation(operationType, data);
      this.regenerateAllData();
      JobSiteManager.clearCache();
      return { success: true };
    } catch (error) {
      console.error(`Error during ${operationType}:`, error.stack);
      this.rollback();
      ui.alert('Critical Error', `An error occurred: ${error.toString()}. System restored.`, ui.ButtonSet.OK);
      return { success: false };
    } finally {
      lock.releaseLock();
    }
  },
  
  createSnapshot: function() {
    this.snapshot = ['RECURRING_SERVICES', 'FUTURE_SCHEDULE', 'ACTION_HISTORY'].reduce((snap, name) => {
        snap[name] = this.getSheetData(SHEETS[name]);
        return snap;
    }, {});
  },

  getSheetData: function(sheetName) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    return (sheet && sheet.getLastRow() > 0) ? sheet.getDataRange().getValues() : [];
  },

  rollback: function() {
    if (!this.snapshot) return;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.entries(this.snapshot).forEach(([name, data]) => {
      const sheet = ss.getSheetByName(SHEETS[name]);
      if (sheet) {
        sheet.clear();
        if (data.length > 0) sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      }
    });
    SpreadsheetApp.flush();
  },

  executeOperation: function(operationType, data) {
    if (operationType === 'serviceManager') {
      if (data.cancellations && data.cancellations.length > 0) this.processCancellations(data.cancellations);
      if (data.completions && data.completions.length > 0) this.processCompletions(data.completions);
      if (data.reschedules && data.reschedules.length > 0) this.processReschedules(data.reschedules);
    } else if (operationType === 'daily') this.processDailyUpdate();
    else if (operationType === 'smartReschedule') this.processSmartReschedule(data);
    else if (operationType === 'addService') this.processAddService(data);
    else throw new Error('Unknown operation type');
  },
  
  processCompletions: function(completions) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const servicesSheet = ss.getSheetByName(SHEETS.RECURRING_SERVICES);
    const actionHistorySheet = ss.getSheetByName(SHEETS.ACTION_HISTORY);
    const servicesRange = servicesSheet.getRange(2, 1, servicesSheet.getLastRow() - 1, servicesSheet.getLastColumn());
    const servicesData = servicesRange.getValues();
    const headers = servicesSheet.getRange(1, 1, 1, servicesSheet.getLastColumn()).getValues()[0];
    const serviceIdCol = headers.indexOf('Service ID');
    const jobSiteIdCol = headers.indexOf('Job Site ID');
    const jobSiteNameCol = headers.indexOf('Job Site Name');
    const serviceTypeCol = headers.indexOf('Service Type');
    const lastServiceCol = headers.indexOf('Last Service Date');
    const manifestCountyCol = headers.indexOf('Manifest County');
    const serviceIdToRowIndex = servicesData.reduce((map, row, i) => { map[row[serviceIdCol]] = i; return map; }, {});
    const completionRecords = [];
    const manifestLogRecords = [];
    const lastServiceUpdates = {};
    completions.forEach(comp => {
        const rowIndex = serviceIdToRowIndex[comp.serviceId];
        if (rowIndex === undefined) return;
        completionRecords.push([
            DateManager.today(), comp.serviceId, servicesData[rowIndex][jobSiteIdCol], 
            servicesData[rowIndex][jobSiteNameCol] || '', servicesData[rowIndex][serviceTypeCol], 
            comp.scheduledDate, 'COMPLETED ON:', comp.completionDate, 'Service Manager', comp.notes || ''
        ]);
        const completionTime = DateManager.normalize(comp.completionDate).getTime();
        if (!lastServiceUpdates[comp.serviceId] || completionTime > lastServiceUpdates[comp.serviceId]) {
            lastServiceUpdates[comp.serviceId] = completionTime;
        }
        
        // Check if service has Manifest County value
        if (manifestCountyCol !== -1 && servicesData[rowIndex][manifestCountyCol]) {
            const jobSiteId = servicesData[rowIndex][jobSiteIdCol];
            const jobSites = JobSiteManager.getAllSites();
            const jobSite = jobSites[jobSiteId];
            const address = jobSite ? jobSite.address : '';
            
            manifestLogRecords.push([
                comp.completionDate,
                calculateQuarter(comp.completionDate),
                servicesData[rowIndex][manifestCountyCol],
                servicesData[rowIndex][jobSiteNameCol] || '',
                address,
                servicesData[rowIndex][serviceTypeCol]
            ]);
        }
        
        NotificationManager.log('COMPLETION', { serviceId: comp.serviceId });
    });
    if (completionRecords.length > 0) {
      actionHistorySheet.insertRowsAfter(1, completionRecords.length);
      actionHistorySheet.getRange(2, 1, completionRecords.length, 10)
        .setValues(completionRecords)
        .setFontWeight('normal')
        .setBackground(null);
    }
    
    // Write to Manifest Log if there are records
    if (manifestLogRecords.length > 0) {
      const manifestLogSheet = ss.getSheetByName(SHEETS.MANIFEST_LOG);
      if (manifestLogSheet) {
        const lastRow = manifestLogSheet.getLastRow();
        if (lastRow > 1) {
          manifestLogSheet.insertRowsAfter(lastRow, manifestLogRecords.length);
          manifestLogSheet.getRange(lastRow + 1, 1, manifestLogRecords.length, 6)
            .setValues(manifestLogRecords)
            .setFontWeight('normal')
            .setBackground(null);
        } else {
          // If sheet only has headers, append after row 1
          manifestLogSheet.getRange(2, 1, manifestLogRecords.length, 6)
            .setValues(manifestLogRecords)
            .setFontWeight('normal')
            .setBackground(null);
        }
      }
    }
    
    Object.entries(lastServiceUpdates).forEach(([id, time]) => {
        if(serviceIdToRowIndex[id] !== undefined) servicesData[serviceIdToRowIndex[id]][lastServiceCol] = new Date(time);
    });
    servicesRange.setValues(servicesData);
  },
  
  processCancellations: function(cancellations) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const servicesSheet = ss.getSheetByName(SHEETS.RECURRING_SERVICES);
    const actionHistorySheet = ss.getSheetByName(SHEETS.ACTION_HISTORY);
    const servicesRange = servicesSheet.getRange(2, 1, servicesSheet.getLastRow() - 1, servicesSheet.getLastColumn());
    const servicesData = servicesRange.getValues();
    const headers = servicesSheet.getRange(1, 1, 1, servicesSheet.getLastColumn()).getValues()[0];
    const serviceIdCol = headers.indexOf('Service ID');
    const jobSiteIdCol = headers.indexOf('Job Site ID');
    const jobSiteNameCol = headers.indexOf('Job Site Name');
    const serviceTypeCol = headers.indexOf('Service Type');
    const lastServiceCol = headers.indexOf('Last Service Date');
    const serviceIdToRowIndex = servicesData.reduce((map, row, i) => { map[row[serviceIdCol]] = i; return map; }, {});
    const cancellationRecords = [];
    const lastServiceUpdates = {};
    cancellations.forEach(cancel => {
        const rowIndex = serviceIdToRowIndex[cancel.serviceId];
        if (rowIndex === undefined) return;
        cancellationRecords.push([
            DateManager.today(), cancel.serviceId, servicesData[rowIndex][jobSiteIdCol], 
            servicesData[rowIndex][jobSiteNameCol] || '', servicesData[rowIndex][serviceTypeCol], 
            cancel.scheduledDate, 'CANCELLED', 'CANCELLED', 'Service Manager', cancel.notes || 'Service cancelled'
        ]);
        const cancelTime = DateManager.normalize(cancel.scheduledDate).getTime();
        if (!lastServiceUpdates[cancel.serviceId] || cancelTime > lastServiceUpdates[cancel.serviceId]) {
            lastServiceUpdates[cancel.serviceId] = cancelTime;
        }
        NotificationManager.log('CANCELLATION', { serviceId: cancel.serviceId });
    });
    if (cancellationRecords.length > 0) {
      actionHistorySheet.insertRowsAfter(1, cancellationRecords.length);
      actionHistorySheet.getRange(2, 1, cancellationRecords.length, 10)
        .setValues(cancellationRecords)
        .setFontWeight('normal')
        .setBackground(null);
    }
    Object.entries(lastServiceUpdates).forEach(([id, time]) => {
        if(serviceIdToRowIndex[id] !== undefined) servicesData[serviceIdToRowIndex[id]][lastServiceCol] = new Date(time);
    });
    servicesRange.setValues(servicesData);
  },

  processReschedules: function(reschedules) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const servicesSheet = ss.getSheetByName(SHEETS.RECURRING_SERVICES);
    const servicesRange = servicesSheet.getRange(2, 1, servicesSheet.getLastRow() - 1, servicesSheet.getLastColumn());
    const servicesData = servicesRange.getValues();
    const headers = servicesSheet.getRange(1, 1, 1, servicesSheet.getLastColumn()).getValues()[0];
    const serviceIdCol = headers.indexOf('Service ID');
    const frequencyCol = headers.indexOf('Frequency');
    const lastServiceCol = headers.indexOf('Last Service Date');
    reschedules.forEach(resch => {
        for(let i = 0; i < servicesData.length; i++) {
            if(servicesData[i][serviceIdCol] === resch.serviceId) {
                const daysToSubtract = FREQUENCY_DAYS[servicesData[i][frequencyCol]] || 0;
                const newLastDate = new Date(resch.newDate);
                newLastDate.setDate(newLastDate.getDate() - daysToSubtract);
                servicesData[i][lastServiceCol] = newLastDate;
                NotificationManager.log('RESCHEDULE', { serviceId: resch.serviceId });
                break;
            }
        }
    });
    servicesRange.setValues(servicesData);
    
    // Record reschedule actions to Action History
    const actionHistorySheet = ss.getSheetByName(SHEETS.ACTION_HISTORY);
    const jobSiteIdCol = headers.indexOf('Job Site ID');
    const jobSiteNameCol = headers.indexOf('Job Site Name');
    const serviceTypeCol = headers.indexOf('Service Type');
    const rescheduleRecords = [];
    
    reschedules.forEach(resch => {
        for(let i = 0; i < servicesData.length; i++) {
            if(servicesData[i][serviceIdCol] === resch.serviceId) {
                rescheduleRecords.push([
                    DateManager.today(),
                    resch.serviceId,
                    servicesData[i][jobSiteIdCol],
                    servicesData[i][jobSiteNameCol] || '',
                    servicesData[i][serviceTypeCol],
                    resch.originalDate,
                    'RESCHEDULED TO:',
                    resch.newDate,
                    'Service Manager',
                    'Service rescheduled'
                ]);
                break;
            }
        }
    });
    
    if (rescheduleRecords.length > 0) {
        actionHistorySheet.insertRowsAfter(1, rescheduleRecords.length);
        actionHistorySheet.getRange(2, 1, rescheduleRecords.length, 10)
          .setValues(rescheduleRecords)
          .setFontWeight('normal')
          .setBackground(null);
    }
  },

  processSmartReschedule: function(data) {
    const { option, serviceIds, violations, newDate } = data;
    const params = { violations, newDate: DateManager.normalize(newDate) };
    if (option === 'cascade') this.cascadeReschedule(serviceIds, params);
    else if (option === 'compact') this.compactReschedule(serviceIds, params);
    else if (option === 'reset') this.resetAndReschedule(serviceIds, params);
    else throw new Error('Unknown Smart Reschedule option');
  },

  cascadeReschedule: function(serviceIds, params) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const futureSheet = ss.getSheetByName(SHEETS.FUTURE_SCHEDULE);
    const servicesSheet = ss.getSheetByName(SHEETS.RECURRING_SERVICES);
    const firstViolation = params.violations[0];
    const originalDate = DateManager.normalize(firstViolation.originalDate);
    const daysDiff = Math.round((params.newDate - originalDate) / (1000 * 60 * 60 * 24));
    const futureData = futureSheet.getRange(2, 1, futureSheet.getLastRow() - 1, 9).getValues();
    const servicesRange = servicesSheet.getRange(2, 1, servicesSheet.getLastRow() - 1, servicesSheet.getLastColumn());
    const servicesData = servicesRange.getValues();
    const serviceIdCol = servicesSheet.getRange(1, 1, 1, servicesSheet.getLastColumn()).getValues()[0].indexOf('Service ID');
    const lastServiceCol = servicesSheet.getRange(1, 1, 1, servicesSheet.getLastColumn()).getValues()[0].indexOf('Last Service Date');
    serviceIds.forEach(serviceId => {
        futureData.forEach(row => {
            if (row[0] === serviceId) {
                row[6] = new Date(new Date(row[6]).setDate(new Date(row[6]).getDate() + daysDiff));
            }
        });
        for(let i = 0; i < servicesData.length; i++) {
            if (servicesData[i][serviceIdCol] === serviceId) {
                servicesData[i][lastServiceCol] = new Date(new Date(servicesData[i][lastServiceCol]).setDate(new Date(servicesData[i][lastServiceCol]).getDate() + daysDiff));
                break;
            }
        }
    });
    futureSheet.getRange(2, 1, futureSheet.getMaxRows() - 1, 9).clearContent();
    if(futureData.length > 0) futureSheet.getRange(2, 1, futureData.length, 9).setValues(futureData);
    servicesRange.setValues(servicesData);
  },

  compactReschedule: function(serviceIds, params) {
    const firstViolation = params.violations.find(v => serviceIds.includes(v.serviceId));
    if (!firstViolation) return;
    this.processReschedules([{
      serviceId: firstViolation.serviceId,
      originalDate: firstViolation.originalDate,
      newDate: params.newDate
    }]);
  },

  resetAndReschedule: function(serviceIds, params) {
    const today = DateManager.today();
    const futureSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.FUTURE_SCHEDULE);
    const futureData = futureSheet.getRange(2, 1, futureSheet.getLastRow() - 1, 9).getValues();
    const completionsToProcess = [];
    serviceIds.forEach(serviceId => {
        futureData.forEach(row => {
            if (row[0] === serviceId && DateManager.normalize(row[6]) < today) {
                completionsToProcess.push({ serviceId, scheduledDate: row[6], completionDate: today, notes: 'Auto-completed via reset' });
            }
        });
    });
    if(completionsToProcess.length > 0) this.processCompletions(completionsToProcess);
    const firstInstances = serviceIds.map(id => futureData.find(row => row[0] === id));
    this.processReschedules(firstInstances.map((inst, i) => ({
      serviceId: serviceIds[i],
      originalDate: inst ? inst[6] : params.newDate,
      newDate: params.newDate
    })));
  },
  
  processDailyUpdate: function() {
    this.cleanupFutureSchedule();
    generateAllFutureServicesOptimized();
    updateAllNextServiceDatesOptimized();
    JobSiteManager.clearCache();
  },
  
  processAddService: function(newServiceData) {
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.RECURRING_SERVICES).appendRow(newServiceData);
    JobSiteManager.clearCache();
  },

  regenerateAllData: function() {
    this.cleanupFutureSchedule();
    generateAllFutureServicesOptimized();
    updateAllNextServiceDatesOptimized();
  },

  cleanupFutureSchedule: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const futureSheet = ss.getSheetByName(SHEETS.FUTURE_SCHEDULE);
    const actionHistorySheet = ss.getSheetByName(SHEETS.ACTION_HISTORY);
    if (!futureSheet || futureSheet.getLastRow() < 2) return;
    const completedKeys = new Set();
    if (actionHistorySheet && actionHistorySheet.getLastRow() > 1) {
      const data = actionHistorySheet.getRange(2, 1, actionHistorySheet.getLastRow() - 1, 10).getValues();
      data.forEach(row => {
        const actionType = row[6]; // Action Type is now at index 6 (after adding Job Site Name)
        if (row[1] && row[5] && (actionType === 'COMPLETED ON:' || actionType === 'CANCELLED')) {
          const scheduledDate = DateManager.normalize(row[5]); // Scheduled Date is at index 5
          if (scheduledDate) completedKeys.add(`${row[1]}_${scheduledDate.getTime()}`); // Service ID is at index 1
        }
      });
    }
    const futureData = futureSheet.getRange(2, 1, futureSheet.getLastRow() - 1, 9).getValues();
    const filtered = futureData.filter(row => {
        const d = DateManager.normalize(row[6]);
        return !(row[0] && d && completedKeys.has(`${row[0]}_${d.getTime()}`));
    });
    futureSheet.getRange(2, 1, futureSheet.getMaxRows() - 1, 9).clearContent();
    if (filtered.length > 0) {
      futureSheet.getRange(2, 1, filtered.length, 9).setValues(filtered);
      
      // Apply red highlighting to overdue projected dates
      const today = DateManager.today();
      const projectedDateCol = 7; // Column G is Projected Date (1-indexed)
      const backgrounds = filtered.map(row => {
        const projectedDate = DateManager.normalize(row[6]); // 0-indexed, so column 6 is Projected Date
        const isOverdue = projectedDate && projectedDate < today;
        const rowBackgrounds = Array(9).fill('#ffffff');
        if (isOverdue) {
          rowBackgrounds[projectedDateCol - 1] = '#f4cccc'; // Light red for overdue dates
        }
        return rowBackgrounds;
      });
      futureSheet.getRange(2, 1, filtered.length, 9).setBackgrounds(backgrounds);
    }
  }
};

// ====================================================================
// MENU & INITIALIZATION
// ====================================================================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('EPADLS Scheduler')
    .addItem('📋 Open Service Manager', 'openServiceManager')
    .addItem('📅 Open Calendar View', 'initializeCalendarView')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('📅 Calendar Navigation')
      .addItem('Previous Month', 'calendarPreviousMonth')
      .addItem('Next Month', 'calendarNextMonth'))
    .addSeparator()
    .addItem('Process Scheduling Actions', 'processServiceManagementActions')
    .addItem('Print Selected Tickets', 'printSelectedTickets')
    .addItem('Generate County Manifest Report', 'generateCountyManifestReport')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('⚙️ Setup')
      .addItem('Initialize System', 'initializeSheets')
      .addItem('Configure Ticket Template', 'setupTemplateFromExisting')
      .addItem('Setup Daily Updates', 'configureDailyUpdates'))
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('🔧 Utilities')
      .addItem('Clean & Optimize', 'performFullSystemCleanup')
      .addSeparator()
      .addItem('Refresh Current View', 'refreshActiveView'))
    .addToUi();
}

function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsToCreate = [
    { name: SHEETS.JOB_SITES, headers: [['Job Site ID', 'Job Site Name', 'Address', 'Street Number', 'Street Address', 'City', 'Zip Code', 'County', 'Latitude', 'Longitude']] },
    { name: SHEETS.RECURRING_SERVICES, headers: [['Service ID', 'Job Site ID', 'Job Site Name', 'Service Type', 'Frequency', 'Last Service Date', 'Day Constraint', 'Time Constraint', 'Priority', 'Notes', 'Next Service Date', 'Manifest County']] },
    { name: SHEETS.FUTURE_SCHEDULE, headers: [['Recurring Service ID', 'Job Site ID', 'Job Site Name', 'Address', 'Service Type', 'Frequency', 'Projected Date', 'Notes', 'Is Manual Reschedule']] },
    { name: SHEETS.ACTION_HISTORY, headers: [['Date Recorded', 'Service ID', 'Job Site ID', 'Job Site Name', 'Service Type', 'Scheduled Date', 'Action Type', 'Action Date', 'Performed By', 'Notes']] },
    { name: SHEETS.MANIFEST_LOG, headers: [['Date Completed', 'Quarter', 'County', 'Job Site Name', 'Address', 'Service Type']] },
    { name: SHEETS.SERVICE_MANAGEMENT, headers: [[]] },
    { name: SHEETS.CALENDAR_VIEW, headers: [[]] }
  ];
  sheetsToCreate.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) sheet = ss.insertSheet(s.name);
    if (s.headers[0].length > 0) sheet.getRange(1, 1, 1, s.headers[0].length).setValues(s.headers).setFontWeight('bold').setBackground('#f0f0f0');
  });
  SpreadsheetApp.getUi().alert('System initialized successfully!');
}


// ====================================================================
// SERVICE MANAGEMENT & ACTIONS
// ====================================================================

function openServiceManager() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Service Manager', 'Show services up to what date? (MM/DD/YYYY)', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const validation = DateManager.validateEndDate(response.getResponseText());
  if (validation.message) ui.alert('Date Adjusted', validation.message, ui.ButtonSet.OK);
  generateServiceManagementSheet(validation.date);
}

function generateServiceManagementSheet(endDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SERVICE_MANAGEMENT);
  sheet.clear();
  sheet.getRange('A1').setValue('Service Management').setFontSize(16).setFontWeight('bold');
  sheet.getRange('A2').setValue(`Showing ALL overdue & future services through: ${DateManager.format(endDate)}`);
  const today = DateManager.today();
  const allServices = getServicesInDateRangeOptimized(new Date(2020, 0, 1), endDate);
  const completedServices = getCompletedServicesMap();
  const printedServices = getPrintedServicesMap(); // Get printed services
  const jobSites = JobSiteManager.getAllSites();
  const pendingServices = allServices.filter(s => !completedServices.has(`${s.serviceId}_${DateManager.normalize(s.date).getTime()}`)).map(s => ({
    ...s,
    daysOverdue: s.date < today ? Math.round((today - s.date) / (1000 * 60 * 60 * 24)) : 0
  })).sort((a, b) => a.date - b.date);
  sheet.getRange('A3').setValue(`Status: ${pendingServices.length} pending (${pendingServices.filter(s=>s.daysOverdue>0).length} overdue)`);
  const headers = ['Weekday', 'Scheduled Date', 'Job Site Name', 'Complete?', 'New Date', 'Reschedule?', 'Cancel?', 'Print?', 'Frequency', 'Address', 'Service Type', 'Service ID', 'Days Overdue', 'Notes'];
  sheet.getRange(5, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f0f0f0');
  
  // Set the Weekday column width to fit the header text "Weekday"
  sheet.setColumnWidth(1, 75); // Width in pixels to fit "Weekday" header
  
  if (pendingServices.length === 0) return sheet.getRange('A6').setValue('No pending services found.');
  
  // Get the column index for Print? column
  const printColumnIndex = headers.indexOf('Print?');
  
  const values = pendingServices.map(s => {
    console.log('Job Site ID:', s.jobSiteId, 'Site object:', jobSites[s.jobSiteId], 'Service object:', s);
    const site = jobSites[s.jobSiteId] || { name: s.jobSite || 'N/A', address: s.address || 'N/A' };
    return [
      DateManager.format(s.date, 'E'), // 0: Weekday
      s.date,                          // 1: Scheduled Date
      site.name,                       // 2: Job Site Name
      false,                           // 3: Complete?
      '',                              // 4: New Date
      false,                           // 5: Reschedule?
      false,                           // 6: Cancel?
      false,                           // 7: Print?
      s.frequency,                     // 8: Frequency
      site.address,                    // 9: Address
      s.serviceType,                   // 10: Service Type
      s.serviceId,                     // 11: Service ID
      s.daysOverdue > 0 ? s.daysOverdue : '', // 12: Days Overdue
      s.notes || ''                    // 13: Notes
    ];
  });
  
  const backgrounds = pendingServices.map(s => {
    let rowColors = Array(headers.length).fill('#ffffff');
    
    // Apply overdue highlighting to entire row
    if(s.daysOverdue > 30) {
      rowColors = rowColors.map(() => '#ffb3b3');
    } else if(s.daysOverdue > 14) {
      rowColors = rowColors.map(() => '#ffcccc');
    } else if(s.daysOverdue > 0) {
      rowColors = rowColors.map(() => '#ffe6e6');
    }
    
    // Check if this service has been printed and highlight the Print? column
    const printKey = `${s.serviceId}_${DateManager.normalize(s.date).getTime()}`;
    if (printedServices.has(printKey) && printColumnIndex !== -1) {
      rowColors[printColumnIndex] = '#90EE90'; // Light green for printed services
    }
    
    return rowColors;
  });
  
  sheet.getRange(6, 1, values.length, headers.length).setValues(values).setBackgrounds(backgrounds);
  ['B','E'].forEach(c => sheet.getRange(`${c}6:${c}${5+values.length}`).setNumberFormat('mm/dd/yyyy'));
  ['D','F','G','H'].forEach(c => sheet.getRange(`${c}6:${c}${5+values.length}`).insertCheckboxes());
  headers.forEach((h, i) => {
    if (i !== 0) { // Skip column 1 (Weekday) as we already set its width
      sheet.autoResizeColumn(i + 1);
    }
  });
  sheet.setColumnWidth(1, 75).setColumnWidth(2, 100).setColumnWidth(3, 150).setColumnWidth(5, 100);
  
  // Set width constraint for column K (Service Type) - approximately 2.3x standard width
  const standardWidth = 100; // Standard column width in pixels
  const maxServiceTypeWidth = Math.round(standardWidth * 2.3); // ~230 pixels
  sheet.setColumnWidth(11, maxServiceTypeWidth); // Column K is the 11th column (1-indexed)
  sheet.activate();
}

function processServiceManagementActions() {
  const ui = SpreadsheetApp.getUi();
  ui.showSidebar(HtmlService.createHtmlOutput('<p>Processing actions...</p>').setTitle('Processing'));
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SERVICE_MANAGEMENT);
  if (!sheet || sheet.getLastRow() < 6) { ui.alert("Sheet is empty."); closeSidebar(); return; }
  const headers = sheet.getRange(5, 1, 1, sheet.getLastColumn()).getValues()[0].reduce((m, h, i) => { m[h.trim()] = i; return m; }, {});
  const data = sheet.getRange(6, 1, sheet.getLastRow() - 5, Object.keys(headers).length).getValues();
  const actions = { completions: [], cancellations: [], reschedules: [] };
  const missingDates = [];
  const multipleActions = [];
  const cancelWithDate = [];
  
  data.forEach((row, index) => {
    const serviceId = row[headers['Service ID']];
    if (!serviceId) return;
    const scheduledDate = row[headers['Scheduled Date']];
    const rowNum = index + 6;
    const serviceName = `${row[headers['Job Site Name']]} - ${row[headers['Service Type']]}`;
    
    // Count how many actions are selected for this row
    const actionCount = (row[headers['Complete?']] === true ? 1 : 0) + 
                       (row[headers['Cancel?']] === true ? 1 : 0) + 
                       (row[headers['Reschedule?']] === true ? 1 : 0);
    
    if (actionCount > 1) {
      multipleActions.push(`Row ${rowNum}: ${serviceName}`);
      return;
    }
    
    // Check for cancel with new date
    if (row[headers['Cancel?']] === true && row[headers['New Date']]) {
      cancelWithDate.push(`Row ${rowNum}: ${serviceName}`);
      return;
    }
    
    // Process the actions
    if (row[headers['Complete?']] === true) {
      const completionDate = row[headers['New Date']] ? new Date(row[headers['New Date']]) : scheduledDate;
      actions.completions.push({ serviceId, scheduledDate, completionDate, notes: row[headers['Notes']] });
    }
    else if (row[headers['Cancel?']] === true) actions.cancellations.push({ serviceId, scheduledDate, notes: row[headers['Notes']] });
    else if (row[headers['Reschedule?']] === true) {
      if (row[headers['New Date']]) {
        actions.reschedules.push({ serviceId, originalDate: scheduledDate, newDate: new Date(row[headers['New Date']]) });
      } else {
        missingDates.push(`Row ${rowNum}: ${serviceName}`);
      }
    }
  });
  
  // Check for validation errors
  if (multipleActions.length > 0) {
    ui.alert('Multiple Actions Selected', `You cannot select multiple actions for the same service. Please select only one action per service:\n\n${multipleActions.join('\n')}`, ui.ButtonSet.OK);
    closeSidebar();
    return;
  }
  
  if (cancelWithDate.length > 0) {
    ui.alert('Invalid Action Combination', `You have selected Cancel with a New Date entered. This doesn't make sense - please either:\n- Remove the New Date if you want to cancel\n- Select Reschedule instead of Cancel if you want to move the service date\n\n${cancelWithDate.join('\n')}`, ui.ButtonSet.OK);
    closeSidebar();
    return;
  }
  
  if (missingDates.length > 0) {
    ui.alert('Missing New Dates', `Please enter a New Date for the following services marked for rescheduling:\n\n${missingDates.join('\n')}`, ui.ButtonSet.OK);
    closeSidebar();
    return;
  }
  if (actions.completions.length + actions.cancellations.length + actions.reschedules.length === 0) { ui.alert('No actions selected.'); closeSidebar(); return; }
  const result = TransactionalProcessor.process('serviceManager', actions);
  if (result.success) {
    refreshAllViews();
    NotificationManager.showProcessingSummary();
  }
  closeSidebar();
}

// ====================================================================
// CORE SCHEDULING & DATA FUNCTIONS
// ====================================================================

function generateAllFutureServicesOptimized() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const servicesSheet = ss.getSheetByName(SHEETS.RECURRING_SERVICES);
  const futureSheet = ss.getSheetByName(SHEETS.FUTURE_SCHEDULE);
  if (!servicesSheet || !futureSheet || servicesSheet.getLastRow() < 2) return;
  const servicesData = servicesSheet.getDataRange().getValues();
  const headers = servicesData.shift();
  const cols = headers.reduce((m, h, i) => { m[h] = i; return m; }, {});
  const jobSites = JobSiteManager.getAllSites();
  const projectionEndDate = new Date(DateManager.today().setDate(DateManager.today().getDate() + 45));
  const futureServicesData = [];
  servicesData.forEach(sRow => {
    const lastDate = sRow[cols['Last Service Date']];
    const freq = sRow[cols['Frequency']];
    if (!lastDate || !freq) return;
    let currentDate = DateManager.normalize(lastDate);
    while (currentDate <= projectionEndDate) {
      const result = DateManager.calculateServiceDate(currentDate, freq, sRow[cols['Day Constraint']]);
      if (!result || !result.date || result.date > projectionEndDate) break;
      const site = jobSites[sRow[cols['Job Site ID']]] || {};
      futureServicesData.push([
        sRow[cols['Service ID']], sRow[cols['Job Site ID']], site.name || '', site.address || '',
        sRow[cols['Service Type']], freq, result.date, sRow[cols['Notes']] || '', false
      ]);
      currentDate = result.date;
    }
  });
  futureServicesData.sort((a, b) => a[6] - b[6]);
  futureSheet.getRange(2, 1, futureSheet.getMaxRows() - 1, 9).clearContent();
  if (futureServicesData.length > 0) {
    futureSheet.getRange(2, 1, futureServicesData.length, 9).setValues(futureServicesData);
    
    // Apply red highlighting to overdue projected dates
    const today = DateManager.today();
    const projectedDateCol = 7; // Column G is Projected Date (1-indexed)
    const backgrounds = futureServicesData.map(row => {
      const projectedDate = row[6]; // 0-indexed, so column 6 is Projected Date
      const isOverdue = projectedDate && projectedDate < today;
      const rowBackgrounds = Array(9).fill('#ffffff');
      if (isOverdue) {
        rowBackgrounds[projectedDateCol - 1] = '#f4cccc'; // Light red for overdue dates
      }
      return rowBackgrounds;
    });
    futureSheet.getRange(2, 1, futureServicesData.length, 9).setBackgrounds(backgrounds);
  }
}

function updateAllNextServiceDatesOptimized() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const servicesSheet = ss.getSheetByName(SHEETS.RECURRING_SERVICES);
  const futureSheet = ss.getSheetByName(SHEETS.FUTURE_SCHEDULE);
  if (!servicesSheet || !futureSheet || servicesSheet.getLastRow() < 2) return;
  const headers = servicesSheet.getRange(1, 1, 1, servicesSheet.getLastColumn()).getValues()[0];
  const nextServiceCol = headers.indexOf('Next Service Date');
  if (nextServiceCol === -1) return;
  const servicesData = servicesSheet.getRange(2, 1, servicesSheet.getLastRow() - 1, headers.indexOf('Service ID') + 1).getValues();
  const futureData = futureSheet.getLastRow() > 1 ? futureSheet.getRange(2, 1, futureSheet.getLastRow() - 1, 7).getValues() : [];
  const nextDatesMap = futureData.reduce((map, row) => {
    const date = DateManager.normalize(row[6]);
    if (!map[row[0]] || date < map[row[0]]) map[row[0]] = date;
    return map;
  }, {});
  const today = DateManager.today();
  const updates = servicesData.map(row => {
    const date = nextDatesMap[row[0]];
    return { date: date || 'No scheduled service', color: (date && date < today) ? '#f4cccc' : '#ffffff' };
  });
  const range = servicesSheet.getRange(2, nextServiceCol + 1, updates.length, 1);
  range.setValues(updates.map(u => [u.date])).setBackgrounds(updates.map(u => [u.color])).setNumberFormat('mm/dd/yyyy');
}

function getServicesInDateRangeOptimized(startDate, endDate) {
  const futureSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.FUTURE_SCHEDULE);
  if (!futureSheet || futureSheet.getLastRow() < 2) return [];
  return futureSheet.getRange(2, 1, futureSheet.getLastRow() - 1, 9).getValues()
    .map(r => ({ serviceId: r[0], jobSiteId: r[1], jobSite: r[2], address: r[3], serviceType: r[4], date: DateManager.normalize(r[6]), frequency: r[5], notes: r[7], isManual: r[8] || false }))
    .filter(s => s.date && s.date >= startDate && s.date <= endDate)
    .sort((a, b) => a.date - b.date);
}

function getCompletedServicesMap() {
  const actionHistorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ACTION_HISTORY);
  if (!actionHistorySheet || actionHistorySheet.getLastRow() < 2) return new Map();
  return actionHistorySheet.getRange(2, 1, actionHistorySheet.getLastRow() - 1, 10).getValues().reduce((map, row) => {
    const actionType = row[6]; // Action Type is now at index 6 (after adding Job Site Name)
    if (row[1] && row[5] && (actionType === 'COMPLETED ON:' || actionType === 'CANCELLED')) {
      const scheduledDate = DateManager.normalize(row[5]); // Scheduled Date is at index 5
      if (scheduledDate) map.set(`${row[1]}_${scheduledDate.getTime()}`, true); // Service ID is at index 1
    }
    return map;
  }, new Map());
}

function getPrintedServicesMap() {
  const actionHistorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ACTION_HISTORY);
  if (!actionHistorySheet || actionHistorySheet.getLastRow() < 2) return new Map();
  return actionHistorySheet.getRange(2, 1, actionHistorySheet.getLastRow() - 1, 10).getValues().reduce((map, row) => {
    const actionType = row[6]; // Action Type is at index 6 (after adding Job Site Name)
    if (row[1] && row[5] && actionType === 'PRINTED ON:') {
      const scheduledDate = DateManager.normalize(row[5]); // Scheduled Date is at index 5
      if (scheduledDate) map.set(`${row[1]}_${scheduledDate.getTime()}`, true); // Service ID is at index 1
    }
    return map;
  }, new Map());
}

// ====================================================================
// UI, VIEW & UTILITY FUNCTIONS
// ====================================================================

function refreshAllViews() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const calSheet = ss.getSheetByName(CALENDAR_CONFIG.SHEET_NAME);
  if (calSheet && calSheet.getRange('D3').getValue()) {
    const d = new Date(calSheet.getRange('D3').getValue());
    generateOptimizedCalendarView(d.getFullYear(), d.getMonth());
  }
  const smSheet = ss.getSheetByName(SHEETS.SERVICE_MANAGEMENT);
  if (smSheet && smSheet.getRange('A2').getValue()) {
    const m = smSheet.getRange('A2').getValue().match(/through: ([\d\/]+)/);
    if (m) generateServiceManagementSheet(DateManager.normalize(m[1]));
  }
}

function refreshActiveView() {
    const sheet = SpreadsheetApp.getActiveSheet();
    const name = sheet.getName();
    if (name === SHEETS.CALENDAR_VIEW) {
        const d = new Date(sheet.getRange('D3').getValue());
        generateOptimizedCalendarView(d.getFullYear(), d.getMonth());
    } else if (name === SHEETS.SERVICE_MANAGEMENT) {
        const m = sheet.getRange('A2').getValue().match(/through: ([\d\/]+)/);
        if (m) generateServiceManagementSheet(DateManager.normalize(m[1]));
    } else SpreadsheetApp.getUi().alert('Refresh not available for this sheet.');
}

function closeSidebar() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput('<script>google.script.host.close();</script>'));
}

function dailyScheduleUpdate() {
  console.log(`Starting daily update at ${new Date()}`);
  const result = TransactionalProcessor.process('daily', {});
  if (!result.success) {
    console.error('Daily update failed:', result.error);
    MailApp.sendEmail(Session.getActiveUser().getEmail(), 'EPADLS Daily Update FAILED', `Error: ${result.error}`);
  }
  console.log(`Daily update completed at ${new Date()}`);
}

function performFullSystemCleanup() {
    const ui = SpreadsheetApp.getUi();
    if (ui.alert('Full System Cleanup', 'This will regenerate all schedules. Continue?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    ui.showSidebar(HtmlService.createHtmlOutput('<p>Processing...</p>').setTitle('Cleanup'));
    const result = TransactionalProcessor.process('daily', {});
    if (result.success) refreshAllViews();
    closeSidebar();
}

function configureDailyUpdates() {
    SpreadsheetApp.getUi().alert('Setup Daily Updates', '1. Go to Extensions > Apps Script.\n2. Click the clock icon (Triggers).\n3. Add Trigger:\n  - Function: dailyScheduleUpdate\n  - Event: Time-driven\n  - Type: Day timer (e.g., 2am - 3am)', SpreadsheetApp.getUi().ButtonSet.OK);
}

// ====================================================================
// BACKUP SYSTEM
// ====================================================================

/**
 * Creates a daily backup of the scheduling system data
 * Saves to specified Drive folder and removes backups older than 30 days
 */
function dailyDataBackup() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const today = DateManager.today();
    const backupName = `EPADLS Scheduling System Data Backup - ${DateManager.format(today, 'yyyy-MM-dd')}`;
    
    // Extract folder ID from the URL
    const folderUrl = 'https://drive.google.com/drive/u/7/folders/1CIy4Bp-xZ3t6boRKVPNGhddl90v8gVsW';
    const folderId = '1CIy4Bp-xZ3t6boRKVPNGhddl90v8gVsW';
    const folder = DriveApp.getFolderById(folderId);
    
    // Create new backup spreadsheet
    const backupSpreadsheet = SpreadsheetApp.create(backupName);
    const backupId = backupSpreadsheet.getId();
    
    // Sheets to backup
    const sheetsToBackup = [
      SHEETS.JOB_SITES,
      SHEETS.RECURRING_SERVICES,
      SHEETS.ACTION_HISTORY,
      SHEETS.FUTURE_SCHEDULE,
      SHEETS.MANIFEST_LOG
    ];
    
    // Copy each sheet to backup
    sheetsToBackup.forEach(sheetName => {
      const sourceSheet = ss.getSheetByName(sheetName);
      if (sourceSheet) {
        sourceSheet.copyTo(backupSpreadsheet).setName(sheetName);
      }
    });
    
    // Remove the default "Sheet1" that comes with new spreadsheets
    const defaultSheet = backupSpreadsheet.getSheetByName('Sheet1');
    if (defaultSheet) {
      backupSpreadsheet.deleteSheet(defaultSheet);
    }
    
    // Move backup file to specified folder
    const backupFile = DriveApp.getFileById(backupId);
    folder.addFile(backupFile);
    DriveApp.getRootFolder().removeFile(backupFile);
    
    // Delete backups older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const files = folder.getFiles();
    let deletedCount = 0;
    
    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().startsWith('EPADLS Scheduling System Data Backup') && 
          file.getDateCreated() < thirtyDaysAgo) {
        file.setTrashed(true);
        deletedCount++;
      }
    }
    
    console.log(`Backup completed: ${backupName}`);
    console.log(`Deleted ${deletedCount} old backup(s)`);
    
    return {
      success: true,
      backupName: backupName,
      deletedCount: deletedCount
    };
    
  } catch (error) {
    console.error('Backup failed:', error);
    // Optionally send email notification on failure
    MailApp.sendEmail(
      Session.getActiveUser().getEmail(),
      'EPADLS Daily Backup Failed',
      `Error during backup: ${error.toString()}`
    );
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ====================================================================
// CALENDAR VIEW
// ====================================================================

function initializeCalendarView() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CALENDAR_CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CALENDAR_CONFIG.SHEET_NAME);
  sheet.clear();
  setupCalendarControls(sheet);
  const today = DateManager.today();
  generateOptimizedCalendarView(today.getFullYear(), today.getMonth());
}

function setupCalendarControls(sheet) {
  sheet.getRange('A1').setValue('EPADLS Calendar View').setFontSize(16).setFontWeight('bold');
  sheet.getRange('A3').setValue('Month:').setFontWeight('bold');
  sheet.getRange('D3').setValue(DateManager.format(new Date(), 'MMMM yyyy'));
  sheet.getRange('A1:G4').setBackground('#f8f9fa');
}

/**
 * ENHANCED CALENDAR VIEW: Generates a rich, dynamic calendar grid.
 * - Shows ALL services for each day.
 * - Dynamically sizes rows and weeks based on content.
 * - Includes detailed tooltips on hover.
 */
function generateOptimizedCalendarView(year, month) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CALENDAR_CONFIG.SHEET_NAME);
  if (!sheet) return;

  // Clear existing calendar content, leaving headers
  const startRow = CALENDAR_CONFIG.START_ROW;
  const maxRows = sheet.getMaxRows();
  if (maxRows >= startRow) {
    const clearRange = sheet.getRange(startRow, 1, maxRows - startRow + 1, sheet.getMaxColumns());
    clearRange.clear();
    clearRange.clearNote(); // Clear any ghost notes/tooltips
    clearRange.setBorder(false,false,false,false,false,false);
  }

  // Update month display using DateManager
  const monthDate = new Date(year, month, 1);
  sheet.getRange('D3').setValue(DateManager.format(monthDate, 'MMMM yyyy'));

  // Get all necessary data at once
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const services = getServicesInDateRangeOptimized(firstDay, lastDay);
  const jobSites = JobSiteManager.getAllSites();
  const today = DateManager.today();

  // Organize services by date for quick lookup
  const servicesByDate = services.reduce((map, service) => {
    const dateKey = DateManager.format(service.date, 'yyyy-MM-dd');
    if (!map[dateKey]) map[dateKey] = [];
    map[dateKey].push(service);
    return map;
  }, {});

  // Calendar grid dimensions and layout
  const totalDays = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0=Sun, 1=Mon
  const startColIndex = (startDayOfWeek === 0) ? 6 : startDayOfWeek - 1; // Monday start
  const numWeeks = Math.ceil((totalDays + startColIndex) / 7);
  const COLS_PER_DAY = 3;
  const TOTAL_COLS = 7 * COLS_PER_DAY;
  
  // Prepare arrays for batch updates
  const allData = [];
  const formats = { backgrounds: [], fontWeights: [], fontSizes: [], hAligns: [], vAligns: [], fontColors: [], notes: [], borders: [] };

  // Day of week headers - this should be a single row at the top
  const headerRow = new Array(TOTAL_COLS).fill('');
  const headerBg = new Array(TOTAL_COLS).fill('#ffffff');
  const headerWeight = new Array(TOTAL_COLS).fill('normal');
  const headerSize = new Array(TOTAL_COLS).fill(10);
  const headerAlign = new Array(TOTAL_COLS).fill('left');
  const headerVAlign = new Array(TOTAL_COLS).fill('middle');
  const headerColor = new Array(TOTAL_COLS).fill('#000000');
  const headerNotes = new Array(TOTAL_COLS).fill('');

  // Fill in the day names in the correct columns
  for (let day = 0; day < 7; day++) {
    const colStart = day * COLS_PER_DAY;
    headerRow[colStart] = CALENDAR_CONFIG.DAYS_ORDER[day];
    headerBg[colStart] = CALENDAR_CONFIG.COLORS.HEADER;
    headerWeight[colStart] = 'bold';
    headerSize[colStart] = 12;
    headerAlign[colStart] = 'center';
    headerColor[colStart] = '#ffffff';
  }

  allData.push(headerRow);
  formats.backgrounds.push(headerBg);
  formats.fontWeights.push(headerWeight);
  formats.fontSizes.push(headerSize);
  formats.hAligns.push(headerAlign);
  formats.vAligns.push(headerVAlign);
  formats.fontColors.push(headerColor);
  formats.notes.push(headerNotes);

  // Build the calendar week by week
  let dayCounter = 1;
  for (let week = 0; week < numWeeks; week++) {
    const weekServices = [];
    const weekDays = []; // Track which days are valid in this week
    let maxServicesInWeek = 0;

    // Pre-calculate services for the week to determine row heights
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      if ((week === 0 && dayIndex < startColIndex) || dayCounter > totalDays) {
        weekServices.push([]);
        weekDays.push(null); // null means no day to display
      } else {
        const dateKey = DateManager.format(new Date(year, month, dayCounter), 'yyyy-MM-dd');
        const dayServices = servicesByDate[dateKey] || [];
        weekServices.push(dayServices);
        weekDays.push(dayCounter); // Store the actual day number
        maxServicesInWeek = Math.max(maxServicesInWeek, dayServices.length);
        dayCounter++;
      }
    }
    
    // Add Day Header Row (e.g., "16 Wed (2)")
    const dayHeaderRowData = Array(TOTAL_COLS).fill('');
    const dayHeaderBgs = Array(TOTAL_COLS).fill('#ffffff');
    const dayHeaderWeights = Array(TOTAL_COLS).fill('normal');
    
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayNum = weekDays[dayIndex];
      if (dayNum === null) {
        continue; // Skip empty cells
      }
      
      const colStart = dayIndex * COLS_PER_DAY;
      const currentDate = new Date(year, month, dayNum);
      const dayName = DateManager.format(currentDate, 'E');
      const serviceCount = weekServices[dayIndex].length;
      
      dayHeaderRowData[colStart] = `${dayNum} ${dayName} (${serviceCount})`;
      dayHeaderWeights[colStart] = 'bold';
      
      // Apply background colors for today, weekends
      if (DateManager.normalize(currentDate).getTime() === today.getTime()) {
          dayHeaderBgs[colStart] = CALENDAR_CONFIG.COLORS.TODAY;
      } else if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
          dayHeaderBgs[colStart] = CALENDAR_CONFIG.COLORS.WEEKEND;
      }
    }
    allData.push(dayHeaderRowData);
    formats.backgrounds.push(dayHeaderBgs);
    formats.fontWeights.push(dayHeaderWeights);
    formats.fontSizes.push(Array(TOTAL_COLS).fill(10));
    formats.hAligns.push(Array(TOTAL_COLS).fill(null).map((_,i) => (i % COLS_PER_DAY === 0 ? 'center' : 'left')));
    formats.vAligns.push(Array(TOTAL_COLS).fill('middle'));
    formats.fontColors.push(Array(TOTAL_COLS).fill('#000000'));
    formats.notes.push(Array(TOTAL_COLS).fill(''));

    // Add service rows with spacers
    if (maxServicesInWeek > 0) {
      // Add small spacer after day headers
      const spacerRow = Array(TOTAL_COLS).fill('');
      allData.push(spacerRow);
      formats.backgrounds.push(Array(TOTAL_COLS).fill('#ffffff'));
      formats.fontWeights.push(Array(TOTAL_COLS).fill('normal'));
      formats.fontSizes.push(Array(TOTAL_COLS).fill(1));
      formats.hAligns.push(Array(TOTAL_COLS).fill('left'));
      formats.vAligns.push(Array(TOTAL_COLS).fill('top'));
      formats.fontColors.push(Array(TOTAL_COLS).fill('#000000'));
      formats.notes.push(Array(TOTAL_COLS).fill(''));
      
      // Add rows for all services
      for (let serviceIndex = 0; serviceIndex < maxServicesInWeek; serviceIndex++) {
        const serviceRowData = Array(TOTAL_COLS).fill('');
        const serviceBgs = Array(TOTAL_COLS).fill('#ffffff');
        const serviceNotes = Array(TOTAL_COLS).fill('');
        
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          if (serviceIndex < weekServices[dayIndex].length) {
            const service = weekServices[dayIndex][serviceIndex];
            const site = jobSites[service.jobSiteId] || {name: 'N/A', address: 'N/A'};
            const colStart = dayIndex * COLS_PER_DAY;
            
            // Display three lines: Service ID, Site Name, Service Type
            serviceRowData[colStart] = [
              service.serviceId,
              site.name,
              service.serviceType
            ].join('\n');
            
            // Enhanced tooltip with all information
            serviceNotes[colStart] = [
              `Service ID: ${service.serviceId}`,
              `Job Site Name: ${site.name}`,
              `Address: ${site.address}`,
              `Service Type: ${service.serviceType}`,
              `Frequency: ${service.frequency}`,
              `Notes: ${service.notes || 'None'}`
            ].join('\n');
            
            if(service.isManual) serviceBgs[colStart] = CALENDAR_CONFIG.COLORS.RESCHEDULED;
            else if(service.date < today) serviceBgs[colStart] = CALENDAR_CONFIG.COLORS.OVERDUE;
            else serviceBgs[colStart] = CALENDAR_CONFIG.COLORS.SERVICE_BOX;
            
            formats.borders.push({row: startRow + allData.length, col: colStart + 1});
          }
        }
        allData.push(serviceRowData);
        formats.backgrounds.push(serviceBgs);
        formats.fontWeights.push(Array(TOTAL_COLS).fill('normal'));
        formats.fontSizes.push(Array(TOTAL_COLS).fill(9));
        formats.hAligns.push(Array(TOTAL_COLS).fill(null).map((_,i) => (i % COLS_PER_DAY === 0 ? 'center' : 'left')));
        formats.vAligns.push(Array(TOTAL_COLS).fill('middle'));
        formats.fontColors.push(Array(TOTAL_COLS).fill('#000000'));
        formats.notes.push(serviceNotes);
        
        // Add spacer between services (but not after the last one)
        if (serviceIndex < maxServicesInWeek - 1) {
          const spacerRow = Array(TOTAL_COLS).fill('');
          allData.push(spacerRow);
          formats.backgrounds.push(Array(TOTAL_COLS).fill('#ffffff'));
          formats.fontWeights.push(Array(TOTAL_COLS).fill('normal'));
          formats.fontSizes.push(Array(TOTAL_COLS).fill(1));
          formats.hAligns.push(Array(TOTAL_COLS).fill('left'));
          formats.vAligns.push(Array(TOTAL_COLS).fill('top'));
          formats.fontColors.push(Array(TOTAL_COLS).fill('#000000'));
          formats.notes.push(Array(TOTAL_COLS).fill(''));
        }
      }
    }
    // dayCounter is already incremented in the service calculation loop
  }

  // Apply all data and formats in batch
  if (allData.length > 0) {
    const range = sheet.getRange(startRow, 1, allData.length, TOTAL_COLS);
    range.setValues(allData)
         .setBackgrounds(formats.backgrounds)
         .setFontWeights(formats.fontWeights)
         .setFontSizes(formats.fontSizes)
         .setHorizontalAlignments(formats.hAligns)
         .setVerticalAlignments(formats.vAligns)
         .setFontColors(formats.fontColors)
         .setNotes(formats.notes)
         .setWrap(true);
    
    // Set row heights dynamically
    sheet.setRowHeight(startRow, 35); // Header row height
    
    let currentRow = startRow + 1;
    let rowIndex = 1;
    
    while (rowIndex < allData.length) {
      const rowData = allData[rowIndex];
      
      // Check if this is a day header row (contains date pattern)
      const isDayHeader = rowData.some(cell => cell.toString().match(/^\d+ \w+ \(\d+\)$/));
      
      if (isDayHeader) {
        sheet.setRowHeight(currentRow, 25); // Day header height
      } else if (rowData.every(cell => cell === '')) {
        // Spacer row
        sheet.setRowHeight(currentRow, 5);
      } else {
        // Service row
        sheet.setRowHeight(currentRow, 70);
      }
      
      currentRow++;
      rowIndex++;
    }
    
    // Apply borders to service cells with proper implementation
    formats.borders.forEach(border => {
      if (border.row <= sheet.getMaxRows() && border.col <= sheet.getMaxColumns()) {
        sheet.getRange(border.row, border.col, 1, 1)
             .setBorder(true, true, true, true, false, false, 
                       CALENDAR_CONFIG.COLORS.BORDER, 
                       SpreadsheetApp.BorderStyle.SOLID);
      }
    });
    
    // Add subtle column separators
    for (let day = 1; day < 7; day++) {
      const sepCol = (day * COLS_PER_DAY);
      sheet.getRange(startRow, sepCol, allData.length, 1)
           .setBorder(false, true, false, false, false, false, 
                     '#e0e0e0', SpreadsheetApp.BorderStyle.DASHED);
    }
    
    // Set outer border for entire calendar
    const dataRange = sheet.getRange(startRow, 1, allData.length, TOTAL_COLS);
    dataRange.setBorder(true, true, true, true, false, false, 
                       '#333333', SpreadsheetApp.BorderStyle.SOLID_THICK);
    
    // Set column widths
    for (let i = 1; i <= TOTAL_COLS; i++) {
      sheet.setColumnWidth(i, (i % COLS_PER_DAY === 1) ? 180 : 15);
    }
  }
  sheet.setHiddenGridlines(true);
}

function calendarPreviousMonth() {
  navigateCalendar(-1);
}

function calendarNextMonth() {
  navigateCalendar(1);
}

function navigateCalendar(monthOffset) {
  const calendarSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CALENDAR_CONFIG.SHEET_NAME);
  if (!calendarSheet) return;
  
  const currentMonthValue = calendarSheet.getRange('D3').getValue();
  const currentDate = new Date(currentMonthValue);
  currentDate.setMonth(currentDate.getMonth() + monthOffset);
  
  generateOptimizedCalendarView(currentDate.getFullYear(), currentDate.getMonth());
}

// ====================================================================
// PRINTING SYSTEM
// ====================================================================

function printSelectedTickets() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SERVICE_MANAGEMENT);
  if (!sheet || sheet.getLastRow() < 6) return SpreadsheetApp.getUi().alert('Service Management sheet not found or empty.');
  const headers = sheet.getRange(5, 1, 1, sheet.getLastColumn()).getValues()[0].reduce((m,h,i)=>{m[h]=i;return m},{});
  const data = sheet.getRange(6, 1, sheet.getLastRow() - 5, Object.keys(headers).length).getValues();
  const selected = data.filter(r => r[headers['Print?']] === true).map((r, index) => {
    // Get the corresponding pending service to find the jobSiteId
    const serviceId = r[headers['Service ID']];
    const scheduledDate = r[headers['Scheduled Date']];
    
    return {
      serviceId: serviceId, 
      jobSite: r[headers['Job Site Name']], 
      jobSiteId: '', // We'll get this from the recurring services
      address: r[headers['Address']],
      serviceType: r[headers['Service Type']], 
      frequency: r[headers['Frequency']], 
      date: scheduledDate,
      rowIndex: index + 6 // Store row index for later use
    };
  });
  if (selected.length === 0) return SpreadsheetApp.getUi().alert('No services selected for printing.');
  
  // Generate tickets and record print actions
  const success = generateBatchTickets(selected, 'Selected Services');
  
  if (success) {
    // Record print actions in action history
    recordPrintActions(selected);
    
    // Refresh the service management sheet to show highlights
    const match = sheet.getRange('A2').getValue().match(/through: ([\d\/]+)/);
    if (match) generateServiceManagementSheet(DateManager.normalize(match[1]));
  }
}


function generateBatchTickets(services, title) {
  const ui = SpreadsheetApp.getUi();
  const templateId = PropertiesService.getScriptProperties().getProperty('ticketTemplateId');
  if (!templateId) {
    ui.alert('Ticket template not configured. Go to Setup > Configure Ticket Template.');
    return false;
  }
  try {
    const templateFile = DriveApp.getFileById(templateId);
    const presName = `Service Tickets - ${title} - ${DateManager.format(new Date())}`;
    const newFile = templateFile.makeCopy(presName);
    const pres = SlidesApp.openById(newFile.getId());
    
    // First, verify the template has 2 slides
    const templateSlides = pres.getSlides();
    if (templateSlides.length < 2) {
      SpreadsheetApp.getUi().alert('Template must have 2 slides. Please check your template.');
      return false;
    }
    
    // Process each service
    services.forEach(service => {
      // Create TWO slides for each service using both template slides
      const slide1 = pres.appendSlide(templateSlides[0]);
      const slide2 = pres.appendSlide(templateSlides[1]);
      
      // Replace placeholders on BOTH slides with the same service data
      [slide1, slide2].forEach(slide => {
        slide.replaceAllText('{{SERVICE_ID}}', service.serviceId || '');
        slide.replaceAllText('{{JOBSITE_NAME}}', service.jobSite || '');
        slide.replaceAllText('{{ADDRESS}}', service.address || '');
        slide.replaceAllText('{{DATE}}', service.date ? DateManager.format(service.date) : '');
        slide.replaceAllText('{{FREQUENCY}}', service.frequency || '');
        slide.replaceAllText('{{SERVICE_TYPE}}', service.serviceType || '');
      });
    });
    
    // Remove the original template slides after processing
    templateSlides.forEach(slide => slide.remove());
    pres.saveAndClose();
    const html = `<h3>Tickets Ready!</h3><p><a href="${pres.getUrl()}" target="_blank">Open Presentation</a></p><p><b>IMPORTANT:</b> Ensure your template's page setup is 8.5" x 11" for correct printing.</p><button onclick="google.script.host.close()">Close</button>`;
    ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(400).setHeight(200), 'Tickets Generated');
    return true; // Return success
  } catch (e) {
    ui.alert(`Error generating tickets: ${e.toString()}`);
    return false; // Return failure
  }
}

function recordPrintActions(services) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const actionHistorySheet = ss.getSheetByName(SHEETS.ACTION_HISTORY);
  const servicesSheet = ss.getSheetByName(SHEETS.RECURRING_SERVICES);
  
  if (!actionHistorySheet || !servicesSheet) return;
  
  // Get service details from recurring services sheet
  const servicesData = servicesSheet.getDataRange().getValues();
  const headers = servicesData.shift();
  const serviceIdCol = headers.indexOf('Service ID');
  const jobSiteIdCol = headers.indexOf('Job Site ID');
  const jobSiteNameCol = headers.indexOf('Job Site Name');
  const serviceTypeCol = headers.indexOf('Service Type');
  
  // Create a map of service IDs to their details
  const serviceDetailsMap = {};
  servicesData.forEach(row => {
    if (row[serviceIdCol]) {
      serviceDetailsMap[row[serviceIdCol]] = {
        jobSiteId: row[jobSiteIdCol],
        jobSiteName: row[jobSiteNameCol],
        serviceType: row[serviceTypeCol]
      };
    }
  });
  
  // Prepare print records for action history
  const printRecords = [];
  const today = DateManager.today();
  
  services.forEach(service => {
    const details = serviceDetailsMap[service.serviceId] || {};
    printRecords.push([
      today,                                    // Date Recorded
      service.serviceId,                        // Service ID
      service.jobSiteId || details.jobSiteId || '', // Job Site ID
      service.jobSiteName || details.jobSiteName || '', // Job Site Name
      service.serviceType || details.serviceType || '', // Service Type
      service.date,                             // Scheduled Date
      'PRINTED ON:',                            // Action Type
      today,                                    // Action Date (when it was printed)
      'Service Manager',                        // Performed By
      'Ticket printed'                          // Notes
    ]);
  });
  
  // Append print records to action history
  if (printRecords.length > 0) {
    const lastRow = actionHistorySheet.getLastRow();
    actionHistorySheet.insertRowsAfter(1, printRecords.length);
    actionHistorySheet.getRange(2, 1, printRecords.length, 10)
      .setValues(printRecords)
      .setFontWeight('normal')
      .setBackground(null);
  }
}

// ====================================================================
// COUNTY MANIFEST REPORT
// ====================================================================

function generateCountyManifestReport() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Prompt for Quarter
  const quarterResponse = ui.prompt(
    'County Manifest Report',
    'Enter the Quarter (e.g., Q1 2025):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (quarterResponse.getSelectedButton() !== ui.Button.OK || !quarterResponse.getResponseText()) {
    return;
  }
  const quarter = quarterResponse.getResponseText().trim();
  
  // Prompt for County
  const countyResponse = ui.prompt(
    'County Manifest Report',
    'Enter the County name:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (countyResponse.getSelectedButton() !== ui.Button.OK || !countyResponse.getResponseText()) {
    return;
  }
  const county = countyResponse.getResponseText().trim();
  
  // Read Manifest Log data
  const manifestLogSheet = ss.getSheetByName(SHEETS.MANIFEST_LOG);
  if (!manifestLogSheet || manifestLogSheet.getLastRow() < 2) {
    ui.alert('No data found in Manifest Log sheet.');
    return;
  }
  
  // Get headers and data
  const headers = manifestLogSheet.getRange(1, 1, 1, 6).getValues()[0];
  const data = manifestLogSheet.getRange(2, 1, manifestLogSheet.getLastRow() - 1, 6).getValues();
  
  // Find column indices
  const quarterCol = headers.indexOf('Quarter');
  const countyCol = headers.indexOf('County');
  
  // Filter data for matching quarter and county
  const filteredData = data.filter(row => 
    row[quarterCol] === quarter && row[countyCol] === county
  );
  
  if (filteredData.length === 0) {
    ui.alert(`No records found for ${county} - ${quarter}`);
    return;
  }
  
  // Create new sheet name
  const sheetName = `${county} - ${quarter}`;
  let newSheet = ss.getSheetByName(sheetName);
  
  // If sheet exists, delete it first
  if (newSheet) {
    ss.deleteSheet(newSheet);
  }
  
  // Create new sheet
  newSheet = ss.insertSheet(sheetName);
  
  // Add headers
  newSheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#f0f0f0');
  
  // Add filtered data
  if (filteredData.length > 0) {
    newSheet.getRange(2, 1, filteredData.length, headers.length)
      .setValues(filteredData);
  }
  
  // Format date column (first column)
  const dateRange = newSheet.getRange(2, 1, filteredData.length, 1);
  dateRange.setNumberFormat('MM/dd/yyyy');
  
  // Auto-resize all columns
  for (let i = 1; i <= headers.length; i++) {
    newSheet.autoResizeColumn(i);
  }
  
  // Show success message
  ui.alert(
    'Report Generated',
    `Found ${filteredData.length} record${filteredData.length === 1 ? '' : 's'} for ${county} - ${quarter}`,
    ui.ButtonSet.OK
  );
  
  // Make the new sheet active
  newSheet.activate();
}

// ====================================================================
// TEMPLATE SETUP
// ====================================================================

function setupTemplateFromExisting() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Setup Ticket Template', 'Paste the URL of a blank Google Slides presentation:', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK || !response.getResponseText()) return;
  try {
    const match = response.getResponseText().match(/[-\w]{25,}/);
    if (!match) throw new Error('Could not find a valid Google Slides ID in the URL.');
    PropertiesService.getScriptProperties().setProperty('ticketTemplateId', match[0]);
    ui.alert('Template Saved!', 'The ticket template ID has been saved. Please edit the slide to add your background image and adjust any placeholders like {{JOBSITE_NAME}}, {{ADDRESS}}, etc.', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert(`Error setting up template: ${e.toString()}`);
  }
}







