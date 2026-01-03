/**
 * Rate Limiting Middleware - TraceNet V3.0
 * 
 * Protection against DOS attacks
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

export class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();
    private readonly windowMs: number;
    private readonly maxRequests: number;

    constructor(windowMs: number = 60000, maxRequests: number = 100) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;

        // Cleanup old entries every minute
        setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Check if request is allowed
     */
    isAllowed(identifier: string): boolean {
        const now = Date.now();
        const entry = this.limits.get(identifier);

        if (!entry || now > entry.resetTime) {
            // New window
            this.limits.set(identifier, {
                count: 1,
                resetTime: now + this.windowMs
            });
            return true;
        }

        if (entry.count >= this.maxRequests) {
            // Rate limit exceeded
            return false;
        }

        // Increment counter
        entry.count++;
        return true;
    }

    /**
     * Get remaining requests for identifier
     */
    getRemaining(identifier: string): number {
        const entry = this.limits.get(identifier);
        if (!entry || Date.now() > entry.resetTime) {
            return this.maxRequests;
        }
        return Math.max(0, this.maxRequests - entry.count);
    }

    /**
     * Reset rate limit for identifier
     */
    reset(identifier: string): void {
        this.limits.delete(identifier);
    }

    /**
     * Cleanup expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.limits.entries()) {
            if (now > entry.resetTime) {
                this.limits.delete(key);
            }
        }
    }

    /**
     * Express middleware
     */
    middleware() {
        return (req: any, res: any, next: any) => {
            const identifier = req.ip || req.connection.remoteAddress;

            if (!this.isAllowed(identifier)) {
                res.status(429).json({
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded. Please try again later.',
                    retryAfter: Math.ceil(this.windowMs / 1000)
                });
                return;
            }

            // Add rate limit headers
            res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
            res.setHeader('X-RateLimit-Remaining', this.getRemaining(identifier).toString());

            next();
        };
    }
}
