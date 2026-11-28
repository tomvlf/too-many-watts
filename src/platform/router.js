/**
 * Owns hash-route parsing and current-navigation state for the platform shell.
 * Rendering and page data remain in ui.js.
 */
export const routes = Object.freeze({
    dashboard: ['Overview', 'Your training, in focus'],
    calendar: ['Training calendar', 'Make room for progress'],
    plan: ['Training plan', 'A purposeful path to your goal'],
    coach: ['Coach', 'Guidance grounded in your training'],
    library: ['Workout library', 'Find your next session'],
    workout: ['Workout details', 'Know the work ahead'],
    player: ['Ride', 'One interval at a time'],
    activities: ['Activities', 'Every ride is part of the story'],
    progress: ['Progress', 'Consistency, made visible'],
    settings: ['Settings', 'Your profile, devices and integrations'],
});

export const mobileTabs = Object.freeze([
    ['dashboard', 'Today'],
    ['calendar', 'Calendar'],
    ['player', 'Ride'],
    ['coach', 'Coach'],
]);

export const moreRoutes = Object.freeze([
    'plan', 'library', 'activities', 'progress', 'settings',
]);

/** Retired routes that now live inside another page. */
export const routeAliases = Object.freeze({
    devices: 'settings',
});

export const openOnMobile = new Set(['Up next', 'workout-notes', 'calendar-month']);

export function parsePlatformRoute(hash) {
    const [name, id] = String(hash || '').replace(/^#\/?/, '').split('/');
    let selectedId = '';
    try { selectedId = decodeURIComponent(id || ''); }
    catch { selectedId = ''; }
    return {
        route: Object.hasOwn(routes, name) || name === 'editor' || Object.hasOwn(routeAliases, name)
            ? routeAliases[name] || name : 'dashboard',
        selectedId,
    };
}
