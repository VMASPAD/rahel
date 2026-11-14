import rateLimit from "express-rate-limit";

function limiter(windowMs: number, limit: number, error = "too_many_requests") {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error },
  });
}

const MIN = 60_000;
export const loginLimiter = limiter(15 * MIN, 10);
export const registerLimiter = limiter(60 * MIN, 10);
export const pairingCodeLimiter = limiter(10 * MIN, 20);
export const pairingStatusLimiter = limiter(MIN, 120);
export const claimLimiter = limiter(15 * MIN, 30);
