import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {TaqiChatModule} from "./taqiChat/taqiChat.module";
import {WebAssistModule} from "./esmilTestModule/webAssist.module";
import {PtakDemoModule} from "./ptakDemoModule/ptakDemo.module";
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [TaqiChatModule, WebAssistModule, PtakDemoModule, ConfigModule.forRoot()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
