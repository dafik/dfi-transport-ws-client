import io = require("socket.io-client");
import {DfiEventObject, DfiUtil} from "local-dfi-base";
import DebugLogger from "local-dfi-debug-logger";
import {IIoSocket, IIoTransportOptions, IWebSocketProtocolOptions} from "../interfaces";

const PROP_SOCKET_STD_HANDLERS = "socketHandlers";
const PROP_MANAGER_STD_HANDLERS = "managerHandlers";
const PROP_PROXY_HANDLERS = "proxyHandlers";
const PROP_SOCKET = "socket";
const PROP_MANAGER = "manager";
const PROP_NAMESPACE = "nspName";

const PROP_LOGGER_SOCKET = "loggerS";
const PROP_LOGGER_MANAGER = "loggerM";

const PROP_TRANSPORT_OPTIONS = "transportOptions";

export class WebSocketTransport extends DfiEventObject {

    public static get events() {
        return EVENTS;
    }

    public set nspName(name: string) {
        this.setProp(PROP_NAMESPACE, name);
    }

    public get nspName(): string {
        return this.getProp(PROP_NAMESPACE);
    }

    private get _socketHandlers(): Map<string, (...args) => void> {
        return this.getProp(PROP_SOCKET_STD_HANDLERS);
    }

    private get _managerHandlers(): Map<string, (...args) => void> {
        return this.getProp(PROP_MANAGER_STD_HANDLERS);
    }

    private get _proxyHandlers(): Map<string, (...args) => void> {
        return this.getProp(PROP_PROXY_HANDLERS);
    }

    private get _manager(): SocketIOClient.Manager {
        return this.getProp(PROP_MANAGER);
    }

    private get _socket(): IIoSocket {
        return this.getProp(PROP_SOCKET);
    }

    private get loggerS(): DebugLogger {
        return this.getProp(PROP_LOGGER_SOCKET);
    }

    private get loggerM(): DebugLogger {
        return this.getProp(PROP_LOGGER_MANAGER);
    }

    private get transportOptions(): IIoTransportOptions {
        return this.getProp(PROP_TRANSPORT_OPTIONS);
    }

    constructor(options: IWebSocketProtocolOptions) {
        options.loggerName = options.loggerName || "app:ws:";
        super(options);

        this.setProp(PROP_LOGGER_SOCKET, new DebugLogger(options.loggerName + "socket"));
        this.setProp(PROP_LOGGER_MANAGER, new DebugLogger(options.loggerName + "manager"));

        this.setProp(PROP_SOCKET_STD_HANDLERS, new Map());
        this.setProp(PROP_MANAGER_STD_HANDLERS, new Map());
        this.setProp(PROP_PROXY_HANDLERS, new Map());

        this._prepareManagerStdHandlers();
        this._prepareSocketStdHandlers();
    }

    public destroy() {
        this.stop();

        this._managerHandlers.clear();
        this._socketHandlers.clear();
        this._proxyHandlers.clear();
        super.destroy();
    }

    public start(callback?, context?) {

        const openHandler = (err?: Error) => {

            this._manager.off("open", openHandler);
            this._manager.off("connect_error", openHandler);

            if (err) {
                this.logger.error("on error: %o", DfiUtil.formatError(err));
                if (this._manager.reconnection()) {
                    DfiUtil.maybeCallbackOnce(callback, context);
                    return;
                }
                DfiUtil.maybeCallbackOnce(callback, context, err);

            } else {
                this.logger.info("on connect ");
                DfiUtil.maybeCallbackOnce(callback, context);
            }

        };

        this.logger.info("start");

        const ioTransportOptions = this.transportOptions;
        const opts = ioTransportOptions.ioOptions;
        opts.transports = ["websocket"];

        let socket: SocketIOClient.Socket;
        let url: string;

        url = ioTransportOptions.host;
        if (ioTransportOptions.port !== 80 && ioTransportOptions.port !== 443) {
            url = ioTransportOptions.host + ":" + ioTransportOptions.port;
        }
        url = url + (this.getProp(PROP_NAMESPACE) !== "/" ? "/" + this.getProp(PROP_NAMESPACE) : "/");
        socket = io(url, opts);

        this.setProp(PROP_SOCKET, socket);
        this.setProp(PROP_MANAGER, socket.io);

        this._bindManagerStdHandlers();
        this._bindSocketStdHandlers();

        this._bindProxyHandlers();

        if (!this._socket.connected && !this._socket.io.autoConnect) {
            this._socket.open();
        }

        if (this._manager.readyState !== "open") {
            this._manager.on("open", openHandler);
            this._manager.on("connect_error", openHandler);
            this.on(WebSocketTransport.events.STOP, () => {
                if (this._manager) {
                    this._manager.off("open", openHandler);
                    this._manager.off("connect_error", openHandler);
                }
            });
        } else {
            openHandler();
        }
    }

