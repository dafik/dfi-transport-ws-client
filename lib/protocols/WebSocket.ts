import io = require("socket.io-client");
import {DfiEventObject, DfiUtil} from "local-dfi-base";
import DebugLogger from "local-dfi-debug-logger";
import {IIoSocket, IIoTransportOptions, IWebSocketProtocolOptions} from "./../interfaces";

const PROP_SOCKET_STD_HANDLERS = "socketHandlers";
const PROP_MANAGER_STD_HANDLERS = "managerHandlers";
const PROP_PROXY_HANDLERS = "proxyHandlers";
const PROP_SOCKET = "socket";
const PROP_MANAGER = "manager";

const PROP_LOGGER_SOCKET = "loggerS";
const PROP_LOGGER_MANAGER = "loggerM";

const PROP_TRANSPORT_OPTIONS = "transportOptions";

class WebSocketProtocol extends DfiEventObject {

    public static get events() {
        return EVENTS;
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

        const openHandler = (err) => {

            this._manager.off("open", openHandler);
            this._manager.off("connect_error", openHandler);

            if (err) {
                this.logger.info("on error");
                if (this._manager.reconnection()) {
                    DfiUtil.maybeCallbackOnce(callback, context);
                    return
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
        url = url + "/" + (this.getProp("namespace") || "");
        socket = io(url, opts);

        this.setProp(PROP_SOCKET, socket);
        this.setProp(PROP_MANAGER, socket.io);

        this._bindManagerStdHandlers();
        this._bindSocketStdHandlers();

        this._bindProxyHandlers();

        this._manager.on("open", openHandler);
        this._manager.on("connect_error", openHandler);

        if (!this._socket.connected && !this._socket.io.autoConnect) {
            this._socket.open();
        }
    }

    public stop(callback?, thisp?) {

        this.logger.info("stop");

        if (this._socket) {
            this._socket.disconnect();

            this._unbindProxyHandlers();
            this._unbindSocketStdHandlers();

            this._socket.removeAllListeners();
        }
        if (this._manager) {
            Object.keys(this._manager.nsps).forEach((nsp) => {
                delete this._manager.nsps[nsp];
            });

            this._manager.off("open");
            this._manager.off("connect_error");
            this._unbindManagerStsHandlers();
        }
        DfiUtil.maybeCallbackOnce(callback, thisp);
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

    public send(action: string, data?: {}, ackFn?: (...args) => void, context?) {
        const socket = this._socket;
        if (socket) {
            if (typeof ackFn === "function") {
                function localCallback() {
                    ackFn.apply(context, arguments);
                }

                socket.emit(action, data, localCallback);
            } else {
                socket.emit(action, data);
            }
        }
    }


    private _prepareSocketStdHandlers() {
        this._socketHandlers.set("connect", () => {
            this.loggerS.info("socket connect  - Fired upon connecting s:%j n:%j", this._socket.id, this._socket.nsp);
            this._socket._id = this._socket.id;
            this.emit(WebSocketProtocol.events.CONNECTED, this);

        });

        this._socketHandlers.set("disconnect", () => {
            this.loggerS.debug("socket disconnect  - Fired upon a disconnection s:%j n:%j", this._socket._id, this._socket.nsp);
            this.emit(WebSocketProtocol.events.DISCONNECTED);
        });

        this._socketHandlers.set("error", (error) => {
            this.loggerS.debug("socket error  - Fired upon a connection error");
            this.emit(WebSocketProtocol.events.ERROR, error);
        });

        this._socketHandlers.set("reconnect", (reconnectionNumber) => {
            this.loggerS.debug("socket reconnect  - Fired upon a successful reconnection %s", reconnectionNumber);
        });

        this._socketHandlers.set("reconnect_attempt", () => {
            this.loggerS.debug("socket reconnect_attempt  - Fired upon an attempt to reconnect");
        });

        this._socketHandlers.set("reconnecting", (reconnectionNumber) => {
            this.loggerS.debug("socket reconnecting  - Fired upon an attempt to reconnect %s", reconnectionNumber);
        });

        this._socketHandlers.set("reconnect_error", (error) => {
            this.loggerS.debug("socket reconnect_error  - Fired upon a reconnection attempt error %s", error.message);
            this.emit(WebSocketProtocol.events.ERROR, new Error("reconnect error"));
        });

        this._socketHandlers.set("reconnect_failed", () => {
            this.loggerS.debug("socket reconnect_failed  - Fired when could not reconnect within reconnectionAttempts");

            this.emit(WebSocketProtocol.events.ERROR, new Error("reconnect failed"));
        });
    }

    private _prepareManagerStdHandlers() {

        this._managerHandlers.set("connect_error", (error) => {
            this.loggerM.debug("manager connect_error - Fired upon a connection error %s", error.message);
        });

        this._managerHandlers.set("connect_timeout", () => {
            this.loggerM.debug("manager connect_timeout - Fired upon a connection timeout");
        });

        this._managerHandlers.set("reconnect", (reconnectionNumber) => {
            this.loggerM.debug("manager reconnect -  Fired upon a successful reconnection %j", reconnectionNumber);
        });

        this._managerHandlers.set("reconnect_attempt", () => {
            this.loggerM.debug("manager reconnect_attempt - Fired upon an attempt to reconnect");
        });

        this._managerHandlers.set("reconnecting", (reconnectionNumber) => {
            this.loggerM.debug("manager reconnecting - Fired upon an attempt to reconnect  %j", reconnectionNumber);
        });

        this._managerHandlers.set("reconnect_error", (error) => {
            this.loggerM.debug("manager reconnect_error - Fired upon a reconnection attempt error %s", error.message);
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
    SUB: Symbol("lt:subscription"),
    UN_REGISTERED: Symbol("lt:unRegistered"),
    UPDATE: Symbol("lt:update")
};

export default WebSocketProtocol;
