import axios, { AxiosInstance, AxiosResponse } from "axios";
import qs from "qs";

const defaultConfig = {
  baseURL: "https://fork-checker-api-iyrf2hryca-uw.a.run.app",
};

declare module "axios" {
  export interface AxiosResponse<T = any> extends Promise<T> {}
}

type callParams = {
  url: string;
  method?: string;
  data?: object;
  headers?: object;
};

type Fork = {
  blocks: string[];
  creators: string[];
  id: string;
  last_updated: number;
  latest: string;
  length: number;
  rewards: number;
};

export class ForkCheckerApi {
  instance: AxiosInstance;

  constructor(config: object = defaultConfig) {
    this.instance = axios.create(config);
    this.instance.interceptors.response.use(this.handleSuccess);
  }

  handleSuccess(response: AxiosResponse) {
    const { data, status } = response;

    if (status === 200) {
      return data;
    }

    return Promise.reject(data);
  }

  call = async ({
    url,
    method = "GET",
    data,
    headers,
    ...rest
  }: callParams) => {
    if (method === "POST") {
      return await this.instance({
        url,
        method,
        headers,
        data,
        ...rest,
      });
    } else if (method === "GET") {
      return await this.instance({
        url: `${url}?${qs.stringify(data)}`,
        method,
        headers,
        ...rest,
      });
    }
  };

  async getForks(timeFrame: number): Promise<Array<Fork>> {
    const timeFrameWindow = Date.now() - timeFrame;

    return await this.call({
      url: "/forks",
      data: {
        min_length: 5,
        updated_after: timeFrameWindow,
      },
    });
  }

  async getFork(forkId: string): Promise<Fork> {
    return await this.call({
      url: `/fork/${forkId}`,
    });
  }
}
