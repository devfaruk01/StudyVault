
/**
 * StudyVault - Main Application
 * File: js/app.js
 *
 * Main responsibilities:
 * - Application initialization
 * - Navigation
 * - Dashboard statistics
 * - Books, Chapters, Topics and Notes
 * - Search and filters
 * - Create, Edit and Delete operations
 * - Modal and toast notifications
 */

(() => {
    'use strict';

    // ==========================================
    // 1. APPLICATION STATE
    // ==========================================

    const state = {
        books: [],
        chapters: [],
        topics: [],
        notes: [],
        currentPage: 'dashboard',
        currentEntity: null,
        currentRecordId: null,
        initialized: false
    };

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        [...parent.querySelectorAll(selector)];

    const data = window.StudyVaultData;
    const animations = window.StudyVaultAnimations;

    // ==========================================
    // 2. GENERAL UTILITIES
    // ==========================================

    function escapeHTML(value = '') {
        return String(value).replace(/[&<>"']/g, character => {
            const entities = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };

            return entities[character];
        });
    }

    function formatDate(value) {
        if (!value) return 'Not available';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return 'Not available';
        }

        return date.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    function getRecordTitle(record) {
        return record?.title || record?.name || 'Untitled';
    }

    function getProgress(total, completed) {
        if (!total) return 0;

        return Math.round((completed / total) * 100);
    }

    function findRecord(collection, id) {
        return collection.find(record => record.id === id);
    }

    function showToast(message, type = 'success') {
        const container = $('#toast-container');

        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'status');

        const icon = type === 'error' ? '!' : '✓';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${escapeHTML(message)}</span>
        `;

        container.appendChild(toast);

        if (animations) {
            animations.animateModal(toast);
        }

        window.setTimeout(() => {
            toast.remove();
        }, 3500);
    }

    function setConnectionStatus(connected, message = '') {
        const element = $('#connection-status');

        if (!element) return;

        element.classList.toggle('connected', connected);

        element.textContent = message || (
            connected ? 'Connected' : 'Not connected'
        );
    }

    // ==========================================
    // 3. DATA ACCESS
    // ==========================================

    function getCollection(entity) {
        const collection = data?.[entity];

        if (!collection) {
            throw new Error(`Unknown data collection: ${entity}`);
        }

        return collection;
    }

    async function loadCollection(entity) {
        const collection = getCollection(entity);

        if (typeof collection.getAll !== 'function') {
            throw new Error(`${entity} does not support getAll().`);
        }

        const result = await collection.getAll();

        if (!Array.isArray(result)) {
            throw new Error(`Invalid ${entity} response from the data layer.`);
        }

        state[entity] = result;

        return result;
    }

    async function loadAllData() {
         if (!data) {
        throw new Error('StudyVaultData is not available.');
    }

    const result = await data.initialize();

    state.books = result.books;
    state.chapters = result.chapters;
    state.topics = result.topics;
    state.notes = result.notes;

    state.initialized = true;

    setConnectionStatus(true);
    renderApplication();
}
    async function refreshData() {
        try {
            await loadAllData();
            showToast('Data refreshed successfully.');
        } catch (error) {
            console.error('Refresh error:', error);
            showToast(error.message || 'Unable to refresh data.', 'error');
        }
    }

    // ==========================================
    // 4. NAVIGATION
    // ==========================================

    function navigateTo(pageName) {
        const page = $(`#${pageName}-page`);

        if (!page) return;

        state.currentPage = pageName;

        $$('.page-section').forEach(section => {
            section.classList.toggle(
                'active',
                section.id === `${pageName}-page`
            );
        });

        $$('[data-page]').forEach(link => {
            link.classList.toggle(
                'active',
                link.dataset.page === pageName
            );
        });

        const titleElement = $('#page-title');

        if (titleElement) {
            const titles = {
                dashboard: 'Dashboard',
                books: 'My Books',
                chapters: 'Chapters',
                topics: 'Topics',
                notes: 'My Notes',
                progress: 'Study Progress'
            };

            titleElement.textContent = titles[pageName] || pageName;
        }

        if (animations) {
            animations.animatePage(page);
        }

        closeSidebar();
    }

    function openSidebar() {
        const sidebar = $('.sidebar');
        const backdrop = $('.sidebar-backdrop');

        if (!sidebar) return;

        sidebar.classList.add('open');

        if (backdrop) {
            backdrop.classList.add('active');
        }

        if (animations) {
            animations.animateSidebar(sidebar);
        }
    }

    function closeSidebar() {
        const sidebar = $('.sidebar');
        const backdrop = $('.sidebar-backdrop');

        sidebar?.classList.remove('open');
        backdrop?.classList.remove('active');
    }

    function initializeNavigation() {
        document.addEventListener('click', event => {
            const link = event.target.closest('[data-page]');

            if (link) {
                event.preventDefault();
                navigateTo(link.dataset.page);
            }
        });

        $('#menu-toggle')?.addEventListener('click', openSidebar);
        $('#sidebar-close')?.addEventListener('click', closeSidebar);

        // Create a mobile backdrop if the HTML does not contain one.
        if ($('.sidebar') && !$('.sidebar-backdrop')) {
            const backdrop = document.createElement('div');

            backdrop.className = 'sidebar-backdrop';
            backdrop.addEventListener('click', closeSidebar);

            document.body.appendChild(backdrop);
        }
    }

    // ==========================================
    // 5. MODAL SYSTEM
    // ==========================================

    function openModal({
        title,
        eyebrow = 'STUDYVAULT',
        body,
        submitText = 'Save',
        entity = null,
        recordId = null
    }) {
        const overlay = $('#modal-overlay');
        const titleElement = $('#modal-title');
        const eyebrowElement = $('#modal-eyebrow');
        const bodyElement = $('#modal-body');
        const submitButton = $('#modal-submit');

        if (!overlay || !bodyElement) {
            showToast('Modal elements are missing from index.html.', 'error');
            return;
        }

        state.currentEntity = entity;
        state.currentRecordId = recordId;

        if (titleElement) titleElement.textContent = title;
        if (eyebrowElement) eyebrowElement.textContent = eyebrow;
        if (submitButton) submitButton.textContent = submitText;

        bodyElement.innerHTML = body;

        overlay.hidden = false;
        overlay.style.display = 'flex';
        overlay.classList.add('active');

        if (animations) {
            animations.animateModal('#modal-container');
        }

        const firstInput = $('input, textarea, select', bodyElement);

        if (firstInput) {
            window.setTimeout(() => firstInput.focus(), 100);
        }
    }

    async function closeModal() {
        const overlay = $('#modal-overlay');

        if (!overlay) return;

        if (animations && $('#modal-container')) {
            await animations.closeModal('#modal-container');
        }

        overlay.classList.remove('active');
        overlay.style.display = 'none';
        overlay.hidden = true;

        state.currentEntity = null;
        state.currentRecordId = null;

        const body = $('#modal-body');

        if (body) body.innerHTML = '';
    }

    function initializeModal() {
        $('#modal-close')?.addEventListener('click', closeModal);
        $('#modal-cancel')?.addEventListener('click', closeModal);

        $('#modal-overlay')?.addEventListener('click', event => {
            if (event.target.id === 'modal-overlay') {
                closeModal();
            }
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                closeModal();
            }
        });

        $('#modal-submit')?.addEventListener('click', submitModal);
    }

    // ==========================================
    // 6. FORM HELPERS
    // ==========================================

    function inputField({
        label,
        name,
        value = '',
        placeholder = '',
        required = false,
        type = 'text'
    }) {
        return `
            <div class="form-group">
                <label for="form-${escapeHTML(name)}">
                    ${escapeHTML(label)}
                </label>

                <input
                    id="form-${escapeHTML(name)}"
                    name="${escapeHTML(name)}"
                    type="${escapeHTML(type)}"
                    value="${escapeHTML(value)}"
                    placeholder="${escapeHTML(placeholder)}"
                    ${required ? 'required' : ''}
                >
            </div>
        `;
    }

    function textareaField({
        label,
        name,
        value = '',
        placeholder = ''
    }) {
        return `
            <div class="form-group">
                <label for="form-${escapeHTML(name)}">
                    ${escapeHTML(label)}
                </label>

                <textarea
                    id="form-${escapeHTML(name)}"
                    name="${escapeHTML(name)}"
                    rows="4"
                    placeholder="${escapeHTML(placeholder)}"
                >${escapeHTML(value)}</textarea>
            </div>
        `;
    }

    function selectField({
        label,
        name,
        options,
        selected = ''
    }) {
        return `
            <div class="form-group">
                <label for="form-${escapeHTML(name)}">
                    ${escapeHTML(label)}
                </label>

                <select
                    id="form-${escapeHTML(name)}"
                    name="${escapeHTML(name)}"
                    required
                >
                    <option value="">Select ${escapeHTML(label)}</option>

                    ${options.map(option => `
                        <option
                            value="${escapeHTML(option.value)}"
                            ${option.value === selected ? 'selected' : ''}
                        >
                            ${escapeHTML(option.label)}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    // ==========================================
    // 7. BOOKS
    // ==========================================

    function bookForm(record = {}) {
        return `
            ${inputField({
                label: 'Book Title',
                name: 'title',
                value: record.title || '',
                placeholder: 'Enter book title',
                required: true
            })}

            ${inputField({
                label: 'Subject',
                name: 'subject',
                value: record.subject || '',
                placeholder: 'e.g. Mathematics',
                required: true
            })}

            ${textareaField({
                label: 'Description',
                name: 'description',
                value: record.description || '',
                placeholder: 'Write a short description...'
            })}
        `;
    }

    function openBookForm(record = null) {
        openModal({
            title: record ? 'Edit Book' : 'Add New Book',
            eyebrow: 'MY LIBRARY',
            body: bookForm(record || {}),
            submitText: record ? 'Update Book' : 'Create Book',
            entity: 'books',
            recordId: record?.id || null
        });
    }

    function renderBooks() {
        const container = $('#books-grid');

        if (!container) return;

        const search = ($('#book-search')?.value || '').toLowerCase();
        const subject = $('#book-subject-filter')?.value || '';

        const filtered = state.books.filter(book => {
            const matchesSearch = [
                book.title,
                book.subject,
                book.description
            ].some(value =>
                String(value || '').toLowerCase().includes(search)
            );

            const matchesSubject = !subject || book.subject === subject;

            return matchesSearch && matchesSubject;
        });

        if (!filtered.length) {
            container.innerHTML = emptyState(
                'No books found',
                'Add a book to start building your study library.'
            );
            return;
        }

        container.innerHTML = filtered.map(book => {
            const chapters = state.chapters.filter(
                chapter => chapter.bookId === book.id
            );

            const topics = state.topics.filter(
                topic => topic.bookId === book.id
            );

            const completed = topics.filter(
                topic => topic.status === 'completed'
            ).length;

            const progress = getProgress(topics.length, completed);

            return `
                <article class="book-card">
                    <div class="card-top">
                        <span class="book-subject">
                            ${escapeHTML(book.subject || 'General')}
                        </span>

                        <div class="card-actions">
                            <button
                                type="button"
                                data-action="edit-book"
                                data-id="${escapeHTML(book.id)}"
                                aria-label="Edit book"
                            >Edit</button>

                            <button
                                type="button"
                                data-action="delete-book"
                                data-id="${escapeHTML(book.id)}"
                                aria-label="Delete book"
                            >Delete</button>
                        </div>
                    </div>

                    <h3>${escapeHTML(getRecordTitle(book))}</h3>

                    <p>${escapeHTML(book.description || 'No description added.')}</p>

                    <div class="book-meta">
                        <span>${chapters.length} Chapters</span>
                        <span>${topics.length} Topics</span>
                    </div>

                    <div class="progress-track">
                        <div
                            class="progress-fill"
                            style="width: ${progress}%"
                        ></div>
                    </div>

                    <div class="progress-label">
                        <span>Progress</span>
                        <strong>${progress}%</strong>
                    </div>
                </article>
            `;
        }).join('');

        if (animations) animations.animateCards(container);
        updateSubjectFilter();
    }

    function updateSubjectFilter() {
        const select = $('#book-subject-filter');

        if (!select) return;

        const currentValue = select.value;

        const subjects = [...new Set(
            state.books.map(book => book.subject).filter(Boolean)
        )];

        select.innerHTML = `
            <option value="">All Subjects</option>
            ${subjects.map(subject => `
                <option value="${escapeHTML(subject)}">
                    ${escapeHTML(subject)}
                </option>
            `).join('')}
        `;

        select.value = subjects.includes(currentValue) ? currentValue : '';
    }

    // ==========================================
    // 8. CHAPTERS
    // ==========================================

    function chapterForm(record = {}) {
        return `
            ${selectField({
                label: 'Book',
                name: 'bookId',
                selected: record.bookId || '',
                options: state.books.map(book => ({
                    value: book.id,
                    label: getRecordTitle(book)
                }))
            })}

            ${inputField({
                label: 'Chapter Title',
                name: 'title',
                value: record.title || '',
                placeholder: 'Enter chapter title',
                required: true
            })}

            ${textareaField({
                label: 'Description',
                name: 'description',
                value: record.description || '',
                placeholder: 'Chapter details...'
            })}
        `;
    }

    function openChapterForm(record = null) {
        if (!state.books.length) {
            showToast('Create a book before adding a chapter.', 'error');
            return;
        }

        openModal({
            title: record ? 'Edit Chapter' : 'Add New Chapter',
            eyebrow: 'CHAPTER MANAGEMENT',
            body: chapterForm(record || {}),
            submitText: record ? 'Update Chapter' : 'Create Chapter',
            entity: 'chapters',
            recordId: record?.id || null
        });
    }

    function renderChapters() {
        const container = $('#chapters-list');

        if (!container) return;

        const search = ($('#chapter-search')?.value || '').toLowerCase();
        const selectedBook = $('#chapter-book-filter')?.value || '';

        const filtered = state.chapters.filter(chapter => {
            const matchesSearch = getRecordTitle(chapter)
                .toLowerCase()
                .includes(search);

            const matchesBook = !selectedBook ||
                chapter.bookId === selectedBook;

            return matchesSearch && matchesBook;
        });

        if (!filtered.length) {
            container.innerHTML = emptyState(
                'No chapters found',
                'Add chapters to organize your books.'
            );
            return;
        }

        container.innerHTML = filtered.map(chapter => {
            const book = findRecord(state.books, chapter.bookId);

            const topicCount = state.topics.filter(
                topic => topic.chapterId === chapter.id
            ).length;

            return `
                <article class="chapter-card">
                    <div>
                        <span class="chapter-book">
                            ${escapeHTML(getRecordTitle(book))}
                        </span>

                        <h3>${escapeHTML(getRecordTitle(chapter))}</h3>

                        <p>${escapeHTML(chapter.description || '')}</p>

                        <span>${topicCount} Topics</span>
                    </div>

                    <div class="card-actions">
                        <button
                            type="button"
                            data-action="edit-chapter"
                            data-id="${escapeHTML(chapter.id)}"
                        >Edit</button>

                        <button
                            type="button"
                            data-action="delete-chapter"
                            data-id="${escapeHTML(chapter.id)}"
                        >Delete</button>
                    </div>
                </article>
            `;
        }).join('');

        if (animations) animations.animateCards(container);
        updateChapterBookFilter();
    }

    function updateChapterBookFilter() {
        const select = $('#chapter-book-filter');

        if (!select) return;

        const currentValue = select.value;

        select.innerHTML = `
            <option value="">All Books</option>
            ${state.books.map(book => `
                <option value="${escapeHTML(book.id)}">
                    ${escapeHTML(getRecordTitle(book))}
                </option>
            `).join('')}
        `;

        select.value = state.books.some(book => book.id === currentValue)
            ? currentValue
            : '';
    }

    // ==========================================
    // 9. TOPICS
    // ==========================================

    function topicForm(record = {}) {
        const bookId = record.bookId || '';

        const chapters = state.chapters.filter(
            chapter => !bookId || chapter.bookId === bookId
        );

        return `
            ${selectField({
                label: 'Book',
                name: 'bookId',
                selected: bookId,
                options: state.books.map(book => ({
                    value: book.id,
                    label: getRecordTitle(book)
                }))
            })}

            ${selectField({
                label: 'Chapter',
                name: 'chapterId',
                selected: record.chapterId || '',
                options: chapters.map(chapter => ({
                    value: chapter.id,
                    label: getRecordTitle(chapter)
                }))
            })}

            ${inputField({
                label: 'Topic Title',
                name: 'title',
                value: record.title || '',
                placeholder: 'Enter topic title',
                required: true
            })}

            ${selectField({
                label: 'Status',
                name: 'status',
                selected: record.status || 'not-started',
                options: [
                    { value: 'not-started', label: 'Not Started' },
                    { value: 'in-progress', label: 'In Progress' },
                    { value: 'completed', label: 'Completed' }
                ]
            })}

            ${textareaField({
                label: 'Details',
                name: 'description',
                value: record.description || '',
                placeholder: 'Add topic details...'
            })}
        `;
    }

    function openTopicForm(record = null) {
        if (!state.books.length) {
            showToast('Create a book before adding a topic.', 'error');
            return;
        }

        if (!state.chapters.length) {
            showToast('Create a chapter before adding a topic.', 'error');
            return;
        }

        openModal({
            title: record ? 'Edit Topic' : 'Add New Topic',
            eyebrow: 'TOPIC MANAGEMENT',
            body: topicForm(record || {}),
            submitText: record ? 'Update Topic' : 'Create Topic',
            entity: 'topics',
            recordId: record?.id || null
        });

        const bookSelect = $('[name="bookId"]', $('#modal-body'));

        bookSelect?.addEventListener('change', () => {
            const chapterSelect = $('[name="chapterId"]', $('#modal-body'));

            if (!chapterSelect) return;

            const chapters = state.chapters.filter(
                chapter => chapter.bookId === bookSelect.value
            );

            chapterSelect.innerHTML = `
                <option value="">Select Chapter</option>
                ${chapters.map(chapter => `
                    <option value="${escapeHTML(chapter.id)}">
                        ${escapeHTML(getRecordTitle(chapter))}
                    </option>
                `).join('')}
            `;
        });
    }

    function renderTopics() {
        const container = $('#topics-list');

        if (!container) return;

        const search = ($('#topic-search')?.value || '').toLowerCase();
        const selectedBook = $('#topic-book-filter')?.value || '';
        const selectedChapter = $('#topic-chapter-filter')?.value || '';
        const selectedStatus = $('#topic-status-filter')?.value || '';

        const filtered = state.topics.filter(topic => {
            const matchesSearch = getRecordTitle(topic)
                .toLowerCase()
                .includes(search);

            const matchesBook = !selectedBook ||
                topic.bookId === selectedBook;

            const matchesChapter = !selectedChapter ||
                topic.chapterId === selectedChapter;

            const matchesStatus = !selectedStatus ||
                topic.status === selectedStatus;

            return matchesSearch &&
                matchesBook &&
                matchesChapter &&
                matchesStatus;
        });

        if (!filtered.length) {
            container.innerHTML = emptyState(
                'No topics found',
                'Create a topic to start tracking your learning.'
            );
            return;
        }

        container.innerHTML = filtered.map(topic => {
            const chapter = findRecord(state.chapters, topic.chapterId);
            const status = topic.status || 'not-started';

            return `
                <article class="topic-card">
                    <div class="topic-card-content">
                        <span class="topic-status ${escapeHTML(status)}">
                            ${escapeHTML(status.replace('-', ' '))}
                        </span>

                        <h3>${escapeHTML(getRecordTitle(topic))}</h3>

                        <p>${escapeHTML(getRecordTitle(chapter))}</p>

                        <p>${escapeHTML(topic.description || '')}</p>
                    </div>

                    <div class="card-actions">
                        <button
                            type="button"
                            data-action="edit-topic"
                            data-id="${escapeHTML(topic.id)}"
                        >Edit</button>

                        <button
                            type="button"
                            data-action="delete-topic"
                            data-id="${escapeHTML(topic.id)}"
                        >Delete</button>
                    </div>
                </article>
            `;
        }).join('');

        if (animations) animations.animateCards(container);
        updateTopicFilters();
    }

    function updateTopicFilters() {
        const bookSelect = $('#topic-book-filter');
        const chapterSelect = $('#topic-chapter-filter');

        if (bookSelect) {
            const currentBook = bookSelect.value;

            bookSelect.innerHTML = `
                <option value="">All Books</option>
                ${state.books.map(book => `
                    <option value="${escapeHTML(book.id)}">
                        ${escapeHTML(getRecordTitle(book))}
                    </option>
                `).join('')}
            `;

            bookSelect.value = currentBook;
        }

        if (chapterSelect) {
            const currentChapter = chapterSelect.value;
            const selectedBook = bookSelect?.value || '';

            const chapters = state.chapters.filter(
                chapter => !selectedBook || chapter.bookId === selectedBook
            );

            chapterSelect.innerHTML = `
                <option value="">All Chapters</option>
                ${chapters.map(chapter => `
                    <option value="${escapeHTML(chapter.id)}">
                        ${escapeHTML(getRecordTitle(chapter))}
                    </option>
                `).join('')}
            `;

            chapterSelect.value = currentChapter;
        }
    }

    // ==========================================
    // 10. NOTES
    // ==========================================

    function noteForm(record = {}) {
        return `
            ${inputField({
                label: 'Note Title',
                name: 'title',
                value: record.title || '',
                placeholder: 'Enter note title',
                required: true
            })}

            ${selectField({
                label: 'Book',
                name: 'bookId',
                selected: record.bookId || '',
                options: state.books.map(book => ({
                    value: book.id,
                    label: getRecordTitle(book)
                }))
            })}

            ${textareaField({
                label: 'Note Content',
                name: 'content',
                value: record.content || '',
                placeholder: 'Write your study notes here...'
            })}
        `;
    }

    function openNoteForm(record = null) {
        openModal({
            title: record ? 'Edit Note' : 'Create New Note',
            eyebrow: 'MY NOTES',
            body: noteForm(record || {}),
            submitText: record ? 'Update Note' : 'Save Note',
            entity: 'notes',
            recordId: record?.id || null
        });
    }

    function renderNotes() {
        const container = $('#notes-grid');

        if (!container) return;

        const search = ($('#notes-search')?.value || '').toLowerCase();
        const selectedBook = $('#notes-book-filter')?.value || '';

        const filtered = state.notes.filter(note => {
            const matchesSearch = [
                note.title,
                note.content
            ].some(value =>
                String(value || '').toLowerCase().includes(search)
            );

            const matchesBook = !selectedBook ||
                note.bookId === selectedBook;

            return matchesSearch && matchesBook;
        });

        if (!filtered.length) {
            container.innerHTML = emptyState(
                'No notes found',
                'Create notes to keep important study information together.'
            );
            return;
        }

        container.innerHTML = filtered.map(note => {
            const book = findRecord(state.books, note.bookId);

            return `
                <article class="note-card">
                    <div class="card-actions">
                        <button
                            type="button"
                            data-action="edit-note"
                            data-id="${escapeHTML(note.id)}"
                        >Edit</button>

                        <button
                            type="button"
                            data-action="delete-note"
                            data-id="${escapeHTML(note.id)}"
                        >Delete</button>
                    </div>

                    <h3>${escapeHTML(getRecordTitle(note))}</h3>

                    <p>${escapeHTML(note.content || '')}</p>

                    <div class="note-meta">
                        <span>${escapeHTML(getRecordTitle(book))}</span>
                        <span>${escapeHTML(formatDate(note.updatedAt || note.createdAt))}</span>
                    </div>
                </article>
            `;
        }).join('');

        if (animations) animations.animateCards(container);
        updateNoteBookFilter();
    }

    function updateNoteBookFilter() {
        const select = $('#notes-book-filter');

        if (!select) return;

        const currentValue = select.value;

        select.innerHTML = `
            <option value="">All Books</option>
            ${state.books.map(book => `
                <option value="${escapeHTML(book.id)}">
                    ${escapeHTML(getRecordTitle(book))}
                </option>
            `).join('')}
        `;

        select.value = currentValue;
    }

    // ==========================================
    // 11. DASHBOARD
    // ==========================================

    function setText(selector, value) {
        const element = $(selector);

        if (element) {
            element.textContent = String(value);
        }
    }

    function renderDashboard() {
        const totalBooks = state.books.length;
        const totalChapters = state.chapters.length;
        const totalTopics = state.topics.length;

        const completedTopics = state.topics.filter(
            topic => topic.status === 'completed'
        ).length;

        const remainingTopics = totalTopics - completedTopics;

        const progress = getProgress(totalTopics, completedTopics);

        setText('#stat-total-books', totalBooks);
        setText('#stat-total-chapters', totalChapters);
        setText('#stat-total-topics', totalTopics);
        setText('#stat-completed-topics', completedTopics);

        setText('#overall-progress-value', `${progress}%`);
        setText('#progress-completed', completedTopics);
        setText('#progress-remaining', remainingTopics);

        const circle = $('#overall-progress-circle');

        if (circle) {
            circle.style.setProperty('--progress', `${progress}%`);
        }

        renderContinueStudying();
        renderDashboardBooks();
        renderRecentlyUpdated();
    }

    function renderContinueStudying() {
        const container = $('#continue-studying-list');

        if (!container) return;

        const topics = state.topics.filter(
            topic => topic.status === 'in-progress'
        ).slice(0, 4);

        if (!topics.length) {
            container.innerHTML = emptyState(
                'Nothing in progress',
                'Topics you start studying will appear here.'
            );
            return;
        }

        container.innerHTML = topics.map(topic => {
            const book = findRecord(state.books, topic.bookId);

            return `
                <div class="continue-item">
                    <div>
                        <h4>${escapeHTML(getRecordTitle(topic))}</h4>
                        <p>${escapeHTML(getRecordTitle(book))}</p>
                    </div>

                    <button
                        type="button"
                        data-action="edit-topic"
                        data-id="${escapeHTML(topic.id)}"
                    >Continue</button>
                </div>
            `;
        }).join('');
    }

    function renderDashboardBooks() {
        const container = $('#dashboard-books-grid');

        if (!container) return;

        const books = state.books.slice(0, 4);

        if (!books.length) {
            container.innerHTML = emptyState(
                'Your library is empty',
                'Add your first book to get started.'
            );
            return;
        }

        container.innerHTML = books.map(book => {
            const topics = state.topics.filter(
                topic => topic.bookId === book.id
            );

            const completed = topics.filter(
                topic => topic.status === 'completed'
            ).length;

            const progress = getProgress(topics.length, completed);

            return `
                <article class="book-card">
                    <span>${escapeHTML(book.subject || 'General')}</span>

                    <h3>${escapeHTML(getRecordTitle(book))}</h3>

                    <div class="progress-track">
                        <div
                            class="progress-fill"
                            style="width: ${progress}%"
                        ></div>
                    </div>

                    <div class="progress-label">
                        <span>${completed} of ${topics.length} completed</span>
                        <strong>${progress}%</strong>
                    </div>
                </article>
            `;
        }).join('');

        if (animations) animations.animateCards(container);
    }

    function renderRecentlyUpdated() {
        const container = $('#recently-updated-list');

        if (!container) return;

        const records = [
            ...state.books,
            ...state.chapters,
            ...state.topics,
            ...state.notes
        ];

        records.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt || 0);
            const dateB = new Date(b.updatedAt || b.createdAt || 0);

            return dateB - dateA;
        });

        const recent = records.slice(0, 5);

        if (!recent.length) {
            container.innerHTML = emptyState(
                'No recent activity',
                'Your recently updated study materials will appear here.'
            );
            return;
        }

        container.innerHTML = recent.map(record => `
            <div class="recent-item">
                <div>
                    <h4>${escapeHTML(getRecordTitle(record))}</h4>
                    <p>${escapeHTML(formatDate(record.updatedAt || record.createdAt))}</p>
                </div>
            </div>
        `).join('');
    }

    // ==========================================
    // 12. STUDY PROGRESS PAGE
    // ==========================================

    function renderProgress() {
        const container = $('#book-progress-list');

        if (!container) return;

        const totalTopics = state.topics.length;

        const completedTopics = state.topics.filter(
            topic => topic.status === 'completed'
        ).length;

        const inProgressTopics = state.topics.filter(
            topic => topic.status === 'in-progress'
        ).length;

        const notStartedTopics = state.topics.filter(
            topic => !topic.status || topic.status === 'not-started'
        ).length;

        setText('#progress-total-books', state.books.length);
        setText('#progress-total-chapters', state.chapters.length);
        setText('#progress-total-topics', totalTopics);
        setText('#progress-completed-topics', completedTopics);
        setText('#progress-in-progress-topics', inProgressTopics);
        setText('#progress-not-started-topics', notStartedTopics);

        if (!container) return;

        if (!state.books.length) {
            container.innerHTML = emptyState(
                'No progress to show',
                'Add books and topics to track your progress.'
            );
            return;
        }

        container.innerHTML = state.books.map(book => {
            const topics = state.topics.filter(
                topic => topic.bookId === book.id
            );

            const completed = topics.filter(
                topic => topic.status === 'completed'
            ).length;

            const progress = getProgress(topics.length, completed);

            return `
                <div class="book-progress-item">
                    <div>
                        <h4>${escapeHTML(getRecordTitle(book))}</h4>
                        <span>${completed} / ${topics.length} topics completed</span>
                    </div>

                    <div class="progress-track">
                        <div
                            class="progress-fill"
                            style="width: ${progress}%"
                        ></div>
                    </div>

                    <strong>${progress}%</strong>
                </div>
            `;
        }).join('');
    }

    // ==========================================
    // 13. EMPTY STATE
    // ==========================================

    function emptyState(title, description) {
        return `
            <div class="empty-state">
                <h3>${escapeHTML(title)}</h3>
                <p>${escapeHTML(description)}</p>
            </div>
        `;
    }

    // ==========================================
    // 14. CREATE / UPDATE
    // ==========================================

    function getFormPayload() {
        const form = $('#modal-body');

        if (!form) return null;

        const payload = {};

        $$('input[name], textarea[name], select[name]', form)
            .forEach(field => {
                payload[field.name] = field.value.trim();
            });

        return payload;
    }

    async function submitModal() {
        const entity = state.currentEntity;

        if (!entity) {
            showToast('No active form found.', 'error');
            return;
        }

        const payload = getFormPayload();

        if (!payload) return;

        const collection = getCollection(entity);
        const submitButton = $('#modal-submit');

        if (submitButton) submitButton.disabled = true;

        try {
            if (state.currentRecordId) {
                await collection.update(state.currentRecordId, payload);
                showToast('Updated successfully.');
            } else {
                await collection.create(payload);
                showToast('Created successfully.');
            }

            await loadAllData();
            await closeModal();

        } catch (error) {
            console.error(`${entity} save error:`, error);

            showToast(
                error.message || 'Unable to save. Please try again.',
                'error'
            );
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    }

    // ==========================================
    // 15. DELETE OPERATIONS
    // ==========================================

    async function deleteRecord(entity, id) {
        const collection = getCollection(entity);

        const record = findRecord(state[entity], id);

        if (!record) {
            showToast('Record not found.', 'error');
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to delete "${getRecordTitle(record)}"?`
        );

        if (!confirmed) return;

        try {
            await collection.remove(id);

            await loadAllData();

            showToast('Deleted successfully.');

        } catch (error) {
            console.error(`${entity} delete error:`, error);

            showToast(
                error.message || 'Unable to delete this record.',
                'error'
            );
        }
    }

    // ==========================================
    // 16. ACTION HANDLER
    // ==========================================

    document.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');

        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        switch (action) {
            case 'add-book':
                openBookForm();
                break;

            case 'add-chapter':
                openChapterForm();
                break;

            case 'add-topic':
                openTopicForm();
                break;

            case 'add-note':
                openNoteForm();
                break;

            case 'edit-book':
                openBookForm(findRecord(state.books, id));
                break;

            case 'edit-chapter':
                openChapterForm(findRecord(state.chapters, id));
                break;

            case 'edit-topic':
                openTopicForm(findRecord(state.topics, id));
                break;

            case 'edit-note':
                openNoteForm(findRecord(state.notes, id));
                break;

            case 'delete-book':
                deleteRecord('books', id);
                break;

            case 'delete-chapter':
                deleteRecord('chapters', id);
                break;

            case 'delete-topic':
                deleteRecord('topics', id);
                break;

            case 'delete-note':
                deleteRecord('notes', id);
                break;
        }
    });

    // ==========================================
    // 17. SEARCH AND FILTER EVENTS
    // ==========================================

    function initializeSearchAndFilters() {
        const searchInputs = [
            '#book-search',
            '#chapter-search',
            '#topic-search',
            '#notes-search'
        ];

        searchInputs.forEach(selector => {
            $(selector)?.addEventListener('input', () => {
                renderBooks();
                renderChapters();
                renderTopics();
                renderNotes();
            });
        });

        const filters = [
            '#book-subject-filter',
            '#chapter-book-filter',
            '#topic-book-filter',
            '#topic-chapter-filter',
            '#topic-status-filter',
            '#notes-book-filter'
        ];

        filters.forEach(selector => {
            $(selector)?.addEventListener('change', () => {
                renderBooks();
                renderChapters();
                renderTopics();
                renderNotes();
            });
        });
    }

    // ==========================================
    // 18. GLOBAL SEARCH
    // ==========================================

    function initializeGlobalSearch() {
        const search = $('#global-search');

        if (!search) return;

        search.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;

            const query = search.value.trim().toLowerCase();

            if (!query) return;

            const matches = [
                ...state.books.map(record => ({
                    ...record,
                    entity: 'books'
                })),
                ...state.chapters.map(record => ({
                    ...record,
                    entity: 'chapters'
                })),
                ...state.topics.map(record => ({
                    ...record,
                    entity: 'topics'
                })),
                ...state.notes.map(record => ({
                    ...record,
                    entity: 'notes'
                }))
            ].filter(record => [
                record.title,
                record.subject,
                record.content,
                record.description
            ].some(value =>
                String(value || '').toLowerCase().includes(query)
            ));

            if (!matches.length) {
                showToast('No matching results found.', 'error');
                return;
            }

            const firstMatch = matches[0];

            navigateTo(firstMatch.entity);

            search.blur();
            showToast(`${matches.length} matching result(s) found.`);
        });
    }

    // ==========================================
    // 19. APPLICATION RENDERING
    // ==========================================

    function renderApplication() {
        renderDashboard();
        renderBooks();
        renderChapters();
        renderTopics();
        renderNotes();
        renderProgress();
    }

    // ==========================================
    // 20. INITIALIZATION
    // ==========================================

    function initializeEventListeners() {
        initializeNavigation();
        initializeModal();
        initializeSearchAndFilters();
        initializeGlobalSearch();

        $('#refresh-button')?.addEventListener('click', refreshData);
    }

    async function initializeApplication() {
        if (state.initialized) return;

        initializeEventListeners();

        try {
            await loadAllData();

            showToast('StudyVault is ready.');

        } catch (error) {
            console.error('StudyVault initialization error:', error);

            setConnectionStatus(false);

            renderApplication();

            if (error.code === 'BACKEND_NOT_CONFIGURED') {
                showToast(
                    'Backend is not configured yet. Complete the Google Apps Script setup later.',
                    'error'
                );
            } else {
                showToast(
                    error.message || 'Unable to load StudyVault data.',
                    'error'
                );
            }
        }
    }

    // Start the application.
    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            initializeApplication,
            { once: true }
        );
    } else {
        initializeApplication();
    }

})();
