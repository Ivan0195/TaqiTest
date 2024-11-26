import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TaqiChatService } from './taqiChat.service';
import {TaqiChatController} from "./taqiChat.controller";

@Module({
    imports: [ConfigModule],
    controllers: [TaqiChatController],
    providers: [TaqiChatService],
})
export class TaqiChatModule {}
