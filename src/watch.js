/**
 * Controls ride timing and workout progress, not a wristwatch connection. A worker sends one tick
 * each second; this module advances intervals, announces new trainer targets and records
 * start/stop/lap events through the live state. Ride recording status and workout-player status are
 * separate, allowing free riding before or after a workout.
 */

import { equals, exists, empty, first, last, xf, avg, max, toFixed, print, } from './functions.js';
import { kphToMps, mpsToKph, timeDiff, pad } from './utils.js';
import { models } from './models/models.js';
import { idb } from './storage/idb.js';
import { ControlMode, } from './ble/enums.js';
import { TimerStatus, EventType, } from './activity/enums.js';
import { stopRide } from './activity/stop.js';
import { evaluatePedalState } from './activity/pedal.js';
import { trustedScriptURL } from './html.js';

// const timer = new Worker('./timer.js');
const timer = new Worker(trustedScriptURL(new URL('./timer.js', import.meta.url)), {type: 'module'});

/**
 * Keep the current ride clock, interval position and automatic pause/start counters. Constructor
 * initializes local bookkeeping; the is/status methods only inspect those flags, while actions
 * announce changes through xf.
 */
class Watch {
    constructor(args) {
        this.elapsed          = 0;
        this.lapTime          = 0;
        this.stepTime         = 0;

        this.intervalIndex    = 0;
        this.stepIndex        = 0;
        this.intervalDuration = 0;
        this.stepDuration     = 0;

        this.state            = 'stopped';
        this.stateWorkout     = 'stopped';

        // Distance
        this.intervalType      = 'duration';
        // end Distance

        this.intervals         = [];
        this.textEvents        = [];
        this.textEvent         = '';
        this.workoutType       = "workout";
        this.autoStartCounter  = 3;
        this.autoPauseCounter  = 0;
        this.hasBeenAutoPaused = false;
        this.autoPause         = true;
        this.autoStart         = true;
        this.init();
    }
    /**
     * Subscribe to live-state changes, worker ticks and rider controls. Only one stop
     * confirmation/save decision can run at once.
     */
    init() {
        const self = this;

        // Data subs
        xf.sub('db:elapsed',       elapsed => { self.elapsed       = elapsed; });
        xf.sub('db:lapTime',          time => { self.lapTime       = time; });
        xf.sub('db:stepTime',         time => { self.stepTime      = time; });
        xf.sub('db:intervalDuration', time => { self.lapDuration   = time; });
        xf.sub('db:stepDuration',     time => { self.stepDuration  = time; });
        xf.sub('db:intervalIndex',   index => { self.intervalIndex = index; });
        xf.sub('db:stepIndex',       index => { self.stepIndex     = index; });
        xf.sub('db:watchStatus',     state => { self.state         = state; });
        xf.sub('db:workoutStatus',   state => {
            self.stateWorkout = state;

            if(!self.isWorkoutStarted()) {
                self.dispatchTextEvent();
            }

            if(self.isWorkoutDone()) {
                xf.dispatch('watch:lap');
                // reset to slope mode 0% when workout is done
                xf.dispatch('ui:slope-target-set', 0);
                xf.dispatch('ui:mode-set', ControlMode.sim);
                console.log(`Workout done!`);
            }
        });
        xf.sub('db:workout',       workout => {
            self.intervals  = workout.intervals;
            self.textEvents = flattenMessages(self.intervals);
            if(workout.meta.category?.toLowerCase().includes("test")) {
                self.workoutType = "test";
                // force turn off auto pausing for Test Category workouts
                xf.dispatch(`sources`, {autoPause: false});
            } else {
                self.workoutType = "workout";
            }
            console.log(`:workout :type ${self.workoutType}`);
            self.dispatchTextEvent();
        });
        xf.sub('db:power1s', self.onPower1s.bind(this));
        xf.sub('db:sources', self.onSources.bind(this));
        timer.addEventListener('message', self.onTick.bind(self));

        // UI subs
        xf.sub('ui:workoutStart', e => { self.startWorkout();   });
        xf.sub('ui:watchStart',   e => { self.start();          });
        xf.sub('workout:restore', e => { self.restoreWorkout(); });
        xf.sub('ui:watchPause',   e => { self.pause();          });
        xf.sub('ui:watchResume',  e => { self.resume();         });
        xf.sub('ui:watchLap',     e => { self.lap();            });
        xf.sub('ui:watchBack',    e => { self.back();           });
        xf.sub('ui:watchStop', async e => {
            if(self.stopping) return;
            self.stopping = true;
            try {
                await stopRide({
                    elapsed: self.elapsed,
                    confirmStop: message => confirm(message),
                    clearCheckpoint: () => idb.putChecked('session', {id: 0, elapsed: 0}),
                    stop: discard => self.stop(discard),
                });
            } catch(error) {
                xf.dispatch('coaching:error', `Could not discard the ride: ${error.message}`);
            } finally {
                self.stopping = false;
            }
        });
    }
    isStarted()        { return this.state        === 'started'; };
    isPaused()         { return this.state        === 'paused'; };
    isStopped()        { return this.state        === 'stopped'; };
    isWorkoutStarted() { return this.stateWorkout === 'started'; };
    isWorkoutDone()    { return this.stateWorkout === 'done'; };
    isIntervalType(type) {
        return equals(this.intervalType, type);
    }
    status() {
        return this.state;
    }
    /**
     * Update automatic pause/start preferences while keeping the current value for preferences not
     * included in this update.
     */
    onSources(value) {
        this.autoPause = value.autoPause ?? this.autoPause;
        this.autoStart = value.autoStart ?? this.autoStart;
    }
    /**
     * Use one-second power updates to start/resume immediately when pedaling begins and pause
     * after five consecutive zero-power seconds.
     */
    onPower1s(power) {
        const next = evaluatePedalState({
            power,
            watchStatus: this.state,
            autoStart: this.autoStart,
            autoPause: this.autoPause,
            idleSeconds: this.autoPauseCounter,
        });
        this.autoPauseCounter = next.idleSeconds;
        if(next.action === 'pause') {
            xf.dispatch('ui:watchPause');
            this.hasBeenAutoPaused = true;
        } else if(next.action === 'resume') {
            xf.dispatch('ui:watchResume');
        } else if(next.action === 'start') {
            this.autoStartCounter = -1;
            xf.dispatch('ui:watchStart');
            xf.dispatch('ui:workoutStart');
            xf.dispatch('ui:autoStartCounter', -1);
        }
    }
    /**
     * Start the worker clock and record a start event, or treat a repeated start during free riding
     * as pause.
     */
    start() {
        const self = this;
        if(self.isStarted() && !self.isWorkoutStarted()) {
            self.pause();
        } else {
            timer.postMessage('start');
            xf.dispatch('watch:started');

            xf.dispatch('watch:event', {
                timestamp: Date.now(),
                type: EventType.start,
            });
        }
    }
    /**
     * Cancel the automatic countdown, initialize the first interval/step timers, announce workout
     * playback and start recording if needed.
     */
    startWorkout() {
        const self = this;

        // in case of pressing play button during auto start countdown
        this.autoStartCounter = -1;
        xf.dispatch(`ui:autoStartCounter`, -1);

        if(self.isWorkoutStarted() || (
            // check for intervalIndex allows for multiple workouts in one session
            self.isWorkoutDone() && self.intervalIndex > 0
        )) {
            return;
        }

        let intervalTime = 0;
        let stepTime     = 0;

        if(exists(self.intervals)) {
            intervalTime = self.intervals[0]?.duration ?? 0;
            stepTime     = self.intervals[0]?.steps[0].duration ?? 0;

            xf.dispatch('watch:intervalIndex',  0);
            xf.dispatch('watch:stepIndex', 0);

            xf.dispatch('workout:started');

            xf.dispatch('watch:intervalDuration', intervalTime);
            xf.dispatch('watch:stepDuration',     stepTime);
            xf.dispatch('watch:lapTime',          intervalTime);
            xf.dispatch('watch:stepTime',         stepTime);
        }

        if(exists(self.points)) {
            self.intervalType = 'distance';
        }

        if(!self.isStarted()) {
            self.start();
        }

        self.dispatchTextEvent();
    }
    /**
     * Reannounce a restored workout, but pause a restored running clock so reopening the app does
     * not silently resume recording.
     */
    restoreWorkout() {
        const self = this;

        if(self.isWorkoutStarted()) {
            xf.dispatch('workout:started');
        }
        if(self.isStarted()) {
            self.pause();
        }
    }
    /**
     * Restart a paused clock with a new start event, preserving elapsed time and clearing the
     * automatic-pause marker.
     */
    resume() {
        const self = this;
        if(!self.isStarted()) {
            timer.postMessage('start');
            xf.dispatch('watch:started');

            xf.dispatch('watch:event', {
                timestamp: Date.now(),
                type: EventType.start,
            });

            this.hasBeenAutoPaused = false;
            this.autoPauseCounter = 0;
        }
    }
    /** Stop ticks and record a stop event without finalizing or deleting the activity. */
    pause() {
        const self = this;
        this.autoPauseCounter = 0;
        timer.postMessage('pause');
        xf.dispatch('watch:paused');

        xf.dispatch('watch:event', {
            timestamp: Date.now(),
            type: EventType.stop,
        });
    }
    /**
     * Stop timing, finish lap/event records, then announce save or discard. The order matters
     * because the save handler needs the final records before counters are reset.
     */
    stop(discard = false) {
        const self = this;
        if(self.isStarted() || self.isPaused()) {
            timer.postMessage('stop');

            xf.dispatch('watch:event', {
                timestamp: Date.now(),
                type: EventType.stop,
            });


            if(self.isWorkoutStarted()) {
                xf.dispatch('workout:stopped');
            }

            self.lap();

            // should be called after event and lap are created
            xf.dispatch('watch:stopped', {discard});

            if(exists(self.intervals)) {
                xf.dispatch('watch:intervalIndex', 0);
                xf.dispatch('watch:stepIndex',     0);
            }
            xf.dispatch('watch:elapsed', 0);
            xf.dispatch('watch:lapTime', 0);
            this.autoPauseCounter = 0;
            this.autoStartCounter = 3;
            this.hasBeenAutoPaused = false;
        }
    }
    /**
     * Advance elapsed time, update the interval countdown, request a warning beep near its end and
     * move to the next step when needed.
     */
    onTick() {
        const self   = this;
        let elapsed  = self.elapsed + 1;
        let lapTime  = self.lapTime;
        let stepTime = self.stepTime;

        if(self.isWorkoutStarted() && !equals(self.stepTime, 0)) {
            lapTime  -= 1;
            stepTime -= 1;
        } else {
            lapTime  += 1;
        }

        if(equals(lapTime, 4) && stepTime > 0) {
            xf.dispatch('watch:beep', 'interval');
        }
        xf.dispatch('watch:elapsed',  elapsed);
        xf.dispatch('watch:lapTime',  lapTime);
        xf.dispatch('watch:stepTime', stepTime);

        if(self.isWorkoutStarted() &&
           (stepTime <= 0) &&
            this.isIntervalType('duration')) {

            self.step();
        }

        // stepTime is written before stepIndex, so choose the message after step()
        self.dispatchTextEvent();
    }
    /**
     * Find the message at the current workout position, including after skipped intervals, and
     * announce it only when the displayed text changes.
     */
    dispatchTextEvent() {
        let message = '';

        if(this.isWorkoutStarted() && exists(this.intervals) && !empty(this.intervals)) {
            const second = workoutSecond(
                this.intervals,
                this.intervalIndex,
                this.stepIndex,
                this.stepDuration,
                this.stepTime,
            );
            message = messageAt(this.textEvents, second);
        }

        if(equals(message, this.textEvent)) return;

        this.textEvent = message;
        xf.dispatch('watch:workoutTextEvent', message);
    }
    /**
     * During a workout, skip to the next interval or finish playback; during free riding, mark a
     * lap and restart its timer.
     */
    lap() {
        const self = this;

        if(self.isWorkoutStarted()) {
            let i             = self.intervalIndex;
            let s             = self.stepIndex;
            let intervals     = self.intervals;
            let moreIntervals = i < (intervals.length - 1);

            if(moreIntervals) {
                i += 1;
                s  = 0;

                self.nextInterval(intervals, i, s);
                self.nextStep(intervals, i, s);
            } else {
                xf.dispatch('workout:done');
            }
        } else {
            xf.dispatch('watch:lap');
            xf.dispatch('watch:lapTime', 0);
        }
    }
    /**
     * Advance within the interval, then into the next interval, or mark the workout done when no
     * steps remain.
     */
    step() {
        const self        = this;
        let i             = self.intervalIndex;
        let s             = self.stepIndex;
        let intervals     = self.intervals;
        let steps         = intervals[i].steps;
        let moreIntervals = i < (intervals.length  - 1);
        let moreSteps     = s < (steps.length - 1);

        if(moreSteps) {
            s += 1;
            self.nextStep(intervals, i, s);
        } else if (moreIntervals) {
            i += 1;
            s  = 0;

            self.nextInterval(intervals, i, s);
            self.nextStep(intervals, i, s);
        } else {
            xf.dispatch('workout:done');
        }
    }
    /**
     * Start a duration-based interval when it supplies a duration; unsupported interval shapes do
     * not advance through this path.
     */
    nextInterval(intervals, intervalIndex, stepIndex) {
        if(exists(intervals[intervalIndex].duration)) {
            return this.nextDurationInterval(intervals, intervalIndex, stepIndex);
        }
        return undefined;
    }
    /** Select duration-based timing for a step and announce its new countdown when supported. */
    nextStep(intervals, intervalIndex, stepIndex) {
        if(this.isDurationStep(intervals, intervalIndex, stepIndex)) {
            this.intervalType = 'duration';
            return this.nextDurationStep(intervals, intervalIndex, stepIndex);
        }
        return undefined;
    }
    /**
     * Move to the previous workout interval, never before the first; in free riding, create a new
     * lap instead.
     */
    back() {
        const self = this;

        if(self.isWorkoutStarted()) {
            let i             = self.intervalIndex;
            let s             = self.stepIndex;
            let intervals     = self.intervals;
            let lessIntervals = (i - 1) >= 0;

            if(lessIntervals) {
                i -= 1;
                s  = 0;

                self.nextInterval(intervals, i, s);
                self.nextStep(intervals, i, s);
            }
        } else {
            xf.dispatch('watch:lap');
            xf.dispatch('watch:lapTime', 0);
        }
    }

