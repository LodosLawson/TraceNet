import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User, CreateUserInput, UserRole, UserStatus } from '../user/models/User';

/**
 * JWT payload for access token
 */
export interface AccessTokenPayload {
    sub: string;                    // User system_id
    email: string;
    roles: UserRole[];
    wallet_ids: string[];
    exp: number;                    // 15 minutes
    iat: number;
}

/**
 * JWT payload for refresh token
 */
export interface RefreshTokenPayload {
    sub: string;
    jti: string;                    // Token ID for revocation
    exp: number;                    // 7 days
    iat: number;
}

/**
 * Auth tokens response
 */
export interface AuthTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

/**
 * Authentication Service
 */
export class AuthService {
    private jwtSecret: string;
    private accessTokenExpiry: number;
    private refreshTokenExpiry: number;
    private saltRounds: number;

    constructor(
        jwtSecret: string,
        accessTokenExpiry: number = 900,      // 15 minutes
        refreshTokenExpiry: number = 604800,  // 7 days
        saltRounds: number = 10
    ) {
        this.jwtSecret = jwtSecret;
        this.accessTokenExpiry = accessTokenExpiry;
        this.refreshTokenExpiry = refreshTokenExpiry;
        this.saltRounds = saltRounds;
    }

    /**
     * Hash password using bcrypt
     */
    async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, this.saltRounds);
    }

    /**
     * Verify password against hash
     */
    async verifyPassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    /**
     * Generate access token
     */
    generateAccessToken(user: User): string {
        const payload: AccessTokenPayload = {
            sub: user.system_id,
            email: user.email,
            roles: user.roles,
            wallet_ids: user.wallet_ids,
            exp: Math.floor(Date.now() / 1000) + this.accessTokenExpiry,
            iat: Math.floor(Date.now() / 1000),
        };

        return jwt.sign(payload, this.jwtSecret);
    }

    /**
     * Generate refresh token
     */
    generateRefreshToken(userId: string): string {
        const payload: RefreshTokenPayload = {
            sub: userId,
            jti: uuidv4(),
            exp: Math.floor(Date.now() / 1000) + this.refreshTokenExpiry,
            iat: Math.floor(Date.now() / 1000),
        };

        return jwt.sign(payload, this.jwtSecret);
    }

    /**
     * Generate both access and refresh tokens
     */
    generateTokens(user: User): AuthTokens {
        return {
            access_token: this.generateAccessToken(user),
            refresh_token: this.generateRefreshToken(user.system_id),
            expires_in: this.accessTokenExpiry,
        };
    }

    /**
     * Verify and decode access token
     */
    verifyAccessToken(token: string): AccessTokenPayload | null {
        try {
            const decoded = jwt.verify(token, this.jwtSecret) as AccessTokenPayload;
            return decoded;
        } catch (error) {
            return null;
        }
    }

    /**
     * Verify and decode refresh token
     */
    verifyRefreshToken(token: string): RefreshTokenPayload | null {
        try {
            const decoded = jwt.verify(token, this.jwtSecret) as RefreshTokenPayload;
            return decoded;
        } catch (error) {
            return null;
        }
    }

    /**
     * Extract token from Authorization header
     */
    extractTokenFromHeader(authHeader?: string): string | null {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        return authHeader.substring(7);
    }

    /**
     * Validate user input for registration
     */
    validateRegistrationInput(input: CreateUserInput): { valid: boolean; error?: string } {
        // Validate nickname if provided
        if (input.nickname) {
            if (input.nickname.length < 3 || input.nickname.length > 50) {
                return { valid: false, error: 'Nickname must be between 3 and 50 characters' };
            }

            if (!/^[a-zA-Z0-9_]+$/.test(input.nickname)) {
                return { valid: false, error: 'Nickname can only contain letters, numbers, and underscores' };
            }
        }

        // Validate email if provided
        if (input.email && !this.isValidEmail(input.email)) {
            return { valid: false, error: 'Invalid email address' };
        }

        // Validate birthday if provided
        if (input.birthday && !this.isValidDate(input.birthday)) {
            return { valid: false, error: 'Invalid birthday format (use YYYY-MM-DD)' };
        }

        return { valid: true };
    }

    /**
     * Validate email format
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate date format (YYYY-MM-DD)
     */
    private isValidDate(dateString: string): boolean {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString)) {
            return false;
        }

        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date.getTime());
    }
}
