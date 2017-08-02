import Transport from "../../lib/Transport";
import {ITransportOptions} from "../../lib/interfaces";

export default class TransportImpl extends Transport {
    public static get events() {
        return EVENTS;
    }

    constructor(options: ITransportOptions) {
        options = {
            loggerName: "trImpl:",
            ...options
        };
        super(options);

        this._prepareProtocolHandlers();
    }

    private _prepareProtocolHandlers() {
        this._protocolHandlers.set("update", (message) => {
            this.emit(TransportImpl.events.UPDATE, message);
        });
    }

    public _createTimer(name: string, time: number, callbackFn?: (...arg) => void, context?): any {
        return super._createTimer(name, time, callbackFn, context);
    }

    public _clearTimer(name): any {
        return super._clearTimer(name);
    }
}

const EVENTS = {
    ...Transport.events,
    UPDATE: Symbol("lt:update")
};