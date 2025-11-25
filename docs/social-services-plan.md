# Social Services & Authentication - Implementation Plan

## Overview

Extend the TraceNet blockchain with user authentication, social interactions, and media storage. All social actions are recorded on-chain while media files are stored in cloud storage with only hashes on-chain.

---

## Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WebApp[Web Application]
        MobileApp[Mobile App]
    end
    
    subgraph "API Gateway"
        Gateway[API Gateway<br/>JWT Auth]
    end
    
    subgraph "Services"
        AuthSvc[Auth Service]
        UserSvc[User Service]
        SocialSvc[Social Service]
        MediaSvc[Media Service]
        ModerationSvc[Moderation Service]
    end
    
    subgraph "Blockchain Layer"
        BlockchainNode[Blockchain Node<br/>DPoA Consensus]
    end
    
    subgraph "Storage"
        PostgreSQL[(PostgreSQL<br/>Users, Posts)]
        Redis[(Redis<br/>Sessions, Presence)]
        CloudStorage[Cloud Storage<br/>Media Files]
        CDN[CDN<br/>Media Delivery]
    end
    
    WebApp --> Gateway
    MobileApp --> Gateway
    
    Gateway --> AuthSvc
    Gateway --> UserSvc
    Gateway --> SocialSvc
    Gateway --> MediaSvc
    
    AuthSvc --> PostgreSQL
    AuthSvc --> Redis
    
    UserSvc --> PostgreSQL
    UserSvc --> BlockchainNode
    
    SocialSvc --> PostgreSQL
    SocialSvc --> BlockchainNode
    SocialSvc --> MediaSvc
    
    MediaSvc --> CloudStorage
    MediaSvc --> ModerationSvc
    
    CloudStorage --> CDN
```

---

## Data Models

### User Model

```typescript
interface User {
  system_id: string;              // UUID (primary key)
  nickname: string;               // Unique username
  email: string;                  // Email (unique)
  password_hash: string;          // Bcrypt hash
  first_name?: string;
  last_name?: string;
  birthday?: string;              // ISO date
  profile_image_url?: string;
  metadata: MetadataEntry[];      // Versioned key-value pairs
  status: UserStatus;
  roles: UserRole[];
  wallet_ids: string[];           // Associated blockchain wallets
  created_at: Date;
  updated_at: Date;
}

interface MetadataEntry {
  key: string;
  value: any;
  version: number;
  updated_at: Date;
}

enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  LAST_SEEN = 'last_seen'
}

enum UserRole {
  USER = 'user',
  VALIDATOR = 'validator',
  ADMIN = 'admin'
}
```

### Post Model

```typescript
interface Post {
  post_id: string;                // UUID
  author_id: string;              // User system_id
  content_text: string;
  media_hashes: MediaHash[];      // SHA256 hashes of media
  media_urls: string[];           // CDN URLs
  timestamp: Date;
  visibility: PostVisibility;
  like_count: number;
  comment_count: number;
  share_count: number;
  tx_id?: string;                 // On-chain transaction ID
  status: PostStatus;
}

interface MediaHash {
  hash: string;                   // SHA256
  url: string;                    // CDN URL
  size: number;
  content_type: string;
}

enum PostVisibility {
  PUBLIC = 'public',
  FOLLOWERS = 'followers',
  PRIVATE = 'private'
}

enum PostStatus {
  PENDING_MODERATION = 'pending_moderation',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged'
}
```

### Social Interaction Models

```typescript
interface Like {
  like_id: string;
  post_id: string;
  user_id: string;
  timestamp: Date;
  tx_id?: string;                 // On-chain LIKE transaction
}

interface Comment {
  comment_id: string;
  post_id: string;
  author_id: string;
  content: string;
  timestamp: Date;
  tx_id?: string;
}

interface Follow {
  follow_id: string;
  follower_id: string;            // Who is following
  following_id: string;           // Who is being followed
  timestamp: Date;
  tx_id: string;                  // On-chain FOLLOW transaction
}

