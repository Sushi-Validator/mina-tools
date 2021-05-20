import axios, { AxiosInstance, AxiosResponse } from "axios";
import qs from "qs";

const defaultConfig = {
  baseURL: "https://fork-checker-api-iyrf2hryca-uw.a.run.app",
};

interface callParams {
  url: string;
  method: string;
  data?: object;
  headers?: object;
}

export class ForkCheckerApi {
  instance: AxiosInstance;

  constructor(config: object = defaultConfig) {
    this.instance = axios.create(config);
    this.instance.interceptors.response.use(this.handleSuccess);
  }

  handleSuccess(response: AxiosResponse): any {
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
      return this.instance({
        url,
        method,
        headers,
        data,
        ...rest,
      });
    } else if (method === "GET") {
      return this.instance({
        url: `${url}?${qs.stringify(data)}`,
        method,
        headers,
        ...rest,
      });
    }
  };

  getForks(timeFrame: number) {
    const timeFrameWindow = Date.now() - timeFrame;

    return this.call({
      url: "/forks",
      data: {
        min_length: 5,
        updated_after: timeFrameWindow,
      },
      method: "GET",
    });
  }
}
