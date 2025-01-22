import {
    Controller,
    Post,
    Body,
} from '@nestjs/common';
import {PtakDemoService} from "./ptakDemo.service";

@Controller('ptakDemo')
export class PtakDemoController {
    constructor(private readonly ptakDemoService: PtakDemoService) {
    }

    @Post('faultCheck')

    async test(
        @Body() data: {
        prompt: string
    }) {
        try {
            return await this.ptakDemoService.checkForFault(data.prompt)
        } catch (err) {
            return err
        }
    }
}
