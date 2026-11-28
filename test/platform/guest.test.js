/**
 * Walks through the mobile interface with local data and network access made unavailable. "Guest"
 * is historical terminology: everyone can use this standalone app without an Too Many Watts account.
 * Checks local library, calendar, Coach, settings, recording actions and remembered expanded
 * sections.
 */

/** @jest-environment jsdom */
import { launchPlatform } from '../../src/platform/ui.js';
import { coachingService } from '../../src/coaching/service.js';
import { xf } from '../../src/functions.js';

/**
 * Replace engine startup with its ready announcement and provide controlled model/service data.
 * This exercises real platform rendering without connecting hardware or restoring a real browser
 * database.
 */
jest.mock('../../src/index.js', () => {
    queueMicrotask(() => globalThis.window.dispatchEvent(new CustomEvent('app:ready')));
    return {};
});
jest.mock('../../src/db.js', () => ({db: {
    ftp: 250, weight: 75, elapsed: 0, lapTime: 0, intervalIndex: 0, stepIndex: 0,
    power1s: 0, powerTarget: 200, heartRate: 0, cadence: 0, mode: 'erg',
    watchStatus: 'stopped', activity: [{id: 'original-ride', name: 'Original FIT ride', duration: 600,
        timestamp: Date.now(), powerProfile: [100, 150, 200]}],
    workout: {meta: {name: 'Free ride'}, intervals: []},
    workouts: [{id: 'local', meta: {name: 'Local workout', duration: 600}, intervals: []}],
}}));
jest.mock('../../src/coaching/service.js', () => ({
    coachingData: () => ({activities: [], profile: null, plan: null}),
    coachingService: jest.fn(() => ({advance: jest.fn().mockResolvedValue()})),
}));
jest.mock('../../src/models/models.js', () => ({models: {ftp: {toAbsolute: (v, ftp) => v * ftp}}}));
jest.mock('../../src/functions.js', () => {
    const actual = jest.requireActual('../../src/functions.js');
    return {...actual, xf: {...actual.xf, dispatch: jest.fn(actual.xf.dispatch)}};
});

/**
 * Drain a bounded number of queued promise callbacks after navigation/actions before checking their
 * visible results.
 */
const settle = async () => { for(let i = 0; i < 15; i++) await Promise.resolve(); };
/**
 * Change the mobile hash route, announce the navigation event and wait for the page's asynchronous
 * updates.
 */
const go = async route => {
    window.history.replaceState({}, '', `/mobile#/${route}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await settle();
};

test('mobile guests can ride and use local features without a backend version display', async () => {
    window.innerWidth = 390;
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = jest.fn(() => Promise.reject(new Error('Offline')));
    window.history.replaceState({}, '', '/mobile');
    document.body.innerHTML = '<div id="platform"></div><div class="wrapper" hidden><training-calendar></training-calendar></div>';
    const calendar = document.querySelector('training-calendar');
    calendar.entriesForDate = () => [];
    calendar.plannedWorkouts = [];
    calendar.loadPlannedMonth = jest.fn();
    const root = document.querySelector('#platform');
    await launchPlatform(root, null);
    await settle();
    expect(root.querySelector('.app-versions')).toBeNull();
    expect(root.textContent).not.toContain('On-device only');
    expect(root.querySelector('.account-menu')).toBeNull();
    expect(root.querySelector('[data-action="signin"]')).toBeNull();
    expect(root.querySelector('#platform-content a[href="#/library"]')).not.toBeNull();
    await go('library');
    expect(root.textContent).toContain('Local workout');
    expect(root.querySelector('#platform-upload')).not.toBeNull();
    const filters = root.querySelector('[data-mobile-details="library-filters"]');
    expect(filters.open).toBe(false);
    expect(root.querySelector('#workout-search').closest('details')).toBeNull();
    filters.open = true;
    filters.dispatchEvent(new Event('toggle'));
    await go('dashboard');
    await go('library');
    expect(root.querySelector('[data-mobile-details="library-filters"]').open).toBe(true);
    await go('calendar');
    expect(document.querySelector('.wrapper').hidden).toBe(false);
    await go('coach');
    expect(root.textContent).toContain('on-device Coach');
    await go('devices');
    expect(document.body.dataset.route).toBe('settings');
    expect(root.textContent).toContain('Pair the trainer and sensors that power your ride');
    expect(root.querySelectorAll('[data-device]')).toHaveLength(4);
    await go('settings');
    expect(root.textContent).toContain('stored only on this device');
    expect(root.querySelector('#profile-form')).not.toBeNull();
    expect(root.querySelector('[data-mobile-details="Local backup"]').open).toBe(false);
    expect(root.querySelector('#intervals-connect')).not.toBeNull();
    expect(root.querySelector('[data-action="backup"]')).not.toBeNull();
    expect(root.querySelector('#delete-account')).toBeNull();
    await go('player');
    root.querySelector('[data-action="ride-toggle"]').click();
    await settle();
    expect(xf.dispatch).toHaveBeenCalledWith('ui:watchStart');
    expect(xf.dispatch).toHaveBeenCalledWith('ui:workoutStart');
    xf.dispatch('activity:save:success', {id: 'local-ride', duration: 60});
    await go('activities');
    expect(root.textContent).toContain('No account or upload is required');
    expect(root.textContent).toContain('Original FIT ride');
    expect(root.querySelector('[data-download="original-ride"]')).not.toBeNull();
    expect(root.querySelector('.activity-local .power-profile--recorded')).not.toBeNull();
    expect(root.querySelector('[aria-label="This week activity totals"]').textContent).toContain('1');
    await go('dashboard');
    window.dispatchEvent(new Event('focus'));
    await settle();
    expect(coachingService).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    warning.mockRestore();
});
