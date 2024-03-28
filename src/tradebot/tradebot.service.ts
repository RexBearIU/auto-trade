import { Injectable, Logger } from '@nestjs/common';
import { Tradebot } from './entities/tradebot.entity';
import { UserService } from '../user/user.service';
import { DewtService } from '../dewt/dewt.service';
import { PriceTickerService } from '../price_ticker/price_ticker.service';
import { StrategiesService } from '../strategies/strategies.service';
import { TransactionService } from '../transaction/transaction.service';

@Injectable()
export class TradebotService {
  constructor(
    private readonly userService: UserService,
    private readonly dewtService: DewtService,
    private readonly priceTickerService: PriceTickerService,
    private readonly strategiesService: StrategiesService,
    private readonly trancsactionService: TransactionService,
  ) {}
  private readonly logger = new Logger(TradebotService.name);
  // TODO: (20240315 Jacky) : Should store the tradebot in the database in the future
  private tradebotArray: Tradebot[] = [];
  async create(): Promise<Tradebot> {
    try {
      const tradebot = new Tradebot();
      tradebot.dewt = await this.dewtService.create(
        tradebot.wallet.address,
        tradebot.wallet.privateKey.slice(2),
      );
      // TODO: (20240315 Jacky) : Should store the tradebot in the database in the future
      for (let i = 0; i < 3; i++) {
        const register = await this.userService.registerUser(
          tradebot.wallet.address,
          tradebot.dewt,
        );
        if (register.success == true) {
          this.logger.log(
            'Tradebot ' + tradebot.id + ' regist is ' + register.success,
          );
          // TODO: maybe add the tradebot to the database
          this.tradebotArray.push(tradebot);
          this.logger.log(
            'Tradebot ' +
              tradebot.id +
              ' created at ' +
              tradebot.created_at +
              ' public address is ' +
              tradebot.wallet.address,
          );
          return tradebot;
        }
      }
    } catch (error) {
      this.logger.error('Error creating tradebot: ' + error.message);
    }
  }

  async getAllTradebots(): Promise<Tradebot[]> {
    if (this.tradebotArray.length === 0) {
      this.logger.error('No tradebots found');
    }
    return this.tradebotArray;
  }

  async getTradebotById(id: string): Promise<Tradebot> {
    const tradebot = this.tradebotArray.find((tradebot) => tradebot.id === id);
    if (!tradebot) {
      this.logger.error('Tradebot not found');
    }
    this.logger.log('Tradebot ' + tradebot.id + ' is found');
    return tradebot;
  }

