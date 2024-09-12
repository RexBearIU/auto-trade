import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PriceTickerModule } from './price_ticker/price_ticker.module';
import { DewtModule } from './dewt/dewt.module';
import { TransactionModule } from './transaction/transaction.module';
import { TradebotModule } from './tradebot/tradebot.module';
import { StrategiesModule } from './strategies/strategies.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UserModule,
    PriceTickerModule,
    DewtModule,
    TransactionModule,
    TradebotModule,
    StrategiesModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
