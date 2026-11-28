/**
 * Connects real Coach forms, service logic, workout conversion and calendar elements inside a
 * simulated browser. Fake IndexedDB keeps the scenario off the rider's real storage. Checks plan
 * creation/adaptation, playable exports, start restrictions and running setup; it does not contact
 * a trainer.
 */

/** @jest-environment jsdom */

import { IDBFactory } from 'fake-indexeddb';
import { serialize, deserialize } from 'node:v8';
import { CoachingPanel } from '../../src/views/coaching-panel.js';
import { TrainingCalendar } from '../../src/views/training-calendar.js';
import { initializeCoaching } from '../../src/coaching/service.js';
import { addDays, localDay } from '../../src/coaching/domain.js';
import { progressWorkout, exportZwo, toAppWorkout } from '../../src/coaching/workouts.js';
import { zwo } from '../../src/workouts/zwo.js';
import { profile } from './fixtures.js';
import { xf } from '../../src/functions.js';
import { db } from '../../src/db.js';

beforeAll(() => {
    if(!globalThis.structuredClone) globalThis.structuredClone = value => deserialize(serialize(value));
});

test('generated ZWO and app workouts expose the durations required by the existing player', () => {
    const workout = progressWorkout({id: 'structured', date: '2026-01-01', minutes: 45, family: 'threshold',
        phaseId: 'p', weekId: 'w', phaseType: 'build', level: 2, profile});
    const parsed = zwo.readToInterval(exportZwo(workout));
    const app = toAppWorkout(workout);
    expect(parsed.meta.duration).toBe(workout.duration);
    expect(app.meta.duration).toBe(parsed.meta.duration);
    expect(app.intervals).toEqual(parsed.intervals);
});

/**
 * Follow a complete form workflow instead of checking HTML alone: enter settings, import fictional
 * history, generate a plan, select a session and request easier training.
 */
test('coaching forms create a persistent plan that appears and adapts in the existing calendar', async () => {
    const service = await initializeCoaching(new IDBFactory());
    const panel = new CoachingPanel(), calendar = new TrainingCalendar();
    document.body.append(panel, calendar);
    try {
        const form = panel.querySelector('[data-coach-form=setup]');
        form.elements.adultAthleteConfirmed.checked = true;
        const start = localDay(new Date().toISOString(), form.elements.timeZone.value);
        form.elements.start.value = start;
        form.elements.date.value = addDays(start, 60);
        for(let day = 0; day < 7; day++) form.elements[`day${day}`].value = '60';
        await panel.submit({target: form, preventDefault() {}, submitter: {value: 'configure'}});
        expect(panel.querySelector('[role=alert]')).toBeNull();
        const imports = panel.querySelector('[data-coach-form=import]');
        imports.elements.rides.value = JSON.stringify(Array.from({length: 14}, (_, i) => ({
            id: `ui-history-${i}`, start: `${addDays(start, -i * 2 - 1)}T10:00:00Z`,
            duration: 3600, normalizedPower: 130, averageHeartRate: 130, rpe: 4,
        })));
        await panel.submit({target: imports, preventDefault() {}});
        const generate = panel.querySelector('[data-coach-form=setup]');
        await panel.submit({target: generate, preventDefault() {}, submitter: {value: 'generate'}});
        expect(panel.querySelector('[role=alert]')).toBeNull();
        expect(service.data.plan.revision).toBe(1);
        const sessions = service.data.plan.workouts;
        service.data.plan.workouts = [];
        panel.render();
        expect(panel.textContent).toContain('No sessions fit the current training-load and availability limits');
        service.data.plan.workouts = sessions;
        panel.render();
        expect(calendar.coachingEntries()).toHaveLength(service.data.plan.workouts.length);
        const workout = service.data.plan.workouts[0];
        expect(calendar.entriesForDate(workout.date).some(e => e.id === workout.id)).toBe(true);
        expect(calendar.canStartCoaching(workout)).toBe(true);
        expect(calendar.canStartCoaching(service.data.plan.workouts.at(-1))).toBe(false);
        expect(calendar.canStartCoaching({...workout, sport: 'running'})).toBe(false);
        xf.dispatch('ui:coaching:select', toAppWorkout(workout));
        expect(db.workout.coachingWorkoutId).toBe(workout.id);
        expect(db.workout.meta.duration).toBe(workout.duration);
        const selected = db.workout;
        const ftp = db.ftp;
        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            xf.dispatch('ui:ftp-set', ftp + 20);
            xf.dispatch('ui:coaching:select', toAppWorkout(workout));
            expect(db.workout).toBe(selected);
            expect(panel.textContent).toContain('FTP has changed');
        } finally {
            xf.dispatch('ui:ftp-set', ftp);
            errorLog.mockRestore();
        }
        await panel.click({target: panel.querySelector('[data-coach=recovery]')});
        expect(service.data.plan.revision).toBe(2);
        expect(panel.textContent).toContain('Revision 2');
        expect(panel.querySelector('[role=alert]')).toBeNull();
        service.data.safetyStatus = 'illness';
        service.data.plan.trainingPaused = true;
        panel.render();
        expect(calendar.canStartCoaching(workout)).toBe(false);
        expect(panel.textContent).toMatch(/Training is paused/);
        const entry = calendar.coachingEntries().find(e => e.id === workout.id);
        expect(calendar.renderCoachingActions(entry)).not.toContain('coach-export');
        service.data.safetyStatus = null;
        service.data.plan.trainingPaused = false;
    } finally {
        panel.remove();
        calendar.remove();
    }
});