interface Share {
  share_id: string;
  post_id: string;
  user_id: string;
  timestamp: Date;
  tx_id?: string;
}
```

---

## Service Implementations

### 1. Auth Service

**Responsibilities:**
- User registration and login
- JWT token generation and validation
- OAuth integration (Google, GitHub, etc.)
- WebAuthn support
- Token revocation
- Presence tracking

**Endpoints:**

```
POST   /auth/register          - Register new user
POST   /auth/login             - Login with email/password
POST   /auth/oauth/google      - OAuth login
POST   /auth/webauthn/register - WebAuthn registration
POST   /auth/webauthn/login    - WebAuthn login
POST   /auth/refresh           - Refresh access token
POST   /auth/logout            - Logout and revoke tokens
GET    /auth/me                - Get current user
POST   /auth/presence          - Update presence status
```

**JWT Structure:**

```typescript
interface AccessToken {
  sub: string;                    // User system_id
  email: string;
  roles: UserRole[];
  wallet_ids: string[];
  exp: number;                    // 15 minutes
  iat: number;
}

interface RefreshToken {
  sub: string;
  jti: string;                    // Token ID for revocation
  exp: number;                    // 7 days
  iat: number;
}
```

### 2. User Service

**Responsibilities:**
- User profile management
- Metadata versioning
- On-chain profile updates
- Profile caching

**Endpoints:**

```
POST   /users                   - Create user (triggers wallet creation)
GET    /users/:id               - Get user profile
PUT    /users/:id/profile       - Update profile (on-chain PROFILE_UPDATE)
PATCH  /users/:id/metadata      - Update metadata
GET    /users/:id/wallets       - Get user wallets
POST   /users/:id/avatar        - Upload profile image
GET    /users/search            - Search users
```

**On-Chain Integration:**

When profile is updated:
1. Create `PROFILE_UPDATE` transaction
2. Submit to blockchain node
3. Wait for confirmation
4. Update off-chain cache

### 3. Social Service

**Responsibilities:**
- Post creation and management
- Social interactions (like, comment, share, follow)
- On-chain transaction creation
- Feed generation

**Endpoints:**

```
POST   /posts                   - Create post
GET    /posts/:id               - Get post details
GET    /posts                   - Get feed (paginated)
DELETE /posts/:id               - Delete post
POST   /posts/:id/like          - Like post (on-chain LIKE tx)
DELETE /posts/:id/like          - Unlike post
POST   /posts/:id/comment       - Comment on post
GET    /posts/:id/comments      - Get comments
POST   /follow                  - Follow user (on-chain FOLLOW tx)
DELETE /follow/:id              - Unfollow user
GET    /users/:id/followers     - Get followers
GET    /users/:id/following     - Get following
GET    /users/:id/posts         - Get user posts
```

**Post Creation Flow:**

```mermaid
sequenceDiagram
    Client->>SocialService: POST /posts {content, media}
    SocialService->>MediaService: Upload media files
    MediaService->>CloudStorage: Store files
    CloudStorage-->>MediaService: URLs
    MediaService->>MediaService: Calculate SHA256
    MediaService-->>SocialService: {urls, hashes}
    SocialService->>BlockchainNode: POST_ACTION tx {media_hashes}
    BlockchainNode-->>SocialService: tx_id
    SocialService->>PostgreSQL: Save post
    SocialService->>RewardService: Trigger +10 coin reward
    RewardService->>BlockchainNode: REWARD tx
    SocialService-->>Client: Post created
