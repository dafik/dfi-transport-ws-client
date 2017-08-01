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
        super(options)

        this._prepareProtocolHandlers();
    }


    private _prepareProtocolHandlers() {
        this._protocolHandlers.set("update", (message) => {
            this.emit(TransportImpl.events.UPDATE, message);
        });
    }
}

const EVENTS = {
    ...Transport.events,
    UPDATE: Symbol("lt:update")
};