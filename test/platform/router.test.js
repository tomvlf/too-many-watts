/** @jest-environment jsdom */
import { parsePlatformRoute, routes, mobileTabs, moreRoutes } from '../../src/platform/router.js';

test('parses known routes and workout IDs safely', () => {
    expect(parsePlatformRoute('#/workout/builtin-4')).toEqual({
        route: 'workout',
        selectedId: 'builtin-4',
    });
    expect(parsePlatformRoute('#/unknown/item')).toEqual({
        route: 'dashboard',
        selectedId: 'item',
    });
});

test('falls back safely for malformed route IDs', () => {
    expect(parsePlatformRoute('#/workout/%E0%A4%A')).toEqual({
        route: 'workout',
        selectedId: '',
    });
});

test('keeps the platform route and mobile navigation catalog together', () => {
    expect(routes.player).toEqual(['Ride', 'One interval at a time']);
    expect(mobileTabs.map(([route]) => route)).toEqual(['dashboard', 'calendar', 'player', 'coach']);
    expect(moreRoutes).toContain('settings');
    expect(moreRoutes).not.toContain('devices');
});

test('sends the retired devices route to settings', () => {
    expect(parsePlatformRoute('#/devices')).toEqual({route: 'settings', selectedId: ''});
    expect(routes.devices).toBeUndefined();
});
