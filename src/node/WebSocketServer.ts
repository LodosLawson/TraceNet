import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Blockchain } from '../blockchain/core/Blockchain';
import { Mempool } from './Mempool';
import { ValidatorPool } from '../consensus/ValidatorPool';
import { Block } from '../blockchain/models/Block';
import { Transaction } from '../blockchain/models/Transaction';

/**
 * WebSocket events
 */
export enum WSEvent {
    NEW_BLOCK = 'newBlock',
    TX_CONFIRMED = 'txConfirmed',
    SIGN_REQUEST = 'signRequest',
    REWARD_PAID = 'rewardPaid',
    VALIDATOR_ONLINE = 'validatorOnline',
    VALIDATOR_OFFLINE = 'validatorOffline',
}

/**
 * WebSocket server for real-time events
 */
export class WebSocketServer {
    private io: SocketIOServer;
    private blockchain: Blockchain;
    private mempool: Mempool;
    private validatorPool: ValidatorPool;
    private connectedClients: Map<string, Socket>;

    constructor(
        httpServer: HTTPServer,
        blockchain: Blockchain,
        mempool: Mempool,
        validatorPool: ValidatorPool
    ) {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
            },
        });

        this.blockchain = blockchain;
        this.mempool = mempool;
        this.validatorPool = validatorPool;
        this.connectedClients = new Map();

        this.setupEventHandlers();
    }

    /**
     * Setup event handlers
     */
    private setupEventHandlers(): void {
        this.io.on('connection', (socket: Socket) => {
            console.log(`Client connected: ${socket.id}`);
            this.connectedClients.set(socket.id, socket);

            // Handle client subscription
            socket.on('subscribe', (data: { events: string[] }) => {
                if (data.events) {
                    data.events.forEach((event) => {
                        socket.join(event);
                    });
                    socket.emit('subscribed', { events: data.events });
                }
            });

            // Handle client unsubscription
            socket.on('unsubscribe', (data: { events: string[] }) => {
                if (data.events) {
                    data.events.forEach((event) => {
                        socket.leave(event);
                    });
                    socket.emit('unsubscribed', { events: data.events });
                }
            });

            // Handle validator sign response
            socket.on('signResponse', (data: {
                tx_id: string;
                validator_id: string;
                signature: string;
            }) => {
                this.handleSignResponse(data);
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
                this.connectedClients.delete(socket.id);
            });
        });
    }

    /**
     * Broadcast new block
     */
    broadcastNewBlock(block: Block, producerId: string, txCount: number): void {
        this.io.to(WSEvent.NEW_BLOCK).emit(WSEvent.NEW_BLOCK, {
            block: block.toJSON(),
            producer_id: producerId,
            transaction_count: txCount,
            timestamp: Date.now(),
        });

        console.log(`Broadcasted new block ${block.index} to subscribers`);
    }

    /**
     * Broadcast transaction confirmation
     */
    broadcastTxConfirmed(txId: string, blockIndex: number, blockHash: string): void {
        this.io.to(WSEvent.TX_CONFIRMED).emit(WSEvent.TX_CONFIRMED, {
            tx_id: txId,
            block_index: blockIndex,
            block_hash: blockHash,
            timestamp: Date.now(),
        });

        console.log(`Broadcasted transaction confirmation for ${txId}`);
    }

    /**
     * Send sign request to validators
     */
    sendSignRequest(
        validatorIds: string[],
        txId: string,
        transaction: Transaction
    ): void {
        // In a real implementation, this would send to specific validator connections
        // For now, broadcast to all subscribers
        this.io.to(WSEvent.SIGN_REQUEST).emit(WSEvent.SIGN_REQUEST, {
            validator_ids: validatorIds,
            tx_id: txId,
            transaction,
            timestamp: Date.now(),
        });

        console.log(`Sent sign request for tx ${txId} to ${validatorIds.length} validators`);
    }

    /**
     * Broadcast reward payment
     */
    broadcastRewardPaid(
        validatorId: string,
        amount: number,
        type: string,
        txId: string
    ): void {
        this.io.to(WSEvent.REWARD_PAID).emit(WSEvent.REWARD_PAID, {
            validator_id: validatorId,
            amount,
            type,
            tx_id: txId,
            timestamp: Date.now(),
        });

        console.log(`Broadcasted reward payment to ${validatorId}: ${amount}`);
    }

    /**
     * Broadcast validator online status
     */
    broadcastValidatorOnline(validatorId: string): void {
        this.io.to(WSEvent.VALIDATOR_ONLINE).emit(WSEvent.VALIDATOR_ONLINE, {
            validator_id: validatorId,
            timestamp: Date.now(),
        });
    }

    /**
     * Broadcast validator offline status
     */
    broadcastValidatorOffline(validatorId: string): void {
        this.io.to(WSEvent.VALIDATOR_OFFLINE).emit(WSEvent.VALIDATOR_OFFLINE, {
            validator_id: validatorId,
            timestamp: Date.now(),
        });
    }

    /**
     * Handle sign response from validator
     */
    private handleSignResponse(data: {
        tx_id: string;
        validator_id: string;
        signature: string;
    }): void {
        // This would be handled by the SignatureCoordinator
        // Emit event for coordinator to pick up
        this.io.emit('internal:signResponse', data);
    }

    /**
     * Get connected client count
     */
    getConnectedCount(): number {
        return this.connectedClients.size;
    }

    /**
     * Get subscriber count for event
     */
    getSubscriberCount(event: WSEvent): number {
        const room = this.io.sockets.adapter.rooms.get(event);
        return room ? room.size : 0;
    }

    /**
     * Get statistics
     */
    getStats(): {
        connectedClients: number;
        subscribers: Record<string, number>;
    } {
        return {
            connectedClients: this.getConnectedCount(),
            subscribers: {
                [WSEvent.NEW_BLOCK]: this.getSubscriberCount(WSEvent.NEW_BLOCK),
                [WSEvent.TX_CONFIRMED]: this.getSubscriberCount(WSEvent.TX_CONFIRMED),
                [WSEvent.SIGN_REQUEST]: this.getSubscriberCount(WSEvent.SIGN_REQUEST),
                [WSEvent.REWARD_PAID]: this.getSubscriberCount(WSEvent.REWARD_PAID),
                [WSEvent.VALIDATOR_ONLINE]: this.getSubscriberCount(WSEvent.VALIDATOR_ONLINE),
                [WSEvent.VALIDATOR_OFFLINE]: this.getSubscriberCount(WSEvent.VALIDATOR_OFFLINE),
            },
        };
    }
    /**
     * Get Socket.IO instance
     */
    getIO(): SocketIOServer {
        return this.io;
    }
}
