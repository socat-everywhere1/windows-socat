import * as dgram from "dgram";
import * as EventEmitter from "events";


export default class TunnelUdpClient extends EventEmitter {

    private socket: dgram.Socket;

    /* support ipv4, ipv6 without domain */
    constructor(
        private host: string,
        private port: number,
    ) {
        super();
        this.socket = dgram.createSocket({type:"udp4",reuseAddr:false,recvBufferSize:4096,sendBufferSize:4096});

        this.socket.on("message", this.data.bind(this));
        this.socket.on(("error"), (err) => this.emit("error", err));
    }

    public write(data: Buffer) {
        this.socket.send(data, 0, data.length, this.port, this.host);
    }
    public data(data: Buffer) {
        try {
            this.emit("data", data);
        } catch (error) {
            this.emit("error", error);
        }
    }

    public close() {
        this.socket.close();
    }
}
