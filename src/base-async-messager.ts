import { PEventMessager } from './event-messager';
import {
  BaseReqData,
  BaseResData,
  GlobalReqOptions,
  MessageType,
  RequestInfo,
  RequestOptions,
  Statistics,
  Unsubscribe,
} from './type';
import { delay, hasOwnProperty, isFunction, isSameScope, uuid } from './utils';

const DEFAULT_GLOBAL_OPTIONS: GlobalReqOptions = {
  timeout: 5000,
  clearTimeoutReq: true,
  enableLog: true,
  logUnhandledEvent: true,
};

type ExtensibleMethod =
  | 'subscribe'
  | 'getRequestId'
  | 'getReqMsgType'
  | 'getResponseId'
  | 'getResMsgType'
  | 'request'
  | 'getResScope'
  | 'onResponse';

export class BaseAsyncMessager extends PEventMessager<MessageType> {
  protected unsubscribe?: Unsubscribe;

  private useOptions: boolean = false;

  private statistics: Statistics = {
    reqCount: 0,
    resCount: 0,
    timeOutCount: 0,
  };

  private options: GlobalReqOptions;

  private cbMap: Map<MessageType, RequestInfo[]> = new Map<
    MessageType,
    RequestInfo[]
  >();

  constructor(options: GlobalReqOptions = DEFAULT_GLOBAL_OPTIONS) {
    super();
    this.options = { ...DEFAULT_GLOBAL_OPTIONS, ...options };

    if (isFunction(this.options.subscribe)) {
      this.unsubscribe = this.options.subscribe!(this.onMessage);
    }
    this.useOptions = true;
  }

  private addCallback(messageType: MessageType, reqInfo: RequestInfo) {
    const cbs = this.cbMap.get(messageType);
    if (!cbs) {
      this.cbMap.set(messageType, []);
    }

    this.cbMap.get(messageType)!.push({
      requestId: reqInfo.requestId,
      reqTime: Date.now(),
      cb: reqInfo.cb,
      scope: reqInfo.scope,
    });
  }

  private getMethod = <R>(name: ExtensibleMethod) => {
    const optMethod = this.options[name as keyof GlobalReqOptions];
    const classMethod = this[name as keyof this];

    const method = this.useOptions
      ? optMethod || classMethod
      : classMethod || optMethod;
    if (!method) {
      console.error(`${method} 查找失败，请确保在Class或者options上已定义`);
    }
    return method as (...args: any[]) => R;
  };

  private getCallback(
    messageType: MessageType,
    scope: string,
    requestId: string | undefined,
  ): ((...args: any[]) => any | undefined) | undefined {
    if (!messageType) {
      return undefined;
    }

    const reqInfo = this.removeRequest(messageType, scope, requestId);
    if (!reqInfo) {
      return undefined;
    }
    return reqInfo.cb;
  }

  private removeRequest(
    messageType: MessageType,
    scope: string | undefined,
    requestId: string | undefined,
  ) {
    const cbs = this.cbMap.get(messageType);
    if (!cbs || cbs.length === 0) {
      return undefined;
    }
    const hasKey = typeof requestId === 'string';
    const hasScope = typeof scope === 'string';
    if (hasKey || hasScope) {
      let index = -1;
      // key优先级最高
      if (hasKey) {
        index = cbs.findIndex(c => c.requestId === requestId);
      } else if (hasScope) {
        // 其次是scope
        index = cbs.findIndex(c => isSameScope(c?.scope, scope));
      }
      if (index >= 0) {
        const reqInfo = cbs[index];
        cbs.splice(index, 1);
        return reqInfo;
      }
      return undefined;
    }
    // 删除第一个
    return cbs.shift();
  }

  private onTimeout = () => {
    this.statistics.timeOutCount++;
  };

  // TODO
  private onError = () => {
    console.error('error');
  };

  private onSuccess = <RD>(
    _messageType: MessageType,
    _data: BaseResData<RD>,
  ) => {
    this.statistics.resCount++;
  };

  // eslint-disable-next-line  @typescript-eslint/no-unused-vars
  subscribe(onMessage?: (...args: any[]) => any): Unsubscribe {
    throw new Error('not implemented');
  }

