/**
 * Builds the timed power profile shown while riding. Convert workout-relative intensities to watts,
 * then use actual interval position rather than elapsed ride time, because riders can skip
 * intervals or free-ride. These helpers do not control the trainer.
 */
import { time } from './format.js';
import { html } from '../html.js';

const powerZones = [
    {max: 0.54, name: 'Z1 · Recovery', color: '#636468'},
    {max: 0.75, name: 'Z2 · Endurance', color: '#328AFF'},
    {max: 0.87, name: 'Z3 · Tempo', color: '#44A5AB'},
    {max: 0.94, name: 'Z4 · Threshold', color: '#57C057'},
    {max: 1.05, name: 'Z5 · VO2', color: '#F8C73A'},
    {max: 1.20, name: 'Z6 · Anaerobic', color: '#FF663A'},
    {max: Infinity, name: 'Z7 · Neuromuscular', color: '#FE340B'},
];

export function ridePowerZone(power, ftp) {
    if(!Number.isFinite(power) || !Number.isFinite(ftp) || ftp <= 0) return null;
    return powerZones.find(zone => power / ftp < zone.max) || powerZones.at(-1);
}

/**
 * Flatten valid timed steps into cumulative starting seconds and absolute power targets. Return
 * null when there is no usable timed profile; retain missing power as missing, not zero.
 */
export function rideTimeline(workout, ftp, toAbsolute) {
    let duration = 0;
    const intervals = [];
    for(const interval of workout?.intervals || []) {
        const start = duration;
        const steps = [];
        for(const step of interval.steps || []) {
            if(!Number.isFinite(step.duration) || step.duration <= 0) return null;
            const target = Number.isFinite(step.power) ? toAbsolute(step.power, ftp) : null;
            const power = Number.isFinite(target) ? target : null;
            steps.push({...step, power, start: duration});
            duration += step.duration;
        }
        intervals.push({start, duration: duration - start, steps});
    }
    if(!duration) return null;
    const peak = intervals.reduce((max, interval) =>
        interval.steps.reduce((value, step) => Math.max(value, step.power || 0), max), 0);
    const threshold = Number.isFinite(ftp) && ftp > 0 ? ftp : null;
    return {duration, intervals, ftp: threshold, maximumPower: Math.ceil(Math.max(threshold || 0, peak, 50) / 50) * 50};
}

/**
 * Locate the profile marker from the current interval and its remaining time. Clamp within that
 * interval, start at zero before playback and show the end when the workout is done.
 */
export function ridePosition(timeline, {intervalIndex = 0, lapTime, workoutStatus}) {
    if(!timeline) return 0;
    if(workoutStatus === 'done') return timeline.duration;
    if(workoutStatus !== 'started') return 0;
    const interval = timeline.intervals[intervalIndex];
    if(!interval) return timeline.duration;
    const left = Number.isFinite(lapTime) ? lapTime : interval.duration;
    return interval.start + Math.max(0, Math.min(interval.duration, interval.duration - left));
}

/**
 * Render duration-scaled power bars and placeholders for the moving marker/current interval. The
 * platform updates those placeholders during the ride; the viewBox stays 1000×180 so updates can
 * position in profile units while CSS scales the rendered plot down.
 */
export function rideProfile(timeline) {
    if(!timeline) return html`<p class="muted">No timed power profile for this ride. Ride at your own pace.</p>`;
    const {duration, intervals, maximumPower} = timeline;
    const bars = intervals.flatMap(interval => interval.steps.map(step => {
        const height = step.power == null ? 3 : Math.max(3, step.power / maximumPower * 180);
        const zone = ridePowerZone(step.power, timeline.ftp);
        return html`<rect x="${step.start / duration * 1000}" y="${180 - height}"
            width="${step.duration / duration * 1000}" height="${height}"
            fill="${zone?.color || '#526276'}"${zone ? html` data-zone="${zone.name}"` : ''}>
            <title>${time(step.start)} / ${step.power == null ? 'No power target' : `${step.power} W${zone ? ` / ${zone.name}` : ''}`}${step.cadence > 0 ? ` / ${step.cadence} rpm` : ''}</title></rect>`;
    }));
    return html`<div class="ride-profile-plot">
        <svg viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true">
            <line class="ride-profile-grid" x1="0" x2="1000" y1="90" y2="90"/>
            ${bars}
            <rect id="ride-profile-active" class="ride-profile-active" x="0" y="0" width="0" height="180"/>
            <rect id="ride-profile-completed" class="ride-profile-completed" x="0" y="0" width="0" height="180"/>
        </svg>
        <div id="ride-profile-cursor" class="ride-profile-cursor" style="left:0%"><span>Now</span></div>
        <div class="ride-profile-times" aria-hidden="true">${[0, .25, .5, .75, 1]
            .map(share => html`<span>${time(duration * share)}</span>`)}</div>
    </div>`;
}
