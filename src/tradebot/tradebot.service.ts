import { Injectable, Logger } from '@nestjs/common';
import { Tradebot } from './entities/tradebot.entity';
import { UserService } from '../user/user.service';
import { DewtService } from '../dewt/dewt.service';
import { PriceTickerService } from '../price_ticker/price_ticker.service';
import { StrategiesService } from '../strategies/strategies.service';
import { TransactionService } from '../transaction/transaction.service';
import { copyWeights } from '../strategies/strategy/rl-dqn/dqn';
import * as tf from '@tensorflow/tfjs-node';
import { ReplayMemory } from '../strategies/strategy/rl-dqn/replay_memory';
import { QuotationDto } from '../price_ticker/dto/quotation.dto';

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
      console.log('tradebot.dewt: ', tradebot.dewt);
      // TODO: (20240315 Jacky) : Should store the tradebot in the database in the future
      for (let i = 0; i < 2; i++) {
        const register = await this.userService.registerUser(
          tradebot.wallet.address,
          tradebot.dewt,
        );
        console.log('register: ', register);
        if (register.success == true) {
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
      throw new Error('Failed to register tradebot' + tradebot.id);
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
    } else {
      this.logger.log('Tradebot ' + tradebot.id + ' is found');
    }
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
  async runStrategy(tradebot: Tradebot, instId: string): Promise<string> {
    this.logger.log(
      'Tradebot ' + tradebot.id + ' is executing ' + instId + ' strategy',
    );
    try {
      const quotation = await this.priceTickerService.getCFDQuotation(
        'BUY',
        instId,
      );
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
        return 'CLOSE';
      }
      if (suggestion === 'BUY' || suggestion === 'SELL') {
        if (tradebot.holdingStatus === 'WAIT') {
          return suggestion;
        }
      }
      return 'WAIT';
    } catch (error) {
      this.logger.error(
        tradebot.id + ' Error executing strategy: ' + error.message,
      );
    }
  }

  async executeTrade(tradebot: Tradebot, instId: string, action: string) {
    this.logger.log(
      'Tradebot ' + tradebot.id + ' is executing ' + action + ' in ' + instId,
    );
    try {
      let quotation;
      if (action === 'WAIT') {
        if (tradebot.holdingStatus !== 'WAIT') {
          this.logger.log('Tradebot ' + tradebot.id + ' is holding position');
          return 'Tradebot ' + tradebot.id + ' is holding position';
        }
        this.logger.log('Tradebot ' + tradebot.id + ' is waiting for chance');
        return 'Tradebot ' + tradebot.id + ' is waiting for chance';
      }
      if (action === 'CLOSE') {
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
        tradebot.openPrice = 0;
        tradebot.currentAsset = await this.userService.getMyAsset(
          tradebot.dewt,
        );
        this.logger.log(
          'Tradebot ' + tradebot.id + ' successfully closed position',
        );
        return 'Tradebot ' + tradebot.id + ' successfully closed position';
      }

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
      quotation = await this.priceTickerService.getCFDQuotation(action, instId);
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
      tradebot.holdingStatus = action;
      tradebot.holdingInstId = instId;
      tradebot.positionId = createCFDOrder.data.orderSnapshot.id;
      tradebot.openPrice = quotation.data.price;
      tradebot.updated_at = new Date();
      tradebot.currentAsset = await this.userService.getMyAsset(tradebot.dewt);
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
        const action = await this.runStrategy(tradebot, 'ETH-USDT');
        await this.executeTrade(tradebot, 'ETH-USDT', action);
      }
      if (
        tradebot.holdingInstId !== 'ETH-USDT' &&
        tradebot.currentAsset.data.balance.available > 250
      ) {
        const action = await this.runStrategy(tradebot, 'BTC-USDT');
        await this.executeTrade(tradebot, 'BTC-USDT', action);
      }
    }, 1000 * 30);
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
  async aiTrade(tradebot: Tradebot, instId: string = 'ETH-USDT') {
    if (tradebot.isRunning) {
      this.logger.log('Tradebot ' + tradebot.id + ' is already running');
      return 'Tradebot ' + tradebot.id + ' is already running';
    }
    tradebot.isRunning = true;
    const replayBufferSize = 100;
    // const NUM_ACTIONS = 4;
    const batchSize = 48;
    const gamma = 0.99;
    const learningRate = 1e-3;
    let syncCount = 0;
    const onlineNetwork = await tf.loadLayersModel(
      'file://src/strategies/strategy/rl-dqn/models/dqn/model.json',
    );
    const targetNetwork = await tf.loadLayersModel(
      'file://src/strategies/strategy/rl-dqn/models/dqn/model.json',
    );
    // Freeze taget network: it's weights are updated only through copying from
    // the online network.
    targetNetwork.trainable = false;
    const replayMemory = new ReplayMemory(replayBufferSize);
    for (let i = 0; i < replayBufferSize; ++i) {
      await this.aiStep(tradebot, instId, onlineNetwork, replayMemory);
      this.logger.log('Tradebot ' + tradebot.id + ' replayBuffer ' + i);
    }
    this.logger.log('Tradebot ' + tradebot.id + ' finish replayBuffer');
    const optimizer = tf.train.adam(learningRate);
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
      const { action, reward } = await this.aiStep(
        tradebot,
        instId,
        onlineNetwork,
        replayMemory,
      );
      this.logger.log(
        'Tradebot ' +
          tradebot.id +
          ' took action ' +
          action +
          ' and received reward ' +
          reward,
      );
      this.trainAiOnReplayBatch(
        batchSize,
        gamma,
        optimizer,
        replayMemory,
        onlineNetwork,
        targetNetwork,
      );
      // const { action, cumulativeReward, done } = agent.playStep();
      syncCount++;
      if (syncCount === 200) {
        syncCount = 0;
        copyWeights(targetNetwork, onlineNetwork);
        this.logger.log(
          "Sync'ed weights from online network to target network",
        );
        await onlineNetwork.save(
          'file://src/strategies/strategy/rl-dqn/models/dqn',
        );
        this.logger.log(
          `Saved DQN to 'file://src/strategies/strategy/rl-dqn/models/dqn'`,
        );
      }
    }, 1000 * 30);
    this.logger.log('Tradebot ' + tradebot.id + ' start running');
    return 'Tradebot ' + tradebot.id + ' start running AI version';
  }
  async aiStep(
    tradebot: Tradebot,
    instId: string,
    onlineNetwork,
    replayMemory,
  ) {
    const ALL_ACTIONS: number[] = [0, 1, 2, 3];
    // The epsilon-greedy algorithm.
    let action;
    const quotation = await this.priceTickerService.getCFDQuotation(
      action,
      instId,
    );
    const priceArray = await this.priceTickerService.getCandlesticks(instId);
    let holdingStatusNum: number;
    const state = [
      priceArray,
      quotation.data.spotPrice,
      tradebot.openPrice,
      quotation.data.spreadFee,
      holdingStatusNum,
    ].flat();
    if (Math.random() < 0.1) {
      // Pick an action at random.
      const actionNum = Math.random();
      if (actionNum < 0.25) {
        action = 0;
      }
      if (actionNum >= 0.25 && actionNum < 0.5) {
        action = 1;
      }
      if (actionNum >= 0.5 && actionNum < 0.75) {
        action = 2;
      }
      if (actionNum >= 0.75) {
        action = 3;
      }
    } else {
      //   Greedily pick an action based on online DQN output.
      tf.tidy(() => {
        // const flatState = state.flat(); // Convert state array to a flat array
        const stateTensor = tf.tensor1d(state).reshape([1, -1]);
        const prediction = onlineNetwork.predict(
          stateTensor,
        ) as tf.Tensor<tf.Rank>;
        const actionIndex = prediction.argMax(-1).dataSync()[0];
        action = ALL_ACTIONS[actionIndex];
      });
    }
    const nextState = await this.envStep(
      tradebot,
      priceArray,
      quotation,
      action,
    );
    const nextStateFlat = Object.values(nextState).slice(0, 5).flat();
    const actionStr = this.convertHoldingStatusBack(action);
    await this.executeTrade(tradebot, instId, actionStr);
    replayMemory.append([state, action, nextState.reward, nextStateFlat]);
    const output = {
      action,
      reward: nextState.reward,
    };
    return output;
  }
  async trainAiOnReplayBatch(
    batchSize,
    gamma,
    optimizer,
    replayMemory,
    onlineNetwork,
    targetNetwork,
  ) {
    // Get a batch of examples from the replay buffer.
    const batch = replayMemory.sample(batchSize);
    const lossFunction = () =>
      tf.tidy(() => {
        // console.log(batch.map((example) => example[0]));
        const batchState = batch.map((example) => example[0]);
        const stateTensor = tf.tensor2d(batchState);
        const batchAction = batch.map((example) => example[1]);
        const actionTensor = tf.tensor1d(batchAction, 'int32');
        let qs = onlineNetwork.apply(stateTensor, {
          training: true,
        });
        const oneHotActionTensor = tf.oneHot(actionTensor, 4);
        qs = (qs as tf.Tensor<tf.Rank>).mul(oneHotActionTensor).sum(-1);
        const batchReward = batch.map((example) => example[2]);
        const rewardTensor = tf.tensor1d(batchReward);
        const batchNextState = batch.map((example) => example[3]);
        const nextStateTensor = tf.tensor2d(batchNextState);
        const nextMaxQTensor = (
          targetNetwork.predict(nextStateTensor) as tf.Tensor<tf.Rank>
        ).max(-1);
        const exampleDone = batch.map((example) => example[4]);
        const doneTensor = tf.tensor1d(exampleDone);
        const doneMask = tf.scalar(1).sub(doneTensor);
        const targetQs = rewardTensor.add(
          nextMaxQTensor.mul(doneMask).mul(gamma),
        );
        return tf.losses.meanSquaredError(targetQs, qs);
      });

    // Calculate the gradients of the loss function with repsect to the weights
    // of the online DQN.
    const mse = () => lossFunction() as tf.Scalar;
    const grads = tf.variableGrads(mse);
    // Use the gradients to update the online DQN's weights.
    optimizer.applyGradients(grads.grads);
    tf.dispose(grads);
    // TODO(cais): Return the loss value here?
  }
  async envStep(
    tradebot: Tradebot,
    priceArray,
    quotation: QuotationDto,
    action: any,
  ) {
    let profit = 0;
    let reward = 0;
    if (action === 3) {
      if (tradebot.holdingStatus === 'WAIT') {
        reward = -35;
      }
      if (tradebot.holdingStatus === 'BUY') {
        profit =
          quotation.data.spotPrice -
          quotation.data.spreadFee -
          tradebot.openPrice;
        reward = profit;
        reward += 20;
      }
      if (tradebot.holdingStatus === 'SELL') {
        profit =
          tradebot.openPrice -
          (quotation.data.spotPrice + quotation.data.spreadFee);
        reward = profit;
        reward += 10;
      }
    }
    if (action === 1) {
      if (tradebot.holdingStatus === 'WAIT') {
        reward = 25;
      } else {
        reward = -35;
      }
    }
    if (action === 2) {
      if (tradebot.holdingStatus === 'WAIT') {
        reward = 25;
      } else {
        reward = -35;
      }
    }
    if (profit > 50) {
      reward += 20;
    }
    if (profit < -50) {
      reward -= 15;
    }
    quotation = await this.priceTickerService.getCFDQuotation(
      'BUY',
      quotation.data.instId,
    );
    const holdingStatusNum = this.convertHoldingStatus(tradebot.holdingStatus);
    return {
      previousPrice: priceArray,
      currentPrice: quotation.data.spotPrice,
      openPrice: tradebot.openPrice,
      spreadFee: quotation.data.spreadFee,
      holdingStatus: holdingStatusNum,
      reward: reward,
    };
  }
  convertHoldingStatus(holdingStatus: string) {
    let holdingStatusNum;
    switch (holdingStatus) {
      case 'WAIT':
        holdingStatusNum = 0;
        break;
      case 'BUY':
        holdingStatusNum = 1;
        break;
      case 'SELL':
        holdingStatusNum = 2;
        break;
      case 'CLOSE':
        holdingStatusNum = 3;
        break;
      default:
        holdingStatusNum = 0;
        break;
    }
    return holdingStatusNum;
  }
  convertHoldingStatusBack(holdingStatusNum: number) {
    let holdingStatus;
    switch (holdingStatusNum) {
      case 0:
        holdingStatus = 'WAIT';
        break;
      case 1:
        holdingStatus = 'BUY';
        break;
      case 2:
        holdingStatus = 'SELL';
        break;
      case 3:
        holdingStatus = 'CLOSE';
        break;
      default:
        holdingStatus = 'WAIT';
        break;
    }
    return holdingStatus;
  }
}
