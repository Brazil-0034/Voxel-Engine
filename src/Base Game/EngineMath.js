// variety of math tools and helpers
export const lerp = function (a, b, t) {
    return a + (b - a) * t;
}

export const elasticLerp = function (a, b, t) {
    t = Math.min(Math.max(t, 0), 0.25);
    t = (Math.sin(t * Math.PI * (0.2 + 2.5 * t * t * t)) * Math.pow(1 - t, 0.2) + t) * (1 + (0.1 * (1 - t)));
    return a + (b - a) * t;
}

export const clamp = (value, min, max) => Math.max(min, Math.min(value, max));