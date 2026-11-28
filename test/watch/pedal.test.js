/**
 * Verifies pedal-driven ride start, resume and 5-second auto-pause behavior independently of the
 * browser Web Worker timer.
 */
import { AUTO_PAUSE_SECONDS, evaluatePedalState } from '../../src/activity/pedal.js';

test('starts immediately on positive power and ignores zero or unavailable power while stopped', () => {
    for(const power of [0, null, undefined, NaN, -5]) {
        expect(evaluatePedalState({power, watchStatus: 'stopped'})).toEqual({action: null, idleSeconds: 0});
    }
    expect(evaluatePedalState({power: 80, watchStatus: 'stopped'})).toEqual({action: 'start', idleSeconds: 0});
    expect(evaluatePedalState({power: 80, watchStatus: 'stopped', autoStart: false})).toEqual({action: null, idleSeconds: 0});
});

test('pauses after exactly five consecutive zero-power seconds and resets when pedaling resumes', () => {
    expect(AUTO_PAUSE_SECONDS).toBe(5);
    let idleSeconds = 0;
    for(let second = 1; second < 5; second++) {
        const result = evaluatePedalState({power: 0, watchStatus: 'started', idleSeconds});
        expect(result).toEqual({action: null, idleSeconds: second});
        idleSeconds = result.idleSeconds;
    }
    // Resuming pedaling on the 5th second cancels the pending pause.
    expect(evaluatePedalState({power: 120, watchStatus: 'started', idleSeconds})).toEqual({action: null, idleSeconds: 0});

    // Five consecutive zero-power seconds trigger pause and clear the counter.
    idleSeconds = 0;
    for(let second = 1; second <= 4; second++) {
        ({idleSeconds} = evaluatePedalState({power: 0, watchStatus: 'started', idleSeconds}));
    }
    expect(evaluatePedalState({power: 0, watchStatus: 'started', idleSeconds})).toEqual({action: 'pause', idleSeconds: 0});
    expect(evaluatePedalState({power: 0, watchStatus: 'started', autoPause: false, idleSeconds: 4}))
        .toEqual({action: null, idleSeconds: 0});
});

test('resumes immediately on positive power from paused state, including recovered rides', () => {
    expect(evaluatePedalState({power: 0, watchStatus: 'paused'})).toEqual({action: null, idleSeconds: 0});
    expect(evaluatePedalState({power: 110, watchStatus: 'paused'})).toEqual({action: 'resume', idleSeconds: 0});
    expect(evaluatePedalState({power: 110, watchStatus: 'paused', autoPause: false})).toEqual({action: 'resume', idleSeconds: 0});
});
