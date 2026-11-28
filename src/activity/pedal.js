/**
 * Decides when pedaling starts, resumes or pauses a ride from 1-second power readings.
 * Starting and resuming happen on the first positive power reading; pausing happens after five
 * consecutive zero-power seconds while running.
 */
export const AUTO_PAUSE_SECONDS = 5;

export function evaluatePedalState({
    power,
    watchStatus,
    autoStart = true,
    autoPause = true,
    idleSeconds = 0,
}) {
    const pedaling = Number.isFinite(power) && power > 0;
    if(watchStatus === 'started') {
        if(!autoPause) return {action: null, idleSeconds: 0};
        if(!pedaling) {
            const nextIdle = idleSeconds + 1;
            if(nextIdle >= AUTO_PAUSE_SECONDS) return {action: 'pause', idleSeconds: 0};
            return {action: null, idleSeconds: nextIdle};
        }
        return {action: null, idleSeconds: 0};
    }
    if(watchStatus === 'paused') {
        if(pedaling) return {action: 'resume', idleSeconds: 0};
        return {action: null, idleSeconds: 0};
    }
    if(watchStatus === 'stopped') {
        if(autoStart && pedaling) return {action: 'start', idleSeconds: 0};
        return {action: null, idleSeconds: 0};
    }
    return {action: null, idleSeconds: 0};
}
