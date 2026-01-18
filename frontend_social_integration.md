# Frontend Integration Guide: Instant & Batch Social Actions

## 1. Concepts: Instant vs. Batch

The TraceNet protocol supports two modes for social interactions (`LIKE`, `COMMENT`, etc.):

| Mode | Fee | Speed | Use Case |
| :--- | :--- | :--- | :--- |
| **Batch (Default)** | **Low** (e.g., 0.00001 LT) | **Slower** (~1-10s) | General usage, background sync, non-urgent interactions. Uses `SocialPool`. |
| **Instant** | **High** (2x Base Fee) | **Fast** (~Immediate) | Real-time feedback, critical interactions. Goes directly to `Mempool`. |

---

## 2. API Endpoints & Payloads

Base URL: `https://tracenet-blockchain-136028201808.us-central1.run.app`

### A. Like Content (Post or Comment)
* Endpoint: `POST /api/social/like`

#### Payload Interface
```typescript
interface LikePayload {
    wallet_id: string;        // User's Wallet ID
    content_id: string;       // ID of the Post (or Comment) being liked
    timestamp: number;        // Date.now()
    public_key: string;       // User's Public Key
    signature: string;        // Signed Message
    instant?: boolean;        // true = Instant, false/undefined = Batch
}
```

#### Signing The Request
**Message Format:** `${wallet_id}:LIKE:${content_id}:${timestamp}`

```typescript
// Example Signing Logic
const message = `${walletId}:LIKE:${contentId}:${timestamp}`;
const signature = await wallet.sign(message); 
// Note: Ensure wallet.sign produces a hex string of the signature
```

---

### B. Comment (or Reply)
* Endpoint: `POST /api/social/comment`

#### Payload Interface
```typescript
interface CommentPayload {
    wallet_id: string;
    content_id: string;       // ID of the Post being commented on
    comment_text: string;     // The actual text
    parent_comment_id?: string; // OPTIONAL: If replying to a comment, put Parent Comment ID here
    timestamp: number;
    public_key: string;
    signature: string;
    instant?: boolean;
}
```

**Note:** For a **Reply**, you still send `content_id` as the ID of the main post, but you **ALSO** include `parent_comment_id`.

#### Signing The Request
**Message Format:** `${wallet_id}:COMMENT:${content_id}:${timestamp}:${comment_text}`

**Important:** The `parent_comment_id` and `instant` flag are **NOT** included in the signature message string. Only sign the fields shown above.

```typescript
// Example Signing Logic
const message = `${walletId}:COMMENT:${contentId}:${timestamp}:${commentText}`;
const signature = await wallet.sign(message);
```

---

## 3. Implementation Example (React/TypeScript)

```typescript
import { api } from './services/api'; // Your API service

/**
 * Handle Like Action
 */
const handleLike = async (contentId: string, isInstant: boolean = false) => {
    const timestamp = Date.now();
    
    // 1. Generate Signature
    const message = `${user.walletId}:LIKE:${contentId}:${timestamp}`;
    const signature = await wallet.signMessage(message);

    // 2. Send Request
    try {
        const response = await api.likeContent({
            wallet_id: user.walletId,
            content_id: contentId,
            timestamp: timestamp,
            public_key: user.publicKey,
            signature: signature,
            instant: isInstant // <--- Controls Batch vs Instant
        });
        
        console.log("Like Success:", response);
    } catch (error) {
        console.error("Like Failed:", error);
    }
};

/**
 * Handle Reply to Comment
 */
const handleReply = async (postId: string, parentCommentId: string, text: string, isInstant: boolean = false) => {
    const timestamp = Date.now();
    
    // 1. Generate Signature
    // WARNING: Do NOT include parentCommentId in the signature string
    const message = `${user.walletId}:COMMENT:${postId}:${timestamp}:${text}`;
    const signature = await wallet.signMessage(message);

    // 2. Send Request
    try {
        await api.commentContent({
            wallet_id: user.walletId,
            content_id: postId, // Main Post ID
            parent_comment_id: parentCommentId, // The Comment we are replying to
            comment_text: text,
            timestamp: timestamp,
            public_key: user.publicKey,
            signature: signature,
            instant: isInstant
        });
    } catch (error) {
        console.error("Reply Failed:", error);
    }
};
```

## 4. Troubleshooting Common Errors

| Error | Cause | Fix |
| :--- | :--- | :--- |
| **"Invalid signature"** | The string you signed does not EXACTLY match what the backend expects. | Check the "Message Format" carefully. Ensure no extra spaces. |
| **"Content not found"** | The `content_id` does not exist on the node OR is still in the Mempool (Unmined). | **Fixed in Backend:** I have updated the node to check Mempool. Retry the action. |
| **"Bad Request" (400)** | Missing fields in JSON payload. | Ensure `wallet_id`, `public_key`, etc. are all present. |

---

### Technical Note on Liking Comments
Currently, the backend validates `content_id` against **Content (Posts)**.
*   **Liking a Post:** Works ✅
*   **Liking a Comment:** May fail if the backend does not treat Comments as "Content" in the lookup. (Architecture Limitation: Comments are transactions, not "Content" objects in the primary index).
    *   *Recommendation:* For now, focus on Liking Posts. Liking Comments requires a backend protocol update to index Comments as referenceable entities.
