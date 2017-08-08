import {IDfiBaseObjectConfig} from "local-dfi-base";

export interface IIoTransportOptions extends IDfiBaseObjectConfig {
    host: string;
    ioOptions: SocketIOClient.ConnectOpts;
    port: number;
}

export interface ITransportOptions extends IDfiBaseObjectConfig {
    ioTransportOptions: IIoTransportOptions;
    namespace?: string;
}

export interface IWebSocketProtocolOptions extends IDfiBaseObjectConfig {
    transportOptions: IIoTransportOptions;
    namespace?: string;
}

export interface IIoSocket extends SocketIOClient.Socket {
    _id?: string;
}

interface NoCaller {
    caller?: void;
}

interface NoBind {
    bind?: void;
}

interface NoApply {
    apply?: void;
}

interface NoCall {
    call?: void;
}

export type NotAFunction = NoCaller | NoBind | NoApply | NoCall;
