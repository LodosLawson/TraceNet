import { v4 as uuidv4 } from 'uuid';
import {
    Post,
    CreatePostInput,
    PostStatus,
    PostVisibility,
    Like,
    Comment,
    Follow,
    Share,
    MediaHash,
} from './models/Social';
import { TransactionModel, TransactionType } from '../../blockchain/models/Transaction';
import { UserService } from '../user/UserService';

/**
 * Social Service for managing posts, likes, follows, etc.
 */
export class SocialService {
    private posts: Map<string, Post>;
    private likes: Map<string, Like>;
    private comments: Map<string, Comment>;
    private follows: Map<string, Follow>;
    private shares: Map<string, Share>;
    private userService: UserService;

    // Indexes for fast lookups
    private postsByAuthor: Map<string, string[]>;
    private likesByPost: Map<string, string[]>;
    private likesByUser: Map<string, Set<string>>;
    private followsByFollower: Map<string, Set<string>>;
    private followsByFollowing: Map<string, Set<string>>;

    constructor(userService: UserService) {
        this.posts = new Map();
        this.likes = new Map();
        this.comments = new Map();
        this.follows = new Map();
        this.shares = new Map();
        this.userService = userService;

        this.postsByAuthor = new Map();
        this.likesByPost = new Map();
        this.likesByUser = new Map();
        this.followsByFollower = new Map();
        this.followsByFollowing = new Map();
    }

    /**
     * Create a new post
     */
    async createPost(
        input: CreatePostInput,
        mediaHashes: MediaHash[] = []
    ): Promise<{ post: Post; tx_id: string }> {
        const user = this.userService.getUser(input.author_id);
        if (!user) {
            throw new Error('User not found');
        }

        const post_id = uuidv4();
        const timestamp = new Date();

        // Create on-chain POST_ACTION transaction
        const postTx = TransactionModel.create(
            user.wallet_ids[0],
            user.wallet_ids[0],
            TransactionType.POST_ACTION,
            0,
            0,
            (Date.now() % 1000000), // Nonce
            {
                post_id,
                content_text: input.content_text,
                media_hashes: mediaHashes.map((m) => m.hash),
                timestamp: timestamp.getTime(),
            }
        );

        const post: Post = {
            post_id,
            author_id: input.author_id,
            content_text: input.content_text,
            media_hashes: mediaHashes,
            media_urls: mediaHashes.map((m) => m.url),
            timestamp,
            visibility: input.visibility || PostVisibility.PUBLIC,
            like_count: 0,
            comment_count: 0,
            share_count: 0,
            tx_id: postTx.tx_id,
            status: PostStatus.APPROVED, // Auto-approve for now
            created_at: timestamp,
            updated_at: timestamp,
        };

        this.posts.set(post_id, post);

        // Update author index
        if (!this.postsByAuthor.has(input.author_id)) {
            this.postsByAuthor.set(input.author_id, []);
        }
        this.postsByAuthor.get(input.author_id)!.push(post_id);

        return { post, tx_id: postTx.tx_id };
    }

    /**
     * Get post by ID
     */
    getPost(post_id: string): Post | undefined {
        return this.posts.get(post_id);
    }

    /**
     * Get posts by author
     */
    getPostsByAuthor(author_id: string, limit: number = 20): Post[] {
        const postIds = this.postsByAuthor.get(author_id) || [];
        return postIds
            .slice(-limit)
            .reverse()
            .map((id) => this.posts.get(id))
            .filter((p): p is Post => p !== undefined);
    }

    /**
     * Like a post
     */
    async likePost(post_id: string, user_id: string): Promise<{ like: Like; tx_id: string }> {
        const post = this.posts.get(post_id);
        if (!post) {
            throw new Error('Post not found');
        }

        const user = this.userService.getUser(user_id);
        if (!user) {
            throw new Error('User not found');
        }

        // Check if already liked
        const userLikes = this.likesByUser.get(user_id) || new Set();
        if (userLikes.has(post_id)) {
            throw new Error('Post already liked');
        }

        const like_id = uuidv4();
        const timestamp = new Date();

        // Create on-chain LIKE transaction
        const likeTx = TransactionModel.create(
            user.wallet_ids[0],
            post.author_id,
            TransactionType.LIKE,
            0,
            0,
            (Date.now() % 1000000), // Nonce
            {
                post_id,
                like_id,
                timestamp: timestamp.getTime(),
            }
        );

        const like: Like = {
            like_id,
            post_id,
            user_id,
            timestamp,
            tx_id: likeTx.tx_id,
            created_at: timestamp,
        };

        this.likes.set(like_id, like);

        // Update indexes
        if (!this.likesByPost.has(post_id)) {
            this.likesByPost.set(post_id, []);
        }
        this.likesByPost.get(post_id)!.push(like_id);

        if (!this.likesByUser.has(user_id)) {
            this.likesByUser.set(user_id, new Set());
        }
        this.likesByUser.get(user_id)!.add(post_id);

        // Increment like count
        post.like_count++;
        post.updated_at = new Date();
        this.posts.set(post_id, post);

        return { like, tx_id: likeTx.tx_id };
    }

