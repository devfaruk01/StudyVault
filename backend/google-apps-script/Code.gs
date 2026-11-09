
/**
 * StudyVault - Google Apps Script Backend
 * File: backend/google-apps-script/Code.gs
 *
 * Database: StudyVault Database
 * Sheets: Books, Chapters, Topics, Notes
 *
 * API actions:
 * list
 * create
 * update
 * delete
 *
 * Expected request:
 * {
 *   action: "list",
 *   payload: { collection: "books" }
 * }
 *
 * Expected response:
 * {
 *   success: true,
 *   data: [...]
 * }
 */


// ==========================================
// 1. CONFIGURATION
// ==========================================

const CONFIG = Object.freeze({
  SPREADSHEET_ID_PROPERTY: 'STUDYVAULT_SPREADSHEET_ID',
  OWNER_EMAIL_PROPERTY: 'STUDYVAULT_OWNER_EMAIL',

  TOPIC_STATUSES: [
    'not-started',
    'in-progress',
    'completed'
  ],

  SHEETS: {
    books: {
      name: 'Books',
      columns: [
        'id',
        'title',
        'subject',
        'description',
        'createdAt',
        'updatedAt'
      ]
    },

    chapters: {
      name: 'Chapters',
      columns: [
        'id',
        'bookId',
        'title',
        'description',
        'createdAt',
        'updatedAt'
      ]
    },

    topics: {
      name: 'Topics',
      columns: [
        'id',
        'bookId',
        'chapterId',
        'title',
        'description',
        'status',
        'completionDate',
        'createdAt',
        'updatedAt'
      ]
    },

    notes: {
      name: 'Notes',
      columns: [
        'id',
        'bookId',
        'chapterId',
        'topicId',
        'title',
        'content',
        'createdAt',
        'updatedAt'
      ]
    }
  }
});


// ==========================================
// 2. API ENTRY POINTS
// ==========================================

/**
 * Handles POST requests from the frontend.
 */
function doPost(e) {
  try {
    verifyAccess();

    if (!e || !e.postData || !e.postData.contents) {
      throw createError(
        'Request body is missing.',
        'INVALID_REQUEST'
      );
    }

    let request;

    try {
      request = JSON.parse(e.postData.contents);
    } catch (error) {
      throw createError(
        'Request body contains invalid JSON.',
        'INVALID_JSON'
      );
    }

    if (
      !request ||
      typeof request !== 'object' ||
      Array.isArray(request)
    ) {
      throw createError(
        'Invalid request format.',
        'INVALID_REQUEST'
      );
    }

    const action = request.action;
    const payload = request.payload || {};

    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload)
    ) {
      throw createError(
        'Invalid request payload.',
        'INVALID_REQUEST'
      );
    }

    const result = routeAction(action, payload);

    return jsonResponse({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('StudyVault API error:', error);

    return jsonResponse({
      success: false,
      message: error.message || 'An unexpected error occurred.',
      code: error.code || 'SERVER_ERROR'
    });
  }
}


/**
 * Health-check endpoint.
 */
function doGet() {
  try {
    verifyAccess();

    return jsonResponse({
      success: true,
      message: 'StudyVault backend is running.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.message || 'Access denied.',
      code: error.code || 'ACCESS_DENIED'
    });
  }
}


// ==========================================
// 3. ACCESS CONTROL
// ==========================================

/**
 * Allows only the configured Google account.
 *
 * Important:
 * Session.getActiveUser().getEmail() may be unavailable
 * in some Google Apps Script deployment configurations.
 *
 * If Google cannot provide the email, access is denied.
 */
function verifyAccess() {
  const properties = PropertiesService.getScriptProperties();

  const ownerEmail = properties.getProperty(
    CONFIG.OWNER_EMAIL_PROPERTY
  );

  if (!ownerEmail) {
    throw createError(
      'Owner email is not configured in Script Properties.',
      'ACCESS_NOT_CONFIGURED'
    );
  }

  const activeUser = Session.getActiveUser();
  const activeEmail = activeUser
    ? String(activeUser.getEmail() || '').toLowerCase().trim()
    : '';

  if (!activeEmail) {
    throw createError(
      'Google could not verify the signed-in account. Check the deployment settings.',
      'AUTHENTICATION_REQUIRED'
    );
  }

  if (activeEmail !== ownerEmail.toLowerCase().trim()) {
    throw createError(
      'You do not have permission to access StudyVault.',
      'ACCESS_DENIED'
    );
  }
}


// ==========================================
// 4. REQUEST ROUTER
// ==========================================

function routeAction(action, payload) {
  switch (action) {
    case 'list':
      return listRecords(payload);

    case 'create':
      return createRecord(payload);

    case 'update':
      return updateRecord(payload);

    case 'delete':
      return deleteRecord(payload);

    default:
      throw createError(
        'Unsupported API action.',
        'INVALID_ACTION'
      );
  }
}


