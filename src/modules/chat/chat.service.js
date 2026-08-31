import { 
  Dependencies, 
  Injectable, 
  forwardRef, 
} from '@nestjs/common';

import { SupabaseDbService } from '../../supabase/supabase-db.service';

import { ChatGateway } from './chat.gateway';

@Injectable()
// use forwardRef because ChatService and ChatGateway depend on each other.
// ChatService needs ChatGateway to broadcast message deletions
// ChatGateway needs ChatService for chat operations
// forwardRef allows NestJS to resolve this circular dependency
@Dependencies(SupabaseDbService, forwardRef(() => ChatGateway))
export class ChatService {
  constructor(supabaseDbService, chatGateway) {
    this.supabaseDbService = supabaseDbService;
    this.chatGateway = chatGateway;
  }

  async getOrCreateRoom(orgId) {
    const supabase = this.supabaseDbService.getClient();

    // check if org already has a chat room
    const { data: existingRoom, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle();

    if(error) {
        throw error;
    }

    // if room already exists return it
    if(existingRoom) {
        return existingRoom;
    }

    // if it does not exist then create a room
    const { data: newRoom, error: createError } = await supabase
        .from('chat_rooms')
        .insert({
            org_id: orgId,
            name: 'General',
        })
        .select()
        .single();

    if(createError) {
        throw createError;
    }

    return newRoom;
  }

  async saveMessage(roomId, senderId, content) {
    const supabase = this.supabaseDbService.getClient();
    
    // save the message
    const { data: message, error } = await supabase
        .from('chat_messages')
        .insert({
            room_id: roomId,
            sender_id: senderId,
            content: content,
        })
        .select(`
            id,
            room_id,
            sender_id,
            content,
            created_at,
            users (
                name,
                avatar_url
            )
        `)
        .single();

    if(error) {
        throw error;
    }

    // return message in format expected by frontend
    return {
        id: message.id,
        roomId: message.room_id,
        senderId: message.sender_id,
        senderName: message.users?.name,
        senderAvatar: message.users?.avatar_url,
        content: message.content,
        createdAt: message.created_at,
    };
  }

  async getMessages(roomId, limit, offset) {
    const supabase = this.supabaseDbService.getClient();

    const { data: messages, error, count } = await supabase
        .from('chat_messages')
        .select(`
            id,
            room_id,
            sender_id,
            content,
            created_at,
            users (
                name,
                avatar_url
            )
        `, { count: 'exact' })
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if(error) {
        throw error;
    }

    messages.reverse(); // chat UI opens up with recent messages and scroll up for older messages

    // check if there are more messages after this page
    const hasMore = count > offset + messages.length;

    return {
        messages: messages.map((message) => ({
            id: message.id,
            roomId: message.room_id,
            senderId: message.sender_id,
            senderName: message.users?.name,
            senderAvatar: message.users?.avatar_url,
            content: message.content,
            createdAt: message.created_at,
        })),
        hasMore,
        total: count,
    };
  }

  async getHistory(userId, page) {
    const supabase = this.supabaseDbService.getClient();
    
    // find organization this user belongs to
    const { data: teamMember, error: teamMemberError } = await supabase
        .from('team_members')
        .select('org_id')
        .eq('user_id', userId)
        .maybeSingle();

    if (teamMemberError || !teamMember) {
        throw teamMemberError || new Error('Organization not found');
    }

    // get the chat room for this organization
    const room = await this.getOrCreateRoom(teamMember.org_id);

    const currPage = Math.max(1, parseInt(page, 10) || 1);
    const currLimit = 20;
    const offset = (currPage - 1) * currLimit;

    return this.getMessages(room.id, currLimit, offset);

  }

  async getMessageToDelete(messageId) {
    const supabase = this.supabaseDbService.getClient();
    
    // get the message to check who owns it and which room it belongs to
    const { data: message, error } = await supabase
        .from('chat_messages')
        .select('id, room_id, sender_id')
        .eq('id', messageId)
        .single();

    // throw error is message not found
    if (error) {
        throw error;
    }

    return message;
  }

  async deleteMessage(messageId) {
    const supabase = this.supabaseDbService.getClient();

    // delete the message from the db and return its id and room id
    const { data: message, error: deleteError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .select('id, room_id')
        .single();

    // throw error is message could not be deleted
    if (deleteError) {
        throw deleteError;
    }

    // broadcast the deleted message to everyone in the room
    this.chatGateway.server.to(message.room_id).emit('messageDeleted', {
        messageId: message.id,
    });

    return message;
  }
}