interface HandlerInfo {
  target: any;
  methodName: string;
  listener: (...args: any[]) => any;
}

export interface IPEventMessager<T = any> {
  on: <D = any>(type: T | T[], fun: (data: D) => any, context?: any) => any;
  off: <D = any>(type: T | T[], fun: (data: D) => any) => any;
  emit: <D = any>(type: T, data: D, ...args: any[]) => any;
  has: (category: T) => boolean;
}

export class PEventMessager<MessageType = any>
  implements IPEventMessager<MessageType>
{
  private map: Map<MessageType, HandlerInfo[]> = new Map<
    MessageType,
    HandlerInfo[]
  >();

  /**
   * 可以处理多种类型的事件
   * @param messageType
   * @returns
   */
  on = <D = any, RD = any>(
    messageType: MessageType | MessageType[],
    listener: (data: D) => RD,
    context: any = null,
  ): void => {
    const cates = Array.isArray(messageType) ? messageType : [messageType];
    const { map } = this;

    if (typeof listener !== 'function') {
      console.error(`PEventMessager::on: fn 必须是一个函数`);
      return;
    }

    cates.forEach(cate => {
      let handlers = map.get(cate);
      if (!handlers) {
        handlers = [];
        map.set(cate, handlers);
      }

      handlers.push({
        methodName: listener.name || 'anonymous',
        target: context,
        listener,
      });
    });
  };

  off = (
    messageType: MessageType | MessageType[],
    listener: (...args: any[]) => any,
  ): void => {
    const cates = Array.isArray(messageType) ? messageType : [messageType];
    const { map } = this;

    if (typeof listener !== 'function') {
      console.error(`PEventMessager::off: fn 必须是一个函数`);
      return;
    }

    let cate: MessageType;

    for (let i = 0, count = cates.length; i < count; i++) {
      cate = cates[i];
      const handlers = map.get(cate);

      if (!handlers || !Array.isArray(handlers)) {
        continue;
      }

      let index;
      for (let i = handlers.length; i >= 0; i--) {
        index = handlers.findIndex(h => h.listener === listener);
        if (index >= 0) {
          handlers.splice(index, 1);
          break;
        }
      }

      // handlers 长度为0，删除分类
      if (handlers.length === 0) {
        map.delete(cate);
      }
    }
  };

  has(messageType: MessageType) {
    const handlers = this.map.get(messageType);
    return Array.isArray(handlers) && handlers.length > 0;
  }

  emit = <D = any>(messageType: MessageType, data: D, ...args: any[]) => {
    const handlers = this.map.get(messageType);
    if (!handlers) {
      return;
    }

    handlers.forEach(handler => {
      const { listener: fun } = handler;
      if (!fun) {
        console.error(
          `PEventMessager:不能找到messageType为${messageType}对应的${handler.methodName}事件处理函数`,
        );
      } else {
        fun.apply(handler.target, [data].concat(args));
      }
    });
  };
}
