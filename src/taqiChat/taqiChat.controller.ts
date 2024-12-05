import {
    Controller,
    HttpException,
    Post,
    Body,
    Get, UseInterceptors, UploadedFiles
} from '@nestjs/common';
import {IChatMessage, IFile, ITemplate, TaqiChatService} from './taqiChat.service';
import {FilesInterceptor} from "@nestjs/platform-express";

@Controller('taqiChat')
export class TaqiChatController {
    constructor(private readonly taqiChatService: TaqiChatService) {
    }

    @Post('tipsTest')
    async tipsTest(
        @Body() data: {
            userId: string,
            template?: ITemplate,
            question: string,
            dropContext?: boolean,
            chatHistory?: IChatMessage[],
        }
    ) {
        try {
            return await this.taqiChatService.tipsTest(data);
        } catch (err) {
            if (err.message) {
                throw new HttpException(err.message, err.status);
            }
            throw new HttpException(err, 500);
        }
    }

    @Post('getAnswer')
    @UseInterceptors(FilesInterceptor('files'))
    async generateAnswer(
        @Body() data: {
            userId: string,
            template?: string,
            question: string,
            dropContext?: boolean,
            chatHistory?: IChatMessage[],
        },
    @UploadedFiles() files: Express.Multer.File[]
    ) {
        try {
                return await this.taqiChatService.generateAnswer({...data, files});
        } catch (err) {
            if (err.message) {
                throw new HttpException(err.message, err.status);
            }
            throw new HttpException(err, 500);
        }
    }
}