```

### 4. Media Service

**Responsibilities:**
- Media file upload
- Compression handling
- SHA256 hash generation
- Cloud Storage integration
- CDN URL generation
- Virus/malware scanning

**Endpoints:**

```
POST   /media/upload            - Upload media files
GET    /media/:hash             - Get media by hash
DELETE /media/:hash             - Delete media (admin)
POST   /media/scan              - Trigger virus scan
```

**Upload Workflow:**

1. Client compresses media (zip)
2. Upload to `/media/upload`
3. Service validates size/type
4. Virus scan (ClamAV or Cloud Security Scanner)
5. Upload to Cloud Storage
6. Generate CDN URL
7. Calculate SHA256
8. Return `{url, hash, size, content_type}`

**Configuration:**

```typescript
interface MediaConfig {
  maxFileSize: number;            // e.g., 100MB
  allowedTypes: string[];         // ['image/*', 'video/*']
  storageBucket: string;          // GCP bucket name
  cdnDomain: string;              // CDN domain
  virusScanEnabled: boolean;
  retentionDays: number;          // e.g., 365
}
```

### 5. Moderation Service

**Responsibilities:**
- Automated content moderation
- Manual review queue
- User reporting
- Content flagging

**Endpoints:**

```
POST   /moderation/report       - Report content
GET    /moderation/queue        - Get moderation queue (admin)
POST   /moderation/approve/:id  - Approve content
POST   /moderation/reject/:id   - Reject content
GET    /moderation/stats        - Moderation statistics
```

---

## Reward & Spending Rules

### Reward Rules

| Action | Reward | Transaction Type | Notes |
|--------|--------|------------------|-------|
| Create Post | +10 TRN | REWARD | Automatic on post creation |
| First Post Bonus | +50 TRN | REWARD | One-time per user |
| Receive 100 Likes | +2 TRN | REWARD | Cumulative (author) |
| Comment | +1 TRN | REWARD | Per comment |
| Share | +0.5 TRN | REWARD | Per share |

### Spending Rules

| Action | Cost | Transaction Type | Notes |
|--------|------|------------------|-------|
| Send Message | 0.1 TRN | MESSAGE_PAYMENT | Paid to recipient or burned |
| Promote Post | 5 TRN | TRANSFER | To platform wallet |
| Premium Features | Variable | TRANSFER | Subscription model |

### Implementation

```typescript
class RewardEngine {
  async handlePostCreated(post: Post, user: User): Promise<void> {
    // Base reward
    await this.createReward(user.wallet_ids[0], 10, 'post_creation');
    
    // First post bonus
    const isFirstPost = await this.isFirstPost(user.system_id);
    if (isFirstPost) {
      await this.createReward(user.wallet_ids[0], 50, 'first_post_bonus');
    }
  }
  
  async handleLikeMilestone(post: Post, likeCount: number): Promise<void> {
    // Every 100 likes
    if (likeCount % 100 === 0) {
      const author = await this.getUser(post.author_id);
      await this.createReward(author.wallet_ids[0], 2, 'like_milestone');
    }
  }
  
  private async createReward(walletId: string, amount: number, type: string): Promise<void> {
    const tx = TransactionModel.create(
      'SYSTEM',
      walletId,
      TransactionType.REWARD,
      amount * 100000000, // Convert to smallest unit
      0,
      { type, timestamp: Date.now() }
    );
    
    await this.blockchainNode.submitTransaction(tx);
  }
}
```

---

## Security & Rate Limiting

### Rate Limits

```typescript
const RATE_LIMITS = {
  posts: {
    perHour: 10,
    perDay: 50
  },
  likes: {
    perMinute: 30,
    perHour: 500
  },
  comments: {
    perHour: 50,
    perDay: 200
  },
  follows: {
    perHour: 20,
    perDay: 100
  },
  mediaUploads: {
    perHour: 20,
    perDay: 100,
    maxSizeMB: 100
  }
};
```

### Content Moderation

**Automated Checks:**
- Virus/malware scanning
- NSFW detection (ML model)
- Spam detection
- Profanity filter
- Duplicate content detection

**Manual Review:**
- User reports trigger manual review
- Admin moderation queue
- Appeal system

---

## Database Schema

### PostgreSQL Tables

```sql
-- Users table
CREATE TABLE users (
  system_id UUID PRIMARY KEY,
  nickname VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  birthday DATE,
  profile_image_url TEXT,
  status VARCHAR(20) DEFAULT 'offline',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User metadata (versioned)
CREATE TABLE user_metadata (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(system_id),
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_metadata_user ON user_metadata(user_id);
CREATE UNIQUE INDEX idx_user_metadata_key ON user_metadata(user_id, key, version);

-- User roles
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(system_id),
  role VARCHAR(20) NOT NULL,
  PRIMARY KEY (user_id, role)
);

-- User wallets
CREATE TABLE user_wallets (
  user_id UUID REFERENCES users(system_id),
  wallet_id VARCHAR(64) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, wallet_id)
);

