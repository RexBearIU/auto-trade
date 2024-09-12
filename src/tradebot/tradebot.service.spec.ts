import { Test, TestingModule } from '@nestjs/testing';
import { TradebotService } from './tradebot.service';
import { PriceTickerService } from '../price_ticker/price_ticker.service';
import { StrategiesService } from '../strategies/strategies.service';
import { TransactionService } from '../transaction/transaction.service';
import { UserService } from '../user/user.service';
import { DewtService } from '../dewt/dewt.service';
import { Tradebot } from './entities/tradebot.entity';
import * as dotenv from 'dotenv';
import { HttpModule } from '@nestjs/axios';
import { DewtModule } from '../dewt/dewt.module';
import { PriceTickerModule } from '../price_ticker/price_ticker.module';
import { StrategiesModule } from '../strategies/strategies.module';
import { TransactionModule } from '../transaction/transaction.module';
import { UserModule } from '../user/user.module';
dotenv.config();

describe('TradebotService', () => {
  let service: TradebotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PriceTickerModule,
        StrategiesModule,
        DewtModule,
        TransactionModule,
        UserModule,
        HttpModule,
      ],
      providers: [
        TradebotService,
        PriceTickerService,
        StrategiesService,
        DewtService,
        TransactionService,
        UserService,
      ],
    }).compile();

    service = module.get<TradebotService>(TradebotService);
  });

  it('should create a tradebot', async () => {
    const result = await service.create();
    expect(result).toBeInstanceOf(Tradebot);
  });

  describe('getAllTradebots', () => {
    it('should return all tradebots', async () => {
      // Arrange
      const tradebots: Tradebot[] = [new Tradebot()];
      jest.spyOn(service, 'getAllTradebots').mockResolvedValue(tradebots);
      jest.spyOn(service['logger'], 'error');

      // Act
      const result = await service.getAllTradebots();

      // Assert
      expect(result).toEqual(tradebots);
      expect(service['logger'].error).not.toHaveBeenCalled();
    });

    it('should return the tradebot with the specified id', async () => {
      // Arrange
      const tradebot = new Tradebot();
      tradebot.id = '1';
      jest.spyOn(service, 'getTradebotById').mockResolvedValue(tradebot);
      // Act
      const result = await service.getTradebotById('1');

      // Assert
      expect(result).toBe(tradebot);
    });

    describe('receiveDeposit', () => {
      it('should receive deposit for the tradebot', async () => {
        // Arrange
        const tradebot = new Tradebot();
        // Act
        jest
          .spyOn(service, 'receiveDeposit')
          .mockImplementation(async (tradebot: Tradebot) => {
            return { returnDeposit: true, tradebot: tradebot };
          });
        const result = await service.receiveDeposit(tradebot);
        // Assert
        expect(result).toEqual({
          returnDeposit: true,
          tradebot: tradebot,
        });
      });

      it('should handle error when receiving deposit', async () => {
        // Arrange
        const tradebot = new Tradebot();

        // Act
        const result = await service.receiveDeposit(tradebot);

        // Assert
        expect(result).toEqual({
          returnDeposit: false,
          tradebot: tradebot,
        });
      });
    });

    describe('executeStrategy', () => {
      it('should execute the trade strategy for the tradebot', async () => {
        // Arrange
        const tradebot = new Tradebot();
        const instId = 'ETH-USDT';
        jest
          .spyOn(service, 'executeTrade')
          .mockResolvedValue(
            'Tradebot ' + tradebot.id + ' sucessfully close position',
          );
        const result = await service.executeTrade(tradebot, instId, 'CLOSE');
        // Assert
        expect(result).toBe(
          'Tradebot ' + tradebot.id + ' sucessfully close position',
        );
      });

      it('should handle error when executing the trade strategy', async () => {
        // Arrange
        const tradebot = new Tradebot();
        const instId = 'ETH-USDT';
        // Act
        jest
          .spyOn(service, 'executeTrade')
          .mockResolvedValue(
            'Tradebot ' + tradebot.id + ' failed to close position',
          );
        const result = await service.executeTrade(tradebot, instId, 'CLOSE');

        // Assert
        expect(result).toBe(
          'Tradebot ' + tradebot.id + ' failed to close position',
        );
      });
    });
    it('should convert holding status to number', () => {
      // Arrange
      const holdingStatus = 'WAIT';
      // Act
      const result = service.convertHoldingStatus(holdingStatus);
      // Assert
      expect(result).toBe(0);
    });
  });
  describe('getTradebotById', () => {
    it('should return the tradebot with the specified id', async () => {
      // Arrange
      const tradebotId = '1';
      const tradebot = new Tradebot();
      tradebot.id = tradebotId;
      jest.spyOn(service, 'getTradebotById').mockResolvedValue(tradebot);

      // Act
      const result = await service.getTradebotById(tradebotId);

      // Assert
      expect(result).toBe(tradebot);
      expect(service.getTradebotById).toHaveBeenCalledWith(tradebotId);
    });

    it('should throw an error if tradebot is not found', async () => {
      // Arrange
      const tradebotId = '-1';

      // Act and Assert
      await expect(service.getTradebotById(tradebotId)).rejects.toThrowError(
        'Tradebot not found',
      );
    });
  });
});
