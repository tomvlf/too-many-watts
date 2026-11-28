/**
 * Checks the compact ride-first interface using a recovered paused ride and controlled model data.
 * Exercises More-menu keyboard focus, the exact 700/701-pixel layout boundary, preservation of
 * active controls on resize and the saved-ride summary. It checks DOM behavior, not screenshots or
 * real Bluetooth connectivity.
 */

/** @jest-environment jsdom */
import { launchPlatform } from '../../src/platform/ui.js';
import { xf } from '../../src/functions.js';
import { db } from '../../src/db.js';

/**
 * Announce engine readiness from a test double, then feed the platform fixed ride state instead of
 * starting a real ride engine.
 */
jest.mock('../../src/index.js', () => {
    queueMicrotask(() => globalThis.window.dispatchEvent(new CustomEvent('app:ready')));
    return {};
});
jest.mock('../../src/db.js', () => ({db: {
    ftp: 250, weight: 75, elapsed: 90, lapTime: 30, intervalIndex: 0, stepIndex: 0,
    power1s: 200, powerTarget: 200, heartRate: 145, cadence: 85,
    mode: 'erg', watchStatus: 'paused', activity: [], workouts: [],
    workout: {meta: {name: 'Recovered ride', duration: 600}, intervals: [{steps: [{duration: 600, power: .8}]}]},
}}));
jest.mock('../../src/coaching/service.js', () => ({
    coachingData: () => ({activities: [], profile: null, plan: null}), coachingService: () => ({data: {}, revision: 0}),
}));
jest.mock('../../src/models/models.js', () => ({models: {ftp: {toAbsolute: (v, ftp) => v * ftp}}}));
jest.mock('../../src/functions.js', () => {
    const actual = jest.requireActual('../../src/functions.js');
    return {...actual, xf: {...actual.xf, dispatch: jest.fn(actual.xf.dispatch)}};
});

/** Wait for an asynchronous route render without assuming a fixed delay under test-suite load. */
async function waitFor(predicate, timeout = 1500) {
    const start = Date.now();
    while(!predicate() && Date.now() - start < timeout) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    return predicate();
}

test('mobile has a dedicated ride-first navigation, recovered ride controls, glanceable metrics and finish summary', async () => {
    window.innerWidth = 390;
    window.history.replaceState({}, '', '/');
    document.body.innerHTML = `<div id="platform"></div><div class="wrapper" hidden>
        <training-calendar></training-calendar><div id="view--settings-settings">
            <div class="device-card"><span class="device-card--header--label">Controllable</span></div>
            <div class="device-card"><span class="device-card--header--label">Power Meter</span>
                <connection-switch id="test-power-switch"></connection-switch></div>
        </div></div>`;
    const powerSwitch = document.querySelector('#test-power-switch');
    const calendar = document.querySelector('training-calendar');
    calendar.entriesForDate = () => [];
    calendar.loadPlannedMonth = jest.fn();
    const root = document.querySelector('#platform');
    await launchPlatform(root, {email: 'rider@example.com'});
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(document.body.classList.contains('mobile-app')).toBe(true);
    expect(root.querySelector('.mobile-brand-mark').getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('.app-versions')).toBeNull();
    expect(root.querySelector('.sidebar .app-versions')).toBeNull();
    const tabLabels = () => [...root.querySelectorAll('nav > .tab')].map(tab => tab.textContent.trim());
    const activeTab = () => root.querySelector('nav > .tab.active').textContent.trim();
    const moreMenu = () => root.querySelector('#more-menu');
    expect(tabLabels()).toEqual(['Today', 'Calendar', 'Ride', 'Coach', 'More']);
    expect(moreMenu().hidden).toBe(true);
    expect([...moreMenu().querySelectorAll('a')].map(a => a.getAttribute('href')))
        .toEqual(['#/plan', '#/library', '#/activities', '#/progress', '#/settings']);
    expect(document.body.dataset.route).toBe('player');
    expect(activeTab()).toBe('Ride');
    expect(root.querySelector('nav [aria-current="page"]').textContent.trim()).toBe('Ride');
    expect(root.textContent).toContain('Ride recovered on this device');
    for(const id of ['power', 'target', 'cadence', 'hr', 'countdown', 'next', 'remaining']) {
        expect(root.querySelector(`#ride-${id}`)).not.toBeNull();
    }
    expect(root.querySelector('#ride-toggle')).toBeNull();
    expect(root.querySelector('#ride-status').textContent).toBe('Paused · pedal to resume');
    expect(powerSwitch.closest('[data-mobile-details]').open).toBe(false);
    const more = root.querySelector('[data-tab="more"]');
    more.click();
    expect(moreMenu().hidden).toBe(false);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(moreMenu().querySelector('a'));
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    expect(moreMenu().hidden).toBe(true);
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(more);
    more.click();
    moreMenu().click();
    expect(moreMenu().hidden).toBe(true);
    expect(document.activeElement).toBe(more);
    const finish = root.querySelector('[data-action="ride-finish"]');
    const hash = window.location.hash;
    xf.dispatch.mockClear();
    window.innerWidth = 701;
    window.dispatchEvent(new Event('resize'));
    await Promise.resolve();
    expect(document.body.classList.contains('mobile-app')).toBe(false);
    expect(root.querySelector('nav').textContent).toContain('Progress');
    expect(root.querySelector('nav [aria-current="page"]').textContent).toBe('Ride');
    expect(root.querySelector('.sidebar .app-versions').hidden).toBe(false);
    expect(powerSwitch.closest('[data-mobile-details]').open).toBe(true);
    expect(root.querySelector('#test-power-switch')).toBe(powerSwitch);
    expect(root.querySelector('[data-action="ride-finish"]')).toBe(finish);
    expect(window.location.hash).toBe(hash);
    expect(db.watchStatus).toBe('paused');
    expect(xf.dispatch).not.toHaveBeenCalled();
    window.innerWidth = 700;
    window.dispatchEvent(new Event('resize'));
    expect(document.body.classList.contains('mobile-app')).toBe(true);
    expect(tabLabels()).toEqual(['Today', 'Calendar', 'Ride', 'Coach', 'More']);
    expect(activeTab()).toBe('Ride');
    expect(root.querySelector('.sidebar .app-versions').hidden).toBe(true);
    expect(powerSwitch.closest('[data-mobile-details]').open).toBe(false);
    expect(root.querySelector('[data-action="ride-finish"]')).toBe(finish);
    expect(xf.dispatch).not.toHaveBeenCalled();
    const dispatch = xf.dispatch;
    dispatch.mockClear();
    root.querySelector('[data-action="ride-finish"]').click();
    await Promise.resolve();
    expect(dispatch).toHaveBeenCalledWith('ui:watchStop');
    xf.dispatch('activity:save:success', {id: 'saved', duration: 90, averagePower: 200, averageHeartRate: 145});
    await waitFor(() => document.body.dataset.route === 'activities');
    expect(document.body.dataset.route).toBe('activities');
    expect(root.textContent).toContain('Ride saved');
    expect(root.textContent).toContain('1:30');
    expect(root.textContent).toContain('200W');
    expect(activeTab()).toBe('More');
    root.querySelector('[data-tab="more"]').click();
    moreMenu().querySelector('a[href="#/settings"]').click();
    expect(moreMenu().hidden).toBe(true);
    await waitFor(() => document.body.dataset.route === 'settings');
    expect(document.body.dataset.route).toBe('settings');
    expect(activeTab()).toBe('More');
    db.elapsed = 0;
});