    public stop() {
        this.logger.info("stop");
        this.emit(WebSocketTransport.events.STOP);

        if (this._socket) {
            this._socket.disconnect();

            this._unbindProxyHandlers();
            this._unbindSocketStdHandlers();

            this._socket.removeAllListeners();
            this.removeProp(PROP_SOCKET);
        }
        if (this._manager) {
            delete this._manager.nsps[(this.nspName === "/" ? this.nspName : "/" + this.nspName)];
            if (Object.keys(io.managers).length > 0 && Object.keys(this._manager.nsps).length === 0) {
                const name = this._manager.uri.substr(0, this._manager.uri.length - 1);
                delete io.managers[name];
            }

            this._unbindManagerStsHandlers();
            this.removeProp(PROP_MANAGER);
        }

    }

    /*
    todo move to client implemtnataion
    public immediateStop() {
        delete this._manager.nsps[this._socket.nsp];
    }
    */

    public proxyOn(event: string, handler: (...args) => void) {
        this._proxyHandlers.set(event, handler);
        /*if (this._socket) {   // only caled from start so its impossible to have socke
            this._socket.on(event, handler);
        }*/
    }

    public proxyOff(event: string, handler: (...args) => void) {
        this._proxyHandlers.delete(event);
        if (this._socket) {
            this._socket.removeListener(event, handler);
        }
    }

    public send(action: string, data?: any, ackFn?: (err?, ...args) => void, context?: any) {
        const socket = this._socket;
        if (socket) {
            if (typeof ackFn === "function") {
                socket.emit(action, data, (...args) => {
                    ackFn.apply(context, args);
                });
            } else {
                socket.emit(action, data);
            }
        } else {
            this.logger.error("try to send: %o without socket", action);
            if (typeof ackFn === "function") {
                ackFn.apply(context, new Error('try to send: "' + action + '" without socket'));
            }
        }
    }

    private _prepareSocketStdHandlers() {
        this._socketHandlers.set("connect", () => {
            this.loggerS.debug("socket connect  - Fired upon connecting s:%o n:%o", this._socket.id, this._socket.nsp);
            this._socket._id = this._socket.id;
            this.emit(WebSocketTransport.events.CONNECTED, this);

        });

        this._socketHandlers.set("disconnect", (reason) => {
            this.loggerS.debug("socket disconnect  - Fired upon a disconnection s:%o n:%o reason:%o", this._socket._id, this._socket.nsp, reason);
            this.emit(WebSocketTransport.events.DISCONNECTED, reason);

            if (!this._manager.reconnection()) {
                this.emit(WebSocketTransport.events.ERROR, new Error("disconnect without reconnection"));
                return;
            }
        });

        this._socketHandlers.set("error", (error) => {
            this.loggerS.debug("socket error  - Fired upon a connection error");
            this.emit(WebSocketTransport.events.ERROR, error);
        });

        this._socketHandlers.set("reconnect", (reconnectionNumber) => {
            this.loggerS.debug("socket reconnect  - Fired upon a successful reconnection %o", reconnectionNumber);
        });

        this._socketHandlers.set("reconnect_attempt", () => {
            this.loggerS.debug("socket reconnect_attempt  - Fired upon an attempt to reconnect");
        });

        this._socketHandlers.set("reconnecting", (reconnectionNumber) => {
            this.loggerS.debug("socket reconnecting  - Fired upon an attempt to reconnect %o", reconnectionNumber);
        });

        this._socketHandlers.set("reconnect_error", (errorUp) => {
            this.loggerS.debug("socket reconnect_error  - Fired upon a reconnection attempt error %o", errorUp.message);
            const error = new Error("reconnect error");
            if (errorUp) {
                Object.assign(error, {description: errorUp});
            }
            this.emit(WebSocketTransport.events.ERROR, error);
        });

        this._socketHandlers.set("reconnect_failed", () => {
            this.loggerS.debug("socket reconnect_failed  - Fired when could not reconnect within reconnectionAttempts");

            this.emit(WebSocketTransport.events.ERROR, new Error("reconnect failed"));
        });
    }

