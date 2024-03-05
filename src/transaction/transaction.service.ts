import { Injectable } from '@nestjs/common';
import { CreateDepositDto } from './dto/createDeposit.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PriceTicker } from '../price_ticker/entities/price_ticker.entity';
import { PriceTickerService } from '../price_ticker/price_ticker.service';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { Deposit } from './entities/deposit.entity';
import { CFDOrder } from './entities/CFDOrder.entity';
import CFDOrderCreate from '../common/constants/contracts/cfd_create';
import { SignTypedDataVersion, signTypedData } from '@metamask/eth-sig-util';

@Injectable()
export class TransactionService {
  constructor(
    private readonly priceTickerService: PriceTickerService,
    private readonly httpService: HttpService,
  ) {}

  async deposit(
    dewt: string,
    createDepositDto: CreateDepositDto,
  ): Promise<Deposit> {
    const { data } = await firstValueFrom(
      this.httpService.post<Deposit>(
        'https://api.tidebit-defi.com/api/v1/users/deposit',
        createDepositDto,
        {
          headers: {
            'Content-Type': 'application/json',
            Dewt: dewt,
          },
        },
      ),
    );
    console.log(data);
    return data;
  }
  async getCFDTrade(dewt: string, id: string): Promise<any> {}
  async createCFDOrder( // typeOfPosition: string,
  // dewt: string,
  // createDepositDto: CreateDepositDto,
  // amount: number,
  // privatekey: string,
  ): Promise<any> {
    //   // should have return type
    //   const quotation =
    //     await this.priceTickerService.getCFDQuotation(typeOfPosition);
    //   quotation.data.ticker = quotation.data.targetAsset;
    //   const myAsset = await this.getMyAsset(dewt);
    //   const typeData = CFDOrderCreate;
    //   quotation.data.price = quotation.data.price * (10 ** 5);
    //   typeData.message = {
    //     ticker: quotation.data.ticker,
    //     typeOfPosition: typeOfPosition,
    //     quotation: quotation.data,
    //     price: quotation.data.price * (10 ** 5),
    //     amount: amount * (10 ** 5),
    //     targetAsset: quotation.data.targetAsset,
    //     unitAsset: quotation.data.unitAsset,
    //     margin: {
    //       asset: 'USDT',
    //       amount: 0.0,
    //     },
    //     leverage: 5, // maybe can change
    //     liquidationPrice: quotation.data.price * 0.9 * (10 ** 5),
    //     liquidationTime: quotation.data.deadline + 60 * 60 * 24 * 7,
    //     // guaranteedStop: false,
    //     fee: '0',
    //     // guaranteedStopFee: 0,
    //     createTimestamp: quotation.data.deadline - 5,
    //     // takeProfit: 0,
    //     // stopLoss: 0,
    //     // remark: '',
    //   };
    //   const eip712signature = signTypedData({
    //     privateKey: Buffer.from(privatekey, 'hex'),
    //     data: typeData as any,
    //     version: SignTypedDataVersion.V4,
    //   });
    //   console.log(eip712signature);
    //   const { data } = await firstValueFrom(
    //     this.httpService.post<any>(
    //       'https://api.tidebit-defi.com/api/v1/users/cfds/create',
    //       { applyData: typeData.message, userSignature: eip712signature },
    //       {
    //         headers: {
    //           'Content-Type': 'application/json',
    //           Dewt: dewt,
    //         },
    //       },
    //     ),
    //   );
    //   console.log(data);
    //   return data;
  }
  async closeCFDOrder(): Promise<any> {
    // should have return type
  }
}
