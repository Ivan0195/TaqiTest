import {
    Controller,
    HttpException,
    Post,
    Body,
    Get
} from '@nestjs/common';
import {IChatMessage, ITemplate, TaqiChatService} from './taqiChat.service';

@Controller('taqiChat')
export class TaqiChatController {
    constructor(private readonly taqiChatService: TaqiChatService) {
    }

    @Get('getTestAnswer')
    async testTaqi() {
        try {
            return await this.taqiChatService.testTaqi();
        } catch (err) {
            if (err.message) {
                throw new HttpException(err.message, err.status);
            }
            throw new HttpException(err, 500);
        }
    }

    @Post('getAnswer')
    async generateAnswer(
        @Body() data: {
            userId: string,
            template?: ITemplate,
            question: string,
            dropContext?: boolean,
            chatHistory?: IChatMessage[],
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
