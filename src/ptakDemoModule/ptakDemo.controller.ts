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
    async test() {
        try {
            return await this.ptakDemoService.checkForFault()
        } catch (err) {
            return err
        }
    }
}
