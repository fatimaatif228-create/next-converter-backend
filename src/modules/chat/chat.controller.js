import {
    Bind,
    Controller,
    Get,
    Delete,
    Param,
    Query,
    UseGuards,
    ForbiddenException,
} from '@nestjs/common';

import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
    ApiQuery,
    ApiParam,
} from '@nestjs/swagger';

import { Dependencies } from '@nestjs/common';

import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Chat')
@Controller('chat')
@Dependencies(ChatService)
export class ChatController {
    constructor(chatService) {
        this.chatService = chatService;
    }

    @Get('history')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get paginated chat history' })
    @ApiQuery({
        name: 'page',
        required: false,
        example: 1,
        description: 'Page number of chat history',
    })
    @ApiResponse({
        status: 200,
        description: 'Paginated chat history returned successfully',
    })
    @ApiResponse({
        status: 401,
        description: 'Invalid or expired token',
    })
    @Bind(CurrentUser(), Query('page'))
    async getHistory(user, page) {
        return this.chatService.getHistory(user.id, page);
    }

    @Delete('messages/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete your own chat message' })
    @ApiParam({
        name: 'id',
        required: true,
        description: 'ID of the message to delete',
    })
    @ApiResponse({
        status: 200,
        description: 'Message deleted successfully',
    })
    @ApiResponse({
        status: 401,
        description: 'Invalid or expired token',
    })
    @ApiResponse({
        status: 403,
        description: 'You can only delete your own messages',
    })
    @Bind(Param('id'), CurrentUser())
    async deleteMessage(messageId, user) {
        // get the message to check who owns it
        const message = await this.chatService.getMessageToDelete(messageId);

        // only allow the user who sent the message to delete it
        if (message.sender_id !== user.id) {
            throw new ForbiddenException('You can only delete your own messages');
        }

        // delete the message after verifying the user is the owner
        const deletedMessage = await this.chatService.deleteMessage(messageId);

        return deletedMessage;
    }
}