    /**
     * Unlike a post
     */
    unlikePost(post_id: string, user_id: string): boolean {
        const post = this.posts.get(post_id);
        if (!post) {
            return false;
        }

        const userLikes = this.likesByUser.get(user_id);
        if (!userLikes || !userLikes.has(post_id)) {
            return false;
        }

        // Find and remove like
        const postLikes = this.likesByPost.get(post_id) || [];
        const likeId = postLikes.find((id) => {
            const like = this.likes.get(id);
            return like?.user_id === user_id;
        });

        if (likeId) {
            this.likes.delete(likeId);
            this.likesByPost.set(
                post_id,
                postLikes.filter((id) => id !== likeId)
            );
            userLikes.delete(post_id);

            // Decrement like count
            post.like_count = Math.max(0, post.like_count - 1);
            post.updated_at = new Date();
            this.posts.set(post_id, post);

            return true;
        }

        return false;
    }

    /**
     * Follow a user
     */
    async followUser(
        follower_id: string,
        following_id: string
    ): Promise<{ follow: Follow; tx_id: string }> {
        if (follower_id === following_id) {
            throw new Error('Cannot follow yourself');
        }

        const follower = this.userService.getUser(follower_id);
        const following = this.userService.getUser(following_id);

        if (!follower || !following) {
            throw new Error('User not found');
        }

        // Check if already following
        const followerFollows = this.followsByFollower.get(follower_id) || new Set();
        if (followerFollows.has(following_id)) {
            throw new Error('Already following this user');
        }

        const follow_id = uuidv4();
        const timestamp = new Date();

        // Create on-chain FOLLOW transaction
        const followTx = TransactionModel.create(
            follower.wallet_ids[0],
            following.wallet_ids[0],
            TransactionType.FOLLOW,
            0,
            0,
            (Date.now() % 1000000), // Nonce
            {
                follow_id,
                follower_id,
                following_id,
                timestamp: timestamp.getTime(),
            }
        );

        const follow: Follow = {
            follow_id,
            follower_id,
            following_id,
            timestamp,
            tx_id: followTx.tx_id,
            created_at: timestamp,
        };

        this.follows.set(follow_id, follow);

        // Update indexes
        if (!this.followsByFollower.has(follower_id)) {
            this.followsByFollower.set(follower_id, new Set());
        }
        this.followsByFollower.get(follower_id)!.add(following_id);

        if (!this.followsByFollowing.has(following_id)) {
            this.followsByFollowing.set(following_id, new Set());
        }
        this.followsByFollowing.get(following_id)!.add(follower_id);

        return { follow, tx_id: followTx.tx_id };
    }

    /**
     * Unfollow a user
     */
    unfollowUser(follower_id: string, following_id: string): boolean {
        const followerFollows = this.followsByFollower.get(follower_id);
        if (!followerFollows || !followerFollows.has(following_id)) {
            return false;
        }

        // Find and remove follow
        for (const [follow_id, follow] of this.follows.entries()) {
            if (follow.follower_id === follower_id && follow.following_id === following_id) {
                this.follows.delete(follow_id);
                followerFollows.delete(following_id);

                const followingFollowers = this.followsByFollowing.get(following_id);
                if (followingFollowers) {
                    followingFollowers.delete(follower_id);
                }

                return true;
            }
        }

        return false;
    }

    /**
     * Get followers of a user
     */
    getFollowers(user_id: string): string[] {
        const followers = this.followsByFollowing.get(user_id);
        return followers ? Array.from(followers) : [];
    }

    /**
     * Get users that a user is following
     */
    getFollowing(user_id: string): string[] {
        const following = this.followsByFollower.get(user_id);
        return following ? Array.from(following) : [];
    }

    /**
     * Check if user has liked a post
     */
    hasLikedPost(user_id: string, post_id: string): boolean {
        const userLikes = this.likesByUser.get(user_id);
        return userLikes ? userLikes.has(post_id) : false;
    }

    /**
     * Get feed for user (posts from followed users)
     */
    getFeed(user_id: string, limit: number = 50): Post[] {
        const following = this.getFollowing(user_id);
        const feedPosts: Post[] = [];

        for (const followedUserId of following) {
            const userPosts = this.getPostsByAuthor(followedUserId, 10);
            feedPosts.push(...userPosts);
        }

        // Sort by timestamp descending
        feedPosts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        return feedPosts.slice(0, limit);
    }

    /**
     * Get public posts (for explore/discover)
     */
    getPublicPosts(limit: number = 50): Post[] {
        const publicPosts = Array.from(this.posts.values())
            .filter((p) => p.visibility === PostVisibility.PUBLIC && p.status === PostStatus.APPROVED)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        return publicPosts.slice(0, limit);
    }
}
