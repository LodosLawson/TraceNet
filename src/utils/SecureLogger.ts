
/**
 * Secure Logger
 * Wraps console methods to automatically redact sensitive information
 * like private keys, passwords, and JWT tokens.
 */
export class SecureLogger {
    private static REDACT_PATTERNS = [
        /\b[0-9a-fA-F]{64}\b/g, // 64-char hex (Private Keys)
        /\b(ey[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+)\b/g, // JWT Tokens
        /password\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi // Password fields
    ];

    static log(...args: any[]) {
        console.log(...args.map(SecureLogger.sanitize));
    }

    static warn(...args: any[]) {
        console.warn(...args.map(SecureLogger.sanitize));
    }

    static error(...args: any[]) {
        console.error(...args.map(SecureLogger.sanitize));
    }

    /**
     * Recursively sanitize objects and strings
     */
    static sanitize(arg: any): any {
        if (typeof arg === 'string') {
            return SecureLogger.redactString(arg);
        } else if (typeof arg === 'object' && arg !== null) {
            if (Array.isArray(arg)) {
                return arg.map(SecureLogger.sanitize);
            }
            const cleanObj: any = {};
            for (const key in arg) {
                if (Object.prototype.hasOwnProperty.call(arg, key)) {
                    // Redact sensitive keys
                    if (/password|secret|privateKey|token/i.test(key)) {
                        cleanObj[key] = '[REDACTED]';
                    } else {
                        cleanObj[key] = SecureLogger.sanitize(arg[key]);
                    }
                }
            }
            return cleanObj;
        } else if (arg instanceof Error) {
            return {
                name: arg.name,
                message: SecureLogger.redactString(arg.message),
                stack: SecureLogger.redactString(arg.stack || '')
            };
        }
        return arg;
    }

    private static redactString(str: string): string {
        let clean = str;
        this.REDACT_PATTERNS.forEach(pattern => {
            clean = clean.replace(pattern, '[REDACTED]');
        });
        return clean;
    }
}
