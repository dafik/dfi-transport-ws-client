import {DfiEventObject, DfiUtil} from "local-dfi-base";
import {IIoTransportOptions, ITransportOptions, IWebSocketProtocolOptions} from "./interfaces";
import {WebSocketTransport} from "./transport/WebSocket";


const PROP_NAMESPACE = "nspName";
const PROP_TIMERS = "timers";
const PROP_IO_OPTIONS = "ioTransportOptions";
const PROP_WEBSOCKET = "websocket";
const PROP_PROTOCOL_HANDLERS = "_protocolHandlers";
const PROP_WS_HANDLERS = "_wsHandlers";

abstract class Transport extends DfiEventObject {
    static get events() {
        return EVENTS;
    }


    public get nspName(): string {
        return this.getProp(PROP_NAMESPACE);
    }

    /*    public set namespace(name: string) {
            this.setProp(PROP_NAMESPACE, name);
        }*/

    protected get _protocolHandlers(): Map<string, (...args) => void> {
        return this.getProp(PROP_PROTOCOL_HANDLERS);
    }

    protected get _wsHandlers(): Map<string | symbol, (...args) => void> {
        return this.getProp(PROP_WS_HANDLERS);
    }

    private get _ws(): WebSocketTransport {
        return this.getProp(PROP_WEBSOCKET);
    }

    private get _ioOptions(): IIoTransportOptions {
        return this.getProp(PROP_IO_OPTIONS);
    }

    private get _timers(): Map<string, NodeJS.Timer> {
        return this.getProp(PROP_TIMERS);
    }


    constructor(options: ITransportOptions) {
        options = {
            loggerName: "tr:",
            nspName: "",
            ...options
        };
        super(options);

        this.setProp(PROP_PROTOCOL_HANDLERS, new Map());
        this.setProp(PROP_WS_HANDLERS, new Map());
        this.setProp(PROP_TIMERS, new Map());

        const config: IWebSocketProtocolOptions = {
            loggerName: this.logger.name.replace(this.constructor.name, "") + "ws:",
            nspName: this.nspName,
            transportOptions: this._ioOptions
        };

        this.setProp(PROP_WEBSOCKET, new WebSocketTransport(config));
    }

    public destroy() {

        for (const timerName of this._timers.keys()) {
            this._clearTimer(timerName);
        }

        const ws = this._ws;
        if (ws) {
            ws.destroy();
        }
        super.destroy();
    }

    public start(callbackFn?, context?) {
        this.logger.info("start");

        this._prepareWsHandlers();

        this._bindWsHandlers();
        this._bindProtocolHandlers();

        this._ws.start((err) => {
            this.logger.info("started");
            DfiUtil.maybeCallbackOnce(callbackFn, context, err);
        });
    }

    public stop() {
        this.logger.info("stop");
        this._unbindProtocolHandlers();

        this._ws.stop();
        this._unbindWsHandlers();
        this.logger.info("started");
    }

    public send(action: string, data?: any, callback?: (...args) => void, context?: any) {
        this._ws.send(action, data, callback, context);
    }

    protected _prepareWsHandlers() {
        this._wsHandlers.set(WebSocketTransport.events.CONNECTED, () => {
            this.emit(Transport.events.CONNECTED, this);
        });

        this._wsHandlers.set(WebSocketTransport.events.DISCONNECTED, (reason) => {
            this.emit(Transport.events.DISCONNECTED, reason);
        });

        this._wsHandlers.set(WebSocketTransport.events.ERROR, (error) => {
            this.emit(Transport.events.ERROR, error);
        });
    }

    protected _createTimer(name: string, time: number, callbackFn?: (...arg) => void, context?) {

        this._timers.set(name, setTimeout(() => {
            this.logger.error("timeout for ack: " + name);
            DfiUtil.maybeCallbackOnce(callbackFn, context);
        }, time));
    }

    protected _clearTimer(name) {
        if (this._timers.has(name)) {
            clearTimeout(this._timers.get(name));
            this._timers.delete(name);
        }
    }

    private _bindWsHandlers() {
        this._wsHandlers.forEach((handler, event) => {
            this._ws.on(event, handler);
        });
    }

    private _unbindWsHandlers() {
        this._wsHandlers.forEach((handler, event) => {
            this._ws.off(event, handler);
        });
    }

    private _bindProtocolHandlers() {
        this._protocolHandlers.forEach((handler, event) => {
            this._ws.proxyOn(event, handler);
        });
    }

    private _unbindProtocolHandlers() {
        this._protocolHandlers.forEach((handler, event) => {
            this._ws.proxyOff(event, handler);
        });
    }

}

const EVENTS = {
    ...DfiEventObject.events,

    CONNECTED: Symbol("tr.connect"),    // socket event
    DISCONNECTED: Symbol("tr.disconnect"), // socket event
    ERROR: Symbol("tr.error")
};

export default Transport;
