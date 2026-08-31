import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayInit } from '@nestjs/websockets';
import { Dependencies, forwardRef } from '@nestjs/common';
import { SupabaseDbService } from '../../supabase/supabase-db.service';
import { ChatService } from './chat.service';

const MAX_MESSAGE_LENGTH = 2000;

@WebSocketGateway({ 
    cors: { 
        origin: process.env.FRONTEND_URL ,
    }, 
})
@Dependencies(SupabaseDbService, forwardRef(() => ChatService))
export class ChatGateway {
    @WebSocketServer()
    server;

    onlineUsers = new Map();

    constructor(supabaseDbService, chatService) {
        this.supabaseDbService = supabaseDbService;
        this.chatService = chatService;
    }

    // Set up Socket.IO auth and room membership before accepting the connection.
    // Previously, this code was in handleConnection() but it was moved here because handleConnection()
    // runs async so the client could send messages before the authentication and room setup was finished.
    // This code block sets up the Socket.IO middleware which waits for the setup to finish before allowing
    // the connection so that the user and roomId data are ready when the client sends messages.

    // The middleware finishes authentication and room setup before allowing the connection.
    // Previously, the client could send messages before socket.data.user and socket.data.roomId
    // were ready, causing the message handler to fail because it did not have the user and room data.
    afterInit(server) {
        server.use(async (socket, next) => {
            try {
                console.log("connection attempt");
                const token = socket.handshake.auth.token;

                // reject connection if token not provided
                if (!token) {
                    return next(new Error('Authentication token missing'));
                }

                const supabase = this.supabaseDbService.getClient();

                // validate JWT token by checking if token valid and belongs to an existing user
                const { data, error } = await supabase.auth.getUser(token);

                // reject connection is error or no user found
                if (error || !data.user) {
                    return next(new Error('Authentication failed'));
                }

                // find organization this user belongs to
                const { data: teamMember, error: teamMemberError } = await supabase
                    .from('team_members')
                    .select('org_id')
                    .eq('user_id', data.user.id)
                    .maybeSingle();

                if (teamMemberError || !teamMember) return next(new Error('User organization not found'));

                const room = await this.chatService.getOrCreateRoom(teamMember.org_id);

                // store authenticated user on the socket
                // allows future socket events to access the user without validating token again
                socket.data.user = data.user;
                socket.data.roomId = room.id;
                socket.join(room.id);

                next(); // handshake only completes after this
            } catch (error) {
                next(error);
            }
        });
    }

    async handleConnection(socket) {
        console.log(`User ${socket.data.user.id} connected with socket ${socket.id} and joined room ${socket.data.roomId}`);
        
        const roomId = socket.data.roomId;
        const userId = socket.data.user.id;

        if(!this.onlineUsers.has(roomId)) {
            this.onlineUsers.set(roomId, new Set());
        }

        this.onlineUsers.get(roomId).add(userId);

        this.server.to(roomId).emit('presenceUpdate', {
            onlineUsers: [...this.onlineUsers.get(roomId)],
        });
    }

    // listen for sendMessage event by frontend
    @SubscribeMessage('sendMessage')
    async handleSendMessage(socket, payload) {
        try {
            // get message content
            // ex. payload = { "content": "hello" }
            const { content } = payload || {};

            // only trim content when it is a string, invalid or missing content becomes empty string
            const trimmedContent = typeof content === 'string' ? content.trim() : ''; 

            if(!trimmedContent) {
                socket.emit('error', {
                    message: 'Message content is required',
                });
                return;
            }

            if(trimmedContent.length > MAX_MESSAGE_LENGTH) {
                socket.emit('error', {
                    message: 'Message is too long',
                });
                return;
            }

            // get room this authenticated socket joined
            const roomId = socket.data.roomId;

            // get id of authenticated user
            const senderId = socket.data.user.id;

            // send message to supabase using ChatService
            const message = await this.chatService.saveMessage(
                roomId,
                senderId,
                trimmedContent
            );

            // broadcast saved message to every socket currently connected to this room
            this.server.to(roomId).emit('newMessage', message);

        } catch (error) {
            console.error('handleSendMessage failed:', error);
            socket.emit('error', {
                message: 'Failed to send message',
            });
        }  
    }

    // listen for typing event from frontend
    @SubscribeMessage('typing')
    handleTyping(socket, payload) {

        // get typing status sent by frontend
        const { isTyping } = payload || {};

        // get room this authenticated socket joined
        const roomId = socket.data.roomId;

        // get id of authenticated user
        const userId = socket.data.user.id;

        // get name of authenticated user
        const name = socket.data.user.user_metadata?.name;

        // broadcast typing status to everyone in the room except for the sender
        socket.to(roomId).emit('userTyping', {
            userId,
            name,
            isTyping,
        });
    }

    // listen for getHistory event by frontend
    @SubscribeMessage('getHistory')
    async handleGetHistory(socket, payload) {
        try {
            // get page number from payload
            const page = Math.max(1, parseInt(payload?.page, 10) || 1); // converts page value into an integer and ensures number is not less than 1, else use fallback value of 1
            const limit = 20;

            // calculate how many messages to skip before getting this page
            const offset = (page - 1) * limit;

            // get room this authenticated socket joined
            const roomId = socket.data.roomId;
            
            // call ChatService to retrieve messages for this room
            const { messages, hasMore } = await this.chatService.getMessages(
                roomId,
                limit,
                offset
            );

            // send history back to socket that requestes it
            socket.emit('chatHistory', {
                messages,
                hasMore,
            });
        } catch (error) {
            console.error('handleGetHistory failed:', error);
            socket.emit('error', {
                message: 'Failed to load chat history',
            });
        }  
    }

    handleDisconnect(socket) {
        console.log(`User ${socket.data.user?.id} disconnected`);
        
        const roomId = socket.data.roomId;
        const userId = socket.data.user?.id;

        if (!roomId || !userId) {
            return;
        }

        const users = this.onlineUsers.get(roomId);

        if (!users) {
            return;
        }

        users.delete(userId);

        this.server.to(roomId).emit('presenceUpdate', {
            onlineUsers: [...users],
        });

        if (users.size === 0) {
            this.onlineUsers.delete(roomId);
        }
    }
}