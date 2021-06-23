import axios, { AxiosInstance, AxiosResponse } from "axios";
import qs from "qs";

const defaultConfig = {
  baseURL: "https://api.minaexplorer.com",
};

declare module "axios" {
  export interface AxiosResponse<T = any> extends Promise<T> {}
}

type callParams = {
  url: string;
  method?: string;
  data?: object;
  headers?: object;
}

type Summary = {
  blockchainLength: number;
  epoch: number;
  lockedSupply: string;
  totalCurrency: string;
}

export class ExplorerApi {
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

  async getSummary(): Promise<Summary> {
	return await this.call({
      url: `/summary`,
	});
  }

}