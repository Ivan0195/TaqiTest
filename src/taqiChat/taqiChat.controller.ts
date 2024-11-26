import {
    Controller,
    HttpException,
    Post,
    UseInterceptors,
    UploadedFiles,
    Query, Body,
} from '@nestjs/common';
import {IChatMessege, ITemplate, TaqiChatService} from './taqiChat.service';
import {FilesInterceptor} from '@nestjs/platform-express';

@Controller('taqiChat')
export class TaqiChatController {
    constructor(private readonly taqiChatService: TaqiChatService) {
    }

    @Post('getAnswer')
    async generateAnswer(
        @Body() data: {
            userId: string,
            template?: ITemplate,
            question: string,
            dropContext?: boolean,
            chatHistory?: IChatMessege[],
        }
    ) {
        try {
            return await this.taqiChatService.generateAnswer(data);
        } catch (err) {
            if (err.message) {
                throw new HttpException(err.message, err.status);
            }
            throw new HttpException(err, 500);
        }
    }
}
