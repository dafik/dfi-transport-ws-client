import {DfiEventObject, DfiUtil} from "local-dfi-base";
import {IIoTransportOptions, ITransportOptions, IWebSocketProtocolOptions} from "./interfaces";
import {WebSocketTransport} from "./transport/WebSocket";


const PROP_NAMESPACE = "nspName";
const PROP_TIMERS = "timers";
const PROP_IO_OPTIONS = "ioTransportOptions";
const PROP_WEBSOCKET = "websocket";
const PROP_USE_TIMERS = "useTimers";
const PROP_TIMEOUT = "timeout";

const PROP_PROTOCOL_HANDLERS = "_protocolHandlers";
const PROP_WS_HANDLERS = "_wsHandlers";


abstract class Transport extends DfiEventObject {
    static get events() {
        return EVENTS;
    }


    public get nspName(): string {
        return this.getProp(PROP_NAMESPACE);
    }

    public set nspName(name: string) {
        this.setProp(PROP_NAMESPACE, name);
        this._ws.nspName = name;
    }

    protected get _protocolHandlers(): Map<string, (...args) => void> {
        return this.getProp(PROP_PROTOCOL_HANDLERS);
    }

    protected get _wsHandlers(): Map<string | symbol, (...args) => void> {
        return this.getProp(PROP_WS_HANDLERS);
    }

    protected get _useTimers(): boolean {
        return this.getProp(PROP_USE_TIMERS);
    }

    protected get _timeout(): number {
        return this.getProp(PROP_TIMEOUT);
    }

    private get _ws(): WebSocketTransport {
        return this.getProp(PROP_WEBSOCKET);
    }

    private get _ioOptions(): IIoTransportOptions {
        return this.getProp(PROP_IO_OPTIONS);
    }

    private get _timers(): Set<NodeJS.Timer> {
        return this.getProp(PROP_TIMERS);
    }


    constructor(options: ITransportOptions) {
        options = {
            loggerName: "tr:",
            nspName: "",
            useTimers: true,
            timeout: 500,
            ...options
        };
        super(options);

        this.setProp(PROP_PROTOCOL_HANDLERS, new Map());
        this.setProp(PROP_WS_HANDLERS, new Map());

        this.setProp(PROP_TIMERS, new Set());

        const config: IWebSocketProtocolOptions = {
            loggerName: this.logger.name.replace(this.constructor.name, "") + "ws:",
            nspName: this.nspName,
            transportOptions: this._ioOptions
        };

        this.setProp(PROP_WEBSOCKET, new WebSocketTransport(config));
    }

    public destroy() {
        [...this._timers].forEach((timer) => {
            this._clearTimer(timer);
        });

        if (this._ws) {
            this._ws.destroy();
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
        this._wsHandlers.clear();

        this.logger.info("stopped");
    }

    public send(action: string, data?: any, ack?: (err: Error, ...args) => void, context?: any) {
        if (ack && this._useTimers) {
            const description = "timeout for \"" + action + '"';
            let fired = false;
            const timer = this._createTimer(this._timeout, description, () => {
                fired = true;
                this._clearTimer(timer);
                ack.call(context, new Error("no ack: " + description));

            });

            this._ws.send(action, data, (...args) => {
                if (!fired) {
                    clearTimeout(timer);
                    ack.apply(context, [null, ...args]);
                }
            });

        } else {
            this._ws.send(action, data, ack, context);
        }

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

    protected _createTimer(time: number, descripton?: string, callbackFn?: (...arg) => void, context?): NodeJS.Timer {
        const timer = setTimeout(() => {
            this.logger.error("timeout for ack: %s", descripton);
            DfiUtil.maybeCallbackOnce(callbackFn, context);
        }, time);
        this._timers.add(timer);
        return timer;
    }

    protected _clearTimer(timer: NodeJS.Timer) {
        clearTimeout(timer);
        this._timers.delete(timer);
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
