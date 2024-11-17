import Config from "../Config";
import PacketUtils from "../PacketUtils";
import {
    EthernetType,
    BasePacket,
} from "../PacketsStruct";
import ConnectionManager from "../ConnectionManager";
import BufferFormatter from "../formatters/BufferFormatter";
import BasePacketFormatter from "../formatters/BasePacketFormatter";
import TunnelUdpClient from "../shadowsocks/TunnelUdpClient";

// tslint:disable-next-line:interface-name
interface IpConnection {
    ipversion: EthernetType;
    onFree?: () => void;
    udpClient: TunnelUdpClient;
    sourceAddress: Buffer;
    targetAddress: Buffer;
}

const connections = new ConnectionManager<IpConnection>();

function buildEthernetPacket(connection: IpConnection, data: Buffer): Buffer {
    //console.log("ethernet build dstmac:",connection.sourceAddress,"srcmac:",connection.targetAddress,"len:",data.length);
    return Buffer.concat([
        BasePacketFormatter.build({
            type: connection.ipversion,
            sourceAddress: connection.sourceAddress,
            destinaltionAddress: connection.targetAddress,
            }), data]);
}

export default function(data: Buffer, write: (data: Buffer) => void, next: () => void) {

    const basePacket: BasePacket = BasePacketFormatter.format(data);
    
    const connectionId: string = "ipou";
    if (basePacket.type!=EthernetType.IPv4){
        console.log("unsupported ethernet packet")
        return ;
    }
    /* unsupported large udp packet now. */
    if (data.length > 1400) { 
        console.log("unsupported length :",data.length)
     }

    let connection: IpConnection = connections.get(connectionId);

    if (connection == null) {
        let isClosed: boolean = false;
        connection = {
            ipversion: basePacket.type,
            sourceAddress: basePacket.sourceAddress,
            targetAddress: basePacket.destinaltionAddress,
            udpClient: new TunnelUdpClient(
                Config.get("IPoUHost"),
                Config.get("IPoUPort"),
            ),
            onFree() {
                if (isClosed) { return; }
                isClosed = true;
                connection.udpClient.close();
            },
        };
        // tslint:disable-next-line:no-shadowed-variable
        connection.udpClient.on("data", (data) => {
           
            // tslint:disable-next-line:no-shadowed-variable
            const ethernetPacket: Buffer = buildEthernetPacket(connection, data);
            connections.get(connectionId);
            write(ethernetPacket);
        });
        connection.udpClient.on("error", (err) => {
            console.log(err);
            isClosed = true;
            connection.udpClient.removeAllListeners();
            connections.remove(connectionId);
        });
        connections.add(connectionId, connection);
    }
    //kill the mac layer
    const bufferFormatter = new BufferFormatter(data);
    bufferFormatter.setOffset(14);
    connection.udpClient.write( bufferFormatter.readBuffer());
}



