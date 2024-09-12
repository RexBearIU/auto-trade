import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { myAsset } from './dto/myAsset.dto';
import { HistoryList } from './dto/history.dto';
import { apiV1, DOMAIN_BACKEND } from '../common/constants/config';

@Injectable()
export class UserService {
  private readonly TBDBackendUrl: string;
  constructor(private readonly httpService: HttpService) {}

  async registerUser(address: string, dewt: string): Promise<any> {
    const { data } = await firstValueFrom(
      this.httpService.post(
        `${DOMAIN_BACKEND}${apiV1}/dewt`,
        { address, deWT: dewt },
        {
          headers: {
            'Content-Type': 'application/json',
            Dewt: dewt,
          },
        },
      ),
    );
    return data;
  }
  async getMyAsset(dewt: string): Promise<myAsset> {
    const { data } = await firstValueFrom(
      this.httpService.get<myAsset>(`${DOMAIN_BACKEND}${apiV1}/users/assets`, {
        headers: {
          'Content-Type': 'application/json',
          Dewt: dewt,
        },
      }),
    );
    return data;
  }
  async listHistories(dewt: string, limit: string = '3'): Promise<HistoryList> {
    const { data } = await firstValueFrom(
      this.httpService.get<HistoryList>(
        `${DOMAIN_BACKEND}${apiV1}/bolt-transactions/history?limit=${limit}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Dewt: dewt,
          },
        },
      ),
    );
    return data;
  }
  async sendToken() {}
  async receiveToken() {}
}