  /**
   * 获取请求的key
   * @param data
   * @returns
   */
  protected getRequestId<D>(_data: BaseReqData<D>): string {
    return uuid();
  }

  protected getReqMsgType<D>(data: BaseReqData<D>): MessageType | undefined {
    return data.method || data.type;
  }

  protected getResMsgType<RD>(data: BaseResData<RD>): MessageType | undefined {
    return data.method || data.type;
  }

  protected request<D>(_data: BaseReqData<D>): any {
    throw new Error('not implemented');
  }

  protected getResponseId<RD>(data: BaseResData<RD>): string | undefined {
    return data.requestId;
  }

  protected getResScope<RD>(data: BaseResData<RD>) {
    return data.scope;
  }

  protected onResponse<RD>(_messageType: MessageType, data: BaseResData<RD>) {
    return data;
  }

  protected onMessage = <RD>(data: BaseResData<RD> = {}) => {
    const messageType = this.getMethod<MessageType>('getResMsgType')(data);
    const responseId = this.getMethod<string | undefined>('getResponseId')(
      data,
    );

    // eslint-disable-next-line  no-param-reassign
    data = this.onResponse(messageType, data);

    // 内置的成功处理
    this.onBuiltInResponse(messageType, data);

    const scope = this.getMethod<string>('getResScope')(data);
    const callback = this.getCallback(messageType, scope, responseId);

    const isInHandlers = this.has(messageType);
    //  AsyncMessager中没有，PEventMessager中也没有, 并且开启相关的日志输出
    if (!callback && !isInHandlers && this.options.logUnhandledEvent) {
      this.onError();
      console.warn(
        `未找到category为${messageType as string},key为${responseId}的回调信息`,
      );
      return;
    }
    this.onSuccess(messageType, data);
    if (callback) {
      callback(data);
    }
  };

  invoke<D = any, RD = any>(
    data: BaseResData<D>,
    reqOptions?: RequestOptions,
    ...args: any[]
  ): Promise<BaseResData<RD> | undefined> {
    this.statistics.reqCount++;
    const {
      timeout = 5000,
      sendOnly = false,
      defaultRes = {
        message: '请求超时',
      },
    } = reqOptions || {};

    // 获得请求唯一ID
    if (!hasOwnProperty(data, 'requestId')) {
      data.requestId = this.getMethod<string>('getRequestId').apply(this, [
        data,
      ]);
    }
    const { requestId } = data;
    const tout = timeout || this.options.timeout;
    const messageType = this.getMethod<MessageType | undefined>(
      'getReqMsgType',
    )(data);

    // 只发不收
    if (sendOnly) {
      this.getMethod('request')(data, requestId, ...args);
      return Promise.resolve(undefined);
    }

    if (!messageType) {
      return Promise.reject(new Error(`messageType is undefined`));
    }

    return new Promise((resolve, reject) => {
      const { run, cancel } = delay(undefined, tout);
      // 超时
      run().then(() => {
        console.log('请求超时:', messageType, data, requestId);
        this.onTimeout();
        if (this.options.clearTimeoutReq) {
          this.removeRequest(messageType, data?.scope as string, requestId);
        }
        // eslint-disable-next-line   prefer-promise-reject-errors
        reject({
          message: '请求超时',
          ...(defaultRes || {}),
        });
      });

      this.addCallback(messageType, {
        requestId,
        cb: (msg: any) => {
          // 取消超时回调
          cancel();
          resolve(msg);
        },
        scope: data.scope,
      });
      // 调用
      this.getMethod('request')(data, requestId, ...args);
    });
  }

  protected onBuiltInResponse<RD>(
    messageType: MessageType,
    data: BaseResData<RD>,
  ) {
    if (!messageType) {
      return data;
    }
    // TODO:: 这里可能被串改数据
    this.emit(messageType, data);
    return data;
  }

  public getStatistics() {
    return {
      total: this.statistics.reqCount,
      success: this.statistics.resCount,
      timeout: this.statistics.timeOutCount,
    };
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.cbMap.clear();
    }
  }
}
