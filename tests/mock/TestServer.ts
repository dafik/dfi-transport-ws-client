import WebsocketServer from "local-cc-live-server/lib/transports/transport/websocketServer"
import {IDfiLiveWebsocketServerOptions} from "local-cc-live-server/lib/interfaces";
import {DfiUtil} from "local-dfi-base/src/dfiUtil";

class TestServer {
    public proxy: WebsocketServer;

    constructor() {
        const config: IDfiLiveWebsocketServerOptions = {
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
            loggerName: "testWs:",
            protocolHandlers: new Map()
        };
        config.protocolHandlers.set("testaction", (websocket, data, ack) => {
            ack(data);
        });

        this.proxy = new WebsocketServer(config);
        this.proxy.on(WebsocketServer.events.CONNECTED, (socket) => {
            const a = 1
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