import {IDfiBaseObjectConfig} from "local-dfi-base";

export interface IIoTransportOptions extends IDfiBaseObjectConfig {
    host: string;
    ioOptions: SocketIOClient.ConnectOpts;
    port: number;
}

export interface ITransportOptions extends IDfiBaseObjectConfig {
    ioTransportOptions: IIoTransportOptions;
    nspName?: string;
    useTimers?: boolean;
    timeout?: number;
}

export interface IWebSocketProtocolOptions extends IDfiBaseObjectConfig {
    transportOptions: IIoTransportOptions;
    nspName?: string;
}

export interface IIoSocket extends SocketIOClient.Socket {
    _id?: string;
}
