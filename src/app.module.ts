import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {TaqiChatModule} from "./taqiChat/taqiChat.module";

@Module({
  imports: [TaqiChatModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