// ==========================================
// 5. DATABASE CONNECTION
// ==========================================

function getDatabase() {
  const properties = PropertiesService.getScriptProperties();

  const spreadsheetId = properties.getProperty(
    CONFIG.SPREADSHEET_ID_PROPERTY
  );

  if (!spreadsheetId) {
    throw createError(
      'Spreadsheet ID is not configured.',
      'DATABASE_NOT_CONFIGURED'
    );
  }

  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    throw createError(
      'Unable to open the StudyVault database.',
      'DATABASE_CONNECTION_ERROR'
    );
  }
}


/**
 * Returns the sheet for a collection.
 */
function getSheet(collection) {
  const config = getCollectionConfig(collection);

  const spreadsheet = getDatabase();
  const sheet = spreadsheet.getSheetByName(config.name);

  if (!sheet) {
    throw createError(
      `The ${config.name} sheet does not exist.`,
      'SHEET_NOT_FOUND'
    );
  }

  return sheet;
}


/**
 * Returns collection configuration.
 */
function getCollectionConfig(collection) {
  const config = CONFIG.SHEETS[collection];

  if (!config) {
    throw createError(
      'Invalid collection.',
      'INVALID_COLLECTION'
    );
  }

  return config;
}


// ==========================================
// 6. SHEET HEADER VALIDATION
// ==========================================

function validateSheetHeaders(sheet, collection) {
  const config = getCollectionConfig(collection);

  const lastColumn = sheet.getLastColumn();

  if (lastColumn < config.columns.length) {
    throw createError(
      `${config.name} sheet has missing columns.`,
      'INVALID_SHEET_STRUCTURE'
    );
  }

  const headers = sheet
    .getRange(1, 1, 1, config.columns.length)
    .getValues()[0];

  const valid = config.columns.every(
    (column, index) => String(headers[index]).trim() === column
  );

  if (!valid) {
    throw createError(
      `${config.name} sheet headers do not match the required structure.`,
      'INVALID_SHEET_STRUCTURE'
    );
  }
}


// ==========================================
// 7. READ OPERATIONS
// ==========================================

function listRecords(payload) {
  const collection = validateCollection(payload.collection);

  const sheet = getSheet(collection);

  validateSheetHeaders(sheet, collection);

  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  const config = getCollectionConfig(collection);

  const rows = sheet.getRange(
    2,
    1,
    lastRow - 1,
    config.columns.length
  ).getValues();

  return rows
    .filter(row => row[0] !== '' && row[0] !== null)
    .map(row => rowToObject(row, config.columns));
}


// ==========================================
// 8. CREATE OPERATIONS
// ==========================================

function createRecord(payload) {
  const collection = validateCollection(payload.collection);
  const record = payload.record;

  if (
    !record ||
    typeof record !== 'object' ||
    Array.isArray(record)
  ) {
    throw createError(
      'Record data is missing or invalid.',
      'INVALID_RECORD'
    );
  }

  const lock = LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet = getSheet(collection);

    validateSheetHeaders(sheet, collection);

    const config = getCollectionConfig(collection);

    validateRecord(collection, record);

    const id = String(record.id || '').trim();

    if (!id) {
      throw createError(
        'Record ID is required.',
        'INVALID_ID'
      );
    }

    if (findRowById(sheet, id)) {
      throw createError(
        'A record with this ID already exists.',
        'DUPLICATE_ID'
      );
    }

    validateRelationships(collection, record);

    const now = new Date().toISOString();

    const safeRecord = {
      ...record,
      id,
      createdAt: record.createdAt || now,
      updatedAt: now
    };

    const row = config.columns.map(column => {
      return normalizeCellValue(safeRecord[column]);
    });

    sheet.appendRow(row);

    return rowToObject(row, config.columns);

  } finally {
    lock.releaseLock();
  }
}


// ==========================================
// 9. UPDATE OPERATIONS
// ==========================================

