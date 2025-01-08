import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {TaqiChatModule} from "./taqiChat/taqiChat.module";
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [TaqiChatModule, ConfigModule.forRoot()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
