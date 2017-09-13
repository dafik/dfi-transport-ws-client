import TransportImpl from "./mock/TransportImpl";
import {ITransportOptions} from "../lib/interfaces";
import Transport from "../lib/Transport";
import DebugLogger from "local-dfi-debug-logger/debugLogger";
import * as assert from "assert";

const logger = new DebugLogger("test");
const cloneLiteral = (literal) => {
    return JSON.parse(JSON.stringify(literal))
}

const config: ITransportOptions = {
    ioTransportOptions: {
        host: "localhost",
        ioOptions: {
            forceNew: true
        },
        port: 22223,
    }
};

describe("Client only", () => {

    it("new client", (done) => {
        (new TransportImpl(config)).destroy();
        done();
    });

    it("new client autoconnect off", (done) => {
        const localConfig: ITransportOptions = cloneLiteral(config);
        const opts = localConfig.ioTransportOptions.ioOptions;
        opts.reconnection = false;
        opts.autoConnect = false;

        const transport = new TransportImpl(localConfig);
        transport.start((err) => {
            if (err) {
                transport.destroy();
                done();
            }
        });
    });

    it("start fail without reconection", (done) => {
        const localConfig: ITransportOptions = cloneLiteral(config);
        const opts = localConfig.ioTransportOptions.ioOptions;
        opts.reconnection = false;
        opts.timeout = 9000000;

        const transport = new TransportImpl(localConfig);
        transport.on(Transport.events.ERROR, (err) => {
            done(new Error("should not occur"));
        });

        transport.start((err) => {
            if (err) {
                transport.destroy();
                done();
            }
        });

    });
    /*it("start fail timeout", (done) => {  //cant simulate ?
        const localConfig: ITransportOptions = cloneLiteral(config);
        const opts = localConfig.ioTransportOptions.ioOptions;
        opts.reconnection = true;
        opts.reconnectionAttempts = 2;
        opts.timeout = 90;

        const transport = new TransportImpl(localConfig);
        transport.on(Transport.events.ERROR, (err) => {
            logger.info(err.message)
            //done(new Error("should not occur"));
        });

        transport.start((err) => {
            if (err) {
                transport.destroy();
                done();
            }
        });

    })*/

    it("start stop without reconection", (done) => {
        const localConfig: ITransportOptions = cloneLiteral(config);
        const opts = localConfig.ioTransportOptions.ioOptions;
        opts.reconnection = false;
        opts.timeout = 9000000;

        const transport = new TransportImpl(localConfig);
        transport.on(Transport.events.ERROR, (err) => {
            done(new Error("should not occur"));
        });

        transport.start((err) => {
            if (err) {
                transport.stop();
                done();
            }
        });

    });

    it("start fail with reconection", (done) => {

        const localConfig: ITransportOptions = cloneLiteral(config);
        const opts = localConfig.ioTransportOptions.ioOptions;
        opts.reconnection = true;
        opts.reconnectionAttempts = 1;
        opts.timeout = 9000000;

        const transport = new TransportImpl(localConfig);
        transport.on(Transport.events.ERROR, (err: Error) => {
            if (err) {
                logger.info(err.message);
                if (err.message === "reconnect error") {
                    done();
                }
            } else {
                done(new Error("emtpty error"));
            }
        });

        transport.start((err) => {
            if (err) {
                done(err);
                return
            }
        });
    }).timeout(5000);

    it("timers", (done) => {
        const transport = new TransportImpl(config);


        const timer = transport._createTimer(50, "timer1", () => {
            done(new Error("timer should not fire"));
        });
        transport._clearTimer(timer);


        transport._createTimer(50, "timer2", () => {
            transport._createTimer(50, "timer3", () => {
                done(new Error("timer should not fire"));
            });
            transport.destroy();
            done();
        })
    });


    it("stop when not started", (done) => {
        const transport = new TransportImpl(config);


        assert.doesNotThrow((err) => {
            transport.stop();
        });

        transport.destroy();
        done();
    })
});