  // TODO: add the deposit to the database
  async receiveDeposit(tradebot: Tradebot) {
    try {
      this.logger.log('Tradebot ' + tradebot.id + ' is receiving deposit');
      const register = await this.userService.registerUser(
        tradebot.wallet.address,
        tradebot.dewt,
      );
      if (register.success == false) {
        tradebot.dewt = await this.dewtService.create(
          tradebot.wallet.address,
          tradebot.wallet.privateKey.slice(2),
        );
        this.logger.error(
          'create dewt for tradebot ' + tradebot.id + ' register failed',
        );
      }
      for (let i = 0; i < 3; i++) {
        const createDepositDto =
          await this.trancsactionService.createDepositDto();
        const deposit = await this.trancsactionService.deposit(
          tradebot.dewt,
          createDepositDto,
        );
        if (deposit.success === true) {
          tradebot.currentAsset = await this.userService.getMyAsset(
            tradebot.dewt,
          );
          this.logger.log(
            'Tradebot ' +
              tradebot.id +
              ' received deposit is ' +
              deposit.success +
              ' and currentAvailable = ' +
              tradebot.currentAsset.data.balance.available,
          );
          tradebot.updated_at = new Date();
          return {
            returnDeposit: true,
            tradebot: tradebot,
          };
        }
      }
      this.logger.error(
        'Tradebot ' + tradebot.id + ' failed to receive deposit',
      );
      return {
        returnDeposit: false,
        tradebot: tradebot,
      };
    } catch (error) {
      this.logger.error(
        tradebot.id + ' Error receiving deposit: ' + error.message,
      );
    }
  }
  async executeStrategy(tradebot: Tradebot, instId: string) {
    this.logger.log(
      'Tradebot ' +
        tradebot.id +
        ' is executing ' +
        instId +
        ' purchase strategy',
    );
    try {
      let quotation = await this.priceTickerService.getCFDQuotation(instId);
      const priceArray = await this.priceTickerService.getCandlesticks(instId);
      const suggestion = await this.strategiesService.getSuggestion(
        tradebot.suggestion,
        {
          priceArray: priceArray,
          currentPrice: quotation.data.spotPrice,
          spreadFee: quotation.data.spreadFee,
          holdingStatus: tradebot.holdingStatus,
        },
      );
      const takeProfit = await this.strategiesService.getTakeProfit(
        tradebot.takeProfit,
        {
          openPrice: tradebot.openPrice,
          currentPrice: quotation.data.spotPrice,
          spreadFee: quotation.data.spreadFee,
          holdingStatus: tradebot.holdingStatus,
        },
      );
      const stopLoss = await this.strategiesService.getStopLoss(
        tradebot.stopLoss,
        {
          openPrice: tradebot.openPrice,
          currentPrice: quotation.data.spotPrice,
          spreadFee: quotation.data.spreadFee,
          holdingStatus: tradebot.holdingStatus,
        },
      );
      if (
        suggestion === 'CLOSE' ||
        takeProfit === 'CLOSE' ||
        stopLoss === 'CLOSE'
      ) {
        const register = await this.userService.registerUser(
          tradebot.wallet.address,
          tradebot.dewt,
        );
        if (register.success == false) {
          tradebot.dewt = await this.dewtService.create(
            tradebot.wallet.address,
            tradebot.wallet.privateKey.slice(2),
          );
          this.logger.error(
            'create dewt for tradebot ' + tradebot.id + ' register failed',
          );
        }
        if (tradebot.holdingStatus === 'BUY') {
          quotation = await this.priceTickerService.getCFDQuotation(
            'SELL',
            tradebot.holdingInstId,
          );
        } else if (tradebot.holdingStatus === 'SELL') {
          quotation = await this.priceTickerService.getCFDQuotation(
            'BUY',
            tradebot.holdingInstId,
          );
        }
        const closeCFDOrderDto =
          await this.trancsactionService.closeCFDOrderDTO(
            quotation,
            tradebot.positionId,
          );
        const closeCFDOrder = await this.trancsactionService.closeCFDOrder(
          tradebot.dewt,
          tradebot.wallet.privateKey.slice(2),
          closeCFDOrderDto,
        );
        if (closeCFDOrder.success == false) {
          this.logger.error(
            'Tradebot ' +
              tradebot.id +
              ' failed to close position, ' +
              'message = ' +
              closeCFDOrder.message +
              ', and reason = ' +
              closeCFDOrder.reason,
          );
          return 'Tradebot ' + tradebot.id + ' failed to close position';
        }
        tradebot.holdingStatus = 'WAIT';
        tradebot.holdingInstId = null;
        tradebot.updated_at = new Date();
        tradebot.positionId = null;
        tradebot.openPrice = null;
        tradebot.currentAsset = await this.userService.getMyAsset(
          tradebot.dewt,
        );
        this.logger.log(
          'Tradebot ' + tradebot.id + ' successfully closed position',
        );
        return 'Tradebot ' + tradebot.id + ' successfully closed position';
      }
      if (suggestion === 'BUY' || suggestion === 'SELL') {
        const register = await this.userService.registerUser(
          tradebot.wallet.address,
          tradebot.dewt,
        );
        if (register.success == false) {
          tradebot.dewt = await this.dewtService.create(
            tradebot.wallet.address,
            tradebot.wallet.privateKey.slice(2),
          );
          this.logger.error(
            'create dewt for tradebot ' + tradebot.id + ' register is failed',
          );
        }
        quotation = await this.priceTickerService.getCFDQuotation(
          suggestion,
          instId,
        );
        const amount = this.trancsactionService.calculateAmount(
          tradebot.currentAsset.data.balance.available,
          quotation.data.price,
        );
        const createCFDOrderDto =
          await this.trancsactionService.createCFDOrderDTO(quotation, amount);
        const createCFDOrder = await this.trancsactionService.createCFDOrder(
          tradebot.dewt,
          tradebot.wallet.privateKey.slice(2),
          createCFDOrderDto,
        );
        if (createCFDOrder.success == false) {
          this.logger.error(
            'Tradebot ' +
              tradebot.id +
              ' failed to create position, ' +
              'message = ' +
              createCFDOrder.message +
              ', reason = ' +
              createCFDOrder.reason,
          );
          return 'Tradebot ' + tradebot.id + ' failed to create position';
        }
        tradebot.holdingStatus = suggestion;
        tradebot.holdingInstId = instId;
        tradebot.positionId = createCFDOrder.data.orderSnapshot.id;
        tradebot.openPrice = quotation.data.price;
        tradebot.updated_at = new Date();
        tradebot.currentAsset = await this.userService.getMyAsset(
          tradebot.dewt,
        );
        this.logger.log(
          'Tradebot ' +
            tradebot.id +
            ' created a ' +
            tradebot.holdingStatus +
            ' position in ' +
            instId,
        );
        return (
          'Tradebot ' +
          tradebot.id +
          ' created a ' +
          tradebot.holdingStatus +
          ' position in ' +
          instId
        );
      }
      if (tradebot.holdingStatus !== 'WAIT') {
        this.logger.log('Tradebot ' + tradebot.id + ' is holding position');
        return 'Tradebot ' + tradebot.id + ' is holding position';
      }
      this.logger.log('Tradebot ' + tradebot.id + ' is waiting for chance');
      return 'Tradebot ' + tradebot.id + ' is waiting for chance';
    } catch (error) {
      this.logger.error(
        tradebot.id + ' Error executing strategy: ' + error.message,
      );
    }
  }