    isDurationStep(intervals, intervalIndex, stepIndex) {
        return exists(intervals[intervalIndex].steps[stepIndex].duration);
    }
    nextDurationInterval(intervals, intervalIndex, stepIndex) {
        const intervalDuration = this.intervalsToDuration(intervals, intervalIndex);
        const stepDuration     = this.intervalsToStepDuration(intervals, intervalIndex, stepIndex);
        this.dispatchInterval(intervalDuration, intervalIndex);
    }
    nextDurationStep(intervals, intervalIndex, stepIndex) {
        const stepDuration = this.intervalsToStepDuration(intervals, intervalIndex, stepIndex);
        this.dispatchStep(stepDuration, stepIndex);
    }
    intervalsToDuration(intervals, intervalIndex) {
        return intervals[intervalIndex].duration;
    }
    intervalsToStepDuration(intervals, intervalIndex, stepIndex) {
        const steps = intervals[intervalIndex].steps;
        return steps[stepIndex].duration;
    }
    /**
     * Announce interval length, remaining time and index before recording the lap boundary, keeping
     * timing and recording listeners aligned.
     */
    dispatchInterval(intervalDuration, intervalIndex) {
        xf.dispatch('watch:intervalDuration', intervalDuration);
        xf.dispatch('watch:lapTime',          intervalDuration);
        xf.dispatch('watch:intervalIndex',    intervalIndex);
        xf.dispatch('watch:lap');
    }
    /**
     * Announce step length and countdown before its index, since index listeners immediately choose
     * the next trainer targets.
     */
    dispatchStep(stepDuration, stepIndex) {
        xf.dispatch('watch:stepDuration', stepDuration);
        xf.dispatch('watch:stepTime',     stepDuration);
        xf.dispatch('watch:stepIndex',    stepIndex);
        xf.dispatch('watch:step');
    }
}

