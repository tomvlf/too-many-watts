/*
 * The coaching setup form and plan dashboard: collect availability and goals,
 * show upcoming sessions, record feedback/symptom reports, and offer history backup.
 * Form submissions call the coaching service, which owns saved data and plan rules.
 *
 * connectedCallback listens when <coaching-panel> joins the page;
 * disconnectedCallback cancels its listeners. render rebuilds the visible HTML.
 * escape keeps names/messages as literal text, while label makes internal names
 * readable. Training guidance is decision support, not a medical assessment.
 */

import { xf } from '../functions.js';
import { db } from '../db.js';
import intervals from '../models/intervals.js';
import { coachingService, coachingData } from '../coaching/service.js';
import { GOALS, RUN_GOALS, DEFAULTS, localDay, addDays, sportOf, sportForGoalType } from '../coaching/domain.js';
import { parsePace, thresholdPaceFromRace, formatPace } from '../coaching/running.js';
import { fileHandler } from '../file.js';
import { html, raw, setHTML } from '../html.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_LIMITS = {2: 60, 4: 60, 6: 120};
const label = value => String(value ?? '').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
const PRIORITIES = {A: 'A - main goal of the season', B: 'B - important', C: 'C - secondary / training event'};
const EXPERIENCE = {beginner: 'Beginner (less than 1 year structured)', intermediate: 'Intermediate (1-3 years)', advanced: 'Advanced (3+ years)'};
const PHASES = {
    assessment: 'Baseline - getting to know you', preparation: 'Preparation', base: 'Base - building endurance',
    build: 'Build - raising intensity', specific: 'Event-specific', peak: 'Peak', taper: 'Taper - freshening up',
    recovery: 'Recovery week', event: 'Event day',
};
const STATUS = {scheduled: 'Planned', completed: 'Done', substituted: 'Done (substitute)', missed: 'Missed', failed: 'Not completed'};
const DATA_QUALITY = {
    supported: 'Enough recent training history for personalised targets.',
    limited: 'Limited training history, so targets are kept conservative.',
    insufficient: 'No training history yet, so the plan starts with easy baseline sessions.',
};
const FEELINGS = [
    ['legFreshness', 'How fresh did your legs feel?', ['Very heavy', 'Heavy', 'Normal', 'Fresh', 'Very fresh']],
    ['sleepQuality', 'How did you sleep?', ['Very poorly', 'Poorly', 'OK', 'Well', 'Very well']],
    ['muscleSoreness', 'How sore are your muscles?', ['Not sore', 'Slightly', 'Moderately', 'Very', 'Extremely']],
    ['stress', 'How stressed do you feel?', ['Not at all', 'A little', 'Moderately', 'Very', 'Extremely']],
];
const RPE = ['Rest', 'Very, very easy', 'Very easy', 'Easy', 'Moderate', 'Somewhat hard', 'Hard', 'Very hard',
    'Very, very hard', 'Near maximal', 'Maximal'];
const attentionIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4M12 17.5h.01"/></svg>';
const HEART_RATE = [['maxHeartRate', 'Maximum heart rate'], ['thresholdHeartRate', 'Threshold heart rate'],
    ['restingHeartRate', 'Resting heart rate']];
const EQUIPMENT = [['powerMeter', 'Power meter'], ['heartRateMonitor', 'Heart-rate monitor'], ['smartTrainer', 'Smart trainer']];
// The optional final entry restricts a field to one sport; running goals have no power targets.
const GOAL_NUMBERS = [['distanceKm', 'Distance', 'km', '0.1'], ['elevationM', 'Climbing', 'm', '1'],
    ['expectedDurationMinutes', 'Expected duration', 'min', '1'], ['finishTimeMinutes', 'Target finish time', 'min', '1'],
    ['targetPower', 'Target power', 'W', '1', 'cycling'], ['targetFTP', 'Target FTP', 'W', '1', 'cycling'],
    ['targetWKg', 'Target W/kg', 'W/kg', '0.1', 'cycling']];
const SPORT_GOALS = [['Cycling', GOALS], ['Running', RUN_GOALS]];
const GOAL_LABELS = {first_5k: 'First 5 km', run_5k: '5 km race', run_10k: '10 km race', ultra_trail: 'Ultra / trail'};
const goalLabel = type => GOAL_LABELS[type] || label(type);
// "h:mm:ss" or "mm:ss" to seconds; null means the race time was not in an accepted format.
const parseClock = text => {
    const match = /^\s*(?:(\d{1,2}):)?(\d{1,3}):([0-5]\d)\s*$/.exec(String(text ?? ''));
    return match ? Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
};
const TERRAIN = ['', 'flat', 'rolling', 'hilly', 'mountainous'];
const HORIZONS = [[42, 'In about 6 weeks'], [91, 'Within 3 months'], [182, 'Within 6 months'], [365, 'Within a year']];

// Treat a calendar day as a date, not an instant that could shift in another time zone.
const dayLabel = (day, options = {weekday: 'short', day: 'numeric', month: 'short'}) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {...options, timeZone: 'UTC'});
const minutes = seconds => `${Math.round(seconds / 60)} min`;
// A blank optional field means "not supplied", not a numerical zero.
const optional = value => value === '' || value == null ? undefined : Number(value);
const selected = condition => condition ? 'selected' : '';

