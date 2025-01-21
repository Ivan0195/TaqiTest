import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {WebAssistService} from "./webAssist.service";
import {WebAssistController} from "./webAssist.controller";

@Module({
    imports: [ConfigModule],
    controllers: [WebAssistController],
    providers: [WebAssistService],
})
export class WebAssistModule {}