-- Posts
CREATE TABLE posts (
  post_id UUID PRIMARY KEY,
  author_id UUID REFERENCES users(system_id),
  content_text TEXT NOT NULL,
  media_hashes JSONB DEFAULT '[]',
  media_urls JSONB DEFAULT '[]',
  visibility VARCHAR(20) DEFAULT 'public',
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  tx_id VARCHAR(64),
  status VARCHAR(30) DEFAULT 'approved',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_status ON posts(status);

-- Likes
CREATE TABLE likes (
  like_id UUID PRIMARY KEY,
  post_id UUID REFERENCES posts(post_id),
  user_id UUID REFERENCES users(system_id),
  tx_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_likes_post ON likes(post_id);
CREATE INDEX idx_likes_user ON likes(user_id);

-- Comments
CREATE TABLE comments (
  comment_id UUID PRIMARY KEY,
  post_id UUID REFERENCES posts(post_id),
  author_id UUID REFERENCES users(system_id),
  content TEXT NOT NULL,
  tx_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comments_post ON comments(post_id);

-- Follows
CREATE TABLE follows (
  follow_id UUID PRIMARY KEY,
  follower_id UUID REFERENCES users(system_id),
  following_id UUID REFERENCES users(system_id),
  tx_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- Media files
CREATE TABLE media_files (
  media_id UUID PRIMARY KEY,
  hash VARCHAR(64) UNIQUE NOT NULL,
  url TEXT NOT NULL,
  size BIGINT NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  uploader_id UUID REFERENCES users(system_id),
  scan_status VARCHAR(20) DEFAULT 'pending',
  scan_result JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX idx_media_hash ON media_files(hash);
CREATE INDEX idx_media_uploader ON media_files(uploader_id);
```

---

## Testing Strategy

### E2E Test Flow

```typescript
describe('Social Platform E2E', () => {
  it('should complete full user journey', async () => {
    // 1. Create user
    const user = await createUser({
      email: 'test@example.com',
      password: 'password123',
      nickname: 'testuser'
    });
    
    // 2. Create wallet (automatic)
    const wallets = await getWallets(user.system_id);
    expect(wallets).toHaveLength(1);
    
    // 3. Verify airdrop
    const balance = await getBalance(wallets[0].wallet_id);
    expect(balance).toBe(10000000000); // 100 TRN
    
    // 4. Create post with media
    const post = await createPost({
      content: 'My first post!',
      media: [uploadedFile]
    });
    
    // 5. Verify POST_ACTION transaction on-chain
    const tx = await getTransaction(post.tx_id);
    expect(tx.type).toBe('POST_ACTION');
    expect(tx.payload.media_hashes).toHaveLength(1);
    
    // 6. Verify post creation reward
    const newBalance = await getBalance(wallets[0].wallet_id);
    expect(newBalance).toBe(11000000000); // 100 + 10 TRN
    
    // 7. Verify first post bonus
    expect(newBalance).toBe(15000000000); // 100 + 10 + 50 TRN
    
    // 8. Another user likes the post
    await likePost(post.post_id, otherUser.system_id);
    
    // 9. Verify LIKE transaction
    const likeTx = await getTransaction(like.tx_id);
    expect(likeTx.type).toBe('LIKE');
  });
});
```

---

## Deployment

### Docker Compose (Development)

```yaml
version: '3.8'

services:
  auth-service:
    build: ./services/auth
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/tracenet
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis
  
  user-service:
    build: ./services/user
    ports:
      - "4001:4001"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/tracenet
      - BLOCKCHAIN_NODE_URL=http://blockchain-node:3000
    depends_on:
      - postgres
      - blockchain-node
  
  social-service:
    build: ./services/social
    ports:
      - "4002:4002"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/tracenet
      - BLOCKCHAIN_NODE_URL=http://blockchain-node:3000
      - MEDIA_SERVICE_URL=http://media-service:4003
    depends_on:
      - postgres
      - blockchain-node
  
  media-service:
    build: ./services/media
    ports:
      - "4003:4003"
    environment:
      - GCP_BUCKET=${GCP_BUCKET}
      - CDN_DOMAIN=${CDN_DOMAIN}
      - MAX_FILE_SIZE=104857600
    volumes:
      - ./gcp-credentials.json:/app/credentials.json
  
  blockchain-node:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    volumes:
      - blockchain-data:/app/data
  
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=tracenet
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres-data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

volumes:
  blockchain-data:
  postgres-data:
  redis-data:
```

---

## Next Steps

1. **Implement Auth Service** - Start with basic email/password authentication
2. **Build User Service** - User CRUD and wallet integration
3. **Create Social Service** - Posts, likes, follows with on-chain integration
4. **Develop Media Service** - Cloud Storage integration and hash generation
5. **Add Reward Engine** - Automatic reward distribution
6. **Implement Moderation** - Content scanning and review queue
7. **Testing** - E2E tests for complete user journeys
8. **Deployment** - Kubernetes manifests and Cloud Run configuration