  async run(tradebot: Tradebot) {
    console.log = () => {};
    if (tradebot.isRunning) {
      this.logger.log('Tradebot ' + tradebot.id + ' is already running');
      return 'Tradebot ' + tradebot.id + ' is already running';
    }
    tradebot.isRunning = true;
    tradebot.timer = setInterval(async () => {
      this.logger.log('Tradebot ' + tradebot.id + ' is running');
      const now = new Date();
      if (now.getHours() === 11 && now.getMinutes() === 30) {
        const receiveDeposit = await this.receiveDeposit(tradebot);
        this.logger.log(
          'Tradebot ' +
            tradebot.id +
            ' received deposit is ' +
            receiveDeposit +
            ' at ' +
            now +
            ' and currentAsset = ' +
            tradebot.currentAsset.data.balance.available,
        );
      }
      if (tradebot.holdingInstId !== 'BTC-USDT') {
        await this.executeStrategy(tradebot, 'ETH-USDT');
      }
      if (
        tradebot.holdingInstId !== 'ETH-USDT' &&
        tradebot.currentAsset.data.balance.available > 250
      ) {
        await this.executeStrategy(tradebot, 'BTC-USDT');
      }
    }, 1000 * 15);
    this.logger.log('Tradebot ' + tradebot.id + ' start running');
    return 'Tradebot ' + tradebot.id + ' start running';
  }
  async stop(tradebot: Tradebot) {
    if (!tradebot.isRunning) {
      this.logger.log('Tradebot ' + tradebot.id + ' is already stopped');
      return 'Tradebot ' + tradebot.id + ' is already stopped';
    }
    tradebot.isRunning = false;
    tradebot.updated_at = new Date();
    clearInterval(tradebot.timer);
    this.logger.log('Tradebot ' + tradebot.id + ' is stopped');
    return 'Tradebot ' + tradebot.id + ' is stopped';
  }

  async updateTradebot(
    tradebot: Tradebot,
    options: {
      suggestion?: string;
      stopLoss?: string;
      takeProfit?: string;
    },
  ): Promise<boolean> {
    if (!options.suggestion && !options.stopLoss && !options.takeProfit) {
      this.logger.error('Tradebot ' + tradebot.id + ' update failed');
      return false;
    }
    if (options.suggestion) {
      tradebot.suggestion = options.suggestion;
    }
    if (options.stopLoss) {
      tradebot.stopLoss = options.stopLoss;
    }
    if (options.takeProfit) {
      tradebot.takeProfit = options.takeProfit;
    }
    this.logger.log('Tradebot ' + tradebot.id + ' is updated');
    return true;
  }
}
