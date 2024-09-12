import { Test, TestingModule } from '@nestjs/testing';
import { TradebotController } from './tradebot.controller';
import { TradebotService } from './tradebot.service';
import { HttpModule } from '@nestjs/axios';
import { PriceTickerModule } from '../price_ticker/price_ticker.module';
import { StrategiesModule } from '../strategies/strategies.module';
import { DewtModule } from '../dewt/dewt.module';
import { TransactionModule } from '../transaction/transaction.module';
import { UserModule } from '../user/user.module';
import { DewtService } from '../dewt/dewt.service';
import { PriceTickerService } from '../price_ticker/price_ticker.service';
import { StrategiesService } from '../strategies/strategies.service';
import { TransactionService } from '../transaction/transaction.service';
import { UserService } from '../user/user.service';

describe('TradebotController', () => {
  let controller: TradebotController;
  // let tradebotService: TradebotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TradebotController],
      providers: [
        TradebotService,
        PriceTickerService,
        StrategiesService,
        DewtService,
        TransactionService,
        UserService,
      ],
      imports: [
        PriceTickerModule,
        StrategiesModule,
        DewtModule,
        TransactionModule,
        UserModule,
        HttpModule,
      ],
    }).compile();

    controller = module.get<TradebotController>(TradebotController);
    // tradebotService = module.get<TradebotService>(TradebotService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
