import WebsocketProtocol from "local-cc-live-server/lib/transports/transport/websocket"
import {IDfiLiveWebsocketProtocolOptions} from "local-cc-live-server/lib/interfaces";
import {DfiUtil} from "local-dfi-base/src/dfiUtil";

class TestServer {
    public proxy: WebsocketProtocol;

    constructor() {
        const config: IDfiLiveWebsocketProtocolOptions = {
            ioConfig: {
                http: {
                    port: 22223
                },
                https: {
                    port: 22224,
                    ssl: {
                        key: "tests/mock/ssl/key.pem",
                        cert: "tests/mock/ssl/cert.pem"
                    }
                },
                path: "/live.io",
                ioServerOptions: {}
            },
            loggerName: "testWs:"
        };

        this.proxy = new WebsocketProtocol(config);
        this.proxy.on(WebsocketProtocol.events.CONNECTED, (socket) => {
            socket.on("testaction", (data, ack) => {
                ack(data);
            });
        });
        const nsp = this.proxy.createNamespace("testNsp");

        nsp.on("connection", (socket) => {
            socket.on("testNspAction", (data, ack) => {
                ack(data);
            });
        });
        this.proxy.listen();

    }

    destroy(callbackFn?: (err?: Error) => void, contex?: any) {
        if (this.proxy) {
            this.proxy.close("testServer destroy", (err) => {
                this.proxy.destroy();
                if (err) {
                    DfiUtil.maybeCallback(callbackFn, context, err);
                }
                delete this.proxy;
            });
        }
    }
}

export default TestServer;