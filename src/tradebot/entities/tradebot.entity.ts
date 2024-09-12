import { randomUUID } from 'crypto';
import { HDNodeWallet, Wallet, ethers } from 'ethers';
import { myAsset } from '../../user/dto/myAsset.dto';
import * as dotenv from 'dotenv';

dotenv.config();
export class Tradebot {
  constructor() {
    this.id = randomUUID();
    this.created_at = new Date();
    this.updated_at = new Date();
    this.suggestion = process.env.SUGGESTION;
    this.stopLoss = process.env.STOP_LOSS;
    this.takeProfit = process.env.TAKE_PROFIT;
    this.holdingStatus = 'WAIT';
    this.isRunning = false;
    if (
      process.env.PRIVATE_KEY &&
      process.env.PRIVATE_KEY.length === 66 &&
      process.env.PRIVATE_KEY.startsWith('0x')
    ) {
      this.wallet = this.connectWallet(process.env.PRIVATE_KEY);
    } else {
      this.wallet = this.createWallet();
    }
  }
  id: string;
  created_at: Date;
  updated_at: Date;
  wallet: HDNodeWallet | Wallet;
  dewt: string;
  suggestion: string;
  stopLoss: string;
  takeProfit: string;
  currentAsset: myAsset;
  holdingStatus: string;
  holdingInstId: string;
  positionId: string;
  openPrice: number;
  endAsset: myAsset;
  isRunning: boolean;
  timer?: NodeJS.Timeout;

  toJSON() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { timer, ...tradebot } = this;
    return tradebot;
  }
  createWallet(): HDNodeWallet {
    const randomWallet = ethers.Wallet.createRandom();
    return randomWallet;
  }

  connectWallet(privateKey: string) {
    const realWallet = new ethers.Wallet(privateKey);
    return realWallet;
  }
}
