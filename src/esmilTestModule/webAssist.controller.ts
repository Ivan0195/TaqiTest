import {
    Controller,
    Post,
    Body,
} from '@nestjs/common';
import {WebAssistService} from "./webAssist.service";

@Controller('webAssist')
export class WebAssistController {
    constructor(private readonly webAssistService: WebAssistService) {
    }

    @Post('loadSite')
    async test() {
        try {
            return await this.webAssistService.functionCallingTest()
        } catch (err) {
            return err
        }
    }

    @Post('test')
    async test1() {
        try {
            return await this.webAssistService.axiosGraphQL()
        } catch (err) {
            return err
        }
    }
}
