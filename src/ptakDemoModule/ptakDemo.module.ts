import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {PtakDemoService} from "./ptakDemo.service";
import {PtakDemoController} from "./ptakDemo.controller";

@Module({
    imports: [ConfigModule],
    controllers: [PtakDemoController],
    providers: [PtakDemoService],
})
export class PtakDemoModule {}
