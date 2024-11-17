import PacketUtils from "../PacketUtils";
import ArpPacketFormatter from "../formatters/ArpPacketFormatter";
import DeviceConfiguration from "../DeviceConfiguration";


export default function(data: Buffer, write: (data: Buffer) => void, next: () => void) {
    if (!PacketUtils.isARP(data)) {
        return next();
    }

    const arpPacket = ArpPacketFormatter.format(data as Buffer);

    if (PacketUtils.ipv4ToString(arpPacket.senderIpAdress) !== DeviceConfiguration.LOCAL_IP_ADDRESS) {
        return;
    }
    
    if (PacketUtils.ipv4ToString(arpPacket.targetIpAddeess).slice(0,5) !== DeviceConfiguration.GATEWAY_IP_ADDRESS.slice(0,5)) {
        console.log("reject ARP asking for "+PacketUtils.ipv4ToString(arpPacket.targetIpAddeess))
        //return;
    }

    const gatewayMac: Buffer = Buffer.allocUnsafe(6);
    DeviceConfiguration.GATEWAY_MACADDRESS.split(":").forEach((item, index) => {
        gatewayMac[index] = parseInt(`0x${item}`, 16);
    });

    const responsePacket: Buffer = ArpPacketFormatter.build({
        sourceAddress: gatewayMac,
        destinaltionAddress: arpPacket.destinaltionAddress,
        /* 1 */
        hardwareType: new Buffer([0x00, 0x01]),
        /* ipv4 0x0800 */
        protocolType: new Buffer([0x08, 0x00]),
        /* 6 */
        hardwareSize: new Buffer([0x06]),
        /* 4 */
        protocalSize: new Buffer([0x04]),
        /* reply */
        opCode: new Buffer([0x00, 0x02]),
        senderMacAddress: gatewayMac,
        senderIpAdress: arpPacket.targetIpAddeess, //PacketUtils.stringToIpv4(DeviceConfiguration.GATEWAY_IP_ADDRESS),
        targetMacAddress: arpPacket.destinaltionAddress,
        targetIpAddeess: PacketUtils.stringToIpv4(DeviceConfiguration.LOCAL_IP_ADDRESS),
    });

    write(responsePacket);
}
