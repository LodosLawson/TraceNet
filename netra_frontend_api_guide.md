# Netra Frontend API Guide: Social Interactions

**Target Audience:** Frontend Developers building the Netra Interface.
**Base URL:** `https://tracenet-blockchain-136028201808.us-central1.run.app`

This guide details how to implement **Likes**, **Co-Comments** (Replies), and **Likes on Comments** using the TraceNet RPC API.

---

## 1. Universal Rules

1.  **Signatures:** All social actions require a digital signature.
2.  **Instant vs Batch:**
    *   **Instant (`instant: true`):** Fast, higher fee. Use for immediate UI feedback.
    *   **Batch (`instant: false`):** Slower, lower fee. Use for background tasks.
3.  **IDs:**
    *   `content_id`: The ID of the Post **OR** the Comment you are interacting with.
    *   `parent_comment_id`: Used ONLY when replying to another comment.

---

## 2. Like Action (Like a Post OR a Comment)

**Endpoint:** `POST /api/social/like`

To like a comment, simply pass the **Comment's ID** as the `content_id`.

### Payload
```json
{
  "wallet_id": "WALLET_123...",
  "content_id": "POST_ID_OR_COMMENT_ID",
  "timestamp": 1731234567890,
  "public_key": "YOUR_PUBLIC_KEY",
  "signature": "HEX_SIGNATURE_STRING",
  "instant": true
}
```

### Signature Generation
The string to sign **MUST** be exactly:
```
{wallet_id}:LIKE:{content_id}:{timestamp}
```
*   **Do not** include `instant` or `public_key` in the signed string.
*   **Example:** `wallet123:LIKE:comment789:1731234567890`

---

## 3. Comment Action (Comment on a Post)

**Endpoint:** `POST /api/social/comment`

### Payload
```json
{
  "wallet_id": "WALLET_123...",
  "content_id": "POST_ID", 
  "comment_text": "This is a great post!",
  "timestamp": 1731234567890,
  "public_key": "YOUR_PUBLIC_KEY",
  "signature": "HEX_SIGNATURE_STRING",
  "instant": true
}
```

### Signature Generation
```
{wallet_id}:COMMENT:{content_id}:{timestamp}:{comment_text}
```

---

## 4. Reply Action (Reply to a Comment)

**Endpoint:** `POST /api/social/comment`

To reply to a comment, you must send **TWO** IDs:
1.  `content_id`: The ID of the **Main Post** (the root parent).
2.  `parent_comment_id`: The ID of the **Comment** you are replying to.

### Payload
```json
{
  "wallet_id": "WALLET_123...",
  "content_id": "ROOT_POST_ID",
  "parent_comment_id": "TARGET_COMMENT_ID",
  "comment_text": "I agree with your comment!",
  "timestamp": 1731234567890,
  "public_key": "YOUR_PUBLIC_KEY",
  "signature": "HEX_SIGNATURE_STRING",
  "instant": true
}
```

### Signature Generation (CRITICAL)
**Note:** The `parent_comment_id` is **NOT** part of the signature string.
```
{wallet_id}:COMMENT:{content_id}:{timestamp}:{comment_text}
```
*   Sign the `content_id` (Root Post ID), **NOT** the `parent_comment_id`.
*   This ensures authorization propagates from the main post.

---

## 5. Troubleshooting "Content not found"

If you receive `404 Content not found` or `400 Bad Request`:

1.  **Check Scope:** Are you trying to Like a brand new post?
    *   *Solution:* We have patched the node to check the **Mempool**. Ensure the backend is running the latest version.
2.  **Check IDs:**
    *   If replying, ensure `content_id` is the **Main Post ID**, not the comment ID.
    *   If Liking a comment, ensure `content_id` is the **Comment ID**.
3.  **Check Signature:**
    *   Ensure no spaces are added to the format string.
    *   Ensure the timestamp matches the one in the JSON payload.

---

## 6. Full Code Example (Typescript)

```typescript
async function likeComment(user, commentId) {
    const timestamp = Date.now();
    const signature = await user.sign(`${user.id}:LIKE:${commentId}:${timestamp}`);

    const res = await fetch('https://.../api/social/like', {
        method: 'POST',
        body: JSON.stringify({
            wallet_id: user.id,
            content_id: commentId, // Target the comment directly
            timestamp,
            public_key: user.publicKey,
            signature,
            instant: true
        })
    });
    return res.json();
}
```
