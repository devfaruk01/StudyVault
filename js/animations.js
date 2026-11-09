
/**
 * StudyVault - Animation Controller
 * File: js/animations.js
 *
 * Smooth, subtle and slower animations using GSAP.
 */

const StudyVaultAnimations = (() => {
    'use strict';

    const SELECTORS = {
        page: '.page-section',
        activePage: '.page-section.active',
        cards: '.stat-card, .book-card, .topic-card, .note-card',
        modal: '#modal-container',
        sidebar: '.sidebar'
    };

    const SPEED = {
        page: 0.75,
        cards: 0.65,
        cardStagger: 0.09,
        modalOpen: 0.45,
        modalClose: 0.32,
        sidebar: 0.45,
        progress: 1.15,
        counter: 1.1
    };

    let initialized = false;

    function isGsapAvailable() {
        return typeof window.gsap !== 'undefined';
    }

    function prefersReducedMotion() {
        return window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function canAnimate() {
        return isGsapAvailable() && !prefersReducedMotion();
    }

    function initialize() {
        if (initialized) return;

        initialized = true;

        if (!canAnimate()) return;

        animateInitialPage();
    }

    function animateInitialPage() {
        const page = document.querySelector(SELECTORS.activePage);

        if (!page) return;

        window.gsap.fromTo(
            page,
            { opacity: 0, y: 14 },
            {
                opacity: 1,
                y: 0,
                duration: SPEED.page,
                ease: 'power2.out'
            }
        );

        animateCards(page);
    }

    function animatePage(target) {
        if (!canAnimate()) return;

        const page = typeof target === 'string'
            ? document.querySelector(target)
            : target;

        if (!page) return;

        window.gsap.fromTo(
            page,
            { opacity: 0, y: 12 },
            {
                opacity: 1,
                y: 0,
                duration: SPEED.page,
                ease: 'power2.out',
                clearProps: 'transform'
            }
        );

        animateCards(page);
    }

    function animateCards(container = document) {
        if (!canAnimate()) return;

        const parent = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!parent) return;

        const cards = parent.querySelectorAll(SELECTORS.cards);

        if (!cards.length) return;

        window.gsap.fromTo(
            cards,
            { opacity: 0, y: 14 },
            {
                opacity: 1,
                y: 0,
                duration: SPEED.cards,
                stagger: SPEED.cardStagger,
                ease: 'power2.out',
                clearProps: 'transform'
            }
        );
    }

    function animateModal(target = SELECTORS.modal) {
        if (!canAnimate()) return;

        const modal = typeof target === 'string'
            ? document.querySelector(target)
            : target;

        if (!modal) return;

        window.gsap.fromTo(
            modal,
            {
                opacity: 0,
                y: 18,
                scale: 0.985
            },
            {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: SPEED.modalOpen,
                ease: 'power2.out',
                clearProps: 'transform'
            }
        );
    }

    function closeModal(target = SELECTORS.modal) {
        const modal = typeof target === 'string'
            ? document.querySelector(target)
            : target;

        if (!modal) return Promise.resolve();

        if (!canAnimate()) return Promise.resolve();

        return new Promise((resolve) => {
            window.gsap.to(modal, {
                opacity: 0,
                y: 12,
                scale: 0.99,
                duration: SPEED.modalClose,
                ease: 'power2.inOut',
                onComplete: () => {
                    window.gsap.set(modal, {
                        clearProps: 'all'
                    });

                    resolve();
                }
            });
        });
    }

    function animateSidebar(target = SELECTORS.sidebar) {
        if (!canAnimate()) return;

        const sidebar = typeof target === 'string'
            ? document.querySelector(target)
            : target;

        if (!sidebar) return;

        window.gsap.fromTo(
            sidebar,
            { x: -16, opacity: 0.75 },
            {
                x: 0,
                opacity: 1,
                duration: SPEED.sidebar,
                ease: 'power2.out',
                clearProps: 'transform'
            }
        );
    }

    function animateProgress(target, percentage) {
        const element = typeof target === 'string'
            ? document.querySelector(target)
            : target;

        if (!element) return;

        const value = Math.min(100, Math.max(0, Number(percentage) || 0));

        if (!canAnimate()) {
            element.style.width = `${value}%`;
            return;
        }

        window.gsap.to(element, {
            width: `${value}%`,
            duration: SPEED.progress,
            ease: 'power2.inOut'
        });
    }

    function animateNumber(target, newValue) {
        const element = typeof target === 'string'
            ? document.querySelector(target)
            : target;

        if (!element) return;

        const value = Math.max(0, Number(newValue) || 0);

        if (!canAnimate()) {
            element.textContent = Math.round(value).toLocaleString();
            return;
        }

        const counter = { current: 0 };

        window.gsap.to(counter, {
            current: value,
            duration: SPEED.counter,
            ease: 'power2.out',
            onUpdate: () => {
                element.textContent = Math.round(
                    counter.current
                ).toLocaleString();
            }
        });
    }

    function stopAnimations(target) {
        if (!isGsapAvailable()) return;

        const element = typeof target === 'string'
            ? document.querySelector(target)
            : target;

        if (!element) return;

        window.gsap.killTweensOf(element);
    }

    return Object.freeze({
        initialize,
        animatePage,
        animateCards,
        animateModal,
        closeModal,
        animateSidebar,
        animateProgress,
        animateNumber,
        stopAnimations
    });

})();

window.StudyVaultAnimations = StudyVaultAnimations;

if (document.readyState === 'loading') {
    document.addEventListener(
        'DOMContentLoaded',
        () => StudyVaultAnimations.initialize(),
        { once: true }
    );
} else {
    StudyVaultAnimations.initialize();
}