// These regs have access to the global db state and can mutate it
xf.reg('watch:lapDuration',    (time, db) => db.intervalDuration = time);
xf.reg('watch:stepDuration',   (time, db) => db.stepDuration     = time);
xf.reg('watch:lapTime',        (time, db) => db.lapTime          = time);
xf.reg('watch:stepTime',       (time, db) => db.stepTime         = time);
xf.reg('watch:workoutTextEvent', (message, db) => {
    db.workoutTextEvent = message;
});
xf.reg('watch:intervalIndex', (index, db) => db.intervalIndex    = index);
/**
 * Translate the chosen step into trainer commands. Slope takes simulation mode; power without slope
 * takes ERG mode. Absent cadence/power targets are cleared so the previous step cannot leak into
 * this one.
 */
xf.reg('watch:stepIndex',     (index, db) => {
    db.stepIndex         = index;
    const intervalIndex  = db.intervalIndex;
    const powerTarget    = db.workout.intervals[intervalIndex].steps[index].power;
    const slopeTarget    = db.workout.intervals[intervalIndex].steps[index].slope;
    const cadenceTarget  = db.workout.intervals[intervalIndex].steps[index].cadence;
    const distanceTarget = db.workout.intervals[intervalIndex].steps[index].distance;

    if(exists(slopeTarget)) {
        xf.dispatch('ui:slope-target-set', slopeTarget);
        if(!equals(db.mode, ControlMode.sim)) {
            xf.dispatch('ui:mode-set', ControlMode.sim);
        }
    }
    if(exists(distanceTarget)) {
        xf.dispatch('ui:distance-target-set', distanceTarget);
    }
    if(exists(cadenceTarget)) {
        xf.dispatch('ui:cadence-target-set', cadenceTarget);
    } else {
        xf.dispatch('ui:cadence-target-set', 0);
    }
    if(exists(powerTarget)) {
        xf.dispatch('ui:power-target-set', models.ftp.toAbsolute(powerTarget, db.ftp));
        if(!exists(slopeTarget) && !equals(db.mode, ControlMode.erg)) {
            xf.dispatch('ui:mode-set', ControlMode.erg);
        }
    } else {
        xf.dispatch('ui:power-target-set', 0);
    }
});
xf.reg('workout:started', (x, db) => db.workoutStatus = 'started');
xf.reg('workout:stopped', (x, db) => db.workoutStatus = 'stopped');
xf.reg('workout:done',    (x, db) => db.workoutStatus = 'done');
xf.reg('watch:started',   (x, db) => {
    db.watchStatus = 'started';
    if(db.lapStartTime === false) {
        db.lapStartTime = Date.now(); // if first lap
    }
});
xf.reg('watch:paused',  (x, db) => db.watchStatus = 'paused');
xf.reg('watch:stopped', (x, db) => db.watchStatus = 'stopped');

