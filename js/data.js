/**
 * StudyVault - Data Layer
 * Version: 3.0.0
 *
 * Frontend: Vanilla JavaScript
 * Backend: Google Apps Script Web App
 * Database: Google Sheets
 *
 * Public API:
 *   StudyVaultData.initialize()
 *   StudyVaultData.configure({ apiUrl })
 *   StudyVaultData.getStatus()
 *   StudyVaultData.getCache()
 *   StudyVaultData.books / chapters / topics / notes
 *
 * Each collection supports:
 *   getAll(), getById(id), create(data), update(id, data), delete(id)
 *
 * Additional filters:
 *   chapters.getByBook(bookId)
 *   topics.getByBook(bookId), topics.getByChapter(chapterId)
 *   notes.getByTopic(topicId)
 *
 * IMPORTANT:
 * Keep the request envelope in sync with Code.gs:
 *   { action: "list|create|update|delete", payload: {...} }
 */

(() => {
  'use strict';

  const STORAGE_KEY = 'studyvault_data_v3';

  const CONFIG = Object.freeze({
    API_URL: 'https://script.google.com/macros/s/AKfycbxVM2cAE4TVkMfmn8xEu922vF5e69YfOtrG73G95ydARsMzC2axZ-vocrBYkqkE58Y77g/exec',
    REQUEST_TIMEOUT: 20000,
    CACHE_ENABLED: true,
    CACHE_VERSION: 3,
    MAX_TITLE_LENGTH: 180,
    MAX_DESCRIPTION_LENGTH: 5000,
    MAX_NOTE_LENGTH: 50000
  });

  const ENTITY_NAMES = Object.freeze([
    'books',
    'chapters',
    'topics',
    'notes'
  ]);

  const TOPIC_STATUSES = Object.freeze([
    'not-started',
    'in-progress',
    'completed'
  ]);

  // ==========================================
  // CUSTOM ERROR
  // ==========================================

  class StudyVaultError extends Error {
    constructor(message, code = 'STUDYVAULT_ERROR', details = null) {
      super(message);

      this.name = 'StudyVaultError';
      this.code = code;
      this.details = details;
    }
  }

  // ==========================================
  // APPLICATION STATE
  // ==========================================

  const state = {
    apiUrl: CONFIG.API_URL,

    initialized: false,
    connected: false,
    loading: false,

    loadingPromise: null,

    lastError: null,
    lastSyncAt: null,

    cache: {
      books: [],
      chapters: [],
      topics: [],
      notes: []
    }
  };

  // ==========================================
  // HELPERS
  // ==========================================

  const hasOwn = (object, key) =>
    Object.prototype.hasOwnProperty.call(object, key);

  const isPlainObject = value =>
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value);

  const clone = value => {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (_) { }
    }

    return JSON.parse(JSON.stringify(value));
  };

  const nowISO = () => new Date().toISOString();

  function assertEntity(entity) {
    if (!ENTITY_NAMES.includes(entity)) {
      throw new StudyVaultError(
        `Unknown collection: ${entity}`,
        'INVALID_ENTITY'
      );
    }
  }

  function normalizeId(id) {
    const value = String(id ?? '').trim();

    if (!value || !/^[a-zA-Z0-9_-]+$/.test(value)) {
      throw new StudyVaultError(
        'A valid record ID is required.',
        'INVALID_ID'
      );
    }

    return value;
  }

  function generateId() {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID().replace(/-/g, '');
    }

    return `sv_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 12)}`;
  }

  function cleanText(value, field, maxLength, required = false) {
    const result = String(value ?? '').trim();

    if (required && !result) {
      throw new StudyVaultError(
        `${field} is required.`,
        'VALIDATION_ERROR',
        { field }
      );
    }

    if (result.length > maxLength) {
      throw new StudyVaultError(
        `${field} must be ${maxLength} characters or fewer.`,
        'VALIDATION_ERROR',
        {
          field,
          maxLength
        }
      );
    }

    return result;
  }

  // ==========================================
  // BOOK VALIDATION
  // ==========================================

  function validateBook(input, partial = false) {
    if (!isPlainObject(input)) {
      throw new StudyVaultError(
        'Book data must be an object.',
        'VALIDATION_ERROR'
      );
    }

    const output = {};

    if (!partial || hasOwn(input, 'title')) {
      output.title = cleanText(
        input.title,
        'Book title',
        CONFIG.MAX_TITLE_LENGTH,
        true
      );
    }

    if (!partial || hasOwn(input, 'subject')) {
      output.subject = cleanText(
        input.subject,
        'Subject',
        CONFIG.MAX_TITLE_LENGTH,
        true
      );
    }

    if (hasOwn(input, 'description')) {
      output.description = cleanText(
        input.description,
        'Description',
        CONFIG.MAX_DESCRIPTION_LENGTH
      );
    } else if (!partial) {
      output.description = '';
    }

    return output;
  }

  // ==========================================
  // CHAPTER VALIDATION
  // ==========================================

  function validateChapter(input, partial = false) {
    if (!isPlainObject(input)) {
      throw new StudyVaultError(
        'Chapter data must be an object.',
        'VALIDATION_ERROR'
      );
    }

    const output = {};

    if (!partial || hasOwn(input, 'bookId')) {
      output.bookId = normalizeId(input.bookId);
    }

    if (!partial || hasOwn(input, 'title')) {
      output.title = cleanText(
        input.title,
        'Chapter title',
        CONFIG.MAX_TITLE_LENGTH,
        true
      );
    }

    if (hasOwn(input, 'description')) {
      output.description = cleanText(
        input.description,
        'Description',
        CONFIG.MAX_DESCRIPTION_LENGTH
      );
    } else if (!partial) {
      output.description = '';
    }

    return output;
  }

  // ==========================================
  // TOPIC VALIDATION
  // ==========================================

  function validateTopic(input, partial = false) {
    if (!isPlainObject(input)) {
      throw new StudyVaultError(
        'Topic data must be an object.',
        'VALIDATION_ERROR'
      );
    }

    const output = {};

    if (!partial || hasOwn(input, 'bookId')) {
      output.bookId = normalizeId(input.bookId);
    }

    if (!partial || hasOwn(input, 'chapterId')) {
      output.chapterId = normalizeId(input.chapterId);
    }

    if (!partial || hasOwn(input, 'title')) {
      output.title = cleanText(
        input.title,
        'Topic title',
        CONFIG.MAX_TITLE_LENGTH,
        true
      );
    }

    if (hasOwn(input, 'description')) {
      output.description = cleanText(
        input.description,
        'Description',
        CONFIG.MAX_DESCRIPTION_LENGTH
      );
    } else if (!partial) {
      output.description = '';
    }

    if (hasOwn(input, 'status') || !partial) {
      const status = String(
        input.status || 'not-started'
      ).trim();

      if (!TOPIC_STATUSES.includes(status)) {
        throw new StudyVaultError(
          `Topic status must be one of: ${TOPIC_STATUSES.join(', ')}.`,
          'VALIDATION_ERROR',
          { field: 'status' }
        );
      }

      output.status = status;
    }

    if (hasOwn(input, 'completionDate')) {
      output.completionDate = input.completionDate
        ? String(input.completionDate).trim()
        : '';
    } else if (!partial) {
      output.completionDate =
        output.status === 'completed' ? nowISO() : '';
    }

    if (
      output.status === 'completed' &&
      !output.completionDate
    ) {
      output.completionDate = nowISO();
    }

    if (
      output.status &&
      output.status !== 'completed' &&
      !hasOwn(input, 'completionDate')
    ) {
      output.completionDate = '';
    }

    return output;
  }

  // ==========================================
  // NOTE VALIDATION
  // ==========================================

  function validateNote(input, partial = false) {
    if (!isPlainObject(input)) {
      throw new StudyVaultError(
        'Note data must be an object.',
        'VALIDATION_ERROR'
      );
    }

    const output = {};

    const relations = [
      'bookId',
      'chapterId',
      'topicId'
    ];

    for (const relation of relations) {
      if (
        hasOwn(input, relation) &&
        input[relation] !== '' &&
        input[relation] != null
      ) {
        output[relation] = normalizeId(input[relation]);
      } else if (!partial && hasOwn(input, relation)) {
        output[relation] = '';
      }
    }

    if (!partial || hasOwn(input, 'title')) {
      output.title = cleanText(
        input.title,
        'Note title',
        CONFIG.MAX_TITLE_LENGTH,
        true
      );
    }

    if (!partial || hasOwn(input, 'content')) {
      output.content = cleanText(
        input.content,
        'Note content',
        CONFIG.MAX_NOTE_LENGTH,
        true
      );
    }

    return output;
  }

  // ==========================================
  // VALIDATOR REGISTRY
  // ==========================================

  const validators = {
    books: validateBook,
    chapters: validateChapter,
    topics: validateTopic,
    notes: validateNote
  };

  // ==========================================
  // LOCAL STORAGE CACHE
  // ==========================================

  function readCache() {
    if (
      !CONFIG.CACHE_ENABLED ||
      !globalThis.localStorage
    ) {
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) return;

      const parsed = JSON.parse(raw);

      if (
        parsed?.version !== CONFIG.CACHE_VERSION ||
        !isPlainObject(parsed.data)
      ) {
        return;
      }

      for (const entity of ENTITY_NAMES) {
        if (Array.isArray(parsed.data[entity])) {
          state.cache[entity] = parsed.data[entity];
        }
      }
    } catch (error) {
      console.warn(
        '[StudyVault] Could not read local cache:',
        error
      );
    }
  }

  function persistCache() {
    if (
      !CONFIG.CACHE_ENABLED ||
      !globalThis.localStorage
    ) {
      return;
    }

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: CONFIG.CACHE_VERSION,
          savedAt: nowISO(),
          data: state.cache
        })
      );
    } catch (error) {
      console.warn(
        '[StudyVault] Could not save local cache:',
        error
      );
    }
  }

  function replaceCache(data) {
    for (const entity of ENTITY_NAMES) {
      if (Array.isArray(data?.[entity])) {
        state.cache[entity] = clone(data[entity]);
      }
    }

    persistCache();
  }

  function getCache() {
    return clone(state.cache);
  }

  // ==========================================
  // CONNECTION STATUS
  // ==========================================

  function getStatus() {
    return {
      initialized: state.initialized,
      connected: state.connected,
      loading: state.loading,
      apiConfigured: Boolean(state.apiUrl),
      lastSyncAt: state.lastSyncAt,
      lastError: state.lastError
    };
  }

  // ==========================================
  // API CONFIGURATION
  // ==========================================

  function configure(options = {}) {
    if (!isPlainObject(options)) {
      throw new StudyVaultError(
        'Configuration must be an object.',
        'INVALID_CONFIG'
      );
    }

    if (!hasOwn(options, 'apiUrl')) {
      return getStatus();
    }

    const rawUrl = String(options.apiUrl ?? '').trim();

    if (!rawUrl) {
      state.apiUrl = '';
      state.connected = false;

      return getStatus();
    }

    let parsed;

    try {
      parsed = new URL(rawUrl);
    } catch (_) {
      throw new StudyVaultError(
        'Please provide a valid Google Apps Script Web App URL.',
        'INVALID_API_URL'
      );
    }

    if (
      parsed.protocol !== 'https:' ||
      !/^(script\.google\.com|script\.googleusercontent\.com)$/.test(
        parsed.hostname
      )
    ) {
      throw new StudyVaultError(
        'API URL must be a valid HTTPS Google Apps Script Web App URL.',
        'INVALID_API_URL'
      );
    }

    state.apiUrl = rawUrl;
    state.connected = false;

    return getStatus();
  }

  // ==========================================
  // API REQUEST HANDLER
  // ==========================================

  async function request(action, payload = {}) {
    if (!state.apiUrl) {
      throw new StudyVaultError(
        'Google Apps Script API URL is not configured yet.',
        'API_NOT_CONFIGURED'
      );
    }

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, CONFIG.REQUEST_TIMEOUT);

    try {
      const response = await fetch(state.apiUrl, {
        method: 'POST',

        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },

        body: JSON.stringify({
          action,
          payload
        }),

        signal: controller.signal,
        redirect: 'follow',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new StudyVaultError(
          `Server request failed (${response.status}).`,
          'HTTP_ERROR',
          {
            status: response.status
          }
        );
      }

      let result;

      try {
        result = await response.json();
      } catch (_) {
        throw new StudyVaultError(
          'The server returned an unreadable response. Check the Apps Script deployment and access settings.',
          'INVALID_SERVER_RESPONSE'
        );
      }

      if (!result || result.success !== true) {
        throw new StudyVaultError(
          result?.message ||
          'The server could not complete the request.',
          result?.code || 'API_ERROR',
          result
        );
      }

      state.connected = true;
      state.lastError = null;
      state.lastSyncAt = nowISO();

      return result.data;

    } catch (error) {
      state.connected = false;

      state.lastError =
        error?.message || 'Network request failed.';

      if (error?.name === 'AbortError') {
        throw new StudyVaultError(
          'Request timed out. Please try again.',
          'REQUEST_TIMEOUT'
        );
      }

      if (error instanceof StudyVaultError) {
        throw error;
      }

      throw new StudyVaultError(
        'Could not connect to Google Apps Script. Check the URL, deployment access, and browser network/CORS response.',
        'NETWORK_ERROR',
        {
          originalMessage:
            error?.message || String(error)
        }
      );

    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ==========================================
  // RESPONSE NORMALIZATION
  // ==========================================

  function normalizeList(data, entity) {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.[entity])) {
      return data[entity];
    }

    if (Array.isArray(data?.items)) {
      return data.items;
    }

    if (data == null) {
      return [];
    }

    throw new StudyVaultError(
      `Unexpected ${entity} list response from backend.`,
      'INVALID_SERVER_RESPONSE'
    );
  }

  // ==========================================
  // LOCAL CACHE OPERATIONS
  // ==========================================

  function localUpsert(entity, record) {
    const list = state.cache[entity];

    const index = list.findIndex(
      item => String(item.id) === String(record.id)
    );

    if (index >= 0) {
      list[index] = clone(record);
    } else {
      list.unshift(clone(record));
    }

    persistCache();
  }

  function localRemove(entity, id) {
    state.cache[entity] = state.cache[entity].filter(
      item => String(item.id) !== String(id)
    );

    persistCache();
  }

  // ==========================================
  // COLLECTION FACTORY
  // ==========================================

  function createCollection(entity) {
    assertEntity(entity);

    // GET ALL
    async function getAll() {
      const data = await request(
        'list',
        { entity }
      );

      const records = normalizeList(data, entity);

      state.cache[entity] = clone(records);

      persistCache();

      return clone(records);
    }

    // GET BY ID
    async function getById(id) {
      const safeId = normalizeId(id);

      const cached = state.cache[entity].find(
        item => String(item.id) === safeId
      );

      if (cached) {
        return clone(cached);
      }

      const records = await getAll();

      return clone(
        records.find(
          item => String(item.id) === safeId
        ) || null
      );
    }

    // CREATE
    async function create(input) {
      const recordData = validators[entity](
        input,
        false
      );

      const timestamp = nowISO();

      const record = {
        ...recordData,
        id: generateId(),
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const result = await request(
        'create',
        {
          entity,
          data: record
        }
      );

      const saved = isPlainObject(result)
        ? (result.record || result.item || result)
        : record;

      const finalRecord =
        isPlainObject(saved) && saved.id
          ? saved
          : record;

      localUpsert(entity, finalRecord);

      return clone(finalRecord);
    }

    // UPDATE
    async function update(id, input) {
      const safeId = normalizeId(id);

      const updates = validators[entity](
        input,
        true
      );

      const existing = state.cache[entity].find(
        item => String(item.id) === safeId
      );

      const record = {
        ...(existing || {}),
        ...updates,
        id: safeId,
        updatedAt: nowISO()
      };

      const result = await request(
        'update',
        {
          entity,
          id: safeId,
          data: updates
        }
      );

      const saved = isPlainObject(result)
        ? (result.record || result.item || result)
        : record;

      const finalRecord =
        isPlainObject(saved) && saved.id
          ? saved
          : {
            ...record,
            ...(isPlainObject(result) ? result : {})
          };

      localUpsert(entity, finalRecord);

      return clone(finalRecord);
    }

    // DELETE
    async function remove(id) {
      const safeId = normalizeId(id);

      const result = await request(
        'delete',
        {
          entity,
          id: safeId
        }
      );

      localRemove(entity, safeId);

      return result ?? {
        id: safeId,
        deleted: true
      };
    }

    return Object.freeze({
      getAll,
      getById,
      create,
      update,
      delete: remove
    });
  }

  // ==========================================
  // BASE COLLECTIONS
  // ==========================================

  const books = createCollection('books');

  const chapters = createCollection('chapters');

  const topics = createCollection('topics');

  const notes = createCollection('notes');

  // ==========================================
  // COLLECTION FILTERING
  // ==========================================

  async function filterCollection(
    collection,
    field,
    value
  ) {
    const safeValue = normalizeId(value);

    const records = await collection.getAll();

    return records.filter(
      item => String(item[field] ?? '') === safeValue
    );
  }

  // ==========================================
  // CHAPTER API
  // ==========================================

  const chaptersAPI = Object.freeze({
    ...chapters,

    getByBook: bookId =>
      filterCollection(
        chapters,
        'bookId',
        bookId
      )
  });

  // ==========================================
  // TOPIC API
  // ==========================================

  const topicsAPI = Object.freeze({
    ...topics,

    getByBook: bookId =>
      filterCollection(
        topics,
        'bookId',
        bookId
      ),

    getByChapter: chapterId =>
      filterCollection(
        topics,
        'chapterId',
        chapterId
      )
  });

  // ==========================================
  // NOTES API
  // ==========================================

  const notesAPI = Object.freeze({
    ...notes,

    getByTopic: topicId =>
      filterCollection(
        notes,
        'topicId',
        topicId
      )
  });

  // ==========================================
  // INITIALIZE APPLICATION DATA
  // ==========================================

  async function initialize(options = {}) {
    if (options?.apiUrl) {
      configure({
        apiUrl: options.apiUrl
      });
    }

    if (state.loadingPromise) {
      return state.loadingPromise;
    }

    readCache();

    // Backend URL is not configured yet.
    if (!state.apiUrl) {
      state.initialized = true;

      return getCache();
    }

    state.loading = true;

    state.loadingPromise = (async () => {
      try {
        const [
          bookList,
          chapterList,
          topicList,
          noteList
        ] = await Promise.all([
          books.getAll(),
          chapters.getAll(),
          topics.getAll(),
          notes.getAll()
        ]);

        replaceCache({
          books: bookList,
          chapters: chapterList,
          topics: topicList,
          notes: noteList
        });

        state.initialized = true;
        state.connected = true;

        return getCache();

      } catch (error) {
        state.initialized = true;
        state.connected = false;

        state.lastError =
          error?.message || 'Initialization failed.';

        throw error;

      } finally {
        state.loading = false;
        state.loadingPromise = null;
      }
    })();

    return state.loadingPromise;
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  const api = Object.freeze({
    version: '3.0.0',

    CONFIG,

    TOPIC_STATUSES,

    StudyVaultError,

    initialize,

    configure,

    getStatus,

    getCache,

    books,

    chapters: chaptersAPI,

    topics: topicsAPI,

    notes: notesAPI
  });

  // ==========================================
  // GLOBAL INITIALIZATION
  // ==========================================

  readCache();

  Object.defineProperty(
    globalThis,
    'StudyVaultData',
    {
      value: api,
      writable: false,
      configurable: false,
      enumerable: true
    }
  );

})();