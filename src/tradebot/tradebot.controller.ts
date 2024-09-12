import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TradebotService } from './tradebot.service';

@Controller('tradebot')
export class TradebotController {
  constructor(private readonly tradebotService: TradebotService) {}

  @Post()
  async create() {
    const createTradebot = await this.tradebotService.create();
    if (!createTradebot) {
      throw new HttpException(
        'Tradebot not created',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const { returnDeposit, tradebot } =
      await this.tradebotService.receiveDeposit(createTradebot);
    if (!returnDeposit) {
      return 'Tradebot is created, but deposit is not sucessful';
    }
    return (
      'Tradebot ' +
      tradebot.id +
      ' created at ' +
      tradebot.created_at +
      ' public address is ' +
      tradebot.wallet.address +
      ' private key is ' +
      tradebot.wallet.privateKey +
      ' and received deposit is ' +
      returnDeposit +
      ' and currentAvailable = ' +
      tradebot.currentAsset.data.balance.available
    );
  }

  @Get()
  async getTradebot(@Query('id') id?: string) {
    if (id == null) {
      const tradebotArray = await this.tradebotService.getAllTradebots();
      const tradebots = tradebotArray.map((tradebot) => ({
        tradebot: tradebot.toJSON(),
        'private key': tradebot.wallet.privateKey,
      }));
      return tradebots;
    }
    const tradebot = await this.tradebotService.getTradebotById(id);
    return {
      tradebot: tradebot.toJSON(),
      'private key': tradebot.wallet.privateKey,
    };
  }

  @Put()
  async updateTradebot(
    @Query('id') id: string,
    @Body()
    data: {
      suggestion?: string;
      stopLoss?: string;
      takeProfit?: string;
    },
  ) {
    const tradebot = await this.tradebotService.getTradebotById(id);
    if (!tradebot) {
      return 'Tradebot not found';
    }
    const updatedTradebot = await this.tradebotService.updateTradebot(
      tradebot,
      data,
    );
    return tradebot.id + ' update ' + ' is ' + updatedTradebot;
  }

  @Post(':tradebotId')
  async command(
    @Param('tradebotId') id: string,
    @Body() data: { strategy: string; command: string },
  ) {
    try {
      const tradebot = await this.tradebotService.getTradebotById(id);
      if (!tradebot) {
        return 'Tradebot not found';
      }
      if (data.command === 'run') {
        const runCommand = this.tradebotService.run(tradebot);
        return runCommand;
      }
      if (data.command === 'stop') {
        const stopCommand = this.tradebotService.stop(tradebot);
        return stopCommand;
      }
      if (data.command === 'deposit') {
        const depositCommand = this.tradebotService.receiveDeposit(tradebot);
        return depositCommand;
      }
      if (data.command === 'aiTrade') {
        const runAiCommand = this.tradebotService.aiTrade(tradebot);
        return runAiCommand;
      }
      return data.command + 'is invalid command';
    } catch (error) {
      return error.message;
    }
  }
}