// Chooses setup or the active plan, then routes all nested form/button actions centrally.
class CoachingPanel extends HTMLElement {
    connectedCallback() {
        this.controller = new AbortController();
        const options = {signal: this.controller.signal};
        this.addEventListener('submit', event => this.submit(event), options);
        this.addEventListener('click', event => this.click(event), options);
        this.addEventListener('change', event => { if(event.target.name === 'type') this.syncSport(); }, options);
        xf.sub('coaching:changed', () => this.render(), options);
        xf.sub('db:ftp', () => this.render(), options);
        xf.sub('db:weight', () => this.render(), options);
        xf.sub('services', () => this.render(), options);
        xf.sub('coaching:error', message => { this.error = message; this.render(); }, options);
        this.render();
    }
    disconnectedCallback() { this.controller.abort(); }
    // Preserve expanded sections and, on errors, field values while rebuilding the page.
    // Render failures become a readable message rather than leaving a broken panel.
    render({keepInput = false} = {}) {
        const fields = keepInput ? [...this.querySelectorAll('[data-coach-form] [name]')]
            .map(el => [el.form?.dataset.coachForm, el.name, el.value]) : [];
        const open = new Set([...this.querySelectorAll('details[open] > summary')].map(el => el.textContent));
        try {
            const data = coachingData();
            if(!data) {
                setHTML(this, html`<p role="${this.error ? 'alert' : 'status'}">${this.error || 'Loading coaching history...'}</p>`);
                return;
            }
            const plan = data.plan?.status === 'active' ? data.plan : null;
            setHTML(this, html`
                ${this.error ? html`<p class="coach-alert" role="alert">${this.error}</p>` : ''}
                ${this.notice ? html`<p class="coach-notice" role="status">${this.notice}</p>` : ''}
                ${data.profile && !plan ? raw(this.safetyForm(data)) : ''}
                ${plan ? raw(this.planView(data, plan)) : raw(this.setupForm(data))}
                ${data.profile && plan ? raw(this.safetyForm(data)) : ''}
                <p class="coach-disclaimer">Training decision support, not medical advice. Recommendations are
                    conservative, deterministic rules, not guarantees.</p>`);
            this.notice = '';
            for(const [form, name, value] of fields) {
                const el = this.querySelector(`[data-coach-form="${form}"] [name="${name}"]`);
                if(el && el.type !== 'submit') el.value = value;
            }
            for(const summary of this.querySelectorAll('details > summary')) {
                if(open.has(summary.textContent)) summary.parentElement.open = true;
            }
            this.syncSport();
        } catch(error) {
            console.error('Unable to render coaching:', error);
            setHTML(this, html`<p role="alert">Coaching unavailable: ${error.message}</p>`);
        }
    }
    /** Shows only the setup fields of the sport of the selected goal type. */
    syncSport() {
        const type = this.querySelector('[data-coach-form=setup] [name=type]')?.value;
        if(!type) return;
        const sport = sportForGoalType(type);
        for(const el of this.querySelectorAll('[data-coach-form=setup] [data-sport]')) el.hidden = el.dataset.sport !== sport;
    }
    // Return the plan dashboard: progress, next sessions, warnings, and adjustment tools.
    // Adult confirmation and symptom status affect which next-session prompt is offered.
    planView(data, plan) {
        const profile = data.profile, state = data.snapshots.at(-1), goal = plan.goalDefinition || data.goal || {};
        const today = localDay(new Date().toISOString(), profile.timeZone);
        const running = sportOf(profile) === 'running';
        // Runs are done outdoors and never started in the indoor player, so FTP changes do not matter.
        const ftpChanged = !running && profile.ftp !== (db.ftp || null);
        const workouts = [...plan.workouts].sort((a, b) => a.date.localeCompare(b.date));
        const upcoming = workouts.filter(w => w.status === 'scheduled' && w.date >= today);
        const overdue = workouts.filter(w => w.status === 'scheduled' && w.date < today).length;
        const done = workouts.filter(w => ['completed', 'substituted'].includes(w.status)).length;
        const phase = plan.phases.find(p => p.startDate <= today && today <= p.endDate) || plan.phases[0];
        const week = plan.weeks.filter(w => w.startDate <= today).at(-1) || plan.weeks[0];
        const daysLeft = Math.max(0, Math.round((Date.parse(goal.date || plan.endDate) - Date.parse(today)) / 86400000));
        const progress = workouts.length ? Math.round(done / workouts.length * 100) : 0;
        const adultConfirmed = profile.adultAthleteConfirmed === true;
        const next = plan.trainingPaused || !adultConfirmed ? null : upcoming[0];
        // Collect actionable attention items into one list instead of a row of alert boxes.
        const attention = [];
        if(ftpChanged) attention.push(`Your profile FTP has changed (plan: ${escape(profile.ftp ?? 'none')} W, profile: ${escape(db.ftp ?? 'none')} W). Archive and regenerate this plan before starting its workouts.`);
        if(plan.trainingPaused || data.safetyStatus) attention.push(`Training is paused while ${escape(data.safetyStatus || 'symptom status is being reviewed')} is reported. Do not start or export planned sessions. If symptoms are concerning, persistent, worsening, or affect normal activity, seek assessment from a qualified healthcare professional.`);
        if(!adultConfirmed) attention.push('This legacy profile has no adult confirmation. Archive and reconfigure, confirming the athlete is 18 or older, before starting or exporting coached workouts.');
        if(!plan.workouts.length) attention.push('No sessions fit the current training-load and availability limits. Review the warnings below and check your history and profile before archiving and regenerating.');
        const overdueAction = overdue && !plan.trainingPaused && adultConfirmed;
        return `
            <header class="coach-hero coach-hero--active">
                <div class="coach-hero-copy">
                    <div class="coach-hero-eyebrow">${phase ? `<span class="coach-badge">${escape(PHASES[phase.type] || label(phase.type))}</span>` : ''}<span>${escape(goalLabel(goal.type))}</span></div>
                    <h2>${escape(goal.name || 'Training plan')}</h2>
                    <p class="coach-hero-date">${escape(dayLabel(goal.date || plan.endDate,
                        {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}))}</p>
                </div>
                <div class="coach-stats">
                    <div><span>Goal in</span><strong>${daysLeft}<small> days</small></strong></div>
                    <div><span>Completed</span><strong>${done}<small> / ${workouts.length}</small></strong></div>
                    <div><span>This week</span><strong>${week ? Math.round(week.scheduledMinutes) : 0}<small> min</small></strong></div>
                </div>
                <div class="coach-progress" role="progressbar" aria-label="Plan progress" aria-valuemin="0"
                    aria-valuemax="100" aria-valuenow="${progress}"><i style="width: ${progress}%"></i></div>
            </header>
            ${attention.length ? `<div class="coach-attention" role="alert">
                <div class="coach-attention--head"><span class="coach-attention--icon" aria-hidden="true">${attentionIcon}</span>
                    <strong>${attention.length === 1 ? 'One thing needs your attention' : `${attention.length} things need your attention`}</strong></div>
                <ul>${attention.map(item => `<li>${item}</li>`).join('')}</ul>
            </div>` : ''}
            ${overdueAction ? `<div class="coach-callout">
                <p><strong>${overdue} past session${overdue === 1 ? '' : 's'} not yet resolved.</strong>
                    ${running ? 'Runs and activities' : 'Rides'} you recorded are matched automatically. Review the rest so the coach can adapt; missed training is never made up.</p>
                <button type="button" data-coach="review">Review missed sessions</button></div>` : ''}
            <div class="coach-grid">
                <section class="coach-card coach-card--next">
                    <h3>Next session</h3>
                    ${next ? `
                        <p class="coach-next-date">${next.date === today ? 'Today' : escape(dayLabel(next.date, {weekday: 'long', day: 'numeric', month: 'long'}))}</p>
                        <p class="coach-next-title">${escape(next.title)}</p>
                        <p class="coach-next-meta">${minutes(next.duration)} · Effort ${escape(next.expectedRpe)}/10 (${escape(RPE[next.expectedRpe] || '')})</p>
                        <p class="coach-next-desc">${escape(String(next.description ?? "").replace(/^./, c => c.toUpperCase()))}</p>
                        ${next.date === today && !running
                            ? `<a class="button" href="#/workout/${encodeURIComponent(next.id)}">Prepare to ride</a>`
                            : '<a class="button" href="#/calendar">Open calendar</a>'} `
                        : plan.trainingPaused || !adultConfirmed ? '<p class="muted">No session is offered until the safety and adult-confirmation requirements are met.</p>'
                            : '<p class="muted">No more sessions are planned. Archive this plan and set a new goal to continue.</p>'}
                </section>
                <section class="coach-card coach-card--upcoming">
                    <h3>Coming up</h3>
                    ${upcoming.length > 1 ? `<ol class="coach-upcoming">${upcoming.slice(1, 7).map(w => `
                        <li><span>${escape(dayLabel(w.date))}</span><strong>${escape(w.title)}</strong>
                            <span class="muted">Effort ${escape(w.expectedRpe)}/10</span></li>`).join('')}</ol>
                        <a href="#/calendar">See full calendar</a>`
                        : '<p class="muted">Nothing else scheduled.</p>'}
                </section>
            </div>
            ${this.feedbackForm(data)}
            <section class="coach-card">
                <h3>Adjust your plan</h3>
                <div class="coach-actions">
                    <div><button type="button" class="secondary" data-coach="recovery">Make upcoming training easier</button>
                        <p class="muted">Feeling tired, ill or short on time? Future sessions are reduced; nothing is made up later.</p></div>
                    ${overdue || plan.trainingPaused || !adultConfirmed ? '' : `<div><button type="button" class="secondary" data-coach="review">Review missed sessions</button>
                        <p class="muted">Marks past, unmatched sessions as missed and adapts the plan.</p></div>`}
                    <div>${this.confirmArchive ? `<button type="button" class="danger" data-coach="archive">Yes, archive this plan</button>
                        <button type="button" class="secondary" data-coach="cancel-archive">Cancel</button>`
                        : '<button type="button" class="secondary" data-coach="confirm-archive">Archive plan and start over</button>'}
                        <p class="muted">Needed after changing ${running ? 'threshold pace' : 'FTP'}, availability or your goal. History is kept.</p></div>
                </div>
                ${running ? '' : this.ftpEditor({cycling: true, plan: true})}
            </section>
            <details class="coach-card">
                <summary>Why this plan? <span class="muted">Revision ${plan.revision}</span></summary>
                <p class="coach-rationale">${escape(plan.rationale)}</p>
                <div class="coach-facts">
                    <div><span>Training data</span><strong>${escape(DATA_QUALITY[state?.sufficiency] || state?.sufficiency)}</strong></div>
                    <div><span>Load basis</span><strong>${escape(state?.loadSource)}</strong></div>
                    <div><span>Readiness</span><strong>${escape(state?.readiness.reason)}</strong></div>
                    ${running ? `<div><span>Threshold pace</span><strong>${profile.thresholdPace
                        ? `${escape(formatPace(profile.thresholdPace, profile.unitSystem))}`
                        : 'not set'}</strong></div>` : ''}
                </div>
                <h4>Phases</h4>
                <ul class="coach-list">${plan.phases.map(p => `<li>${escape(dayLabel(p.startDate))} - ${escape(dayLabel(p.endDate))}:
                    <strong>${escape(PHASES[p.type] || label(p.type))}</strong>. ${escape(p.rationale)}</li>`).join('')}</ul>
                <h4>Weeks</h4>
                <ul class="coach-list">${plan.weeks.map(w => `<li>Week of ${escape(dayLabel(w.startDate))}: ${Math.round(w.scheduledMinutes)} min.
                    ${escape(w.rationale)}</li>`).join('')}</ul>
                ${[...plan.validationWarnings, ...(state?.warnings || [])].length ? `<h4>Warnings</h4>
                    <ul class="coach-list">${[...plan.validationWarnings, ...(state?.warnings || [])].map(w => `<li>${escape(w)}</li>`).join('')}</ul>` : ''}
                ${plan.adaptations.length ? `<h4>Recent changes</h4>
                    <ul class="coach-list">${plan.adaptations.slice(-5).map(a => `<li>${escape(new Date(a.timestamp).toLocaleString())}:
                        ${escape(a.reasoning)}</li>`).join('')}</ul>` : ''}
                <p class="muted">Session status: ${Object.entries(STATUS).map(([key, text]) =>
                    `${text} ${workouts.filter(w => w.status === key).length}`).join(' · ')}</p>
            </details>
            ${this.historyTools()}`;
    }
    // Offer recent activities for optional effort/recovery feedback; blank answers are skipped.
    feedbackForm(data) {
        const rides = [...data.activities].reverse().slice(0, 20);
        return `<details class="coach-card" ${rides.length ? '' : 'hidden'}>
            <summary>How did your last session feel?</summary>
            <p class="muted">Optional. Your answers help the coach decide whether to ease off. Leave anything blank to skip it.</p>
            <form data-coach-form="feedback">
                <label>Session<select name="activity" required>
                    ${rides.map(a => `<option value="${escape(a.id)}">${escape(dayLabel(a.day))} - ${a.sport === 'running' ? 'Run' : 'Ride'}, ${Math.round(a.duration / 60)} min</option>`).join('')}
                </select></label>
                <div class="coach-fields">
                    <label>How hard was it overall?<select name="rpe"><option value="">Skip</option>
                        ${RPE.map((text, value) => `<option value="${value}">${value} - ${text}</option>`).join('')}</select></label>
                    ${FEELINGS.map(([name, question, answers]) => `<label>${question}<select name="${name}"><option value="">Skip</option>
                        ${answers.map((text, index) => `<option value="${index + 1}">${text}</option>`).join('')}</select></label>`).join('')}
                </div>
                <button type="submit">Save feedback</button>
            </form>
        </details>`;
    }
    // Show the reported symptom status and a form to request a training pause/status update.
    safetyForm(data) {
        const status = data.safetyStatus || '';
        return `<section class="coach-card">
            <h3>Symptoms and training pause</h3>
            ${status ? `<p class="coach-alert" role="status">Training is paused because ${escape(status)} was reported.</p>` : ''}
            <p class="muted">Report pain or illness to pause coaching sessions. This tool cannot assess symptoms or clear you to train.
                Resume only when symptoms have resolved; seek qualified healthcare advice for concerning, persistent or worsening symptoms.</p>
            <form data-coach-form="safety">
                <label>Current status<select name="status">
                    <option value="" ${selected(!status)}>No reported pain or illness</option>
                    <option value="pain" ${selected(status === 'pain')}>Pain</option>
                    <option value="illness" ${selected(status === 'illness')}>Illness</option>
                </select></label>
                <button type="submit" class="secondary">${status ? 'Update symptom status' : 'Save status'}</button>
            </form>
        </section>`;
    }
    // Return import/backup controls; importing parses activity JSON only when submitted.
    historyTools() {
        return `<details class="coach-card">
            <summary>Training history and backup</summary>
            <p class="muted">Rides you record in Too Many Watts are added automatically. For better targets, connect
                Intervals.icu in <a href="#/settings">Settings</a>, or paste activities in the documented JSON format below
                (duration in seconds, ISO start time with offset; for runs add <code>"sport": "running"</code> and
                <code>"distance"</code> in metres).</p>
            <form data-coach-form="import"><label>Activities JSON
                <textarea name="rides" required rows="5">[]</textarea></label>
                <button type="submit" class="secondary">Import activities</button></form>
            <button type="button" class="secondary" data-coach="export">Download coaching history</button>
        </details>`;
    }
    // Inline FTP editor so the rider can set/update FTP without leaving the Coach view.
    // It saves through the same profile lock as Settings, so provider-managed values stay read-only.
    ftpEditor({plan = false} = {}) {
        let locked = false;
        try { locked = intervals.status().connected; }
        catch { locked = true; }
        const value = db.ftp || '';
        return `<div class="coach-ftp" data-coach-ftp>
            <label for="coach-ftp-value">FTP (watts)</label>
            <div class="coach-ftp--row">
                <input id="coach-ftp-value" name="ftp" type="number" min="1" max="1500" step="5"
                    value="${escape(value)}" placeholder="e.g. 250" ${locked ? 'disabled' : ''}>
                <button type="button" data-coach="ftp" ${locked ? 'disabled' : ''}>${value ? 'Update FTP' : 'Set FTP'}</button>
            </div>
            <p class="muted">${locked
                ? 'FTP is managed by Intervals.icu. Change it there, or disconnect to edit locally.'
                : plan
                    ? 'Changing FTP does not rewrite an active plan. Archive and regenerate it before riding its sessions.'
                    : 'Every workout target is a percentage of this number. The plan uses it when you create it.'}</p>
        </div>`;
    }
    // Build a four-step form, prefilled from any earlier profile/goal and current settings.
    // Sport-specific fields are present but hidden when they do not match the chosen goal.
    setupForm(data) {
        const profile = data.profile, goal = data.goal;
        const timeZone = profile?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const today = localDay(new Date().toISOString(), timeZone);
        const limits = profile?.maxSessionMinutes || DEFAULT_LIMITS;
        const hasHistory = data.plan && data.plan.status !== 'active';
        const ready = db.weight > 0;
        const sport = sportForGoalType(goal?.type || 'general_fitness');
        const unit = db.measurement === 'imperial' ? 'imperial' : 'metric';
        const pace = profile?.thresholdPace ? formatPace(profile.thresholdPace, unit).split('/')[0] : '';
        return `
            <header class="coach-intro">
                <div class="coach-intro-copy">
                    <h2>${hasHistory ? 'Set up your next plan' : 'Build a plan that fits your life'}</h2>
                    <p>Tell the Coach your goal and training rhythm. It creates a day-by-day cycling or running plan,
                        then adapts it as your sessions and feedback come in.</p>
                    ${hasHistory ? `<p class="coach-intro-note">Your previous plan ended (${escape(data.plan.status)}). Its history is kept.</p>` : ''}
                </div>
                <div class="coach-intro-points" aria-label="Coach setup highlights">
                    <span><strong>2 min</strong>setup</span>
                    <span><strong>Local</strong>and private</span>
                    <span><strong>Adaptive</strong>week by week</span>
                </div>
            </header>
            <form data-coach-form="setup" class="coach-setup">
                <section class="coach-step">
                    <h3><span class="coach-step-number">1</span>What are you training for?</h3>
                    <div class="coach-fields">
                        <label>Goal name<input name="name" value="${escape(goal?.name || 'My training goal')}" required
                            placeholder="e.g. Marmotte, first 5 km, half marathon, higher FTP"></label>
                        <label>Goal type<select name="type">${SPORT_GOALS.map(([group, goals]) => `<optgroup label="${group}">${
                            Object.keys(goals).map(v => `<option value="${v}" ${selected(v === (goal?.type || 'general_fitness'))}>${
                                escape(goalLabel(v))}</option>`).join('')}</optgroup>`).join('')}</select></label>
                        <label>When do you want to reach it?<select name="horizon">${HORIZONS.map(([days, text]) =>
                            `<option value="${days}" ${selected(days === 91)}>${text}</option>`).join('')}</select>
                            <small>The plan builds up to the end of this period.</small></label>
                        <label>How important is it?<select name="priority">${Object.entries(PRIORITIES).map(([v, text]) =>
                            `<option value="${v}" ${selected(v === (goal?.priority || 'A'))}>${text}</option>`).join('')}</select></label>
                    </div>
                    <details><summary>Event details (optional)</summary>
                        <p class="muted">Adding the event's demands makes the plan more specific.</p>
                        <div class="coach-fields">
                            <label>Event date<input type="date" name="date" min="${today}">
                                <small>Have a fixed event day? It replaces the time frame above.</small></label>
                            ${GOAL_NUMBERS.map(([name, text, unit, step, only]) => `<label ${only ? `data-sport="${only}"` : ''}>${text} (${unit})<input type="number" name="${name}"
                                min="0" step="${step}" value="${escape(goal?.[name] ?? '')}"></label>`).join('')}
                            <label>Terrain<select name="terrain">${TERRAIN.map(v =>
                                `<option value="${v}" ${selected(v === (goal?.terrain || ''))}>${v ? label(v) : 'Not specified'}</option>`).join('')}</select></label>
                            <label>Objective<input name="completionObjective" value="${escape(goal?.completionObjective || '')}"
                                placeholder="e.g. finish comfortably"></label>
                        </div>
                    </details>
                </section>

                <section class="coach-step">
                    <h3><span class="coach-step-number">2</span>Check your athlete profile</h3>
                    <ul class="coach-checklist">
                        <li data-sport="cycling" class="${db.ftp ? 'ok' : 'warn'}">FTP: <strong>${db.ftp ? `${escape(db.ftp)} W` : 'not set'}</strong>
                            ${db.ftp ? '' : '<span class="muted">- sessions will use effort (RPE) guidance instead of watts</span>'}</li>
                        <li class="${ready ? 'ok' : 'warn'}">Body weight: <strong>${ready ? `${escape(db.weight)} kg` : 'not set (required)'}</strong></li>
                    </ul>
                    ${this.ftpEditor({cycling: true})}
                    <div class="coach-fields" data-sport="running" ${sport === 'running' ? '' : 'hidden'}>
                        <label>Threshold pace (min:sec per ${unit === 'imperial' ? 'mile' : 'km'})<input name="thresholdPace"
                            value="${escape(pace)}" placeholder="e.g. 5:00" inputmode="numeric">
                            <small>The pace you could hold for about an hour. Leave blank if you are unsure.</small></label>
                        <label>Or a recent race distance (km)<input type="number" name="raceDistanceKm" min="1" max="100" step="0.1"
                            placeholder="e.g. 5"></label>
                        <label>and its finish time (h:mm:ss or mm:ss)<input name="raceTime" placeholder="e.g. 27:30"
                            inputmode="numeric"><small>An all-out effort from the last 2 months gives the best estimate.</small></label>
                        <label>Date of threshold estimate / race result<input type="date" name="thresholdPaceDate"
                            value="${escape(profile?.thresholdPaceDate || '')}" max="${today}">
                            <small>Optional; helps flag when pace may need recalibration.</small></label>
                    </div>
                    <div class="coach-fields" data-sport="cycling" ${sport === 'cycling' ? '' : 'hidden'}>
                        <label>When was FTP last tested or updated?<input type="date" name="ftpTestDate"
                            value="${escape(profile?.ftpTestDate || '')}" max="${today}">
                            <small>Optional; an undated FTP will be flagged for review.</small></label>
                    </div>
                </section>

                <section class="coach-step">
                    <h3><span class="coach-step-number">3</span>When can you train?</h3>
                    <p class="muted">Enter the longest session you can do on each day, in minutes. Use 0 for rest days.</p>
                    <div class="coach-days">${DAYS.map((day, index) => `
                        <div class="coach-day ${limits[index] ? 'coach-day--active' : ''}">
                            <label>${day.slice(0, 3)}<span class="coach-day-input"><input name="day${index}" type="number" min="0" max="1440" step="5"
                                value="${escape(limits[index] || 0)}" aria-label="${day} minutes" required><span aria-hidden="true">min</span></span></label>
                            <select name="env${index}" aria-label="${day} indoor or outdoor">${['either', 'indoor', 'outdoor'].map(v =>
                                `<option value="${v}" ${selected(v === (profile?.dayPreferences?.[index] || 'either'))}>${label(v)}</option>`).join('')}</select>
                        </div>`).join('')}</div>
                    <div class="coach-fields">
                        <label>Long ride / long run day<select name="longDay"><option value="">No preference</option>${DAYS.map((day, index) =>
                            `<option value="${index}" ${selected(index === (profile ? profile.longRideDay : 6))}>${day}</option>`).join('')}</select></label>
                        <label>Hours you usually train per week<input type="number" name="hours" min="0.5" step="0.5"
                            value="${escape(profile?.typicalWeeklyHours || 3)}" required></label>
                        <label>Most hours you could train in a week<input type="number" name="maxHours" min="0.5" step="0.5"
                            value="${escape(profile?.maxWeeklyHours || 4)}" required></label>
                        <label>Experience in this sport<select name="experience">${Object.entries(EXPERIENCE).map(([v, text]) =>
                            `<option value="${v}" ${selected(v === (profile?.experience || 'beginner'))}>${text}</option>`).join('')}</select>
                            <small data-sport="running">New to running? Beginners start with run-walk sessions.</small></label>
                    </div>
                </section>

                <section class="coach-step coach-step--finish">
                    <h3><span class="coach-step-number">4</span>Create your plan</h3>
                    <p class="muted">Rides recorded in Too Many Watts are included automatically. For runs and better targets, connect
                        Intervals.icu in <a href="#/settings">Settings</a> before creating the plan; you can also import activities later.</p>
                    <details><summary>More options</summary>
                        <div class="coach-fields">
                            <label>Plan start date<input type="date" name="start" value="${today}" required></label>
                            <label>Time zone<input name="timeZone" value="${escape(timeZone)}" required></label>
                            ${HEART_RATE.map(([name, text]) => `<label>${text} (bpm)<input type="number" name="${name}" min="1" max="255"
                                value="${escape(profile?.[name] ?? '')}"></label>`).join('')}
                            ${EQUIPMENT.map(([name, text]) => `<label>${text}<select name="${name}">${[['', 'Not specified'], ['yes', 'Yes'], ['no', 'No']]
                                .map(([v, t]) => `<option value="${v}" ${selected(v === (profile?.[name] == null ? '' : profile[name] ? 'yes' : 'no'))}>${t}</option>`).join('')}
                                </select></label>`).join('')}
                        </div>
                    </details>
                    <div class="coach-submit">
                        <label><input type="checkbox" name="adultAthleteConfirmed"
                            ${profile?.adultAthleteConfirmed === true ? 'checked' : ''} required>
                            I confirm that the athlete is an adult (18 or older).</label>
                        <button type="submit" name="operation" value="generate" ${ready ? '' : 'disabled'}>Create my plan</button>
                        <p class="muted">Your answers are saved with the plan. You can change them later by archiving the plan and starting over.</p>
                    </div>
                </section>
            </form>
            ${profile ? this.historyTools() : ''}`;
    }
    // Convert browser FormData into an athlete profile without saving it yet.
    // Cross-check available days, long-session day, and weekly hours before proceeding.
    profileFrom(values, service) {
        const sport = sportForGoalType(values.get('type'));
        const limits = Object.fromEntries(Array.from({length: 7}, (_, day) =>
            [day, Number(values.get(`day${day}`))]).filter(([, limit]) => limit > 0));
        if(!Object.keys(limits).length) throw new Error('Enter minutes for at least one day you can train (step 3).');
        const longDay = values.get('longDay');
        if(longDay !== '' && longDay != null && !limits[longDay]) {
            throw new Error(`You chose ${DAYS[longDay]} as long-session day but entered 0 minutes for it (step 3).`);
        }
        const hours = Number(values.get('hours')), maxHours = Number(values.get('maxHours'));
        if(hours > maxHours) throw new Error('Usual weekly hours cannot be more than the most hours you could train (step 3).');
        const dayPreferences = Object.fromEntries(Object.keys(limits)
            .map(day => [day, values.get(`env${day}`) || 'either']).filter(([, v]) => v !== 'either'));
        const profile = {
            id: service.data.profile?.id || 'local-athlete', sport,
            adultAthleteConfirmed: values.get('adultAthleteConfirmed') === 'on',
            ftp: sport === 'cycling' ? db.ftp || null : null, weight: db.weight, unitSystem: db.measurement,
            experience: values.get('experience'), timeZone: values.get('timeZone'),
            typicalWeeklyHours: hours, maxWeeklyHours: maxHours,
            longRideDay: longDay === '' || longDay == null ? null : Number(longDay),
            maxSessionMinutes: limits, availableDays: Object.keys(limits).map(Number),
        };
        if(sport === 'cycling' && values.get('ftpTestDate')) {
            profile.ftpTestDate = values.get('ftpTestDate');
        }
        if(sport === 'running') {
            const thresholdPace = this.thresholdPaceFrom(values);
            if(thresholdPace != null) {
                profile.thresholdPace = thresholdPace;
                if(values.get('thresholdPaceDate')) profile.thresholdPaceDate = values.get('thresholdPaceDate');
            }
        }
        if(Object.keys(dayPreferences).length) profile.dayPreferences = dayPreferences;
        for(const [name] of HEART_RATE) if(optional(values.get(name)) != null) profile[name] = optional(values.get(name));
        for(const [name] of EQUIPMENT) if(values.get(name)) profile[name] = values.get(name) === 'yes';
        return profile;
    }
    /** Threshold pace in seconds per km from the typed pace, or estimated from a recent race (Riegel 1981). */
    thresholdPaceFrom(values) {
        const typed = String(values.get('thresholdPace') ?? '').trim();
        const raceDistance = optional(values.get('raceDistanceKm')), raceText = String(values.get('raceTime') ?? '').trim();
        let pace = null;
        if(typed) {
            const parsed = parsePace(typed);
            if(parsed == null) throw new Error('Enter threshold pace as minutes:seconds, e.g. 5:00 (step 2).');
            pace = Math.round(db.measurement === 'imperial' ? parsed / 1.609344 : parsed);
        } else if(raceDistance != null || raceText) {
            const seconds = parseClock(raceText);
            if(!(raceDistance > 0) || seconds == null) {
                throw new Error('Enter both the race distance and its finish time (h:mm:ss or mm:ss) (step 2).');
            }
            pace = thresholdPaceFromRace(raceDistance, seconds);
        }
        if(pace != null && (pace < DEFAULTS.runThresholdPaceMinimum || pace > DEFAULTS.runThresholdPaceMaximum)) {
            throw new Error(`Threshold pace must be between ${formatPace(DEFAULTS.runThresholdPaceMinimum)} and ${
                formatPace(DEFAULTS.runThresholdPaceMaximum)} (step 2).`);
        }
        return pace;
    }
    // Build the goal, using either the explicit event date or a period after plan start.
    // Reject dates outside the planning window and omit the other sport's numeric targets.
    goalFrom(values) {
        const start = values.get('start');
        const date = values.get('date') || addDays(start, Number(values.get('horizon')) || 91);
        if(date <= start) throw new Error('The event date must be after the plan start date (step 1).');
        if(date > addDays(start, 366)) throw new Error('The event date must be within a year of the plan start (step 1).');
        const sport = sportForGoalType(values.get('type'));
        const goal = {id: `${sport}-goal`, name: values.get('name'), type: values.get('type'),
            priority: values.get('priority'), date, active: true};
        for(const [name, , , , only] of GOAL_NUMBERS) {
            if((!only || only === sport) && optional(values.get(name)) != null) goal[name] = optional(values.get(name));
        }
        if(values.get('terrain')) goal.terrain = values.get('terrain');
        if(values.get('completionObjective')) goal.completionObjective = values.get('completionObjective');
        return goal;
    }
    // Notify other coaching views, then keep this panel's success notice visible and in view.
    changed() {
        this.error = '';
        const notice = this.notice;
        xf.dispatch('coaching:changed');
        this.notice = notice;
        this.render();
        this.querySelector('.coach-notice')?.scrollIntoView?.({behavior: 'smooth', block: 'center'});
    }
    // Handle setup, symptom, history-import, or feedback forms through the service.
    // Setup also imports local ride summaries before optional plan generation.
    // On failure, show the error and retain field values so the rider can correct them.
    async submit(event) {
        const form = event.target.closest('[data-coach-form]');
        if(!form) return;
        event.preventDefault();
        try {
            const service = coachingService(), values = new FormData(form);
            if(form.dataset.coachForm === 'setup') {
                const profile = this.profileFrom(values, service), goal = this.goalFrom(values);
                await service.configure(profile, goal);
                await service.importActivities(db.activity.filter(a => a.duration > 0).map(a => ({
                    id: a.id, duration: a.duration, source: 'too-many-watts-summary',
                    start: new Date(a.timestamp - a.duration * 1000).toISOString(),
                })));
                if(event.submitter?.value === 'generate') {
                    await service.generate(values.get('start'));
                    this.notice = 'Your plan is ready. Sessions now appear in your training calendar.';
                } else {
                    this.notice = 'Answers saved. Choose "Create my plan" when you are ready.';
                }
            } else if(form.dataset.coachForm === 'safety') {
                await service.setSafetyStatus(values.get('status') || null);
                this.notice = values.get('status')
                    ? 'Training paused. Planned sessions cannot be started while symptoms are reported.'
                    : 'Status updated. Upcoming training remains conservative; this is not medical clearance.';
            } else if(form.dataset.coachForm === 'import') {
                const rides = JSON.parse(values.get('rides'));
                await service.importActivities(rides);
                this.notice = `Imported ${rides.length} activit${rides.length === 1 ? 'y' : 'ies'}.`;
            } else {
                const feedback = Object.fromEntries(['rpe', 'legFreshness', 'sleepQuality', 'muscleSoreness', 'stress']
                    .filter(key => values.get(key) !== '').map(key => [key, Number(values.get(key))]));
                await service.updateFeedback(values.get('activity'), feedback);
                this.notice = 'Thanks, feedback saved. Upcoming sessions were adapted if needed.';
            }
            this.changed();
        } catch(error) {
            console.error('Coaching action failed:', error);
            this.error = error.message || error.name || 'Coaching action failed.';
            this.render({keepInput: true});
            this.querySelector('[role=alert]')?.scrollIntoView?.({behavior: 'smooth', block: 'center'});
        }
    }
    // Route dashboard buttons: confirm/archive a plan, review missed sessions, ease future
    // training, or download a JSON backup. Confirmation clicks alone do not archive data.
    async click(event) {
        const button = event.target.closest('[data-coach]');
        if(!button) return;
        const action = button.dataset.coach;
        if(['confirm-archive', 'cancel-archive'].includes(action)) {
            this.confirmArchive = action === 'confirm-archive';
            this.render();
            return;
        }
        if(action === 'ftp') {
            const input = button.closest('[data-coach-ftp]')?.querySelector('input[name="ftp"]');
            const ftp = Number(input?.value);
            if(!Number.isFinite(ftp) || ftp <= 0) {
                this.error = 'Enter a valid FTP in watts.';
                this.render({keepInput: true});
                return;
            }
            xf.dispatch('ui:ftp-set', ftp);
            this.notice = `FTP updated to ${ftp} W.`;
            this.changed();
            return;
        }
        try {
            const service = coachingService();
            this.confirmArchive = false;
            if(action === 'archive') {
                await service.archive();
                this.notice = 'Plan archived. Review your answers below to create a new one.';
            }
            if(action === 'review') {
                await service.advance();
                this.notice = 'Past sessions reviewed and the plan was adapted.';
            }
            if(action === 'recovery') {
                await service.resolve({trigger: 'recovery'});
                this.notice = 'Upcoming sessions were made easier.';
            }
            if(action === 'export') {
                fileHandler.download()(JSON.stringify(service.data, null, 2), 'too-many-watts-coaching-history.json', 'application/json');
            }
            this.changed();
        } catch(error) {
            console.error('Coaching action failed:', error);
            this.error = error.message || error.name || 'Coaching action failed.';
            this.render({keepInput: true});
            this.querySelector('[role=alert]')?.scrollIntoView?.({behavior: 'smooth', block: 'center'});
        }
    }
}

customElements.define('coaching-panel', CoachingPanel);
export { CoachingPanel };
