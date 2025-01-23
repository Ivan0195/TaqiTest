import {
    Controller,
    Post,
    Body, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import {PtakDemoService} from "./ptakDemo.service";
import {FileInterceptor, FilesInterceptor} from "@nestjs/platform-express";

@Controller('ptakDemo')
export class PtakDemoController {
    constructor(private readonly ptakDemoService: PtakDemoService) {
    }

    @Post('faultCheck')
    @UseInterceptors(FileInterceptor('file'))
    async test(
        @Body() data: {
        prompt: string
    },
        @UploadedFile() file: Express.Multer.File
        ) {
        try {
            return await this.ptakDemoService.checkForFault({...data, file})
        } catch (err) {
            return err
        }
    }
}