function updateRecord(payload) {
  const collection = validateCollection(payload.collection);
  const id = validateId(payload.id);
  const changes = payload.changes;

  if (
    !changes ||
    typeof changes !== 'object' ||
    Array.isArray(changes)
  ) {
    throw createError(
      'Updated record data is missing or invalid.',
      'INVALID_RECORD'
    );
  }

  const lock = LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet = getSheet(collection);

    validateSheetHeaders(sheet, collection);

    const config = getCollectionConfig(collection);

    const rowNumber = findRowById(sheet, id);

    if (!rowNumber) {
      throw createError(
        'Record not found.',
        'RECORD_NOT_FOUND'
      );
    }

    const currentRow = sheet.getRange(
      rowNumber,
      1,
      1,
      config.columns.length
    ).getValues()[0];

    const currentRecord = rowToObject(
      currentRow,
      config.columns
    );

    const allowedFields = config.columns.filter(
      column => !['id', 'createdAt'].includes(column)
    );

    Object.keys(changes).forEach(key => {
      if (!allowedFields.includes(key)) {
        throw createError(
          `Field "${key}" cannot be updated.`,
          'INVALID_FIELD'
        );
      }
    });

    const updatedRecord = {
      ...currentRecord,
      ...changes,
      id,
      createdAt: currentRecord.createdAt,
      updatedAt: new Date().toISOString()
    };

    validateRecord(collection, updatedRecord);

    validateRelationships(collection, updatedRecord);

    const updatedRow = config.columns.map(column => {
      return normalizeCellValue(updatedRecord[column]);
    });

    sheet.getRange(
      rowNumber,
      1,
      1,
      config.columns.length
    ).setValues([updatedRow]);

    return rowToObject(updatedRow, config.columns);

  } finally {
    lock.releaseLock();
  }
}


// ==========================================
// 10. DELETE OPERATIONS
// ==========================================

function deleteRecord(payload) {
  const collection = validateCollection(payload.collection);
  const id = validateId(payload.id);

  const lock = LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet = getSheet(collection);

    validateSheetHeaders(sheet, collection);

    const rowNumber = findRowById(sheet, id);

    if (!rowNumber) {
      throw createError(
        'Record not found.',
        'RECORD_NOT_FOUND'
      );
    }

    preventOrphanedRecords(collection, id);

    sheet.deleteRow(rowNumber);

    return {
      id,
      deleted: true
    };

  } finally {
    lock.releaseLock();
  }
}


/**
 * Prevents deleting parent records that still have children.
 */
function preventOrphanedRecords(collection, id) {
  const relationships = {
    books: [
      ['chapters', 'bookId'],
      ['topics', 'bookId'],
      ['notes', 'bookId']
    ],

    chapters: [
      ['topics', 'chapterId'],
      ['notes', 'chapterId']
    ],

    topics: [
      ['notes', 'topicId']
    ]
  };

  const dependencies = relationships[collection] || [];

  dependencies.forEach(([childCollection, field]) => {
    const children = listRecords({
      collection: childCollection
    });

    const exists = children.some(
      record => String(record[field]) === id
    );

    if (exists) {
      throw createError(
        `Cannot delete this ${collection.slice(0, -1)} because related ${childCollection} records still exist.`,
        'RELATED_RECORDS_EXIST'
      );
    }
  });
}


// ==========================================
// 11. RELATIONSHIP VALIDATION
// ==========================================

function validateRelationships(collection, record) {

  // Chapters must belong to an existing book.
  if (collection === 'chapters') {
    requireRelatedRecord(
      'books',
      record.bookId,
      'Book'
    );
  }


  // Topics must belong to an existing book and chapter.
  if (collection === 'topics') {
    requireRelatedRecord(
      'books',
      record.bookId,
      'Book'
    );

    requireRelatedRecord(
      'chapters',
      record.chapterId,
      'Chapter'
    );

    const chapter = getRecordById(
      'chapters',
      record.chapterId
    );

    if (String(chapter.bookId) !== String(record.bookId)) {
      throw createError(
        'The selected chapter does not belong to the selected book.',
        'RELATIONSHIP_MISMATCH'
      );
    }
  }


  // Notes can optionally belong to a book, chapter or topic.
  if (collection === 'notes') {

    if (record.bookId) {
      requireRelatedRecord(
        'books',
        record.bookId,
        'Book'
      );
    }

    if (record.chapterId) {
      requireRelatedRecord(
        'chapters',
        record.chapterId,
        'Chapter'
      );

      const chapter = getRecordById(
        'chapters',
        record.chapterId
      );

      if (
        record.bookId &&
        String(chapter.bookId) !== String(record.bookId)
      ) {
        throw createError(
          'The selected chapter does not belong to the selected book.',
          'RELATIONSHIP_MISMATCH'
        );
      }
    }

    if (record.topicId) {
      requireRelatedRecord(
        'topics',
        record.topicId,
        'Topic'
      );

      const topic = getRecordById(
        'topics',
        record.topicId
      );

      if (
        record.chapterId &&
        String(topic.chapterId) !== String(record.chapterId)
      ) {
        throw createError(
          'The selected topic does not belong to the selected chapter.',
          'RELATIONSHIP_MISMATCH'
        );
      }

      if (
        record.bookId &&
        String(topic.bookId) !== String(record.bookId)
      ) {
        throw createError(
          'The selected topic does not belong to the selected book.',
          'RELATIONSHIP_MISMATCH'
        );
      }
    }
  }
}


