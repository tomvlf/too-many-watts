/**
 * Checks the full-screen ride cockpit and background session continuity: leaving the ride screen
 * never stops or pauses the session, other pages show a live return banner without re-rendering
 * forms on each tick, and the rider can return directly to the active cockpit.
 */

/** @jest-environment jsdom */
import { launchPlatform } from '../../src/platform/ui.js';
import { xf } from '../../src/functions.js';
import { db } from '../../src/db.js';

jest.mock('../../src/index.js', () => {
    queueMicrotask(() => globalThis.window.dispatchEvent(new CustomEvent('app:ready')));
    return {};
});
jest.mock('../../src/db.js', () => ({db: {
    ftp: 250, weight: 75, elapsed: 0, lapTime: 60, power1s: 180, powerTarget: 200,
    cadence: 90, heartRate: 140, mode: 'erg', watchStatus: 'stopped', workoutStatus: 'stopped',
    intervalIndex: 0, stepIndex: 0, activity: [], workouts: [],
    workout: {id: 'ride', meta: {name: 'Tempo Block', duration: 1200},
        intervals: [{duration: 1200, steps: [{duration: 1200, power: .85}]}]},
}}));
jest.mock('../../src/models/intervals.js', () => ({__esModule: true, default: {
    status: jest.fn(() => ({configured: true, connected: false, status: 'disconnected'})),
    connect: jest.fn(), sync: jest.fn(), syncProfile: jest.fn(),
}}));
jest.mock('../../src/coaching/service.js', () => ({
    coachingData: () => ({activities: [], plan: null, profile: null}),
    coachingService: () => ({data: {}, revision: 1}),
}));
jest.mock('../../src/models/models.js', () => ({models: {
    ftp: {toAbsolute: (value, ftp) => value < 9 ? Math.round(value * ftp) : value},
    activity: {},
}}));
jest.mock('../../src/functions.js', () => {
    const actual = jest.requireActual('../../src/functions.js');
    return {...actual, xf: {...actual.xf, dispatch: jest.fn(actual.xf.dispatch)}};
});

const settle = async () => { for(let i = 0; i < 10; i++) await Promise.resolve(); };
const go = async route => {
    window.history.replaceState({}, '', `/#/${route}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await settle();
};

test('leaving the cockpit keeps the session running and updates the return banner in place', async () => {
    window.innerWidth = 390;
    window.history.replaceState({}, '', '/#/player');
    document.body.innerHTML = '<div id="platform"></div><div class="wrapper" hidden><training-calendar></training-calendar></div>';
    const calendar = document.querySelector('training-calendar');
    calendar.entriesForDate = () => [];
    calendar.loadPlannedMonth = jest.fn();
    const root = document.querySelector('#platform');
    await launchPlatform(root);
    await settle();

    expect(document.body.classList.contains('mobile-app')).toBe(true);
    expect(document.body.dataset.route).toBe('player');
    expect(root.querySelector('.ride-exit').getAttribute('href')).toBe('#/dashboard');
    expect(root.querySelector('.ride-banner')).toBeNull();

    // Devices drawer opens and closes inside the cockpit.
    expect(root.querySelector('#ride-devices').hidden).toBe(true);
    root.querySelector('[data-ride-devices]').click();
    expect(root.querySelector('#ride-devices').hidden).toBe(false);
    expect(root.querySelector('[data-ride-devices]').getAttribute('aria-expanded')).toBe('true');
    root.querySelector('#ride-devices [data-ride-devices]').click();
    expect(root.querySelector('#ride-devices').hidden).toBe(true);

    // Start a session and leave for Settings: no stop/pause is dispatched and the banner appears.
    db.watchStatus = 'started';
    db.elapsed = 754;
    xf.dispatch.mockClear();
    await go('settings');
    expect(xf.dispatch.mock.calls.map(([event]) => event)).not.toContain('ui:watchStop');
    expect(xf.dispatch.mock.calls.map(([event]) => event)).not.toContain('ui:watchPause');
    const banner = root.querySelector('.ride-banner');
    expect(banner).not.toBeNull();
    expect(banner.getAttribute('href')).toBe('#/player');
    expect(banner.textContent).toContain('Ride in progress');
    expect(banner.textContent).toContain('Tempo Block · 12:34');

    // A background tick updates the banner text in place without rebuilding the page form.
    const formBeforeTick = root.querySelector('#profile-form');
    db.elapsed = 755;
    xf.dispatch('db:elapsed', db);
    await settle();
    expect(root.querySelector('#profile-form')).toBe(formBeforeTick);
    expect(root.querySelector('.ride-banner').textContent).toContain('12:35');

    // Pausing updates the banner label; returning to the cockpit hides the banner.
    db.watchStatus = 'paused';
    xf.dispatch('db:watchStatus', db);
    await settle();
    expect(root.querySelector('.ride-banner').textContent).toContain('Ride paused');

    await go('player');
    expect(root.querySelector('.ride-banner')).toBeNull();

    // Stopping clears the banner on other pages.
    await go('dashboard');
    expect(root.querySelector('.ride-banner')).not.toBeNull();
    db.watchStatus = 'stopped';
    db.elapsed = 0;
    xf.dispatch('db:watchStatus', db);
    await settle();
    expect(root.querySelector('.ride-banner')).toBeNull();
});
