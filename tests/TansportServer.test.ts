import TransportImpl from "./mock/TransportImpl";
import {ITransportOptions} from "../lib/interfaces";
import Transport from "../lib/Transport";
import TestServer from "./mock/TestServer";
import * as assert from "assert";

const cloneLiteral = (literal) => {
    return JSON.parse(JSON.stringify(literal))
}

const config: ITransportOptions = {
    ioTransportOptions: {
        host: "http://localhost",

        ioOptions: {
            forceNew: true,
            path: "/live.io"
        },
        port: 22223,
    }
};


let testServer: TestServer;


describe("Client with server", () => {
    it("start and connect to running", (done) => {
        testServer = new TestServer();

        const localConfig: ITransportOptions = cloneLiteral(config);
        const transport = new TransportImpl(localConfig);
        transport.on(Transport.events.ERROR, (err) => {
            testServer.destroy();
            done(err);
        });

        transport.on(Transport.events.CONNECTED, (tr) => {
            testServer.proxy.close("END TEST", () => {
                testServer.destroy();
                transport.destroy();
                done();
            });

        });

        transport.start((err) => {
            if (err) {
                transport.destroy();
                done();
            }
        });
    });
    it("start and connect to running namspace", (done) => {
        testServer = new TestServer();

        const localConfig: ITransportOptions = cloneLiteral(config);
        const transport = new TransportImpl(localConfig);
        transport.on(Transport.events.ERROR, (err) => {
            testServer.destroy();
            done(err);
        });

        transport.on(Transport.events.CONNECTED, (tr) => {
            testServer.proxy.close("END TEST", () => {
                testServer.destroy();
                transport.destroy();
                done();
            });

        });

        transport.nspName = "testNsp";

        transport.start((err) => {
            if (err) {
                transport.destroy();
                done();
            }
        });
    });
    it("start and connect to not running", (done) => {

        const localConfig: ITransportOptions = cloneLiteral(config);

        const transport = new TransportImpl(localConfig);
        transport.on(Transport.events.ERROR, (err) => {
            if (err.message === "reconnect failed") {
                testServer.destroy();
                transport.destroy();
                done(new Error("should not occur"));
            }

        });

        transport.on(Transport.events.CONNECTED, (tr) => {
            testServer.proxy.close("END TEST", () => {
                testServer.destroy();
                transport.destroy();
                done();
            });

        });

        transport.start((err) => {
            if (err) {
                testServer.destroy();
                transport.destroy();
                done();
            }
        });

        setTimeout(() => {
            testServer = new TestServer();
        }, 200);

    });

    it("start and connect to running then halt server ", (done) => {
        testServer = new TestServer();

        (testServer.proxy.toPlain() as { io } ).io.set('authorization', function (o, f) {
            f(null, false);
        });

        const localConfig: ITransportOptions = cloneLiteral(config);
        const transport = new TransportImpl(localConfig);
        transport.on(Transport.events.ERROR, (err) => {
            if (err === "Not authorized") {
                testServer.destroy();
                transport.destroy();
                done();
            }
        });

        transport.on(Transport.events.CONNECTED, (tr) => {
            testServer.proxy.close("END TEST", () => {
                testServer.destroy();
                transport.destroy();
                assert.fail("connected", null, "should not connect");
                done();
            });

        });

        transport.start((err) => {
            if (err) {
                testServer.proxy.destroy();
                transport.destroy();
                done();
            }
        });
    })

    it("start connect and send", (done) => {
        testServer = new TestServer();

        const localConfig: ITransportOptions = cloneLiteral(config);
        const transport = new TransportImpl(localConfig);
        transport.on(Transport.events.ERROR, (err) => {
            testServer.destroy();
            done(err);
        });

        transport.on(Transport.events.CONNECTED, (tr) => {

            const data = "testdata";
            transport.send("testaction", data)

            testServer.proxy.close("END TEST", () => {
                testServer.destroy();
                transport.destroy();
                done();
            });


        });

        transport.start((err) => {
            if (err) {
                transport.destroy();
                done();
            }
        });
    });

    it("start connect and send with ack", (done) => {
        testServer = new TestServer();

        const localConfig: ITransportOptions = cloneLiteral(config);
        const transport = new TransportImpl(localConfig);
        transport.on(Transport.events.ERROR, (err) => {
            testServer.destroy();
            done(err);
        });

        transport.on(Transport.events.CONNECTED, (tr) => {

            const data = "testdata";
            transport.send("testaction", data, (err?: Error, data1?) => {
                assert.ifError(err);
                assert.equal(data1, data, "response not equal");

                testServer.proxy.close("END TEST", () => {
                    testServer.destroy();
                    transport.destroy();
                    done();
                });
            });


        });

        transport.start((err) => {
            if (err) {
                transport.destroy();
                done();
            }
        });
    });
    it("start connect and send with ack namspace", (done) => {
        testServer = new TestServer();

        const localConfig: ITransportOptions = cloneLiteral(config);
        const transport = new TransportImpl(localConfig);
        transport.on(Transport.events.ERROR, (err) => {
            testServer.destroy();
            done(err);
        });

        transport.on(Transport.events.CONNECTED, (tr) => {

            const data = "testdata";
            transport.send("testNspAction", data, (err?: Error, data1?) => {
                assert.ifError(err);
                assert.equal(data1, data, "response not equal");

                testServer.proxy.close("END TEST", () => {
                    testServer.destroy();
                    transport.destroy();
                    done();
                });
            });
        });

        transport.nspName = "testNsp"

        transport.start((err) => {
            if (err) {
                transport.destroy();
                done();
            }
        });
    });

    it("start connect and send with ack timeout", (done) => {
        testServer = new TestServer();

        const localConfig: ITransportOptions = cloneLiteral(config);
        const transport = new TransportImpl(localConfig);
        transport.on(Transport.events.ERROR, (err) => {
            testServer.destroy();
            done(err);
        });

        transport.on(Transport.events.CONNECTED, (tr) => {

            const data = "testdata";
            transport.send("test", data, (err?: Error, data1?) => {
                assert.notEqual(err, null);
                assert.ok(err instanceof Error);

                testServer.proxy.close("END TEST", () => {
                    testServer.destroy();
                    transport.destroy();
                    done();
                });
            });


        });

        transport.start((err) => {
            if (err) {
                transport.destroy();
                done();
            }
        });
    });
});