    private _prepareManagerStdHandlers() {

        this._managerHandlers.set("connect_error", (error) => {
            this.loggerM.debug("manager connect_error - Fired upon a connection error %o", error.message);
        });

        this._managerHandlers.set("connect_timeout", () => {
            this.loggerM.debug("manager connect_timeout - Fired upon a connection timeout");
        });

        this._managerHandlers.set("reconnect", (reconnectionNumber) => {
            this.loggerM.debug("manager reconnect -  Fired upon a successful reconnection %o", reconnectionNumber);
        });

        this._managerHandlers.set("reconnect_attempt", () => {
            this.loggerM.debug("manager reconnect_attempt - Fired upon an attempt to reconnect");
        });

        this._managerHandlers.set("reconnecting", (reconnectionNumber) => {
            this.loggerM.debug("manager reconnecting - Fired upon an attempt to reconnect  %o", reconnectionNumber);
        });

        this._managerHandlers.set("reconnect_error", (error) => {
            this.loggerM.debug("manager reconnect_error - Fired upon a reconnection attempt error %o", error.message);
        });

        this._managerHandlers.set("reconnect_failed", () => {
            this.loggerM.debug("manager reconnect_failed - Fired when could not reconnect within reconnectionAttempts");
        });

        this._managerHandlers.set("open", () => {
            this.loggerM.debug("manager open - Fired upon ?");
        });
    }

    private _bindSocketStdHandlers() {
        this._socketHandlers.forEach((handler, event) => {
            this._socket.on(event, handler);
        });
    }

    private _unbindSocketStdHandlers() {
        this._socketHandlers.forEach((handler, event) => {
            this._socket.off(event, handler);
        });
    }

    private _bindManagerStdHandlers() {
        this._managerHandlers.forEach((handler, event) => {
            this._manager.on(event, handler);
        });
    }

    private _unbindManagerStsHandlers() {
        this._managerHandlers.forEach((handler, event) => {
            this._manager.off(event, handler);
        });
    }

    private _bindProxyHandlers() {
        this._proxyHandlers.forEach((handler, event) => {
            this._socket.on(event, handler);
        });
    }

    private _unbindProxyHandlers() {
        this._proxyHandlers.forEach((handler, event) => {
            this._socket.off(event, handler);
        });
    }

}

const EVENTS = {
    ...DfiEventObject.events,

    CONNECT: Symbol("t.connect"),    // socket event
    CONNECTED: Symbol("lt:connected"),
    DESTROYED: Symbol("lt:destroyed"),
    DISCONNECT: Symbol("t.disconnect"), // socket event
    DISCONNECTED: Symbol("lt:disconnected"),
    ERROR: Symbol("lt:error"),
    REGISTERED: Symbol("lt:registered"),
    STARTED: Symbol("lt:started"),
    STOP: Symbol("lt:stop"),
    SUB: Symbol("lt:subscription"),
    UN_REGISTERED: Symbol("lt:unRegistered"),
    UPDATE: Symbol("lt:update")
};

export default WebSocketTransport;
