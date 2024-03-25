export type MessageType = symbol | string | number;

export interface BaseReqData<R = any> {
  /**
   * 请求的唯一标记
   */
  requestId?: string;
  /**
   * scope，区分多个渠道
   * 比如页面打开多个iframe，我们监听的是window的message的事件，
   * 当多个iframe发送出消息时，屏蔽消息
   */
  scope?: string;
  /**
   * 区分类型的字段，默认是type|method
   */
  type?: MessageType;
  /**
   * 区分类型的字段，默认是type|method
   */
  method?: MessageType;
  /**
   * 数据部分
   */
  data?: R;
}

export type BaseResData<S = any> = BaseReqData<S>;

export interface RequestInfo<D = any> {
  requestId: string | undefined;
  cb: (...args: any[]) => any;
  reqData?: D;
  reqTime?: number;
  scope: string | undefined;
}

export type Unsubscribe = () => void;

export interface GlobalReqOptions<R = any, S = any> {
  timeout?: number;
  autoSubscribe?: boolean;
  clearTimeoutReq?: boolean;
  /**
   * clearTimeoutReq开启后，过期多少时间的请求会被清理
   */
  expiredTime?: number;
  enableLog?: boolean;
  /**
   * 输出未处理的事件回调
   */
  logUnhandledEvent?: boolean;
  /**
   * 订阅
   */
  subscribe?: (onMessage?: () => void) => Unsubscribe;
  /**
   * 获得请求的ID
   * @param data
   */
  getRequestId?: <R>(data: BaseReqData<R>) => string;
  /**
   * 获取请求的 type
   * @param data
   */
  getReqMsgType?: (data: BaseReqData<R>) => MessageType;
  /**
   * 获得响应的Key
   * @param data
   */
  getResponseId?: (data: BaseResData<S>) => string;
  /**
   * 打开多个被请求方， 比如多个webview
   */
  getResSope?: (data: BaseResData<S>) => string | string[];
  /**
   * 提供返回后，再处理数据的能力
   */
  onResponse?: (data: BaseResData<S>) => BaseResData<S>;
  /**
   * 获取响应的 type
   * @param data
   */
  getResMsgType?: (data: BaseResData<S>) => MessageType;
  /**
   * 真正的请求
   * @param data
   * @param key
   */
  request?: (data: BaseResData<S>, key: string) => any;
}

export interface RequestOptions {
  timeout?: number;
  defaultRes?: any;
  sendOnly?: boolean;
}

export interface Statistics {
  reqCount: number;
  resCount: number;
  timeOutCount: number;
}