/**
 * Checks whether a related record exists.
 */
function requireRelatedRecord(collection, id, label) {
  if (!id || !getRecordById(collection, id)) {
    throw createError(
      `${label} does not exist.`,
      'RELATED_RECORD_NOT_FOUND'
    );
  }
}


/**
 * Finds a record by ID and returns it.
 */
function getRecordById(collection, id) {
  const sheet = getSheet(collection);

  validateSheetHeaders(sheet, collection);

  const rowNumber = findRowById(sheet, String(id));

  if (!rowNumber) {
    return null;
  }

  const config = getCollectionConfig(collection);

  const row = sheet.getRange(
    rowNumber,
    1,
    1,
    config.columns.length
  ).getValues()[0];

  return rowToObject(row, config.columns);
}


// ==========================================
// 12. RECORD VALIDATION
// ==========================================

function validateRecord(collection, record) {
  const requiredFields = {
    books: [
      'title',
      'subject'
    ],

    chapters: [
      'bookId',
      'title'
    ],

    topics: [
      'bookId',
      'chapterId',
      'title'
    ],

    notes: [
      'title',
      'content'
    ]
  };

  const fields = requiredFields[collection];

  if (!fields) {
    throw createError(
      'Invalid collection.',
      'INVALID_COLLECTION'
    );
  }

  // Required field validation.
  fields.forEach(field => {
    if (
      record[field] === undefined ||
      record[field] === null ||
      String(record[field]).trim() === ''
    ) {
      throw createError(
        `${field} is required.`,
        'VALIDATION_ERROR'
      );
    }
  });


  // Text length validation.
  const textFields = [
    'title',
    'subject',
    'description',
    'content'
  ];

  textFields.forEach(field => {
    if (
      record[field] !== undefined &&
      record[field] !== null &&
      String(record[field]).length > 20000
    ) {
      throw createError(
        `${field} is too long.`,
        'VALIDATION_ERROR'
      );
    }
  });


  // Topic-specific validation.
  if (collection === 'topics') {

    if (
      record.status !== undefined &&
      !CONFIG.TOPIC_STATUSES.includes(record.status)
    ) {
      throw createError(
        'Invalid topic status. Use not-started, in-progress or completed.',
        'VALIDATION_ERROR'
      );
    }

    if (
      record.description !== undefined &&
      String(record.description).length > 20000
    ) {
      throw createError(
        'Topic description is too long.',
        'VALIDATION_ERROR'
      );
    }

    if (
      record.completionDate !== undefined &&
      record.completionDate !== '' &&
      typeof record.completionDate !== 'string'
    ) {
      throw createError(
        'Invalid topic completion date.',
        'VALIDATION_ERROR'
      );
    }
  }
}


// ==========================================
// 13. DATABASE HELPERS
// ==========================================

/**
 * Finds a row using its ID.
 */
function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const idValues = sheet.getRange(
    2,
    1,
    lastRow - 1,
    1
  ).getDisplayValues();

  const index = idValues.findIndex(
    row => String(row[0]).trim() === String(id).trim()
  );

  return index === -1 ? null : index + 2;
}


/**
 * Converts a sheet row into a JavaScript object.
 */
function rowToObject(row, columns) {
  const record = {};

  columns.forEach((column, index) => {
    let value = row[index];

    if (value instanceof Date) {
      value = value.toISOString();
    }

    record[column] =
      value === null || value === undefined
        ? ''
        : value;
  });

  return record;
}


/**
 * Normalizes values before saving to Google Sheets.
 *
 * Protects user-entered text from being interpreted
 * as a spreadsheet formula.
 */
function normalizeCellValue(value) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value;
  }

  const text = String(value);

  if (/^[=+\-@]/.test(text)) {
    return "'" + text;
  }

  return text;
}


/**
 * Validates collection name.
 */
function validateCollection(collection) {
  if (
    typeof collection !== 'string' ||
    !Object.prototype.hasOwnProperty.call(
      CONFIG.SHEETS,
      collection
    )
  ) {
    throw createError(
      'Invalid collection name.',
      'INVALID_COLLECTION'
    );
  }

  return collection;
}


/**
 * Validates record ID.
 */
function validateId(id) {
  if (
    typeof id !== 'string' ||
    !id.trim()
  ) {
    throw createError(
      'A valid record ID is required.',
      'INVALID_ID'
    );
  }

  return id.trim();
}


// ==========================================
// 14. RESPONSE HELPERS
// ==========================================

/**
 * Returns JSON response.
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * Creates a structured API error.
 */
function createError(message, code) {
  const error = new Error(message);

  error.code = code;

  return error;
}
