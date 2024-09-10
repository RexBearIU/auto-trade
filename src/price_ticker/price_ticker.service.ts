import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QuotationDto } from './dto/quotation.dto';
import { CandlestickDto } from './dto/candlestick.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DOMAIN_BACKEND } from '../common/constants/config';

@Injectable()
export class PriceTickerService {
  constructor(private readonly httpService: HttpService) {}
  ETHBuyQuotation: QuotationDto;
  ETHSellQuotation: QuotationDto;
  BTCBuyQuotation: QuotationDto;
  BTCSellQuotation: QuotationDto;
  ETHPriceArray: number[];
  BTCPriceArray: number[];

  async fetchCFDQuotation(
    typeOfPosition: string = 'BUY',
    instId: string = 'ETH-USDT',
  ): Promise<QuotationDto> {
    const { data } = await firstValueFrom(
      this.httpService.get<QuotationDto>(
        DOMAIN_BACKEND + '/market/quotation/' + instId,
        {
          params: {
            typeOfPosition: typeOfPosition,
          },
        },
      ),
    );
    return data;
  }

  async fetchTickers(instId: string = 'ETH-USDT'): Promise<number[]> {
    const { data } = await firstValueFrom(
      this.httpService.get<any>(
        DOMAIN_BACKEND + '/market/tickers?limit=50&timespan=5m',
      ),
    );
    if (instId === 'ETH-USDT') {
      const priceArray = data.data[0].lineGraphProps.dataArray;
      return priceArray;
    }
    if (instId === 'BTC-USDT') {
      const priceArray = data.data[1].lineGraphProps.dataArray;
      return priceArray;
    }
    return data;
  }

  async fetchCandlesticks(
    instId: string = 'ETH-USDT',
    timeSpan: string = '5m',
    limit: number = 100,
  ): Promise<number[]> {
    const { data } = await firstValueFrom(
      this.httpService.get<CandlestickDto>(
        DOMAIN_BACKEND +
          '/candlesticks/' +
          instId +
          '?timeSpan=' +
          timeSpan +
          '&limit=' +
          limit,
      ),
    );
    const priceArray = data.data.candlesticks.map((item) => item.y.close);
    return priceArray;
  }

  async fetchCandlesticksV2(
    instId: string = 'ETH-USDT',
    timeSpan: string = '5m',
    begin: number = 0,
    end: number = 0,
    limit: number = 300,
  ): Promise<any> {
    const { data } = await firstValueFrom(
      this.httpService.get<any>(
        `${DOMAIN_BACKEND}/v2/candlesticks/${instId}?timeSpan=${timeSpan}&begin=${begin}&end=${end}&limit=${limit}`,
      ),
    );
    return data;
  }
  async getCFDQuotation(
    typeOfPosition: string = 'BUY',
    instId: string = 'ETH-USDT',
  ) {
    if (instId === 'ETH-USDT') {
      if (typeOfPosition === 'BUY') {
        return this.ETHBuyQuotation;
      }
      if (typeOfPosition === 'SELL') {
        return this.ETHSellQuotation;
      }
    }
    if (instId === 'BTC-USDT') {
      if (typeOfPosition === 'BUY') {
        return this.BTCBuyQuotation;
      }
      if (typeOfPosition === 'SELL') {
        return this.BTCSellQuotation;
      }
    }
  }

  async getCandlesticks(instId: string = 'ETH-USDT') {
    if (instId === 'ETH-USDT') {
      return this.ETHPriceArray;
    }
    if (instId === 'BTC-USDT') {
      return this.BTCPriceArray;
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async ETHBuyQuotationCron() {
    this.ETHBuyQuotation = await this.fetchCFDQuotation('BUY');
  }
  @Cron(CronExpression.EVERY_10_SECONDS)
  async ETHSellQuotationCron() {
    this.ETHSellQuotation = await this.fetchCFDQuotation('SELL');
  }
  @Cron(CronExpression.EVERY_10_SECONDS)
  async BTCBuyQuotationCron() {
    this.BTCBuyQuotation = await this.fetchCFDQuotation('BUY', 'BTC-USDT');
  }
  @Cron(CronExpression.EVERY_10_SECONDS)
  async BTCSellQuotationCron() {
    this.BTCSellQuotation = await this.fetchCFDQuotation('SELL', 'BTC-USDT');
  }
  @Cron(CronExpression.EVERY_MINUTE)
  async ETHPriceArrayCron() {
    this.ETHPriceArray = await this.fetchCandlesticks();
  }
  @Cron(CronExpression.EVERY_MINUTE)
  async BTCPriceArrayCron() {
    this.BTCPriceArray = await this.fetchCandlesticks('BTC-USDT');
  }
}