xf.reg('watch:elapsed', models.session.elapsed);
xf.reg('watch:lap', models.session.lap);
xf.reg('watch:event', models.session.event);

const defaultDuration = 10;

/**
 * Convert step-relative text-message offsets into positions along the whole workout. Messages
 * without an explicit display length use the default duration.
 */
function flattenMessages(intervals) {
    const textEvents = [];

    if(!exists(intervals) || empty(intervals)) return textEvents;

    let cursor = 0;

    for(let i = 0; i < intervals.length; i++) {
        const steps = intervals[i].steps ?? [];

        for(let s = 0; s < steps.length; s++) {
            const step = steps[s];

            if(!exists(step.duration)) continue;

            const messages = step.messages ?? [];

            for(let m = 0; m < messages.length; m++) {
                const textEvent = messages[m];

                if(!exists(textEvent.offset)) continue;

                const start    = cursor + textEvent.offset;
                const duration = exists(textEvent.duration) ? textEvent.duration : defaultDuration;

                textEvents.push({
                    start,
                    end: start + duration,
                    message: textEvent.message,
                });
            }

            cursor += step.duration;
        }
    }

    return textEvents;
}


/**
 * Calculate playback position from completed intervals/steps plus time spent in the current step,
 * not from ride elapsed time, which may include free riding.
 */
function workoutSecond(intervals, intervalIndex, stepIndex, stepDuration, stepTime) {
    if(!exists(intervals) || empty(intervals)) return 0;

    let cursor = 0;

    for(let i = 0; i < intervalIndex; i++) {
        const steps = intervals[i]?.steps ?? [];

        for(let s = 0; s < steps.length; s++) {
            if(exists(steps[s].duration)) cursor += steps[s].duration;
        }
    }

    const steps = intervals[intervalIndex]?.steps ?? [];

    for(let s = 0; s < stepIndex; s++) {
        if(exists(steps[s]) && exists(steps[s].duration)) {
            cursor += steps[s].duration;
        }
    }

    if(exists(stepDuration)) {
        cursor += stepDuration - stepTime;
    }

    return cursor;
}

/**
 * Return the last matching message at this second. The start is included and the end is excluded;
 * no active message returns empty text.
 */
function messageAt(textEvents, second) {
    let message = '';

    if(!exists(textEvents) || empty(textEvents)) return message;

    for(let i = 0; i < textEvents.length; i++) {
        const textEvent = textEvents[i];

        if(second >= textEvent.start && second < textEvent.end) {
            message = textEvent.message;
        }
    }

    return message;
}

const watch = new Watch();

export { watch };