test('goal date follows the chosen time frame unless an event date is entered', () => {
    const values = entries => ({get: key => entries[key] ?? ''});
    const panel = new CoachingPanel();
    const base = {start: '2026-01-01', name: 'Goal', type: 'general_fitness', priority: 'A', horizon: '182'};
    expect(panel.goalFrom(values(base)).date).toBe('2026-07-02');
    expect(panel.goalFrom(values({...base, date: '2026-03-01'})).date).toBe('2026-03-01');
    expect(() => panel.goalFrom(values({...base, date: '2025-12-01'}))).toThrow('after the plan start');
});

test('running setup derives threshold pace from a typed pace or a race and drops cycling-only targets', () => {
    const values = entries => ({get: key => entries[key] ?? ''});
    const panel = new CoachingPanel();
    const service = {data: {profile: null}};
    const base = {type: 'run_10k', timeZone: 'UTC', experience: 'intermediate', hours: '4', maxHours: '5',
        day1: '45', day6: '90', longDay: '6', adultAthleteConfirmed: 'on'};
    expect(panel.profileFrom(values({...base, thresholdPace: '4:45', thresholdPaceDate: '2025-12-01'}), service))
        .toMatchObject({sport: 'running', ftp: null, thresholdPace: 285, thresholdPaceDate: '2025-12-01'});
    expect(panel.profileFrom(values({...base, raceDistanceKm: '5', raceTime: '25:00'}), service).thresholdPace).toBe(315);
    expect(() => panel.profileFrom(values({...base, raceDistanceKm: '5'}), service)).toThrow('race distance and its finish time');
    expect(() => panel.profileFrom(values({...base, thresholdPace: '1:00'}), service)).toThrow('Threshold pace must be between');
    const goal = panel.goalFrom(values({start: '2026-01-01', name: '10 km', type: 'run_10k', priority: 'A',
        horizon: '91', distanceKm: '10', targetPower: '250'}));
    expect(goal).toMatchObject({id: 'running-goal', distanceKm: 10});
    expect(goal.targetPower).toBeUndefined();
});

test('coach view offers an inline FTP editor in setup and plan views that saves through the profile lock', async () => {
    const service = await initializeCoaching(new IDBFactory());
    const panel = new CoachingPanel();
    document.body.append(panel);
    try {
        // Setup view: the editor is present and prefilled from the current device FTP.
        const setupEditor = panel.querySelector('[data-coach-ftp]');
        expect(setupEditor).not.toBeNull();
        expect(setupEditor.querySelector('input[name="ftp"]')).not.toBeNull();
        expect(setupEditor.querySelector('[data-coach="ftp"]')).not.toBeNull();

        // Updating FTP through the editor dispatches the same profile event as Settings.
        const original = db.ftp;
        setupEditor.querySelector('input[name="ftp"]').value = '260';
        await panel.click({target: setupEditor.querySelector('[data-coach="ftp"]')});
        expect(db.ftp).toBe(260);
        expect(panel.querySelector('.coach-notice').textContent).toContain('FTP updated to 260 W');

        // Plan view: the editor also appears inside the adjust section with a plan-specific hint.
        const planEditor = panel.ftpEditor({plan: true});
        expect(planEditor).toContain('data-coach-ftp');
        expect(planEditor).toContain('Changing FTP does not rewrite an active plan');

        // Invalid input is rejected without changing the stored value.
        db.ftp = original;
        panel.render();
        const editor = panel.querySelector('[data-coach-ftp]');
        editor.querySelector('input[name="ftp"]').value = '0';
        await panel.click({target: editor.querySelector('[data-coach="ftp"]')});
        expect(db.ftp).toBe(original);
        expect(panel.querySelector('[role=alert]').textContent).toContain('valid FTP');
    } finally {
        panel.remove();
    }
});
